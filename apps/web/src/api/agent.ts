import type { AgentRunStartResponse } from '@cross-border/shared'

import { apiRequest } from './client'

export function runAgent(
  token: string,
  merchantId: string,
  message: string,
  context?: {
    storeId?: string
    days?: number
    sourcePage?: string
    sessionId?: string
    parentMessageId?: string
    regenerateMessageId?: string
  },
): Promise<AgentRunStartResponse> {
  return apiRequest(token, `/api/merchants/${merchantId}/ai/agent/run`, {
    method: 'POST',
    body: JSON.stringify({ message, ...context }),
  })
}

export function cancelAgentRun(
  token: string,
  merchantId: string,
  runId: string,
): Promise<{ cancelled: true }> {
  return apiRequest(
    token,
    `/api/merchants/${merchantId}/ai/agent/runs/${runId}/cancel`,
    { method: 'POST' },
  )
}
