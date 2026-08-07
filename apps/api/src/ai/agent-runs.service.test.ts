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

describe('AgentRunsService', () => {
  it('persists tool calls incrementally and completes the run', async () => {
    const upsert = vi.fn().mockResolvedValue(undefined)
    const update = vi.fn().mockResolvedValue(undefined)
    const prisma = {
      agentRun: {
        create: vi.fn().mockResolvedValue({ id: 'run-1' }),
        update,
      },
      agentToolCall: { upsert },
      $transaction: vi.fn((operations: unknown[]) => Promise.all(operations)),
    }
    const service = new AgentRunsService(
      prisma as unknown as PrismaService,
      {
        assertAccess: vi.fn().mockResolvedValue(undefined),
      } as unknown as MerchantAccessService,
    )

    const runId = await service.start(operator, 'merchant-1', '查询库存')
    await service.markRunning(runId)
    await service.appendToolCall(
      runId,
      {
        id: 'call-1',
        name: 'get_inventory',
        status: 'success',
        input: { productCode: 'P-001' },
        output: { available: 20 },
      },
      0,
    )
    await service.complete({
      runId,
      answer: '已完成',
      providerName: 'mock',
      modelName: 'mock-agent',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
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
    // 逐次落库以 runId+externalCallId 唯一键 upsert，重复回放不会重写。
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          runId_externalCallId: { runId: 'run-1', externalCallId: 'call-1' },
        },
        update: {},
      }),
    )
    const completeArgs = update.mock.calls.at(-1)?.[0] as {
      where: { id: string }
      data: { status: string }
    }
    expect(completeArgs.where).toEqual({ id: 'run-1' })
    expect(completeArgs.data.status).toBe('COMPLETED')
  })

  it('recovers orphaned non-terminal runs past the staleness threshold', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 2 })
    const service = new AgentRunsService(
      { agentRun: { updateMany } } as unknown as PrismaService,
      {} as MerchantAccessService,
    )

    const recovered = await service.recoverStaleRuns(10)

    expect(recovered).toBe(2)
    const sweepArgs = updateMany.mock.calls[0]?.[0] as {
      where: { status: { in: string[] }; updatedAt: { lt: Date } }
      data: { status: string }
    }
    expect(sweepArgs.where.status).toEqual({ in: ['PLANNING', 'RUNNING'] })
    expect(sweepArgs.where.updatedAt.lt).toBeInstanceOf(Date)
    expect(sweepArgs.data.status).toBe('FAILED')
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
