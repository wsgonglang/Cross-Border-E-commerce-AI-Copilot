import type {
  OrderFilters,
  OrderSortField,
  OrderSortOrder,
  OrderSummary,
  PaginatedOrders,
} from '@cross-border/shared'
import type { TableProps } from 'antd'
import { useCallback, useEffect, useState } from 'react'

import { getOrders } from '../../../api/orders'

interface UseOrderListInput {
  initialFilters: OrderFilters
  merchantId: string
  onCriteriaChange: () => void
  storeId?: string
  token: string
}

export function useOrderList({
  initialFilters,
  merchantId,
  onCriteriaChange,
  storeId,
  token,
}: UseOrderListInput) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<PaginatedOrders | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [filters, setFilters] = useState<OrderFilters>(initialFilters)
  const [keywordDraft, setKeywordDraft] = useState(initialFilters.keyword ?? '')
  const [sortBy, setSortBy] = useState<OrderSortField>('createdAt')
  const [sortOrder, setSortOrder] = useState<OrderSortOrder>('desc')

  const loadOrders = useCallback(async () => {
    if (!token || !merchantId) return
    setLoading(true)
    setError(null)
    try {
      setData(
        await getOrders(token, merchantId, {
          page,
          pageSize,
          ...filters,
          storeId: storeId || undefined,
          sortBy,
          sortOrder,
        }),
      )
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : '加载订单失败')
    } finally {
      setLoading(false)
    }
  }, [filters, merchantId, page, pageSize, sortBy, sortOrder, storeId, token])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadOrders(), 0)
    return () => window.clearTimeout(timer)
  }, [loadOrders])

  const patchFilters = useCallback(
    (patch: Partial<OrderFilters>) => {
      setFilters((current) => ({ ...current, ...patch }))
      setPage(1)
      onCriteriaChange()
    },
    [onCriteriaChange],
  )

  const resetCriteria = useCallback(() => {
    setFilters({})
    setKeywordDraft('')
    setSortBy('createdAt')
    setSortOrder('desc')
    setPage(1)
    onCriteriaChange()
  }, [onCriteriaChange])

  const handleTableChange = useCallback(
    (
      ...[pagination, , sorter]: Parameters<
        NonNullable<TableProps<OrderSummary>['onChange']>
      >
    ) => {
      setPage(pagination.current ?? 1)
      setPageSize(pagination.pageSize ?? 10)
      const currentSorter = Array.isArray(sorter) ? sorter[0] : sorter
      if (!currentSorter?.field || !currentSorter.order) return
      const field =
        currentSorter.field === 'totalAmount'
          ? 'totalAmount'
          : currentSorter.field === 'orderNo'
            ? 'orderNo'
            : 'createdAt'
      setSortBy(field)
      setSortOrder(currentSorter.order === 'ascend' ? 'asc' : 'desc')
      onCriteriaChange()
    },
    [onCriteriaChange],
  )

  return {
    data,
    error,
    filters,
    handleTableChange,
    keywordDraft,
    loadOrders,
    loading,
    page,
    pageSize,
    patchFilters,
    resetCriteria,
    setError,
    setFilters,
    setKeywordDraft,
    setPage,
    setSortBy,
    setSortOrder,
    sortBy,
    sortOrder,
  }
}
