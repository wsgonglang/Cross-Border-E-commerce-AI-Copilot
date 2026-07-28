import { Module } from '@nestjs/common'

import { AiModule } from '../ai/ai.module'
import { CommerceModule } from '../commerce/commerce.module'
import { DatabaseModule } from '../database/database.module'
import { BatchProcessorService } from './batch-processor.service'
import { BatchQueueService } from './batch-queue.service'
import { BatchTasksController } from './batch-tasks.controller'
import { BatchTasksService } from './batch-tasks.service'
import { BatchWorkerRunnerService } from './batch-worker-runner.service'

@Module({
  imports: [DatabaseModule, CommerceModule, AiModule],
  controllers: [BatchTasksController],
  providers: [
    BatchProcessorService,
    BatchQueueService,
    BatchTasksService,
    BatchWorkerRunnerService,
  ],
  exports: [BatchWorkerRunnerService],
})
export class BatchModule {}
