import {
  Alert,
  Button,
  Descriptions,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tag,
} from 'antd'
import { useEffect, useState } from 'react'

import type {
  OrderStatus,
  OrderSummary,
  PaginatedOrders,
} from '@cross-border/shared'

import { getOrder, getOrders, updateOrderStatus } from '../api/orders'
import { useBusinessContext } from '../contexts/business-context'
import { useAppSelector } from '../store/hooks'

const statusMeta: Record<OrderStatus, { color: string; label: string }> = {
  PENDING: { color: 'orange', label: '待确认' },
  CONFIRMED: { color: 'blue', label: '已确认' },
  SHIPPED: { color: 'purple', label: '已发货' },
  DELIVERED: { color: 'cyan', label: '已送达' },
  COMPLETED: { color: 'green', label: '已完成' },
  CANCELLED: { color: 'red', label: '已取消' },
  REFUNDING: { color: 'volcano', label: '退款中' },
  REFUNDED: { color: 'default', label: '已退款' },
}

const actionSteps = [
  { from: 'PENDING', to: 'CONFIRMED', label: '确认订单', minRole: 'operator' },
  { from: 'PENDING', to: 'CANCELLED', label: '取消订单', minRole: 'operator' },
  { from: 'CONFIRMED', to: 'SHIPPED', label: '标记发货', minRole: 'operator' },
  { from: 'CONFIRMED', to: 'CANCELLED', label: '取消订单', minRole: 'admin' },
  { from: 'SHIPPED', to: 'DELIVERED', label: '标记送达', minRole: 'operator' },
  { from: 'DELIVERED', to: 'COMPLETED', label: '完成订单', minRole: 'admin' },
  { from: 'DELIVERED', to: 'REFUNDING', label: '发起退款', minRole: 'admin' },
  { from: 'COMPLETED', to: 'REFUNDING', label: '发起退款', minRole: 'admin' },
  { from: 'REFUNDING', to: 'REFUNDED', label: '确认退款', minRole: 'admin' },
]

function canAct(role: string, minRole: string): boolean {
  if (minRole === 'admin') return role === 'admin'
  return role === 'admin' || role === 'operator'
}

