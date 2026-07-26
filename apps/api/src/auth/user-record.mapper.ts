import { ROLE_CODES, type RoleCode } from '@cross-border/shared'

import type { AuthUserRecord } from './auth.types'

interface UserRecordSource {
  id: string
  email: string
  name: string
  passwordHash: string
  status: 'ACTIVE' | 'DISABLED'
  userRoles: Array<{
    role: {
      code: string
    }
  }>
}

function isRoleCode(value: string): value is RoleCode {
  return ROLE_CODES.some((role) => role === value)
}

export function toAuthUserRecord(source: UserRecordSource): AuthUserRecord {
  return {
    id: source.id,
    email: source.email,
    name: source.name,
    passwordHash: source.passwordHash,
    status: source.status,
    roles: source.userRoles.map(({ role }) => role.code).filter(isRoleCode),
  }
}
