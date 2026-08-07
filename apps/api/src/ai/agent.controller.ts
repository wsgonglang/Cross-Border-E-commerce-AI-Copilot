import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type {
  AgentRunStartResponse,
  AuthenticatedUser,
} from '@cross-border/shared'

import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { AgentService } from './agent.service'
import { AgentRunsService } from './agent-runs.service'
import { AgentRunDto } from './dto/agent.dto'

@ApiTags('agent')
@ApiBearerAuth()
@Controller('api/merchants/:merchantId/ai/agent')
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly agentRunsService: AgentRunsService,
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
}
