import { describe, expect, it, vi } from 'vitest'

import type { AgentQueueService } from '../ai/agent-queue.service'
import type { BatchQueueService } from '../batch/batch-queue.service'
import type { PrismaService } from '../database/prisma.service'
import type { ImportQueueService } from '../imports/import-queue.service'
import { TaskRecoveryService } from './task-recovery.service'

describe('TaskRecoveryService', () => {
  it('re-enqueues persisted pending work with deterministic business IDs', async () => {
    const findBatchItems = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'batch-1' }])
      .mockResolvedValueOnce([])
    const findImportItems = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'import-1' }])
      .mockResolvedValueOnce([])
    const prisma = {
      batchOptimizationItem: {
        findMany: findBatchItems,
        updateMany: vi.fn(),
      },
      importItem: { findMany: findImportItems, updateMany: vi.fn() },
      agentRun: { findMany: vi.fn().mockResolvedValue([{ id: 'agent-1' }]) },
    } as unknown as PrismaService
    const batch = { enqueue: vi.fn().mockResolvedValue(undefined) }
    const imports = { enqueue: vi.fn().mockResolvedValue(undefined) }
    const agents = { enqueueMany: vi.fn().mockResolvedValue(undefined) }
    const service = new TaskRecoveryService(
      prisma,
      batch as unknown as BatchQueueService,
      imports as unknown as ImportQueueService,
      agents as unknown as AgentQueueService,
    )
    const threshold = new Date('2026-08-15T00:00:00.000Z')

    await expect(service.reconcile(threshold)).resolves.toEqual({
      batch: 1,
      imports: 1,
      agents: 1,
      reclaimedBatch: 0,
      reclaimedImports: 0,
    })
    expect(batch.enqueue).toHaveBeenCalledWith([{ id: 'batch-1' }])
    expect(imports.enqueue).toHaveBeenCalledWith([{ id: 'import-1' }])
    expect(agents.enqueueMany).toHaveBeenCalledWith(['agent-1'])
    const query = findBatchItems.mock.calls[0]?.[0] as {
      where: { status: string; updatedAt: { lt: Date } }
      take: number
    }
    expect(query.where).toMatchObject({
      status: 'PENDING',
      updatedAt: { lt: threshold },
    })
    expect(query.take).toBe(100)
  })

  it('does not enqueue terminal or cancelled records because queries only select recoverable work', async () => {
    const prisma = {
      batchOptimizationItem: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn(),
      },
      importItem: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn(),
      },
      agentRun: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService
    const batch = { enqueue: vi.fn().mockResolvedValue(undefined) }
    const imports = { enqueue: vi.fn().mockResolvedValue(undefined) }
    const agents = { enqueueMany: vi.fn().mockResolvedValue(undefined) }
    const service = new TaskRecoveryService(
      prisma,
      batch as unknown as BatchQueueService,
      imports as unknown as ImportQueueService,
      agents as unknown as AgentQueueService,
    )

    await service.reconcile()
    expect(batch.enqueue).toHaveBeenCalledWith([])
    expect(imports.enqueue).toHaveBeenCalledWith([])
    expect(agents.enqueueMany).toHaveBeenCalledWith([])
  })

  it('reclaims stale processing items before re-enqueuing them', async () => {
    const batchUpdate = vi.fn().mockResolvedValue({ count: 1 })
    const importUpdate = vi.fn().mockResolvedValue({ count: 1 })
    const prisma = {
      batchOptimizationItem: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ id: 'stale-batch' }]),
        updateMany: batchUpdate,
      },
      importItem: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ id: 'stale-import' }]),
        updateMany: importUpdate,
      },
      agentRun: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService
    const batch = { enqueue: vi.fn().mockResolvedValue(undefined) }
    const imports = { enqueue: vi.fn().mockResolvedValue(undefined) }
    const agents = { enqueueMany: vi.fn().mockResolvedValue(undefined) }
    const service = new TaskRecoveryService(
      prisma,
      batch as unknown as BatchQueueService,
      imports as unknown as ImportQueueService,
      agents as unknown as AgentQueueService,
    )
    const threshold = new Date('2026-08-15T00:05:00.000Z')
    const staleThreshold = new Date('2026-08-15T00:00:00.000Z')

    await expect(service.reconcile(threshold, staleThreshold)).resolves.toEqual(
      {
        batch: 1,
        imports: 1,
        agents: 0,
        reclaimedBatch: 1,
        reclaimedImports: 1,
      },
    )
    expect(batchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PROCESSING',
          startedAt: { lt: staleThreshold },
        }) as object,
        data: expect.objectContaining({
          status: 'PENDING',
          startedAt: null,
        }) as object,
      }),
    )
    expect(importUpdate).toHaveBeenCalledOnce()
    expect(batch.enqueue).toHaveBeenCalledWith([{ id: 'stale-batch' }])
    expect(imports.enqueue).toHaveBeenCalledWith([{ id: 'stale-import' }])
  })
})
