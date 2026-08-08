import type {
  FulfillmentStatus,
  OrderFilters,
  OrderStatus,
  PaymentStatus,
} from '@cross-border/shared'
import { Button, Input, Select } from 'antd'
import { useTranslation } from 'react-i18next'

import {
  fulfillmentLabel,
  fulfillmentMeta,
  paymentLabel,
  paymentMeta,
  statusLabel,
  statusMeta,
} from '../order.constants'

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
  const { t } = useTranslation()
  return (
    <section className="order-filter-card" aria-label={t('orders.filter')}>
      <Input.Search
        className="order-keyword-search"
        allowClear
        placeholder={t('orders.search')}
        value={keywordDraft}
        onChange={(event) => onKeywordDraftChange(event.target.value)}
        onSearch={(value) => onPatch({ keyword: value.trim() || undefined })}
      />
      <Select<OrderStatus[]>
        mode="multiple"
        maxTagCount="responsive"
        className="order-lifecycle-select"
        placeholder={t('orders.lifecycle')}
        value={filters.statuses}
        onChange={(statuses) =>
          onPatch({ statuses: statuses.length ? statuses : undefined })
        }
        options={Object.keys(statusMeta).map((value) => ({
          value: value as OrderStatus,
          label: statusLabel(t, value as OrderStatus),
        }))}
      />
      <Select<PaymentStatus[]>
        mode="multiple"
        maxTagCount="responsive"
        className="order-dimension-select"
        placeholder={t('orders.paymentStatus')}
        value={filters.paymentStatuses}
        onChange={(statuses) =>
          onPatch({
            paymentStatuses: statuses.length ? statuses : undefined,
          })
        }
        options={Object.keys(paymentMeta).map((value) => ({
          value: value as PaymentStatus,
          label: paymentLabel(t, value as PaymentStatus),
        }))}
      />
      <Select<FulfillmentStatus[]>
        mode="multiple"
        maxTagCount="responsive"
        className="order-dimension-select"
        placeholder={t('orders.fulfillmentStatus')}
        value={filters.fulfillmentStatuses}
        onChange={(statuses) =>
          onPatch({
            fulfillmentStatuses: statuses.length ? statuses : undefined,
          })
        }
        options={Object.keys(fulfillmentMeta).map((value) => ({
          value: value as FulfillmentStatus,
          label: fulfillmentLabel(t, value as FulfillmentStatus),
        }))}
      />
      <Input
        type="date"
        className="order-date-input"
        aria-label={t('orders.startDate')}
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
        aria-label={t('orders.endDate')}
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
        placeholder={t('orders.minAmount')}
        value={filters.minAmount}
        onChange={(event) =>
          onPatch({ minAmount: event.target.value || undefined })
        }
      />
      <Input
        className="order-amount-input"
        placeholder={t('orders.maxAmount')}
        value={filters.maxAmount}
        onChange={(event) =>
          onPatch({ maxAmount: event.target.value || undefined })
        }
      />
      <Button onClick={onReset}>{t('orders.reset')}</Button>
    </section>
  )
}
