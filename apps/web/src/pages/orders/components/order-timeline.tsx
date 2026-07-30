import type { OrderSummary } from '@cross-border/shared'
import { Timeline, Typography } from 'antd'

import { formatDate } from '../order.constants'

interface OrderTimelineProps {
  events: OrderSummary['timeline']
}

export function OrderTimeline({ events }: OrderTimelineProps) {
  return (
    <section className="order-timeline-card">
      <Typography.Title level={5}>订单时间线</Typography.Title>
      <Timeline
        items={events.map((event) => ({
          color: event.type === 'BULK_OPERATION' ? 'purple' : 'blue',
          children: (
            <>
              <Typography.Text strong>{event.title}</Typography.Text>
              <div className="muted">
                {formatDate(event.createdAt)}
                {event.actorName ? ` · ${event.actorName}` : ' · 系统'}
              </div>
              {event.description ? <div>{event.description}</div> : null}
            </>
          ),
        }))}
      />
    </section>
  )
}
