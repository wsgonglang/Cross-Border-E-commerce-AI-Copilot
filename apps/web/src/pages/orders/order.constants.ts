import type {
  FulfillmentStatus,
  OrderBulkAction,
  OrderStatus,
  OrderViewColumn,
  PaymentStatus,
} from '@cross-border/shared'
import type { TFunction } from 'i18next'

export type OrderRole = 'admin' | 'operator' | 'viewer'

export const statusMeta: Record<OrderStatus, { color: string }> = {
  PENDING: { color: 'orange' },
  CONFIRMED: { color: 'blue' },
  SHIPPED: { color: 'purple' },
  DELIVERED: { color: 'cyan' },
  COMPLETED: { color: 'green' },
  CANCELLED: { color: 'red' },
  REFUNDING: { color: 'volcano' },
  REFUNDED: { color: 'default' },
}

export const paymentMeta: Record<PaymentStatus, { color: string }> = {
  UNPAID: { color: 'orange' },
  PAID: { color: 'green' },
  PARTIALLY_REFUNDED: { color: 'volcano' },
  REFUNDED: { color: 'default' },
}

export const fulfillmentMeta: Record<FulfillmentStatus, { color: string }> = {
  UNFULFILLED: { color: 'orange' },
  PROCESSING: { color: 'blue' },
  SHIPPED: { color: 'purple' },
  DELIVERED: { color: 'green' },
  CANCELLED: { color: 'red' },
}

export const actionSteps = [
  {
    from: 'PENDING',
    to: 'CONFIRMED',
    labelKey: 'orders.actions.confirm',
    minRole: 'operator',
  },
  {
    from: 'PENDING',
    to: 'CANCELLED',
    labelKey: 'orders.actions.cancel',
    minRole: 'operator',
  },
  {
    from: 'CONFIRMED',
    to: 'SHIPPED',
    labelKey: 'orders.actions.ship',
    minRole: 'operator',
  },
  {
    from: 'CONFIRMED',
    to: 'CANCELLED',
    labelKey: 'orders.actions.cancel',
    minRole: 'admin',
  },
  {
    from: 'SHIPPED',
    to: 'DELIVERED',
    labelKey: 'orders.actions.deliver',
    minRole: 'operator',
  },
  {
    from: 'DELIVERED',
    to: 'COMPLETED',
    labelKey: 'orders.actions.complete',
    minRole: 'admin',
  },
  {
    from: 'DELIVERED',
    to: 'REFUNDING',
    labelKey: 'orders.actions.startRefund',
    minRole: 'admin',
  },
  {
    from: 'COMPLETED',
    to: 'REFUNDING',
    labelKey: 'orders.actions.startRefund',
    minRole: 'admin',
  },
  {
    from: 'REFUNDING',
    to: 'REFUNDED',
    labelKey: 'orders.actions.confirmRefund',
    minRole: 'admin',
  },
] as const

export const columnDefinitions: Array<{
  value: OrderViewColumn
  labelKey: string
}> = [
  { value: 'store', labelKey: 'orders.store' },
  { value: 'orderNo', labelKey: 'orders.orderNo' },
  { value: 'customer', labelKey: 'orders.customer' },
  { value: 'amount', labelKey: 'orders.amount' },
  { value: 'status', labelKey: 'orders.lifecycle' },
  { value: 'paymentStatus', labelKey: 'orders.paymentStatus' },
  { value: 'fulfillmentStatus', labelKey: 'orders.fulfillmentStatus' },
  { value: 'createdAt', labelKey: 'orders.createdAt' },
]

export const defaultColumns = columnDefinitions.map((item) => item.value)

export const bulkDefinitions: Array<{
  value: OrderBulkAction
  labelKey: string
  adminOnly?: boolean
}> = [
  { value: 'CONFIRM', labelKey: 'orders.bulkActions.confirm' },
  { value: 'MARK_SHIPPED', labelKey: 'orders.bulkActions.ship' },
  { value: 'MARK_DELIVERED', labelKey: 'orders.bulkActions.deliver' },
  { value: 'CANCEL', labelKey: 'orders.bulkActions.cancel' },
  {
    value: 'START_REFUND',
    labelKey: 'orders.bulkActions.startRefund',
    adminOnly: true,
  },
  {
    value: 'CONFIRM_REFUND',
    labelKey: 'orders.bulkActions.confirmRefund',
    adminOnly: true,
  },
]

export const statusLabel = (t: TFunction, value: OrderStatus) =>
  t(`orders.status.${value}`)
export const paymentLabel = (t: TFunction, value: PaymentStatus) =>
  t(`orders.paymentMap.${value}`)
export const fulfillmentLabel = (t: TFunction, value: FulfillmentStatus) =>
  t(`orders.fulfillmentMap.${value}`)

export function canAct(role: OrderRole, minRole: string): boolean {
  if (minRole === 'admin') return role === 'admin'
  return role === 'admin' || role === 'operator'
}

export function formatDate(value: string, locale = 'zh-CN'): string {
  return new Date(value).toLocaleString(locale, {
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
