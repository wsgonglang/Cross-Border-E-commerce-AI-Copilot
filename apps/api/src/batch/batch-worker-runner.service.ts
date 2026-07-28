import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common'
import type { ApiEnvironment } from '@cross-border/shared'
import { Worker } from 'bullmq'

import { API_ENVIRONMENT } from '../config/api-config.constants'
import type { BatchOptimizationJobData } from './batch-queue.service'
import { BATCH_OPTIMIZATION_QUEUE } from './batch.constants'
import { BatchProcessorService } from './batch-processor.service'
import { redisConnectionFromUrl } from './redis-connection'

@Injectable()
export class BatchWorkerRunnerService implements OnApplicationShutdown {
  private worker?: Worker<BatchOptimizationJobData>

  constructor(
    private readonly processor: BatchProcessorService,
    @Inject(API_ENVIRONMENT)
    private readonly environment: Pick<ApiEnvironment, 'REDIS_URL'>,
  ) {}

  start(workerName: string): void {
    if (this.worker) return
    this.worker = new Worker<BatchOptimizationJobData>(
      BATCH_OPTIMIZATION_QUEUE,
      (job) => this.processor.process(job),
      {
        connection: redisConnectionFromUrl(this.environment.REDIS_URL),
        concurrency: 2,
        name: workerName,
      },
    )
    this.worker.on('error', (error) => {
      process.stderr.write(`[batch-worker] ${error.message}\n`)
    })
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close()
  }
}
