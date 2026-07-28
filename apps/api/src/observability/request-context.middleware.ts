import { Injectable, Logger, type NestMiddleware } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'
import { randomUUID } from 'node:crypto'

export const REQUEST_ID_HEADER = 'x-request-id'
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/

export interface RequestWithId extends Request {
  requestId: string
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HttpRequest')

  use(request: RequestWithId, response: Response, next: NextFunction): void {
    const incoming = request.header(REQUEST_ID_HEADER)
    const requestId =
      incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID()
    const startedAt = Date.now()
    request.requestId = requestId
    response.setHeader(REQUEST_ID_HEADER, requestId)
    response.once('finish', () => {
      this.logger.log(
        JSON.stringify({
          requestId,
          method: request.method,
          path: request.path,
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt,
        }),
      )
    })
    next()
  }
}
