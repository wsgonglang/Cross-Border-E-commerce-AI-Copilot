import { Module } from '@nestjs/common'

import { AuthModule } from './auth/auth.module'
import { ApiConfigModule } from './config/api-config.module'
import { DatabaseModule } from './database/database.module'
import { HealthController } from './health/health.controller'
import { HealthService } from './health/health.service'
import { UsersModule } from './users/users.module'

@Module({
  imports: [ApiConfigModule, DatabaseModule, AuthModule, UsersModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
