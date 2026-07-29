import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import type {
  AuthenticatedUser,
  DashboardOrderData,
  DashboardOverview,
  DashboardSalesData,
  DashboardTrend,
} from '@cross-border/shared'

import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { DashboardService } from './dashboard.service'
import { DashboardQueryDto } from './dto/order.dto'

@ApiTags('commerce')
@ApiBearerAuth()
@Controller('api/merchants/:merchantId/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  getOverview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Query() query: DashboardQueryDto,
  ): Promise<DashboardOverview> {
    return this.dashboardService.getOverview(user, merchantId, query.storeId)
  }

  @Get('trend')
  getTrend(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Query() query: DashboardQueryDto,
  ): Promise<DashboardTrend> {
    return this.dashboardService.getTrend(user, merchantId, query.storeId)
  }

  @Get('sales')
  getSalesData(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Query() query: DashboardQueryDto,
  ): Promise<DashboardSalesData> {
    return this.dashboardService.getSalesData(
      user,
      merchantId,
      query.days,
      query.storeId,
    )
  }

  @Get('orders')
  getOrderData(
    @CurrentUser() user: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Query() query: DashboardQueryDto,
  ): Promise<DashboardOrderData> {
    return this.dashboardService.getOrderData(
      user,
      merchantId,
      query.days,
      query.storeId,
    )
  }
}
