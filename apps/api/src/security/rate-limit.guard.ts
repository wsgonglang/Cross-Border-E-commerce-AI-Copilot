import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  type OnModuleDestroy,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { AuthenticatedUser } from '@cross-border/shared'
import type { Request, Response } from 'express'
import { createHash } from 'node:crypto'

import { RATE_LIMIT_KEY, type RateLimitPolicy } from './rate-limit.decorator'

interface Bucket {
  count: number
  resetAt: number
}

@Injectable()
export class RateLimitGuard implements CanActivate, OnModuleDestroy {
  private readonly buckets = new Map<string, Bucket>()
  private readonly cleanupTimer: NodeJS.Timeout

  constructor(private readonly reflector: Reflector) {
    this.cleanupTimer = setInterval(() => this.cleanup(), 60_000)
    this.cleanupTimer.unref?.()
  }

  canActivate(context: ExecutionContext): boolean {
    const policy = this.reflector.getAllAndOverride<RateLimitPolicy>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    )
    if (!policy) return true

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>()
    const response = context.switchToHttp().getResponse<Response>()
    const now = Date.now()
    const key = `${context.getClass().name}:${context.getHandler().name}:${this.identity(request, policy)}`
    const current = this.buckets.get(key)
    const bucket =
      !current || current.resetAt <= now
        ? { count: 0, resetAt: now + policy.windowMs }
        : current
    bucket.count += 1
    this.buckets.set(key, bucket)
    if (bucket.count <= policy.limit) return true

    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    response.setHeader('Retry-After', String(retryAfter))
    throw new HttpException(
      { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后重试' },
      HttpStatus.TOO_MANY_REQUESTS,
    )
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupTimer)
  }

  private identity(
    request: Request & { user?: AuthenticatedUser },
    policy: RateLimitPolicy,
  ): string {
    if (policy.identity === 'user' && request.user?.id) return request.user.id
    const ip = request.ip || request.socket.remoteAddress || 'unknown'
    if (policy.identity !== 'ip-email') return ip
    const email =
      typeof (request.body as { email?: unknown } | undefined)?.email ===
      'string'
        ? String((request.body as { email: string }).email)
            .trim()
            .toLowerCase()
        : 'unknown'
    return createHash('sha256').update(`${ip}:${email}`).digest('hex')
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key)
    }
  }
}
