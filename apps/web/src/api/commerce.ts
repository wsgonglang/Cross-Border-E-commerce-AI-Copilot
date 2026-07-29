import type {
  AuditLogSummary,
  MerchantSummary,
  PaginatedProducts,
  ProductStatus,
  ProductSummary,
  SkuSummary,
} from '@cross-border/shared'

import { apiRequest } from './client'

export interface MerchantInput {
  code: string
  name: string
  defaultCurrency: string
}

export interface ProductInput {
  code?: string
  title: string
  description: string
  language: string
  status: ProductStatus
}

export interface SkuInput {
  code?: string
  name: string
  price: string
  currency?: string
  stock?: number
}

export function getMerchants(token: string): Promise<MerchantSummary[]> {
  return apiRequest(token, '/api/merchants')
}

export function createMerchant(
  token: string,
  input: MerchantInput,
): Promise<MerchantSummary> {
  return apiRequest(token, '/api/merchants', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateMerchant(
  token: string,
  merchantId: string,
  input: Partial<Pick<MerchantSummary, 'name' | 'status' | 'defaultCurrency'>>,
): Promise<MerchantSummary> {
  return apiRequest(token, `/api/merchants/${merchantId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function getProducts(
  token: string,
  merchantId: string,
  params: {
    page: number
    pageSize: number
    keyword?: string
    status?: ProductStatus
    storeId?: string
  },
): Promise<PaginatedProducts> {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  })
  if (params.keyword) query.set('keyword', params.keyword)
  if (params.status) query.set('status', params.status)
  if (params.storeId) query.set('storeId', params.storeId)
  return apiRequest(token, `/api/merchants/${merchantId}/products?${query}`)
}

export function createProduct(
  token: string,
  merchantId: string,
  input: ProductInput & { code: string },
): Promise<ProductSummary> {
  return apiRequest(token, `/api/merchants/${merchantId}/products`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateProduct(
  token: string,
  merchantId: string,
  productId: string,
  input: ProductInput,
): Promise<ProductSummary> {
  return apiRequest(
    token,
    `/api/merchants/${merchantId}/products/${productId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  )
}

export function createSku(
  token: string,
  merchantId: string,
  productId: string,
  input: SkuInput & { code: string; currency: string; stock: number },
): Promise<SkuSummary> {
  return apiRequest(
    token,
    `/api/merchants/${merchantId}/products/${productId}/skus`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export function updateSku(
  token: string,
  merchantId: string,
  skuId: string,
  input: Pick<SkuInput, 'name' | 'price'> & {
    status: SkuSummary['status']
  },
): Promise<SkuSummary> {
  return apiRequest(token, `/api/merchants/${merchantId}/skus/${skuId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function disableSku(
  token: string,
  merchantId: string,
  skuId: string,
): Promise<SkuSummary> {
  return apiRequest(token, `/api/merchants/${merchantId}/skus/${skuId}`, {
    method: 'DELETE',
  })
}

export function adjustStock(
  token: string,
  merchantId: string,
  skuId: string,
  input: { delta: number; reason: string },
): Promise<SkuSummary> {
  return apiRequest(token, `/api/merchants/${merchantId}/skus/${skuId}/stock`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function getAuditLogs(
  token: string,
  merchantId: string,
): Promise<AuditLogSummary[]> {
  return apiRequest(token, `/api/merchants/${merchantId}/audit-logs`)
}
