import type { AiSessionDetail, AiSessionSummary } from '@cross-border/shared'
import { apiRequest } from './client'

export function listAiSessions(
  token: string,
  merchantId: string,
): Promise<{ items: AiSessionSummary[]; total: number }> {
  return apiRequest(token, `/api/merchants/${merchantId}/ai/sessions`)
}

export function getAiSession(
  token: string,
  merchantId: string,
  sessionId: string,
): Promise<AiSessionDetail> {
  return apiRequest(token, `/api/merchants/${merchantId}/ai/sessions/${sessionId}`)
}

export function createAiSession(
  token: string,
  merchantId: string,
  title: string,
): Promise<AiSessionSummary> {
  return apiRequest(token, `/api/merchants/${merchantId}/ai/sessions`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  })
}

export function updateAiSession(
  token: string,
  merchantId: string,
  sessionId: string,
  data: { title?: string; pinned?: boolean },
): Promise<AiSessionSummary> {
  return apiRequest(token, `/api/merchants/${merchantId}/ai/sessions/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteAiSession(
  token: string,
  merchantId: string,
  sessionId: string,
): Promise<void> {
  return apiRequest(token, `/api/merchants/${merchantId}/ai/sessions/${sessionId}`, {
    method: 'DELETE',
  })
}
