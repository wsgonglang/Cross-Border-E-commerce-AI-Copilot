import { Logger } from '@nestjs/common'
import type { NextFunction, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'

import {
  normalizedRoute,
  REQUEST_ID_HEADER,
  RequestContextMiddleware,
  type RequestWithId,
} from './request-context.middleware'

function createHarness(incomingRequestId?: string) {
  let finish: (() => void) | undefined
  const setHeader = vi.fn()
  const request = {
    method: 'GET',
    path: '/api/health',
    header: vi.fn().mockReturnValue(incomingRequestId),
  } as unknown as RequestWithId
  const response = {
    statusCode: 200,
    setHeader,
    once: vi.fn((_event: string, callback: () => void) => {
      finish = callback
    }),
  } as unknown as Response
  const next = vi.fn() as NextFunction
  return {
    request,
    response,
    setHeader,
    next,
    finish: () => finish?.(),
  }
}

describe('RequestContextMiddleware', () => {
  it('uses route templates and collapses unmatched paths to a low-cardinality label', () => {
    expect(
      normalizedRoute({
        baseUrl: '',
        route: { path: '/api/merchants/:merchantId/products/:productId' },
      } as unknown as RequestWithId),
    ).toBe('/api/merchants/:merchantId/products/:productId')
    expect(
      normalizedRoute({ path: '/random-attacker-value' } as RequestWithId),
    ).toBe('unmatched')
  })

  it('preserves a safe upstream request ID and writes a structured completion log', () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {})
    const harness = createHarness('interview-request-001')

    new RequestContextMiddleware().use(
      harness.request,
      harness.response,
      harness.next,
    )
    harness.finish()

    expect(harness.request.requestId).toBe('interview-request-001')
    expect(harness.setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      'interview-request-001',
    )
    const next = harness.next
    expect(next).toHaveBeenCalledOnce()
    expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toMatchObject({
      requestId: 'interview-request-001',
      method: 'GET',
      path: '/api/health',
      statusCode: 200,
    })
    log.mockRestore()
  })

  it('replaces an unsafe request ID to prevent log injection', () => {
    const harness = createHarness('bad\nrequest')

    new RequestContextMiddleware().use(
      harness.request,
      harness.response,
      harness.next,
    )

    expect(harness.request.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })
})
