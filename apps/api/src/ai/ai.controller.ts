import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type { AuthenticatedUser } from '@cross-border/shared'
import type { Request, Response } from 'express'

import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { AiSessionsService } from './ai-sessions.service'
import { AiService } from './ai.service'
import type {
  AiSessionQueryDto,
  ChatSendDto,
  CreateAiSessionDto,
  UpdateAiSessionDto,
} from './dto/ai.dto'

@ApiTags('ai')
@ApiBearerAuth()
@Controller('api/merchants/:merchantId/ai')
export class AiController {
  constructor(
    private readonly sessionsService: AiSessionsService,
    private readonly aiService: AiService,
  ) {}

  @Get('sessions')
  listSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Query() query: AiSessionQueryDto,
  ) {
    return this.sessionsService.list(user, merchantId, query)
  }

  @Get('sessions/:sessionId')
  getSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.sessionsService.get(user, merchantId, sessionId)
  }

  @Post('sessions')
  @Roles('admin', 'operator')
  createSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Body() dto: CreateAiSessionDto,
  ) {
    return this.sessionsService.create(user, merchantId, dto)
  }

  @Patch('sessions/:sessionId')
  @Roles('admin', 'operator')
  updateSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateAiSessionDto,
  ) {
    return this.sessionsService.update(user, merchantId, sessionId, dto)
  }

  @Delete('sessions/:sessionId')
  @Roles('admin', 'operator')
  deleteSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.sessionsService.remove(user, merchantId, sessionId)
  }

  @Post('chat')
  @Roles('admin', 'operator')
  async chat(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Body() dto: ChatSendDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('X-Accel-Buffering', 'no')
    res.setHeader('Cache-Control', 'no-cache')

    // Handle client disconnect
    const abortController = new AbortController()
    req.on('close', () => {
      abortController.abort()
    })

    try {
      await this.aiService.chat(
        user,
        merchantId,
        dto.sessionId,
        dto.content,
        dto.parentMessageId,
        abortController.signal,
        (chunk: string) => {
          if (!res.writableEnded) {
            res.write(chunk)
          }
        },
      )
    } catch {
      if (!res.headersSent) {
        res.status(500).json({ message: 'AI 服务异常' })
      }
    } finally {
      if (!res.writableEnded) {
        res.end()
      }
    }
  }
}
