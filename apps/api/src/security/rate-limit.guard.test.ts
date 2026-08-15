import { HttpException } from '@nestjs/common'
import type { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { describe, expect, it, vi } from 'vitest'

import { RateLimitGuard } from './rate-limit.guard'

describe('RateLimitGuard', () => {
  it('rejects requests above the endpoint policy and emits Retry-After', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue({
        limit: 1,
        windowMs: 60_000,
        identity: 'ip',
      }),
    } as unknown as Reflector
    const setHeader = vi.fn()
    const context = {
      getClass: () => ({ name: 'AuthController' }),
      getHandler: () => ({ name: 'login' }),
      switchToHttp: () => ({
        getRequest: () => ({ ip: '127.0.0.1', socket: {}, body: {} }),
        getResponse: () => ({ setHeader }),
      }),
    } as unknown as ExecutionContext
    const guard = new RateLimitGuard(reflector)

    expect(guard.canActivate(context)).toBe(true)
    expect(() => guard.canActivate(context)).toThrow(HttpException)
    expect(setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String))
    guard.onModuleDestroy()
  })
})
