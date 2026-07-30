import type {
  FulfillmentStatus,
  OrderBulkAction,
  OrderStatus,
  OrderViewColumn,
  PaymentStatus,
} from '@cross-border/shared'

export type OrderRole = 'admin' | 'operator' | 'viewer'

export const statusMeta: Record<OrderStatus, { color: string; label: string }> =
  {
    PENDING: { color: 'orange', label: '待确认' },
    CONFIRMED: { color: 'blue', label: '已确认' },
    SHIPPED: { color: 'purple', label: '已发货' },
    DELIVERED: { color: 'cyan', label: '已送达' },
    COMPLETED: { color: 'green', label: '已完成' },
    CANCELLED: { color: 'red', label: '已取消' },
    REFUNDING: { color: 'volcano', label: '退款中' },
    REFUNDED: { color: 'default', label: '已退款' },
  }

export const paymentMeta: Record<
  PaymentStatus,
  { color: string; label: string }
> = {
  UNPAID: { color: 'orange', label: '未支付' },
  PAID: { color: 'green', label: '已支付' },
  PARTIALLY_REFUNDED: { color: 'volcano', label: '部分退款' },
  REFUNDED: { color: 'default', label: '已退款' },
}

export const fulfillmentMeta: Record<
  FulfillmentStatus,
  { color: string; label: string }
> = {
  UNFULFILLED: { color: 'orange', label: '未履约' },
  PROCESSING: { color: 'blue', label: '处理中' },
  SHIPPED: { color: 'purple', label: '已发货' },
  DELIVERED: { color: 'green', label: '已送达' },
  CANCELLED: { color: 'red', label: '已取消' },
}

export const actionSteps = [
  { from: 'PENDING', to: 'CONFIRMED', label: '确认订单', minRole: 'operator' },
  { from: 'PENDING', to: 'CANCELLED', label: '取消订单', minRole: 'operator' },
  { from: 'CONFIRMED', to: 'SHIPPED', label: '标记发货', minRole: 'operator' },
  { from: 'CONFIRMED', to: 'CANCELLED', label: '取消订单', minRole: 'admin' },
  { from: 'SHIPPED', to: 'DELIVERED', label: '标记送达', minRole: 'operator' },
  { from: 'DELIVERED', to: 'COMPLETED', label: '完成订单', minRole: 'admin' },
  { from: 'DELIVERED', to: 'REFUNDING', label: '发起退款', minRole: 'admin' },
  { from: 'COMPLETED', to: 'REFUNDING', label: '发起退款', minRole: 'admin' },
  { from: 'REFUNDING', to: 'REFUNDED', label: '确认退款', minRole: 'admin' },
] as const

export const allColumns: Array<{
  value: OrderViewColumn
  label: string
}> = [
  { value: 'store', label: '店铺' },
  { value: 'orderNo', label: '订单号' },
  { value: 'customer', label: '客户' },
  { value: 'amount', label: '金额' },
  { value: 'status', label: '生命周期' },
  { value: 'paymentStatus', label: '支付状态' },
  { value: 'fulfillmentStatus', label: '履约状态' },
  { value: 'createdAt', label: '下单时间' },
]

export const defaultColumns = allColumns.map((item) => item.value)

export const bulkOptions: Array<{
  value: OrderBulkAction
  label: string
  adminOnly?: boolean
}> = [
  { value: 'CONFIRM', label: '批量确认' },
  { value: 'MARK_SHIPPED', label: '批量发货' },
  { value: 'MARK_DELIVERED', label: '批量送达' },
  { value: 'CANCEL', label: '批量取消' },
  { value: 'START_REFUND', label: '批量发起退款', adminOnly: true },
  { value: 'CONFIRM_REFUND', label: '批量确认退款', adminOnly: true },
]

export function canAct(role: OrderRole, minRole: string): boolean {
  if (minRole === 'admin') return role === 'admin'
  return role === 'admin' || role === 'operator'
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function readOrderStatuses(
  value: string | null,
): OrderStatus[] | undefined {
  if (!value) return undefined
  const knownStatuses = new Set(Object.keys(statusMeta))
  const statuses = value
    .split(',')
    .filter((status): status is OrderStatus => knownStatuses.has(status))
  return statuses.length > 0 ? statuses : undefined
}
