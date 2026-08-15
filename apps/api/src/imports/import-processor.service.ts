import { Injectable } from '@nestjs/common'
import type {
  AuthenticatedUser,
  NormalizedImportRow,
  RoleCode,
} from '@cross-border/shared'
import type { Job } from 'bullmq'

import { ProductOptimizationsService } from '../ai/product-optimizations.service'
import { ProductsService } from '../commerce/products.service'
import { SkusService } from '../commerce/skus.service'
import { PrismaService } from '../database/prisma.service'
import type { Prisma } from '../generated/prisma/client'
import type { StructuredImportJobData } from './import-queue.service'

@Injectable()
export class ImportProcessorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
    private readonly skus: SkusService,
    private readonly optimizations: ProductOptimizationsService,
  ) {}

  async process(job: Job<StructuredImportJobData>): Promise<void> {
    const initial = await this.prisma.importItem.findUnique({
      where: { id: job.data.itemId },
      include: { job: true },
    })
    if (
      !initial ||
      ['VALIDATION_FAILED', 'COMPLETED', 'FAILED', 'CANCELLED'].includes(
        initial.status,
      )
    )
      return
    if (initial.job.cancelledAt) {
      await this.cancelItem(initial.id, initial.jobId)
      return
    }
    const claimed = await this.prisma.importItem.updateMany({
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
    await this.prisma.importJob.updateMany({
      where: { id: initial.jobId, status: 'PENDING', cancelledAt: null },
      data: { status: 'RUNNING', startedAt: new Date() },
    })

    const item = await this.prisma.importItem.findUniqueOrThrow({
      where: { id: initial.id },
      include: {
        job: {
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
      id: item.job.createdBy.id,
      email: item.job.createdBy.email,
      name: item.job.createdBy.name,
      roles: item.job.createdBy.userRoles.map(
        (record) => record.role.code as RoleCode,
      ),
      merchantIds: item.job.createdBy.merchantUsers.map(
        (record) => record.merchantId,
      ),
    }
    const data = item.normalizedData as unknown as NormalizedImportRow

    try {
      const product = await this.products.upsertImportedDraft(
        actor,
        item.job.merchantId,
        {
          code: data.productCode,
          title: data.title,
          description: data.description,
          language: data.language,
        },
      )
      await this.skus.upsertImported(actor, item.job.merchantId, product.id, {
        code: data.skuCode,
        name: data.skuName,
        price: data.price,
        currency: data.currency,
        stock: data.stock,
      })
      if (item.job.mode === 'DRAFT_AND_AI' && item.job.targetLanguage) {
        await this.optimizations.createFromImport(
          actor,
          item.job.merchantId,
          product.id,
          item.job.targetLanguage as 'en-US' | 'es-ES' | 'pt-BR',
          item.id,
        )
      }
      await this.prisma.$transaction(async (transaction) => {
        const changed = await transaction.importItem.updateMany({
          where: {
            id: item.id,
            status: 'PROCESSING',
            attempts: item.attempts,
          },
          data: {
            status: 'COMPLETED',
            productId: product.id,
            completedAt: new Date(),
            error: null,
          },
        })
        if (changed.count === 1) {
          await transaction.importJob.update({
            where: { id: item.jobId },
            data: { completedItems: { increment: 1 } },
          })
          await this.finalize(transaction, item.jobId)
        }
      })
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message.slice(0, 1000) : '导入行处理失败'
      const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1)
      await this.prisma.$transaction(async (transaction) => {
        const changed = await transaction.importItem.updateMany({
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
          await transaction.importJob.update({
            where: { id: item.jobId },
            data: { failedItems: { increment: 1 } },
          })
          await this.finalize(transaction, item.jobId)
        }
      })
      throw error
    }
  }

  private async cancelItem(itemId: string, jobId: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.importItem.updateMany({
        where: { id: itemId, status: { in: ['PENDING', 'PROCESSING'] } },
        data: {
          status: 'CANCELLED',
          completedAt: new Date(),
          error: '任务已由用户取消',
        },
      })
      if (changed.count === 1) {
        await transaction.importJob.update({
          where: { id: jobId },
          data: { cancelledItems: { increment: 1 } },
        })
        await this.finalize(transaction, jobId)
      }
    })
  }

  private async finalize(
    transaction: Prisma.TransactionClient,
    jobId: string,
  ): Promise<void> {
    const job = await transaction.importJob.findUniqueOrThrow({
      where: { id: jobId },
    })
    const processed = job.completedItems + job.failedItems + job.cancelledItems
    if (processed < job.totalItems) return
    await transaction.importJob.update({
      where: { id: jobId },
      data: {
        status: job.cancelledAt
          ? 'CANCELLED'
          : job.failedItems > 0
            ? 'PARTIAL_FAILED'
            : 'COMPLETED',
        completedAt: new Date(),
      },
    })
  }
}
