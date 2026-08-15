interface ApiAuthRecovery {
  refreshAccessToken: () => Promise<string>
  onSessionExpired: () => void
}

let authRecovery: ApiAuthRecovery | null = null
let refreshPromise: Promise<string> | null = null

export function configureApiAuthRecovery(
  recovery: ApiAuthRecovery | null,
): void {
  authRecovery = recovery
  refreshPromise = null
}

async function recoverAccessToken(): Promise<string> {
  if (!authRecovery) {
    throw new Error('登录状态已过期，请重新登录')
  }

  refreshPromise ??= authRecovery.refreshAccessToken().finally(() => {
    refreshPromise = null
  })

  try {
    return await refreshPromise
  } catch (error: unknown) {
    authRecovery.onSessionExpired()
    throw error
  }
}

export async function getApiError(response: Response): Promise<string> {
  const requestId = response.headers.get('x-request-id')
  const withRequestId = (message: string) =>
    requestId ? `${message}（请求 ID：${requestId}）` : message
  const payload = (await response.json().catch(() => null)) as unknown
  if (typeof payload === 'object' && payload !== null) {
    const message = (payload as Record<string, unknown>).message
    if (typeof message === 'string') {
      return withRequestId(message)
    }
    if (
      Array.isArray(message) &&
      message.every((item) => typeof item === 'string')
    ) {
      return withRequestId(message.join('；'))
    }
  }
  return withRequestId(`请求失败（${response.status}）`)
}

export async function apiRequest<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const request = (token: string) =>
    fetch(path, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
        ...init?.headers,
      },
    })

  let response = await request(accessToken)
  if (response.status === 401 && authRecovery) {
    const recoveredToken = await recoverAccessToken()
    response = await request(recoveredToken)
    if (response.status === 401) {
      authRecovery.onSessionExpired()
    }
  }
  if (!response.ok) {
    throw new Error(await getApiError(response))
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
