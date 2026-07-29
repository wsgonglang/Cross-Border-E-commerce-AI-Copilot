import { BadGatewayException, Inject, Injectable } from '@nestjs/common'
import type {
  AgentRunResponse,
  AgentToolCallSummary,
  AiUsage,
  AuthenticatedUser,
} from '@cross-border/shared'

import { MerchantAccessService } from '../commerce/merchant-access.service'
import { AI_PROVIDER, type AiProvider } from './ai-provider.service'
import { AGENT_TOOL_DEFINITIONS } from './agent-tools.contract'
import { AgentToolsService } from './agent-tools.service'
import { AgentRunsService } from './agent-runs.service'

const MAX_TOOL_CALLS = 6

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
    @Inject(AI_PROVIDER) private readonly aiProvider: AiProvider,
  ) {}

  async run(
    actor: AuthenticatedUser,
    merchantId: string,
    message: string,
  ): Promise<AgentRunResponse> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    const runId = await this.agentRuns.start(actor, merchantId, message)
    const explicitDraftIntent = /草稿|优化|翻译|DRAFT|OPTIMIZE|TRANSLATE/i.test(
      message,
    )
    const tools = AGENT_TOOL_DEFINITIONS.filter(
      (tool) =>
        tool.name !== 'create_product_optimization_draft' ||
        explicitDraftIntent,
    )

    let planned: Awaited<ReturnType<AiProvider['planAgentTools']>>
    try {
      planned = await this.aiProvider.planAgentTools({ message, tools })
    } catch {
      await this.agentRuns.fail(runId, 'AI Agent planning failed')
      throw new BadGatewayException('AI Agent 规划失败，请稍后重试')
    }

    await this.agentRuns.markRunning(runId)
    const calls = planned.toolCalls.slice(0, MAX_TOOL_CALLS)
    const results: AgentToolCallSummary[] = []
    let draftToolExecuted = false
    for (const call of calls) {
      if (call.name === 'create_product_optimization_draft') {
        if (!explicitDraftIntent || draftToolExecuted) continue
        draftToolExecuted = true
      }
      results.push(await this.agentTools.execute(actor, merchantId, call))
    }

    let answer: string
    let summaryUsage: AiUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    }
    try {
      const summary = await this.aiProvider.summarizeAgent({
        message,
        toolCalls: results,
      })
      answer = summary.answer
      summaryUsage = summary.usage
    } catch {
      answer =
        '业务工具已经执行，请根据工具轨迹核对结果。若创建了优化草稿，仍需在商品管理中人工确认。'
    }

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
    const usage = addUsage(planned.usage, summaryUsage)
    await this.agentRuns.complete({
      runId,
      answer,
      usage,
      providerName: this.aiProvider.name,
      modelName: this.aiProvider.model,
      toolCalls: results,
      createdOptimizationIds,
    })

    return {
      runId,
      answer,
      toolCalls: results,
      usage,
      createdOptimizationIds,
    }
  }
}
