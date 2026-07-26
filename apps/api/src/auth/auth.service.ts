import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type {
  ApiEnvironment,
  AuthenticatedUser,
  AuthSession,
} from '@cross-border/shared'
import { compare } from 'bcryptjs'
import { createHash, randomBytes, randomUUID } from 'node:crypto'

import { API_ENVIRONMENT } from '../config/api-config.constants'
import type {
  AccessTokenPayload,
  AuthUserRecord,
  IssuedSession,
  RequestMetadata,
} from './auth.types'
import { LoginLogsRepository } from './repositories/login-logs.repository'
import { RefreshTokensRepository } from './repositories/refresh-tokens.repository'
import { UsersRepository } from './repositories/users.repository'

const INVALID_CREDENTIALS_MESSAGE = '邮箱或密码错误'

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly refreshTokensRepository: RefreshTokensRepository,
    private readonly loginLogsRepository: LoginLogsRepository,
    private readonly jwtService: JwtService,
    @Inject(API_ENVIRONMENT)
    private readonly environment: ApiEnvironment,
  ) {}

  async login(
    email: string,
    password: string,
    metadata: RequestMetadata,
  ): Promise<IssuedSession> {
    const normalizedEmail = email.trim().toLowerCase()
    const user = await this.usersRepository.findByEmail(normalizedEmail)
    const passwordMatches = user
      ? await compare(password, user.passwordHash)
      : false

    if (!user || !passwordMatches || user.status !== 'ACTIVE') {
      await this.loginLogsRepository.record(
        user?.id ?? null,
        normalizedEmail,
        false,
        metadata,
      )
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE)
    }

    await this.loginLogsRepository.record(
      user.id,
      normalizedEmail,
      true,
      metadata,
    )

    return this.createSession(user)
  }

  async refresh(refreshToken: string): Promise<IssuedSession> {
    const nextRefreshToken = this.createOpaqueToken()
    const refreshExpiresAt = this.getRefreshExpiry()
    const user = await this.refreshTokensRepository.rotate({
      currentTokenHash: this.hashToken(refreshToken),
      nextTokenHash: this.hashToken(nextRefreshToken),
      nextExpiresAt: refreshExpiresAt,
    })

    if (!user) {
      throw new UnauthorizedException('登录状态已失效，请重新登录')
    }

    return {
      session: await this.createAccessSession(user),
      refreshToken: nextRefreshToken,
      refreshExpiresAt,
    }
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) {
      return
    }
    await this.refreshTokensRepository.revoke(this.hashToken(refreshToken))
  }

  async validateAccessToken(token: string): Promise<AuthenticatedUser> {
    let payload: AccessTokenPayload

    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token)
    } catch {
      throw new UnauthorizedException('访问令牌无效或已过期')
    }

    const user = await this.usersRepository.findById(payload.sub)

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('用户不存在或已停用')
    }

    return this.toAuthenticatedUser(user)
  }

  private async createSession(user: AuthUserRecord): Promise<IssuedSession> {
    const refreshToken = this.createOpaqueToken()
    const refreshExpiresAt = this.getRefreshExpiry()

    await this.refreshTokensRepository.create({
      userId: user.id,
      familyId: randomUUID(),
      tokenHash: this.hashToken(refreshToken),
      expiresAt: refreshExpiresAt,
    })

    return {
      session: await this.createAccessSession(user),
      refreshToken,
      refreshExpiresAt,
    }
  }

  private async createAccessSession(
    user: AuthUserRecord,
  ): Promise<AuthSession> {
    const authenticatedUser = this.toAuthenticatedUser(user)
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
    }

    return {
      accessToken: await this.jwtService.signAsync(payload),
      expiresIn: this.environment.JWT_ACCESS_TTL_SECONDS,
      user: authenticatedUser,
    }
  }

  private toAuthenticatedUser(user: AuthUserRecord): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles,
    }
  }

  private createOpaqueToken(): string {
    return randomBytes(48).toString('base64url')
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  private getRefreshExpiry(): Date {
    const expiresAt = new Date()
    expiresAt.setUTCDate(
      expiresAt.getUTCDate() + this.environment.REFRESH_TOKEN_TTL_DAYS,
    )
    return expiresAt
  }
}
