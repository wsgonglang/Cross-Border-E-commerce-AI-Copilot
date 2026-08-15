import 'reflect-metadata'

import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module'
import { AgentWorkerRunnerService } from './ai/agent-worker-runner.service'
import { BatchWorkerRunnerService } from './batch/batch-worker-runner.service'
import { ImportWorkerRunnerService } from './imports/import-worker-runner.service'
import { TaskRecoveryService } from './reliability/task-recovery.service'

export async function startBatchWorker(workerName: string): Promise<void> {
  const application = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  })
  application.enableShutdownHooks()
  application.get(BatchWorkerRunnerService).start(workerName)
  application.get(ImportWorkerRunnerService).start(workerName)
  application.get(AgentWorkerRunnerService).start(workerName)
  await application.get(TaskRecoveryService).start()
}
