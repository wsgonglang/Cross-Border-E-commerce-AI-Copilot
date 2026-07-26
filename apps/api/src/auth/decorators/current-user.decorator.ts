import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { AuthenticatedUser } from '@cross-border/shared'

import type { AuthenticatedRequest } from '../auth.types'

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    return request.user
  },
)
