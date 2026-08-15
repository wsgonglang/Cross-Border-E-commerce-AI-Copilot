import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common'

import { AgentQueueService } from '../ai/agent-queue.service'
import { BatchQueueService } from '../batch/batch-queue.service'
import { PrismaService } from '../database/prisma.service'
import { ImportQueueService } from '../imports/import-queue.service'

export interface RecoveryResult {
  batch: number
  imports: number
  agents: number
}

@Injectable()
export class TaskRecoveryService implements OnApplicationShutdown {
  static readonly INTERVAL_MS = 30_000
  static readonly SAFETY_WINDOW_MS = 10_000
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
  ): Promise<RecoveryResult> {
    const [batchItems, importItems, agentRuns] = await Promise.all([
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
    ])

    await Promise.all([
      this.batchQueue.enqueue(batchItems),
      this.importQueue.enqueue(importItems),
      this.agentQueue.enqueueMany(agentRuns.map((run) => run.id)),
    ])
    return {
      batch: batchItems.length,
      imports: importItems.length,
      agents: agentRuns.length,
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
