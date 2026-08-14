import { JwtService } from '@nestjs/jwt'
import type { ApiEnvironment } from '@cross-border/shared'
import { hash } from 'bcryptjs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthService } from './auth.service'
import type { AuthUserRecord } from './auth.types'
import { LoginLogsRepository } from './repositories/login-logs.repository'
import { RefreshTokensRepository } from './repositories/refresh-tokens.repository'
import { UsersRepository } from './repositories/users.repository'

const environment: ApiEnvironment = {
  NODE_ENV: 'test',
  API_PORT: 3000,
  WEB_ORIGIN: 'http://localhost:5173',
  DATABASE_URL:
    'mysql://copilot:copilot_dev@127.0.0.1:3307/cross_border_copilot',
  JWT_ACCESS_SECRET: 'test-secret-with-at-least-32-characters',
  JWT_ACCESS_TTL_SECONDS: 900,
  REFRESH_TOKEN_TTL_DAYS: 7,
  AUTH_COOKIE_SECURE: false,
  REDIS_URL: 'redis://127.0.0.1:6379',
  OPENAI_API_KEY: '',
  OPENAI_BASE_URL: 'https://api.siliconflow.cn/v1',
  AI_MODEL: 'Qwen/Qwen2.5-7B-Instruct',
  AI_TIMEOUT_MS: 30_000,
}

describe('AuthService', () => {
  const usersRepository = {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
  }
  const refreshTokensRepository = {
    create: vi.fn(),
    rotate: vi.fn(),
    revoke: vi.fn(),
  }
  const loginLogsRepository = {
    record: vi.fn(),
  }

  let service: AuthService
  let activeUser: AuthUserRecord

  beforeEach(async () => {
    vi.clearAllMocks()
    activeUser = {
      id: 'user-1',
      email: 'operator@copilot.local',
      name: '商品运营',
      passwordHash: await hash('Demo123!', 4),
      status: 'ACTIVE',
      roles: ['operator'],
      merchantIds: ['merchant-1'],
    }
    service = new AuthService(
      usersRepository as unknown as UsersRepository,
      refreshTokensRepository as unknown as RefreshTokensRepository,
      loginLogsRepository as unknown as LoginLogsRepository,
      new JwtService({
        secret: environment.JWT_ACCESS_SECRET,
        signOptions: { expiresIn: environment.JWT_ACCESS_TTL_SECONDS },
      }),
      environment,
    )
  })

  it('issues an access token and persists only a refresh token hash', async () => {
    usersRepository.findByEmail.mockResolvedValue(activeUser)
    refreshTokensRepository.create.mockResolvedValue(undefined)
    loginLogsRepository.record.mockResolvedValue(undefined)

    const issued = await service.login('Operator@copilot.local', 'Demo123!', {})

    expect(issued.session.user.roles).toEqual(['operator'])
    expect(issued.session.accessToken).toBeTypeOf('string')
    expect(issued.refreshToken).toBeTypeOf('string')
    expect(refreshTokensRepository.create).toHaveBeenCalledOnce()
    const persistedToken = refreshTokensRepository.create.mock.calls[0]?.[0] as
      { userId: string; tokenHash: string } | undefined
    expect(persistedToken?.userId).toBe(activeUser.id)
    expect(persistedToken?.tokenHash).toMatch(/^[a-f0-9]{64}$/)
    expect(persistedToken?.tokenHash).not.toBe(issued.refreshToken)
  })

  it('returns the same generic error for an invalid password', async () => {
    usersRepository.findByEmail.mockResolvedValue(activeUser)
    loginLogsRepository.record.mockResolvedValue(undefined)

    await expect(
      service.login('operator@copilot.local', 'WrongPassword!', {}),
    ).rejects.toThrow('邮箱或密码错误')
    expect(loginLogsRepository.record).toHaveBeenCalledWith(
      activeUser.id,
      activeUser.email,
      false,
      {},
    )
  })

  it('reloads the current user while validating an access token', async () => {
    usersRepository.findByEmail.mockResolvedValue(activeUser)
    usersRepository.findById.mockResolvedValue(activeUser)
    refreshTokensRepository.create.mockResolvedValue(undefined)
    loginLogsRepository.record.mockResolvedValue(undefined)

    const issued = await service.login(activeUser.email, 'Demo123!', {})
    const user = await service.validateAccessToken(issued.session.accessToken)

    expect(usersRepository.findById).toHaveBeenCalledWith(activeUser.id)
    expect(user.email).toBe(activeUser.email)
  })
})
