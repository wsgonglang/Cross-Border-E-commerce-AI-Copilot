import {
  DeleteOutlined,
  RobotOutlined,
  SaveOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import type {
  FulfillmentStatus,
  OrderBulkAction,
  OrderBulkOperationResult,
  OrderFilters,
  OrderSavedView,
  OrderSortField,
  OrderSortOrder,
  OrderStatus,
  OrderSummary,
  OrderViewColumn,
  PaginatedOrders,
  PaymentStatus,
} from '@cross-border/shared'
import {
  Alert,
  Button,
  Checkbox,
  Descriptions,
  Drawer,
  Input,
  Modal,
  Popconfirm,
  Popover,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd'
import type { TableColumnsType, TableProps } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  createOrderSavedView,
  deleteOrderSavedView,
  executeOrderBulkAction,
  getOrder,
  getOrders,
  getOrderSavedViews,
  updateOrderSavedView,
  updateOrderStatus,
} from '../api/orders'
import { AgentPanel } from '../components/agent-panel'
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

const paymentMeta: Record<PaymentStatus, { color: string; label: string }> = {
  UNPAID: { color: 'orange', label: '未支付' },
  PAID: { color: 'green', label: '已支付' },
  PARTIALLY_REFUNDED: { color: 'volcano', label: '部分退款' },
  REFUNDED: { color: 'default', label: '已退款' },
}

const fulfillmentMeta: Record<
  FulfillmentStatus,
  { color: string; label: string }
> = {
  UNFULFILLED: { color: 'orange', label: '未履约' },
  PROCESSING: { color: 'blue', label: '处理中' },
  SHIPPED: { color: 'purple', label: '已发货' },
  DELIVERED: { color: 'green', label: '已送达' },
  CANCELLED: { color: 'red', label: '已取消' },
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
] as const

const allColumns: Array<{ value: OrderViewColumn; label: string }> = [
  { value: 'store', label: '店铺' },
  { value: 'orderNo', label: '订单号' },
  { value: 'customer', label: '客户' },
  { value: 'amount', label: '金额' },
  { value: 'status', label: '生命周期' },
  { value: 'paymentStatus', label: '支付状态' },
  { value: 'fulfillmentStatus', label: '履约状态' },
  { value: 'createdAt', label: '下单时间' },
]
const defaultColumns = allColumns.map((item) => item.value)

const bulkOptions: Array<{
  value: OrderBulkAction
  label: string
  adminOnly?: boolean
}> = [
  { value: 'CONFIRM', label: '批量确认' },
  { value: 'MARK_SHIPPED', label: '批量发货' },
  { value: 'MARK_DELIVERED', label: '批量送达' },
  { value: 'CANCEL', label: '批量取消' },
  { value: 'START_REFUND', label: '批量发起退款', adminOnly: true },
  { value: 'CONFIRM_REFUND', label: '批量确认退款', adminOnly: true },
]

function canAct(role: string, minRole: string): boolean {
  if (minRole === 'admin') return role === 'admin'
  return role === 'admin' || role === 'operator'
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function readOrderStatuses(value: string | null): OrderStatus[] | undefined {
  if (!value) return undefined
  const knownStatuses = new Set(Object.keys(statusMeta))
  const statuses = value
    .split(',')
    .filter((status): status is OrderStatus => knownStatuses.has(status))
  return statuses.length > 0 ? statuses : undefined
}

export function OrdersPage() {
  const [searchParams] = useSearchParams()
  const token = useAppSelector((state) => state.auth.accessToken) ?? ''
  const user = useAppSelector((state) => state.auth.user)
  const role = user?.roles.includes('admin')
    ? 'admin'
    : user?.roles.includes('operator')
      ? 'operator'
      : 'viewer'
  const { merchantId, storeId, stores, currentStore, setStoreId } =
    useBusinessContext()

  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<PaginatedOrders | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [filters, setFilters] = useState<OrderFilters>({
    keyword: searchParams.get('keyword') ?? undefined,
    statuses: readOrderStatuses(searchParams.get('statuses')),
  })
  const [keywordDraft, setKeywordDraft] = useState(
    searchParams.get('keyword') ?? '',
  )
  const [sortBy, setSortBy] = useState<OrderSortField>('createdAt')
  const [sortOrder, setSortOrder] = useState<OrderSortOrder>('desc')
  const [visibleColumns, setVisibleColumns] =
    useState<OrderViewColumn[]>(defaultColumns)
  const [selectedIds, setSelectedIds] = useState<React.Key[]>([])
  const [bulkAction, setBulkAction] = useState<OrderBulkAction>()
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkResult, setBulkResult] = useState<OrderBulkOperationResult | null>(
    null,
  )

  const [savedViews, setSavedViews] = useState<OrderSavedView[]>([])
  const [activeViewId, setActiveViewId] = useState<string>()
  const [saveOpen, setSaveOpen] = useState(false)
  const [viewName, setViewName] = useState('')
  const [viewDefault, setViewDefault] = useState(false)

  const [detailOrderId, setDetailOrderId] = useState<string | null>(
    searchParams.get('orderId'),
  )
  const [detailData, setDetailData] = useState<OrderSummary | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const loadOrders = useCallback(async () => {
    if (!token || !merchantId) return
    setLoading(true)
    setError(null)
    try {
      setData(
        await getOrders(token, merchantId, {
          page,
          pageSize,
          ...filters,
          storeId: storeId || undefined,
          sortBy,
          sortOrder,
        }),
      )
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : '加载订单失败')
    } finally {
      setLoading(false)
    }
  }, [filters, merchantId, page, pageSize, sortBy, sortOrder, storeId, token])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadOrders(), 0)
    return () => window.clearTimeout(timer)
  }, [loadOrders])

  useEffect(() => {
    if (!token || !merchantId) return
    void getOrderSavedViews(token, merchantId)
      .then(setSavedViews)
      .catch(() => setSavedViews([]))
  }, [merchantId, token])

  useEffect(() => {
    if (!detailOrderId || !token || !merchantId) return
    const timer = window.setTimeout(() => {
      setDetailLoading(true)
      setDetailData(null)
      void getOrder(token, merchantId, detailOrderId, storeId || undefined)
        .then(setDetailData)
        .catch(() => setDetailData(null))
        .finally(() => setDetailLoading(false))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [detailOrderId, merchantId, storeId, token])

  const patchFilters = (patch: Partial<OrderFilters>) => {
    setFilters((current) => ({ ...current, ...patch }))
    setPage(1)
    setActiveViewId(undefined)
  }

  const handleAction = useCallback(
    async (orderId: string, targetStatus: OrderStatus) => {
      if (!token || !merchantId) return
      try {
        const updated = await updateOrderStatus(
          token,
          merchantId,
          orderId,
          targetStatus,
        )
        setDetailData(updated)
        await loadOrders()
      } catch (actionError: unknown) {
        setError(
          actionError instanceof Error ? actionError.message : '操作失败',
        )
      }
    },
    [loadOrders, merchantId, token],
  )

  const applyView = (viewId?: string) => {
    const view = savedViews.find((item) => item.id === viewId)
    setActiveViewId(viewId)
    if (!view) return
    setFilters(view.filters)
    setKeywordDraft(view.filters.keyword ?? '')
    setSortBy(view.sortBy)
    setSortOrder(view.sortOrder)
    setVisibleColumns(view.columns)
    if (
      view.filters.storeId &&
      stores.some((store) => store.id === view.filters.storeId)
    ) {
      setStoreId(view.filters.storeId)
    }
    setPage(1)
  }

  const saveView = async () => {
    if (!token || !merchantId || !viewName.trim()) return
    try {
      const created = await createOrderSavedView(token, merchantId, {
        name: viewName.trim(),
        ...filters,
        storeId: storeId || undefined,
        sortBy,
        sortOrder,
        columns: visibleColumns,
        isDefault: viewDefault,
      })
      setSavedViews((records) => [
        created,
        ...records.map((record) =>
          created.isDefault ? { ...record, isDefault: false } : record,
        ),
      ])
      setActiveViewId(created.id)
      setSaveOpen(false)
      setViewName('')
      setViewDefault(false)
      message.success('订单视图已保存')
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : '保存视图失败')
    }
  }

  const overwriteView = async () => {
    if (!token || !merchantId || !activeViewId) return
    try {
      const updated = await updateOrderSavedView(
        token,
        merchantId,
        activeViewId,
        {
          ...filters,
          storeId: storeId || undefined,
          sortBy,
          sortOrder,
          columns: visibleColumns,
        },
      )
      setSavedViews((records) =>
        records.map((record) => (record.id === updated.id ? updated : record)),
      )
      message.success('当前视图已更新')
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : '更新视图失败')
    }
  }

  const removeView = async () => {
    if (!token || !merchantId || !activeViewId) return
    try {
      await deleteOrderSavedView(token, merchantId, activeViewId)
      setSavedViews((records) =>
        records.filter((record) => record.id !== activeViewId),
      )
      setActiveViewId(undefined)
      message.success('订单视图已删除')
    } catch (deleteError: unknown) {
      setError(
        deleteError instanceof Error ? deleteError.message : '删除视图失败',
      )
    }
  }

  const runBulk = async () => {
    if (!token || !merchantId || !bulkAction || selectedIds.length === 0) return
    setBulkRunning(true)
    try {
      const result = await executeOrderBulkAction(token, merchantId, {
        action: bulkAction,
        orderIds: selectedIds.map(String),
        idempotencyKey: crypto.randomUUID(),
      })
      setBulkResult(result)
      setSelectedIds([])
      await loadOrders()
    } catch (bulkError: unknown) {
      setError(bulkError instanceof Error ? bulkError.message : '批量操作失败')
    } finally {
      setBulkRunning(false)
    }
  }

  const baseColumns = useMemo<
    Record<OrderViewColumn, TableColumnsType<OrderSummary>[number]>
  >(
    () => ({
      store: {
        title: '店铺',
        key: 'store',
        render: (_, record) => record.store?.name ?? '未关联',
      },
      orderNo: {
        title: '订单号',
        dataIndex: 'orderNo',
        key: 'orderNo',
        sorter: true,
      },
      customer: {
        title: '客户',
        dataIndex: 'customerName',
        key: 'customer',
      },
      amount: {
        title: '金额',
        dataIndex: 'totalAmount',
        key: 'totalAmount',
        sorter: true,
        render: (amount: string, record) => `${record.currency} ${amount}`,
      },
      status: {
        title: '生命周期',
        dataIndex: 'status',
        key: 'status',
        render: (status: OrderStatus) => (
          <Tag color={statusMeta[status].color}>{statusMeta[status].label}</Tag>
        ),
      },
      paymentStatus: {
        title: '支付',
        dataIndex: 'paymentStatus',
        key: 'paymentStatus',
        render: (status: PaymentStatus) => (
          <Tag color={paymentMeta[status].color}>
            {paymentMeta[status].label}
          </Tag>
        ),
      },
      fulfillmentStatus: {
        title: '履约',
        dataIndex: 'fulfillmentStatus',
        key: 'fulfillmentStatus',
        render: (status: FulfillmentStatus) => (
          <Tag color={fulfillmentMeta[status].color}>
            {fulfillmentMeta[status].label}
          </Tag>
        ),
      },
      createdAt: {
        title: '下单时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        sorter: true,
        render: formatDate,
      },
    }),
    [],
  )

  const columns = useMemo<TableColumnsType<OrderSummary>>(
    () => [
      ...visibleColumns.map((key) => baseColumns[key]),
      {
        title: '操作',
        key: 'actions',
        fixed: 'right',
        width: 190,
        render: (_, record) => (
          <Space size={4} wrap>
            <Button
              type="link"
              size="small"
              onClick={() => setDetailOrderId(record.id)}
            >
              详情
            </Button>
            {actionSteps
              .filter(
                (action) =>
                  action.from === record.status && canAct(role, action.minRole),
              )
              .map((action) => (
                <Button
                  key={action.to}
                  type="link"
                  size="small"
                  onClick={() => void handleAction(record.id, action.to)}
                >
                  {action.label}
                </Button>
              ))}
          </Space>
        ),
      },
    ],
    [baseColumns, handleAction, role, visibleColumns],
  )

  const handleTableChange: TableProps<OrderSummary>['onChange'] = (
    pagination,
    _tableFilters,
    sorter,
  ) => {
    setPage(pagination.current ?? 1)
    setPageSize(pagination.pageSize ?? 10)
    const currentSorter = Array.isArray(sorter) ? sorter[0] : sorter
    if (!currentSorter?.field || !currentSorter.order) return
    const field =
      currentSorter.field === 'totalAmount'
        ? 'totalAmount'
        : currentSorter.field === 'orderNo'
          ? 'orderNo'
          : 'createdAt'
    setSortBy(field)
    setSortOrder(currentSorter.order === 'ascend' ? 'asc' : 'desc')
    setActiveViewId(undefined)
  }

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
          <span className="page-kicker">Order operations</span>
          <h1>订单运营工作台</h1>
          <p>
            {currentStore
              ? `${currentStore.name} · 生命周期、支付、履约和退款统一处理`
              : '组合筛选、保存视图、批量操作和订单时间线'}
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

      <section className="order-view-bar">
        <Select
          allowClear
          style={{ minWidth: 220 }}
          placeholder="选择保存视图"
          value={activeViewId}
          onChange={applyView}
          options={savedViews.map((view) => ({
            value: view.id,
            label: `${view.name}${view.isDefault ? ' · 默认' : ''}`,
          }))}
        />
        <Button icon={<SaveOutlined />} onClick={() => setSaveOpen(true)}>
          保存当前视图
        </Button>
        <Button disabled={!activeViewId} onClick={() => void overwriteView()}>
          覆盖视图
        </Button>
        <Popconfirm
          title="删除当前保存视图？"
          onConfirm={() => void removeView()}
        >
          <Button danger icon={<DeleteOutlined />} disabled={!activeViewId}>
            删除
          </Button>
        </Popconfirm>
        <Popover
          trigger="click"
          content={
            <Checkbox.Group
              value={visibleColumns}
              options={allColumns}
              onChange={(values) => {
                if (values.length) setVisibleColumns(values)
                setActiveViewId(undefined)
              }}
            />
          }
        >
          <Button icon={<SettingOutlined />}>列设置</Button>
        </Popover>
      </section>

      <section className="order-filter-card">
        <Input.Search
          style={{ width: 240 }}
          allowClear
          placeholder="订单号或客户名称"
          value={keywordDraft}
          onChange={(event) => setKeywordDraft(event.target.value)}
          onSearch={(value) =>
            patchFilters({ keyword: value.trim() || undefined })
          }
        />
        <Select
          mode="multiple"
          maxTagCount="responsive"
          style={{ minWidth: 210 }}
          placeholder="生命周期"
          value={filters.statuses}
          onChange={(statuses) =>
            patchFilters({ statuses: statuses.length ? statuses : undefined })
          }
          options={Object.entries(statusMeta).map(([value, meta]) => ({
            value,
            label: meta.label,
          }))}
        />
        <Select
          mode="multiple"
          maxTagCount="responsive"
          style={{ minWidth: 190 }}
          placeholder="支付状态"
          value={filters.paymentStatuses}
          onChange={(statuses) =>
            patchFilters({
              paymentStatuses: statuses.length ? statuses : undefined,
            })
          }
          options={Object.entries(paymentMeta).map(([value, meta]) => ({
            value,
            label: meta.label,
          }))}
        />
        <Select
          mode="multiple"
          maxTagCount="responsive"
          style={{ minWidth: 190 }}
          placeholder="履约状态"
          value={filters.fulfillmentStatuses}
          onChange={(statuses) =>
            patchFilters({
              fulfillmentStatuses: statuses.length ? statuses : undefined,
            })
          }
          options={Object.entries(fulfillmentMeta).map(([value, meta]) => ({
            value,
            label: meta.label,
          }))}
        />
        <Input
          type="date"
          aria-label="开始日期"
          value={filters.startDate?.slice(0, 10) ?? ''}
          onChange={(event) =>
            patchFilters({
              startDate: event.target.value
                ? new Date(`${event.target.value}T00:00:00`).toISOString()
                : undefined,
            })
          }
        />
        <Input
          type="date"
          aria-label="结束日期"
          value={filters.endDate?.slice(0, 10) ?? ''}
          onChange={(event) =>
            patchFilters({
              endDate: event.target.value
                ? new Date(`${event.target.value}T23:59:59.999`).toISOString()
                : undefined,
            })
          }
        />
        <Input
          style={{ width: 120 }}
          placeholder="最低金额"
          value={filters.minAmount}
          onChange={(event) =>
            patchFilters({ minAmount: event.target.value || undefined })
          }
        />
        <Input
          style={{ width: 120 }}
          placeholder="最高金额"
          value={filters.maxAmount}
          onChange={(event) =>
            patchFilters({ maxAmount: event.target.value || undefined })
          }
        />
        <Button
          onClick={() => {
            setFilters({})
            setKeywordDraft('')
            setSortBy('createdAt')
            setSortOrder('desc')
            setActiveViewId(undefined)
            setPage(1)
          }}
        >
          重置
        </Button>
      </section>

      {role !== 'viewer' ? (
        <section className="order-bulk-bar">
          <Typography.Text>已选择 {selectedIds.length} 个订单</Typography.Text>
          <Select
            style={{ width: 180 }}
            placeholder="选择批量操作"
            value={bulkAction}
            onChange={setBulkAction}
            options={bulkOptions.filter(
              (option) => role === 'admin' || !option.adminOnly,
            )}
          />
          <Button
            type="primary"
            loading={bulkRunning}
            disabled={!bulkAction || selectedIds.length === 0}
            onClick={() => void runBulk()}
          >
            执行并查看逐单结果
          </Button>
        </section>
      ) : null}

      <div className="table-card">
        <Table<OrderSummary>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data?.items ?? []}
          scroll={{ x: 1180 }}
          rowSelection={
            role === 'viewer'
              ? undefined
              : {
                  selectedRowKeys: selectedIds,
                  onChange: setSelectedIds,
                  preserveSelectedRowKeys: true,
                }
          }
          pagination={{
            current: page,
            pageSize,
            total: data?.total ?? 0,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          onChange={handleTableChange}
        />
      </div>

      <Drawer
        title="订单详情"
        width={920}
        open={detailOrderId !== null}
        onClose={() => {
          setDetailOrderId(null)
          setDetailData(null)
        }}
      >
        {detailLoading ? (
          <Spin />
        ) : detailData ? (
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
                        {detailData.orderNo}
                      </Descriptions.Item>
                      <Descriptions.Item label="店铺">
                        {detailData.store?.name ?? '未关联'}
                      </Descriptions.Item>
                      <Descriptions.Item label="生命周期">
                        <Tag color={statusMeta[detailData.status].color}>
                          {statusMeta[detailData.status].label}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="支付 / 履约">
                        <Space>
                          <Tag
                            color={paymentMeta[detailData.paymentStatus].color}
                          >
                            {paymentMeta[detailData.paymentStatus].label}
                          </Tag>
                          <Tag
                            color={
                              fulfillmentMeta[detailData.fulfillmentStatus]
                                .color
                            }
                          >
                            {
                              fulfillmentMeta[detailData.fulfillmentStatus]
                                .label
                            }
                          </Tag>
                        </Space>
                      </Descriptions.Item>
                      <Descriptions.Item label="金额">
                        {detailData.currency} {detailData.totalAmount}
                      </Descriptions.Item>
                      <Descriptions.Item label="退款">
                        {detailData.currency} {detailData.refundAmount}
                      </Descriptions.Item>
                      <Descriptions.Item label="客户">
                        {detailData.customerName}
                      </Descriptions.Item>
                      <Descriptions.Item label="邮箱">
                        {detailData.customerEmail ?? '未提供'}
                      </Descriptions.Item>
                      <Descriptions.Item label="物流">
                        {[detailData.carrier, detailData.trackingNumber]
                          .filter(Boolean)
                          .join(' / ') || '暂无物流信息'}
                      </Descriptions.Item>
                      <Descriptions.Item label="下单时间">
                        {formatDate(detailData.createdAt)}
                      </Descriptions.Item>
                      <Descriptions.Item label="收货地址" span={2}>
                        {detailData.shippingAddress
                          ? [
                              detailData.shippingAddress.recipient,
                              detailData.shippingAddress.phone,
                              detailData.shippingAddress.line1,
                              detailData.shippingAddress.line2,
                              detailData.shippingAddress.city,
                              detailData.shippingAddress.region,
                              detailData.shippingAddress.postalCode,
                              detailData.shippingAddress.country,
                            ]
                              .filter(Boolean)
                              .join(' · ')
                          : '未提供'}
                      </Descriptions.Item>
                    </Descriptions>

                    <Table
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
                          render: (price: string) =>
                            `${detailData.currency} ${price}`,
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
                            `${detailData.currency} ${subtotal}`,
                        },
                      ]}
                    />

                    <section className="order-timeline-card">
                      <Typography.Title level={5}>订单时间线</Typography.Title>
                      <Timeline
                        items={detailData.timeline.map((event) => ({
                          color:
                            event.type === 'BULK_OPERATION' ? 'purple' : 'blue',
                          children: (
                            <>
                              <Typography.Text strong>
                                {event.title}
                              </Typography.Text>
                              <div className="muted">
                                {formatDate(event.createdAt)}
                                {event.actorName
                                  ? ` · ${event.actorName}`
                                  : ' · 系统'}
                              </div>
                              {event.description ? (
                                <div>{event.description}</div>
                              ) : null}
                            </>
                          ),
                        }))}
                      />
                    </section>
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
                    storeId={detailData.storeId ?? undefined}
                    storeName={detailData.store?.name}
                    sourcePage={`orders:${detailData.id}`}
                    canWrite={role !== 'viewer'}
                    quickPrompts={[
                      `查询订单 ${detailData.orderNo} 的状态`,
                      `分析订单 ${detailData.orderNo} 的支付和履约状态`,
                      `订单 ${detailData.orderNo} 下一步需要什么运营动作`,
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

      <Modal
        title="保存订单视图"
        open={saveOpen}
        onCancel={() => setSaveOpen(false)}
        onOk={() => void saveView()}
        okButtonProps={{ disabled: !viewName.trim() }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input
            maxLength={80}
            placeholder="例如：待发货高金额订单"
            value={viewName}
            onChange={(event) => setViewName(event.target.value)}
          />
          <Checkbox
            checked={viewDefault}
            onChange={(event) => setViewDefault(event.target.checked)}
          >
            设为默认视图
          </Checkbox>
          <Typography.Text type="secondary">
            将保存当前店铺、筛选条件、排序和列设置。
          </Typography.Text>
        </Space>
      </Modal>

      <Modal
        title="批量操作结果"
        open={bulkResult !== null}
        onCancel={() => setBulkResult(null)}
        footer={[
          <Button key="close" onClick={() => setBulkResult(null)}>
            关闭
          </Button>,
        ]}
        width={760}
      >
        {bulkResult ? (
          <>
            <Alert
              type={bulkResult.failedItems ? 'warning' : 'success'}
              showIcon
              title={`${bulkResult.succeededItems} 个成功，${bulkResult.failedItems} 个失败`}
              description="每个订单都独立执行权限、状态机和幂等校验。"
              style={{ marginBottom: 16 }}
            />
            <Table
              rowKey="id"
              pagination={false}
              dataSource={bulkResult.items}
              columns={[
                {
                  title: '订单',
                  dataIndex: 'orderNo',
                  key: 'orderNo',
                },
                {
                  title: '结果',
                  dataIndex: 'status',
                  key: 'status',
                  render: (status: string) => (
                    <Tag color={status === 'SUCCEEDED' ? 'green' : 'red'}>
                      {status}
                    </Tag>
                  ),
                },
                {
                  title: '状态变化',
                  key: 'transition',
                  render: (
                    _: unknown,
                    item: OrderBulkOperationResult['items'][number],
                  ) =>
                    item.fromStatus && item.toStatus
                      ? `${item.fromStatus} → ${item.toStatus}`
                      : '-',
                },
                {
                  title: '失败原因',
                  dataIndex: 'error',
                  key: 'error',
                },
              ]}
            />
          </>
        ) : null}
      </Modal>
    </main>
  )
}
