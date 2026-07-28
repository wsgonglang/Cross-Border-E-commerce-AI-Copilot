import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import type {
  AuthenticatedUser,
  BatchTaskDetail,
  PaginatedBatchTasks,
} from '@cross-border/shared'

import { asJson } from '../commerce/commerce.utils'
import { MerchantAccessService } from '../commerce/merchant-access.service'
import { PrismaService } from '../database/prisma.service'
import { BatchQueueService } from './batch-queue.service'
import { toBatchTaskDetail, toBatchTaskSummary } from './batch-task.mapper'
import type {
  BatchTaskQueryDto,
  CreateBatchTaskDto,
} from './dto/batch-task.dto'

const taskDetailInclude = {
  items: {
    include: {
      product: { select: { code: true, title: true } },
      optimization: { select: { id: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} as const

@Injectable()
export class BatchTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly merchantAccess: MerchantAccessService,
    private readonly queue: BatchQueueService,
  ) {}

  async list(
    user: AuthenticatedUser,
    merchantId: string,
    query: BatchTaskQueryDto,
  ): Promise<PaginatedBatchTasks> {
    await this.merchantAccess.assertAccess(user, merchantId)
    const [tasks, total] = await this.prisma.$transaction([
      this.prisma.batchOptimizationTask.findMany({
        where: { merchantId },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.batchOptimizationTask.count({ where: { merchantId } }),
    ])
    return {
      items: tasks.map(toBatchTaskSummary),
      total,
      page: query.page,
      pageSize: query.pageSize,
    }
  }

  async get(
    user: AuthenticatedUser,
    merchantId: string,
    taskId: string,
  ): Promise<BatchTaskDetail> {
    await this.merchantAccess.assertAccess(user, merchantId)
    const task = await this.prisma.batchOptimizationTask.findFirst({
      where: { id: taskId, merchantId },
      include: taskDetailInclude,
    })
    if (!task) throw new NotFoundException('批量任务不存在')
    return toBatchTaskDetail(task)
  }

  async create(
    actor: AuthenticatedUser,
    merchantId: string,
    dto: CreateBatchTaskDto,
  ): Promise<BatchTaskDetail> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    const existing = await this.prisma.batchOptimizationTask.findUnique({
      where: {
        merchantId_idempotencyKey: {
          merchantId,
          idempotencyKey: dto.idempotencyKey,
        },
      },
      include: taskDetailInclude,
    })
    if (existing) {
      const existingProductIds = existing.items
        .map((item) => item.productId)
        .sort()
      const requestedProductIds = [...dto.productIds].sort()
      if (
        existing.targetLanguage !== dto.targetLanguage ||
        existingProductIds.join(',') !== requestedProductIds.join(',')
      ) {
        throw new ConflictException('幂等键已用于不同的批量任务参数')
      }
      await this.enqueuePending(existing.items)
      return toBatchTaskDetail(existing)
    }

    const products = await this.prisma.product.findMany({
      where: {
        merchantId,
        id: { in: dto.productIds },
        status: { not: 'ARCHIVED' },
      },
      select: { id: true },
    })
    if (products.length !== dto.productIds.length) {
      throw new BadRequestException('存在无效、跨商家或已归档商品')
    }

    const task = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.batchOptimizationTask.create({
        data: {
          merchantId,
          createdById: actor.id,
          idempotencyKey: dto.idempotencyKey,
          targetLanguage: dto.targetLanguage,
          totalItems: products.length,
          items: {
            create: products.map((product) => ({ productId: product.id })),
          },
        },
        include: taskDetailInclude,
      })
      await transaction.auditLog.create({
        data: {
          merchantId,
          actorUserId: actor.id,
          entityType: 'BATCH_AI_TASK',
          entityId: created.id,
          action: 'CREATE',
          afterData: asJson({
            targetLanguage: dto.targetLanguage,
            productIds: dto.productIds,
            totalItems: products.length,
          }),
        },
      })
      return created
    })

    await this.enqueuePending(task.items)
    return toBatchTaskDetail(task)
  }

  async cancel(
    actor: AuthenticatedUser,
    merchantId: string,
    taskId: string,
  ): Promise<BatchTaskDetail> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    const current = await this.prisma.batchOptimizationTask.findFirst({
      where: { id: taskId, merchantId },
      include: taskDetailInclude,
    })
    if (!current) throw new NotFoundException('批量任务不存在')
    if (['COMPLETED', 'PARTIAL_FAILED', 'CANCELLED'].includes(current.status)) {
      return toBatchTaskDetail(current)
    }

    const pendingIds = current.items
      .filter((item) => item.status === 'PENDING')
      .map((item) => item.id)
    await this.prisma.$transaction(async (transaction) => {
      const cancelled = await transaction.batchOptimizationItem.updateMany({
        where: { taskId, status: 'PENDING' },
        data: {
          status: 'CANCELLED',
          completedAt: new Date(),
          error: '任务已由用户取消',
        },
      })
      await transaction.batchOptimizationTask.update({
        where: { id: taskId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledItems: { increment: cancelled.count },
        },
      })
      await transaction.auditLog.create({
        data: {
          merchantId,
          actorUserId: actor.id,
          entityType: 'BATCH_AI_TASK',
          entityId: taskId,
          action: 'CANCEL',
          beforeData: asJson({ status: current.status }),
          afterData: asJson({
            status: 'CANCELLED',
            cancelledPendingItems: cancelled.count,
          }),
        },
      })
    })
    try {
      await this.queue.cancelWaiting(pendingIds)
    } catch {
      // MySQL is authoritative; a queued race will observe cancelledAt.
    }
    return this.get(actor, merchantId, taskId)
  }

  private async enqueuePending(
    items: Array<{ id: string; status: string }>,
  ): Promise<void> {
    const pending = items.filter((item) => item.status === 'PENDING')
    try {
      await this.queue.enqueue(pending)
    } catch {
      throw new ServiceUnavailableException(
        '批量任务入队失败，请使用相同幂等键重试',
      )
    }
  }
}
