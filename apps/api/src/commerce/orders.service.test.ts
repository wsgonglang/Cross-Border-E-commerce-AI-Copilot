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
function order(status = 'PENDING') {
  return {
    id: 'order-1',
    merchantId: 'merchant-1',
    storeId: 'store-1',
    orderNo: 'ORD-001',
    status,
    paymentStatus: status === 'PENDING' ? 'UNPAID' : 'PAID',
    fulfillmentStatus: status === 'PENDING' ? 'UNFULFILLED' : 'PROCESSING',
    customerName: 'Test',
    customerEmail: 'test@example.com',
    shippingAddress: null,
    trackingNumber: null,
    carrier: null,
    totalAmount: { toString: () => '29.99' },
    refundAmount: { toString: () => '0.00' },
    currency: 'USD',
    notes: null,
    version: 1,
    store: null,
    items: [],
    events: [],
    createdAt: new Date('2026-07-30T00:00:00.000Z'),
    updatedAt: new Date('2026-07-30T00:00:00.000Z'),
  }
}

function access() {
  return {
    assertAccess: vi.fn().mockResolvedValue(undefined),
  }
}

function transactionPrisma(record = order()) {
  const transaction = {
    order: {
      findFirst: vi.fn().mockResolvedValue(record),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi
        .fn()
        .mockResolvedValue({ ...record, status: 'CONFIRMED' }),
    },
    orderEvent: { create: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    orderBulkItem: { update: vi.fn().mockResolvedValue({}) },
  }
  return {
    transaction,
    prisma: {
      $transaction: vi.fn(
        (
          input:
            | Array<Promise<unknown>>
            | ((client: typeof transaction) => Promise<unknown>),
        ) =>
          typeof input === 'function' ? input(transaction) : Promise.all(input),
      ),
    },
  }
}

describe('OrdersService', () => {
  it('applies merchant isolation, combined filters and sorting', async () => {
    const orderFindMany = vi.fn().mockResolvedValue([])
    const orderCount = vi.fn().mockResolvedValue(0)
    const prisma = {
      order: { findMany: orderFindMany, count: orderCount },
      $transaction: vi.fn((operations: Array<Promise<unknown>>) =>
        Promise.all(operations),
      ),
    }
    const merchantAccess = access()
    const service = new OrdersService(
      prisma as unknown as PrismaService,
      merchantAccess as unknown as MerchantAccessService,
    )

    await service.list(viewer, 'merchant-1', {
      page: 2,
      pageSize: 10,
      keyword: 'Alice',
      statuses: ['PENDING', 'CONFIRMED'],
      paymentStatuses: ['PAID'],
      fulfillmentStatuses: ['PROCESSING'],
      storeId: 'store-1',
      minAmount: '10.00',
      maxAmount: '100.00',
      sortBy: 'totalAmount',
      sortOrder: 'asc',
    })

    const args = orderFindMany.mock.calls[0]?.[0] as unknown as {
      where: {
        merchantId: string
        storeId: string
        status: { in: string[] }
        paymentStatus: { in: string[] }
        OR: unknown[]
      }
      orderBy: Record<string, string>
      skip: number
      take: number
    }
    expect(merchantAccess.assertAccess).toHaveBeenCalledWith(
      viewer,
      'merchant-1',
    )
    expect(args.where).toMatchObject({
      merchantId: 'merchant-1',
      storeId: 'store-1',
      status: { in: ['PENDING', 'CONFIRMED'] },
      paymentStatus: { in: ['PAID'] },
    })
    expect(args.where.OR).toHaveLength(2)
    expect(args.orderBy).toEqual({ totalAmount: 'asc' })
    expect(args.skip).toBe(10)
    expect(args.take).toBe(10)
  })

  it('rejects an inverted amount range before querying', async () => {
    const service = new OrdersService(
      {} as PrismaService,
      access() as unknown as MerchantAccessService,
    )
    await expect(
      service.list(viewer, 'merchant-1', {
        page: 1,
        pageSize: 10,
        minAmount: '100.00',
        maxAmount: '10.00',
      }),
    ).rejects.toThrow('最小金额不能大于最大金额')
  })

  it('rejects status transition from PENDING to COMPLETED', async () => {
    const harness = transactionPrisma()
    const service = new OrdersService(
      harness.prisma as unknown as PrismaService,
      access() as unknown as MerchantAccessService,
    )
    await expect(
      service.updateStatus(operator, 'merchant-1', 'order-1', {
        status: 'COMPLETED',
      }),
    ).rejects.toThrow('订单状态不能从 PENDING 变更为 COMPLETED')
  })

  it('updates dimensions, timeline and audit in one transition', async () => {
    const harness = transactionPrisma()
    const service = new OrdersService(
      harness.prisma as unknown as PrismaService,
      access() as unknown as MerchantAccessService,
    )

    const result = await service.updateStatus(
      operator,
      'merchant-1',
      'order-1',
      { status: 'CONFIRMED' },
    )

    const updateInput = harness.transaction.order.updateMany.mock
      .calls[0]?.[0] as unknown as {
      where: { merchantId: string; version: number }
      data: {
        status: string
        paymentStatus: string
        fulfillmentStatus: string
      }
    }
    expect(updateInput.where).toMatchObject({
      merchantId: 'merchant-1',
      version: 1,
    })
    expect(updateInput.data).toMatchObject({
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      fulfillmentStatus: 'PROCESSING',
    })
    expect(harness.transaction.orderEvent.create).toHaveBeenCalledOnce()
    expect(harness.transaction.auditLog.create).toHaveBeenCalledOnce()
    expect(result.status).toBe('CONFIRMED')
  })

  it('prevents viewer from updating order status', async () => {
    const service = new OrdersService(
      {} as PrismaService,
      access() as unknown as MerchantAccessService,
    )
    await expect(
      service.updateStatus(viewer, 'merchant-1', 'order-1', {
        status: 'CONFIRMED',
      }),
    ).rejects.toThrow('无权修改订单状态')
  })

  it('keeps refund transitions restricted to administrators', async () => {
    const harness = transactionPrisma(order('COMPLETED'))
    const service = new OrdersService(
      harness.prisma as unknown as PrismaService,
      access() as unknown as MerchantAccessService,
    )
    await expect(
      service.updateStatus(operator, 'merchant-1', 'order-1', {
        status: 'REFUNDING',
      }),
    ).rejects.toThrow('仅管理员可执行此操作')
  })

  it('restores only the current user saved views in the merchant', async () => {
    const now = new Date()
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'view-1',
        merchantId: 'merchant-1',
        userId: 'op-1',
        name: '待发货',
        filters: {
          statuses: ['CONFIRMED'],
          fulfillmentStatuses: ['PROCESSING'],
        },
        sortBy: 'totalAmount',
        sortOrder: 'desc',
        columns: ['orderNo', 'amount', 'fulfillmentStatus'],
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      },
    ])
    const service = new OrdersService(
      {
        orderSavedView: { findMany },
      } as unknown as PrismaService,
      access() as unknown as MerchantAccessService,
    )

    const result = await service.listSavedViews(operator, 'merchant-1')

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { merchantId: 'merchant-1', userId: 'op-1' },
      }),
    )
    expect(result[0]).toMatchObject({
      name: '待发货',
      filters: {
        statuses: ['CONFIRMED'],
        fulfillmentStatuses: ['PROCESSING'],
      },
      sortBy: 'totalAmount',
      columns: ['orderNo', 'amount', 'fulfillmentStatus'],
      isDefault: true,
    })
  })

  it('returns per-order success and failure for a bulk action', async () => {
    const now = new Date('2026-07-30T00:00:00.000Z')
    const createdOperation = {
      id: 'bulk-1',
      action: 'CONFIRM',
      status: 'RUNNING',
      payloadHash: 'ignored',
      totalItems: 2,
      succeededItems: 0,
      failedItems: 1,
      createdAt: now,
      completedAt: null,
      items: [
        {
          id: 'bulk-item-1',
          requestedOrderId: 'order-1',
          orderId: 'order-1',
          status: 'PENDING',
          fromStatus: null,
          toStatus: null,
          error: null,
          createdAt: now,
          order: { orderNo: 'ORD-001' },
        },
        {
          id: 'bulk-item-2',
          requestedOrderId: 'missing-order',
          orderId: null,
          status: 'FAILED',
          fromStatus: null,
          toStatus: null,
          error: '订单不存在或不属于当前商家',
          createdAt: now,
          order: null,
        },
      ],
    }
    const finalItems = [
      {
        ...createdOperation.items[0],
        status: 'SUCCEEDED',
        fromStatus: 'PENDING',
        toStatus: 'CONFIRMED',
      },
      createdOperation.items[1],
    ]
    const transition = transactionPrisma()
    const prisma = {
      ...transition.prisma,
      order: { findMany: vi.fn().mockResolvedValue([{ id: 'order-1' }]) },
      orderBulkOperation: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation((args: unknown) => ({
          ...createdOperation,
          payloadHash: (args as { data: { payloadHash: string } }).data
            .payloadHash,
        })),
        update: vi.fn().mockResolvedValue({
          ...createdOperation,
          status: 'PARTIAL_FAILED',
          succeededItems: 1,
          failedItems: 1,
          completedAt: now,
          items: finalItems,
        }),
      },
      orderBulkItem: {
        findMany: vi.fn().mockResolvedValue(finalItems),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    const service = new OrdersService(
      prisma as unknown as PrismaService,
      access() as unknown as MerchantAccessService,
    )

    const result = await service.executeBulk(operator, 'merchant-1', {
      action: 'CONFIRM',
      orderIds: ['order-1', 'missing-order'],
      idempotencyKey: 'bulk-test-001',
    })

    expect(result).toMatchObject({
      status: 'PARTIAL_FAILED',
      succeededItems: 1,
      failedItems: 1,
    })
    expect(result.items[1]).toMatchObject({
      orderId: 'missing-order',
      status: 'FAILED',
    })
  })

  it('returns a completed bulk result for an identical idempotency key', async () => {
    const now = new Date()
    const existing = {
      id: 'bulk-1',
      action: 'CONFIRM',
      status: 'COMPLETED',
      payloadHash: '',
      totalItems: 1,
      succeededItems: 1,
      failedItems: 0,
      createdAt: now,
      completedAt: now,
      items: [],
    }
    const prisma = {
      orderBulkOperation: {
        findUnique: vi.fn().mockImplementation((args: unknown) => {
          const serviceHash = (
            args as { where: { merchantId_idempotencyKey: unknown } }
          ).where.merchantId_idempotencyKey
          expect(serviceHash).toBeDefined()
          return existing
        }),
      },
    }
    const service = new OrdersService(
      prisma as unknown as PrismaService,
      access() as unknown as MerchantAccessService,
    )
    // The payload hash guard is covered by the conflict path in integration;
    // set it using the same deterministic algorithm through the service input.
    const crypto = await import('node:crypto')
    existing.payloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ action: 'CONFIRM', orderIds: ['order-1'] }))
      .digest('hex')

    const result = await service.executeBulk(operator, 'merchant-1', {
      action: 'CONFIRM',
      orderIds: ['order-1'],
      idempotencyKey: 'bulk-test-001',
    })

    expect(result.id).toBe('bulk-1')
  })
})
