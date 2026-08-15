import {
  MiddlewareConsumer,
  Module,
  type NestModule,
  RequestMethod,
} from '@nestjs/common'

import { AiModule } from './ai/ai.module'
import { AuthModule } from './auth/auth.module'
import { BatchModule } from './batch/batch.module'
import { ApiConfigModule } from './config/api-config.module'
import { CommerceModule } from './commerce/commerce.module'
import { DatabaseModule } from './database/database.module'
import { HealthController } from './health/health.controller'
import { HealthService } from './health/health.service'
import { ImportsModule } from './imports/imports.module'
import { RequestContextMiddleware } from './observability/request-context.middleware'
import { MetricsController } from './observability/metrics.controller'
import { MetricsService } from './observability/metrics.service'
import { UsersModule } from './users/users.module'
import { TaskRecoveryService } from './reliability/task-recovery.service'

@Module({
  imports: [
    ApiConfigModule,
    DatabaseModule,
    AuthModule,
    UsersModule,
    CommerceModule,
    AiModule,
    BatchModule,
    ImportsModule,
  ],
  controllers: [HealthController, MetricsController],
  providers: [
    HealthService,
    MetricsService,
    RequestContextMiddleware,
    TaskRecoveryService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestContextMiddleware)
      .forRoutes({ path: '*splat', method: RequestMethod.ALL })
  }
}
