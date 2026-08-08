import type { OrderBulkAction } from '@cross-border/shared'
import { Button, Select, Typography } from 'antd'
import { useTranslation } from 'react-i18next'

import { bulkDefinitions, type OrderRole } from '../order.constants'

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
  const { t } = useTranslation()
  return (
    <section className="order-bulk-bar" aria-label={t('orders.bulk')}>
      <Typography.Text>
        {t('orders.selected', { count: selectedCount })}
      </Typography.Text>
      <Select
        className="order-bulk-select"
        placeholder={t('orders.selectBulk')}
        value={action}
        onChange={onActionChange}
        options={bulkDefinitions
          .filter((option) => role === 'admin' || !option.adminOnly)
          .map((option) => ({
            value: option.value,
            label: t(option.labelKey),
          }))}
      />
      <Button
        type="primary"
        loading={running}
        disabled={!action || selectedCount === 0}
        onClick={onRun}
      >
        {t('orders.executeBulk')}
      </Button>
    </section>
  )
}
