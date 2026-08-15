import type {
  AiSessionShareSummary,
  AiSessionSummary,
} from '@cross-border/shared'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { getAiShareCandidates, listAiSessionShares } from '../../../api/ai'
import { useAiSharing } from './use-ai-sharing'

vi.mock('../../../api/ai', () => ({
  createAiSessionShare: vi.fn(),
  getAiShareCandidates: vi.fn().mockResolvedValue([]),
  listAiSessionShares: vi.fn(),
  revokeAiSessionShare: vi.fn(),
}))

const mockedGetCandidates = vi.mocked(getAiShareCandidates)
const mockedListShares = vi.mocked(listAiSessionShares)

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function session(id: string): AiSessionSummary {
  return {
    id,
    merchantId: 'merchant-1',
    userId: 'user-1',
    title: id,
    status: 'done',
    pinned: false,
    messageCount: 1,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T09:00:00.000Z',
  }
}

function share(id: string, sessionId: string): AiSessionShareSummary {
  return { id, sessionId } as AiSessionShareSummary
}

describe('useAiSharing', () => {
  it('keeps late share records out of the newly selected session', async () => {
    const first = deferred<AiSessionShareSummary[]>()
    const second = deferred<AiSessionShareSummary[]>()
    mockedListShares.mockImplementation((_token, _merchantId, sessionId) =>
      sessionId === 'session-a' ? first.promise : second.promise,
    )
    mockedGetCandidates.mockResolvedValue([])
    const { result } = renderHook(() =>
      useAiSharing({ token: 'token', merchantId: 'merchant-1' }),
    )

    let firstOpen!: Promise<void>
    act(() => {
      firstOpen = result.current.open(session('session-a'))
    })
    let secondOpen!: Promise<void>
    act(() => {
      secondOpen = result.current.open(session('session-b'))
    })
    expect(result.current.session?.id).toBe('session-b')
    expect(result.current.shares).toEqual([])

    await act(async () => {
      second.resolve([share('share-b', 'session-b')])
      await secondOpen
    })
    expect(result.current.shares.map((item) => item.id)).toEqual(['share-b'])

    await act(async () => {
      first.resolve([share('share-a', 'session-a')])
      await firstOpen
    })
    expect(result.current.session?.id).toBe('session-b')
    expect(result.current.shares.map((item) => item.id)).toEqual(['share-b'])
  })
})
