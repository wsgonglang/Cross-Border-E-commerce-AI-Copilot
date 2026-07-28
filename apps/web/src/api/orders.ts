import type {
  DashboardOrderData,
  DashboardOverview,
  DashboardSalesData,
  DashboardTrend,
  OrderStatus,
  OrderSummary,
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
    keyword?: string
  },
): Promise<PaginatedOrders> {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  })
  if (params.status) query.set('status', params.status)
  if (params.keyword) query.set('keyword', params.keyword)
  return apiRequest(token, `/api/merchants/${merchantId}/orders?${query}`)
}

export function getOrder(
  token: string,
  merchantId: string,
  orderId: string,
): Promise<OrderSummary> {
  return apiRequest(token, `/api/merchants/${merchantId}/orders/${orderId}`)
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
): Promise<DashboardOverview> {
  return apiRequest(token, `/api/merchants/${merchantId}/dashboard/overview`)
}

export function getDashboardTrend(
  token: string,
  merchantId: string,
): Promise<DashboardTrend> {
  return apiRequest(token, `/api/merchants/${merchantId}/dashboard/trend`)
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
