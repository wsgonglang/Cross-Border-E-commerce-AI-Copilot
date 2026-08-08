import type { AiMessage, AiSessionDetail } from '@cross-border/shared'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getAiSession } from '../../../api/ai'
import { useAiMessages } from './use-ai-messages'

vi.mock('../../../api/ai', () => ({
  favoriteAiMessage: vi.fn(),
  getAiSession: vi.fn(),
  linkAiMessage: vi.fn(),
}))

const mockedGetAiSession = vi.mocked(getAiSession)

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

function hookProps(currentSessionId: string) {
  return {
    createSession: vi.fn().mockResolvedValue(null),
    currentSessionId,
    merchantId: 'merchant-1',
    onError: vi.fn(),
    onSessionLoaded: vi.fn(),
    refreshSessions: vi.fn().mockResolvedValue(undefined),
    token: 'token',
  }
}

describe('useAiMessages session isolation', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps a background generation from replacing the selected session', async () => {
    let generationFinished = false
    mockedGetAiSession.mockImplementation((_token, _merchantId, id) => {
      if (id === 'session-b') {
        return Promise.resolve(session(id, [message(id, 'B history')]))
      }
      return Promise.resolve(
        session(id, generationFinished ? [message(id, 'A completed')] : []),
      )
    })

    let streamController: ReadableStreamDefaultController<Uint8Array>
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          streamController = controller
        },
      }),
    } as Response)

    const initialProps = hookProps('session-a')
    const { result, rerender } = renderHook(
      (props: ReturnType<typeof hookProps>) => useAiMessages(props),
      { initialProps },
    )
    await waitFor(() => expect(mockedGetAiSession).toHaveBeenCalled())

    act(() => result.current.setInputValue('optimize product'))
    await act(async () => result.current.send())
    expect(result.current.streaming).toBe(true)

    rerender({ ...initialProps, currentSessionId: 'session-b' })
    await waitFor(() =>
      expect(result.current.messages[0]?.content).toBe('B history'),
    )
    expect(result.current.streaming).toBe(false)
    expect(result.current.streamingSessionIds).toEqual(['session-a'])

    generationFinished = true
    act(() => {
      streamController.enqueue(new TextEncoder().encode('A completed'))
      streamController.close()
    })
    await waitFor(() =>
      expect(initialProps.refreshSessions).toHaveBeenCalledTimes(1),
    )

    expect(result.current.messages.map((item) => item.content)).toEqual([
      'B history',
    ])
    expect(result.current.streamingSessionIds).toEqual([])

    rerender({ ...initialProps, currentSessionId: 'session-a' })
    await waitFor(() =>
      expect(result.current.messages[0]?.content).toBe('A completed'),
    )
  })

  it('preserves the optimistic stream when returning and stops that session only', async () => {
    mockedGetAiSession.mockImplementation((_token, _merchantId, id) =>
      Promise.resolve(
        session(id, id === 'session-b' ? [message(id, 'B history')] : []),
      ),
    )

    let requestSignal: AbortSignal | undefined
    vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
      requestSignal = init?.signal ?? undefined
      return new Promise<Response>((_resolve, reject) => {
        requestSignal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'))
        })
      })
    })

    const initialProps = hookProps('session-a')
    const { result, rerender } = renderHook(
      (props: ReturnType<typeof hookProps>) => useAiMessages(props),
      { initialProps },
    )
    await waitFor(() => expect(mockedGetAiSession).toHaveBeenCalled())

    act(() => result.current.setInputValue('keep generating'))
    await act(async () => result.current.send())

    rerender({ ...initialProps, currentSessionId: 'session-b' })
    await waitFor(() =>
      expect(result.current.messages[0]?.content).toBe('B history'),
    )
    expect(result.current.streaming).toBe(false)

    rerender({ ...initialProps, currentSessionId: 'session-a' })
    expect(result.current.streaming).toBe(true)
    expect(
      result.current.messages.some((item) => item.id.startsWith('optimistic-')),
    ).toBe(true)

    act(() => result.current.stop())
    expect(requestSignal?.aborted).toBe(true)
    await waitFor(() => expect(result.current.streaming).toBe(false))
  })
})
