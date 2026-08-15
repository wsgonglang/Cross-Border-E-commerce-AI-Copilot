import { Body, Controller, Param, Post, Req, Res } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type { AuthenticatedUser } from '@cross-border/shared'
import type { Request, Response } from 'express'

import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { AiService } from './ai.service'
import { ChatSendDto } from './dto/ai.dto'
import { RateLimit } from '../security/rate-limit.decorator'

@ApiTags('ai')
@ApiBearerAuth()
@Controller('api/merchants/:merchantId/ai')
export class AiChatController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @Roles('admin', 'operator')
  @RateLimit({ limit: 20, windowMs: 60_000, identity: 'user' })
  async chat(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Body() dto: ChatSendDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    return this.stream(req, res, (signal, onChunk) =>
      this.aiService.chat(
        user,
        merchantId,
        dto.sessionId,
        dto.content,
        dto.parentMessageId,
        signal,
        onChunk,
      ),
    )
  }

  @Post('sessions/:sessionId/messages/:messageId/regenerate')
  @Roles('admin', 'operator')
  @RateLimit({ limit: 20, windowMs: 60_000, identity: 'user' })
  async regenerate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('sessionId') sessionId: string,
    @Param('messageId') messageId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    return this.stream(req, res, (signal, onChunk) =>
      this.aiService.regenerate(
        user,
        merchantId,
        sessionId,
        messageId,
        signal,
        onChunk,
      ),
    )
  }

  private async stream(
    req: Request,
    res: Response,
    operation: (
      signal: AbortSignal,
      onChunk: (chunk: string) => void,
    ) => Promise<void>,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('X-Accel-Buffering', 'no')
    res.setHeader('Cache-Control', 'no-cache')

    const abortController = new AbortController()
    res.on('close', () => {
      if (!res.writableEnded) {
        abortController.abort()
      }
    })

    try {
      await operation(abortController.signal, (chunk: string) => {
        if (!res.writableEnded) {
          res.write(chunk)
        }
      })
    } catch {
      if (!res.headersSent) {
        res.status(500).json({ message: 'AI 服务异常' })
      }
    } finally {
      if (!res.writableEnded && !res.destroyed) {
        res.end()
      }
    }
  }
}
