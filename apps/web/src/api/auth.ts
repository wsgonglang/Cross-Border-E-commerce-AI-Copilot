import type { AuthenticatedUser, AuthSession } from '@cross-border/shared'

interface LoginInput {
  email: string
  password: string
}

function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.email === 'string' &&
    typeof candidate.name === 'string' &&
    Array.isArray(candidate.roles) &&
    candidate.roles.every((role) => typeof role === 'string') &&
    Array.isArray(candidate.merchantIds) &&
    candidate.merchantIds.every((merchantId) => typeof merchantId === 'string')
  )
}

function isAuthSession(value: unknown): value is AuthSession {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.accessToken === 'string' &&
    typeof candidate.expiresIn === 'number' &&
    isAuthenticatedUser(candidate.user)
  )
}

async function getErrorMessage(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as unknown
  if (typeof payload === 'object' && payload !== null) {
    const message = (payload as Record<string, unknown>).message
    if (typeof message === 'string') {
      return message
    }
    if (
      Array.isArray(message) &&
      message.every((item) => typeof item === 'string')
    ) {
      return message.join('；')
    }
  }
  return `请求失败（${response.status}）`
}

async function requestSession(
  path: string,
  init?: RequestInit,
): Promise<AuthSession> {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!response.ok) {
    throw new Error(await getErrorMessage(response))
  }

  const payload = (await response.json()) as unknown
  if (!isAuthSession(payload)) {
    throw new Error('认证服务返回了无效数据')
  }
  return payload
}

export function login(input: LoginInput): Promise<AuthSession> {
  return requestSession('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function refreshSession(): Promise<AuthSession> {
  return requestSession('/api/auth/refresh', {
    method: 'POST',
  })
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  })
}

export async function getUsers(
  accessToken: string,
): Promise<AuthenticatedUser[]> {
  const response = await fetch('/api/users', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(await getErrorMessage(response))
  }

  const payload = (await response.json()) as unknown
  if (!Array.isArray(payload) || !payload.every(isAuthenticatedUser)) {
    throw new Error('用户服务返回了无效数据')
  }
  return payload
}
