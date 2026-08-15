import { Injectable, Logger, type NestMiddleware } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'
import { randomUUID } from 'node:crypto'
import { MetricsService } from './metrics.service'

export const REQUEST_ID_HEADER = 'x-request-id'
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/

export interface RequestWithId extends Request {
  requestId: string
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HttpRequest')

  constructor(private readonly metrics?: MetricsService) {}

  use(request: RequestWithId, response: Response, next: NextFunction): void {
    const incoming = request.header(REQUEST_ID_HEADER)
    const requestId =
      incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID()
    const startedAt = Date.now()
    request.requestId = requestId
    response.setHeader(REQUEST_ID_HEADER, requestId)
    response.once('finish', () => {
      const route = normalizedRoute(request)
      const durationMs = Date.now() - startedAt
      this.metrics?.observeHttp(
        request.method,
        route,
        response.statusCode,
        durationMs,
      )
      this.logger.log(
        JSON.stringify({
          requestId,
          method: request.method,
          path: request.path,
          statusCode: response.statusCode,
          durationMs,
        }),
      )
    })
    next()
  }
}

export function normalizedRoute(request: Request): string {
  const routePath = (request.route as { path?: unknown } | undefined)?.path
  if (typeof routePath === 'string') return `${request.baseUrl}${routePath}`
  return 'unmatched'
}
