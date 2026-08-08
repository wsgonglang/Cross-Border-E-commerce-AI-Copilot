import type { OrderSummary } from '@cross-border/shared'
import { Timeline, Typography } from 'antd'
import { useTranslation } from 'react-i18next'

import { formatDate } from '../order.constants'

interface OrderTimelineProps {
  events: OrderSummary['timeline']
}

export function OrderTimeline({ events }: OrderTimelineProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? i18n.language
  return (
    <section className="order-timeline-card">
      <Typography.Title level={5}>{t('orders.timeline')}</Typography.Title>
      <Timeline
        items={events.map((event) => ({
          color: event.type === 'BULK_OPERATION' ? 'purple' : 'blue',
          children: (
            <>
              <Typography.Text strong>{event.title}</Typography.Text>
              <div className="muted">
                {formatDate(event.createdAt, locale)}
                {event.actorName
                  ? ` · ${event.actorName}`
                  : ` · ${t('orders.system')}`}
              </div>
              {event.description ? <div>{event.description}</div> : null}
            </>
          ),
        }))}
      />
    </section>
  )
}
