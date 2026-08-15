import { ArgumentsHost, BadRequestException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'

import { HttpExceptionFilter } from './http-exception.filter'

describe('HttpExceptionFilter', () => {
  it('keeps validation messages and adds the request correlation contract', () => {
    const json = vi.fn()
    const status = vi.fn().mockReturnValue({ json })
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({
          requestId: 'request-123',
          method: 'POST',
          originalUrl: '/api/test',
          url: '/api/test',
        }),
        getResponse: () => ({ status }),
      }),
    } as unknown as ArgumentsHost

    new HttpExceptionFilter().catch(
      new BadRequestException(['field must be a string']),
      host,
    )
    expect(status).toHaveBeenCalledWith(400)
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        code: 'BAD_REQUEST',
        message: ['field must be a string'],
        requestId: 'request-123',
        path: '/api/test',
      }),
    )
  })
})
