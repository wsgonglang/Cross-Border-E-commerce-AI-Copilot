import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type {
  AuthenticatedUser,
  PaginatedAiResults,
} from '@cross-border/shared'

import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { AiResultsService } from './ai-results.service'
import { AiResultsQueryDto } from './dto/agent.dto'

@ApiTags('ai-results')
@ApiBearerAuth()
@Roles('admin', 'operator')
@Controller('api/merchants/:merchantId/ai/results')
export class AiResultsController {
  constructor(private readonly resultsService: AiResultsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Query() query: AiResultsQueryDto,
  ): Promise<PaginatedAiResults> {
    return this.resultsService.list(user, merchantId, query)
  }
}
