import type {
  OrderBulkAction,
  OrderBulkOperationResult,
} from '@cross-border/shared'
import type { Key } from 'react'
import { useCallback, useState } from 'react'

import { executeOrderBulkAction } from '../../../api/orders'

interface UseOrderBulkActionsInput {
  merchantId: string
  onError: (message: string) => void
  onUpdated: () => Promise<void>
  token: string
}

export function useOrderBulkActions({
  merchantId,
  onError,
  onUpdated,
  token,
}: UseOrderBulkActionsInput) {
  const [selectedIds, setSelectedIds] = useState<Key[]>([])
  const [action, setAction] = useState<OrderBulkAction>()
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<OrderBulkOperationResult | null>(null)

  const run = useCallback(async () => {
    if (!token || !merchantId || !action || selectedIds.length === 0) return
    setRunning(true)
    try {
      const nextResult = await executeOrderBulkAction(token, merchantId, {
        action,
        orderIds: selectedIds.map(String),
        idempotencyKey: crypto.randomUUID(),
      })
      setResult(nextResult)
      setSelectedIds([])
      await onUpdated()
    } catch (error: unknown) {
      onError(error instanceof Error ? error.message : '批量操作失败')
    } finally {
      setRunning(false)
    }
  }, [action, merchantId, onError, onUpdated, selectedIds, token])

  return {
    action,
    result,
    run,
    running,
    selectedIds,
    setAction,
    setResult,
    setSelectedIds,
  }
}
