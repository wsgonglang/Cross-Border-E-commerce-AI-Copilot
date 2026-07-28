import 'reflect-metadata'

import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module'
import { BatchWorkerRunnerService } from './batch/batch-worker-runner.service'

export async function startBatchWorker(workerName: string): Promise<void> {
  const application = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  })
  application.enableShutdownHooks()
  application.get(BatchWorkerRunnerService).start(workerName)
}
