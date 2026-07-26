export interface ApiHealth {
  status: 'ok'
  service: 'api'
  timestamp: string
}

function isApiHealth(value: unknown): value is ApiHealth {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Record<string, unknown>

  return (
    candidate.status === 'ok' &&
    candidate.service === 'api' &&
    typeof candidate.timestamp === 'string'
  )
}

export async function getApiHealth(signal: AbortSignal): Promise<ApiHealth> {
  const response = await fetch('/api/health', { signal })

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`)
  }

  const payload = (await response.json()) as unknown

  if (!isApiHealth(payload)) {
    throw new Error('Health check returned an invalid payload')
  }

  return payload
}
