import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type {
  AuthenticatedUser,
  OrderBulkAction,
  OrderBulkOperationResult,
  OrderFilters,
  OrderSavedView,
  OrderStatus,
  OrderSummary,
  OrderViewColumn,
  PaginatedOrders,
} from '@cross-border/shared'
import { createHash } from 'node:crypto'

import { PrismaService } from '../database/prisma.service'
import type { Prisma } from '../generated/prisma/client'
import {
  asJson,
  rethrowUniqueConstraint,
  toOrderSummary,
  type OrderSource,
} from './commerce.utils'
import type {
  BulkOrderActionDto,
  CreateOrderSavedViewDto,
  OrderQueryDto,
  UpdateOrderSavedViewDto,
  UpdateOrderStatusDto,
} from './dto/order.dto'
import { MerchantAccessService } from './merchant-access.service'

const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['COMPLETED', 'REFUNDING'],
  COMPLETED: ['REFUNDING'],
  REFUNDING: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
}

const actionTargets: Record<OrderBulkAction, OrderStatus> = {
  CONFIRM: 'CONFIRMED',
  MARK_SHIPPED: 'SHIPPED',
  MARK_DELIVERED: 'DELIVERED',
  CANCEL: 'CANCELLED',
  START_REFUND: 'REFUNDING',
  CONFIRM_REFUND: 'REFUNDED',
}

const defaultColumns: OrderViewColumn[] = [
  'store',
  'orderNo',
  'customer',
  'amount',
  'status',
  'paymentStatus',
  'fulfillmentStatus',
  'createdAt',
]

const orderInclude = {
  items: { orderBy: { productName: 'asc' as const } },
  store: {
    select: { id: true, code: true, name: true, platform: true },
  },
} as const

const orderDetailInclude = {
  ...orderInclude,
  events: {
    orderBy: { createdAt: 'desc' as const },
    include: { actor: { select: { name: true } } },
  },
} as const

