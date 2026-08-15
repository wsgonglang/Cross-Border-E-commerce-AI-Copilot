import { Injectable } from '@nestjs/common'
import type { AuthenticatedUser, RoleCode } from '@cross-border/shared'
import type { Job } from 'bullmq'

import { ProductOptimizationsService } from '../ai/product-optimizations.service'
import { PrismaService } from '../database/prisma.service'
import type { Prisma } from '../generated/prisma/client'
import type { BatchOptimizationJobData } from './batch-queue.service'

@Injectable()
export class BatchProcessorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly optimizations: ProductOptimizationsService,
  ) {}

  async process(job: Job<BatchOptimizationJobData>): Promise<void> {
    const initial = await this.prisma.batchOptimizationItem.findUnique({
      where: { id: job.data.itemId },
      include: { task: true },
    })
    if (
      !initial ||
      ['COMPLETED', 'FAILED', 'CANCELLED'].includes(initial.status)
    ) {
      return
    }
    if (initial.task.cancelledAt) {
      await this.cancelItem(initial.id, initial.taskId)
      return
    }

    const claimed = await this.prisma.batchOptimizationItem.updateMany({
      where: {
        id: initial.id,
        status: 'PENDING',
        attempts: initial.attempts,
      },
      data: {
        status: 'PROCESSING',
        attempts: { increment: 1 },
        startedAt: new Date(),
        error: null,
      },
    })
    if (claimed.count !== 1) return
    await this.prisma.batchOptimizationTask.updateMany({
      where: { id: initial.taskId, status: 'PENDING', cancelledAt: null },
      data: { status: 'RUNNING', startedAt: new Date() },
    })

    const item = await this.prisma.batchOptimizationItem.findUniqueOrThrow({
      where: { id: initial.id },
      include: {
        task: {
          include: {
            createdBy: {
              include: {
                userRoles: { include: { role: true } },
                merchantUsers: true,
              },
            },
          },
        },
      },
    })
    const actor: AuthenticatedUser = {
      id: item.task.createdBy.id,
      email: item.task.createdBy.email,
      name: item.task.createdBy.name,
      roles: item.task.createdBy.userRoles.map(
        (userRole) => userRole.role.code as RoleCode,
      ),
      merchantIds: item.task.createdBy.merchantUsers.map(
        (membership) => membership.merchantId,
      ),
    }

    try {
      await this.optimizations.createFromBatch(
        actor,
        item.task.merchantId,
        item.productId,
        item.task.targetLanguage as 'en-US' | 'es-ES' | 'pt-BR',
        item.id,
      )
      await this.prisma.$transaction(async (transaction) => {
        const completed = await transaction.batchOptimizationItem.updateMany({
          where: {
            id: item.id,
            status: 'PROCESSING',
            attempts: item.attempts,
          },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            error: null,
          },
        })
        if (completed.count === 1) {
          await transaction.batchOptimizationTask.update({
            where: { id: item.taskId },
            data: { completedItems: { increment: 1 } },
          })
          await this.finalizeTask(transaction, item.taskId)
        }
      })
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message.slice(0, 1000) : '批量优化失败'
      const maxAttempts = job.opts.attempts ?? 1
      const finalAttempt = job.attemptsMade + 1 >= maxAttempts
      await this.prisma.$transaction(async (transaction) => {
        const changed = await transaction.batchOptimizationItem.updateMany({
          where: {
            id: item.id,
            status: 'PROCESSING',
            attempts: item.attempts,
          },
          data: {
            status: finalAttempt ? 'FAILED' : 'PENDING',
            error: message,
            ...(!finalAttempt ? { startedAt: null } : {}),
            ...(finalAttempt ? { completedAt: new Date() } : {}),
          },
        })
        if (changed.count === 1 && finalAttempt) {
          await transaction.batchOptimizationTask.update({
            where: { id: item.taskId },
            data: { failedItems: { increment: 1 } },
          })
          await this.finalizeTask(transaction, item.taskId)
        }
      })
      throw error
    }
  }

  private async cancelItem(itemId: string, taskId: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.batchOptimizationItem.updateMany({
        where: { id: itemId, status: { in: ['PENDING', 'PROCESSING'] } },
        data: {
          status: 'CANCELLED',
          completedAt: new Date(),
          error: '任务已由用户取消',
        },
      })
      if (changed.count === 1) {
        await transaction.batchOptimizationTask.update({
          where: { id: taskId },
          data: { cancelledItems: { increment: 1 } },
        })
        await this.finalizeTask(transaction, taskId)
      }
    })
  }

  private async finalizeTask(
    transaction: Prisma.TransactionClient,
    taskId: string,
  ): Promise<void> {
    const task = await transaction.batchOptimizationTask.findUniqueOrThrow({
      where: { id: taskId },
    })
    const processed =
      task.completedItems + task.failedItems + task.cancelledItems
    if (processed < task.totalItems) return
    await transaction.batchOptimizationTask.update({
      where: { id: taskId },
      data: {
        status: task.cancelledAt
          ? 'CANCELLED'
          : task.failedItems > 0
            ? 'PARTIAL_FAILED'
            : 'COMPLETED',
        completedAt: new Date(),
      },
    })
  }
}
