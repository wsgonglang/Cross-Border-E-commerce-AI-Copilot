import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type { AuthenticatedUser } from '@cross-border/shared'
import type { Response } from 'express'

import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { AiSessionsService } from './ai-sessions.service'
import {
  AiSessionQueryDto,
  AiSessionExportQueryDto,
  CreateAiSessionDto,
  FavoriteAiMessageDto,
  LinkAiMessageDto,
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

  @Post(':sessionId/archive')
  @Roles('admin', 'operator')
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.sessionsService.setArchived(user, merchantId, sessionId, true)
  }

  @Post(':sessionId/restore')
  @Roles('admin', 'operator')
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.sessionsService.setArchived(user, merchantId, sessionId, false)
  }

  @Patch(':sessionId/messages/:messageId/favorite')
  @Roles('admin', 'operator')
  favoriteMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('sessionId') sessionId: string,
    @Param('messageId') messageId: string,
    @Body() dto: FavoriteAiMessageDto,
  ) {
    return this.sessionsService.favoriteMessage(
      user,
      merchantId,
      sessionId,
      messageId,
      dto.favorited,
    )
  }

  @Post(':sessionId/messages/:messageId/links')
  @Roles('admin', 'operator')
  linkMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('sessionId') sessionId: string,
    @Param('messageId') messageId: string,
    @Body() dto: LinkAiMessageDto,
  ) {
    return this.sessionsService.linkMessage(
      user,
      merchantId,
      sessionId,
      messageId,
      dto,
    )
  }

  @Get(':sessionId/export')
  @Roles('admin', 'operator')
  async export(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('sessionId') sessionId: string,
    @Query() query: AiSessionExportQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const exported = await this.sessionsService.export(
      user,
      merchantId,
      sessionId,
      query.format,
    )
    response.setHeader('Content-Type', exported.contentType)
    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(exported.filename)}`,
    )
    response.send(exported.content)
  }
}
