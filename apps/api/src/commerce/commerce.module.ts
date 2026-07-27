import { Module } from '@nestjs/common'

import { AuditLogsService } from './audit-logs.service'
import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'
import { MerchantAccessService } from './merchant-access.service'
import { MerchantsController } from './merchants.controller'
import { MerchantsService } from './merchants.service'
import { OrdersController } from './orders.controller'
import { OrdersService } from './orders.service'
import { ProductsController } from './products.controller'
import { ProductsService } from './products.service'
import { SkusService } from './skus.service'

@Module({
  controllers: [
    MerchantsController,
    ProductsController,
    OrdersController,
    DashboardController,
  ],
  providers: [
    AuditLogsService,
    DashboardService,
    MerchantAccessService,
    MerchantsService,
    OrdersService,
    ProductsService,
    SkusService,
  ],
})
export class CommerceModule {}
