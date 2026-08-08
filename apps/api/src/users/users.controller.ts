import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type { AuthenticatedUser, UserSummary } from '@cross-border/shared'

import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { CreateUserDto, UpdateUserDto } from './dto/user.dto'
import { UsersService } from './users.service'

@ApiTags('users')
@ApiBearerAuth()
@Controller('api/users')
@Roles('admin')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list(): Promise<UserSummary[]> {
    return this.usersService.list()
  }

  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateUserDto,
  ): Promise<UserSummary> {
    return this.usersService.create(actor, dto)
  }

  @Patch(':userId')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserSummary> {
    return this.usersService.update(actor, userId, dto)
  }

  @Delete(':userId')
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId') userId: string,
  ): Promise<{ id: string }> {
    return this.usersService.remove(actor, userId)
  }
}
