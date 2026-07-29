import type {
  AiMessage,
  AiMessageLink,
  AiMessageLinkType,
  AiShareCandidate,
  AiSharedSession,
  AiSessionDetail,
  AiSessionShareSummary,
  AiSessionSummary,
} from '@cross-border/shared'
import { apiRequest, getApiError } from './client'

export function listAiSessions(
  token: string,
  merchantId: string,
  params?: { keyword?: string; archived?: boolean; groupId?: string },
): Promise<{ items: AiSessionSummary[]; total: number }> {
  const query = new URLSearchParams()
  if (params?.keyword) query.set('keyword', params.keyword)
  if (params?.archived) query.set('archived', 'true')
  if (params?.groupId) query.set('groupId', params.groupId)
  const suffix = query.size ? `?${query}` : ''
  return apiRequest(token, `/api/merchants/${merchantId}/ai/sessions${suffix}`)
}

export function getAiSession(
  token: string,
  merchantId: string,
  sessionId: string,
): Promise<AiSessionDetail> {
  return apiRequest(
    token,
    `/api/merchants/${merchantId}/ai/sessions/${sessionId}`,
  )
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
  data: { title?: string; pinned?: boolean; groupId?: string },
): Promise<AiSessionSummary> {
  return apiRequest(
    token,
    `/api/merchants/${merchantId}/ai/sessions/${sessionId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    },
  )
}

export function setAiSessionArchived(
  token: string,
  merchantId: string,
  sessionId: string,
  archived: boolean,
): Promise<AiSessionSummary> {
  return apiRequest(
    token,
    `/api/merchants/${merchantId}/ai/sessions/${sessionId}/${
      archived ? 'archive' : 'restore'
    }`,
    { method: 'POST' },
  )
}

export function favoriteAiMessage(
  token: string,
  merchantId: string,
  sessionId: string,
  messageId: string,
  favorited: boolean,
): Promise<AiMessage> {
  return apiRequest(
    token,
    `/api/merchants/${merchantId}/ai/sessions/${sessionId}/messages/${messageId}/favorite`,
    {
      method: 'PATCH',
      body: JSON.stringify({ favorited }),
    },
  )
}

export function linkAiMessage(
  token: string,
  merchantId: string,
  sessionId: string,
  messageId: string,
  input: {
    entityType: AiMessageLinkType
    entityReference: string
  },
): Promise<AiMessageLink> {
  return apiRequest(
    token,
    `/api/merchants/${merchantId}/ai/sessions/${sessionId}/messages/${messageId}/links`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export async function downloadAiSession(
  token: string,
  merchantId: string,
  sessionId: string,
  format: 'markdown' | 'json',
): Promise<void> {
  const response = await fetch(
    `/api/merchants/${merchantId}/ai/sessions/${sessionId}/export?format=${format}`,
    { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' },
  )
  if (!response.ok) throw new Error(await getApiError(response))
  const disposition = response.headers.get('content-disposition') ?? ''
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/)?.[1]
  const filename = encodedName
    ? decodeURIComponent(encodedName)
    : `ai-session.${format === 'markdown' ? 'md' : 'json'}`
  const url = URL.createObjectURL(await response.blob())
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function getAiShareCandidates(
  token: string,
  merchantId: string,
): Promise<AiShareCandidate[]> {
  return apiRequest(token, `/api/merchants/${merchantId}/ai/share-candidates`)
}

export function listAiSessionShares(
  token: string,
  merchantId: string,
  sessionId: string,
): Promise<AiSessionShareSummary[]> {
  return apiRequest(
    token,
    `/api/merchants/${merchantId}/ai/sessions/${sessionId}/shares`,
  )
}

export function createAiSessionShare(
  token: string,
  merchantId: string,
  sessionId: string,
  recipientUserIds: string[],
  expiresInHours: number,
): Promise<AiSessionShareSummary> {
  return apiRequest(
    token,
    `/api/merchants/${merchantId}/ai/sessions/${sessionId}/shares`,
    {
      method: 'POST',
      body: JSON.stringify({ recipientUserIds, expiresInHours }),
    },
  )
}

export function revokeAiSessionShare(
  token: string,
  merchantId: string,
  shareId: string,
): Promise<AiSessionShareSummary> {
  return apiRequest(
    token,
    `/api/merchants/${merchantId}/ai/session-shares/${shareId}`,
    { method: 'DELETE' },
  )
}

export function getSharedAiSession(
  token: string,
  merchantId: string,
  shareId: string,
): Promise<AiSharedSession> {
  return apiRequest(
    token,
    `/api/merchants/${merchantId}/ai/session-shares/${shareId}`,
  )
}

export function deleteAiSession(
  token: string,
  merchantId: string,
  sessionId: string,
): Promise<void> {
  return apiRequest(
    token,
    `/api/merchants/${merchantId}/ai/sessions/${sessionId}`,
    {
      method: 'DELETE',
    },
  )
}
