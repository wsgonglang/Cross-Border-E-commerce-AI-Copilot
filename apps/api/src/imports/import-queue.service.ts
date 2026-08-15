import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common'
import type { ApiEnvironment } from '@cross-border/shared'
import { Queue } from 'bullmq'

import { redisConnectionFromUrl } from '../batch/redis-connection'
import type { QueueJobCounts } from '../batch/batch-queue.service'
import { API_ENVIRONMENT } from '../config/api-config.constants'
import {
  IMPORT_JOB_ATTEMPTS,
  STRUCTURED_IMPORT_JOB,
  STRUCTURED_IMPORT_QUEUE,
} from './import.constants'

export interface StructuredImportJobData {
  itemId: string
}

@Injectable()
export class ImportQueueService implements OnModuleDestroy {
  private readonly queue: Queue<StructuredImportJobData>

  constructor(
    @Inject(API_ENVIRONMENT)
    environment: Pick<ApiEnvironment, 'REDIS_URL'>,
  ) {
    this.queue = new Queue(STRUCTURED_IMPORT_QUEUE, {
      connection: redisConnectionFromUrl(environment.REDIS_URL),
      defaultJobOptions: {
        attempts: IMPORT_JOB_ATTEMPTS,
        backoff: { type: 'exponential', delay: 500 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    })
    this.queue.on('error', () => undefined)
  }

  async enqueue(items: Array<{ id: string }>): Promise<void> {
    await this.queue.addBulk(
      items.map((item) => ({
        name: STRUCTURED_IMPORT_JOB,
        data: { itemId: item.id },
        opts: { jobId: item.id },
      })),
    )
  }

  async cancelWaiting(itemIds: string[]): Promise<void> {
    await Promise.all(
      itemIds.map(async (itemId) => {
        const job = await this.queue.getJob(itemId)
        if (!job) return
        const state = await job.getState()
        if (state === 'waiting' || state === 'delayed') await job.remove()
      }),
    )
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
