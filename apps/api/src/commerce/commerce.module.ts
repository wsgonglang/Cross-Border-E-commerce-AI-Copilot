import { Module } from '@nestjs/common'

import { AuditLogsService } from './audit-logs.service'
import { MerchantAccessService } from './merchant-access.service'
import { MerchantsController } from './merchants.controller'
import { MerchantsService } from './merchants.service'
import { ProductsController } from './products.controller'
import { ProductsService } from './products.service'
import { SkusService } from './skus.service'

@Module({
  controllers: [MerchantsController, ProductsController],
  providers: [
    AuditLogsService,
    MerchantAccessService,
    MerchantsService,
    ProductsService,
    SkusService,
  ],
})
export class CommerceModule {}
