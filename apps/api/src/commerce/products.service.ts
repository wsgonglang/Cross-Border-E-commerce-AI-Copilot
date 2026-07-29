import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type {
  AuthenticatedUser,
  PaginatedProducts,
  ProductSummary,
} from '@cross-border/shared'
import { productOptimizationDraftSchema } from '@cross-border/shared'

import { PrismaService } from '../database/prisma.service'
import {
  asJson,
  rethrowUniqueConstraint,
  toProductSummary,
} from './commerce.utils'
import type {
  CreateProductDto,
  ProductQueryDto,
  UpdateProductDto,
} from './dto/product.dto'
import { MerchantAccessService } from './merchant-access.service'

const productInclude = {
  skus: {
    orderBy: { createdAt: 'asc' as const },
  },
} as const

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly merchantAccess: MerchantAccessService,
  ) {}

  async list(
    user: AuthenticatedUser,
    merchantId: string,
    query: ProductQueryDto,
  ): Promise<PaginatedProducts> {
    await this.merchantAccess.assertAccess(user, merchantId)
    const where = {
      merchantId,
      ...(query.storeId
        ? {
            listings: {
              some: { storeId: query.storeId, merchantId },
            },
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword
        ? {
            OR: [
              { code: { contains: query.keyword } },
              { title: { contains: query.keyword } },
              {
                skus: {
                  some: { code: { contains: query.keyword } },
                },
              },
            ],
          }
        : {}),
    }
    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.product.count({ where }),
    ])

    return {
      items: products.map(toProductSummary),
      total,
      page: query.page,
      pageSize: query.pageSize,
    }
  }

  async get(
    user: AuthenticatedUser,
    merchantId: string,
    productId: string,
  ): Promise<ProductSummary> {
    await this.merchantAccess.assertAccess(user, merchantId)
    const product = await this.prisma.product.findFirst({
      where: { id: productId, merchantId },
      include: productInclude,
    })
    if (!product) {
      throw new NotFoundException('商品不存在')
    }
    return toProductSummary(product)
  }

  async create(
    actor: AuthenticatedUser,
    merchantId: string,
    dto: CreateProductDto,
  ): Promise<ProductSummary> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const product = await transaction.product.create({
          data: { ...dto, merchantId },
          include: productInclude,
        })
        const summary = toProductSummary(product)
        await transaction.auditLog.create({
          data: {
            merchantId,
            actorUserId: actor.id,
            entityType: 'PRODUCT',
            entityId: product.id,
            action: 'CREATE',
            afterData: asJson(summary),
          },
        })
        return summary
      })
    } catch (error: unknown) {
      rethrowUniqueConstraint(error, '当前商家的商品编码已存在')
    }
  }

  async upsertImportedDraft(
    actor: AuthenticatedUser,
    merchantId: string,
    dto: Omit<CreateProductDto, 'status'>,
  ): Promise<ProductSummary> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    const current = await this.prisma.product.findFirst({
      where: { merchantId, code: dto.code },
      select: { id: true, status: true },
    })
    if (!current) {
      return this.create(actor, merchantId, { ...dto, status: 'DRAFT' })
    }
    if (current.status !== 'DRAFT') {
      throw new ConflictException('同编码正式商品已存在，不允许通过导入覆盖')
    }
    return this.update(actor, merchantId, current.id, {
      title: dto.title,
      description: dto.description,
      language: dto.language,
      status: 'DRAFT',
    })
  }

  async update(
    actor: AuthenticatedUser,
    merchantId: string,
    productId: string,
    dto: UpdateProductDto,
  ): Promise<ProductSummary> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.product.findFirst({
        where: { id: productId, merchantId },
        include: productInclude,
      })
      if (!current) {
        throw new NotFoundException('商品不存在')
      }

      const updated = await transaction.product.update({
        where: { id: productId },
        data: {
          ...dto,
          version: { increment: 1 },
        },
        include: productInclude,
      })
      const before = toProductSummary(current)
      const after = toProductSummary(updated)
      await transaction.auditLog.create({
        data: {
          merchantId,
          actorUserId: actor.id,
          entityType: 'PRODUCT',
          entityId: productId,
          action: 'UPDATE',
          beforeData: asJson(before),
          afterData: asJson(after),
        },
      })
      return after
    })
  }

  archive(
    actor: AuthenticatedUser,
    merchantId: string,
    productId: string,
  ): Promise<ProductSummary> {
    return this.update(actor, merchantId, productId, { status: 'ARCHIVED' })
  }

  async applyOptimizationDraft(
    actor: AuthenticatedUser,
    merchantId: string,
    productId: string,
    optimizationId: string,
  ): Promise<ProductSummary> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    return this.prisma.$transaction(async (transaction) => {
      const optimization = await transaction.productOptimization.findFirst({
        where: { id: optimizationId, merchantId, productId },
      })
      if (!optimization) {
        throw new NotFoundException('商品优化记录不存在')
      }
      const current = await transaction.product.findFirst({
        where: { id: productId, merchantId },
        include: productInclude,
      })
      if (!current) {
        throw new NotFoundException('商品不存在')
      }
      if (optimization.status === 'APPLIED') {
        return toProductSummary(current)
      }
      if (optimization.status !== 'DRAFT' || !optimization.draftData) {
        throw new BadRequestException('只有待确认草稿可以应用')
      }
      if (current.version !== optimization.baseProductVersion) {
        throw new ConflictException('商品已被修改，请重新生成优化草稿')
      }

      const draft = productOptimizationDraftSchema.parse(optimization.draftData)
      const changed = await transaction.product.updateMany({
        where: {
          id: productId,
          merchantId,
          version: optimization.baseProductVersion,
        },
        data: {
          title: draft.title,
          description: draft.description,
          sellingPoints: asJson(draft.sellingPoints),
          language: draft.language,
          version: { increment: 1 },
        },
      })
      if (changed.count !== 1) {
        throw new ConflictException('商品已被修改，请重新生成优化草稿')
      }

      const updated = await transaction.product.findUniqueOrThrow({
        where: { id: productId },
        include: productInclude,
      })
      const before = toProductSummary(current)
      const after = toProductSummary(updated)
      await transaction.productVersion.create({
        data: {
          merchantId,
          productId,
          optimizationId,
          actorUserId: actor.id,
          version: updated.version,
          beforeData: asJson(before),
          afterData: asJson(after),
        },
      })
      await transaction.productOptimization.update({
        where: { id: optimizationId },
        data: {
          status: 'APPLIED',
          appliedAt: new Date(),
        },
      })
      await transaction.auditLog.create({
        data: {
          merchantId,
          actorUserId: actor.id,
          entityType: 'PRODUCT',
          entityId: productId,
          action: 'AI_DRAFT_APPLY',
          beforeData: asJson(before),
          afterData: asJson({
            product: after,
            optimizationId,
            usage: {
              promptTokens: optimization.promptTokens,
              completionTokens: optimization.completionTokens,
              totalTokens: optimization.totalTokens,
            },
          }),
        },
      })
      return after
    })
  }
}
