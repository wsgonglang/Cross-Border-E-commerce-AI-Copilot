import type { AgentRunResponse } from '@cross-border/shared'

import { apiRequest } from './client'

export function runAgent(
  token: string,
  merchantId: string,
  message: string,
  storeId?: string,
): Promise<AgentRunResponse> {
  return apiRequest(token, `/api/merchants/${merchantId}/ai/agent/run`, {
    method: 'POST',
    body: JSON.stringify({ message, storeId }),
  })
}
