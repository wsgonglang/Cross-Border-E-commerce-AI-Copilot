import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type {
  AuthenticatedUser,
  ProductOptimizationSource,
  ProductOptimizationSummary,
} from '@cross-border/shared'

import { asJson, toStringArray } from '../commerce/commerce.utils'
import { MerchantAccessService } from '../commerce/merchant-access.service'
import { ProductsService } from '../commerce/products.service'
import { PrismaService } from '../database/prisma.service'
import { AI_PROVIDER, type AiProvider } from './ai-provider.service'
import type { CreateProductOptimizationDto } from './dto/product-optimization.dto'
import { toProductOptimizationSummary } from './product-optimization.mapper'

@Injectable()
export class ProductOptimizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly merchantAccess: MerchantAccessService,
    private readonly productsService: ProductsService,
    @Inject(AI_PROVIDER) private readonly aiProvider: AiProvider,
  ) {}

  async list(
    user: AuthenticatedUser,
    merchantId: string,
    productId: string,
  ): Promise<ProductOptimizationSummary[]> {
    await this.merchantAccess.assertAccess(user, merchantId)
    const records = await this.prisma.productOptimization.findMany({
      where: { merchantId, productId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return records.map(toProductOptimizationSummary)
  }

  async get(
    user: AuthenticatedUser,
    merchantId: string,
    productId: string,
    optimizationId: string,
  ): Promise<ProductOptimizationSummary> {
    await this.merchantAccess.assertAccess(user, merchantId)
    const record = await this.prisma.productOptimization.findFirst({
      where: { id: optimizationId, merchantId, productId },
    })
    if (!record) {
      throw new NotFoundException('商品优化记录不存在')
    }
    return toProductOptimizationSummary(record)
  }

  async create(
    actor: AuthenticatedUser,
    merchantId: string,
    productId: string,
    dto: CreateProductOptimizationDto,
  ): Promise<ProductOptimizationSummary> {
    return this.createInternal(actor, merchantId, productId, dto.targetLanguage)
  }

  async createFromBatch(
    actor: AuthenticatedUser,
    merchantId: string,
    productId: string,
    targetLanguage: CreateProductOptimizationDto['targetLanguage'],
    batchItemId: string,
  ): Promise<ProductOptimizationSummary> {
    return this.createInternal(
      actor,
      merchantId,
      productId,
      targetLanguage,
      batchItemId,
    )
  }

  private async createInternal(
    actor: AuthenticatedUser,
    merchantId: string,
    productId: string,
    targetLanguage: CreateProductOptimizationDto['targetLanguage'],
    batchItemId?: string,
  ): Promise<ProductOptimizationSummary> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    const product = await this.prisma.product.findFirst({
      where: { id: productId, merchantId, status: { not: 'ARCHIVED' } },
    })
    if (!product) {
      throw new NotFoundException('可优化商品不存在')
    }

    const source: ProductOptimizationSource = {
      title: product.title,
      description: product.description,
      sellingPoints: toStringArray(product.sellingPoints),
      language: product.language,
      version: product.version,
    }
    const existing = batchItemId
      ? await this.prisma.productOptimization.findUnique({
          where: { batchItemId },
        })
      : null
    if (
      existing &&
      ['DRAFT', 'APPLIED', 'REJECTED'].includes(existing.status)
    ) {
      return toProductOptimizationSummary(existing)
    }
    const pending = existing
      ? await this.prisma.productOptimization.update({
          where: { id: existing.id },
          data: {
            status: 'GENERATING',
            error: null,
            targetLanguage,
            baseProductVersion: product.version,
            sourceData: asJson(source),
            providerName: this.aiProvider.name,
            modelName: this.aiProvider.model,
          },
        })
      : await this.prisma.productOptimization.create({
          data: {
            merchantId,
            productId,
            requestedById: actor.id,
            targetLanguage,
            baseProductVersion: product.version,
            sourceData: asJson(source),
            providerName: this.aiProvider.name,
            modelName: this.aiProvider.model,
            batchItemId,
          },
        })

    try {
      const result = await this.aiProvider.optimizeProduct({
        source,
        targetLanguage,
      })
      if (result.draft.language !== targetLanguage) {
        throw new Error('模型返回的草稿语言与目标语言不一致')
      }

      const completed = await this.prisma.$transaction(async (transaction) => {
        const updated = await transaction.productOptimization.update({
          where: { id: pending.id },
          data: {
            status: 'DRAFT',
            draftData: asJson(result.draft),
            promptTokens: result.usage.promptTokens,
            completionTokens: result.usage.completionTokens,
            totalTokens: result.usage.totalTokens,
          },
        })
        await transaction.auditLog.create({
          data: {
            merchantId,
            actorUserId: actor.id,
            entityType: 'PRODUCT_OPTIMIZATION',
            entityId: pending.id,
            action: 'CREATE_DRAFT',
            afterData: asJson({
              productId,
              targetLanguage,
              draft: result.draft,
              usage: result.usage,
            }),
          },
        })
        return updated
      })
      return toProductOptimizationSummary(completed)
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message.slice(0, 1000) : '未知模型错误'
      await this.prisma.productOptimization.update({
        where: { id: pending.id },
        data: { status: 'ERROR', error: message },
      })
      throw new BadGatewayException('AI 商品优化失败，请稍后重试')
    }
  }

  async apply(
    actor: AuthenticatedUser,
    merchantId: string,
    productId: string,
    optimizationId: string,
  ): Promise<ProductOptimizationSummary> {
    await this.productsService.applyOptimizationDraft(
      actor,
      merchantId,
      productId,
      optimizationId,
    )
    return this.get(actor, merchantId, productId, optimizationId)
  }

  async reject(
    actor: AuthenticatedUser,
    merchantId: string,
    productId: string,
    optimizationId: string,
  ): Promise<ProductOptimizationSummary> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    const record = await this.prisma.productOptimization.findFirst({
      where: { id: optimizationId, merchantId, productId },
    })
    if (!record) {
      throw new NotFoundException('商品优化记录不存在')
    }
    if (record.status === 'REJECTED') {
      return toProductOptimizationSummary(record)
    }
    if (record.status !== 'DRAFT') {
      throw new BadRequestException('只有待确认草稿可以拒绝')
    }
    const rejected = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.productOptimization.update({
        where: { id: optimizationId },
        data: { status: 'REJECTED' },
      })
      await transaction.auditLog.create({
        data: {
          merchantId,
          actorUserId: actor.id,
          entityType: 'PRODUCT_OPTIMIZATION',
          entityId: optimizationId,
          action: 'REJECT',
          beforeData: asJson({ status: 'DRAFT' }),
          afterData: asJson({ status: 'REJECTED' }),
        },
      })
      return updated
    })
    return toProductOptimizationSummary(rejected)
  }
}
