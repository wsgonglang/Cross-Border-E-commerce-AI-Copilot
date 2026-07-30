import type {
  OrderFilters,
  OrderSortField,
  OrderSortOrder,
  OrderSummary,
} from '@cross-border/shared'
import type { TableProps } from 'antd'
import { useCallback, useState } from 'react'

import { useOrdersQuery } from '../../../queries/operations.queries'

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
  const [dismissedErrorAt, setDismissedErrorAt] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [filters, setFilters] = useState<OrderFilters>(initialFilters)
  const [keywordDraft, setKeywordDraft] = useState(initialFilters.keyword ?? '')
  const [sortBy, setSortBy] = useState<OrderSortField>('createdAt')
  const [sortOrder, setSortOrder] = useState<OrderSortOrder>('desc')

  const ordersQuery = useOrdersQuery(token, merchantId, {
    page,
    pageSize,
    ...filters,
    storeId: storeId || undefined,
    sortBy,
    sortOrder,
  })
  const loadOrders = useCallback(async () => {
    await ordersQuery.refetch()
  }, [ordersQuery])
  const queryError =
    ordersQuery.error instanceof Error ? ordersQuery.error.message : null
  const error =
    ordersQuery.errorUpdatedAt === dismissedErrorAt ? null : queryError
  const setError = useCallback(
    (next: string | null) => {
      if (next === null) setDismissedErrorAt(ordersQuery.errorUpdatedAt)
    },
    [ordersQuery.errorUpdatedAt],
  )

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
    data: ordersQuery.data ?? null,
    error,
    filters,
    handleTableChange,
    keywordDraft,
    loadOrders,
    loading: ordersQuery.isFetching,
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
