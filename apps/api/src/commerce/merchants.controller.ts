import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type { AuthenticatedUser, MerchantSummary } from '@cross-border/shared'

import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { CreateMerchantDto, UpdateMerchantDto } from './dto/merchant.dto'
import { MerchantsService } from './merchants.service'

@ApiTags('merchants')
@ApiBearerAuth()
@Controller('api/merchants')
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<MerchantSummary[]> {
    return this.merchantsService.list(user)
  }

  @Post()
  @Roles('admin')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMerchantDto,
  ): Promise<MerchantSummary> {
    return this.merchantsService.create(user, dto)
  }

  @Patch(':merchantId')
  @Roles('admin')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Body() dto: UpdateMerchantDto,
  ): Promise<MerchantSummary> {
    return this.merchantsService.update(user, merchantId, dto)
  }

  @Delete(':merchantId')
  @Roles('admin')
  disable(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
  ): Promise<MerchantSummary> {
    return this.merchantsService.disable(user, merchantId)
  }
}
