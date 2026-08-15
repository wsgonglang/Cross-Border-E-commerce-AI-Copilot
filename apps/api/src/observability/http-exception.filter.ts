import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common'
import type { Response } from 'express'

import type { RequestWithId } from './request-context.middleware'

interface ErrorBody {
  statusCode: number
  code: string
  message: string | string[]
  requestId: string
  timestamp: string
  path: string
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException')

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp()
    const request = context.getRequest<RequestWithId>()
    const response = context.getResponse<Response>()
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR
    const details =
      exception instanceof HttpException ? exception.getResponse() : undefined
    const body: ErrorBody = {
      statusCode: status,
      code: this.code(status, details),
      message: this.message(status, details),
      requestId: request.requestId ?? 'unavailable',
      timestamp: new Date().toISOString(),
      path: request.originalUrl || request.url,
    }

    if (status >= 500) {
      this.logger.error(
        JSON.stringify({
          requestId: body.requestId,
          method: request.method,
          path: body.path,
          statusCode: status,
          errorName:
            exception instanceof Error ? exception.name : 'UnknownError',
        }),
      )
    }
    response.status(status).json(body)
  }

  private code(status: number, details: string | object | undefined): string {
    if (typeof details === 'object' && details !== null && 'code' in details) {
      const code = (details as { code?: unknown }).code
      if (typeof code === 'string' && /^[A-Z0-9_]{2,64}$/.test(code))
        return code
    }
    return HttpStatus[status] ?? 'HTTP_ERROR'
  }

  private message(
    status: number,
    details: string | object | undefined,
  ): string | string[] {
    if (status >= 500) return '服务暂时不可用，请稍后重试'
    if (typeof details === 'string') return details
    if (
      typeof details === 'object' &&
      details !== null &&
      'message' in details
    ) {
      const message = (details as { message?: unknown }).message
      if (
        typeof message === 'string' ||
        (Array.isArray(message) &&
          message.every((item) => typeof item === 'string'))
      ) {
        return message
      }
    }
    return '请求处理失败'
  }
}
