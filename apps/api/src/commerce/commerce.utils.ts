import { ConflictException } from '@nestjs/common'
import type {
  MerchantSummary,
  OrderItemSummary,
  OrderSummary,
  ProductSummary,
  SkuSummary,
} from '@cross-border/shared'

import type { Prisma } from '../generated/prisma/client'

interface MerchantSource {
  id: string
  code: string
  name: string
  status: 'ACTIVE' | 'DISABLED'
  defaultCurrency: string
  createdAt: Date
  updatedAt: Date
}

interface SkuSource {
  id: string
  merchantId: string
  productId: string
  code: string
  name: string
  price: { toString(): string }
  currency: string
  stock: number
  status: 'ACTIVE' | 'DISABLED'
  createdAt: Date
  updatedAt: Date
}

interface ProductSource {
  id: string
  merchantId: string
  code: string
  title: string
  description: string
  sellingPoints: unknown
  language: string
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  version: number
  skus: SkuSource[]
  createdAt: Date
  updatedAt: Date
}

interface OrderItemSource {
  id: string
  orderId: string
  productId: string | null
  skuId: string | null
  productName: string
  skuName: string
  quantity: number
  unitPrice: { toString(): string }
  subtotal: { toString(): string }
  currency: string
}

export interface OrderSource {
  id: string
  merchantId: string
  storeId: string | null
  orderNo: string
  status: string
  customerName: string
  customerEmail: string | null
  totalAmount: { toString(): string }
  currency: string
  notes: string | null
  store: {
    id: string
    code: string
    name: string
    platform: string
  } | null
  items: OrderItemSource[]
  createdAt: Date
  updatedAt: Date
}

export function toMerchantSummary(source: MerchantSource): MerchantSummary {
  return {
    ...source,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  }
}

export function toSkuSummary(source: SkuSource): SkuSummary {
  return {
    ...source,
    price: source.price.toString(),
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  }
}

export function toProductSummary(source: ProductSource): ProductSummary {
  return {
    ...source,
    sellingPoints: toStringArray(source.sellingPoints),
    skus: source.skus.map(toSkuSummary),
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  }
}

export function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

export function rethrowUniqueConstraint(
  error: unknown,
  message: string,
): never {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  ) {
    throw new ConflictException(message)
  }
  throw error
}

export function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

export function toOrderItemSummary(source: OrderItemSource): OrderItemSummary {
  return {
    ...source,
    unitPrice: source.unitPrice.toString(),
    subtotal: source.subtotal.toString(),
  }
}

export function toOrderSummary(source: OrderSource): OrderSummary {
  return {
    ...source,
    status: source.status as OrderSummary['status'],
    totalAmount: source.totalAmount.toString(),
    items: source.items.map(toOrderItemSummary),
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  }
}
