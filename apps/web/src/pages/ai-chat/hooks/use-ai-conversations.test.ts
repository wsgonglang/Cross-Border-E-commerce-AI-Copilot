import type { AiSessionSummary } from '@cross-border/shared'
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { listAiSessions } from '../../../api/ai'
import { useAiConversations } from './use-ai-conversations'

vi.mock('../../../api/ai', () => ({
  createAiSession: vi.fn(),
  deleteAiSession: vi.fn(),
  listAiSessions: vi.fn(),
  setAiSessionArchived: vi.fn(),
  updateAiSession: vi.fn(),
}))

const mockedListAiSessions = vi.mocked(listAiSessions)

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function session(id: string, merchantId: string): AiSessionSummary {
  return {
    id,
    merchantId,
    userId: 'user-1',
    title: id,
    status: 'done',
    pinned: false,
    messageCount: 1,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T09:00:00.000Z',
  }
}

describe('useAiConversations', () => {
  afterEach(() => vi.clearAllMocks())

  it('isolates sessions by merchant and ignores a late previous response', async () => {
    const first = deferred<Awaited<ReturnType<typeof listAiSessions>>>()
    const second = deferred<Awaited<ReturnType<typeof listAiSessions>>>()
    mockedListAiSessions.mockImplementation((_token, merchantId) =>
      merchantId === 'merchant-a' ? first.promise : second.promise,
    )
    const baseProps = { token: 'token', onError: vi.fn() }
    const { result, rerender } = renderHook(
      ({ merchantId }: { merchantId: string }) =>
        useAiConversations({ ...baseProps, merchantId }),
      { initialProps: { merchantId: 'merchant-a' } },
    )

    let firstLoad!: Promise<void>
    act(() => {
      firstLoad = result.current.loadSessions()
    })
    rerender({ merchantId: 'merchant-b' })
    expect(result.current.sessions).toEqual([])

    let secondLoad!: Promise<void>
    act(() => {
      secondLoad = result.current.loadSessions()
    })
    await act(async () => {
      second.resolve({
        items: [
          {
            ...session('session-b', 'merchant-b'),
            groupId: 'merchant-b-group',
          },
        ],
        total: 1,
      })
      await secondLoad
    })
    expect(result.current.sessions.map((item) => item.id)).toEqual([
      'session-b',
    ])
    expect(result.current.knownGroups).toEqual(['merchant-b-group'])

    await act(async () => {
      first.resolve({
        items: [
          {
            ...session('session-a', 'merchant-a'),
            groupId: 'merchant-a-group',
          },
        ],
        total: 1,
      })
      await firstLoad
    })
    expect(result.current.sessions.map((item) => item.id)).toEqual([
      'session-b',
    ])
    expect(result.current.knownGroups).toEqual(['merchant-b-group'])
  })
})
