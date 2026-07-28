import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type {
  AuthenticatedUser,
  OrderSummary,
  PaginatedOrders,
} from '@cross-border/shared'

import { PrismaService } from '../database/prisma.service'
import { toOrderSummary } from './commerce.utils'
import type { OrderSource } from './commerce.utils'
import type { OrderQueryDto, UpdateOrderStatusDto } from './dto/order.dto'
import { MerchantAccessService } from './merchant-access.service'

const allowedTransitions: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['COMPLETED', 'REFUNDING'],
  COMPLETED: ['REFUNDING'],
  REFUNDING: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
}

const orderInclude = {
  items: {
    orderBy: { productName: 'asc' as const },
  },
} as const

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly merchantAccess: MerchantAccessService,
  ) {}

  async list(
    user: AuthenticatedUser,
    merchantId: string,
    query: OrderQueryDto,
  ): Promise<PaginatedOrders> {
    await this.merchantAccess.assertAccess(user, merchantId)
    const where: Record<string, unknown> = { merchantId }
    if (query.status) {
      where.status = query.status
    }
    if (query.keyword) {
      where.orderNo = { contains: query.keyword }
    }
    const [orders, total] = (await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.order.count({ where }),
    ])) as [OrderSource[], number]

    return {
      items: orders.map(toOrderSummary),
      total,
      page: query.page,
      pageSize: query.pageSize,
    }
  }

  async get(
    user: AuthenticatedUser,
    merchantId: string,
    orderId: string,
  ): Promise<OrderSummary> {
    await this.merchantAccess.assertAccess(user, merchantId)
    const order = (await this.prisma.order.findFirst({
      where: { id: orderId, merchantId },
      include: orderInclude,
    })) as OrderSource | null
    if (!order) {
      throw new NotFoundException('订单不存在')
    }
    return toOrderSummary(order)
  }

  async updateStatus(
    actor: AuthenticatedUser,
    merchantId: string,
    orderId: string,
    dto: UpdateOrderStatusDto,
  ): Promise<OrderSummary> {
    await this.merchantAccess.assertAccess(actor, merchantId)

    const isAdmin = actor.roles.includes('admin')
    const isOperator = actor.roles.includes('operator')
    if (!isAdmin && !isOperator) {
      throw new ForbiddenException('无权修改订单状态')
    }

    const order = (await this.prisma.order.findFirst({
      where: { id: orderId, merchantId },
      include: orderInclude,
    })) as OrderSource | null
    if (!order) {
      throw new NotFoundException('订单不存在')
    }

    const currentStatus = order.status
    const targetStatus = dto.status

    // Validate allowed transition from current status
    const possible = allowedTransitions[currentStatus]
    if (!possible || !possible.includes(targetStatus)) {
      throw new BadRequestException(
        `订单状态不能从 ${currentStatus} 变更为 ${targetStatus}`,
      )
    }

    // Validate role permissions:
    // - operator can CONFIRM, SHIP, DELIVER
    // - admin can do all including COMPLETE, CANCEL, REFUND
    const restrictedToAdmin = ['COMPLETED', 'REFUNDING', 'REFUNDED']
    if (restrictedToAdmin.includes(targetStatus) && !isAdmin) {
      throw new ForbiddenException('仅管理员可执行此操作')
    }

    const updated = (await this.prisma.order.update({
      where: { id: orderId },
      data: { status: targetStatus },
      include: orderInclude,
    })) as OrderSource

    return toOrderSummary(updated)
  }
}
