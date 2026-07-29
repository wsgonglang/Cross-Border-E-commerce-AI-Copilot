import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common'
import type { ApiEnvironment } from '@cross-border/shared'
import { Worker } from 'bullmq'

import { redisConnectionFromUrl } from '../batch/redis-connection'
import { API_ENVIRONMENT } from '../config/api-config.constants'
import { STRUCTURED_IMPORT_QUEUE } from './import.constants'
import { ImportProcessorService } from './import-processor.service'
import type { StructuredImportJobData } from './import-queue.service'

@Injectable()
export class ImportWorkerRunnerService implements OnApplicationShutdown {
  private worker?: Worker<StructuredImportJobData>

  constructor(
    private readonly processor: ImportProcessorService,
    @Inject(API_ENVIRONMENT)
    private readonly environment: Pick<ApiEnvironment, 'REDIS_URL'>,
  ) {}

  start(workerName: string): void {
    if (this.worker) return
    this.worker = new Worker<StructuredImportJobData>(
      STRUCTURED_IMPORT_QUEUE,
      (job) => this.processor.process(job),
      {
        connection: redisConnectionFromUrl(this.environment.REDIS_URL),
        concurrency: 2,
        name: `${workerName}-imports`,
      },
    )
    this.worker.on('error', (error) => {
      process.stderr.write(`[import-worker] ${error.message}\n`)
    })
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close()
  }
}
