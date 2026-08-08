import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { AuthenticatedUser } from '@cross-border/shared'

import { PrismaService } from '../database/prisma.service'
import { AI_PROVIDER, type AiProvider } from './ai-provider.service'
import { AiSessionsService } from './ai-sessions.service'
import {
  CHAT_CONTEXT_TOKEN_BUDGET,
  CHAT_RECENT_TOKEN_TARGET,
  conversationSummarySchema,
  estimateMessagesTokens,
  renderConversationSummary,
  takeRecentMessages,
  type ContextMessage,
  type ConversationSummary,
} from './context-budget'

interface LineageMessage extends ContextMessage {
  id: string
}

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionsService: AiSessionsService,
    @Inject(AI_PROVIDER) private readonly aiProvider: AiProvider,
  ) {}

  async chat(
    user: AuthenticatedUser,
    merchantId: string,
    sessionId: string | undefined,
    content: string,
    parentMessageId: string | undefined,
    signal: AbortSignal | undefined,
    onChunk: (chunk: string) => void,
  ): Promise<void> {
    // 1. Get or create session
    let currentSessionId = sessionId
    if (!currentSessionId) {
      const session = await this.sessionsService.create(user, merchantId, {
        title: 'AI 对话',
      })
      currentSessionId = session.id
    } else {
      await this.sessionsService.get(user, merchantId, currentSessionId)
    }

    // 2. Save the user message and maintain the branch relationship.
    const userMessage = await this.prisma.$transaction(async (transaction) => {
      let parentChildren: string[] = []
      if (parentMessageId) {
        const parent = await transaction.aiMessage.findFirst({
          where: { id: parentMessageId, sessionId: currentSessionId },
          select: { childrenIds: true },
        })
        if (!parent) {
          throw new NotFoundException('父消息不存在于当前会话')
        }
        parentChildren = this.toStringArray(parent.childrenIds)
      }

      const message = await transaction.aiMessage.create({
        data: {
          sessionId: currentSessionId,
          role: 'user',
          content,
          parentId: parentMessageId ?? null,
          childrenIds: [],
          revisionJson: [{ id: '', content, createdAt: Date.now() }],
          revisionIdx: 0,
        },
      })

      if (parentMessageId) {
        await transaction.aiMessage.update({
          where: { id: parentMessageId },
          data: { childrenIds: [...parentChildren, message.id] },
        })
      }
      await transaction.aiSession.update({
        where: { id: currentSessionId },
        data: { status: 'STREAMING', error: null },
      })
      return message
    })

    // 3. Build model context from the active branch lineage of the new message
    const sessionMessages = await this.prisma.aiMessage.findMany({
      where: { sessionId: currentSessionId },
      orderBy: { createdAt: 'asc' },
    })

    const lineage = this.buildLineage(sessionMessages, userMessage.id)
    // 防御性回退：血缘回溯异常时至少携带当前用户消息，不发送空上下文。
    const history =
      lineage.length > 0
        ? await this.buildModelContext(currentSessionId, lineage)
        : [{ role: 'user', content }]

    // 4. Auto-generate title if this is the first message
    const nonSystemMessages = sessionMessages.filter((m) => m.role !== 'system')
    if (nonSystemMessages.length <= 1) {
      this.generateAndSetTitle(
        user,
        merchantId,
        currentSessionId,
        history,
      ).catch(() => {
        /* non-critical */
      })
    }

    // 5. Call AI provider
    let assistantContent = ''
    try {
      await this.aiProvider.chat(history, signal, (chunk: string) => {
        assistantContent += chunk
        onChunk(chunk)
      })
      await this.finishGeneration(
        currentSessionId,
        userMessage.id,
        assistantContent,
      )
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        await this.finishGeneration(
          currentSessionId,
          userMessage.id,
          assistantContent,
        )
        return
      }
      const message =
        error instanceof Error ? error.message : '未知 AI 服务异常'
      await this.updateSessionError(currentSessionId, message)
      throw error
    }
  }

  private async finishGeneration(
    sessionId: string,
    parentId: string,
    content: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      if (content) {
        const assistant = await transaction.aiMessage.create({
          data: {
            sessionId,
            role: 'assistant',
            content,
            parentId,
            childrenIds: [],
            revisionJson: [{ id: '', content, createdAt: Date.now() }],
            revisionIdx: 0,
          },
        })
        await transaction.aiMessage.update({
          where: { id: parentId },
          data: { childrenIds: [assistant.id] },
        })
      }
      await transaction.aiSession.update({
        where: { id: sessionId },
        data: { status: 'DONE' },
      })
    })
  }

  private async updateSessionError(
    sessionId: string,
    error: string,
  ): Promise<void> {
    await this.prisma.aiSession.update({
      where: { id: sessionId },
      data: { status: 'ERROR', error },
    })
  }

  /**
   * 从当前用户消息沿 parentId 回溯活动分支血缘，被放弃的编辑/重新生成分支
   * 不进入模型上下文。token 预算和摘要压缩在 buildModelContext 中处理。
   */
  private buildLineage(
    messages: Array<{
      id: string
      role: string
      content: string
      parentId: string | null
      childrenIds: unknown
    }>,
    leafMessageId: string,
  ): LineageMessage[] {
    const byId = new Map(messages.map((message) => [message.id, message]))
    const lineage: LineageMessage[] = []
    let current = byId.get(leafMessageId)
    while (current) {
      if (current.role !== 'system' || current.content) {
        lineage.push({
          id: current.id,
          role: current.role,
          content: current.content,
        })
      }
      current = current.parentId ? byId.get(current.parentId) : undefined
    }
    lineage.reverse()
    return lineage
  }

  private async buildModelContext(
    sessionId: string,
    lineage: LineageMessage[],
  ): Promise<ContextMessage[]> {
    const raw = lineage.map(({ role, content }) => ({ role, content }))
    if (estimateMessagesTokens(raw) <= CHAT_CONTEXT_TOKEN_BUDGET) return raw

    const lineageIndex = new Map(
      lineage.map((message, index) => [message.id, index]),
    )
    const checkpoints = await this.prisma.aiConversationSummary.findMany({
      where: {
        sessionId,
        coveredThroughMessageId: { in: lineage.map((message) => message.id) },
      },
      select: {
        coveredThroughMessageId: true,
        summaryJson: true,
      },
    })
    const usable = checkpoints
      .flatMap((checkpoint) => {
        const parsed = conversationSummarySchema.safeParse(
          checkpoint.summaryJson,
        )
        const index = lineageIndex.get(checkpoint.coveredThroughMessageId)
        return parsed.success && index !== undefined
          ? [{ ...checkpoint, index, summary: parsed.data }]
          : []
      })
      .sort((first, second) => second.index - first.index)

    const latest = usable[0]
    if (latest) {
      const withCheckpoint = this.combineSummaryAndRecent(
        latest.summary,
        lineage.slice(latest.index + 1),
        CHAT_CONTEXT_TOKEN_BUDGET,
      )
      if (estimateMessagesTokens(withCheckpoint) <= CHAT_CONTEXT_TOKEN_BUDGET) {
        return withCheckpoint
      }
    }

    const recent = takeRecentMessages(raw, CHAT_RECENT_TOKEN_TARGET)
    const anchorIndex = lineage.length - recent.length - 1
    if (anchorIndex < 0 || !this.aiProvider.summarizeConversation) {
      return takeRecentMessages(raw, CHAT_CONTEXT_TOKEN_BUDGET)
    }

    const previous = usable.find(
      (checkpoint) => checkpoint.index <= anchorIndex,
    )
    const startIndex = previous ? previous.index + 1 : 0
    const source = lineage
      .slice(startIndex, anchorIndex + 1)
      .map(({ role, content }) => ({ role, content }))
    try {
      const generated = await this.aiProvider.summarizeConversation({
        previousSummary: previous?.summary,
        messages: source,
      })
      const anchor = lineage[anchorIndex]!
      await this.prisma.aiConversationSummary.upsert({
        where: {
          sessionId_coveredThroughMessageId: {
            sessionId,
            coveredThroughMessageId: anchor.id,
          },
        },
        create: {
          sessionId,
          coveredThroughMessageId: anchor.id,
          summaryJson: generated.summary,
          sourceMessageCount: anchorIndex + 1,
          estimatedSourceTokens: estimateMessagesTokens(
            lineage
              .slice(0, anchorIndex + 1)
              .map(({ role, content }) => ({ role, content })),
          ),
          ...generated.usage,
        },
        update: {
          summaryJson: generated.summary,
          sourceMessageCount: anchorIndex + 1,
          estimatedSourceTokens: estimateMessagesTokens(
            lineage
              .slice(0, anchorIndex + 1)
              .map(({ role, content }) => ({ role, content })),
          ),
          ...generated.usage,
        },
      })
      return this.combineSummaryAndRecent(
        generated.summary,
        lineage.slice(anchorIndex + 1),
        CHAT_CONTEXT_TOKEN_BUDGET,
      )
    } catch {
      // 摘要是上下文优化而不是生成前置条件；失败时安全退回近期原文。
      return takeRecentMessages(raw, CHAT_CONTEXT_TOKEN_BUDGET)
    }
  }

  private combineSummaryAndRecent(
    summary: ConversationSummary,
    recent: LineageMessage[],
    tokenBudget: number,
  ): ContextMessage[] {
    const summaryMessage = {
      role: 'system',
      content: renderConversationSummary(summary),
    }
    const remaining = Math.max(
      1,
      tokenBudget - estimateMessagesTokens([summaryMessage]),
    )
    return [
      summaryMessage,
      ...takeRecentMessages(
        recent.map(({ role, content }) => ({ role, content })),
        remaining,
      ),
    ]
  }

  private toStringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : []
  }

  private async generateAndSetTitle(
    user: AuthenticatedUser,
    merchantId: string,
    sessionId: string,
    history: { role: string; content: string }[],
  ): Promise<void> {
    try {
      const title = await this.aiProvider.generateTitle(history)
      if (title) {
        await this.sessionsService.updateTitleIfDefault(
          user,
          merchantId,
          sessionId,
          title,
        )
      }
    } catch {
      // Non-critical
    }
  }
}
