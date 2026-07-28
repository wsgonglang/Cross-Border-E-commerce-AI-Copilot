import { Injectable } from '@nestjs/common'
import type { AuditLogSummary, AuthenticatedUser } from '@cross-border/shared'

import { PrismaService } from '../database/prisma.service'
import { asJson } from './commerce.utils'
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

  async recordAgentToolCall(input: {
    actor: AuthenticatedUser
    merchantId: string
    toolCallId: string
    toolName: string
    arguments: Record<string, unknown>
    status: 'success' | 'error'
    output?: unknown
    error?: string
  }): Promise<void> {
    await this.merchantAccess.assertAccess(input.actor, input.merchantId)
    await this.prisma.auditLog.create({
      data: {
        merchantId: input.merchantId,
        actorUserId: input.actor.id,
        entityType: 'AGENT_TOOL_CALL',
        entityId: input.toolCallId.slice(0, 30),
        action: input.status === 'success' ? 'EXECUTE' : 'EXECUTE_ERROR',
        beforeData: asJson({
          toolName: input.toolName,
          arguments: input.arguments,
        }),
        afterData: asJson({
          status: input.status,
          ...(input.output === undefined ? {} : { output: input.output }),
          ...(input.error ? { error: input.error } : {}),
        }),
      },
    })
  }
}
