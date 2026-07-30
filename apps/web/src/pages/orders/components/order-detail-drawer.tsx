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

import { AgentPanel } from '../../../components/agent-panel/agent-panel'
import {
  formatDate,
  fulfillmentMeta,
  paymentMeta,
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
  return (
    <Drawer title="订单详情" width={920} open={open} onClose={onClose}>
      {loading ? (
        <Spin />
      ) : data ? (
        <Tabs
          items={[
            {
              key: 'detail',
              label: '订单与时间线',
              children: (
                <div className="order-detail-grid">
                  <Descriptions
                    bordered
                    column={2}
                    size="small"
                    title="订单概览"
                  >
                    <Descriptions.Item label="订单号">
                      {data.orderNo}
                    </Descriptions.Item>
                    <Descriptions.Item label="店铺">
                      {data.store?.name ?? '未关联'}
                    </Descriptions.Item>
                    <Descriptions.Item label="生命周期">
                      <Tag color={statusMeta[data.status].color}>
                        {statusMeta[data.status].label}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="支付 / 履约">
                      <Space>
                        <Tag color={paymentMeta[data.paymentStatus].color}>
                          {paymentMeta[data.paymentStatus].label}
                        </Tag>
                        <Tag
                          color={fulfillmentMeta[data.fulfillmentStatus].color}
                        >
                          {fulfillmentMeta[data.fulfillmentStatus].label}
                        </Tag>
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="金额">
                      {data.currency} {data.totalAmount}
                    </Descriptions.Item>
                    <Descriptions.Item label="退款">
                      {data.currency} {data.refundAmount}
                    </Descriptions.Item>
                    <Descriptions.Item label="客户">
                      {data.customerName}
                    </Descriptions.Item>
                    <Descriptions.Item label="邮箱">
                      {data.customerEmail ?? '未提供'}
                    </Descriptions.Item>
                    <Descriptions.Item label="物流">
                      {[data.carrier, data.trackingNumber]
                        .filter(Boolean)
                        .join(' / ') || '暂无物流信息'}
                    </Descriptions.Item>
                    <Descriptions.Item label="下单时间">
                      {formatDate(data.createdAt)}
                    </Descriptions.Item>
                    <Descriptions.Item label="收货地址" span={2}>
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
                        : '未提供'}
                    </Descriptions.Item>
                  </Descriptions>

                  <Table
                    rowKey="id"
                    pagination={false}
                    dataSource={data.items}
                    columns={[
                      {
                        title: '商品',
                        dataIndex: 'productName',
                        key: 'productName',
                      },
                      { title: 'SKU', dataIndex: 'skuName', key: 'skuName' },
                      {
                        title: '单价',
                        dataIndex: 'unitPrice',
                        key: 'unitPrice',
                        render: (price: string) => `${data.currency} ${price}`,
                      },
                      {
                        title: '数量',
                        dataIndex: 'quantity',
                        key: 'quantity',
                      },
                      {
                        title: '小计',
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
                  订单 Agent
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
                    `查询订单 ${data.orderNo} 的状态`,
                    `分析订单 ${data.orderNo} 的支付和履约状态`,
                    `订单 ${data.orderNo} 下一步需要什么运营动作`,
                  ]}
                />
              ),
            },
          ]}
        />
      ) : (
        <Alert type="info" message="无法加载订单详情" />
      )}
    </Drawer>
  )
}
