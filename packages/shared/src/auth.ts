export const ROLE_CODES = ['admin', 'operator', 'viewer'] as const

export type RoleCode = (typeof ROLE_CODES)[number]

export const USER_STATUSES = ['ACTIVE', 'DISABLED'] as const

export type UserStatus = (typeof USER_STATUSES)[number]

export interface AuthenticatedUser {
  id: string
  email: string
  name: string
  roles: RoleCode[]
  merchantIds: string[]
}

export interface UserSummary extends AuthenticatedUser {
  status: UserStatus
  createdAt: string
  updatedAt: string
}

export interface AuthSession {
  accessToken: string
  expiresIn: number
  user: AuthenticatedUser
}
