import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type {
  AuthenticatedUser,
  ProductOptimizationSummary,
} from '@cross-border/shared'

import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { CreateProductOptimizationDto } from './dto/product-optimization.dto'
import { ProductOptimizationsService } from './product-optimizations.service'

@ApiTags('product-optimizations')
@ApiBearerAuth()
@Roles('admin', 'operator')
@Controller('api/merchants/:merchantId/products/:productId/optimizations')
export class ProductOptimizationsController {
  constructor(
    private readonly optimizationsService: ProductOptimizationsService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('productId') productId: string,
  ): Promise<ProductOptimizationSummary[]> {
    return this.optimizationsService.list(user, merchantId, productId)
  }

  @Get(':optimizationId')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('productId') productId: string,
    @Param('optimizationId') optimizationId: string,
  ): Promise<ProductOptimizationSummary> {
    return this.optimizationsService.get(
      user,
      merchantId,
      productId,
      optimizationId,
    )
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('productId') productId: string,
    @Body() dto: CreateProductOptimizationDto,
  ): Promise<ProductOptimizationSummary> {
    return this.optimizationsService.create(user, merchantId, productId, dto)
  }

  @Post(':optimizationId/apply')
  apply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('productId') productId: string,
    @Param('optimizationId') optimizationId: string,
  ): Promise<ProductOptimizationSummary> {
    return this.optimizationsService.apply(
      user,
      merchantId,
      productId,
      optimizationId,
    )
  }

  @Post(':optimizationId/reject')
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('productId') productId: string,
    @Param('optimizationId') optimizationId: string,
  ): Promise<ProductOptimizationSummary> {
    return this.optimizationsService.reject(
      user,
      merchantId,
      productId,
      optimizationId,
    )
  }
}
