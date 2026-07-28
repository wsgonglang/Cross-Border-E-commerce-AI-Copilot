import { Body, Controller, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type { AgentRunResponse, AuthenticatedUser } from '@cross-border/shared'

import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { AgentService } from './agent.service'
import { AgentRunDto } from './dto/agent.dto'

@ApiTags('agent')
@ApiBearerAuth()
@Roles('admin', 'operator')
@Controller('api/merchants/:merchantId/ai/agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('run')
  run(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Body() dto: AgentRunDto,
  ): Promise<AgentRunResponse> {
    return this.agentService.run(user, merchantId, dto.message)
  }
}
