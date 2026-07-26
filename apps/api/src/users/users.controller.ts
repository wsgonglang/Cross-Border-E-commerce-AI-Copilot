import { Controller, Get } from '@nestjs/common'
import type { AuthenticatedUser } from '@cross-border/shared'

import { Roles } from '../auth/decorators/roles.decorator'
import { UsersRepository } from '../auth/repositories/users.repository'

@Controller('api/users')
@Roles('admin')
export class UsersController {
  constructor(private readonly usersRepository: UsersRepository) {}

  @Get()
  list(): Promise<AuthenticatedUser[]> {
    return this.usersRepository.list()
  }
}
