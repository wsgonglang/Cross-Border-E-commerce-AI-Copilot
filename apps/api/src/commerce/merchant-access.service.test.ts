import type { AuthenticatedUser } from '@cross-border/shared'
import { describe, expect, it, vi } from 'vitest'

import { PrismaService } from '../database/prisma.service'
import { MerchantAccessService } from './merchant-access.service'

const operator: AuthenticatedUser = {
  id: 'user-1',
  email: 'operator@example.com',
  name: '运营',
  roles: ['operator'],
  merchantIds: ['merchant-1'],
}

describe('MerchantAccessService', () => {
  it('rejects cross-merchant access before querying business data', async () => {
    const prisma = {
      merchant: { findFirst: vi.fn() },
    }
    const service = new MerchantAccessService(
      prisma as unknown as PrismaService,
    )

    await expect(service.assertAccess(operator, 'merchant-2')).rejects.toThrow(
      '当前账号无权访问该商家',
    )
    expect(prisma.merchant.findFirst).not.toHaveBeenCalled()
  })

  it('requires a non-admin merchant to remain active', async () => {
    const prisma = {
      merchant: { findFirst: vi.fn().mockResolvedValue({ id: 'merchant-1' }) },
    }
    const service = new MerchantAccessService(
      prisma as unknown as PrismaService,
    )

    await service.assertAccess(operator, 'merchant-1')

    expect(prisma.merchant.findFirst).toHaveBeenCalledWith({
      where: { id: 'merchant-1', status: 'ACTIVE' },
      select: { id: true },
    })
  })
})
