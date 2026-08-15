import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common'

import { AgentQueueService } from '../ai/agent-queue.service'
import { BatchQueueService } from '../batch/batch-queue.service'
import { PrismaService } from '../database/prisma.service'
import { ImportQueueService } from '../imports/import-queue.service'

export interface RecoveryResult {
  batch: number
  imports: number
  agents: number
  reclaimedBatch: number
  reclaimedImports: number
}

@Injectable()
export class TaskRecoveryService implements OnApplicationShutdown {
  static readonly INTERVAL_MS = 30_000
  static readonly SAFETY_WINDOW_MS = 10_000
  static readonly PROCESSING_STALE_MS = 5 * 60_000
  static readonly SCAN_LIMIT = 100

  private readonly logger = new Logger(TaskRecoveryService.name)
  private timer?: NodeJS.Timeout
  private running = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly batchQueue: BatchQueueService,
    private readonly importQueue: ImportQueueService,
    private readonly agentQueue: AgentQueueService,
  ) {}

  async start(): Promise<void> {
    if (this.timer) return
    await this.runSafely()
    this.timer = setInterval(
      () => void this.runSafely(),
      TaskRecoveryService.INTERVAL_MS,
    )
    this.timer.unref?.()
  }

  async reconcile(
    threshold = new Date(Date.now() - TaskRecoveryService.SAFETY_WINDOW_MS),
    staleThreshold = new Date(
      Date.now() - TaskRecoveryService.PROCESSING_STALE_MS,
    ),
  ): Promise<RecoveryResult> {
    const [batchItems, importItems, agentRuns, staleBatch, staleImports] =
      await Promise.all([
        this.prisma.batchOptimizationItem.findMany({
          where: {
            status: 'PENDING',
            updatedAt: { lt: threshold },
            task: { cancelledAt: null },
          },
          select: { id: true },
          orderBy: { updatedAt: 'asc' },
          take: TaskRecoveryService.SCAN_LIMIT,
        }),
        this.prisma.importItem.findMany({
          where: {
            status: 'PENDING',
            updatedAt: { lt: threshold },
            job: { cancelledAt: null },
          },
          select: { id: true },
          orderBy: { updatedAt: 'asc' },
          take: TaskRecoveryService.SCAN_LIMIT,
        }),
        this.prisma.agentRun.findMany({
          where: { status: 'PLANNING', updatedAt: { lt: threshold } },
          select: { id: true },
          orderBy: { updatedAt: 'asc' },
          take: TaskRecoveryService.SCAN_LIMIT,
        }),
        this.prisma.batchOptimizationItem.findMany({
          where: {
            status: 'PROCESSING',
            startedAt: { lt: staleThreshold },
            task: { cancelledAt: null },
          },
          select: { id: true },
          orderBy: { startedAt: 'asc' },
          take: TaskRecoveryService.SCAN_LIMIT,
        }),
        this.prisma.importItem.findMany({
          where: {
            status: 'PROCESSING',
            startedAt: { lt: staleThreshold },
            job: { cancelledAt: null },
          },
          select: { id: true },
          orderBy: { startedAt: 'asc' },
          take: TaskRecoveryService.SCAN_LIMIT,
        }),
      ])

    const [reclaimedBatch, reclaimedImports] = await Promise.all([
      staleBatch.length
        ? this.prisma.batchOptimizationItem.updateMany({
            where: {
              id: { in: staleBatch.map((item) => item.id) },
              status: 'PROCESSING',
              startedAt: { lt: staleThreshold },
              task: { cancelledAt: null },
            },
            data: {
              status: 'PENDING',
              startedAt: null,
              error: '检测到 Worker 中断，等待安全重试',
            },
          })
        : Promise.resolve({ count: 0 }),
      staleImports.length
        ? this.prisma.importItem.updateMany({
            where: {
              id: { in: staleImports.map((item) => item.id) },
              status: 'PROCESSING',
              startedAt: { lt: staleThreshold },
              job: { cancelledAt: null },
            },
            data: {
              status: 'PENDING',
              startedAt: null,
              error: '检测到 Worker 中断，等待安全重试',
            },
          })
        : Promise.resolve({ count: 0 }),
    ])

    const recoverableBatch = [...batchItems, ...staleBatch]
    const recoverableImports = [...importItems, ...staleImports]

    await Promise.all([
      this.batchQueue.enqueue(recoverableBatch),
      this.importQueue.enqueue(recoverableImports),
      this.agentQueue.enqueueMany(agentRuns.map((run) => run.id)),
    ])
    return {
      batch: recoverableBatch.length,
      imports: recoverableImports.length,
      agents: agentRuns.length,
      reclaimedBatch: reclaimedBatch.count,
      reclaimedImports: reclaimedImports.count,
    }
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer)
  }

  private async runSafely(): Promise<void> {
    if (this.running) return
    this.running = true
    try {
      const result = await this.reconcile()
      const total = result.batch + result.imports + result.agents
      if (total > 0) {
        this.logger.log(JSON.stringify({ event: 'task_recovery', ...result }))
      }
    } catch (error: unknown) {
      this.logger.error(
        JSON.stringify({
          event: 'task_recovery_failed',
          errorName: error instanceof Error ? error.name : 'UnknownError',
        }),
      )
    } finally {
      this.running = false
    }
  }
}
