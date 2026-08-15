import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import type { ApiEnvironment } from '@cross-border/shared'

import { API_ENVIRONMENT } from '../config/api-config.constants'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { AccessTokenGuard } from './guards/access-token.guard'
import { RolesGuard } from './guards/roles.guard'
import { LoginLogsRepository } from './repositories/login-logs.repository'
import { RefreshTokensRepository } from './repositories/refresh-tokens.repository'
import { UsersRepository } from './repositories/users.repository'
import { RateLimitGuard } from '../security/rate-limit.guard'

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [API_ENVIRONMENT],
      useFactory: (environment: ApiEnvironment) => ({
        secret: environment.JWT_ACCESS_SECRET,
        signOptions: {
          expiresIn: environment.JWT_ACCESS_TTL_SECONDS,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    UsersRepository,
    RefreshTokensRepository,
    LoginLogsRepository,
    {
      provide: APP_GUARD,
      useClass: AccessTokenGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
  exports: [AuthService, UsersRepository],
})
export class AuthModule {}
