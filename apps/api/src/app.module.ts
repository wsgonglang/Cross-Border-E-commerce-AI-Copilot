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
import { UsersModule } from './users/users.module'

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
  controllers: [HealthController],
  providers: [HealthService, RequestContextMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestContextMiddleware)
      .forRoutes({ path: '*splat', method: RequestMethod.ALL })
  }
}
