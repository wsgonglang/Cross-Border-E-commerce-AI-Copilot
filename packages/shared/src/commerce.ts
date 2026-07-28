export const MERCHANT_STATUSES = ['ACTIVE', 'DISABLED'] as const
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

export type MerchantStatus = (typeof MERCHANT_STATUSES)[number]
export type ProductStatus = (typeof PRODUCT_STATUSES)[number]
export type SkuStatus = (typeof SKU_STATUSES)[number]
export type OrderStatus = (typeof ORDER_STATUSES)[number]

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
  orderNo: string
  status: OrderStatus
  customerName: string
  customerEmail: string | null
  totalAmount: string
  currency: string
  notes: string | null
  items: OrderItemSummary[]
  createdAt: string
  updatedAt: string
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
