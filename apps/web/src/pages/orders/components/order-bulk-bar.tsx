import type { OrderBulkAction } from '@cross-border/shared'
import { Button, Select, Typography } from 'antd'

import { bulkOptions, type OrderRole } from '../order.constants'

interface OrderBulkBarProps {
  action?: OrderBulkAction
  onActionChange: (action: OrderBulkAction) => void
  onRun: () => void
  role: Exclude<OrderRole, 'viewer'>
  running: boolean
  selectedCount: number
}

export function OrderBulkBar({
  action,
  onActionChange,
  onRun,
  role,
  running,
  selectedCount,
}: OrderBulkBarProps) {
  return (
    <section className="order-bulk-bar" aria-label="订单批量操作">
      <Typography.Text>已选择 {selectedCount} 个订单</Typography.Text>
      <Select
        className="order-bulk-select"
        placeholder="选择批量操作"
        value={action}
        onChange={onActionChange}
        options={bulkOptions.filter(
          (option) => role === 'admin' || !option.adminOnly,
        )}
      />
      <Button
        type="primary"
        loading={running}
        disabled={!action || selectedCount === 0}
        onClick={onRun}
      >
        执行并查看逐单结果
      </Button>
    </section>
  )
}
