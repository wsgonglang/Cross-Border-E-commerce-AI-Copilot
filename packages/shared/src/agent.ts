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

export type AiErrorCode =
  | 'PROVIDER_TIMEOUT'
  | 'RATE_LIMITED'
  | 'INVALID_OUTPUT'
  | 'TOOL_ERROR'
  | 'CANCELLED'
  | 'INTERNAL_ERROR'

export interface AgentToolCallSummary {
  id: string
  name: AgentToolName | 'unknown'
  status: AgentToolStatus
  input: Record<string, unknown>
  output?: unknown
  error?: string
  startedAt?: string
  completedAt?: string
  durationMs?: number
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
  sessionId?: string
  userMessageId?: string
  assistantMessageId?: string
}

export type AgentRunStatus =
  'PLANNING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

export interface AgentRunStartResponse {
  runId: string
  status: AgentRunStatus
  sessionId?: string
  userMessageId?: string
}

export interface AgentRunSummary extends AgentRunResponse {
  id: string
  merchantId: string
  storeId?: string
  userId: string
  message: string
  sourcePage?: string
  allowDraftCreation?: boolean
  status: AgentRunStatus
  providerName?: string
  modelName?: string
  promptVersion?: string
  errorCode?: AiErrorCode
  error?: string
  startedAt?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export type AgentFeedbackRating = 'HELPFUL' | 'NOT_HELPFUL'
export type AgentFeedbackReason =
  | 'WRONG_TOOL'
  | 'INACCURATE_DATA'
  | 'INCOMPLETE_ANSWER'
  | 'CITATION_ISSUE'
  | 'TOO_SLOW'
  | 'OTHER'

export interface AgentRunFeedbackSummary {
  id: string
  runId: string
  merchantId: string
  userId: string
  rating: AgentFeedbackRating
  reason?: AgentFeedbackReason
  comment?: string
  createdAt: string
  updatedAt: string
}

export type AgentRunEventName =
  | 'run.snapshot'
  | 'run.progress'
  | 'run.completed'
  | 'run.failed'
  | 'run.cancelled'
  | 'heartbeat'

export interface AgentRunEvent {
  event: AgentRunEventName
  data: AgentRunSummary | { at: string }
}

export type AiResultType = 'AGENT_RUN' | 'PRODUCT_OPTIMIZATION' | 'IMPORT_JOB'

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
  importJobId?: string
}

export interface PaginatedAiResults {
  items: AiResultItem[]
  page: number
  pageSize: number
  total: number
}
