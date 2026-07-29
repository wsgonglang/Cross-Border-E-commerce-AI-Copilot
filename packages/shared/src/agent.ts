export const AGENT_TOOL_NAMES = [
  'search_products',
  'get_inventory',
  'get_order_status',
  'get_business_overview',
  'search_platform_rules',
  'create_product_optimization_draft',
] as const

export type AgentToolName = (typeof AGENT_TOOL_NAMES)[number]
export type AgentToolStatus = 'success' | 'error'

export interface AgentToolCallSummary {
  id: string
  name: AgentToolName | 'unknown'
  status: AgentToolStatus
  input: Record<string, unknown>
  output?: unknown
  error?: string
}

export interface AgentRunResponse {
  runId: string
  answer: string
  toolCalls: AgentToolCallSummary[]
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  createdOptimizationIds: string[]
}

export type AgentRunStatus = 'PLANNING' | 'RUNNING' | 'COMPLETED' | 'FAILED'

export interface AgentRunSummary extends AgentRunResponse {
  id: string
  merchantId: string
  userId: string
  message: string
  status: AgentRunStatus
  providerName?: string
  modelName?: string
  error?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export type AiResultType = 'AGENT_RUN' | 'PRODUCT_OPTIMIZATION'

export interface AiResultItem {
  id: string
  type: AiResultType
  status: string
  title: string
  description: string
  createdAt: string
  updatedAt: string
  agentRunId?: string
  optimizationId?: string
  product?: {
    id: string
    code: string
    title: string
  }
  batchTaskId?: string
  targetLanguage?: string
}

export interface PaginatedAiResults {
  items: AiResultItem[]
  page: number
  pageSize: number
  total: number
}
