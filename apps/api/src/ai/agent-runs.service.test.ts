import type { AuthenticatedUser } from '@cross-border/shared'
import { NotFoundException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'

import type { MerchantAccessService } from '../commerce/merchant-access.service'
import type { PrismaService } from '../database/prisma.service'
import { AgentRunsService } from './agent-runs.service'

const operator: AuthenticatedUser = {
  id: 'operator-1',
  email: 'operator@example.com',
  name: 'Operator',
  roles: ['operator'],
  merchantIds: ['merchant-1'],
}

function record() {
  const createdAt = new Date('2026-07-29T08:00:00.000Z')
  return {
    id: 'run-1',
    merchantId: 'merchant-1',
    userId: operator.id,
    message: '查询库存并生成优化草稿',
    answer: '已完成',
    status: 'COMPLETED' as const,
    providerName: 'mock',
    modelName: 'mock-agent',
    promptTokens: 10,
    completionTokens: 5,
    totalTokens: 15,
    createdOptimizationIds: ['optimization-1'],
    error: null,
    createdAt,
    updatedAt: createdAt,
    completedAt: createdAt,
    toolCalls: [
      {
        externalCallId: 'call-1',
        name: 'get_inventory',
        status: 'success',
        input: { productCode: 'P-001' },
        output: { available: 20 },
        error: null,
      },
    ],
  }
}

describe('AgentRunsService', () => {
  it('persists the run and its tool trace before returning a completed result', async () => {
    const transaction = {
      agentToolCall: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
      agentRun: { update: vi.fn().mockResolvedValue(record()) },
    }
    const prisma = {
      agentRun: {
        create: vi.fn().mockResolvedValue({ id: 'run-1' }),
        update: vi.fn().mockResolvedValue(undefined),
      },
      $transaction: vi.fn(
        (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    }
    const service = new AgentRunsService(
      prisma as unknown as PrismaService,
      {
        assertAccess: vi.fn().mockResolvedValue(undefined),
      } as unknown as MerchantAccessService,
    )

    const runId = await service.start(operator, 'merchant-1', '查询库存')
    await service.markRunning(runId)
    await service.complete({
      runId,
      answer: '已完成',
      providerName: 'mock',
      modelName: 'mock-agent',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      toolCalls: [
        {
          id: 'call-1',
          name: 'get_inventory',
          status: 'success',
          input: { productCode: 'P-001' },
          output: { available: 20 },
        },
      ],
      createdOptimizationIds: ['optimization-1'],
    })

    expect(runId).toBe('run-1')
    expect(prisma.agentRun.create).toHaveBeenCalledWith({
      data: {
        merchantId: 'merchant-1',
        userId: operator.id,
        message: '查询库存',
        status: 'PLANNING',
      },
      select: { id: true },
    })
    expect(transaction.agentToolCall.createMany).toHaveBeenCalledOnce()
    expect(transaction.agentRun.update).toHaveBeenCalledOnce()
  })

  it('uses merchant-scoped lookup and rejects a missing or cross-merchant run', async () => {
    const assertAccess = vi.fn().mockResolvedValue(undefined)
    const findFirst = vi.fn().mockResolvedValue(null)
    const service = new AgentRunsService(
      {
        agentRun: { findFirst },
      } as unknown as PrismaService,
      { assertAccess } as unknown as MerchantAccessService,
    )

    await expect(
      service.get(operator, 'merchant-1', 'run-from-another-merchant'),
    ).rejects.toBeInstanceOf(NotFoundException)
    expect(assertAccess).toHaveBeenCalledWith(operator, 'merchant-1')
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'run-from-another-merchant',
          merchantId: 'merchant-1',
        },
      }),
    )
  })

  it('stores a safe failure state without provider details', async () => {
    const update = vi.fn().mockResolvedValue(undefined)
    const service = new AgentRunsService(
      { agentRun: { update } } as unknown as PrismaService,
      {} as MerchantAccessService,
    )

    await service.fail('run-1', 'AI Agent planning failed')

    expect(update).toHaveBeenCalledOnce()
  })
})
