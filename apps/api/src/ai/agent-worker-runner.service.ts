import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common'
import type { ApiEnvironment } from '@cross-border/shared'
import { Worker } from 'bullmq'

import { redisConnectionFromUrl } from '../batch/redis-connection'
import { API_ENVIRONMENT } from '../config/api-config.constants'
import type { AgentRunJobData } from './agent-queue.service'
import { AGENT_RUN_QUEUE } from './agent-queue.constants'
import { AgentProcessorService } from './agent-processor.service'

@Injectable()
export class AgentWorkerRunnerService implements OnApplicationShutdown {
  private worker?: Worker<AgentRunJobData>

  constructor(
    private readonly processor: AgentProcessorService,
    @Inject(API_ENVIRONMENT)
    private readonly environment: Pick<ApiEnvironment, 'REDIS_URL'>,
  ) {}

  start(workerName: string): void {
    if (this.worker) return
    this.worker = new Worker<AgentRunJobData>(
      AGENT_RUN_QUEUE,
      (job) => this.processor.process(job),
      {
        connection: redisConnectionFromUrl(this.environment.REDIS_URL),
        concurrency: 2,
        name: `${workerName}-agent`,
      },
    )
    this.worker.on('error', (error) => {
      process.stderr.write(`[agent-worker] ${error.message}\n`)
    })
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close()
  }
}
