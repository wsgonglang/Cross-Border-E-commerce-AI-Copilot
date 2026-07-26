import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import type { ApiEnvironment } from '@cross-border/shared'

import { API_ENVIRONMENT } from '../config/api-config.constants'
import { PrismaClient } from '../generated/prisma/client'

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(@Inject(API_ENVIRONMENT) environment: ApiEnvironment) {
    super({
      adapter: new PrismaMariaDb(environment.DATABASE_URL),
    })
  }

  async onModuleInit(): Promise<void> {
    await this.$connect()
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }
}
