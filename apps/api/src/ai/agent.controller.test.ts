import { EventEmitter } from 'node:events'

import { describe, expect, it, vi } from 'vitest'

import { AgentController } from './agent.controller'

describe('AgentController SSE contract', () => {
  it('emits a persisted terminal snapshot as text/event-stream', async () => {
    const request = new EventEmitter()
    const chunks: string[] = []
    const headers = new Map<string, string>()
    const response = {
      writableEnded: false,
      destroyed: false,
      setHeader: vi.fn((name: string, value: string) =>
        headers.set(name, value),
      ),
      flushHeaders: vi.fn(),
      write: vi.fn((chunk: string) => chunks.push(chunk)),
      end: vi.fn(function (this: { writableEnded: boolean }) {
        this.writableEnded = true
      }),
    }
    const run = {
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
    const controller = new AgentController(
      {} as never,
      { get: vi.fn().mockResolvedValue(run) } as never,
      {} as never,
    )

    await controller.streamRunEvents(
      { id: 'user-1' } as never,
      'merchant-1',
      'run-1',
      request as never,
      response as never,
    )

    expect(headers.get('Content-Type')).toBe('text/event-stream; charset=utf-8')
    expect(chunks.join('')).toContain('event: run.snapshot')
    expect(chunks.join('')).toContain('"status":"COMPLETED"')
    expect(response.end).toHaveBeenCalledOnce()
  })
})
