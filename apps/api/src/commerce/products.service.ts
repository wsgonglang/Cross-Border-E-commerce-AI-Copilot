import { Injectable, NotFoundException } from '@nestjs/common'
import type {
  AuthenticatedUser,
  PaginatedProducts,
  ProductSummary,
} from '@cross-border/shared'

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
        data: dto,
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
}
