import type { NormalizedImportRow } from '@cross-border/shared'
import type { Job } from 'bullmq'
import { describe, expect, it, vi } from 'vitest'

import { ProductOptimizationsService } from '../ai/product-optimizations.service'
import { ProductsService } from '../commerce/products.service'
import { SkusService } from '../commerce/skus.service'
import { PrismaService } from '../database/prisma.service'
import { ImportProcessorService } from './import-processor.service'
import type { StructuredImportJobData } from './import-queue.service'

const normalized: NormalizedImportRow = {
  productCode: 'P-IMPORT-1',
  title: 'Imported Product',
  description: 'Description',
  language: 'en-US',
  skuCode: 'SKU-IMPORT-1',
  skuName: 'Default',
  price: '19.99',
  currency: 'USD',
  stock: 3,
}

function queueJob(attemptsMade = 0, attempts = 3) {
  return {
    data: { itemId: 'item-1' },
    attemptsMade,
    opts: { attempts },
  } as Job<StructuredImportJobData>
}

function item() {
  return {
    id: 'item-1',
    jobId: 'job-1',
    status: 'PENDING',
    attempts: 0,
    startedAt: null,
    normalizedData: normalized,
    job: {
      id: 'job-1',
      merchantId: 'merchant-1',
      mode: 'DRAFT_AND_AI',
      targetLanguage: 'en-US',
      cancelledAt: null,
      createdBy: {
        id: 'user-1',
        email: 'operator@example.com',
        name: '运营',
        userRoles: [{ role: { code: 'operator' } }],
        merchantUsers: [{ merchantId: 'merchant-1' }],
      },
    },
  }
}

describe('ImportProcessorService', () => {
  it('does not let a duplicate delivery claim an item that is still processing', async () => {
    const record = { ...item(), status: 'PROCESSING' }
    const updateMany = vi.fn().mockResolvedValue({ count: 0 })
    const products = { upsertImportedDraft: vi.fn() }
    const service = new ImportProcessorService(
      {
        importItem: {
          findUnique: vi.fn().mockResolvedValue(record),
          updateMany,
        },
      } as unknown as PrismaService,
      products as unknown as ProductsService,
      {} as SkusService,
      {} as ProductOptimizationsService,
    )

    await service.process(queueJob())

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'PENDING' }) as object,
      }),
    )
    expect(products.upsertImportedDraft).not.toHaveBeenCalled()
  })

  it('imports through product/SKU services and creates an idempotent AI draft', async () => {
    const record = item()
    const claimedRecord = { ...record, attempts: 1 }
    const transaction = {
      importItem: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      importJob: {
        update: vi.fn().mockResolvedValue({}),
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
      importItem: {
        findUnique: vi.fn().mockResolvedValue(record),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(claimedRecord),
      },
      importJob: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      $transaction: vi.fn(
        (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    }
    const products = {
      upsertImportedDraft: vi.fn().mockResolvedValue({ id: 'product-1' }),
    }
    const skus = { upsertImported: vi.fn().mockResolvedValue({}) }
    const optimizations = {
      createFromImport: vi.fn().mockResolvedValue({ id: 'optimization-1' }),
    }
    const service = new ImportProcessorService(
      prisma as unknown as PrismaService,
      products as unknown as ProductsService,
      skus as unknown as SkusService,
      optimizations as unknown as ProductOptimizationsService,
    )

    await service.process(queueJob())

    expect(products.upsertImportedDraft).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      'merchant-1',
      expect.objectContaining({ code: 'P-IMPORT-1' }),
    )
    expect(skus.upsertImported).toHaveBeenCalledWith(
      expect.anything(),
      'merchant-1',
      'product-1',
      expect.objectContaining({ code: 'SKU-IMPORT-1' }),
    )
    expect(optimizations.createFromImport).toHaveBeenCalledWith(
      expect.anything(),
      'merchant-1',
      'product-1',
      'en-US',
      'item-1',
    )
  })

  it('marks the item failed only after the final BullMQ attempt', async () => {
    const record = item()
    const claimedRecord = { ...record, attempts: 1 }
    const transaction = {
      importItem: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      importJob: {
        update: vi.fn().mockResolvedValue({}),
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
      importItem: {
        findUnique: vi.fn().mockResolvedValue(record),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(claimedRecord),
      },
      importJob: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      $transaction: vi.fn(
        (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    }
    const service = new ImportProcessorService(
      prisma as unknown as PrismaService,
      {
        upsertImportedDraft: vi
          .fn()
          .mockRejectedValue(new Error('product failed')),
      } as unknown as ProductsService,
      {} as SkusService,
      {} as ProductOptimizationsService,
    )

    await expect(service.process(queueJob(0, 1))).rejects.toThrow(
      'product failed',
    )
    const failedCall = transaction.importItem.updateMany.mock.calls[0]?.[0] as
      { where?: { attempts?: number }; data?: { status?: string } } | undefined
    expect(failedCall?.data?.status).toBe('FAILED')
    expect(failedCall?.where?.attempts).toBe(1)
  })
})
