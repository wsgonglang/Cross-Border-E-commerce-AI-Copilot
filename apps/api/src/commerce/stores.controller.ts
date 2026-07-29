import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type {
  AuthenticatedUser,
  ProductListingSummary,
  StoreSummary,
} from '@cross-border/shared'

import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import {
  CreateProductListingDto,
  CreateStoreDto,
  UpdateProductListingDto,
  UpdateStoreDto,
} from './dto/store.dto'
import { StoresService } from './stores.service'

@ApiTags('stores')
@ApiBearerAuth()
@Controller('api/merchants/:merchantId/stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
  ): Promise<StoreSummary[]> {
    return this.storesService.list(actor, merchantId)
  }

  @Post()
  @Roles('admin', 'operator')
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Body() dto: CreateStoreDto,
  ): Promise<StoreSummary> {
    return this.storesService.create(actor, merchantId, dto)
  }

  @Patch(':storeId')
  @Roles('admin', 'operator')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('storeId') storeId: string,
    @Body() dto: UpdateStoreDto,
  ): Promise<StoreSummary> {
    return this.storesService.update(actor, merchantId, storeId, dto)
  }

  @Get(':storeId/listings')
  listListings(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('storeId') storeId: string,
  ): Promise<ProductListingSummary[]> {
    return this.storesService.listListings(actor, merchantId, storeId)
  }

  @Post(':storeId/listings')
  @Roles('admin', 'operator')
  createListing(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('storeId') storeId: string,
    @Body() dto: CreateProductListingDto,
  ): Promise<ProductListingSummary> {
    return this.storesService.createListing(actor, merchantId, storeId, dto)
  }

  @Patch(':storeId/listings/:listingId')
  @Roles('admin', 'operator')
  updateListing(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('storeId') storeId: string,
    @Param('listingId') listingId: string,
    @Body() dto: UpdateProductListingDto,
  ): Promise<ProductListingSummary> {
    return this.storesService.updateListing(
      actor,
      merchantId,
      storeId,
      listingId,
      dto,
    )
  }
}
