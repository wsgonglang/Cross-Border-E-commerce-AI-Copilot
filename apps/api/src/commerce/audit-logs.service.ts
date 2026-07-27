import { Injectable } from '@nestjs/common'
import type { AuditLogSummary, AuthenticatedUser } from '@cross-border/shared'

import { PrismaService } from '../database/prisma.service'
import { MerchantAccessService } from './merchant-access.service'

@Injectable()
export class AuditLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly merchantAccess: MerchantAccessService,
  ) {}

  async list(
    user: AuthenticatedUser,
    merchantId: string,
  ): Promise<AuditLogSummary[]> {
    await this.merchantAccess.assertAccess(user, merchantId)
    const logs = await this.prisma.auditLog.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return logs.map((log) => ({
      ...log,
      beforeData: log.beforeData,
      afterData: log.afterData,
      createdAt: log.createdAt.toISOString(),
    }))
  }
}
