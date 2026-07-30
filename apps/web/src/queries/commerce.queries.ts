import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { getMerchants, getProducts } from '../api/commerce'
import { getStores } from '../api/stores'
import { queryKeys, type ProductQueryInput } from './query-keys'

export function useMerchantsQuery(token: string) {
  return useQuery({
    queryKey: queryKeys.merchants,
    queryFn: () => getMerchants(token),
    enabled: Boolean(token),
  })
}

export function useStoresQuery(token: string, merchantId: string) {
  return useQuery({
    queryKey: queryKeys.stores(merchantId),
    queryFn: () => getStores(token, merchantId),
    enabled: Boolean(token && merchantId),
  })
}

export function useProductsQuery(
  token: string,
  merchantId: string,
  input: ProductQueryInput,
) {
  return useQuery({
    queryKey: queryKeys.products(merchantId, input),
    queryFn: () => getProducts(token, merchantId, input),
    enabled: Boolean(token && merchantId),
    placeholderData: keepPreviousData,
  })
}
