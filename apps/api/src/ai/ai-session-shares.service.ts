import {
  BadRequestException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type {
  AiShareCandidate,
  AiSharedSession,
  AiSessionShareSummary,
  AuthenticatedUser,
} from '@cross-border/shared'

import { asJson } from '../commerce/commerce.utils'
import { MerchantAccessService } from '../commerce/merchant-access.service'
import { PrismaService } from '../database/prisma.service'
import { redactSensitiveText } from './ai-sessions.service'
import type { CreateAiSessionShareDto } from './dto/ai.dto'

const shareSummaryInclude = {
  _count: { select: { recipients: true } },
} as const

@Injectable()
export class AiSessionSharesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly merchantAccess: MerchantAccessService,
  ) {}

  async candidates(
    actor: AuthenticatedUser,
    merchantId: string,
  ): Promise<AiShareCandidate[]> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    const records = await this.prisma.merchantUser.findMany({
      where: {
        merchantId,
        userId: { not: actor.id },
        user: { status: 'ACTIVE', deletedAt: null },
      },
      select: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { user: { name: 'asc' } },
    })
    return records.map((record) => record.user)
  }

  async list(
    actor: AuthenticatedUser,
    merchantId: string,
    sessionId: string,
  ): Promise<AiSessionShareSummary[]> {
    await this.assertOwnedSession(actor, merchantId, sessionId)
    const records = await this.prisma.aiSessionShare.findMany({
      where: { merchantId, sessionId, createdById: actor.id },
      include: shareSummaryInclude,
      orderBy: { createdAt: 'desc' },
    })
    return records.map((record) => this.toSummary(record))
  }

  async create(
    actor: AuthenticatedUser,
    merchantId: string,
    sessionId: string,
    dto: CreateAiSessionShareDto,
  ): Promise<AiSessionShareSummary> {
    await this.assertOwnedSession(actor, merchantId, sessionId)
    const session = await this.prisma.aiSession.findFirst({
      where: { id: sessionId, merchantId, userId: actor.id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!session) throw new NotFoundException('会话不存在')

    const recipientIds = dto.recipientUserIds.filter((id) => id !== actor.id)
    const recipients = await this.prisma.merchantUser.findMany({
      where: {
        merchantId,
        userId: { in: recipientIds },
        user: { status: 'ACTIVE', deletedAt: null },
      },
      select: { userId: true },
    })
    if (recipients.length !== recipientIds.length || recipients.length === 0) {
      throw new BadRequestException('分享收件人必须是当前商家的有效用户')
    }

    const expiresAt = new Date(Date.now() + dto.expiresInHours * 60 * 60 * 1000)
    const snapshot = {
      title: session.title,
      ownerName: actor.name,
      messages: session.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: redactSensitiveText(message.content),
        createdAt: message.createdAt.toISOString(),
      })),
    }
    const share = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.aiSessionShare.create({
        data: {
          merchantId,
          sessionId,
          createdById: actor.id,
          title: session.title,
          snapshot: asJson(snapshot),
          expiresAt,
          recipients: {
            create: recipients.map((recipient) => ({
              userId: recipient.userId,
            })),
          },
        },
        include: shareSummaryInclude,
      })
      await transaction.auditLog.create({
        data: {
          merchantId,
          actorUserId: actor.id,
          entityType: 'AI_SESSION_SHARE',
          entityId: created.id,
          action: 'CREATE',
          afterData: asJson({
            sessionId,
            recipientUserIds: recipients.map((item) => item.userId),
            expiresAt,
          }),
        },
      })
      return created
    })
    return this.toSummary(share)
  }

  async get(
    actor: AuthenticatedUser,
    merchantId: string,
    shareId: string,
  ): Promise<AiSharedSession> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    const share = await this.prisma.aiSessionShare.findFirst({
      where: {
        id: shareId,
        merchantId,
        OR: [
          { createdById: actor.id },
          { recipients: { some: { userId: actor.id } } },
        ],
      },
    })
    if (!share) throw new NotFoundException('分享不存在或未向当前用户授权')
    if (share.revokedAt) throw new GoneException('分享已撤销')
    if (share.expiresAt <= new Date()) throw new GoneException('分享已过期')

    await this.prisma.auditLog.create({
      data: {
        merchantId,
        actorUserId: actor.id,
        entityType: 'AI_SESSION_SHARE',
        entityId: share.id,
        action: 'ACCESS',
        afterData: asJson({ sessionId: share.sessionId }),
      },
    })
    return this.toSharedSession(share)
  }

  async revoke(
    actor: AuthenticatedUser,
    merchantId: string,
    shareId: string,
  ): Promise<AiSessionShareSummary> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    const current = await this.prisma.aiSessionShare.findFirst({
      where: { id: shareId, merchantId, createdById: actor.id },
      include: shareSummaryInclude,
    })
    if (!current) throw new NotFoundException('分享不存在')
    if (current.revokedAt) return this.toSummary(current)

    const updated = await this.prisma.$transaction(async (transaction) => {
      const share = await transaction.aiSessionShare.update({
        where: { id: shareId },
        data: { revokedAt: new Date() },
        include: shareSummaryInclude,
      })
      await transaction.auditLog.create({
        data: {
          merchantId,
          actorUserId: actor.id,
          entityType: 'AI_SESSION_SHARE',
          entityId: shareId,
          action: 'REVOKE',
          afterData: asJson({ revokedAt: share.revokedAt }),
        },
      })
      return share
    })
    return this.toSummary(updated)
  }

  private async assertOwnedSession(
    actor: AuthenticatedUser,
    merchantId: string,
    sessionId: string,
  ): Promise<void> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    const session = await this.prisma.aiSession.findFirst({
      where: { id: sessionId, merchantId, userId: actor.id },
      select: { id: true },
    })
    if (!session) throw new NotFoundException('会话不存在')
  }

  private toSummary(record: {
    id: string
    sessionId: string
    title: string
    expiresAt: Date
    revokedAt: Date | null
    createdAt: Date
    _count: { recipients: number }
  }): AiSessionShareSummary {
    return {
      id: record.id,
      sessionId: record.sessionId,
      title: record.title,
      recipientCount: record._count.recipients,
      expiresAt: record.expiresAt.toISOString(),
      revokedAt: record.revokedAt?.toISOString(),
      createdAt: record.createdAt.toISOString(),
    }
  }

  private toSharedSession(record: {
    id: string
    merchantId: string
    title: string
    snapshot: unknown
    expiresAt: Date
    createdAt: Date
  }): AiSharedSession {
    const snapshot =
      typeof record.snapshot === 'object' && record.snapshot !== null
        ? (record.snapshot as Record<string, unknown>)
        : {}
    const rawMessages = Array.isArray(snapshot.messages)
      ? snapshot.messages
      : []
    return {
      id: record.id,
      merchantId: record.merchantId,
      title: typeof snapshot.title === 'string' ? snapshot.title : record.title,
      ownerName:
        typeof snapshot.ownerName === 'string' ? snapshot.ownerName : '同事',
      expiresAt: record.expiresAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
      messages: rawMessages.flatMap((item) => {
        if (typeof item !== 'object' || item === null) return []
        const message = item as Record<string, unknown>
        if (
          typeof message.id !== 'string' ||
          !['user', 'assistant', 'system'].includes(String(message.role)) ||
          typeof message.content !== 'string' ||
          typeof message.createdAt !== 'string'
        ) {
          return []
        }
        return [
          {
            id: message.id,
            role: message.role as 'user' | 'assistant' | 'system',
            content: message.content,
            createdAt: message.createdAt,
          },
        ]
      }),
    }
  }
}
