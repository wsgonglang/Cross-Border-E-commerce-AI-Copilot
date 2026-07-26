import type {
  AuthenticatedUser,
  AuthSession,
  RoleCode,
} from '@cross-border/shared'
import type { Request } from 'express'

export interface AuthUserRecord extends AuthenticatedUser {
  passwordHash: string
  status: 'ACTIVE' | 'DISABLED'
}

export interface AccessTokenPayload {
  sub: string
  email: string
  roles: RoleCode[]
}

export interface RequestMetadata {
  ipAddress?: string
  userAgent?: string
}

export interface IssuedSession {
  session: AuthSession
  refreshToken: string
  refreshExpiresAt: Date
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser
}
