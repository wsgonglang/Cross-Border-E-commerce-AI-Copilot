import { Injectable, NotFoundException } from '@nestjs/common'
import type { AuthenticatedUser, MerchantSummary } from '@cross-border/shared'

import { PrismaService } from '../database/prisma.service'
import {
  asJson,
  rethrowUniqueConstraint,
  toMerchantSummary,
} from './commerce.utils'
import type { CreateMerchantDto, UpdateMerchantDto } from './dto/merchant.dto'

@Injectable()
export class MerchantsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedUser): Promise<MerchantSummary[]> {
    const merchants = await this.prisma.merchant.findMany({
      where: user.roles.includes('admin')
        ? {}
        : {
            id: { in: user.merchantIds },
            status: 'ACTIVE',
          },
      orderBy: { createdAt: 'asc' },
    })
    return merchants.map(toMerchantSummary)
  }

  async create(
    actor: AuthenticatedUser,
    dto: CreateMerchantDto,
  ): Promise<MerchantSummary> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const merchant = await transaction.merchant.create({ data: dto })
        const summary = toMerchantSummary(merchant)
        await transaction.auditLog.create({
          data: {
            merchantId: merchant.id,
            actorUserId: actor.id,
            entityType: 'MERCHANT',
            entityId: merchant.id,
            action: 'CREATE',
            afterData: asJson(summary),
          },
        })
        return summary
      })
    } catch (error: unknown) {
      rethrowUniqueConstraint(error, '商家编码已存在')
    }
  }

  async update(
    actor: AuthenticatedUser,
    merchantId: string,
    dto: UpdateMerchantDto,
  ): Promise<MerchantSummary> {
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.merchant.findUnique({
        where: { id: merchantId },
      })
      if (!current) {
        throw new NotFoundException('商家不存在')
      }

      const updated = await transaction.merchant.update({
        where: { id: merchantId },
        data: dto,
      })
      const before = toMerchantSummary(current)
      const after = toMerchantSummary(updated)
      await transaction.auditLog.create({
        data: {
          merchantId,
          actorUserId: actor.id,
          entityType: 'MERCHANT',
          entityId: merchantId,
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
  ): Promise<MerchantSummary> {
    return this.update(actor, merchantId, { status: 'DISABLED' })
  }
}
