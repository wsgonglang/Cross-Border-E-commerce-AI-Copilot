import { Module } from '@nestjs/common'

import { HealthController } from './health/health.controller'
import { HealthService } from './health/health.service'

@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
