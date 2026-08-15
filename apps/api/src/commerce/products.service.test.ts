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

const operator: AuthenticatedUser = {
  ...viewer,
  id: 'operator-1',
  email: 'operator@example.com',
  roles: ['operator'],
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

  it('applies an AI draft through ProductService with version and audit records', async () => {
    const now = new Date()
    const current = {
      id: 'product-1',
      merchantId: 'merchant-1',
      code: 'P-1',
      title: '原标题',
      description: '原描述',
      sellingPoints: [],
      language: 'zh-CN',
      status: 'ACTIVE',
      version: 1,
      skus: [],
      createdAt: now,
      updatedAt: now,
    }
    const updated = {
      ...current,
      title: 'Optimized title',
      description: 'Optimized description',
      sellingPoints: ['Point'],
      language: 'en-US',
      version: 2,
    }
    const transaction = {
      productOptimization: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'optimization-1',
          status: 'DRAFT',
          baseProductVersion: 1,
          draftData: {
            title: updated.title,
            description: updated.description,
            sellingPoints: updated.sellingPoints,
            complianceRisks: [],
            suggestions: [],
            language: updated.language,
            confidence: 0.9,
          },
          promptTokens: 10,
          completionTokens: 8,
          totalTokens: 18,
        }),
        update: vi.fn().mockResolvedValue(undefined),
      },
      product: {
        findFirst: vi.fn().mockResolvedValue(current),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(updated),
      },
      productVersion: { create: vi.fn().mockResolvedValue(undefined) },
      auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    }
    const prisma = {
      $transaction: vi.fn(
        (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    }
    const service = new ProductsService(
      prisma as unknown as PrismaService,
      {
        assertAccess: vi.fn().mockResolvedValue(undefined),
      } as unknown as MerchantAccessService,
    )

    const result = await service.applyOptimizationDraft(
      operator,
      'merchant-1',
      'product-1',
      'optimization-1',
    )

    expect(result.version).toBe(2)
    expect(transaction.productVersion.create).toHaveBeenCalledOnce()
    expect(transaction.productOptimization.update).toHaveBeenCalledWith({
      where: { id: 'optimization-1' },
      data: {
        status: 'APPLIED',
        appliedAt: expect.any(Date) as Date,
      },
    })
    expect(transaction.auditLog.create).toHaveBeenCalledOnce()
  })

  it('rejects a stale AI draft when the product version changed', async () => {
    const transaction = {
      productOptimization: {
        findFirst: vi.fn().mockResolvedValue({
          status: 'DRAFT',
          baseProductVersion: 1,
          draftData: {},
        }),
      },
      product: {
        findFirst: vi.fn().mockResolvedValue({ version: 2 }),
      },
    }
    const service = new ProductsService(
      {
        $transaction: vi.fn(
          (callback: (client: typeof transaction) => Promise<unknown>) =>
            callback(transaction),
        ),
      } as unknown as PrismaService,
      {
        assertAccess: vi.fn().mockResolvedValue(undefined),
      } as unknown as MerchantAccessService,
    )

    await expect(
      service.applyOptimizationDraft(
        operator,
        'merchant-1',
        'product-1',
        'optimization-1',
      ),
    ).rejects.toThrow('商品已被修改')
  })

  it('rejects a stale ordinary edit instead of silently overwriting it', async () => {
    const transaction = {
      product: {
        findFirst: vi.fn().mockResolvedValue({ version: 3, skus: [] }),
        updateMany: vi.fn(),
        findUniqueOrThrow: vi.fn(),
      },
      auditLog: { create: vi.fn() },
    }
    const service = new ProductsService(
      {
        $transaction: vi.fn(
          (callback: (client: typeof transaction) => Promise<unknown>) =>
            callback(transaction),
        ),
      } as unknown as PrismaService,
      {
        assertAccess: vi.fn().mockResolvedValue(undefined),
      } as unknown as MerchantAccessService,
    )

    await expect(
      service.update(operator, 'merchant-1', 'product-1', {
        title: '过期编辑',
        expectedVersion: 2,
      }),
    ).rejects.toThrow('商品已被修改')
    expect(transaction.product.updateMany).not.toHaveBeenCalled()
    expect(transaction.auditLog.create).not.toHaveBeenCalled()
  })
})
