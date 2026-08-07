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
  },
): Promise<AgentRunStartResponse> {
  return apiRequest(token, `/api/merchants/${merchantId}/ai/agent/run`, {
    method: 'POST',
    body: JSON.stringify({ message, ...context }),
  })
}
