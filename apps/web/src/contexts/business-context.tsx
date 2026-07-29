import type { MerchantSummary, StoreSummary } from '@cross-border/shared'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { getMerchants } from '../api/commerce'
import { getStores } from '../api/stores'
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

export function BusinessContextProvider({ children }: { children: ReactNode }) {
  const token = useAppSelector((state) => state.auth.accessToken) ?? ''
  const [merchants, setMerchants] = useState<MerchantSummary[]>([])
  const [stores, setStores] = useState<StoreSummary[]>([])
  const [merchantId, setMerchantIdState] = useState('')
  const [storeId, setStoreIdState] = useState('')

  useEffect(() => {
    if (!token) return
    void getMerchants(token).then((records) => {
      setMerchants(records)
      const saved = window.localStorage.getItem(merchantStorageKey)
      setMerchantIdState(
        records.find((record) => record.id === saved)?.id ??
          records[0]?.id ??
          '',
      )
    })
  }, [token])

  const refreshStores = useCallback(async () => {
    if (!token || !merchantId) {
      setStores([])
      setStoreIdState('')
      return
    }
    const records = await getStores(token, merchantId)
    setStores(records)
    const saved = window.localStorage.getItem(storeStorageKey)
    setStoreIdState((current) => {
      const candidate = current || saved
      return (
        records.find(
          (record) => record.id === candidate && record.status === 'ACTIVE',
        )?.id ??
        records.find((record) => record.status === 'ACTIVE')?.id ??
        ''
      )
    })
  }, [merchantId, token])

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshStores(), 0)
    return () => window.clearTimeout(timer)
  }, [refreshStores])

  const setMerchantId = useCallback((nextMerchantId: string) => {
    window.localStorage.setItem(merchantStorageKey, nextMerchantId)
    window.localStorage.removeItem(storeStorageKey)
    setStoreIdState('')
    setMerchantIdState(nextMerchantId)
  }, [])

  const setStoreId = useCallback((nextStoreId: string) => {
    window.localStorage.setItem(storeStorageKey, nextStoreId)
    setStoreIdState(nextStoreId)
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
