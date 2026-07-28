import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common'
import type { ApiEnvironment } from '@cross-border/shared'
import { Queue } from 'bullmq'

import { API_ENVIRONMENT } from '../config/api-config.constants'
import {
  BATCH_JOB_ATTEMPTS,
  BATCH_OPTIMIZATION_JOB,
  BATCH_OPTIMIZATION_QUEUE,
} from './batch.constants'
import { redisConnectionFromUrl } from './redis-connection'

export interface BatchOptimizationJobData {
  itemId: string
}

@Injectable()
export class BatchQueueService implements OnModuleDestroy {
  private readonly queue: Queue<BatchOptimizationJobData>

  constructor(
    @Inject(API_ENVIRONMENT)
    environment: Pick<ApiEnvironment, 'REDIS_URL'>,
  ) {
    this.queue = new Queue(BATCH_OPTIMIZATION_QUEUE, {
      connection: redisConnectionFromUrl(environment.REDIS_URL),
      defaultJobOptions: {
        attempts: BATCH_JOB_ATTEMPTS,
        backoff: { type: 'exponential', delay: 500 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    })
    this.queue.on('error', () => {
      // Queue operations surface their own errors to callers.
    })
  }

  async enqueue(items: Array<{ id: string }>): Promise<void> {
    if (items.length === 0) return
    await this.queue.addBulk(
      items.map((item) => ({
        name: BATCH_OPTIMIZATION_JOB,
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
        if (state === 'waiting' || state === 'delayed') {
          await job.remove()
        }
      }),
    )
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close()
  }
}
