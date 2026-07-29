import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type {
  AuthenticatedUser,
  OrderSummary,
  PaginatedOrders,
} from '@cross-border/shared'

import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { OrderQueryDto, UpdateOrderStatusDto } from './dto/order.dto'
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
