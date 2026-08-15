export interface AiChatNavigationState {
  prefill?: string
  sessionId?: string
}

const MAX_PROMPT_LENGTH = 1000
const MAX_SESSION_ID_LENGTH = 191

function readTrimmedString(
  value: unknown,
  maximumLength: number,
): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  if (!normalized || normalized.length > maximumLength) return undefined
  return normalized
}

export function readAiChatNavigationState(
  value: unknown,
): AiChatNavigationState | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  const candidate = value as Record<string, unknown>
  const prefill = readTrimmedString(candidate.prefill, MAX_PROMPT_LENGTH)
  const sessionId = readTrimmedString(
    candidate.sessionId,
    MAX_SESSION_ID_LENGTH,
  )

  return prefill || sessionId ? { prefill, sessionId } : null
}
