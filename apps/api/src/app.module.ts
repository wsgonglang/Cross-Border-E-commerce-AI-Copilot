import { Module } from '@nestjs/common'

import { AiModule } from './ai/ai.module'
import { AuthModule } from './auth/auth.module'
import { BatchModule } from './batch/batch.module'
import { ApiConfigModule } from './config/api-config.module'
import { CommerceModule } from './commerce/commerce.module'
import { DatabaseModule } from './database/database.module'
import { HealthController } from './health/health.controller'
import { HealthService } from './health/health.service'
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
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
