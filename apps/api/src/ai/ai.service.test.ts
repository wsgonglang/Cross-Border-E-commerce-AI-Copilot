import type { AuthenticatedUser } from '@cross-border/shared'
import { describe, expect, it, vi } from 'vitest'

import { PrismaService } from '../database/prisma.service'
import type { AiProvider } from './ai-provider.service'
import { AiSessionsService } from './ai-sessions.service'
import { AiService } from './ai.service'

const operator: AuthenticatedUser = {
  id: 'user-1',
  email: 'operator@example.com',
  name: '运营',
  roles: ['operator'],
  merchantIds: ['merchant-1'],
}

function createHarness(provider: AiProvider) {
  const transaction = {
    aiMessage: {
      findFirst: vi.fn(),
      create: vi
        .fn()
        .mockResolvedValueOnce({ id: 'user-message' })
        .mockResolvedValueOnce({ id: 'assistant-message' }),
      update: vi.fn().mockResolvedValue(undefined),
    },
    aiSession: {
      update: vi.fn().mockResolvedValue(undefined),
    },
  }
  const prisma = {
    aiMessage: {
      findMany: vi.fn().mockResolvedValue([
        {
          role: 'user',
          content: '优化标题',
          parentId: null,
          childrenIds: [],
        },
      ]),
    },
    $transaction: vi.fn(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  }
  const sessions = {
    get: vi.fn().mockResolvedValue({ id: 'session-1' }),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
    updateTitleIfDefault: vi.fn().mockResolvedValue(true),
  }
  const service = new AiService(
    prisma as unknown as PrismaService,
    sessions as unknown as AiSessionsService,
    provider,
  )
  return { prisma, service, sessions, transaction }
}

describe('AiService', () => {
  it('waits for the streamed assistant message to be persisted', async () => {
    const provider: AiProvider = {
      name: 'test',
      model: 'test-model',
      chat: (_messages, _signal, onChunk) => {
        onChunk?.('优化')
        onChunk?.('完成')
        return Promise.resolve()
      },
      generateTitle: () => Promise.resolve('标题优化'),
      optimizeProduct: vi.fn(),
      planAgentTools: vi.fn(),
      summarizeAgent: vi.fn(),
    }
    const { service, transaction } = createHarness(provider)
    const chunks: string[] = []

    await service.chat(
      operator,
      'merchant-1',
      'session-1',
      '优化标题',
      undefined,
      undefined,
      (chunk) => chunks.push(chunk),
    )

    expect(chunks.join('')).toBe('优化完成')
    const assistantCreate = transaction.aiMessage.create.mock.calls.at(
      -1,
    )?.[0] as unknown as {
      data: { role: string; content: string; parentId: string }
    }
    expect(assistantCreate.data).toMatchObject({
      role: 'assistant',
      content: '优化完成',
      parentId: 'user-message',
    })
    expect(transaction.aiSession.update).toHaveBeenLastCalledWith({
      where: { id: 'session-1' },
      data: { status: 'DONE' },
    })
  })

  it('persists partial content when generation is stopped', async () => {
    const provider: AiProvider = {
      name: 'test',
      model: 'test-model',
      chat: (_messages, _signal, onChunk) => {
        onChunk?.('部分结果')
        const error = new Error('生成已取消')
        error.name = 'AbortError'
        return Promise.reject(error)
      },
      generateTitle: () => Promise.resolve('标题优化'),
      optimizeProduct: vi.fn(),
      planAgentTools: vi.fn(),
      summarizeAgent: vi.fn(),
    }
    const { service, transaction } = createHarness(provider)

    await service.chat(
      operator,
      'merchant-1',
      'session-1',
      '优化标题',
      undefined,
      new AbortController().signal,
      vi.fn(),
    )

    const assistantCreate = transaction.aiMessage.create.mock.calls.at(
      -1,
    )?.[0] as unknown as {
      data: { role: string; content: string }
    }
    expect(assistantCreate.data).toMatchObject({
      role: 'assistant',
      content: '部分结果',
    })
    expect(transaction.aiSession.update).toHaveBeenLastCalledWith({
      where: { id: 'session-1' },
      data: { status: 'DONE' },
    })
  })
})
