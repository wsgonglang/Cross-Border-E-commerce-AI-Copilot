import { RobotOutlined } from '@ant-design/icons'
import type { OrderSummary } from '@cross-border/shared'
import {
  Alert,
  Descriptions,
  Drawer,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
} from 'antd'
import { useTranslation } from 'react-i18next'

import { AgentPanel } from '../../../components/agent-panel/agent-panel'
import {
  formatDate,
  fulfillmentLabel,
  fulfillmentMeta,
  paymentLabel,
  paymentMeta,
  statusLabel,
  statusMeta,
  type OrderRole,
} from '../order.constants'
import { OrderTimeline } from './order-timeline'

interface OrderDetailDrawerProps {
  data: OrderSummary | null
  loading: boolean
  merchantId: string
  onClose: () => void
  open: boolean
  role: OrderRole
  token: string
}

export function OrderDetailDrawer({
  data,
  loading,
  merchantId,
  onClose,
  open,
  role,
  token,
}: OrderDetailDrawerProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? i18n.language
  return (
    <Drawer
      title={t('orders.detailTitle')}
      width={920}
      open={open}
      onClose={onClose}
    >
      {loading ? (
        <Spin />
      ) : data ? (
        <Tabs
          items={[
            {
              key: 'detail',
              label: t('orders.orderAndTimeline'),
              children: (
                <div className="order-detail-grid">
                  <Descriptions
                    bordered
                    column={2}
                    size="small"
                    title={t('orders.overview')}
                  >
                    <Descriptions.Item label={t('orders.orderNo')}>
                      {data.orderNo}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('orders.store')}>
                      {data.store?.name ?? t('orders.unlinked')}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('orders.lifecycle')}>
                      <Tag color={statusMeta[data.status].color}>
                        {statusLabel(t, data.status)}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label={t('orders.paymentFulfillment')}>
                      <Space>
                        <Tag color={paymentMeta[data.paymentStatus].color}>
                          {paymentLabel(t, data.paymentStatus)}
                        </Tag>
                        <Tag
                          color={fulfillmentMeta[data.fulfillmentStatus].color}
                        >
                          {fulfillmentLabel(t, data.fulfillmentStatus)}
                        </Tag>
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label={t('orders.amount')}>
                      {data.currency} {data.totalAmount}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('orders.refund')}>
                      {data.currency} {data.refundAmount}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('orders.customer')}>
                      {data.customerName}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('orders.email')}>
                      {data.customerEmail ?? t('orders.notProvided')}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('orders.logistics')}>
                      {[data.carrier, data.trackingNumber]
                        .filter(Boolean)
                        .join(' / ') || t('orders.noLogistics')}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('orders.createdAt')}>
                      {formatDate(data.createdAt, locale)}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('orders.address')} span={2}>
                      {data.shippingAddress
                        ? [
                            data.shippingAddress.recipient,
                            data.shippingAddress.phone,
                            data.shippingAddress.line1,
                            data.shippingAddress.line2,
                            data.shippingAddress.city,
                            data.shippingAddress.region,
                            data.shippingAddress.postalCode,
                            data.shippingAddress.country,
                          ]
                            .filter(Boolean)
                            .join(' · ')
                        : t('orders.notProvided')}
                    </Descriptions.Item>
                  </Descriptions>

                  <Table
                    rowKey="id"
                    pagination={false}
                    dataSource={data.items}
                    columns={[
                      {
                        title: t('orders.product'),
                        dataIndex: 'productName',
                        key: 'productName',
                      },
                      { title: 'SKU', dataIndex: 'skuName', key: 'skuName' },
                      {
                        title: t('orders.unitPrice'),
                        dataIndex: 'unitPrice',
                        key: 'unitPrice',
                        render: (price: string) => `${data.currency} ${price}`,
                      },
                      {
                        title: t('orders.quantity'),
                        dataIndex: 'quantity',
                        key: 'quantity',
                      },
                      {
                        title: t('orders.subtotal'),
                        dataIndex: 'subtotal',
                        key: 'subtotal',
                        render: (subtotal: string) =>
                          `${data.currency} ${subtotal}`,
                      },
                    ]}
                  />

                  <OrderTimeline events={data.timeline} />
                </div>
              ),
            },
            {
              key: 'agent',
              label: (
                <Space>
                  <RobotOutlined />
                  {t('orders.agent')}
                </Space>
              ),
              children: (
                <AgentPanel
                  token={token}
                  merchantId={merchantId}
                  storeId={data.storeId ?? undefined}
                  storeName={data.store?.name}
                  sourcePage={`orders:${data.id}`}
                  canWrite={role !== 'viewer'}
                  quickPrompts={[
                    t('orders.agentPrompts.status', { orderNo: data.orderNo }),
                    t('orders.agentPrompts.analysis', {
                      orderNo: data.orderNo,
                    }),
                    t('orders.agentPrompts.next', { orderNo: data.orderNo }),
                  ]}
                />
              ),
            },
          ]}
        />
      ) : (
        <Alert type="info" message={t('orders.loadDetailFailed')} />
      )}
    </Drawer>
  )
}
