import type { AgentRunSummary } from '@cross-border/shared'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { streamAgentRunEvents } from '../api/agent'
import { getAgentRun } from '../api/ai-results'
import { useAgentRunStream } from './use-agent-run-stream'

vi.mock('../api/agent', () => ({ streamAgentRunEvents: vi.fn() }))
vi.mock('../api/ai-results', () => ({ getAgentRun: vi.fn() }))

const completed: AgentRunSummary = {
  id: 'run-1',
  runId: 'run-1',
  merchantId: 'merchant-1',
  userId: 'user-1',
  message: '查询库存',
  answer: '库存 20',
  status: 'COMPLETED',
  toolCalls: [],
  usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
  createdOptimizationIds: [],
  createdAt: '2026-08-15T00:00:00.000Z',
  updatedAt: '2026-08-15T00:00:01.000Z',
}

describe('useAgentRunStream', () => {
  afterEach(() => vi.clearAllMocks())

  it('uses the SSE terminal snapshot without starting fallback polling', async () => {
    vi.mocked(streamAgentRunEvents).mockImplementation(
      (_token, _merchantId, _runId, _signal, onEvent) => {
        onEvent('run.completed', completed)
        return Promise.resolve(completed)
      },
    )

    const { result } = renderHook(() =>
      useAgentRunStream('token', 'merchant-1', 'run-1'),
    )

    await waitFor(() => expect(result.current.data).toEqual(completed))
    expect(getAgentRun).not.toHaveBeenCalled()
  })

  it('falls back to the persisted GET endpoint when SSE is unavailable', async () => {
    vi.mocked(streamAgentRunEvents).mockRejectedValue(new Error('blocked'))
    vi.mocked(getAgentRun).mockResolvedValue(completed)

    const { result } = renderHook(() =>
      useAgentRunStream('token', 'merchant-1', 'run-1'),
    )

    await waitFor(() => expect(result.current.data).toEqual(completed))
    expect(getAgentRun).toHaveBeenCalledWith('token', 'merchant-1', 'run-1')
  })

  it('aborts only the local subscription when the consumer unmounts', async () => {
    let observedSignal: AbortSignal | undefined
    vi.mocked(streamAgentRunEvents).mockImplementation(
      (_token, _merchantId, _runId, signal) => {
        observedSignal = signal
        return new Promise(() => undefined)
      },
    )

    const { unmount } = renderHook(() =>
      useAgentRunStream('token', 'merchant-1', 'run-1'),
    )
    await waitFor(() => expect(observedSignal).toBeDefined())
    unmount()

    expect(observedSignal?.aborted).toBe(true)
  })
})
