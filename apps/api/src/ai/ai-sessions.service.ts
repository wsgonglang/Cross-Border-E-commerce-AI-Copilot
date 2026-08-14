import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type {
  AiMessage,
  AiMessageLink,
  AiSessionDetail,
  AiSessionSummary,
  AiUsage,
} from '@cross-border/shared'

import { PrismaService } from '../database/prisma.service'
import { MerchantAccessService } from '../commerce/merchant-access.service'
import { asJson } from '../commerce/commerce.utils'
import type {
  AiSessionQueryDto,
  CreateAiSessionDto,
  LinkAiMessageDto,
  UpdateAiSessionDto,
} from './dto/ai.dto'
import type { AuthenticatedUser } from '@cross-border/shared'

const sessionInclude = {
  _count: { select: { messages: true } },
} as const

export function redactSensitiveText(content: string): string {
  return content
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[邮箱已脱敏]')
    .replace(/(?:\+?\d[\d\s-]{7,}\d)/g, '[电话已脱敏]')
    .replace(
      /((?:收货|配送|shipping)\s*(?:地址|address)?\s*[:：]\s*)[^\n]+/gi,
      '$1[地址已脱敏]',
    )
}

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
      archivedAt: query.archived === 'true' ? { not: null } : null,
    }
    if (query.keyword) {
      where.OR = [
        { title: { contains: query.keyword } },
        { messages: { some: { content: { contains: query.keyword } } } },
      ]
    }
    if (query.groupId) where.groupId = query.groupId
    const [sessions, total] = await this.prisma.$transaction([
      this.prisma.aiSession.findMany({
        where,
        include: sessionInclude,
        orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
        skip: Math.max(0, ((query.page ?? 1) - 1) * (query.pageSize ?? 50)),
        take: Math.min(200, query.pageSize ?? 50),
      }),
      this.prisma.aiSession.count({ where }),
    ])

    return {
      items: sessions.map((session) => this.toSummary(session)),
      total,
    }
  }

  async get(
    user: AuthenticatedUser,
    merchantId: string,
    sessionId: string,
  ): Promise<AiSessionDetail> {
    await this.merchantAccess.assertAccess(user, merchantId)
    const session = await this.prisma.aiSession.findFirst({
      where: { id: sessionId, merchantId, userId: user.id },
      include: {
        ...sessionInclude,
        messages: {
          include: { links: { orderBy: { createdAt: 'asc' } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    if (!session) {
      throw new NotFoundException('会话不存在')
    }
    const linkedRuns = this.prisma.agentRun
      ? await this.prisma.agentRun.findMany({
          where: { sessionId, assistantMessageId: { not: null } },
          include: { toolCalls: { orderBy: { sequence: 'asc' } } },
        })
      : []
    const runByAssistantMessage = new Map(
      linkedRuns.flatMap((run) =>
        run.assistantMessageId
          ? [
              [
                run.assistantMessageId,
                {
                  runId: run.id,
                  status: run.status,
                  toolCalls: run.toolCalls.map((call) => ({
                    id: call.externalCallId,
                    name: call.name as import('@cross-border/shared').AgentToolCallSummary['name'],
                    status:
                      call.status as import('@cross-border/shared').AgentToolCallSummary['status'],
                    input:
                      typeof call.input === 'object' && call.input !== null
                        ? (call.input as Record<string, unknown>)
                        : {},
                    ...(call.output !== null ? { output: call.output } : {}),
                    ...(call.error ? { error: call.error } : {}),
                  })),
                  usage: {
                    promptTokens: run.promptTokens,
                    completionTokens: run.completionTokens,
                    totalTokens: run.totalTokens,
                  },
                  ...(run.providerName
                    ? { providerName: run.providerName }
                    : {}),
                  ...(run.modelName ? { modelName: run.modelName } : {}),
                },
              ] as const,
            ]
          : [],
      ),
    )
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
      archivedAt: session.archivedAt?.toISOString(),
      activeLeafMessageId:
        session.activeLeafMessageId ??
        this.findLatestLeaf(session.messages, session.messages.at(-1)?.id),
      messages: session.messages.map((message) =>
        this.toMessage(message, runByAssistantMessage.get(message.id)),
      ),
    }
  }

  async prepareAgentTurn(
    user: AuthenticatedUser,
    merchantId: string,
    input: {
      sessionId: string
      content: string
      parentMessageId?: string
      regenerateMessageId?: string
    },
  ): Promise<{ sessionId: string; userMessageId: string }> {
    await this.assertOwnedSession(user, merchantId, input.sessionId)
    return this.prisma.$transaction(async (transaction) => {
      if (input.regenerateMessageId) {
        const assistant = await transaction.aiMessage.findFirst({
          where: {
            id: input.regenerateMessageId,
            sessionId: input.sessionId,
            role: 'assistant',
          },
          select: { parentId: true },
        })
        if (!assistant?.parentId) {
          throw new NotFoundException('可重新生成的 AI 消息不存在')
        }
        await transaction.aiSession.update({
          where: { id: input.sessionId },
          data: {
            status: 'STREAMING',
            error: null,
            activeLeafMessageId: assistant.parentId,
          },
        })
        return {
          sessionId: input.sessionId,
          userMessageId: assistant.parentId,
        }
      }

      let parentChildren: string[] = []
      if (input.parentMessageId) {
        const parent = await transaction.aiMessage.findFirst({
          where: { id: input.parentMessageId, sessionId: input.sessionId },
          select: { childrenIds: true },
        })
        if (!parent) throw new NotFoundException('父消息不在当前会话中')
        parentChildren = this.toStringArray(parent.childrenIds)
      }
      const message = await transaction.aiMessage.create({
        data: {
          sessionId: input.sessionId,
          role: 'user',
          content: input.content,
          parentId: input.parentMessageId ?? null,
          childrenIds: [],
          revisionJson: [
            { id: '', content: input.content, createdAt: Date.now() },
          ],
          revisionIdx: 0,
        },
      })
      if (input.parentMessageId) {
        await transaction.aiMessage.update({
          where: { id: input.parentMessageId },
          data: { childrenIds: [...parentChildren, message.id] },
        })
      }
      await transaction.aiSession.update({
        where: { id: input.sessionId },
        data: {
          status: 'STREAMING',
          error: null,
          activeLeafMessageId: message.id,
        },
      })
      return { sessionId: input.sessionId, userMessageId: message.id }
    })
  }

  async finishAgentTurnAndCompleteRun(input: {
    runId: string
    sessionId: string
    userMessageId: string
    content: string
    usage: AiUsage
    providerName: string
    modelName: string
    createdOptimizationIds: string[]
  }): Promise<string | undefined> {
    return this.prisma.$transaction(async (transaction) => {
      const completed = await transaction.agentRun.updateMany({
        where: {
          id: input.runId,
          status: { in: ['PLANNING', 'RUNNING'] },
        },
        data: {
          status: 'COMPLETED',
          answer: input.content,
          providerName: input.providerName,
          modelName: input.modelName,
          promptTokens: input.usage.promptTokens,
          completionTokens: input.usage.completionTokens,
          totalTokens: input.usage.totalTokens,
          createdOptimizationIds: asJson(input.createdOptimizationIds),
          completedAt: new Date(),
        },
      })
      if (completed.count !== 1) return undefined

      const parent = await transaction.aiMessage.findFirst({
        where: { id: input.userMessageId, sessionId: input.sessionId },
        select: { childrenIds: true },
      })
      if (!parent) throw new NotFoundException('Agent 用户消息不存在')
      const assistant = await transaction.aiMessage.create({
        data: {
          sessionId: input.sessionId,
          role: 'assistant',
          content: input.content,
          parentId: input.userMessageId,
          childrenIds: [],
          revisionJson: [
            { id: '', content: input.content, createdAt: Date.now() },
          ],
          revisionIdx: 0,
        },
      })
      await transaction.aiMessage.update({
        where: { id: input.userMessageId },
        data: {
          childrenIds: [
            ...this.toStringArray(parent.childrenIds),
            assistant.id,
          ],
        },
      })
      await transaction.aiSession.update({
        where: { id: input.sessionId },
        data: {
          status: 'DONE',
          error: null,
          activeLeafMessageId: assistant.id,
        },
      })
      await transaction.agentRun.update({
        where: { id: input.runId },
        data: { assistantMessageId: assistant.id },
      })
      return assistant.id
    })
  }

  async failAgentTurn(sessionId: string, error: string): Promise<void> {
    await this.prisma.aiSession.update({
      where: { id: sessionId },
      data: { status: 'ERROR', error: error.slice(0, 1000) },
    })
  }

  async cancelAgentTurn(
    sessionId: string,
    userMessageId: string,
  ): Promise<void> {
    await this.prisma.aiSession.update({
      where: { id: sessionId },
      data: {
        status: 'DONE',
        error: null,
        activeLeafMessageId: userMessageId,
      },
    })
  }

  async selectBranch(
    user: AuthenticatedUser,
    merchantId: string,
    sessionId: string,
    messageId: string,
  ): Promise<AiSessionDetail> {
    await this.assertOwnedSession(user, merchantId, sessionId)
    const messages = await this.prisma.aiMessage.findMany({
      where: { sessionId },
      select: { id: true, childrenIds: true },
      orderBy: { createdAt: 'asc' },
    })
    if (!messages.some((message) => message.id === messageId)) {
      throw new NotFoundException('分支消息不存在')
    }
    const activeLeafMessageId = this.findLatestLeaf(messages, messageId)
    await this.prisma.aiSession.update({
      where: { id: sessionId },
      data: { activeLeafMessageId },
    })
    return this.get(user, merchantId, sessionId)
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
    return this.toSummary(session)
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
    return this.toSummary(updated)
  }

  async updateTitleIfDefault(
    user: AuthenticatedUser,
    merchantId: string,
    sessionId: string,
    title: string,
  ): Promise<boolean> {
    await this.merchantAccess.assertAccess(user, merchantId)
    const result = await this.prisma.aiSession.updateMany({
      where: {
        id: sessionId,
        merchantId,
        userId: user.id,
        title: 'AI 对话',
      },
      data: { title },
    })
    return result.count === 1
  }

  async remove(
    user: AuthenticatedUser,
    merchantId: string,
    sessionId: string,
  ): Promise<{ deleted: true }> {
    await this.merchantAccess.assertAccess(user, merchantId)
    const current = await this.prisma.aiSession.findFirst({
      where: { id: sessionId, merchantId, userId: user.id },
    })
    if (!current) {
      throw new NotFoundException('会话不存在')
    }
    if (!current.archivedAt) {
      throw new BadRequestException('请先归档会话，再执行永久删除')
    }
    await this.prisma.aiSession.delete({ where: { id: sessionId } })
    return { deleted: true }
  }

  async setArchived(
    user: AuthenticatedUser,
    merchantId: string,
    sessionId: string,
    archived: boolean,
  ): Promise<AiSessionSummary> {
    await this.merchantAccess.assertAccess(user, merchantId)
    const current = await this.prisma.aiSession.findFirst({
      where: { id: sessionId, merchantId, userId: user.id },
      include: sessionInclude,
    })
    if (!current) throw new NotFoundException('会话不存在')
    const archivedAt = archived ? new Date() : null
    const updated = await this.prisma.$transaction(async (transaction) => {
      const session = await transaction.aiSession.update({
        where: { id: sessionId },
        data: { archivedAt, ...(archived ? { pinned: false } : {}) },
        include: sessionInclude,
      })
      await transaction.auditLog.create({
        data: {
          merchantId,
          actorUserId: user.id,
          entityType: 'AI_SESSION',
          entityId: sessionId,
          action: archived ? 'ARCHIVE' : 'RESTORE',
          beforeData: asJson({ archivedAt: current.archivedAt }),
          afterData: asJson({ archivedAt }),
        },
      })
      return session
    })
    return this.toSummary(updated)
  }

  async favoriteMessage(
    user: AuthenticatedUser,
    merchantId: string,
    sessionId: string,
    messageId: string,
    favorited: boolean,
  ): Promise<AiMessage> {
    await this.assertOwnedSession(user, merchantId, sessionId)
    const current = await this.prisma.aiMessage.findFirst({
      where: { id: messageId, sessionId },
      include: { links: { orderBy: { createdAt: 'asc' } } },
    })
    if (!current) throw new NotFoundException('消息不存在')
    const updated = await this.prisma.$transaction(async (transaction) => {
      const message = await transaction.aiMessage.update({
        where: { id: messageId },
        data: { favorited },
        include: { links: { orderBy: { createdAt: 'asc' } } },
      })
      await transaction.auditLog.create({
        data: {
          merchantId,
          actorUserId: user.id,
          entityType: 'AI_MESSAGE',
          entityId: messageId,
          action: favorited ? 'FAVORITE' : 'UNFAVORITE',
          afterData: asJson({ sessionId, favorited }),
        },
      })
      return message
    })
    return this.toMessage(updated)
  }

  async linkMessage(
    user: AuthenticatedUser,
    merchantId: string,
    sessionId: string,
    messageId: string,
    dto: LinkAiMessageDto,
  ): Promise<AiMessageLink> {
    await this.assertOwnedSession(user, merchantId, sessionId)
    const message = await this.prisma.aiMessage.findFirst({
      where: { id: messageId, sessionId },
      select: { id: true },
    })
    if (!message) throw new NotFoundException('消息不存在')

    const entity =
      dto.entityType === 'PRODUCT'
        ? await this.prisma.product.findFirst({
            where: { merchantId, code: dto.entityReference },
            select: { id: true, code: true, title: true },
          })
        : await this.prisma.order.findFirst({
            where: { merchantId, orderNo: dto.entityReference },
            select: { id: true, orderNo: true },
          })
    if (!entity) throw new NotFoundException('业务对象不存在')
    const entityCode = 'code' in entity ? entity.code : entity.orderNo
    const entityLabel =
      'title' in entity ? `${entity.code} · ${entity.title}` : entity.orderNo

    const link = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.aiMessageLink.upsert({
        where: {
          messageId_entityType_entityId: {
            messageId,
            entityType: dto.entityType,
            entityId: entity.id,
          },
        },
        create: {
          sessionId,
          messageId,
          createdById: user.id,
          entityType: dto.entityType,
          entityId: entity.id,
          entityCode,
          entityLabel,
        },
        update: { entityCode, entityLabel },
      })
      await transaction.auditLog.create({
        data: {
          merchantId,
          actorUserId: user.id,
          entityType: 'AI_MESSAGE_LINK',
          entityId: created.id,
          action: 'LINK',
          afterData: asJson({
            sessionId,
            messageId,
            entityType: dto.entityType,
            entityId: entity.id,
            entityCode,
          }),
        },
      })
      return created
    })
    return this.toLink(link)
  }

  async export(
    user: AuthenticatedUser,
    merchantId: string,
    sessionId: string,
    format: 'markdown' | 'json',
  ): Promise<{ filename: string; contentType: string; content: string }> {
    const session = await this.get(user, merchantId, sessionId)
    const messages = session.messages.map((message) => ({
      role: message.role,
      content: redactSensitiveText(message.content),
      createdAt: message.createdAt,
    }))
    const safeTitle = session.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80)
    if (format === 'json') {
      return {
        filename: `${safeTitle || 'ai-session'}.json`,
        contentType: 'application/json; charset=utf-8',
        content: JSON.stringify(
          {
            title: session.title,
            createdAt: session.createdAt,
            exportedAt: new Date().toISOString(),
            messages,
          },
          null,
          2,
        ),
      }
    }
    return {
      filename: `${safeTitle || 'ai-session'}.md`,
      contentType: 'text/markdown; charset=utf-8',
      content: [
        `# ${session.title}`,
        '',
        ...messages.flatMap((message) => [
          `## ${message.role === 'user' ? '用户' : message.role === 'assistant' ? 'AI 助手' : '系统'}`,
          '',
          message.content,
          '',
        ]),
      ].join('\n'),
    }
  }

  private async assertOwnedSession(
    user: AuthenticatedUser,
    merchantId: string,
    sessionId: string,
  ): Promise<void> {
    await this.merchantAccess.assertAccess(user, merchantId)
    const session = await this.prisma.aiSession.findFirst({
      where: { id: sessionId, merchantId, userId: user.id },
      select: { id: true },
    })
    if (!session) throw new NotFoundException('会话不存在')
  }

  private toSummary(session: {
    id: string
    merchantId: string
    userId: string
    title: string
    status: string
    error: string | null
    pinned: boolean
    groupId: string | null
    archivedAt: Date | null
    createdAt: Date
    updatedAt: Date
    _count: { messages: number }
  }): AiSessionSummary {
    return {
      id: session.id,
      merchantId: session.merchantId,
      userId: session.userId,
      title: session.title,
      status: session.status.toLowerCase() as AiSessionSummary['status'],
      error: session.error ?? undefined,
      pinned: session.pinned,
      groupId: session.groupId ?? undefined,
      archivedAt: session.archivedAt?.toISOString(),
      messageCount: session._count.messages,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    }
  }

  private toMessage(
    message: {
      id: string
      sessionId: string
      role: string
      content: string
      parentId: string | null
      childrenIds: unknown
      revisionJson: unknown
      revisionIdx: number
      favorited: boolean
      createdAt: Date
      links: Array<{
        id: string
        entityType: string
        entityId: string
        entityCode: string
        entityLabel: string
        createdAt: Date
      }>
    },
    agentRun?: AiMessage['agentRun'],
  ): AiMessage {
    return {
      id: message.id,
      sessionId: message.sessionId,
      role: message.role as AiMessage['role'],
      content: message.content,
      parentId: message.parentId ?? undefined,
      childrenIds: this.toStringArray(message.childrenIds),
      revisions: this.toRevisions(message.revisionJson),
      revisionIndex: message.revisionIdx,
      favorited: message.favorited,
      links: message.links.map((link) => this.toLink(link)),
      createdAt: message.createdAt.toISOString(),
      ...(agentRun ? { agentRun } : {}),
    }
  }

  private toLink(link: {
    id: string
    entityType: string
    entityId: string
    entityCode: string
    entityLabel: string
    createdAt: Date
  }): AiMessageLink {
    return {
      id: link.id,
      entityType: link.entityType as AiMessageLink['entityType'],
      entityId: link.entityId,
      entityCode: link.entityCode,
      entityLabel: link.entityLabel,
      createdAt: link.createdAt.toISOString(),
    }
  }

  private toStringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : []
  }

  private findLatestLeaf(
    messages: Array<{ id: string; childrenIds: unknown }>,
    startId: string | undefined,
  ): string | undefined {
    if (!startId) return undefined
    const byId = new Map(messages.map((message) => [message.id, message]))
    const visited = new Set<string>()
    let currentId = startId
    while (!visited.has(currentId)) {
      visited.add(currentId)
      const children = this.toStringArray(
        byId.get(currentId)?.childrenIds,
      ).filter((id) => byId.has(id))
      if (!children.length) return currentId
      currentId = children.at(-1)!
    }
    return currentId
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
