import type { AuthenticatedUser } from '@cross-border/shared'
import { describe, expect, it, vi } from 'vitest'

import { PrismaService } from '../database/prisma.service'
import { DashboardService } from './dashboard.service'
import { MerchantAccessService } from './merchant-access.service'
import { StoresService } from './stores.service'

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
      {} as StoresService,
    )

    const result = await service.getOverview(user, 'merchant-1', 'store-1')

    expect(merchantAccess.assertAccess).toHaveBeenCalledWith(user, 'merchant-1')
    const orderQuery = prisma.order.aggregate.mock.calls[0]?.[0] as unknown as {
      where: { storeId: string }
    }
    const productQuery = prisma.product.count.mock.calls[0]?.[0] as unknown as {
      where: { listings: { some: { storeId: string } } }
    }
    expect(orderQuery.where.storeId).toBe('store-1')
    expect(productQuery.where.listings.some.storeId).toBe('store-1')
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
      {} as StoresService,
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
      {} as StoresService,
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
      {} as StoresService,
    )

    const result = await service.getOrderData(user, 'merchant-1', 7)

    expect(result.summary.todayOrders).toBe(3)
    expect(result.summary.completedOrders).toBe(10)
    expect(result.summary.refundedOrders).toBe(1)
    // Completion rate: 2/3 = 66.67%
    expect(result.summary.completionRate).toBeCloseTo(66.67, 1)
    expect(result.trend.dates.length).toBe(7)
  })

  it('returns a store-scoped operational dashboard with reproducible comparisons and todos', async () => {
    const now = new Date()
    const currentOrders = [
      {
        status: 'COMPLETED',
        totalAmount: { toString: () => '100.00' },
        createdAt: now,
        items: [
          {
            productName: 'Travel charger',
            quantity: 2,
            subtotal: { toString: () => '100.00' },
          },
        ],
      },
      {
        status: 'REFUNDED',
        totalAmount: { toString: () => '50.00' },
        createdAt: now,
        items: [
          {
            productName: 'Travel charger',
            quantity: 1,
            subtotal: { toString: () => '50.00' },
          },
        ],
      },
    ]
    const previousOrders = [
      {
        status: 'COMPLETED',
        totalAmount: { toString: () => '50.00' },
      },
    ]
    const prisma = {
      merchant: { findFirst: vi.fn() },
      order: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce(currentOrders)
          .mockResolvedValueOnce(previousOrders),
        count: vi.fn().mockResolvedValue(3),
      },
      sku: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'sku-1',
            code: 'SKU-001',
            name: 'Black',
            stock: 2,
            product: {
              id: 'product-1',
              code: 'P-001',
              title: 'Travel charger',
            },
          },
        ]),
        count: vi.fn().mockResolvedValue(1),
      },
      productOptimization: {
        count: vi.fn().mockResolvedValue(2),
        findMany: vi.fn().mockResolvedValue([]),
      },
      batchOptimizationTask: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([]),
      },
      agentRun: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
    }
    const merchantAccess = {
      assertAccess: vi.fn().mockResolvedValue(undefined),
    }
    const storesService = {
      assertStore: vi.fn().mockResolvedValue({
        id: 'store-1',
        currency: 'USD',
      }),
    }
    const service = new DashboardService(
      prisma as unknown as PrismaService,
      merchantAccess as unknown as MerchantAccessService,
      storesService as unknown as StoresService,
    )

    const result = await service.getOperations(user, 'merchant-1', 7, 'store-1')

    expect(storesService.assertStore).toHaveBeenCalledWith(
      user,
      'merchant-1',
      'store-1',
    )
    expect(result.metrics.sales).toEqual({
      value: '100.00',
      previousValue: '50.00',
      changeRate: 100,
    })
    expect(result.metrics.orders.value).toBe(2)
    expect(result.metrics.averageOrderValue.value).toBe('100.00')
    expect(result.metrics.refunds).toMatchObject({
      value: 1,
      previousValue: 0,
      changeRate: null,
    })
    expect(result.todos).toEqual({
      pendingDrafts: 2,
      failedTasks: 1,
      actionableOrders: 3,
      lowStockItems: 1,
    })
    expect(result.topProducts[0]).toMatchObject({
      productName: 'Travel charger',
      quantity: 2,
      sales: '100.00',
    })
    const currentOrderQuery = prisma.order.findMany.mock.calls[0]?.[0] as {
      where: { merchantId: string; storeId: string }
    }
    expect(currentOrderQuery.where).toMatchObject({
      merchantId: 'merchant-1',
      storeId: 'store-1',
    })
  })
})