const bulkInclude = {
  items: {
    orderBy: { createdAt: 'asc' as const },
    include: { order: { select: { orderNo: true } } },
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
    this.assertRange(query)
    const statuses = query.statuses?.length
      ? query.statuses
      : query.status
        ? [query.status]
        : undefined
    const where: Prisma.OrderWhereInput = {
      merchantId,
      ...(statuses ? { status: { in: statuses } } : {}),
      ...(query.paymentStatuses?.length
        ? { paymentStatus: { in: query.paymentStatuses } }
        : {}),
      ...(query.fulfillmentStatuses?.length
        ? { fulfillmentStatus: { in: query.fulfillmentStatuses } }
        : {}),
      ...(query.storeId ? { storeId: query.storeId } : {}),
      ...(query.keyword
        ? {
            OR: [
              { orderNo: { contains: query.keyword } },
              { customerName: { contains: query.keyword } },
            ],
          }
        : {}),
      ...(query.startDate || query.endDate
        ? {
            createdAt: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
      ...(query.minAmount || query.maxAmount
        ? {
            totalAmount: {
              ...(query.minAmount ? { gte: query.minAmount } : {}),
              ...(query.maxAmount ? { lte: query.maxAmount } : {}),
            },
          }
        : {}),
    }
    const orderBy = {
      [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc',
    } as Prisma.OrderOrderByWithRelationInput
    const [orders, total] = (await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy,
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
    storeId?: string,
  ): Promise<OrderSummary> {
    await this.merchantAccess.assertAccess(user, merchantId)
    const order = (await this.prisma.order.findFirst({
      where: { id: orderId, merchantId, ...(storeId ? { storeId } : {}) },
      include: orderDetailInclude,
    })) as OrderSource | null
    if (!order) throw new NotFoundException('订单不存在')
    return toOrderSummary(order)
  }

  updateStatus(
    actor: AuthenticatedUser,
    merchantId: string,
    orderId: string,
    dto: UpdateOrderStatusDto,
  ): Promise<OrderSummary> {
    return this.transition(actor, merchantId, orderId, dto.status)
  }

  async listSavedViews(
    actor: AuthenticatedUser,
    merchantId: string,
  ): Promise<OrderSavedView[]> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    const records = await this.prisma.orderSavedView.findMany({
      where: { merchantId, userId: actor.id },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    })
    return records.map(toSavedView)
  }

  async createSavedView(
    actor: AuthenticatedUser,
    merchantId: string,
    dto: CreateOrderSavedViewDto,
  ): Promise<OrderSavedView> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    this.assertRange(dto)
    const filters = this.filtersFromView(dto)
    try {
      const record = await this.prisma.$transaction(async (transaction) => {
        if (dto.isDefault) {
          await transaction.orderSavedView.updateMany({
            where: { merchantId, userId: actor.id, isDefault: true },
            data: { isDefault: false },
          })
        }
        return transaction.orderSavedView.create({
          data: {
            merchantId,
            userId: actor.id,
            name: dto.name.trim(),
            filters: asJson(filters),
            sortBy: dto.sortBy ?? 'createdAt',
            sortOrder: dto.sortOrder ?? 'desc',
            columns: asJson(dto.columns ?? defaultColumns),
            isDefault: dto.isDefault ?? false,
          },
        })
      })
      return toSavedView(record)
    } catch (error: unknown) {
      rethrowUniqueConstraint(error, '同名订单视图已存在')
    }
  }

  async updateSavedView(
    actor: AuthenticatedUser,
    merchantId: string,
    viewId: string,
    dto: UpdateOrderSavedViewDto,
  ): Promise<OrderSavedView> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    const current = await this.prisma.orderSavedView.findFirst({
      where: { id: viewId, merchantId, userId: actor.id },
    })
    if (!current) throw new NotFoundException('订单视图不存在')
    this.assertRange(dto)
    const currentFilters = readFilters(current.filters)
    const replacesFilters = [
      'keyword',
      'statuses',
      'paymentStatuses',
      'fulfillmentStatuses',
      'storeId',
      'startDate',
      'endDate',
      'minAmount',
      'maxAmount',
    ].some((key) => key in dto)
    const nextFilters = replacesFilters
      ? this.filtersFromView(dto)
      : currentFilters
    try {
      const record = await this.prisma.$transaction(async (transaction) => {
        if (dto.isDefault) {
          await transaction.orderSavedView.updateMany({
            where: {
              merchantId,
              userId: actor.id,
              isDefault: true,
              id: { not: viewId },
            },
            data: { isDefault: false },
          })
        }
        return transaction.orderSavedView.update({
          where: { id: viewId },
          data: {
            ...(dto.name ? { name: dto.name.trim() } : {}),
            filters: asJson(nextFilters),
            ...(dto.sortBy ? { sortBy: dto.sortBy } : {}),
            ...(dto.sortOrder ? { sortOrder: dto.sortOrder } : {}),
            ...(dto.columns ? { columns: asJson(dto.columns) } : {}),
            ...(dto.isDefault !== undefined
              ? { isDefault: dto.isDefault }
              : {}),
          },
        })
      })
      return toSavedView(record)
    } catch (error: unknown) {
      rethrowUniqueConstraint(error, '同名订单视图已存在')
    }
  }

  async deleteSavedView(
    actor: AuthenticatedUser,
    merchantId: string,
    viewId: string,
  ): Promise<void> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    const deleted = await this.prisma.orderSavedView.deleteMany({
      where: { id: viewId, merchantId, userId: actor.id },
    })
    if (deleted.count !== 1) throw new NotFoundException('订单视图不存在')
  }

  async executeBulk(
    actor: AuthenticatedUser,
    merchantId: string,
    dto: BulkOrderActionDto,
  ): Promise<OrderBulkOperationResult> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    this.assertCanWrite(actor)
    const orderIds = [...dto.orderIds].sort()
    const payloadHash = createHash('sha256')
      .update(JSON.stringify({ action: dto.action, orderIds }))
      .digest('hex')
    let operation = await this.prisma.orderBulkOperation.findUnique({
      where: {
        merchantId_idempotencyKey: {
          merchantId,
          idempotencyKey: dto.idempotencyKey,
        },
      },
      include: bulkInclude,
    })
    if (operation) {
      if (
        operation.payloadHash !== payloadHash ||
        operation.action !== dto.action
      )
        throw new ConflictException('幂等键已用于不同的批量操作')
      if (operation.status !== 'RUNNING') return toBulkResult(operation)
    } else {
      const orders = await this.prisma.order.findMany({
        where: { merchantId, id: { in: orderIds } },
        select: { id: true },
      })
      const available = new Set(orders.map((order) => order.id))
      try {
        operation = await this.prisma.orderBulkOperation.create({
          data: {
            merchantId,
            createdById: actor.id,
            idempotencyKey: dto.idempotencyKey,
            payloadHash,
            action: dto.action,
            totalItems: orderIds.length,
            failedItems: orderIds.filter((id) => !available.has(id)).length,
            items: {
              create: orderIds.map((requestedOrderId) => ({
                requestedOrderId,
                ...(available.has(requestedOrderId)
                  ? { orderId: requestedOrderId }
                  : {
                      status: 'FAILED' as const,
                      error: '订单不存在或不属于当前商家',
                    }),
              })),
            },
          },
          include: bulkInclude,
        })
      } catch (error: unknown) {
        if (!isUniqueConstraint(error)) throw error
        operation = await this.prisma.orderBulkOperation.findUniqueOrThrow({
          where: {
            merchantId_idempotencyKey: {
              merchantId,
              idempotencyKey: dto.idempotencyKey,
            },
          },
          include: bulkInclude,
        })
        if (
          operation.payloadHash !== payloadHash ||
          operation.action !== dto.action
        )
          throw new ConflictException('幂等键已用于不同的批量操作')
      }
    }

    for (const item of operation.items) {
      if (item.status !== 'PENDING' || !item.orderId) continue
      try {
        await this.transition(
          actor,
          merchantId,
          item.orderId,
          actionTargets[dto.action],
          item.id,
          operation.id,
        )
      } catch (error: unknown) {
        await this.prisma.orderBulkItem.updateMany({
          where: { id: item.id, status: 'PENDING' },
          data: {
            status: 'FAILED',
            error:
              error instanceof Error
                ? error.message.slice(0, 500)
                : '批量操作失败',
          },
        })
      }
    }

    const items = await this.prisma.orderBulkItem.findMany({
      where: { operationId: operation.id },
      include: { order: { select: { orderNo: true } } },
      orderBy: { createdAt: 'asc' },
    })
    const succeededItems = items.filter(
      (item) => item.status === 'SUCCEEDED',
    ).length
    const failedItems = items.filter((item) => item.status === 'FAILED').length
    const final = await this.prisma.orderBulkOperation.update({
      where: { id: operation.id },
      data: {
        status: failedItems > 0 ? 'PARTIAL_FAILED' : 'COMPLETED',
        succeededItems,
        failedItems,
        completedAt: new Date(),
      },
      include: bulkInclude,
    })
    await this.prisma.auditLog.create({
      data: {
        merchantId,
        actorUserId: actor.id,
        entityType: 'ORDER_BULK',
        entityId: operation.id,
        action: dto.action,
        afterData: asJson({ succeededItems, failedItems, orderIds }),
      },
    })
    return toBulkResult(final)
  }

  private async transition(
    actor: AuthenticatedUser,
    merchantId: string,
    orderId: string,
    targetStatus: OrderStatus,
    bulkItemId?: string,
    bulkOperationId?: string,
  ): Promise<OrderSummary> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    this.assertCanWrite(actor)
    return this.prisma.$transaction(async (transaction) => {
      const order = (await transaction.order.findFirst({
        where: { id: orderId, merchantId },
        include: orderInclude,
      })) as OrderSource | null
      if (!order) throw new NotFoundException('订单不存在')
      const currentStatus = order.status as OrderStatus
      if (!allowedTransitions[currentStatus].includes(targetStatus)) {
        throw new BadRequestException(
          `订单状态不能从 ${currentStatus} 变更为 ${targetStatus}`,
        )
      }
      if (
        ['COMPLETED', 'REFUNDING', 'REFUNDED'].includes(targetStatus) &&
        !actor.roles.includes('admin')
      ) {
        throw new ForbiddenException('仅管理员可执行此操作')
      }
      const dimensions = transitionDimensions(
        targetStatus,
        order.totalAmount.toString(),
      )
      const changed = await transaction.order.updateMany({
        where: {
          id: orderId,
          merchantId,
          version: order.version ?? 1,
          status: currentStatus,
        },
        data: {
          status: targetStatus,
          ...dimensions,
          version: { increment: 1 },
        },
      })
      if (changed.count !== 1)
        throw new ConflictException('订单已被其他操作更新，请刷新后重试')

      const eventType = bulkOperationId
        ? ('BULK_OPERATION' as const)
        : ('STATUS_CHANGED' as const)
      await transaction.orderEvent.create({
        data: {
          merchantId,
          orderId,
          actorUserId: actor.id,
          type: eventType,
          title: `订单状态变更为 ${targetStatus}`,
          description: bulkOperationId ? '通过批量操作执行' : '人工单笔操作',
          metadata: asJson({
            fromStatus: currentStatus,
            toStatus: targetStatus,
            ...(bulkOperationId ? { bulkOperationId } : {}),
          }),
        },
      })
      await transaction.auditLog.create({
        data: {
          merchantId,
          actorUserId: actor.id,
          entityType: 'ORDER',
          entityId: orderId,
          action: 'STATUS_CHANGE',
          beforeData: asJson({ status: currentStatus }),
          afterData: asJson({ status: targetStatus, ...dimensions }),
        },
      })
      if (bulkItemId) {
        await transaction.orderBulkItem.update({
          where: { id: bulkItemId },
          data: {
            status: 'SUCCEEDED',
            fromStatus: currentStatus,
            toStatus: targetStatus,
            error: null,
          },
        })
      }
      const updated = (await transaction.order.findUniqueOrThrow({
        where: { id: orderId },
        include: orderDetailInclude,
      })) as OrderSource
      return toOrderSummary(updated)
    })
  }

  private assertCanWrite(actor: AuthenticatedUser): void {
    if (!actor.roles.includes('admin') && !actor.roles.includes('operator')) {
      throw new ForbiddenException('无权修改订单状态')
    }
  }

  private assertRange(input: {
    startDate?: string
    endDate?: string
    minAmount?: string
    maxAmount?: string
  }): void {
    if (
      input.startDate &&
      input.endDate &&
      new Date(input.startDate) > new Date(input.endDate)
    )
      throw new BadRequestException('开始时间不能晚于结束时间')
    if (
      input.minAmount &&
      input.maxAmount &&
      Number(input.minAmount) > Number(input.maxAmount)
    )
      throw new BadRequestException('最小金额不能大于最大金额')
  }

  private filtersFromView(dto: Partial<CreateOrderSavedViewDto>): OrderFilters {
    return {
      ...(dto.keyword !== undefined ? { keyword: dto.keyword } : {}),
      ...(dto.statuses !== undefined ? { statuses: dto.statuses } : {}),
      ...(dto.paymentStatuses !== undefined
        ? { paymentStatuses: dto.paymentStatuses }
        : {}),
      ...(dto.fulfillmentStatuses !== undefined
        ? { fulfillmentStatuses: dto.fulfillmentStatuses }
        : {}),
      ...(dto.storeId !== undefined ? { storeId: dto.storeId } : {}),
      ...(dto.startDate !== undefined ? { startDate: dto.startDate } : {}),
      ...(dto.endDate !== undefined ? { endDate: dto.endDate } : {}),
      ...(dto.minAmount !== undefined ? { minAmount: dto.minAmount } : {}),
      ...(dto.maxAmount !== undefined ? { maxAmount: dto.maxAmount } : {}),
    }
  }
}

