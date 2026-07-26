import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common'
import type {
  ApiEnvironment,
  AuthenticatedUser,
  AuthSession,
} from '@cross-border/shared'
import type { Request, Response } from 'express'

import { API_ENVIRONMENT } from '../config/api-config.constants'
import { REFRESH_TOKEN_COOKIE } from './auth.constants'
import { AuthService } from './auth.service'
import type { IssuedSession, RequestMetadata } from './auth.types'
import { CurrentUser } from './decorators/current-user.decorator'
import { Public } from './decorators/public.decorator'
import { LoginDto } from './dto/login.dto'

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(API_ENVIRONMENT)
    private readonly environment: ApiEnvironment,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSession> {
    const issued = await this.authService.login(
      dto.email,
      dto.password,
      this.getRequestMetadata(request),
    )
    this.setRefreshCookie(response, issued)
    return issued.session
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSession> {
    const refreshToken = this.getRefreshToken(request)
    if (!refreshToken) {
      throw new UnauthorizedException('缺少刷新令牌')
    }

    const issued = await this.authService.refresh(refreshToken)
    this.setRefreshCookie(response, issued)
    return issued.session
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(this.getRefreshToken(request))
    response.clearCookie(REFRESH_TOKEN_COOKIE, this.cookieBaseOptions())
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user
  }

  private setRefreshCookie(response: Response, issued: IssuedSession): void {
    response.cookie(REFRESH_TOKEN_COOKIE, issued.refreshToken, {
      ...this.cookieBaseOptions(),
      expires: issued.refreshExpiresAt,
    })
  }

  private cookieBaseOptions() {
    return {
      httpOnly: true,
      sameSite: 'strict' as const,
      secure: this.environment.AUTH_COOKIE_SECURE,
      path: '/api/auth',
    }
  }

  private getRefreshToken(request: Request): string | undefined {
    const cookies = (request as Request & { cookies?: unknown }).cookies
    if (typeof cookies !== 'object' || cookies === null) {
      return undefined
    }

    const value = (cookies as Record<string, unknown>)[REFRESH_TOKEN_COOKIE]
    return typeof value === 'string' ? value : undefined
  }

  private getRequestMetadata(request: Request): RequestMetadata {
    const userAgent = request.headers['user-agent']
    return {
      ipAddress: request.ip,
      userAgent:
        typeof userAgent === 'string' ? userAgent.slice(0, 512) : undefined,
    }
  }
}
