import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../database/prisma.service'
import type { RequestMetadata } from '../auth.types'

@Injectable()
export class LoginLogsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    userId: string | null,
    email: string,
    succeeded: boolean,
    metadata: RequestMetadata,
  ): Promise<void> {
    await this.prisma.loginLog.create({
      data: {
        userId,
        email,
        result: succeeded ? 'SUCCESS' : 'FAILURE',
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
    })
  }
}
