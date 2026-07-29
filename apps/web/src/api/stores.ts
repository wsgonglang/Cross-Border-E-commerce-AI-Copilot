import type {
  ProductListingStatus,
  ProductListingSummary,
  StoreStatus,
  StoreSummary,
} from '@cross-border/shared'

import { apiRequest } from './client'

export interface StoreInput {
  code: string
  name: string
  platform: string
  market: string
  currency: string
  locale: string
  timezone: string
}

export interface ProductListingInput {
  productId: string
  externalProductId?: string
  title: string
  description: string
  language: string
  price: string
  currency: string
  status?: ProductListingStatus
}

export function getStores(
  token: string,
  merchantId: string,
): Promise<StoreSummary[]> {
  return apiRequest(token, `/api/merchants/${merchantId}/stores`)
}

export function createStore(
  token: string,
  merchantId: string,
  input: StoreInput,
): Promise<StoreSummary> {
  return apiRequest(token, `/api/merchants/${merchantId}/stores`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateStore(
  token: string,
  merchantId: string,
  storeId: string,
  input: Partial<
    Pick<StoreSummary, 'name' | 'currency' | 'locale' | 'timezone'> & {
      status: StoreStatus
    }
  >,
): Promise<StoreSummary> {
  return apiRequest(token, `/api/merchants/${merchantId}/stores/${storeId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function getProductListings(
  token: string,
  merchantId: string,
  storeId: string,
): Promise<ProductListingSummary[]> {
  return apiRequest(
    token,
    `/api/merchants/${merchantId}/stores/${storeId}/listings`,
  )
}

export function createProductListing(
  token: string,
  merchantId: string,
  storeId: string,
  input: ProductListingInput,
): Promise<ProductListingSummary> {
  return apiRequest(
    token,
    `/api/merchants/${merchantId}/stores/${storeId}/listings`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}

export function updateProductListing(
  token: string,
  merchantId: string,
  storeId: string,
  listingId: string,
  input: Partial<Omit<ProductListingInput, 'productId'>>,
): Promise<ProductListingSummary> {
  return apiRequest(
    token,
    `/api/merchants/${merchantId}/stores/${storeId}/listings/${listingId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  )
}
