import type {
  DashboardOrderData,
  DashboardOverview,
  DashboardSalesData,
  DashboardTrend,
  OrderStatus,
  OrderSummary,
  OperationsDashboard,
  OrderBulkAction,
  OrderBulkOperationResult,
  OrderFilters,
  OrderSavedView,
  OrderSortField,
  OrderSortOrder,
  OrderViewColumn,
  PaginatedOrders,
} from '@cross-border/shared'

import { apiRequest } from './client'

export function getOrders(
  token: string,
  merchantId: string,
  params: {
    page: number
    pageSize: number
    status?: OrderStatus
    sortBy?: OrderSortField
    sortOrder?: OrderSortOrder
  } & OrderFilters,
): Promise<PaginatedOrders> {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  })
  if (params.status) query.set('status', params.status)
  if (params.statuses?.length) query.set('statuses', params.statuses.join(','))
  if (params.paymentStatuses?.length)
    query.set('paymentStatuses', params.paymentStatuses.join(','))
  if (params.fulfillmentStatuses?.length)
    query.set('fulfillmentStatuses', params.fulfillmentStatuses.join(','))
  if (params.keyword) query.set('keyword', params.keyword)
  if (params.storeId) query.set('storeId', params.storeId)
  if (params.startDate) query.set('startDate', params.startDate)
  if (params.endDate) query.set('endDate', params.endDate)
  if (params.minAmount) query.set('minAmount', params.minAmount)
  if (params.maxAmount) query.set('maxAmount', params.maxAmount)
  if (params.sortBy) query.set('sortBy', params.sortBy)
  if (params.sortOrder) query.set('sortOrder', params.sortOrder)
  return apiRequest(token, `/api/merchants/${merchantId}/orders?${query}`)
}

export interface OrderSavedViewInput extends OrderFilters {
  name: string
  sortBy?: OrderSortField
  sortOrder?: OrderSortOrder
  columns?: OrderViewColumn[]
  isDefault?: boolean
}

export function getOrderSavedViews(
  token: string,
  merchantId: string,
): Promise<OrderSavedView[]> {
  return apiRequest(token, `/api/merchants/${merchantId}/orders/saved-views`)
}

export function createOrderSavedView(
  token: string,
  merchantId: string,
  input: OrderSavedViewInput,
): Promise<OrderSavedView> {
  return apiRequest(token, `/api/merchants/${merchantId}/orders/saved-views`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateOrderSavedView(
  token: string,
  merchantId: string,
  viewId: string,
  input: Partial<OrderSavedViewInput>,
): Promise<OrderSavedView> {
  return apiRequest(
    token,
    `/api/merchants/${merchantId}/orders/saved-views/${viewId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  )
}

export function deleteOrderSavedView(
  token: string,
  merchantId: string,
  viewId: string,
): Promise<void> {
  return apiRequest(
    token,
    `/api/merchants/${merchantId}/orders/saved-views/${viewId}`,
    { method: 'DELETE' },
  )
}

export function executeOrderBulkAction(
  token: string,
  merchantId: string,
  input: {
    action: OrderBulkAction
    orderIds: string[]
    idempotencyKey: string
  },
): Promise<OrderBulkOperationResult> {
  return apiRequest(token, `/api/merchants/${merchantId}/orders/bulk-actions`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function getOrder(
  token: string,
  merchantId: string,
  orderId: string,
  storeId?: string,
): Promise<OrderSummary> {
  const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : ''
  return apiRequest(
    token,
    `/api/merchants/${merchantId}/orders/${orderId}${query}`,
  )
}

export function updateOrderStatus(
  token: string,
  merchantId: string,
  orderId: string,
  status: string,
): Promise<OrderSummary> {
  return apiRequest(
    token,
    `/api/merchants/${merchantId}/orders/${orderId}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    },
  )
}

export function getDashboardOverview(
  token: string,
  merchantId: string,
  storeId?: string,
): Promise<DashboardOverview> {
  const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : ''
  return apiRequest(
    token,
    `/api/merchants/${merchantId}/dashboard/overview${query}`,
  )
}

export function getDashboardTrend(
  token: string,
  merchantId: string,
  storeId?: string,
): Promise<DashboardTrend> {
  const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : ''
  return apiRequest(
    token,
    `/api/merchants/${merchantId}/dashboard/trend${query}`,
  )
}

export function getDashboardSales(
  token: string,
  merchantId: string,
  params?: { days?: number },
): Promise<DashboardSalesData> {
  const query = params?.days ? `?days=${params.days}` : ''
  return apiRequest(
    token,
    `/api/merchants/${merchantId}/dashboard/sales${query}`,
  )
}

export function getDashboardOrders(
  token: string,
  merchantId: string,
  params?: { days?: number },
): Promise<DashboardOrderData> {
  const query = params?.days ? `?days=${params.days}` : ''
  return apiRequest(
    token,
    `/api/merchants/${merchantId}/dashboard/orders${query}`,
  )
}

export function getOperationsDashboard(
  token: string,
  merchantId: string,
  params: { days: number; storeId?: string },
): Promise<OperationsDashboard> {
  const query = new URLSearchParams({ days: String(params.days) })
  if (params.storeId) query.set('storeId', params.storeId)
  return apiRequest(
    token,
    `/api/merchants/${merchantId}/dashboard/operations?${query}`,
  )
}
