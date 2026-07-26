export const ROLE_CODES = ['admin', 'operator', 'viewer'] as const

export type RoleCode = (typeof ROLE_CODES)[number]

export interface AuthenticatedUser {
  id: string
  email: string
  name: string
  roles: RoleCode[]
}

export interface AuthSession {
  accessToken: string
  expiresIn: number
  user: AuthenticatedUser
}
