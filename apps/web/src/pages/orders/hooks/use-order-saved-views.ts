import type {
  OrderFilters,
  OrderSavedView,
  OrderSortField,
  OrderSortOrder,
  OrderViewColumn,
} from '@cross-border/shared'
import { useCallback, useEffect, useState } from 'react'

import {
  createOrderSavedView,
  deleteOrderSavedView,
  getOrderSavedViews,
  updateOrderSavedView,
} from '../../../api/orders'

export interface OrderViewSnapshot extends OrderFilters {
  columns: OrderViewColumn[]
  sortBy: OrderSortField
  sortOrder: OrderSortOrder
  storeId?: string
}

interface UseOrderSavedViewsInput {
  merchantId: string
  onError: (message: string) => void
  token: string
}

export function useOrderSavedViews({
  merchantId,
  onError,
  token,
}: UseOrderSavedViewsInput) {
  const [views, setViews] = useState<OrderSavedView[]>([])
  const [activeViewId, setActiveViewId] = useState<string>()

  useEffect(() => {
    if (!token || !merchantId) return
    void getOrderSavedViews(token, merchantId)
      .then(setViews)
      .catch(() => setViews([]))
  }, [merchantId, token])

  const createView = useCallback(
    async (name: string, isDefault: boolean, snapshot: OrderViewSnapshot) => {
      if (!token || !merchantId || !name.trim()) return false
      try {
        const created = await createOrderSavedView(token, merchantId, {
          name: name.trim(),
          ...snapshot,
          isDefault,
        })
        setViews((records) => [
          created,
          ...records.map((record) =>
            created.isDefault ? { ...record, isDefault: false } : record,
          ),
        ])
        setActiveViewId(created.id)
        return true
      } catch (error: unknown) {
        onError(error instanceof Error ? error.message : '保存视图失败')
        return false
      }
    },
    [merchantId, onError, token],
  )

  const overwriteView = useCallback(
    async (snapshot: OrderViewSnapshot) => {
      if (!token || !merchantId || !activeViewId) return false
      try {
        const updated = await updateOrderSavedView(
          token,
          merchantId,
          activeViewId,
          snapshot,
        )
        setViews((records) =>
          records.map((record) =>
            record.id === updated.id ? updated : record,
          ),
        )
        return true
      } catch (error: unknown) {
        onError(error instanceof Error ? error.message : '更新视图失败')
        return false
      }
    },
    [activeViewId, merchantId, onError, token],
  )

  const removeView = useCallback(async () => {
    if (!token || !merchantId || !activeViewId) return false
    try {
      await deleteOrderSavedView(token, merchantId, activeViewId)
      setViews((records) =>
        records.filter((record) => record.id !== activeViewId),
      )
      setActiveViewId(undefined)
      return true
    } catch (error: unknown) {
      onError(error instanceof Error ? error.message : '删除视图失败')
      return false
    }
  }, [activeViewId, merchantId, onError, token])

  return {
    activeViewId,
    createView,
    overwriteView,
    removeView,
    setActiveViewId,
    views,
  }
}
