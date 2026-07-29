import { Module } from '@nestjs/common'

import { AiModule } from '../ai/ai.module'
import { CommerceModule } from '../commerce/commerce.module'
import { DatabaseModule } from '../database/database.module'
import { ImportFileService } from './import-file.service'
import { ImportJobsService } from './import-jobs.service'
import { ImportProcessorService } from './import-processor.service'
import { ImportQueueService } from './import-queue.service'
import { ImportWorkerRunnerService } from './import-worker-runner.service'
import { ImportsController } from './imports.controller'

@Module({
  imports: [DatabaseModule, CommerceModule, AiModule],
  controllers: [ImportsController],
  providers: [
    ImportFileService,
    ImportJobsService,
    ImportQueueService,
    ImportProcessorService,
    ImportWorkerRunnerService,
  ],
  exports: [ImportWorkerRunnerService],
})
export class ImportsModule {}
