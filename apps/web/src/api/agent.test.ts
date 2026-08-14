import type { AgentRunSummary } from '@cross-border/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { streamAgentRunEvents } from './agent'

const run: AgentRunSummary = {
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

describe('Agent SSE client', () => {
  afterEach(() => vi.restoreAllMocks())

  it('parses split SSE frames and ignores heartbeats', async () => {
    const encoder = new TextEncoder()
    const payload = `event: heartbeat\ndata: {"at":"now"}\n\nevent: run.completed\ndata: ${JSON.stringify(run)}\n\n`
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(payload.slice(0, 35)))
        controller.enqueue(encoder.encode(payload.slice(35)))
        controller.close()
      },
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    )
    const onEvent = vi.fn()

    const latest = await streamAgentRunEvents(
      'token',
      'merchant-1',
      'run-1',
      new AbortController().signal,
      onEvent,
    )

    expect(latest?.status).toBe('COMPLETED')
    expect(onEvent).toHaveBeenCalledOnce()
    expect(onEvent).toHaveBeenCalledWith('run.completed', run)
  })
})