function transitionDimensions(
  targetStatus: OrderStatus,
  totalAmount: string,
): Prisma.OrderUpdateManyMutationInput {
  switch (targetStatus) {
    case 'CONFIRMED':
      return { paymentStatus: 'PAID', fulfillmentStatus: 'PROCESSING' }
    case 'SHIPPED':
      return { fulfillmentStatus: 'SHIPPED' }
    case 'DELIVERED':
      return { fulfillmentStatus: 'DELIVERED' }
    case 'CANCELLED':
      return { fulfillmentStatus: 'CANCELLED' }
    case 'REFUNDED':
      return { paymentStatus: 'REFUNDED', refundAmount: totalAmount }
    default:
      return {}
  }
}

function readFilters(value: unknown): OrderFilters {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value
    : {}
}

function toSavedView(record: {
  id: string
  merchantId: string
  userId: string
  name: string
  filters: unknown
  sortBy: string
  sortOrder: string
  columns: unknown
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}): OrderSavedView {
  const columns = Array.isArray(record.columns)
    ? record.columns.filter(
        (column): column is OrderViewColumn => typeof column === 'string',
      )
    : defaultColumns
  return {
    ...record,
    filters: readFilters(record.filters),
    sortBy: record.sortBy as OrderSavedView['sortBy'],
    sortOrder: record.sortOrder as OrderSavedView['sortOrder'],
    columns,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

function toBulkResult(record: {
  id: string
  action: string
  status: string
  totalItems: number
  succeededItems: number
  failedItems: number
  createdAt: Date
  completedAt: Date | null
  items: Array<{
    id: string
    requestedOrderId: string
    status: string
    fromStatus: string | null
    toStatus: string | null
    error: string | null
    order: { orderNo: string } | null
  }>
}): OrderBulkOperationResult {
  return {
    id: record.id,
    action: record.action as OrderBulkOperationResult['action'],
    status: record.status as OrderBulkOperationResult['status'],
    totalItems: record.totalItems,
    succeededItems: record.succeededItems,
    failedItems: record.failedItems,
    items: record.items.map((item) => ({
      id: item.id,
      orderId: item.requestedOrderId,
      orderNo: item.order?.orderNo ?? item.requestedOrderId,
      status:
        item.status as OrderBulkOperationResult['items'][number]['status'],
      fromStatus:
        item.fromStatus as OrderBulkOperationResult['items'][number]['fromStatus'],
      toStatus:
        item.toStatus as OrderBulkOperationResult['items'][number]['toStatus'],
      error: item.error,
    })),
    createdAt: record.createdAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
  }
}

function isUniqueConstraint(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  )
}
