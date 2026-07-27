import type { AuthenticatedUser } from '@cross-border/shared'
import { describe, expect, it, vi } from 'vitest'

import { PrismaService } from '../database/prisma.service'
import { DashboardService } from './dashboard.service'
import { MerchantAccessService } from './merchant-access.service'

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'user@example.com',
  name: '用户',
  roles: ['admin'],
  merchantIds: ['merchant-1'],
}

describe('DashboardService', () => {
  it('returns aggregated overview stats', async () => {
    const prisma = {
      order: {
        aggregate: vi.fn().mockResolvedValue({
          _count: { id: 5 },
          _sum: { totalAmount: 500 },
        }),
      },
      product: {
        count: vi.fn().mockResolvedValue(10),
      },
      sku: {
        count: vi.fn().mockResolvedValue(2),
      },
      $transaction: vi.fn((operations: Array<Promise<unknown>>) =>
        Promise.all(operations),
      ),
    }
    const merchantAccess = {
      assertAccess: vi.fn().mockResolvedValue(undefined),
    }
    const service = new DashboardService(
      prisma as unknown as PrismaService,
      merchantAccess as unknown as MerchantAccessService,
    )

    const result = await service.getOverview(user, 'merchant-1')

    expect(merchantAccess.assertAccess).toHaveBeenCalledWith(
      user,
      'merchant-1',
    )
    expect(result.todayOrders).toBe(5)
    expect(result.todaySales).toBe('500')
    expect(result.totalProducts).toBe(10)
    expect(result.lowStockItems).toBe(2)
  })

  it('returns trend data with zero-filled dates', async () => {
    const prisma = {
      order: {
        findMany: vi.fn().mockResolvedValue([
          {
            totalAmount: { toString: () => '100' },
            createdAt: new Date(),
          },
        ]),
      },
    }
    const merchantAccess = {
      assertAccess: vi.fn().mockResolvedValue(undefined),
    }
    const service = new DashboardService(
      prisma as unknown as PrismaService,
      merchantAccess as unknown as MerchantAccessService,
    )

    const result = await service.getTrend(user, 'merchant-1')

    expect(result.dates.length).toBe(14)
    expect(result.orders.length).toBe(14)
    expect(result.sales.length).toBe(14)
    // Today should have at least 1 order
    expect(result.orders[result.orders.length - 1]).toBeGreaterThanOrEqual(1)
  })

  it('returns sales data with calculated metrics', async () => {
    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)

    const prisma = {
      order: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            {
              totalAmount: { toString: () => '100' },
              createdAt: now,
            },
          ])
          .mockResolvedValueOnce([
            {
              totalAmount: { toString: () => '50' },
            },
          ]),
      },
      $transaction: vi.fn((operations: Array<Promise<unknown>>) =>
        Promise.all(operations),
      ),
    }
    const merchantAccess = {
      assertAccess: vi.fn().mockResolvedValue(undefined),
    }
    const service = new DashboardService(
      prisma as unknown as PrismaService,
      merchantAccess as unknown as MerchantAccessService,
    )

    const result = await service.getSalesData(user, 'merchant-1', 7)

    expect(result.summary).toBeDefined()
    expect(result.summary.todaySales).toBe('100.00')
    // Growth rate: (100-50)/50 * 100 = 100%
    expect(result.summary.growthRate).toBe(100)
    expect(result.trend.dates.length).toBe(7)
  })

  it('returns order analysis data with completion rate', async () => {
    const now = new Date()

    const prisma = {
      order: {
        findMany: vi.fn().mockResolvedValue([
          { status: 'COMPLETED', createdAt: now },
          { status: 'COMPLETED', createdAt: now },
          { status: 'PENDING', createdAt: now },
        ]),
        count: vi.fn().mockResolvedValueOnce(10).mockResolvedValueOnce(1),
      },
      $transaction: vi.fn((operations: Array<Promise<unknown>>) =>
        Promise.all(operations),
      ),
    }
    const merchantAccess = {
      assertAccess: vi.fn().mockResolvedValue(undefined),
    }
    const service = new DashboardService(
      prisma as unknown as PrismaService,
      merchantAccess as unknown as MerchantAccessService,
    )

    const result = await service.getOrderData(user, 'merchant-1', 7)

    expect(result.summary.todayOrders).toBe(3)
    expect(result.summary.completedOrders).toBe(10)
    expect(result.summary.refundedOrders).toBe(1)
    // Completion rate: 2/3 = 66.67%
    expect(result.summary.completionRate).toBeCloseTo(66.67, 1)
    expect(result.trend.dates.length).toBe(7)
  })
})
