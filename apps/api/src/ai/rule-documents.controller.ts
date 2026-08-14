import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type {
  AuthenticatedUser,
  RuleDocumentDetail,
  RuleDocumentSummary,
  RuleSearchResult,
} from '@cross-border/shared'

import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import {
  ImportRuleDocumentDto,
  SearchRuleDocumentsDto,
} from './dto/rule-document.dto'
import { PlatformRulesService } from './platform-rules.service'

@ApiTags('rule-knowledge')
@ApiBearerAuth()
@Controller('api/merchants/:merchantId/rule-documents')
export class RuleDocumentsController {
  constructor(private readonly rulesService: PlatformRulesService) {}

  @Get()
  @Roles('admin')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
  ): Promise<RuleDocumentSummary[]> {
    return this.rulesService.list(user, merchantId)
  }

  @Get(':documentId')
  @Roles('admin')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('documentId') documentId: string,
  ): Promise<RuleDocumentDetail> {
    return this.rulesService.get(user, merchantId, documentId)
  }

  @Post()
  @Roles('admin')
  import(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Body() dto: ImportRuleDocumentDto,
  ): Promise<RuleDocumentDetail> {
    return this.rulesService.import(user, merchantId, dto)
  }

  @Post('search')
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Body() dto: SearchRuleDocumentsDto,
  ): Promise<RuleSearchResult> {
    return this.rulesService.search(user, merchantId, dto)
  }

  @Patch(':documentId/archive')
  @Roles('admin')
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('documentId') documentId: string,
  ): Promise<RuleDocumentSummary> {
    return this.rulesService.archive(user, merchantId, documentId)
  }
}
