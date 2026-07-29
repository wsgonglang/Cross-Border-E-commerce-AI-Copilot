import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type {
  AuthenticatedUser,
  ProductListingSummary,
  StoreSummary,
} from '@cross-border/shared'

import { PrismaService } from '../database/prisma.service'
import { asJson, rethrowUniqueConstraint } from './commerce.utils'
import type {
  CreateProductListingDto,
  CreateStoreDto,
  UpdateProductListingDto,
  UpdateStoreDto,
} from './dto/store.dto'
import { MerchantAccessService } from './merchant-access.service'

interface StoreRecord {
  id: string
  merchantId: string
  code: string
  name: string
  platform: string
  market: string
  currency: string
  locale: string
  timezone: string
  status: 'ACTIVE' | 'DISABLED'
  createdAt: Date
  updatedAt: Date
}

interface ListingRecord {
  id: string
  merchantId: string
  storeId: string
  productId: string
  externalProductId: string | null
  title: string
  description: string
  language: string
  price: { toString(): string }
  currency: string
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  product: { id: string; code: string; title: string }
  createdAt: Date
  updatedAt: Date
}

const listingInclude = {
  product: { select: { id: true, code: true, title: true } },
} as const

@Injectable()
export class StoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly merchantAccess: MerchantAccessService,
  ) {}

  async list(
    actor: AuthenticatedUser,
    merchantId: string,
  ): Promise<StoreSummary[]> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    const records = await this.prisma.store.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'asc' },
    })
    return records.map((record) => this.toStoreSummary(record))
  }

  async assertStore(
    actor: AuthenticatedUser,
    merchantId: string,
    storeId: string,
  ): Promise<StoreSummary> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    const store = await this.prisma.store.findFirst({
      where: { id: storeId, merchantId, status: 'ACTIVE' },
    })
    if (!store) throw new NotFoundException('店铺不存在或不可用')
    return this.toStoreSummary(store)
  }

  async create(
    actor: AuthenticatedUser,
    merchantId: string,
    dto: CreateStoreDto,
  ): Promise<StoreSummary> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const store = await transaction.store.create({
          data: {
            ...dto,
            market: dto.market.toUpperCase(),
            currency: dto.currency.toUpperCase(),
            merchantId,
          },
        })
        const summary = this.toStoreSummary(store)
        await transaction.auditLog.create({
          data: {
            merchantId,
            actorUserId: actor.id,
            entityType: 'STORE',
            entityId: store.id,
            action: 'CREATE',
            afterData: asJson(summary),
          },
        })
        return summary
      })
    } catch (error: unknown) {
      rethrowUniqueConstraint(error, '当前商家的店铺编码已存在')
    }
  }

  async update(
    actor: AuthenticatedUser,
    merchantId: string,
    storeId: string,
    dto: UpdateStoreDto,
  ): Promise<StoreSummary> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.store.findFirst({
        where: { id: storeId, merchantId },
      })
      if (!current) throw new NotFoundException('店铺不存在')
      const updated = await transaction.store.update({
        where: { id: storeId },
        data: {
          ...dto,
          ...(dto.currency ? { currency: dto.currency.toUpperCase() } : {}),
        },
      })
      const before = this.toStoreSummary(current)
      const after = this.toStoreSummary(updated)
      await transaction.auditLog.create({
        data: {
          merchantId,
          actorUserId: actor.id,
          entityType: 'STORE',
          entityId: storeId,
          action: 'UPDATE',
          beforeData: asJson(before),
          afterData: asJson(after),
        },
      })
      return after
    })
  }

  async listListings(
    actor: AuthenticatedUser,
    merchantId: string,
    storeId: string,
  ): Promise<ProductListingSummary[]> {
    await this.assertStore(actor, merchantId, storeId)
    const records = await this.prisma.productListing.findMany({
      where: { merchantId, storeId },
      include: listingInclude,
      orderBy: { updatedAt: 'desc' },
    })
    return records.map((record) => this.toListingSummary(record))
  }

  async createListing(
    actor: AuthenticatedUser,
    merchantId: string,
    storeId: string,
    dto: CreateProductListingDto,
  ): Promise<ProductListingSummary> {
    const store = await this.assertStore(actor, merchantId, storeId)
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, merchantId },
    })
    if (!product) throw new NotFoundException('商品不存在')
    if (dto.currency.toUpperCase() !== store.currency) {
      throw new ConflictException('刊登币种必须与店铺币种一致')
    }
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const listing = await transaction.productListing.create({
          data: {
            ...dto,
            currency: dto.currency.toUpperCase(),
            merchantId,
            storeId,
          },
          include: listingInclude,
        })
        const summary = this.toListingSummary(listing)
        await transaction.auditLog.create({
          data: {
            merchantId,
            actorUserId: actor.id,
            entityType: 'PRODUCT_LISTING',
            entityId: listing.id,
            action: 'CREATE',
            afterData: asJson(summary),
          },
        })
        return summary
      })
    } catch (error: unknown) {
      rethrowUniqueConstraint(error, '该商品已在当前店铺创建刊登')
    }
  }

  async updateListing(
    actor: AuthenticatedUser,
    merchantId: string,
    storeId: string,
    listingId: string,
    dto: UpdateProductListingDto,
  ): Promise<ProductListingSummary> {
    const store = await this.assertStore(actor, merchantId, storeId)
    if (dto.currency && dto.currency.toUpperCase() !== store.currency) {
      throw new ConflictException('刊登币种必须与店铺币种一致')
    }
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.productListing.findFirst({
        where: { id: listingId, merchantId, storeId },
        include: listingInclude,
      })
      if (!current) throw new NotFoundException('商品刊登不存在')
      const updated = await transaction.productListing.update({
        where: { id: listingId },
        data: {
          ...dto,
          ...(dto.currency ? { currency: dto.currency.toUpperCase() } : {}),
        },
        include: listingInclude,
      })
      const before = this.toListingSummary(current)
      const after = this.toListingSummary(updated)
      await transaction.auditLog.create({
        data: {
          merchantId,
          actorUserId: actor.id,
          entityType: 'PRODUCT_LISTING',
          entityId: listingId,
          action: 'UPDATE',
          beforeData: asJson(before),
          afterData: asJson(after),
        },
      })
      return after
    })
  }

  private toStoreSummary(record: StoreRecord): StoreSummary {
    return {
      id: record.id,
      merchantId: record.merchantId,
      code: record.code,
      name: record.name,
      platform: record.platform,
      market: record.market,
      currency: record.currency,
      locale: record.locale,
      timezone: record.timezone,
      status: record.status,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    }
  }

  private toListingSummary(record: ListingRecord): ProductListingSummary {
    return {
      id: record.id,
      merchantId: record.merchantId,
      storeId: record.storeId,
      productId: record.productId,
      externalProductId: record.externalProductId,
      title: record.title,
      description: record.description,
      language: record.language,
      price: record.price.toString(),
      currency: record.currency,
      status: record.status,
      product: record.product,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    }
  }
}
