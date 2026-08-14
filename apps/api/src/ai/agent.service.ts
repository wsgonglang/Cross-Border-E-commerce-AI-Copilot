import { BadGatewayException, Inject, Injectable } from '@nestjs/common'
import type {
  AgentRunResponse,
  AgentRunStartResponse,
  AgentToolCallSummary,
  AiUsage,
  AuthenticatedUser,
} from '@cross-border/shared'

import { MerchantAccessService } from '../commerce/merchant-access.service'
import { StoresService } from '../commerce/stores.service'
import { AI_PROVIDER, type AiProvider } from './ai-provider.service'
import {
  AGENT_TOOL_DEFINITIONS,
  type AgentConversationMessage,
} from './agent-tools.contract'
import { AgentToolsService } from './agent-tools.service'
import { AgentRunsService } from './agent-runs.service'
import { AiService } from './ai.service'
import { AiSessionsService } from './ai-sessions.service'
import { compactAgentToolResult } from './context-budget'
import { validateRuleCitations } from './rule-citation-validator'

const MAX_TOOL_CALLS = 6
const MAX_AGENT_STEPS = 4
const FALLBACK_ANSWER =
  '业务工具已经执行，请根据工具轨迹核对结果。若创建了优化草稿，仍需在商品管理中人工确认。'

class AgentRunCancelledError extends Error {
  constructor() {
    super('Agent run cancelled')
    this.name = 'AgentRunCancelledError'
  }
}

function addUsage(first: AiUsage, second: AiUsage): AiUsage {
  return {
    promptTokens: first.promptTokens + second.promptTokens,
    completionTokens: first.completionTokens + second.completionTokens,
    totalTokens: first.totalTokens + second.totalTokens,
  }
}

@Injectable()
export class AgentService {
  constructor(
    private readonly merchantAccess: MerchantAccessService,
    private readonly agentTools: AgentToolsService,
    private readonly agentRuns: AgentRunsService,
    private readonly storesService: StoresService,
    private readonly aiService: AiService,
    private readonly aiSessions: AiSessionsService,
    @Inject(AI_PROVIDER) private readonly aiProvider: AiProvider,
  ) {}

