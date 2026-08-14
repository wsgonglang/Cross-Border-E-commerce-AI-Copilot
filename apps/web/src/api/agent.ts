import type {
  AgentRunEventName,
  AgentFeedbackRating,
  AgentFeedbackReason,
  AgentRunFeedbackSummary,
  AgentRunStartResponse,
  AgentRunSummary,
} from '@cross-border/shared'

import { apiRequest, getApiError } from './client'

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

export function submitAgentFeedback(
  token: string,
  merchantId: string,
  runId: string,
  input: {
    rating: AgentFeedbackRating
    reason?: AgentFeedbackReason
    comment?: string
  },
): Promise<AgentRunFeedbackSummary> {
  return apiRequest(
    token,
    `/api/merchants/${merchantId}/ai/agent/runs/${runId}/feedback`,
    { method: 'POST', body: JSON.stringify(input) },
  )
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

export async function streamAgentRunEvents(
  token: string,
  merchantId: string,
  runId: string,
  signal: AbortSignal,
  onEvent: (event: AgentRunEventName, run: AgentRunSummary) => void,
): Promise<AgentRunSummary | undefined> {
  const response = await fetch(
    `/api/merchants/${merchantId}/ai/agent/runs/${runId}/events`,
    {
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
      signal,
    },
  )
  if (!response.ok) throw new Error(await getApiError(response))
  if (!response.body) throw new Error('当前浏览器不支持 Agent 事件流')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let latest: AgentRunSummary | undefined
  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    const frames = buffer.split(/\r?\n\r?\n/)
    buffer = frames.pop() ?? ''
    for (const frame of frames) {
      const lines = frame.split(/\r?\n/)
      const event = lines
        .find((line) => line.startsWith('event:'))
        ?.slice('event:'.length)
        .trim() as AgentRunEventName | undefined
      const data = lines
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice('data:'.length).trimStart())
        .join('\n')
      if (!event || event === 'heartbeat' || !data) continue
      latest = JSON.parse(data) as AgentRunSummary
      onEvent(event, latest)
    }
    if (done) break
  }
  return latest
}
