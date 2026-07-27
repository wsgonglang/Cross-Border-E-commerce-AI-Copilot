import type { AuthenticatedUser } from '@cross-border/shared'
import { describe, expect, it, vi } from 'vitest'

import { PrismaService } from '../database/prisma.service'
import { MerchantAccessService } from './merchant-access.service'
import { OrdersService } from './orders.service'

const viewer: AuthenticatedUser = {
  id: 'viewer-1',
  email: 'viewer@example.com',
  name: '访客',
  roles: ['viewer'],
  merchantIds: ['merchant-1'],
}

const operator: AuthenticatedUser = {
  id: 'op-1',
  email: 'op@example.com',
  name: '运营',
  roles: ['operator'],
  merchantIds: ['merchant-1'],
}

const admin: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: '管理员',
  roles: ['admin'],
  merchantIds: ['merchant-1'],
}

describe('OrdersService', () => {
  it('always applies merchant isolation to order pagination', async () => {
    const orderFindMany = vi.fn().mockResolvedValue([])
    const orderCount = vi.fn().mockResolvedValue(0)
    const prisma = {
      order: {
        findMany: orderFindMany,
        count: orderCount,
      },
      $transaction: vi.fn((operations: Array<Promise<unknown>>) =>
        Promise.all(operations),
      ),
    }
    const merchantAccess = {
      assertAccess: vi.fn().mockResolvedValue(undefined),
    }
    const service = new OrdersService(
      prisma as unknown as PrismaService,
      merchantAccess as unknown as MerchantAccessService,
    )

    const result = await service.list(viewer, 'merchant-1', {
      page: 2,
      pageSize: 10,
      keyword: 'ORD-001',
      status: 'PENDING',
    })

    expect(merchantAccess.assertAccess).toHaveBeenCalledWith(
      viewer,
      'merchant-1',
    )
    const findArgs = orderFindMany.mock.calls[0]?.[0] as unknown as {
      where: { merchantId: string }
      skip: number
      take: number
    }
    expect(findArgs.where.merchantId).toBe('merchant-1')
    expect(findArgs.skip).toBe(10)
    expect(findArgs.take).toBe(10)
    expect(result).toEqual({
      items: [],
      total: 0,
      page: 2,
      pageSize: 10,
    })
  })

  it('rejects status transition from PENDING to COMPLETED', async () => {
    const prisma = {
      order: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'order-1',
          merchantId: 'merchant-1',
          status: 'PENDING',
        }),
      },
      $transaction: vi.fn((operations: Array<Promise<unknown>>) =>
        Promise.all(operations),
      ),
    }
    const merchantAccess = {
      assertAccess: vi.fn().mockResolvedValue(undefined),
    }
    const service = new OrdersService(
      prisma as unknown as PrismaService,
      merchantAccess as unknown as MerchantAccessService,
    )

    await expect(
      service.updateStatus(operator, 'merchant-1', 'order-1', {
        status: 'COMPLETED',
      }),
    ).rejects.toThrow('订单状态不能从 PENDING 变更为 COMPLETED')
  })

  it('allows operator to confirm a PENDING order', async () => {
    const orderFindFirst = vi.fn().mockResolvedValue({
      id: 'order-1',
      merchantId: 'merchant-1',
      orderNo: 'ORD-001',
      status: 'PENDING',
      customerName: 'Test',
      customerEmail: null,
      totalAmount: { toString: () => '29.99' },
      currency: 'USD',
      notes: null,
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const orderUpdate = vi.fn().mockResolvedValue({
      id: 'order-1',
      merchantId: 'merchant-1',
      orderNo: 'ORD-001',
      status: 'CONFIRMED',
      customerName: 'Test',
      customerEmail: null,
      totalAmount: { toString: () => '29.99' },
      currency: 'USD',
      notes: null,
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const prisma = {
      order: {
        findFirst: orderFindFirst,
        update: orderUpdate,
      },
    }
    const merchantAccess = {
      assertAccess: vi.fn().mockResolvedValue(undefined),
    }
    const service = new OrdersService(
      prisma as unknown as PrismaService,
      merchantAccess as unknown as MerchantAccessService,
    )

    const result = await service.updateStatus(
      operator,
      'merchant-1',
      'order-1',
      { status: 'CONFIRMED' },
    )

    expect(result.status).toBe('CONFIRMED')
  })

  it('allows admin to cancel a PENDING order', async () => {
    const orderFindFirst = vi.fn().mockResolvedValue({
      id: 'order-3',
      merchantId: 'merchant-1',
      orderNo: 'ORD-003',
      status: 'PENDING',
      customerName: 'Test',
      customerEmail: null,
      totalAmount: { toString: () => '29.99' },
      currency: 'USD',
      notes: null,
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const orderUpdate = vi.fn().mockResolvedValue({
      id: 'order-3',
      merchantId: 'merchant-1',
      orderNo: 'ORD-003',
      status: 'CANCELLED',
      customerName: 'Test',
      customerEmail: null,
      totalAmount: { toString: () => '29.99' },
      currency: 'USD',
      notes: null,
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const prisma = {
      order: {
        findFirst: orderFindFirst,
        update: orderUpdate,
      },
    }
    const merchantAccess = {
      assertAccess: vi.fn().mockResolvedValue(undefined),
    }
    const service = new OrdersService(
      prisma as unknown as PrismaService,
      merchantAccess as unknown as MerchantAccessService,
    )

    const result = await service.updateStatus(admin, 'merchant-1', 'order-3', {
      status: 'CANCELLED',
    })

    expect(result.status).toBe('CANCELLED')
  })

  it('prevents viewer from updating order status', async () => {
    const merchantAccess = {
      assertAccess: vi.fn().mockResolvedValue(undefined),
    }
    const service = new OrdersService(
      {} as unknown as PrismaService,
      merchantAccess as unknown as MerchantAccessService,
    )

    await expect(
      service.updateStatus(viewer, 'merchant-1', 'order-1', {
        status: 'CONFIRMED',
      }),
    ).rejects.toThrow('无权修改订单状态')
  })
})
