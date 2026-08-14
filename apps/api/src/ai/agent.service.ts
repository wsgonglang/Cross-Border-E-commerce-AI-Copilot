import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common'
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
import { AiExecutionError, classifyAiError } from './ai-errors'
import { MAX_ACTIVE_AGENT_RUNS_PER_USER } from './agent-queue.constants'
import { AgentQueueService } from './agent-queue.service'
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
import { AGENT_PROMPT_VERSION } from './ai-prompts'

const MAX_TOOL_CALLS = 6
const MAX_AGENT_STEPS = 4
const MAX_AGENT_TOKENS = 16_000
const FALLBACK_ANSWER =
  '业务工具已经执行，请根据工具轨迹核对结果。若创建了优化草稿，仍需在商品管理中人工确认。'

class AgentRunCancelledError extends AiExecutionError {
  constructor() {
    super('CANCELLED', 'Agent run cancelled')
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
  private readonly failedUsage = new Map<string, AiUsage>()

  constructor(
    private readonly merchantAccess: MerchantAccessService,
    private readonly agentTools: AgentToolsService,
    private readonly agentRuns: AgentRunsService,
    private readonly storesService: StoresService,
    private readonly aiService: AiService,
    private readonly aiSessions: AiSessionsService,
    private readonly agentQueue: AgentQueueService,
    @Inject(AI_PROVIDER) private readonly aiProvider: AiProvider,
  ) {}

  /**
   * 校验访问权并创建运行记录后立即返回 runId，执行过程交给 BullMQ Worker；
   * 前端优先订阅 SSE，连接不可用时通过 GET runId 恢复持久化结果。
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
    if (
      (await this.agentRuns.countActiveForUser(actor.id)) >=
      MAX_ACTIVE_AGENT_RUNS_PER_USER
    ) {
      throw new HttpException(
        `每位用户最多同时运行 ${MAX_ACTIVE_AGENT_RUNS_PER_USER} 个 Agent`,
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }
    if (storeId) {
      await this.storesService.assertStore(actor, merchantId, storeId)
    }
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
      days,
      AGENT_PROMPT_VERSION,
    )
    try {
      await this.agentQueue.enqueue(runId)
    } catch {
      await this.agentRuns.fail(runId, 'Agent 队列暂时不可用', {
        code: 'INTERNAL_ERROR',
      })
      if (turn) {
        await this.aiSessions.failAgentTurn(
          turn.sessionId,
          'Agent 队列暂时不可用',
        )
      }
      throw new BadGatewayException('Agent 队列暂时不可用，请稍后重试')
    }
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
    await this.agentQueue.cancelWaiting(runId).catch(() => undefined)
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
    signal?: AbortSignal
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
            input.signal,
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

    const assertNotCancelled = async () => {
      if (input.signal?.aborted || (await this.agentRuns.isCancelled(runId))) {
        throw new AgentRunCancelledError()
      }
    }

    for (let step = 0; step < MAX_AGENT_STEPS; step += 1) {
      await assertNotCancelled()
      const budgetLeft = MAX_TOOL_CALLS - results.length
      const forceFinish =
        step === MAX_AGENT_STEPS - 1 ||
        budgetLeft <= 0 ||
        usage.totalTokens >= MAX_AGENT_TOKENS
      let stepResult: Awaited<ReturnType<AiProvider['runAgentStep']>>
      try {
        stepResult = await this.aiProvider.runAgentStep({
          messages,
          tools,
          forceFinish,
          signal: input.signal,
        })
      } catch (error: unknown) {
        const classified = classifyAiError(error)
        if (results.length === 0) {
          this.failedUsage.set(runId, usage)
          throw classified
        }
        // 已有工具结果时降级为兜底结论，不让整次运行报废。
        answer = FALLBACK_ANSWER
        break
      }
      usage = addUsage(usage, stepResult.usage)
      this.failedUsage.set(runId, usage)
      await assertNotCancelled()

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
        await assertNotCancelled()
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
            runId,
            input.signal,
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
    await assertNotCancelled()
    const assistantMessageId =
      input.sessionId && input.userMessageId
        ? await this.aiSessions.finishAgentTurn(
            input.sessionId,
            input.userMessageId,
            answer,
          )
        : undefined
    await assertNotCancelled()
    await this.agentRuns.complete({
      runId,
      answer,
      usage,
      providerName: this.aiProvider.name,
      modelName: this.aiProvider.model,
      createdOptimizationIds,
      assistantMessageId,
    })
    this.failedUsage.delete(runId)

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

  takeFailedUsage(runId: string): AiUsage | undefined {
    const usage = this.failedUsage.get(runId)
    this.failedUsage.delete(runId)
    return usage
  }
}
