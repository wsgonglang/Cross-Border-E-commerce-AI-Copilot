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
          id: 'user-message',
          role: 'user',
          content: '优化标题',
          parentId: null,
          childrenIds: [],
        },
      ]),
    },
    aiConversationSummary: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue(undefined),
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
      runAgentStep: vi.fn(),
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
      runAgentStep: vi.fn(),
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

  it('builds context from the active branch lineage, excluding abandoned branches', async () => {
    const chat = vi.fn().mockResolvedValue(undefined)
    const provider: AiProvider = {
      name: 'test',
      model: 'test-model',
      chat,
      generateTitle: () => Promise.resolve('标题优化'),
      optimizeProduct: vi.fn(),
      runAgentStep: vi.fn(),
    }
    const { prisma, service, transaction } = createHarness(provider)
    transaction.aiMessage.findFirst.mockResolvedValue({ childrenIds: [] })
    // 消息树：u1 → a1 下挂两个分支：u2-old（被放弃）与本次新消息 user-message。
    prisma.aiMessage.findMany.mockResolvedValue([
      {
        id: 'u1',
        role: 'user',
        content: '第一轮问题',
        parentId: null,
        childrenIds: ['a1'],
      },
      {
        id: 'a1',
        role: 'assistant',
        content: '第一轮回答',
        parentId: 'u1',
        childrenIds: ['u2-old', 'user-message'],
      },
      {
        id: 'u2-old',
        role: 'user',
        content: '被编辑前的旧分支消息',
        parentId: 'a1',
        childrenIds: [],
      },
      {
        id: 'user-message',
        role: 'user',
        content: '编辑后的新消息',
        parentId: 'a1',
        childrenIds: [],
      },
    ])

    await service.chat(
      operator,
      'merchant-1',
      'session-1',
      '编辑后的新消息',
      'a1',
      undefined,
      vi.fn(),
    )

    const history = chat.mock.calls[0]?.[0] as Array<{
      role: string
      content: string
    }>
    expect(history.map((message) => message.content)).toEqual([
      '第一轮问题',
      '第一轮回答',
      '编辑后的新消息',
    ])
    expect(history.some((message) => message.content.includes('旧分支'))).toBe(
      false,
    )
  })

  it('compresses an oversized active lineage into a persisted summary plus recent raw messages', async () => {
    const chat = vi.fn().mockResolvedValue(undefined)
    const summarizeConversation = vi.fn().mockResolvedValue({
      summary: {
        overview: '用户正在优化 P-DEMO-001，并要求保留品牌词。',
        decisions: ['目标市场为美国'],
        constraints: ['保留品牌词'],
        entityReferences: ['P-DEMO-001'],
        openQuestions: ['是否需要西语版本'],
      },
      usage: { promptTokens: 100, completionTokens: 30, totalTokens: 130 },
    })
    const provider: AiProvider = {
      name: 'test',
      model: 'test-model',
      chat,
      generateTitle: () => Promise.resolve('标题优化'),
      summarizeConversation,
      optimizeProduct: vi.fn(),
      runAgentStep: vi.fn(),
    }
    const { prisma, service, transaction } = createHarness(provider)
    transaction.aiMessage.findFirst.mockResolvedValue({ childrenIds: [] })
    const chain = Array.from({ length: 20 }, (_, index) => ({
      id: index === 19 ? 'user-message' : `m-${index}`,
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `${index === 2 ? 'P-DEMO-001 保留品牌词 ' : ''}${'长内容'.repeat(400)}`,
      parentId: index === 0 ? null : `m-${index - 1}`,
      childrenIds: [],
    }))
    prisma.aiMessage.findMany.mockResolvedValue(chain)

    await service.chat(
      operator,
      'merchant-1',
      'session-1',
      '继续优化',
      'm-18',
      undefined,
      vi.fn(),
    )

    const history = chat.mock.calls[0]?.[0] as Array<{
      role: string
      content: string
    }>
    expect(history[0]).toMatchObject({ role: 'system' })
    expect(history[0]?.content).toContain('P-DEMO-001')
    expect(history.length).toBeLessThan(chain.length)
    expect(history.at(-1)?.content).toContain('长内容')
    expect(summarizeConversation).toHaveBeenCalledOnce()
    const checkpointInput = prisma.aiConversationSummary.upsert.mock
      .calls[0]?.[0] as unknown as {
      create: {
        sessionId: string
        sourceMessageCount: number
        totalTokens: number
      }
    }
    expect(checkpointInput.create.sessionId).toBe('session-1')
    expect(checkpointInput.create.sourceMessageCount).toBeGreaterThan(0)
    expect(checkpointInput.create.totalTokens).toBe(130)
  })

  it('reuses a branch-compatible summary checkpoint without another summary call', async () => {
    const chat = vi.fn().mockResolvedValue(undefined)
    const summarizeConversation = vi.fn()
    const provider: AiProvider = {
      name: 'test',
      model: 'test-model',
      chat,
      generateTitle: () => Promise.resolve('标题优化'),
      summarizeConversation,
      optimizeProduct: vi.fn(),
      runAgentStep: vi.fn(),
    }
    const { prisma, service, transaction } = createHarness(provider)
    transaction.aiMessage.findFirst.mockResolvedValue({ childrenIds: [] })
    const chain = Array.from({ length: 14 }, (_, index) => ({
      id: index === 13 ? 'user-message' : `m-${index}`,
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: '历史内容'.repeat(500),
      parentId: index === 0 ? null : `m-${index - 1}`,
      childrenIds: [],
    }))
    prisma.aiMessage.findMany.mockResolvedValue(chain)
    prisma.aiConversationSummary.findMany.mockResolvedValue([
      {
        coveredThroughMessageId: 'm-10',
        summaryJson: {
          overview: '已讨论 P-DEMO-001 的英文优化。',
          decisions: [],
          constraints: [],
          entityReferences: ['P-DEMO-001'],
          openQuestions: [],
        },
      },
    ])

    await service.chat(
      operator,
      'merchant-1',
      'session-1',
      '继续',
      'm-12',
      undefined,
      vi.fn(),
    )

    const history = chat.mock.calls[0]?.[0] as Array<{
      role: string
      content: string
    }>
    expect(history[0]?.role).toBe('system')
    expect(history[0]?.content).toContain('P-DEMO-001')
    expect(history).toHaveLength(4)
    expect(summarizeConversation).not.toHaveBeenCalled()
    expect(prisma.aiConversationSummary.upsert).not.toHaveBeenCalled()
  })

  it('falls back to a token-bounded recent suffix when summarization fails', async () => {
    const chat = vi.fn().mockResolvedValue(undefined)
    const provider: AiProvider = {
      name: 'test',
      model: 'test-model',
      chat,
      generateTitle: () => Promise.resolve('标题优化'),
      summarizeConversation: vi.fn().mockRejectedValue(new Error('timeout')),
      optimizeProduct: vi.fn(),
      runAgentStep: vi.fn(),
    }
    const { prisma, service, transaction } = createHarness(provider)
    transaction.aiMessage.findFirst.mockResolvedValue({ childrenIds: [] })
    const chain = Array.from({ length: 20 }, (_, index) => ({
      id: index === 19 ? 'user-message' : `m-${index}`,
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `消息-${index}-${'长内容'.repeat(400)}`,
      parentId: index === 0 ? null : `m-${index - 1}`,
      childrenIds: [],
    }))
    prisma.aiMessage.findMany.mockResolvedValue(chain)

    await service.chat(
      operator,
      'merchant-1',
      'session-1',
      '继续',
      'm-18',
      undefined,
      vi.fn(),
    )

    const history = chat.mock.calls[0]?.[0] as Array<{ content: string }>
    expect(history.length).toBeLessThan(chain.length)
    expect(history[0]?.content).not.toContain('结构化摘要')
    expect(history.at(-1)?.content).toContain('消息-19')
    expect(prisma.aiConversationSummary.upsert).not.toHaveBeenCalled()
  })
})
