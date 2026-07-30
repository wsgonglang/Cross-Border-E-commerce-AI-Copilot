import type { AuthenticatedUser } from '@cross-border/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { MerchantAccessService } from '../commerce/merchant-access.service'
import type { PrismaService } from '../database/prisma.service'
import { AiQualityService } from './ai-quality.service'

const operator: AuthenticatedUser = {
  id: 'operator-1',
  email: 'operator@example.com',
  name: 'Operator',
  roles: ['operator'],
  merchantIds: ['merchant-1'],
}

afterEach(() => {
  vi.useRealTimers()
})

describe('AiQualityService', () => {
  it('calculates explainable rates, latency, tokens, and trace links', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-31T12:00:00.000Z'))
    const assertAccess = vi.fn().mockResolvedValue(undefined)
    const findRuns = vi.fn().mockResolvedValue([
      {
        id: 'run-success',
        merchantId: 'merchant-1',
        message: 'Check inventory',
        sourcePage: 'dashboard',
        status: 'COMPLETED',
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
        providerName: 'mock',
        modelName: 'mock-agent',
        createdAt: new Date('2026-07-31T10:00:00.000Z'),
        completedAt: new Date('2026-07-31T10:00:02.000Z'),
        toolCalls: [
          { name: 'get_inventory', status: 'success' },
          { name: 'search_platform_rules', status: 'error' },
        ],
      },
      {
        id: 'run-failed',
        merchantId: 'merchant-1',
        message: 'Check order',
        sourcePage: null,
        status: 'FAILED',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        providerName: null,
        modelName: null,
        createdAt: new Date('2026-07-30T10:00:00.000Z'),
        completedAt: new Date('2026-07-30T10:00:04.000Z'),
        toolCalls: [],
      },
    ])
    const findOptimizations = vi.fn().mockResolvedValue([
      {
        id: 'optimization-applied',
        merchantId: 'merchant-1',
        status: 'APPLIED',
        promptTokens: 20,
        completionTokens: 10,
        totalTokens: 30,
        providerName: 'mock',
        modelName: 'mock-optimization',
        createdAt: new Date('2026-07-31T09:00:00.000Z'),
        product: {
          id: 'product-1',
          code: 'P-001',
          title: 'Travel charger',
        },
      },
      {
        id: 'optimization-rejected',
        merchantId: 'merchant-1',
        status: 'REJECTED',
        promptTokens: 8,
        completionTokens: 4,
        totalTokens: 12,
        providerName: 'mock',
        modelName: 'mock-optimization',
        createdAt: new Date('2026-07-30T09:00:00.000Z'),
        product: {
          id: 'product-2',
          code: 'P-002',
          title: 'Cable pouch',
        },
      },
      {
        id: 'optimization-draft',
        merchantId: 'merchant-1',
        status: 'DRAFT',
        promptTokens: 5,
        completionTokens: 3,
        totalTokens: 8,
        providerName: 'mock',
        modelName: 'mock-optimization',
        createdAt: new Date('2026-07-29T09:00:00.000Z'),
        product: {
          id: 'product-3',
          code: 'P-003',
          title: 'Organizer',
        },
      },
    ])
    const service = new AiQualityService(
      {
        agentRun: { findMany: findRuns },
        productOptimization: { findMany: findOptimizations },
      } as unknown as PrismaService,
      { assertAccess } as unknown as MerchantAccessService,
    )

    const report = await service.getReport(operator, 'merchant-1', 7)
    const runQuery = findRuns.mock.calls[0]?.[0] as {
      where: { merchantId: string }
    }
    const optimizationQuery = findOptimizations.mock.calls[0]?.[0] as {
      where: { merchantId: string }
    }

    expect(assertAccess).toHaveBeenCalledWith(operator, 'merchant-1')
    expect(runQuery.where.merchantId).toBe('merchant-1')
    expect(optimizationQuery.where.merchantId).toBe('merchant-1')
    expect(report.acceptance).toEqual({
      numerator: 1,
      denominator: 2,
      rate: 0.5,
    })
    expect(report.agentFailures.rate).toBe(0.5)
    expect(report.toolCalls.rate).toBe(0.5)
    expect(report.averageAgentLatencyMs).toBe(3000)
    expect(report.tokenUsage.totalTokens).toBe(65)
    expect(report.daily).toHaveLength(7)
    expect(report.recentTraces[0]).toMatchObject({
      id: 'run-success',
      type: 'AGENT_RUN',
      latencyMs: 2000,
    })
    expect(
      report.recentTraces.find((trace) => trace.id === 'optimization-applied')
        ?.product?.code,
    ).toBe('P-001')
  })

  it('returns null rates instead of inventing quality when no evidence exists', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-31T12:00:00.000Z'))
    const service = new AiQualityService(
      {
        agentRun: { findMany: vi.fn().mockResolvedValue([]) },
        productOptimization: { findMany: vi.fn().mockResolvedValue([]) },
      } as unknown as PrismaService,
      {
        assertAccess: vi.fn().mockResolvedValue(undefined),
      } as unknown as MerchantAccessService,
    )

    const report = await service.getReport(operator, 'merchant-1', 30)

    expect(report.acceptance.rate).toBeNull()
    expect(report.agentFailures.rate).toBeNull()
    expect(report.toolCalls.rate).toBeNull()
    expect(report.averageAgentLatencyMs).toBeNull()
    expect(report.daily).toHaveLength(30)
  })
})
