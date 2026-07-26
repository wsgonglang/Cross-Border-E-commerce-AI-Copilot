import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { describe, expect, it, vi } from 'vitest'

import { RolesGuard } from './roles.guard'

function createContext(roles: string[]): ExecutionContext {
  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({
      getRequest: () => ({
        user: {
          roles,
        },
      }),
    }),
  } as unknown as ExecutionContext
}

describe('RolesGuard', () => {
  it('allows a user who owns one of the required roles', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['admin', 'operator']),
    } as unknown as Reflector
    const guard = new RolesGuard(reflector)

    expect(guard.canActivate(createContext(['operator']))).toBe(true)
  })

  it('rejects a viewer from an admin route', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['admin']),
    } as unknown as Reflector
    const guard = new RolesGuard(reflector)

    expect(() => guard.canActivate(createContext(['viewer']))).toThrow(
      ForbiddenException,
    )
  })
})
