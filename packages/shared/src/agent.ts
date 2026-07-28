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
  answer: string
  toolCalls: AgentToolCallSummary[]
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  createdOptimizationIds: string[]
}
