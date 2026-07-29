import type {
  AgentRunSummary,
  AiResultType,
  PaginatedAiResults,
} from '@cross-border/shared'

import { apiRequest } from './client'

export function getAiResults(
  token: string,
  merchantId: string,
  query: {
    page: number
    pageSize: number
    type?: AiResultType
    status?: string
  },
): Promise<PaginatedAiResults> {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    type: query.type ?? 'ALL',
  })
  if (query.status) params.set('status', query.status)
  return apiRequest(
    token,
    `/api/merchants/${merchantId}/ai/results?${params.toString()}`,
  )
}

export function getAgentRun(
  token: string,
  merchantId: string,
  runId: string,
): Promise<AgentRunSummary> {
  return apiRequest(
    token,
    `/api/merchants/${merchantId}/ai/agent/runs/${runId}`,
  )
}
