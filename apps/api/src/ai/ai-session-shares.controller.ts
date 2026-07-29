import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type { AuthenticatedUser } from '@cross-border/shared'

import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { AiSessionSharesService } from './ai-session-shares.service'
import { CreateAiSessionShareDto } from './dto/ai.dto'

@ApiTags('ai-session-shares')
@ApiBearerAuth()
@Controller('api/merchants/:merchantId/ai')
export class AiSessionSharesController {
  constructor(private readonly sharesService: AiSessionSharesService) {}

  @Get('share-candidates')
  candidates(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
  ) {
    return this.sharesService.candidates(user, merchantId)
  }

  @Get('sessions/:sessionId/shares')
  @Roles('admin', 'operator')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.sharesService.list(user, merchantId, sessionId)
  }

  @Post('sessions/:sessionId/shares')
  @Roles('admin', 'operator')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: CreateAiSessionShareDto,
  ) {
    return this.sharesService.create(user, merchantId, sessionId, dto)
  }

  @Get('session-shares/:shareId')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('shareId') shareId: string,
  ) {
    return this.sharesService.get(user, merchantId, shareId)
  }

  @Delete('session-shares/:shareId')
  @Roles('admin', 'operator')
  revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('shareId') shareId: string,
  ) {
    return this.sharesService.revoke(user, merchantId, shareId)
  }
}
