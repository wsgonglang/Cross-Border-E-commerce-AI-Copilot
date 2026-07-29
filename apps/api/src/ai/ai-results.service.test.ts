import type { AuthenticatedUser } from '@cross-border/shared'
import { describe, expect, it, vi } from 'vitest'

import type { MerchantAccessService } from '../commerce/merchant-access.service'
import type { PrismaService } from '../database/prisma.service'
import { AiResultsService } from './ai-results.service'

const operator: AuthenticatedUser = {
  id: 'operator-1',
  email: 'operator@example.com',
  name: 'Operator',
  roles: ['operator'],
  merchantIds: ['merchant-1'],
}

describe('AiResultsService', () => {
  it('combines agent runs and optimization drafts with exact business links', async () => {
    const assertAccess = vi.fn().mockResolvedValue(undefined)
    const prisma = {
      agentRun: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'run-1',
            message: '分析库存',
            answer: '库存充足',
            error: null,
            status: 'COMPLETED',
            createdAt: new Date('2026-07-29T09:00:00.000Z'),
            updatedAt: new Date('2026-07-29T09:01:00.000Z'),
          },
        ]),
      },
      productOptimization: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'optimization-1',
            status: 'DRAFT',
            targetLanguage: 'en-US',
            error: null,
            createdAt: new Date('2026-07-29T08:00:00.000Z'),
            updatedAt: new Date('2026-07-29T08:01:00.000Z'),
            product: {
              id: 'product-1',
              code: 'P-001',
              title: '旅行充电器',
            },
            batchItem: { taskId: 'batch-1' },
          },
        ]),
      },
    }
    const service = new AiResultsService(
      prisma as unknown as PrismaService,
      { assertAccess } as unknown as MerchantAccessService,
    )

    const result = await service.list(operator, 'merchant-1', {
      type: 'ALL',
      page: 1,
      pageSize: 20,
    })

    expect(assertAccess).toHaveBeenCalledWith(operator, 'merchant-1')
    expect(prisma.agentRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { merchantId: 'merchant-1' } }),
    )
    expect(prisma.productOptimization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { merchantId: 'merchant-1' } }),
    )
    expect(result.total).toBe(2)
    expect(result.items[0]).toMatchObject({
      type: 'AGENT_RUN',
      agentRunId: 'run-1',
    })
    expect(result.items[1]).toMatchObject({
      type: 'PRODUCT_OPTIMIZATION',
      optimizationId: 'optimization-1',
      batchTaskId: 'batch-1',
      product: { id: 'product-1' },
    })
  })

  it('applies a compatible status filter without leaking other result types', async () => {
    const agentFindMany = vi.fn().mockResolvedValue([])
    const optimizationFindMany = vi.fn().mockResolvedValue([])
    const service = new AiResultsService(
      {
        agentRun: { findMany: agentFindMany },
        productOptimization: { findMany: optimizationFindMany },
      } as unknown as PrismaService,
      {
        assertAccess: vi.fn().mockResolvedValue(undefined),
      } as unknown as MerchantAccessService,
    )

    await service.list(operator, 'merchant-1', {
      type: 'ALL',
      status: 'DRAFT',
      page: 1,
      pageSize: 20,
    })

    expect(agentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          merchantId: 'merchant-1',
          id: '__no_matching_agent_run__',
        },
      }),
    )
    expect(optimizationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { merchantId: 'merchant-1', status: 'DRAFT' },
      }),
    )
  })
})
