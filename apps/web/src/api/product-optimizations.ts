import type {
  OptimizationLanguage,
  ProductOptimizationSummary,
} from '@cross-border/shared'

import { apiRequest } from './client'

function basePath(merchantId: string, productId: string): string {
  return `/api/merchants/${merchantId}/products/${productId}/optimizations`
}

export function getProductOptimizations(
  token: string,
  merchantId: string,
  productId: string,
): Promise<ProductOptimizationSummary[]> {
  return apiRequest(token, basePath(merchantId, productId))
}

export function getProductOptimization(
  token: string,
  merchantId: string,
  productId: string,
  optimizationId: string,
): Promise<ProductOptimizationSummary> {
  return apiRequest(
    token,
    `${basePath(merchantId, productId)}/${optimizationId}`,
  )
}

export function createProductOptimization(
  token: string,
  merchantId: string,
  productId: string,
  targetLanguage: OptimizationLanguage,
): Promise<ProductOptimizationSummary> {
  return apiRequest(token, basePath(merchantId, productId), {
    method: 'POST',
    body: JSON.stringify({ targetLanguage }),
  })
}

export function applyProductOptimization(
  token: string,
  merchantId: string,
  productId: string,
  optimizationId: string,
): Promise<ProductOptimizationSummary> {
  return apiRequest(
    token,
    `${basePath(merchantId, productId)}/${optimizationId}/apply`,
    { method: 'POST' },
  )
}

export function rejectProductOptimization(
  token: string,
  merchantId: string,
  productId: string,
  optimizationId: string,
): Promise<ProductOptimizationSummary> {
  return apiRequest(
    token,
    `${basePath(merchantId, productId)}/${optimizationId}/reject`,
    { method: 'POST' },
  )
}