export function OrdersPage() {
  const token = useAppSelector((state) => state.auth.accessToken) ?? ''
  const user = useAppSelector((state) => state.auth.user)
  const role = user?.roles.includes('admin')
    ? 'admin'
    : user?.roles.includes('operator')
      ? 'operator'
      : 'viewer'

  const { merchantId, storeId, currentStore } = useBusinessContext()

  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<PaginatedOrders | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [status, setStatus] = useState<OrderStatus | undefined>(undefined)
  const [keyword, setKeyword] = useState('')

  // Detail modal
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)
  const [detailData, setDetailData] = useState<OrderSummary | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    if (!token || !merchantId) return
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await getOrders(token, merchantId, {
          page,
          pageSize,
          status,
          keyword: keyword || undefined,
          storeId: storeId || undefined,
        })
        setData(result)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : '加载订单失败')
      } finally {
        setLoading(false)
      }
    }
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, merchantId, storeId, page, pageSize, status])

  const fetchOrders = () => {
    if (!token || !merchantId) return
    setLoading(true)
    setError(null)
    getOrders(token, merchantId, {
      page,
      pageSize,
      status,
      keyword: keyword || undefined,
      storeId: storeId || undefined,
    })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!detailOrderId || !token || !merchantId) return
    const load = async () => {
      setDetailLoading(true)
      setDetailData(null)
      try {
        const result = await getOrder(
          token,
          merchantId,
          detailOrderId,
          storeId || undefined,
        )
        setDetailData(result)
      } catch {
        setDetailData(null)
      } finally {
        setDetailLoading(false)
      }
    }
    void load()
  }, [detailOrderId, token, merchantId, storeId])

  const handleAction = async (orderId: string, targetStatus: string) => {
    if (!token || !merchantId) return
    try {
      await updateOrderStatus(token, merchantId, orderId, targetStatus)
      setDetailData(null)
      setDetailOrderId(null)
      fetchOrders()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '操作失败')
    }
  }

  const columns = [
    {
      title: '店铺',
      key: 'store',
      render: (_: unknown, record: OrderSummary) =>
        record.store?.name ?? '未关联',
    },
    {
      title: '订单号',
      dataIndex: 'orderNo',
      key: 'orderNo',
    },
    {
      title: '客户',
      dataIndex: 'customerName',
      key: 'customerName',
    },
    {
      title: '金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount: string, record: OrderSummary) =>
        `${record.currency === 'USD' ? '$' : ''}${amount}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: OrderStatus) => {
        const meta = statusMeta[s]
        if (!meta) {
          return <Tag>{s}</Tag>
        }
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '下单时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (t: string) =>
        new Date(t).toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: OrderSummary) => (
        <Space>
          <a
            onClick={() => setDetailOrderId(record.id)}
            role="button"
            tabIndex={0}
            onKeyDown={() => {}}
          >
            查看
          </a>
          {actionSteps
            .filter((a) => a.from === record.status && canAct(role, a.minRole))
            .map((a) => (
              <Button
                key={a.to}
                type="link"
                size="small"
                onClick={() => void handleAction(record.id, a.to)}
              >
                {a.label}
              </Button>
            ))}
        </Space>
      ),
    },
  ]

  if (!token) {
    return (
      <main className="workspace-page">
        <Spin />
      </main>
    )
  }

  return (
    <main className="workspace-page">
      <header className="workspace-header">
        <div>
          <span className="page-kicker">订单管理</span>
          <h1>订单</h1>
          <p>
            {currentStore
              ? `当前仅显示 ${currentStore.name} 的订单`
              : '查看和管理商家全部订单'}
          </p>
        </div>
      </header>

      {error ? (
        <Alert
          type="error"
          message={error}
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 18 }}
        />
      ) : null}

      <div className="table-card">
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            padding: '16px 16px 0',
            flexWrap: 'wrap',
          }}
        >
          <Select
            style={{ width: 140 }}
            allowClear
            placeholder="状态筛选"
            value={status}
            onChange={(value) => {
              setStatus(value || undefined)
              setPage(1)
            }}
            options={Object.entries(statusMeta).map(([value, meta]) => ({
              label: meta.label,
              value,
            }))}
          />
          <Input.Search
            style={{ width: 220 }}
            allowClear
            placeholder="搜索订单号"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={() => setPage(1)}
          />
          <span style={{ color: '#6a817d', fontSize: 13 }}>
            共 {data?.total ?? 0} 条
          </span>
        </div>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data?.items ?? []}
          pagination={{
            current: page,
            pageSize,
            total: data?.total ?? 0,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          style={{ marginTop: 8 }}
        />
      </div>

      <Modal
        title="订单详情"
        open={detailOrderId !== null}
        onCancel={() => {
          setDetailOrderId(null)
          setDetailData(null)
        }}
        footer={null}
        width={700}
      >
        {detailLoading ? (
          <Spin />
        ) : detailData ? (
          <>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="订单号">
                {detailData.orderNo}
              </Descriptions.Item>
              <Descriptions.Item label="客户">
                {detailData.customerName}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {(() => {
                  const meta = statusMeta[detailData.status]
                  return (
                    <Tag color={meta?.color ?? 'default'}>
                      {meta?.label ?? detailData.status}
                    </Tag>
                  )
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="金额">
                {detailData.currency === 'USD' ? '$' : ''}
                {detailData.totalAmount}
              </Descriptions.Item>
              {detailData.customerEmail ? (
                <Descriptions.Item label="邮箱">
                  {detailData.customerEmail}
                </Descriptions.Item>
              ) : null}
              <Descriptions.Item label="下单时间">
                {new Date(detailData.createdAt).toLocaleString('zh-CN')}
              </Descriptions.Item>
            </Descriptions>

            <Table
              style={{ marginTop: 16 }}
              rowKey="id"
              pagination={false}
              dataSource={detailData.items}
              columns={[
                {
                  title: '商品',
                  dataIndex: 'productName',
                  key: 'productName',
                },
                {
                  title: 'SKU',
                  dataIndex: 'skuName',
                  key: 'skuName',
                },
                {
                  title: '单价',
                  dataIndex: 'unitPrice',
                  key: 'unitPrice',
                  render: (price: string) => `$${price}`,
                },
                {
                  title: '数量',
                  dataIndex: 'quantity',
                  key: 'quantity',
                },
                {
                  title: '小计',
                  key: 'subtotal',
                  render: (_: unknown, item: { subtotal: string }) =>
                    `$${item.subtotal}`,
                },
              ]}
            />
          </>
        ) : (
          <Alert type="info" message="无法加载订单详情" />
        )}
      </Modal>
    </main>
  )
}
