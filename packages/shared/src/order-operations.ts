import type { FulfillmentStatus, OrderStatus, PaymentStatus } from './commerce'

export const ORDER_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'totalAmount',
  'orderNo',
] as const
export const ORDER_SORT_ORDERS = ['asc', 'desc'] as const
export const ORDER_VIEW_COLUMNS = [
  'store',
  'orderNo',
  'customer',
  'amount',
  'status',
  'paymentStatus',
  'fulfillmentStatus',
  'createdAt',
] as const
export const ORDER_BULK_ACTIONS = [
  'CONFIRM',
  'MARK_SHIPPED',
  'MARK_DELIVERED',
  'CANCEL',
  'START_REFUND',
  'CONFIRM_REFUND',
] as const

export type OrderSortField = (typeof ORDER_SORT_FIELDS)[number]
export type OrderSortOrder = (typeof ORDER_SORT_ORDERS)[number]
export type OrderViewColumn = (typeof ORDER_VIEW_COLUMNS)[number]
export type OrderBulkAction = (typeof ORDER_BULK_ACTIONS)[number]

export interface OrderFilters {
  keyword?: string
  statuses?: OrderStatus[]
  paymentStatuses?: PaymentStatus[]
  fulfillmentStatuses?: FulfillmentStatus[]
  storeId?: string
  startDate?: string
  endDate?: string
  minAmount?: string
  maxAmount?: string
}

export interface OrderSavedView {
  id: string
  merchantId: string
  userId: string
  name: string
  filters: OrderFilters
  sortBy: OrderSortField
  sortOrder: OrderSortOrder
  columns: OrderViewColumn[]
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface OrderBulkItemResult {
  id: string
  orderId: string
  orderNo: string
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED'
  fromStatus: OrderStatus | null
  toStatus: OrderStatus | null
  error: string | null
}

export interface OrderBulkOperationResult {
  id: string
  action: OrderBulkAction
  status: 'RUNNING' | 'COMPLETED' | 'PARTIAL_FAILED'
  totalItems: number
  succeededItems: number
  failedItems: number
  items: OrderBulkItemResult[]
  createdAt: string
  completedAt: string | null
}
