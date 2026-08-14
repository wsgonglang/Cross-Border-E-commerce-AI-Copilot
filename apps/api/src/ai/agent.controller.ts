import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type {
  AgentRunSummary,
  AgentRunFeedbackSummary,
  AgentRunStartResponse,
  AuthenticatedUser,
} from '@cross-border/shared'
import type { Request, Response } from 'express'

import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { AgentService } from './agent.service'
import { AgentRunsService } from './agent-runs.service'
import { AgentRunDto } from './dto/agent.dto'
import { AgentFeedbackDto } from './dto/agent.dto'
import { AgentFeedbackService } from './agent-feedback.service'

@ApiTags('agent')
@ApiBearerAuth()
@Controller('api/merchants/:merchantId/ai/agent')
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly agentRunsService: AgentRunsService,
    private readonly feedbackService: AgentFeedbackService,
  ) {}

  @Post('run')
  run(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Body() dto: AgentRunDto,
  ): Promise<AgentRunStartResponse> {
    return this.agentService.run(
      user,
      merchantId,
      dto.message,
      dto.storeId,
      dto.days,
      dto.sourcePage,
      dto.sessionId
        ? {
            sessionId: dto.sessionId,
            parentMessageId: dto.parentMessageId,
            regenerateMessageId: dto.regenerateMessageId,
          }
        : undefined,
    )
  }

  @Get('runs/:runId')
  getRun(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('runId') runId: string,
  ) {
    return this.agentRunsService.get(user, merchantId, runId)
  }

  @Get('runs/:runId/events')
  async streamRunEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('runId') runId: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    response.setHeader('Cache-Control', 'no-cache, no-transform')
    response.setHeader('Connection', 'keep-alive')
    response.setHeader('X-Accel-Buffering', 'no')
    response.flushHeaders?.()

    let closed = false
    request.on('close', () => {
      closed = true
    })
    let previous = ''
    let first = true
    let lastHeartbeat = Date.now()
    while (!closed && !response.writableEnded) {
      const run = await this.agentRunsService.get(user, merchantId, runId)
      const serialized = JSON.stringify(run)
      if (serialized !== previous) {
        const event = first ? 'run.snapshot' : this.eventFor(run)
        response.write(`event: ${event}\n`)
        response.write(`data: ${serialized}\n\n`)
        previous = serialized
        first = false
      } else if (Date.now() - lastHeartbeat >= 15_000) {
        response.write('event: heartbeat\n')
        response.write(
          `data: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`,
        )
        lastHeartbeat = Date.now()
      }
      if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(run.status)) break
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    if (!response.writableEnded && !response.destroyed) response.end()
  }

  @Post('runs/:runId/cancel')
  cancelRun(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('runId') runId: string,
  ) {
    return this.agentService.cancel(user, merchantId, runId)
  }

  @Post('runs/:runId/feedback')
  feedback(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('runId') runId: string,
    @Body() dto: AgentFeedbackDto,
  ): Promise<AgentRunFeedbackSummary> {
    return this.feedbackService.upsert(user, merchantId, runId, dto)
  }

  private eventFor(run: AgentRunSummary): string {
    if (run.status === 'COMPLETED') return 'run.completed'
    if (run.status === 'FAILED') return 'run.failed'
    if (run.status === 'CANCELLED') return 'run.cancelled'
    return 'run.progress'
  }
}
