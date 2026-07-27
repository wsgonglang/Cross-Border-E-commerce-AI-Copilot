import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type {
  AuthenticatedUser,
  PaginatedProducts,
  ProductSummary,
  SkuSummary,
} from '@cross-border/shared'

import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import type { AuditLogSummary } from '@cross-border/shared'
import { AuditLogsService } from './audit-logs.service'
import {
  CreateProductDto,
  ProductQueryDto,
  UpdateProductDto,
} from './dto/product.dto'
import { AdjustStockDto, CreateSkuDto, UpdateSkuDto } from './dto/sku.dto'
import { ProductsService } from './products.service'
import { SkusService } from './skus.service'

@ApiTags('catalog')
@ApiBearerAuth()
@Controller('api/merchants/:merchantId')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly skusService: SkusService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  @Get('products')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Query() query: ProductQueryDto,
  ): Promise<PaginatedProducts> {
    return this.productsService.list(user, merchantId, query)
  }

  @Get('products/:productId')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('productId') productId: string,
  ): Promise<ProductSummary> {
    return this.productsService.get(user, merchantId, productId)
  }

  @Post('products')
  @Roles('admin', 'operator')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Body() dto: CreateProductDto,
  ): Promise<ProductSummary> {
    return this.productsService.create(user, merchantId, dto)
  }

  @Patch('products/:productId')
  @Roles('admin', 'operator')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('productId') productId: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductSummary> {
    return this.productsService.update(user, merchantId, productId, dto)
  }

  @Delete('products/:productId')
  @Roles('admin', 'operator')
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('productId') productId: string,
  ): Promise<ProductSummary> {
    return this.productsService.archive(user, merchantId, productId)
  }

  @Post('products/:productId/skus')
  @Roles('admin', 'operator')
  createSku(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('productId') productId: string,
    @Body() dto: CreateSkuDto,
  ): Promise<SkuSummary> {
    return this.skusService.create(user, merchantId, productId, dto)
  }

  @Patch('skus/:skuId')
  @Roles('admin', 'operator')
  updateSku(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('skuId') skuId: string,
    @Body() dto: UpdateSkuDto,
  ): Promise<SkuSummary> {
    return this.skusService.update(user, merchantId, skuId, dto)
  }

  @Delete('skus/:skuId')
  @Roles('admin', 'operator')
  disableSku(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('skuId') skuId: string,
  ): Promise<SkuSummary> {
    return this.skusService.disable(user, merchantId, skuId)
  }

  @Patch('skus/:skuId/stock')
  @Roles('admin', 'operator')
  adjustStock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('skuId') skuId: string,
    @Body() dto: AdjustStockDto,
  ): Promise<SkuSummary> {
    return this.skusService.adjustStock(user, merchantId, skuId, dto)
  }

  @Get('audit-logs')
  @Roles('admin', 'operator')
  auditLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
  ): Promise<AuditLogSummary[]> {
    return this.auditLogsService.list(user, merchantId)
  }
}
