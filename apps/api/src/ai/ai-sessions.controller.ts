import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type { AuthenticatedUser } from '@cross-border/shared'

import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { AiSessionsService } from './ai-sessions.service'
import {
  AiSessionQueryDto,
  CreateAiSessionDto,
  UpdateAiSessionDto,
} from './dto/ai.dto'

@ApiTags('ai')
@ApiBearerAuth()
@Controller('api/merchants/:merchantId/ai/sessions')
export class AiSessionsController {
  constructor(private readonly sessionsService: AiSessionsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Query() query: AiSessionQueryDto,
  ) {
    return this.sessionsService.list(user, merchantId, query)
  }

  @Get(':sessionId')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.sessionsService.get(user, merchantId, sessionId)
  }

  @Post()
  @Roles('admin', 'operator')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Body() dto: CreateAiSessionDto,
  ) {
    return this.sessionsService.create(user, merchantId, dto)
  }

  @Patch(':sessionId')
  @Roles('admin', 'operator')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateAiSessionDto,
  ) {
    return this.sessionsService.update(user, merchantId, sessionId, dto)
  }

  @Delete(':sessionId')
  @Roles('admin', 'operator')
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.sessionsService.remove(user, merchantId, sessionId)
  }
}
