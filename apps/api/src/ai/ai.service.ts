import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { AuthenticatedUser } from '@cross-border/shared'

import { PrismaService } from '../database/prisma.service'
import { AI_PROVIDER, type AiProvider } from './ai-provider.service'
import { AiSessionsService } from './ai-sessions.service'

// 模型上下文只保留活动分支血缘上最近的若干条消息，避免长会话 token 线性膨胀；
// 更早历史的摘要压缩属于后续优化，不在当前范围。
const HISTORY_WINDOW_SIZE = 30

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

    const lineage = this.buildHistory(sessionMessages, userMessage.id)
    // 防御性回退：血缘回溯异常时至少携带当前用户消息，不发送空上下文。
    const history = lineage.length > 0 ? lineage : [{ role: 'user', content }]

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
   * 不进入模型上下文；再截断为最近窗口控制 token 规模。
   */
  private buildHistory(
    messages: Array<{
      id: string
      role: string
      content: string
      parentId: string | null
      childrenIds: unknown
    }>,
    leafMessageId: string,
    windowSize: number = HISTORY_WINDOW_SIZE,
  ): { role: string; content: string }[] {
    const byId = new Map(messages.map((message) => [message.id, message]))
    const lineage: { role: string; content: string }[] = []
    let current = byId.get(leafMessageId)
    while (current) {
      if (current.role !== 'system' || current.content) {
        lineage.push({ role: current.role, content: current.content })
      }
      current = current.parentId ? byId.get(current.parentId) : undefined
    }
    lineage.reverse()
    return lineage.slice(-windowSize)
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
