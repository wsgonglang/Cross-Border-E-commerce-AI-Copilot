import type { OrderStatus, OrderSummary } from '@cross-border/shared'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getOrder, updateOrderStatus } from '../../../api/orders'
import { useLatestRequestGuard } from '../../../hooks/use-latest-request-guard'

interface UseOrderDetailInput {
  initialOrderId: string | null
  merchantId: string
  onError: (message: string) => void
  onUpdated: () => Promise<void>
  storeId?: string
  token: string
}

export function useOrderDetail({
  initialOrderId,
  merchantId,
  onError,
  onUpdated,
  storeId,
  token,
}: UseOrderDetailInput) {
  const { t } = useTranslation()
  const [orderId, setOrderId] = useState<string | null>(initialOrderId)
  const [data, setData] = useState<OrderSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const requestGuard = useLatestRequestGuard()

  useEffect(() => {
    const requestId = requestGuard.begin()
    const timer = window.setTimeout(() => {
      if (!orderId || !token || !merchantId) {
        setLoading(false)
        setData(null)
        return
      }
      setLoading(true)
      setData(null)
      void getOrder(token, merchantId, orderId, storeId)
        .then((result) => {
          if (requestGuard.isLatest(requestId)) setData(result)
        })
        .catch(() => {
          if (requestGuard.isLatest(requestId)) setData(null)
        })
        .finally(() => {
          if (requestGuard.isLatest(requestId)) setLoading(false)
        })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [merchantId, orderId, requestGuard, storeId, token])

  const close = useCallback(() => {
    requestGuard.invalidate()
    setOrderId(null)
    setData(null)
    setLoading(false)
  }, [requestGuard])

  const updateStatus = useCallback(
    async (targetOrderId: string, targetStatus: OrderStatus) => {
      if (!token || !merchantId) return
      try {
        const updated = await updateOrderStatus(
          token,
          merchantId,
          targetOrderId,
          targetStatus,
        )
        if (orderId === targetOrderId) setData(updated)
        await onUpdated()
      } catch (actionError: unknown) {
        onError(
          actionError instanceof Error
            ? actionError.message
            : t('orders.actionFailed'),
        )
      }
    },
    [merchantId, onError, onUpdated, orderId, t, token],
  )

  return {
    close,
    data,
    loading,
    open: setOrderId,
    orderId,
    updateStatus,
  }
}
