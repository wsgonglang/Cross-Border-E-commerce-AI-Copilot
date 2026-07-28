import { Body, Controller, Param, Post, Req, Res } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type { AuthenticatedUser } from '@cross-border/shared'
import type { Request, Response } from 'express'

import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { AiService } from './ai.service'
import { ChatSendDto } from './dto/ai.dto'

@ApiTags('ai')
@ApiBearerAuth()
@Controller('api/merchants/:merchantId/ai')
export class AiChatController {
  constructor(private readonly aiService: AiService) {}

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

    const abortController = new AbortController()
    res.on('close', () => {
      if (!res.writableEnded) {
        abortController.abort()
      }
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
      if (!res.writableEnded && !res.destroyed) {
        res.end()
      }
    }
  }
}
