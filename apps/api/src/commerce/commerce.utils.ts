import { ConflictException } from '@nestjs/common'
import type {
  MerchantSummary,
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
  language: string
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  skus: SkuSource[]
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
    skus: source.skus.map(toSkuSummary),
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  }
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
