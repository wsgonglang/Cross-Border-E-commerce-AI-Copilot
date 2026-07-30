import type {
  FulfillmentStatus,
  OrderFilters,
  OrderStatus,
  PaymentStatus,
} from '@cross-border/shared'
import { Button, Input, Select } from 'antd'

import { fulfillmentMeta, paymentMeta, statusMeta } from '../order.constants'

interface OrderFilterCardProps {
  filters: OrderFilters
  keywordDraft: string
  onKeywordDraftChange: (value: string) => void
  onPatch: (patch: Partial<OrderFilters>) => void
  onReset: () => void
}

export function OrderFilterCard({
  filters,
  keywordDraft,
  onKeywordDraftChange,
  onPatch,
  onReset,
}: OrderFilterCardProps) {
  return (
    <section className="order-filter-card" aria-label="订单筛选">
      <Input.Search
        className="order-keyword-search"
        allowClear
        placeholder="订单号或客户名称"
        value={keywordDraft}
        onChange={(event) => onKeywordDraftChange(event.target.value)}
        onSearch={(value) => onPatch({ keyword: value.trim() || undefined })}
      />
      <Select<OrderStatus[]>
        mode="multiple"
        maxTagCount="responsive"
        className="order-lifecycle-select"
        placeholder="生命周期"
        value={filters.statuses}
        onChange={(statuses) =>
          onPatch({ statuses: statuses.length ? statuses : undefined })
        }
        options={Object.entries(statusMeta).map(([value, meta]) => ({
          value: value as OrderStatus,
          label: meta.label,
        }))}
      />
      <Select<PaymentStatus[]>
        mode="multiple"
        maxTagCount="responsive"
        className="order-dimension-select"
        placeholder="支付状态"
        value={filters.paymentStatuses}
        onChange={(statuses) =>
          onPatch({
            paymentStatuses: statuses.length ? statuses : undefined,
          })
        }
        options={Object.entries(paymentMeta).map(([value, meta]) => ({
          value: value as PaymentStatus,
          label: meta.label,
        }))}
      />
      <Select<FulfillmentStatus[]>
        mode="multiple"
        maxTagCount="responsive"
        className="order-dimension-select"
        placeholder="履约状态"
        value={filters.fulfillmentStatuses}
        onChange={(statuses) =>
          onPatch({
            fulfillmentStatuses: statuses.length ? statuses : undefined,
          })
        }
        options={Object.entries(fulfillmentMeta).map(([value, meta]) => ({
          value: value as FulfillmentStatus,
          label: meta.label,
        }))}
      />
      <Input
        type="date"
        className="order-date-input"
        aria-label="开始日期"
        value={filters.startDate?.slice(0, 10) ?? ''}
        onChange={(event) =>
          onPatch({
            startDate: event.target.value
              ? new Date(`${event.target.value}T00:00:00`).toISOString()
              : undefined,
          })
        }
      />
      <Input
        type="date"
        className="order-date-input"
        aria-label="结束日期"
        value={filters.endDate?.slice(0, 10) ?? ''}
        onChange={(event) =>
          onPatch({
            endDate: event.target.value
              ? new Date(`${event.target.value}T23:59:59.999`).toISOString()
              : undefined,
          })
        }
      />
      <Input
        className="order-amount-input"
        placeholder="最低金额"
        value={filters.minAmount}
        onChange={(event) =>
          onPatch({ minAmount: event.target.value || undefined })
        }
      />
      <Input
        className="order-amount-input"
        placeholder="最高金额"
        value={filters.maxAmount}
        onChange={(event) =>
          onPatch({ maxAmount: event.target.value || undefined })
        }
      />
      <Button onClick={onReset}>重置</Button>
    </section>
  )
}
