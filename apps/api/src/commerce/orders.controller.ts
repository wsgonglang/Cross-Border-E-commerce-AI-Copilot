import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type {
  AuthenticatedUser,
  OrderBulkOperationResult,
  OrderSavedView,
  OrderSummary,
  PaginatedOrders,
} from '@cross-border/shared'

import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import {
  BulkOrderActionDto,
  CreateOrderSavedViewDto,
  OrderQueryDto,
  UpdateOrderSavedViewDto,
  UpdateOrderStatusDto,
} from './dto/order.dto'
import { OrdersService } from './orders.service'

@ApiTags('commerce')
@ApiBearerAuth()
@Controller('api/merchants/:merchantId/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Query() query: OrderQueryDto,
  ): Promise<PaginatedOrders> {
    return this.ordersService.list(user, merchantId, query)
  }

  @Get('saved-views')
  listSavedViews(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
  ): Promise<OrderSavedView[]> {
    return this.ordersService.listSavedViews(user, merchantId)
  }

  @Post('saved-views')
  createSavedView(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Body() dto: CreateOrderSavedViewDto,
  ): Promise<OrderSavedView> {
    return this.ordersService.createSavedView(user, merchantId, dto)
  }

  @Patch('saved-views/:viewId')
  updateSavedView(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('viewId') viewId: string,
    @Body() dto: UpdateOrderSavedViewDto,
  ): Promise<OrderSavedView> {
    return this.ordersService.updateSavedView(user, merchantId, viewId, dto)
  }

  @Delete('saved-views/:viewId')
  @HttpCode(204)
  async deleteSavedView(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('viewId') viewId: string,
  ): Promise<void> {
    await this.ordersService.deleteSavedView(user, merchantId, viewId)
  }

  @Post('bulk-actions')
  @Roles('admin', 'operator')
  executeBulk(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Body() dto: BulkOrderActionDto,
  ): Promise<OrderBulkOperationResult> {
    return this.ordersService.executeBulk(user, merchantId, dto)
  }

  @Get(':orderId')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('orderId') orderId: string,
    @Query() query: OrderQueryDto,
  ): Promise<OrderSummary> {
    return this.ordersService.get(user, merchantId, orderId, query.storeId)
  }

  @Patch(':orderId/status')
  @Roles('admin', 'operator')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<OrderSummary> {
    return this.ordersService.updateStatus(user, merchantId, orderId, dto)
  }
}
