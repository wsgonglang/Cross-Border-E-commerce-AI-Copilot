import type { AuthenticatedUser } from '@cross-border/shared'
import { describe, expect, it, vi } from 'vitest'

import { PrismaService } from '../database/prisma.service'
import { MerchantAccessService } from './merchant-access.service'
import { SkusService } from './skus.service'

const operator: AuthenticatedUser = {
  id: 'operator-1',
  email: 'operator@example.com',
  name: '运营',
  roles: ['operator'],
  merchantIds: ['merchant-1'],
}

describe('SkusService', () => {
  it('rejects an adjustment that would make stock negative', async () => {
    const transaction = {
      sku: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'sku-1',
          merchantId: 'merchant-1',
          productId: 'product-1',
          code: 'SKU-1',
          name: '黑色',
          price: { toString: () => '10.00' },
          currency: 'USD',
          stock: 2,
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        updateMany: vi.fn(),
      },
      auditLog: { create: vi.fn() },
    }
    const prisma = {
      $transaction: vi.fn(
        (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    }
    const merchantAccess = {
      assertAccess: vi.fn().mockResolvedValue(undefined),
    }
    const service = new SkusService(
      prisma as unknown as PrismaService,
      merchantAccess as unknown as MerchantAccessService,
    )

    await expect(
      service.adjustStock(operator, 'merchant-1', 'sku-1', {
        delta: -3,
        reason: '测试扣减',
      }),
    ).rejects.toThrow('库存不足')
    expect(transaction.sku.updateMany).not.toHaveBeenCalled()
    expect(transaction.auditLog.create).not.toHaveBeenCalled()
  })
})
