import type { AuthenticatedUser } from '@cross-border/shared'
import { describe, expect, it, vi } from 'vitest'

import { PrismaService } from '../database/prisma.service'
import { MerchantAccessService } from './merchant-access.service'
import { ProductsService } from './products.service'

const viewer: AuthenticatedUser = {
  id: 'viewer-1',
  email: 'viewer@example.com',
  name: '访客',
  roles: ['viewer'],
  merchantIds: ['merchant-1'],
}

describe('ProductsService', () => {
  it('always applies merchant isolation to product pagination', async () => {
    const productFindMany = vi.fn().mockResolvedValue([])
    const productCount = vi.fn().mockResolvedValue(0)
    const prisma = {
      product: {
        findMany: productFindMany,
        count: productCount,
      },
      $transaction: vi.fn((operations: Array<Promise<unknown>>) =>
        Promise.all(operations),
      ),
    }
    const merchantAccess = {
      assertAccess: vi.fn().mockResolvedValue(undefined),
    }
    const service = new ProductsService(
      prisma as unknown as PrismaService,
      merchantAccess as unknown as MerchantAccessService,
    )

    const result = await service.list(viewer, 'merchant-1', {
      page: 2,
      pageSize: 10,
      keyword: 'CHARGER',
    })

    expect(merchantAccess.assertAccess).toHaveBeenCalledWith(
      viewer,
      'merchant-1',
    )
    const findArguments = productFindMany.mock.calls[0]?.[0] as unknown as {
      where: { merchantId: string }
      skip: number
      take: number
    }
    const countArguments = productCount.mock.calls[0]?.[0] as unknown as {
      where: { merchantId: string }
    }
    expect(findArguments.where.merchantId).toBe('merchant-1')
    expect(findArguments.skip).toBe(10)
    expect(findArguments.take).toBe(10)
    expect(countArguments.where.merchantId).toBe('merchant-1')
    expect(result).toEqual({
      items: [],
      total: 0,
      page: 2,
      pageSize: 10,
    })
  })
})
