import type { MerchantSummary, StoreSummary } from '@cross-border/shared'
import { useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'

import { useMerchantsQuery, useStoresQuery } from '../queries/commerce.queries'
import { queryKeys } from '../queries/query-keys'
import { useAppSelector } from '../store/hooks'

interface BusinessContextValue {
  merchants: MerchantSummary[]
  stores: StoreSummary[]
  merchantId: string
  storeId: string
  currentMerchant?: MerchantSummary
  currentStore?: StoreSummary
  setMerchantId: (merchantId: string) => void
  setStoreId: (storeId: string) => void
  refreshStores: () => Promise<void>
}

const BusinessContext = createContext<BusinessContextValue | null>(null)
const merchantStorageKey = 'copilot.currentMerchantId'
const storeStorageKey = 'copilot.currentStoreId'
const emptyMerchants: MerchantSummary[] = []
const emptyStores: StoreSummary[] = []

export function BusinessContextProvider({ children }: { children: ReactNode }) {
  const token = useAppSelector((state) => state.auth.accessToken) ?? ''
  const queryClient = useQueryClient()
  const [selectedMerchantId, setSelectedMerchantId] = useState(
    () => window.localStorage.getItem(merchantStorageKey) ?? '',
  )
  const [selectedStoreId, setSelectedStoreId] = useState(
    () => window.localStorage.getItem(storeStorageKey) ?? '',
  )
  const merchantsQuery = useMerchantsQuery(token)
  const merchants = merchantsQuery.data ?? emptyMerchants
  const merchantId =
    merchants.find((record) => record.id === selectedMerchantId)?.id ??
    merchants[0]?.id ??
    ''
  const storesQuery = useStoresQuery(token, merchantId)
  const stores = storesQuery.data ?? emptyStores
  const storeId =
    stores.find(
      (record) => record.id === selectedStoreId && record.status === 'ACTIVE',
    )?.id ??
    stores.find((record) => record.status === 'ACTIVE')?.id ??
    ''

  const refreshStores = useCallback(async () => {
    if (!merchantId) return
    await queryClient.invalidateQueries({
      queryKey: queryKeys.stores(merchantId),
    })
  }, [merchantId, queryClient])

  const setMerchantId = useCallback((nextMerchantId: string) => {
    window.localStorage.setItem(merchantStorageKey, nextMerchantId)
    window.localStorage.removeItem(storeStorageKey)
    setSelectedStoreId('')
    setSelectedMerchantId(nextMerchantId)
  }, [])

  const setStoreId = useCallback((nextStoreId: string) => {
    window.localStorage.setItem(storeStorageKey, nextStoreId)
    setSelectedStoreId(nextStoreId)
  }, [])

  const value = useMemo<BusinessContextValue>(
    () => ({
      merchants,
      stores,
      merchantId,
      storeId,
      currentMerchant: merchants.find((item) => item.id === merchantId),
      currentStore: stores.find((item) => item.id === storeId),
      setMerchantId,
      setStoreId,
      refreshStores,
    }),
    [
      merchantId,
      merchants,
      refreshStores,
      setMerchantId,
      setStoreId,
      storeId,
      stores,
    ],
  )

  return (
    <BusinessContext.Provider value={value}>
      {children}
    </BusinessContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBusinessContext(): BusinessContextValue {
  const value = useContext(BusinessContext)
  if (!value) throw new Error('BusinessContextProvider is missing')
  return value
}
