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
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${accessToken}`,
      ...init?.headers,
    },
  })
  if (!response.ok) {
    throw new Error(await getApiError(response))
  }
  return (await response.json()) as T
}
