import type {
  AuthenticatedUser,
  ProductOptimizationDraft,
} from '@cross-border/shared'
import { describe, expect, it, vi } from 'vitest'

import { MerchantAccessService } from '../commerce/merchant-access.service'
import { ProductsService } from '../commerce/products.service'
import { PrismaService } from '../database/prisma.service'
import type { AiProvider } from './ai-provider.service'
import { ProductOptimizationsService } from './product-optimizations.service'

const operator: AuthenticatedUser = {
  id: 'operator-1',
  email: 'operator@example.com',
  name: '运营',
  roles: ['operator'],
  merchantIds: ['merchant-1'],
}

const draft: ProductOptimizationDraft = {
  title: 'Portable Travel Charger',
  description: 'A compact charger for international travel.',
  sellingPoints: ['Compact', 'Multiple ports'],
  complianceRisks: ['Verify electrical certification'],
  suggestions: ['Add dimensions'],
  language: 'en-US',
  confidence: 0.9,
}

function record(overrides: Record<string, unknown> = {}) {
  const now = new Date()
  return {
    id: 'optimization-1',
    merchantId: 'merchant-1',
    productId: 'product-1',
    requestedById: operator.id,
    status: 'DRAFT',
    targetLanguage: 'en-US',
    baseProductVersion: 1,
    sourceData: {
      title: '旅行充电器',
      description: '商品描述',
      sellingPoints: ['便携'],
      language: 'zh-CN',
      version: 1,
    },
    draftData: draft,
    providerName: 'test',
    modelName: 'test-model',
    promptTokens: 12,
    completionTokens: 8,
    totalTokens: 20,
    error: null,
    appliedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('ProductOptimizationsService', () => {
  it('persists a validated structured draft and usage audit', async () => {
    const pending = record({
      status: 'GENERATING',
      draftData: null,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    })
    const completed = record()
    const transaction = {
      productOptimization: {
        update: vi.fn().mockResolvedValue(completed),
      },
      auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    }
    const prisma = {
      product: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'product-1',
          title: '旅行充电器',
          description: '商品描述',
          sellingPoints: ['便携'],
          language: 'zh-CN',
          version: 1,
        }),
      },
      productOptimization: {
        create: vi.fn().mockResolvedValue(pending),
        update: vi.fn(),
      },
      $transaction: vi.fn(
        (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    }
    const merchantAccess = {
      assertAccess: vi.fn().mockResolvedValue(undefined),
    }
    const provider: AiProvider = {
      name: 'test',
      model: 'test-model',
      chat: vi.fn(),
      generateTitle: vi.fn(),
      optimizeProduct: vi.fn().mockResolvedValue({
        draft,
        usage: { promptTokens: 12, completionTokens: 8, totalTokens: 20 },
      }),
      runAgentStep: vi.fn(),
    }
    const service = new ProductOptimizationsService(
      prisma as unknown as PrismaService,
      merchantAccess as unknown as MerchantAccessService,
      {} as ProductsService,
      provider,
    )

    const result = await service.create(operator, 'merchant-1', 'product-1', {
      targetLanguage: 'en-US',
    })

    expect(result.status).toBe('DRAFT')
    expect(result.draft?.title).toBe(draft.title)
    expect(result.usage.totalTokens).toBe(20)
    expect(transaction.auditLog.create).toHaveBeenCalledOnce()
  })

  it('records a provider failure without exposing its raw error', async () => {
    const prisma = {
      product: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'product-1',
          title: '旅行充电器',
          description: '商品描述',
          sellingPoints: [],
          language: 'zh-CN',
          version: 1,
        }),
      },
      productOptimization: {
        create: vi.fn().mockResolvedValue(record({ status: 'GENERATING' })),
        update: vi.fn().mockResolvedValue(undefined),
      },
    }
    const provider: AiProvider = {
      name: 'test',
      model: 'test-model',
      chat: vi.fn(),
      generateTitle: vi.fn(),
      optimizeProduct: vi.fn().mockRejectedValue(new Error('provider secret')),
      runAgentStep: vi.fn(),
    }
    const service = new ProductOptimizationsService(
      prisma as unknown as PrismaService,
      {
        assertAccess: vi.fn().mockResolvedValue(undefined),
      } as unknown as MerchantAccessService,
      {} as ProductsService,
      provider,
    )

    await expect(
      service.create(operator, 'merchant-1', 'product-1', {
        targetLanguage: 'en-US',
      }),
    ).rejects.toThrow('AI 商品优化失败')
    expect(prisma.productOptimization.update).toHaveBeenCalledWith({
      where: { id: 'optimization-1' },
      data: {
        status: 'ERROR',
        error: 'AI 服务暂时不可用',
        errorCode: 'INTERNAL_ERROR',
      },
    })
  })

  it('returns the existing batch draft without calling the provider again', async () => {
    const existing = record({ batchItemId: 'batch-item-1' })
    const optimizeProduct = vi.fn()
    const provider: AiProvider = {
      name: 'test',
      model: 'test-model',
      chat: vi.fn(),
      generateTitle: vi.fn(),
      optimizeProduct,
      runAgentStep: vi.fn(),
    }
    const prisma = {
      product: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'product-1',
          title: '旅行充电器',
          description: '商品描述',
          sellingPoints: ['便携'],
          language: 'zh-CN',
          version: 1,
        }),
      },
      productOptimization: {
        findUnique: vi.fn().mockResolvedValue(existing),
        create: vi.fn(),
        update: vi.fn(),
      },
    }
    const service = new ProductOptimizationsService(
      prisma as unknown as PrismaService,
      {
        assertAccess: vi.fn().mockResolvedValue(undefined),
      } as unknown as MerchantAccessService,
      {} as ProductsService,
      provider,
    )

    const result = await service.createFromBatch(
      operator,
      'merchant-1',
      'product-1',
      'en-US',
      'batch-item-1',
    )

    expect(result.id).toBe('optimization-1')
    expect(optimizeProduct).not.toHaveBeenCalled()
    expect(prisma.productOptimization.create).not.toHaveBeenCalled()
  })
})
