import { Injectable, NotFoundException } from '@nestjs/common'
import type { AiSessionSummary } from '@cross-border/shared'

import { PrismaService } from '../database/prisma.service'
import { MerchantAccessService } from '../commerce/merchant-access.service'
import type {
  AiSessionQueryDto,
  CreateAiSessionDto,
  UpdateAiSessionDto,
} from './dto/ai.dto'
import type { AuthenticatedUser } from '@cross-border/shared'

const sessionInclude = {
  _count: { select: { messages: true } },
} as const

@Injectable()
export class AiSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly merchantAccess: MerchantAccessService,
  ) {}

  async list(
    user: AuthenticatedUser,
    merchantId: string,
    query: AiSessionQueryDto,
  ): Promise<{ items: AiSessionSummary[]; total: number }> {
    await this.merchantAccess.assertAccess(user, merchantId)
    const where: Record<string, unknown> = {
      merchantId,
      userId: user.id,
    }
    if (query.keyword) {
      where.title = { contains: query.keyword }
    }
    const [sessions, total] = await this.prisma.$transaction([
      this.prisma.aiSession.findMany({
        where,
        include: sessionInclude,
        orderBy: { updatedAt: 'desc' },
        skip: Math.max(0, ((query.page ?? 1) - 1) * (query.pageSize ?? 50)),
        take: Math.min(200, query.pageSize ?? 50),
      }),
      this.prisma.aiSession.count({ where }),
    ])

    return {
      items: sessions.map((s) => ({
        id: s.id,
        merchantId: s.merchantId,
        userId: s.userId,
        title: s.title,
        status: s.status.toLowerCase() as AiSessionSummary['status'],
        error: s.error ?? undefined,
        pinned: s.pinned,
        groupId: s.groupId ?? undefined,
        messageCount: s._count.messages,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      })),
      total,
    }
  }

  async get(
    user: AuthenticatedUser,
    merchantId: string,
    sessionId: string,
  ): Promise<import('@cross-border/shared').AiSessionDetail> {
    await this.merchantAccess.assertAccess(user, merchantId)
    const session = await this.prisma.aiSession.findFirst({
      where: { id: sessionId, merchantId, userId: user.id },
      include: {
        ...sessionInclude,
        messages: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!session) {
      throw new NotFoundException('会话不存在')
    }
    return {
      id: session.id,
      merchantId: session.merchantId,
      userId: session.userId,
      title: session.title,
      status: session.status.toLowerCase() as AiSessionSummary['status'],
      error: session.error ?? undefined,
      pinned: session.pinned,
      groupId: session.groupId ?? undefined,
      messageCount: session._count.messages,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      messages: session.messages.map((m) => ({
        id: m.id,
        sessionId: m.sessionId,
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        parentId: m.parentId ?? undefined,
        childrenIds: this.toStringArray(m.childrenIds),
        revisions: this.toRevisions(m.revisionJson),
        createdAt: m.createdAt.toISOString(),
        revisionIndex: m.revisionIdx,
      })),
    }
  }

  async create(
    user: AuthenticatedUser,
    merchantId: string,
    dto: CreateAiSessionDto,
  ): Promise<AiSessionSummary> {
    await this.merchantAccess.assertAccess(user, merchantId)
    const session = await this.prisma.aiSession.create({
      data: {
        merchantId,
        userId: user.id,
        title: dto.title,
        groupId: dto.groupId,
      },
      include: sessionInclude,
    })
    return {
      id: session.id,
      merchantId: session.merchantId,
      userId: session.userId,
      title: session.title,
      status: 'idle',
      pinned: session.pinned,
      groupId: session.groupId ?? undefined,
      messageCount: session._count.messages,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    }
  }

  async update(
    user: AuthenticatedUser,
    merchantId: string,
    sessionId: string,
    dto: UpdateAiSessionDto,
  ): Promise<AiSessionSummary> {
    await this.merchantAccess.assertAccess(user, merchantId)
    const current = await this.prisma.aiSession.findFirst({
      where: { id: sessionId, merchantId, userId: user.id },
      include: sessionInclude,
    })
    if (!current) {
      throw new NotFoundException('会话不存在')
    }
    const updated = await this.prisma.aiSession.update({
      where: { id: sessionId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.pinned !== undefined ? { pinned: dto.pinned } : {}),
        ...(dto.groupId !== undefined ? { groupId: dto.groupId || null } : {}),
      },
      include: sessionInclude,
    })
    return {
      id: updated.id,
      merchantId: updated.merchantId,
      userId: updated.userId,
      title: updated.title,
      status: updated.status.toLowerCase() as AiSessionSummary['status'],
      pinned: updated.pinned,
      groupId: updated.groupId ?? undefined,
      messageCount: updated._count.messages,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    }
  }

  async remove(
    user: AuthenticatedUser,
    merchantId: string,
    sessionId: string,
  ): Promise<void> {
    await this.merchantAccess.assertAccess(user, merchantId)
    const current = await this.prisma.aiSession.findFirst({
      where: { id: sessionId, merchantId, userId: user.id },
    })
    if (!current) {
      throw new NotFoundException('会话不存在')
    }
    await this.prisma.aiSession.delete({ where: { id: sessionId } })
  }

  private toStringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : []
  }

  private toRevisions(
    value: unknown,
  ): import('@cross-border/shared').AiMessageRevision[] | undefined {
    if (!Array.isArray(value)) {
      return undefined
    }
    return value.filter(
      (item): item is import('@cross-border/shared').AiMessageRevision => {
        if (typeof item !== 'object' || item === null) {
          return false
        }
        const candidate = item as Record<string, unknown>
        return (
          typeof candidate.id === 'string' &&
          typeof candidate.content === 'string' &&
          typeof candidate.createdAt === 'number'
        )
      },
    )
  }
}
