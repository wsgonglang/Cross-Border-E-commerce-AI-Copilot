import type { AuthenticatedUser } from '@cross-border/shared'
import { describe, expect, it, vi } from 'vitest'

import { MerchantAccessService } from '../commerce/merchant-access.service'
import { PrismaService } from '../database/prisma.service'
import { AiSessionsService } from './ai-sessions.service'

const operator: AuthenticatedUser = {
  id: 'user-1',
  email: 'operator@example.com',
  name: '运营',
  roles: ['operator'],
  merchantIds: ['merchant-1'],
}

describe('AiSessionsService', () => {
  it('isolates session lists by merchant and current user', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const count = vi.fn().mockResolvedValue(0)
    const prisma = {
      aiSession: { findMany, count },
      $transaction: vi.fn((operations: Array<Promise<unknown>>) =>
        Promise.all(operations),
      ),
    }
    const merchantAccess = {
      assertAccess: vi.fn().mockResolvedValue(undefined),
    }
    const service = new AiSessionsService(
      prisma as unknown as PrismaService,
      merchantAccess as unknown as MerchantAccessService,
    )

    await service.list(operator, 'merchant-1', {
      page: 1,
      pageSize: 50,
    })

    const arguments_ = findMany.mock.calls[0]?.[0] as unknown as {
      where: { merchantId: string; userId: string }
    }
    expect(arguments_.where).toEqual({
      merchantId: 'merchant-1',
      userId: operator.id,
    })
    expect(merchantAccess.assertAccess).toHaveBeenCalledWith(
      operator,
      'merchant-1',
    )
  })

  it('rejects access to a session owned by another user', async () => {
    const prisma = {
      aiSession: { findFirst: vi.fn().mockResolvedValue(null) },
    }
    const merchantAccess = {
      assertAccess: vi.fn().mockResolvedValue(undefined),
    }
    const service = new AiSessionsService(
      prisma as unknown as PrismaService,
      merchantAccess as unknown as MerchantAccessService,
    )

    await expect(
      service.get(operator, 'merchant-1', 'other-session'),
    ).rejects.toThrow('会话不存在')
    expect(prisma.aiSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'other-session',
          merchantId: 'merchant-1',
          userId: operator.id,
        },
      }),
    )
  })
})
