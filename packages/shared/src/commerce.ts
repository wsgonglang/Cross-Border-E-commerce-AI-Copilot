export const MERCHANT_STATUSES = ['ACTIVE', 'DISABLED'] as const
export const PRODUCT_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const
export const SKU_STATUSES = ['ACTIVE', 'DISABLED'] as const

export type MerchantStatus = (typeof MERCHANT_STATUSES)[number]
export type ProductStatus = (typeof PRODUCT_STATUSES)[number]
export type SkuStatus = (typeof SKU_STATUSES)[number]

export interface MerchantSummary {
  id: string
  code: string
  name: string
  status: MerchantStatus
  defaultCurrency: string
  createdAt: string
  updatedAt: string
}

export interface SkuSummary {
  id: string
  merchantId: string
  productId: string
  code: string
  name: string
  price: string
  currency: string
  stock: number
  status: SkuStatus
  createdAt: string
  updatedAt: string
}

export interface ProductSummary {
  id: string
  merchantId: string
  code: string
  title: string
  description: string
  language: string
  status: ProductStatus
  skus: SkuSummary[]
  createdAt: string
  updatedAt: string
}

export interface PaginatedProducts {
  items: ProductSummary[]
  total: number
  page: number
  pageSize: number
}

export interface AuditLogSummary {
  id: string
  merchantId: string
  actorUserId: string
  entityType: string
  entityId: string
  action: string
  beforeData: unknown
  afterData: unknown
  createdAt: string
}
