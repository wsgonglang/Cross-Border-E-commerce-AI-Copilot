import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common'
import type { ApiEnvironment } from '@cross-border/shared'
import { Queue } from 'bullmq'

import { redisConnectionFromUrl } from '../batch/redis-connection'
import type { QueueJobCounts } from '../batch/batch-queue.service'
import { API_ENVIRONMENT } from '../config/api-config.constants'
import {
  AGENT_RUN_ATTEMPTS,
  AGENT_RUN_JOB,
  AGENT_RUN_QUEUE,
} from './agent-queue.constants'

export interface AgentRunJobData {
  runId: string
}

@Injectable()
export class AgentQueueService implements OnModuleDestroy {
  private readonly queue: Queue<AgentRunJobData>

  constructor(
    @Inject(API_ENVIRONMENT)
    environment: Pick<ApiEnvironment, 'REDIS_URL'>,
  ) {
    this.queue = new Queue(AGENT_RUN_QUEUE, {
      connection: redisConnectionFromUrl(environment.REDIS_URL),
      defaultJobOptions: {
        attempts: AGENT_RUN_ATTEMPTS,
        backoff: { type: 'exponential', delay: 750 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    })
    this.queue.on('error', () => {
      // Individual queue operations surface safe errors to their callers.
    })
  }

  async enqueue(runId: string): Promise<void> {
    await this.queue.add(AGENT_RUN_JOB, { runId }, { jobId: runId })
  }

  async enqueueMany(runIds: string[]): Promise<void> {
    if (runIds.length === 0) return
    await this.queue.addBulk(
      runIds.map((runId) => ({
        name: AGENT_RUN_JOB,
        data: { runId },
        opts: { jobId: runId },
      })),
    )
  }

  async cancelWaiting(runId: string): Promise<void> {
    const job = await this.queue.getJob(runId)
    if (!job) return
    const state = await job.getState()
    if (state === 'waiting' || state === 'delayed') await job.remove()
  }

  async getJobCounts(): Promise<QueueJobCounts> {
    const counts = await this.queue.getJobCounts(
      'waiting',
      'active',
      'delayed',
      'failed',
    )
    return {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      delayed: counts.delayed ?? 0,
      failed: counts.failed ?? 0,
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close()
  }
}
