import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { RoleCode } from '@cross-border/shared'

import { REQUIRED_ROLES_KEY } from '../auth.constants'
import type { AuthenticatedRequest } from '../auth.types'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleCode[]>(
      REQUIRED_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    )

    if (!requiredRoles || requiredRoles.length === 0) {
      return true
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const allowed = requiredRoles.some((role) =>
      request.user.roles.includes(role),
    )

    if (!allowed) {
      throw new ForbiddenException('当前账号没有执行此操作的权限')
    }

    return true
  }
}
