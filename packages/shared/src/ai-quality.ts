import type { AgentRunStatus, AgentToolName } from './agent'
import type { OptimizationStatus } from './product-optimization'

export type AiQualityWindowDays = 7 | 30 | 90

export interface AiQualityRateMetric {
  numerator: number
  denominator: number
  rate: number | null
}

export interface AiQualityTokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface AiQualityToolMetric {
  name: AgentToolName | 'unknown'
  calls: number
  successes: number
  successRate: number | null
}

export interface AiQualityDailyPoint {
  date: string
  agentRuns: number
  failedRuns: number
  toolCalls: number
  successfulToolCalls: number
  generatedDrafts: number
  appliedDrafts: number
  rejectedDrafts: number
  totalTokens: number
}

export interface AiQualityTrace {
  id: string
  type: 'AGENT_RUN' | 'PRODUCT_OPTIMIZATION'
  title: string
  status: AgentRunStatus | OptimizationStatus
  createdAt: string
  completedAt?: string
  latencyMs?: number
  totalTokens: number
  providerName?: string
  modelName?: string
  sourcePage?: string
  product?: {
    id: string
    code: string
    title: string
  }
}

export interface AiQualityReport {
  merchantId: string
  windowDays: AiQualityWindowDays
  period: {
    from: string
    to: string
  }
  generatedDrafts: number
  reviewedDrafts: number
  acceptance: AiQualityRateMetric
  agentRuns: number
  agentFailures: AiQualityRateMetric
  toolCalls: AiQualityRateMetric
  helpfulFeedback: AiQualityRateMetric
  feedbackReasons: Array<{ reason: string; count: number }>
  averageAgentLatencyMs: number | null
  tokenUsage: AiQualityTokenUsage
  tools: AiQualityToolMetric[]
  daily: AiQualityDailyPoint[]
  recentTraces: AiQualityTrace[]
  methodology: {
    acceptance: string
    toolSuccess: string
    failure: string
    latency: string
    tokens: string
    feedback: string
  }
}
