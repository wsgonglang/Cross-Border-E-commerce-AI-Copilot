import type {
  AgentRunSummary,
  AiMessage,
  AiSessionDetail,
} from '@cross-border/shared'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getAiSession } from '../../../api/ai'
import { runAgent } from '../../../api/agent'
import { getAgentRun } from '../../../api/ai-results'
import { useAiMessages } from './use-ai-messages'

vi.mock('../../../api/ai', () => ({
  favoriteAiMessage: vi.fn(),
  getAiSession: vi.fn(),
  linkAiMessage: vi.fn(),
  selectAiSessionBranch: vi.fn(),
}))
vi.mock('../../../api/agent', () => ({
  cancelAgentRun: vi.fn(),
  runAgent: vi.fn(),
}))
vi.mock('../../../api/ai-results', () => ({ getAgentRun: vi.fn() }))

const mockedGetAiSession = vi.mocked(getAiSession)
const mockedRunAgent = vi.mocked(runAgent)
const mockedGetAgentRun = vi.mocked(getAgentRun)

function message(sessionId: string, content: string): AiMessage {
  return {
    id: `${sessionId}-${content}`,
    sessionId,
    role: 'assistant',
    content,
    childrenIds: [],
    links: [],
    createdAt: '2026-08-08T00:00:00.000Z',
  }
}

function session(sessionId: string, messages: AiMessage[]): AiSessionDetail {
  return {
    id: sessionId,
    merchantId: 'merchant-1',
    userId: 'user-1',
    title: sessionId,
    status: 'done',
    pinned: false,
    messageCount: messages.length,
    messages,
    createdAt: '2026-08-08T00:00:00.000Z',
    updatedAt: '2026-08-08T00:00:00.000Z',
  }
}

function completedRun(answer = 'A completed'): AgentRunSummary {
  return {
    id: 'run-1',
    runId: 'run-1',
    merchantId: 'merchant-1',
    userId: 'user-1',
    message: '查找商品',
    answer,
    status: 'COMPLETED',
    toolCalls: [
      {
        id: 'call-1',
        name: 'search_products',
        status: 'success',
        input: { keyword: 'charger' },
        output: { total: 1 },
      },
    ],
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    createdOptimizationIds: [],
    createdAt: '2026-08-08T00:00:00.000Z',
    updatedAt: '2026-08-08T00:00:01.000Z',
  }
}

function hookProps(currentSessionId: string) {
  return {
    createSession: vi.fn().mockResolvedValue(null),
    currentSessionId,
    merchantId: 'merchant-1',
    onError: vi.fn(),
    onSessionLoaded: vi.fn(),
    refreshSessions: vi.fn().mockResolvedValue(undefined),
    storeId: 'store-1',
    token: 'token',
  }
}

describe('useAiMessages unified Agent conversations', () => {
  afterEach(() => vi.clearAllMocks())

  it('routes the conversation input through Agent with session and store context', async () => {
    mockedGetAiSession.mockResolvedValue(session('session-a', []))
    mockedRunAgent.mockResolvedValue({
      runId: 'run-1',
      status: 'PLANNING',
      sessionId: 'session-a',
      userMessageId: 'user-message-1',
    })
    mockedGetAgentRun.mockResolvedValue(completedRun())
    const props = hookProps('session-a')
    const { result } = renderHook(() => useAiMessages(props))
    await waitFor(() => expect(mockedGetAiSession).toHaveBeenCalled())

    act(() => result.current.setInputValue('查找充电器商品'))
    await act(async () => result.current.send())

    await waitFor(() => expect(mockedRunAgent).toHaveBeenCalledOnce())
    expect(mockedRunAgent).toHaveBeenCalledWith(
      'token',
      'merchant-1',
      '查找充电器商品',
      expect.objectContaining({
        sessionId: 'session-a',
        storeId: 'store-1',
        sourcePage: 'ai-chat',
      }),
    )
    await waitFor(() => expect(props.refreshSessions).toHaveBeenCalledOnce())
  })

  it('keeps a background Agent run isolated when another session is selected', async () => {
    let generationFinished = false
    let resolveRun!: (value: AgentRunSummary) => void
    mockedGetAiSession.mockImplementation((_token, _merchantId, id) =>
      Promise.resolve(
        session(
          id,
          id === 'session-b'
            ? [message(id, 'B history')]
            : generationFinished
              ? [message(id, 'A completed')]
              : [],
        ),
      ),
    )
    mockedRunAgent.mockResolvedValue({ runId: 'run-1', status: 'PLANNING' })
    mockedGetAgentRun.mockImplementation(
      () => new Promise((resolve) => (resolveRun = resolve)),
    )

    const initialProps = hookProps('session-a')
    const { result, rerender } = renderHook(
      (props: ReturnType<typeof hookProps>) => useAiMessages(props),
      { initialProps },
    )
    await waitFor(() => expect(mockedGetAiSession).toHaveBeenCalled())
    act(() => result.current.setInputValue('查找商品'))
    await act(async () => result.current.send())

    rerender({ ...initialProps, currentSessionId: 'session-b' })
    await waitFor(() =>
      expect(result.current.messages[0]?.content).toBe('B history'),
    )
    expect(result.current.streamingSessionIds).toEqual(['session-a'])

    generationFinished = true
    resolveRun(completedRun())
    await waitFor(() =>
      expect(initialProps.refreshSessions).toHaveBeenCalledOnce(),
    )
    expect(result.current.messages.map((item) => item.content)).toEqual([
      'B history',
    ])
  })
})