  /**
   * 校验访问权并创建运行记录后立即返回 runId，执行过程转入后台；
   * 前端通过 GET runs/:runId 轮询实时工具轨迹与最终结论。
   */
  async run(
    actor: AuthenticatedUser,
    merchantId: string,
    message: string,
    storeId?: string,
    days: number = 7,
    sourcePage?: string,
    conversation?: {
      sessionId: string
      parentMessageId?: string
      regenerateMessageId?: string
    },
  ): Promise<AgentRunStartResponse> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    const store = storeId
      ? await this.storesService.assertStore(actor, merchantId, storeId)
      : undefined
    const turn = conversation
      ? await this.aiSessions.prepareAgentTurn(actor, merchantId, {
          ...conversation,
          content: message,
        })
      : undefined
    const runId = await this.agentRuns.start(
      actor,
      merchantId,
      message,
      storeId,
      sourcePage,
      turn,
    )
    void this.executeRun({
      actor,
      merchantId,
      runId,
      message,
      storeName: store
        ? `${store.name} / ${store.platform} / ${store.market}，storeId=${store.id}`
        : undefined,
      storeId,
      storeContext: store
        ? { platform: store.platform, market: store.market }
        : undefined,
      days,
      sessionId: turn?.sessionId,
      userMessageId: turn?.userMessageId,
    }).catch(async () => {
      // executeRun 内部已按阶段落库失败状态，这里只兜底防止后台任务抛出未处理异常。
      try {
        if (await this.agentRuns.isCancelled(runId)) return
        await this.agentRuns.fail(runId, 'Agent execution failed')
        if (turn) {
          await this.aiSessions.failAgentTurn(
            turn.sessionId,
            'Agent execution failed',
          )
        }
      } catch {
        /* 状态已是终态时忽略 */
      }
    })
    return {
      runId,
      status: 'PLANNING',
      ...(turn
        ? { sessionId: turn.sessionId, userMessageId: turn.userMessageId }
        : {}),
    }
  }

  async cancel(
    actor: AuthenticatedUser,
    merchantId: string,
    runId: string,
  ): Promise<{ cancelled: true }> {
    const linked = await this.agentRuns.cancel(actor, merchantId, runId)
    if (linked.sessionId && linked.userMessageId) {
      await this.aiSessions.cancelAgentTurn(
        linked.sessionId,
        linked.userMessageId,
      )
    }
    return { cancelled: true }
  }

  /** 受控 ReAct 循环：模型每步基于已回填的工具结果决定继续调用工具或收敛结论。 */
  async executeRun(input: {
    actor: AuthenticatedUser
    merchantId: string
    runId: string
    message: string
    storeName?: string
    storeId?: string
    storeContext?: { platform: string; market: string }
    days: number
    sessionId?: string
    userMessageId?: string
  }): Promise<AgentRunResponse> {
    const { actor, merchantId, runId, message, storeId, days } = input
    const periodContext = `近 ${days} 天（含上一周期对比）`
    const contextualMessage = input.storeName
      ? `[当前店铺：${input.storeName}；时间范围：${periodContext}] ${message}`
      : `[当前商家全部店铺；时间范围：${periodContext}] ${message}`
    const explicitDraftIntent = /草稿|优化|翻译|DRAFT|OPTIMIZE|TRANSLATE/i.test(
      message,
    )
    const canWrite = actor.roles.some((role) =>
      ['admin', 'operator'].includes(role),
    )
    // 服务端最后防线：无明确意图或无写权限时，草稿工具对模型不可见。
    const tools = AGENT_TOOL_DEFINITIONS.filter(
      (tool) =>
        tool.name !== 'create_product_optimization_draft' ||
        (explicitDraftIntent && canWrite),
    )

    const branchContext =
      input.sessionId && input.userMessageId
        ? await this.aiService.getModelContextForLeaf(
            input.sessionId,
            input.userMessageId,
          )
        : []
    const messages: AgentConversationMessage[] = branchContext.flatMap(
      (item): AgentConversationMessage[] => {
        if (item.role === 'system') {
          return [{ role: 'system', content: item.content }]
        }
        if (item.role === 'assistant') {
          return [{ role: 'assistant', content: item.content }]
        }
        if (item.role === 'user') {
          return [{ role: 'user', content: item.content }]
        }
        return []
      },
    )
    if (messages.length > 0 && messages.at(-1)?.role === 'user') {
      messages[messages.length - 1] = {
        role: 'user',
        content: contextualMessage,
      }
    } else {
      messages.push({ role: 'user', content: contextualMessage })
    }
    if (input.sessionId && input.userMessageId && branchContext.length === 1) {
      void this.aiService.generateTitleForConversation(
        actor,
        merchantId,
        input.sessionId,
        branchContext,
      )
    }
    const results: AgentToolCallSummary[] = []
    let usage: AiUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    }
    let draftToolExecuted = false
    let answer: string | null = null

    for (let step = 0; step < MAX_AGENT_STEPS; step += 1) {
      if (await this.agentRuns.isCancelled(runId)) {
        throw new AgentRunCancelledError()
      }
      const budgetLeft = MAX_TOOL_CALLS - results.length
      const forceFinish = step === MAX_AGENT_STEPS - 1 || budgetLeft <= 0
      let stepResult: Awaited<ReturnType<AiProvider['runAgentStep']>>
      try {
        stepResult = await this.aiProvider.runAgentStep({
          messages,
          tools,
          forceFinish,
        })
      } catch {
        if (results.length === 0) {
          // 首步失败等价于原“规划失败”：没有任何工具执行过，直接终止运行。
          await this.agentRuns.fail(runId, 'AI Agent planning failed')
          throw new BadGatewayException('AI Agent 规划失败，请稍后重试')
        }
        // 已有工具结果时降级为兜底结论，不让整次运行报废。
        answer = FALLBACK_ANSWER
        break
      }
      usage = addUsage(usage, stepResult.usage)
      if (await this.agentRuns.isCancelled(runId)) {
        throw new AgentRunCancelledError()
      }

      if (stepResult.toolCalls.length === 0) {
        answer = stepResult.answer?.trim() || FALLBACK_ANSWER
        break
      }
      if (results.length === 0) {
        await this.agentRuns.markRunning(runId)
      }

      const calls = stepResult.toolCalls.slice(0, budgetLeft)
      messages.push({
        role: 'assistant',
        content: stepResult.answer,
        toolCalls: calls,
      })
      for (const call of calls) {
        if (await this.agentRuns.isCancelled(runId)) {
          throw new AgentRunCancelledError()
        }
        let summary: AgentToolCallSummary
        if (
          call.name === 'create_product_optimization_draft' &&
          (!explicitDraftIntent || draftToolExecuted)
        ) {
          // 防线兜底：即使模型越权请求，也回填拒绝结果保持会话协议完整。
          summary = {
            id: call.id,
            name: 'create_product_optimization_draft',
            status: 'error',
            input:
              typeof call.arguments === 'object' && call.arguments !== null
                ? (call.arguments as Record<string, unknown>)
                : {},
            error: '草稿工具已被服务端策略拒绝：缺少明确意图或每次运行最多一次',
          }
        } else {
          if (call.name === 'create_product_optimization_draft') {
            draftToolExecuted = true
          }
          summary = await this.agentTools.execute(
            actor,
            merchantId,
            call,
            storeId,
            days,
            input.storeContext,
          )
        }
        results.push(summary)
        await this.agentRuns.appendToolCall(runId, summary, results.length - 1)
        messages.push({
          role: 'tool',
          toolCallId: call.id,
          name: summary.name,
          content: JSON.stringify(
            compactAgentToolResult(
              summary.status === 'success'
                ? (summary.output ?? {})
                : { error: summary.error },
            ),
          ),
        })
      }
    }

    if (answer === null) {
      answer = FALLBACK_ANSWER
    }
    answer = validateRuleCitations(answer, results).answer

    const createdOptimizationIds = results.flatMap((result) => {
      if (
        result.name !== 'create_product_optimization_draft' ||
        result.status !== 'success' ||
        typeof result.output !== 'object' ||
        result.output === null
      ) {
        return []
      }
      const id = (result.output as Record<string, unknown>).optimizationId
      return typeof id === 'string' ? [id] : []
    })
    const assistantMessageId =
      !(await this.agentRuns.isCancelled(runId)) &&
      input.sessionId &&
      input.userMessageId
        ? await this.aiSessions.finishAgentTurn(
            input.sessionId,
            input.userMessageId,
            answer,
          )
        : undefined
    if (await this.agentRuns.isCancelled(runId)) {
      throw new AgentRunCancelledError()
    }
    await this.agentRuns.complete({
      runId,
      answer,
      usage,
      providerName: this.aiProvider.name,
      modelName: this.aiProvider.model,
      createdOptimizationIds,
      assistantMessageId,
    })

    return {
      runId,
      answer,
      toolCalls: results,
      usage,
      createdOptimizationIds,
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      ...(input.userMessageId ? { userMessageId: input.userMessageId } : {}),
      ...(assistantMessageId ? { assistantMessageId } : {}),
    }
  }
}
