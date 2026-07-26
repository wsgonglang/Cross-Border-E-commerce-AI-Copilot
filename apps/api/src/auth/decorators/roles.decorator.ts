import { SetMetadata } from '@nestjs/common'
import type { RoleCode } from '@cross-border/shared'

import { REQUIRED_ROLES_KEY } from '../auth.constants'

export const Roles = (...roles: RoleCode[]) =>
  SetMetadata(REQUIRED_ROLES_KEY, roles)
