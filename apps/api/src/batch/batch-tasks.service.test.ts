import type { AuthenticatedUser } from '@cross-border/shared'
import { describe, expect, it, vi } from 'vitest'

import { MerchantAccessService } from '../commerce/merchant-access.service'
import { PrismaService } from '../database/prisma.service'
import { BatchQueueService } from './batch-queue.service'
import { BatchTasksService } from './batch-tasks.service'

const operator: AuthenticatedUser = {
  id: 'operator-1',
  email: 'operator@example.com',
  name: '运营',
  roles: ['operator'],
  merchantIds: ['merchant-1'],
}

function taskRecord(overrides: Record<string, unknown> = {}) {
  const now = new Date()
  return {
    id: 'task-1',
    merchantId: 'merchant-1',
    createdById: operator.id,
    idempotencyKey: 'batch-request-001',
    targetLanguage: 'en-US',
    status: 'PENDING',
    totalItems: 2,
    completedItems: 0,
    failedItems: 0,
    cancelledItems: 0,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    createdAt: now,
    updatedAt: now,
    items: [
      {
        id: 'item-1',
        productId: 'product-1',
        status: 'PENDING',
        attempts: 0,
        error: null,
        startedAt: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
        product: { code: 'P-1', title: '商品一' },
        optimization: null,
      },
      {
        id: 'item-2',
        productId: 'product-2',
        status: 'PENDING',
        attempts: 0,
        error: null,
        startedAt: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
        product: { code: 'P-2', title: '商品二' },
        optimization: null,
      },
    ],
    ...overrides,
  }
}

function dependencies(prisma: object, queue: object) {
  return new BatchTasksService(
    prisma as PrismaService,
    {
      assertAccess: vi.fn().mockResolvedValue(undefined),
    } as unknown as MerchantAccessService,
    queue as BatchQueueService,
  )
}

describe('BatchTasksService', () => {
  it('persists a task and audit before enqueueing one job per item', async () => {
    const created = taskRecord()
    const transaction = {
      batchOptimizationTask: {
        create: vi.fn().mockResolvedValue(created),
      },
      auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    }
    const prisma = {
      batchOptimizationTask: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      product: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: 'product-1' }, { id: 'product-2' }]),
      },
      $transaction: vi.fn(
        (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    }
    const queue = { enqueue: vi.fn().mockResolvedValue(undefined) }
    const service = dependencies(prisma, queue)

    const result = await service.create(operator, 'merchant-1', {
      productIds: ['product-1', 'product-2'],
      targetLanguage: 'en-US',
      idempotencyKey: 'batch-request-001',
    })

    expect(result.id).toBe('task-1')
    expect(transaction.auditLog.create).toHaveBeenCalledOnce()
    const enqueued = queue.enqueue.mock.calls[0]?.[0] as
      Array<{ id: string; status: string }> | undefined
    expect(enqueued?.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: 'item-1', status: 'PENDING' },
      { id: 'item-2', status: 'PENDING' },
    ])
  })

  it('returns the same task for the same idempotency key and rejects changed parameters', async () => {
    const existing = taskRecord()
    const prisma = {
      batchOptimizationTask: {
        findUnique: vi.fn().mockResolvedValue(existing),
      },
    }
    const queue = { enqueue: vi.fn().mockResolvedValue(undefined) }
    const service = dependencies(prisma, queue)
    const input = {
      productIds: ['product-2', 'product-1'],
      targetLanguage: 'en-US' as const,
      idempotencyKey: 'batch-request-001',
    }

    await expect(
      service.create(operator, 'merchant-1', input),
    ).resolves.toMatchObject({ id: 'task-1' })
    await expect(
      service.create(operator, 'merchant-1', {
        ...input,
        targetLanguage: 'es-ES',
      }),
    ).rejects.toThrow('幂等键已用于不同的批量任务参数')
    expect(queue.enqueue).toHaveBeenCalledOnce()
  })

  it('cancels only pending items and keeps MySQL as the final task state', async () => {
    const current = taskRecord()
    const cancelled = taskRecord({
      status: 'CANCELLED',
      cancelledItems: 2,
      cancelledAt: new Date(),
      items: current.items.map((item) => ({
        ...item,
        status: 'CANCELLED',
        error: '任务已由用户取消',
      })),
    })
    const transaction = {
      batchOptimizationItem: {
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      batchOptimizationTask: {
        update: vi.fn().mockResolvedValue(undefined),
      },
      auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    }
    const prisma = {
      batchOptimizationTask: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(current)
          .mockResolvedValueOnce(cancelled),
      },
      $transaction: vi.fn(
        (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    }
    const queue = {
      enqueue: vi.fn(),
      cancelWaiting: vi.fn().mockRejectedValue(new Error('Redis unavailable')),
    }
    const service = dependencies(prisma, queue)

    const result = await service.cancel(operator, 'merchant-1', 'task-1')

    expect(result.status).toBe('CANCELLED')
    expect(result.cancelledItems).toBe(2)
    expect(queue.cancelWaiting).toHaveBeenCalledWith(['item-1', 'item-2'])
    expect(transaction.auditLog.create).toHaveBeenCalledOnce()
  })

  it('rejects missing, archived, or cross-merchant products before creating a task', async () => {
    const prisma = {
      batchOptimizationTask: { findUnique: vi.fn().mockResolvedValue(null) },
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'product-1' }]) },
    }
    const service = dependencies(prisma, { enqueue: vi.fn() })

    await expect(
      service.create(operator, 'merchant-1', {
        productIds: ['product-1', 'product-from-other-merchant'],
        targetLanguage: 'en-US',
        idempotencyKey: 'batch-request-002',
      }),
    ).rejects.toThrow('存在无效、跨商家或已归档商品')
  })
})
