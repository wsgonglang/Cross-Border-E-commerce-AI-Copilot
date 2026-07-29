import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type { AuthenticatedUser, SkuSummary } from '@cross-border/shared'

import { PrismaService } from '../database/prisma.service'
import { asJson, rethrowUniqueConstraint, toSkuSummary } from './commerce.utils'
import type { AdjustStockDto, CreateSkuDto, UpdateSkuDto } from './dto/sku.dto'
import { MerchantAccessService } from './merchant-access.service'

@Injectable()
export class SkusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly merchantAccess: MerchantAccessService,
  ) {}

  async create(
    actor: AuthenticatedUser,
    merchantId: string,
    productId: string,
    dto: CreateSkuDto,
  ): Promise<SkuSummary> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    const product = await this.prisma.product.findFirst({
      where: { id: productId, merchantId, status: { not: 'ARCHIVED' } },
      select: { id: true },
    })
    if (!product) {
      throw new NotFoundException('商品不存在或已归档')
    }

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const sku = await transaction.sku.create({
          data: { ...dto, merchantId, productId },
        })
        const summary = toSkuSummary(sku)
        await transaction.auditLog.create({
          data: {
            merchantId,
            actorUserId: actor.id,
            entityType: 'SKU',
            entityId: sku.id,
            action: 'CREATE',
            afterData: asJson(summary),
          },
        })
        return summary
      })
    } catch (error: unknown) {
      rethrowUniqueConstraint(error, '当前商家的 SKU 编码已存在')
    }
  }

  async upsertImported(
    actor: AuthenticatedUser,
    merchantId: string,
    productId: string,
    dto: CreateSkuDto,
  ): Promise<SkuSummary> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    const current = await this.prisma.sku.findFirst({
      where: { merchantId, code: dto.code },
    })
    if (!current) return this.create(actor, merchantId, productId, dto)
    if (current.productId !== productId) {
      throw new ConflictException('SKU 编码已属于当前商家的其他商品')
    }
    const updated = await this.update(actor, merchantId, current.id, {
      name: dto.name,
      price: dto.price,
      status: 'ACTIVE',
    })
    if (updated.stock !== dto.stock) {
      return this.adjustStock(actor, merchantId, current.id, {
        delta: dto.stock - updated.stock,
        reason: '结构化导入同步库存',
      })
    }
    return updated
  }

  async update(
    actor: AuthenticatedUser,
    merchantId: string,
    skuId: string,
    dto: UpdateSkuDto,
  ): Promise<SkuSummary> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.sku.findFirst({
        where: { id: skuId, merchantId },
      })
      if (!current) {
        throw new NotFoundException('SKU 不存在')
      }

      const updated = await transaction.sku.update({
        where: { id: skuId },
        data: dto,
      })
      const before = toSkuSummary(current)
      const after = toSkuSummary(updated)
      await transaction.auditLog.create({
        data: {
          merchantId,
          actorUserId: actor.id,
          entityType: 'SKU',
          entityId: skuId,
          action: 'UPDATE',
          beforeData: asJson(before),
          afterData: asJson(after),
        },
      })
      return after
    })
  }

  disable(
    actor: AuthenticatedUser,
    merchantId: string,
    skuId: string,
  ): Promise<SkuSummary> {
    return this.update(actor, merchantId, skuId, { status: 'DISABLED' })
  }

  async adjustStock(
    actor: AuthenticatedUser,
    merchantId: string,
    skuId: string,
    dto: AdjustStockDto,
  ): Promise<SkuSummary> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.sku.findFirst({
        where: { id: skuId, merchantId, status: 'ACTIVE' },
      })
      if (!current) {
        throw new NotFoundException('可用 SKU 不存在')
      }
      if (current.stock + dto.delta < 0) {
        throw new BadRequestException('库存不足，调整后库存不能小于 0')
      }

      const changed = await transaction.sku.updateMany({
        where: { id: skuId, merchantId, stock: current.stock },
        data: { stock: { increment: dto.delta } },
      })
      if (changed.count !== 1) {
        throw new ConflictException('库存已变化，请刷新后重试')
      }
      const updated = await transaction.sku.findUniqueOrThrow({
        where: { id: skuId },
      })
      const before = toSkuSummary(current)
      const after = toSkuSummary(updated)
      await transaction.auditLog.create({
        data: {
          merchantId,
          actorUserId: actor.id,
          entityType: 'SKU',
          entityId: skuId,
          action: 'ADJUST_STOCK',
          beforeData: asJson(before),
          afterData: asJson({
            ...after,
            adjustment: { delta: dto.delta, reason: dto.reason },
          }),
        },
      })
      return after
    })
  }
}
