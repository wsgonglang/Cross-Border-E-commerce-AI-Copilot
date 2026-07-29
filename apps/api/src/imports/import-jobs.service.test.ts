import type {
  AuthenticatedUser,
  ImportMapping,
  ImportPreviewRow,
} from '@cross-border/shared'
import { ConflictException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'

import { MerchantAccessService } from '../commerce/merchant-access.service'
import { PrismaService } from '../database/prisma.service'
import { ImportFileService } from './import-file.service'
import { ImportJobsService } from './import-jobs.service'
import { ImportQueueService } from './import-queue.service'

const operator: AuthenticatedUser = {
  id: 'user-1',
  email: 'operator@example.com',
  name: '运营',
  roles: ['operator'],
  merchantIds: ['merchant-1'],
}

const mapping = {
  productCode: 'product_code',
  title: 'title',
  description: 'description',
  language: 'language',
  skuCode: 'sku_code',
  skuName: 'sku_name',
  price: 'price',
  currency: 'currency',
  stock: 'stock',
} satisfies ImportMapping

const validRow: ImportPreviewRow = {
  rowNumber: 2,
  source: { product_code: 'P-NEW-1' },
  normalized: {
    productCode: 'P-NEW-1',
    title: 'New Product',
    description: 'Description',
    language: 'en-US',
    skuCode: 'SKU-NEW-1',
    skuName: 'Default',
    price: '19.99',
    currency: 'USD',
    stock: 3,
  },
  valid: true,
  errors: [],
  warnings: [],
}

function uploaded(): Express.Multer.File {
  const buffer = Buffer.from('csv')
  return {
    fieldname: 'file',
    originalname: 'products.csv',
    encoding: '7bit',
    mimetype: 'text/csv',
    size: buffer.length,
    buffer,
    destination: '',
    filename: 'products.csv',
    path: '',
    stream: undefined as never,
  }
}

function service(prisma: object, rows: ImportPreviewRow[] = [validRow]) {
  const files = {
    mappedRows: vi.fn().mockResolvedValue(rows),
    hash: vi.fn().mockReturnValue('a'.repeat(64)),
  }
  const queue = { enqueue: vi.fn().mockResolvedValue(undefined) }
  return {
    instance: new ImportJobsService(
      prisma as PrismaService,
      {
        assertAccess: vi.fn().mockResolvedValue(undefined),
      } as unknown as MerchantAccessService,
      files as unknown as ImportFileService,
      queue as unknown as ImportQueueService,
    ),
    files,
    queue,
  }
}

describe('ImportJobsService', () => {
  it('previews with merchant-scoped risk queries and performs no import writes', async () => {
    const prisma = {
      product: { findMany: vi.fn().mockResolvedValue([]) },
      sku: { findMany: vi.fn().mockResolvedValue([]) },
      importJob: { create: vi.fn() },
    }
    const harness = service(prisma)

    const result = await harness.instance.preview(
      operator,
      'merchant-1',
      uploaded(),
      'CSV',
      1,
      mapping,
    )

    expect(result.validRows).toBe(1)
    const productQuery = prisma.product.findMany.mock.calls[0]?.[0] as {
      where: { merchantId: string }
    }
    const skuQuery = prisma.sku.findMany.mock.calls[0]?.[0] as {
      where: { merchantId: string }
    }
    expect(productQuery.where.merchantId).toBe('merchant-1')
    expect(skuQuery.where.merchantId).toBe('merchant-1')
    expect(prisma.importJob.create).not.toHaveBeenCalled()
  })

  it('marks a formal product as invalid while preserving other valid rows', async () => {
    const second = {
      ...validRow,
      rowNumber: 3,
      normalized: {
        ...validRow.normalized!,
        productCode: 'P-NEW-2',
        skuCode: 'SKU-NEW-2',
      },
    }
    const prisma = {
      product: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: 'product-1', code: 'P-NEW-1', status: 'ACTIVE' },
          ]),
      },
      sku: { findMany: vi.fn().mockResolvedValue([]) },
    }
    const harness = service(prisma, [validRow, second])

    const result = await harness.instance.preview(
      operator,
      'merchant-1',
      uploaded(),
      'CSV',
      1,
      mapping,
    )

    expect(result).toMatchObject({ validRows: 1, invalidRows: 1 })
    expect(result.rows[0]?.errors[0]).toContain('正式商品')
    expect(result.rows[1]?.valid).toBe(true)
  })

  it('returns the existing job for the same idempotency key and parameters', async () => {
    const existing = {
      id: 'job-1',
      fileName: 'products.csv',
      fileHash: 'a'.repeat(64),
      mode: 'DRAFT_ONLY',
      targetLanguage: null,
      status: 'PENDING',
      totalItems: 1,
      validItems: 1,
      invalidItems: 0,
      completedItems: 0,
      failedItems: 0,
      cancelledItems: 0,
      worksheet: 'CSV',
      headerRow: 1,
      mapping: Object.fromEntries(Object.entries(mapping).reverse()),
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
      items: [
        {
          id: 'item-1',
          rowNumber: 2,
          status: 'PENDING',
          normalizedData: validRow.normalized,
          productId: null,
          warnings: [],
          error: null,
          attempts: 0,
          optimization: null,
        },
      ],
    }
    const prisma = {
      product: { findMany: vi.fn().mockResolvedValue([]) },
      sku: { findMany: vi.fn().mockResolvedValue([]) },
      importJob: { findUnique: vi.fn().mockResolvedValue(existing) },
    }
    const harness = service(prisma)

    const result = await harness.instance.create(
      operator,
      'merchant-1',
      uploaded(),
      {
        worksheet: 'CSV',
        headerRow: 1,
        mapping,
        mode: 'DRAFT_ONLY',
        idempotencyKey: 'same-key-123',
      },
    )

    expect(result.id).toBe('job-1')
    expect(harness.queue.enqueue).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'item-1' }),
    ])
  })

  it('rejects reuse of an idempotency key with another file', async () => {
    const prisma = {
      product: { findMany: vi.fn().mockResolvedValue([]) },
      sku: { findMany: vi.fn().mockResolvedValue([]) },
      importJob: {
        findUnique: vi.fn().mockResolvedValue({
          fileHash: 'different',
          mode: 'DRAFT_ONLY',
          targetLanguage: null,
          mapping,
          items: [],
        }),
      },
    }
    const harness = service(prisma)

    await expect(
      harness.instance.create(operator, 'merchant-1', uploaded(), {
        worksheet: 'CSV',
        headerRow: 1,
        mapping,
        mode: 'DRAFT_ONLY',
        idempotencyKey: 'same-key-123',
      }),
    ).rejects.toBeInstanceOf(ConflictException)
  })
})
