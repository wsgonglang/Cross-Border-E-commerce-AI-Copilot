import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type { AiQualityReport, AuthenticatedUser } from '@cross-border/shared'

import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { AiQualityService } from './ai-quality.service'
import { AiQualityQueryDto } from './dto/ai-quality.dto'

@ApiTags('ai-quality')
@ApiBearerAuth()
@Roles('admin', 'operator')
@Controller('api/merchants/:merchantId/ai/quality')
export class AiQualityController {
  constructor(private readonly qualityService: AiQualityService) {}

  @Get()
  getReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Query() query: AiQualityQueryDto,
  ): Promise<AiQualityReport> {
    return this.qualityService.getReport(user, merchantId, query.days)
  }
}
