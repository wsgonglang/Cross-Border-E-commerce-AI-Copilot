import type { Job } from 'bullmq'
import { describe, expect, it, vi } from 'vitest'

import { ProductOptimizationsService } from '../ai/product-optimizations.service'
import { PrismaService } from '../database/prisma.service'
import { BatchProcessorService } from './batch-processor.service'
import type { BatchOptimizationJobData } from './batch-queue.service'

function initialItem(status = 'PENDING') {
  return {
    id: 'item-1',
    taskId: 'task-1',
    productId: 'product-1',
    status,
    attempts: 0,
    startedAt: null,
    task: {
      id: 'task-1',
      merchantId: 'merchant-1',
      targetLanguage: 'en-US',
      cancelledAt: null,
    },
  }
}

function claimedItem() {
  return {
    id: 'item-1',
    taskId: 'task-1',
    productId: 'product-1',
    attempts: 1,
    task: {
      id: 'task-1',
      merchantId: 'merchant-1',
      targetLanguage: 'en-US',
      createdBy: {
        id: 'operator-1',
        email: 'operator@example.com',
        name: '运营',
        userRoles: [{ role: { code: 'operator' } }],
        merchantUsers: [{ merchantId: 'merchant-1' }],
      },
    },
  }
}

function job(attemptsMade = 0): Job<BatchOptimizationJobData> {
  return {
    data: { itemId: 'item-1' },
    opts: { attempts: 3 },
    attemptsMade,
  } as Job<BatchOptimizationJobData>
}

function service(prisma: object, optimize = vi.fn().mockResolvedValue({})) {
  return {
    processor: new BatchProcessorService(
      prisma as PrismaService,
      { createFromBatch: optimize } as unknown as ProductOptimizationsService,
    ),
    optimize,
  }
}

describe('BatchProcessorService', () => {
  it('ignores a duplicated delivery after an item is terminal', async () => {
    const optimize = vi.fn()
    const { processor } = service(
      {
        batchOptimizationItem: {
          findUnique: vi.fn().mockResolvedValue(initialItem('COMPLETED')),
        },
      },
      optimize,
    )

    await processor.process(job())

    expect(optimize).not.toHaveBeenCalled()
  })

  it('does not let a duplicate delivery claim an item that is still processing', async () => {
    const optimize = vi.fn()
    const updateMany = vi.fn().mockResolvedValue({ count: 0 })
    const { processor } = service(
      {
        batchOptimizationItem: {
          findUnique: vi.fn().mockResolvedValue(initialItem('PROCESSING')),
          updateMany,
        },
      },
      optimize,
    )

    await processor.process(job())

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'PENDING' }) as object,
      }),
    )
    expect(optimize).not.toHaveBeenCalled()
  })

  it('claims optimistically, creates one draft, and finalizes a completed task', async () => {
    const transaction = {
      batchOptimizationItem: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      batchOptimizationTask: {
        update: vi.fn().mockResolvedValue(undefined),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          totalItems: 1,
          completedItems: 1,
          failedItems: 0,
          cancelledItems: 0,
          cancelledAt: null,
        }),
      },
    }
    const prisma = {
      batchOptimizationItem: {
        findUnique: vi.fn().mockResolvedValue(initialItem()),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(claimedItem()),
      },
      batchOptimizationTask: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: vi.fn(
        (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    }
    const { processor, optimize } = service(prisma)

    await processor.process(job())

    const claim = prisma.batchOptimizationItem.updateMany.mock.calls[0]?.[0] as
      { where: { attempts: number } } | undefined
    const completion = transaction.batchOptimizationItem.updateMany.mock
      .calls[0]?.[0] as
      { where: { attempts: number }; data: { status: string } } | undefined
    const finalUpdate = transaction.batchOptimizationTask.update.mock.calls.at(
      -1,
    )?.[0] as { data: { status?: string } } | undefined
    expect(claim?.where.attempts).toBe(0)
    expect(optimize).toHaveBeenCalledOnce()
    expect(completion?.where.attempts).toBe(1)
    expect(completion?.data.status).toBe('COMPLETED')
    expect(finalUpdate?.data.status).toBe('COMPLETED')
  })

  it('returns a failed attempt to pending so BullMQ can retry it', async () => {
    const providerError = new Error('temporary provider failure')
    const transaction = {
      batchOptimizationItem: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      batchOptimizationTask: {
        update: vi.fn(),
        findUniqueOrThrow: vi.fn(),
      },
    }
    const prisma = {
      batchOptimizationItem: {
        findUnique: vi.fn().mockResolvedValue(initialItem()),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(claimedItem()),
      },
      batchOptimizationTask: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: vi.fn(
        (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    }
    const { processor } = service(
      prisma,
      vi.fn().mockRejectedValue(providerError),
    )

    await expect(processor.process(job(0))).rejects.toThrow(providerError)
    const retryUpdate = transaction.batchOptimizationItem.updateMany.mock
      .calls[0]?.[0] as { data: { status: string; error: string } } | undefined
    expect(retryUpdate?.data).toMatchObject({
      status: 'PENDING',
      error: 'temporary provider failure',
      startedAt: null,
    })
    expect(transaction.batchOptimizationTask.update).not.toHaveBeenCalled()
  })

  it('records the final failed attempt and completes the task as partial failure', async () => {
    const transaction = {
      batchOptimizationItem: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      batchOptimizationTask: {
        update: vi.fn().mockResolvedValue(undefined),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          totalItems: 1,
          completedItems: 0,
          failedItems: 1,
          cancelledItems: 0,
          cancelledAt: null,
        }),
      },
    }
    const prisma = {
      batchOptimizationItem: {
        findUnique: vi.fn().mockResolvedValue(initialItem()),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(claimedItem()),
      },
      batchOptimizationTask: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: vi.fn(
        (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    }
    const { processor } = service(
      prisma,
      vi.fn().mockRejectedValue(new Error('permanent failure')),
    )

    await expect(processor.process(job(2))).rejects.toThrow('permanent failure')
    const failedUpdate = transaction.batchOptimizationItem.updateMany.mock
      .calls[0]?.[0] as { data: { status: string } } | undefined
    const finalUpdate = transaction.batchOptimizationTask.update.mock.calls.at(
      -1,
    )?.[0] as { data: { status?: string } } | undefined
    expect(failedUpdate?.data.status).toBe('FAILED')
    expect(finalUpdate?.data.status).toBe('PARTIAL_FAILED')
  })
})
