import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'

import { IS_PUBLIC_KEY } from '../auth.constants'
import { AuthService } from '../auth.service'
import type { AuthenticatedRequest } from '../auth.types'

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (isPublic) {
      return true
    }

    const request = context.switchToHttp().getRequest<Request>()
    const token = this.extractBearerToken(request)

    if (!token) {
      throw new UnauthorizedException('缺少访问令牌')
    }

    const user = await this.authService.validateAccessToken(token)
    ;(request as AuthenticatedRequest).user = user
    return true
  }

  private extractBearerToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? []
    return type === 'Bearer' ? token : undefined
  }
}
