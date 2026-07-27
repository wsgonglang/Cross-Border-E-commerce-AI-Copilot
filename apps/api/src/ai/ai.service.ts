import { Inject, Injectable } from '@nestjs/common'
import type { AuthenticatedUser } from '@cross-border/shared'

import { PrismaService } from '../database/prisma.service'
import { AI_PROVIDER, type AiProvider } from './ai-provider.service'
import { AiSessionsService } from './ai-sessions.service'

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

    // 2. Save user message
    const userMessage = await this.prisma.aiMessage.create({
      data: {
        sessionId: currentSessionId,
        role: 'user',
        content,
        parentId: parentMessageId ?? null,
        childrenIds: [],
        revisionJson: JSON.stringify([
          { id: '', content, createdAt: Date.now() },
        ]),
        revisionIdx: 0,
      },
    })

    // 3. Build message history from session
    const sessionMessages = await this.prisma.aiMessage.findMany({
      where: { sessionId: currentSessionId },
      orderBy: { id: 'asc' },
    })

    const history = this.buildHistory(sessionMessages)

    // 4. Auto-generate title if this is the first message
    const nonSystemMessages = sessionMessages.filter(
      (m) => m.role !== 'system',
    )
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
    await this.aiProvider.chat(history, signal, {
      onChunk: (chunk: string) => {
        assistantContent += chunk
        onChunk(chunk)
      },
      onDone: () => {
        if (assistantContent) {
          this.saveAssistantMessage(
            currentSessionId,
            userMessage.id,
            assistantContent,
          ).catch(() => {
            /* non-critical */
          })
        }
      },
      onError: (error: Error) => {
        this
          .updateSessionError(currentSessionId, error.message)
          .catch(() => {
            /* non-critical */
          })
      },
    })
  }

  private async saveAssistantMessage(
    sessionId: string,
    parentId: string,
    content: string,
  ): Promise<void> {
    await this.prisma.aiMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        content,
        parentId,
        childrenIds: [],
        revisionJson: JSON.stringify([
          { id: '', content, createdAt: Date.now() },
        ]),
        revisionIdx: 0,
      },
    })
    await this.prisma.aiSession.update({
      where: { id: sessionId },
      data: { status: 'DONE' },
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

  private buildHistory(
    messages: Array<{
      role: string
      content: string
      parentId: string | null
      childrenIds: unknown
    }>,
  ): { role: string; content: string }[] {
    return messages
      .filter((m) => m.role !== 'system' || m.content)
      .map((m) => ({ role: m.role, content: m.content }))
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
        await this.sessionsService.update(user, merchantId, sessionId, {
          title,
        })
      }
    } catch {
      // Non-critical
    }
  }
}
