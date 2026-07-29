export const MERCHANT_STATUSES = ['ACTIVE', 'DISABLED'] as const
export const STORE_STATUSES = ['ACTIVE', 'DISABLED'] as const
export const PRODUCT_LISTING_STATUSES = [
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED',
] as const
export const PRODUCT_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const
export const SKU_STATUSES = ['ACTIVE', 'DISABLED'] as const
export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'REFUNDING',
  'REFUNDED',
] as const
export const PAYMENT_STATUSES = [
  'UNPAID',
  'PAID',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
] as const
export const FULFILLMENT_STATUSES = [
  'UNFULFILLED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
] as const

export type MerchantStatus = (typeof MERCHANT_STATUSES)[number]
export type StoreStatus = (typeof STORE_STATUSES)[number]
export type ProductListingStatus = (typeof PRODUCT_LISTING_STATUSES)[number]
export type ProductStatus = (typeof PRODUCT_STATUSES)[number]
export type SkuStatus = (typeof SKU_STATUSES)[number]
export type OrderStatus = (typeof ORDER_STATUSES)[number]
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number]

export interface MerchantSummary {
  id: string
  code: string
  name: string
  status: MerchantStatus
  defaultCurrency: string
  createdAt: string
  updatedAt: string
}

export interface StoreSummary {
  id: string
  merchantId: string
  code: string
  name: string
  platform: string
  market: string
  currency: string
  locale: string
  timezone: string
  status: StoreStatus
  createdAt: string
  updatedAt: string
}

export interface ProductListingSummary {
  id: string
  merchantId: string
  storeId: string
  productId: string
  externalProductId: string | null
  title: string
  description: string
  language: string
  price: string
  currency: string
  status: ProductListingStatus
  product: {
    id: string
    code: string
    title: string
  }
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
  sellingPoints: string[]
  language: string
  status: ProductStatus
  version: number
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

export interface OrderItemSummary {
  id: string
  orderId: string
  productId: string | null
  skuId: string | null
  productName: string
  skuName: string
  quantity: number
  unitPrice: string
  subtotal: string
  currency: string
}

export interface OrderSummary {
  id: string
  merchantId: string
  storeId: string | null
  orderNo: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  fulfillmentStatus: FulfillmentStatus
  customerName: string
  customerEmail: string | null
  shippingAddress: {
    recipient?: string
    phone?: string
    line1?: string
    line2?: string
    city?: string
    region?: string
    postalCode?: string
    country?: string
  } | null
  trackingNumber: string | null
  carrier: string | null
  totalAmount: string
  refundAmount: string
  currency: string
  notes: string | null
  store: Pick<StoreSummary, 'id' | 'code' | 'name' | 'platform'> | null
  items: OrderItemSummary[]
  timeline: OrderTimelineEvent[]
  version: number
  createdAt: string
  updatedAt: string
}

export interface OrderTimelineEvent {
  id: string
  type: 'CREATED' | 'STATUS_CHANGED' | 'BULK_OPERATION' | 'NOTE'
  title: string
  description: string | null
  actorName: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface PaginatedOrders {
  items: OrderSummary[]
  total: number
  page: number
  pageSize: number
}

export interface DashboardOverview {
  todayOrders: number
  todaySales: string
  totalProducts: number
  lowStockItems: number
}

export interface DashboardTrend {
  dates: string[]
  orders: number[]
  sales: string[]
}

export interface SalesSummary {
  todaySales: string
  avgOrderValue: string
  growthRate: number
}

export interface SalesTrend {
  dates: string[]
  sales: string[]
}

export interface DashboardSalesData {
  summary: SalesSummary
  trend: SalesTrend
}

export interface OrderAnalysisSummary {
  todayOrders: number
  completedOrders: number
  refundedOrders: number
  completionRate: number
}

export interface OrderTrend {
  dates: string[]
  orders: number[]
}

export interface DashboardOrderData {
  summary: OrderAnalysisSummary
  trend: OrderTrend
}
