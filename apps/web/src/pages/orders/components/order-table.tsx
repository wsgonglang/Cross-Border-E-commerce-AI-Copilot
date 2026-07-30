import type {
  FulfillmentStatus,
  OrderStatus,
  OrderSummary,
  OrderViewColumn,
  PaginatedOrders,
  PaymentStatus,
} from '@cross-border/shared'
import { Button, Space, Table, Tag } from 'antd'
import type { TableColumnsType, TableProps } from 'antd'
import type { Key } from 'react'
import { useMemo } from 'react'

import {
  actionSteps,
  canAct,
  formatDate,
  fulfillmentMeta,
  paymentMeta,
  statusMeta,
  type OrderRole,
} from '../order.constants'

interface OrderTableProps {
  data: PaginatedOrders | null
  loading: boolean
  onChange: TableProps<OrderSummary>['onChange']
  onOpenDetail: (orderId: string) => void
  onSelectedIdsChange: (ids: Key[]) => void
  onStatusChange: (orderId: string, status: OrderStatus) => void
  page: number
  pageSize: number
  role: OrderRole
  selectedIds: Key[]
  visibleColumns: OrderViewColumn[]
}

export function OrderTable({
  data,
  loading,
  onChange,
  onOpenDetail,
  onSelectedIdsChange,
  onStatusChange,
  page,
  pageSize,
  role,
  selectedIds,
  visibleColumns,
}: OrderTableProps) {
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
              onClick={() => onOpenDetail(record.id)}
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
                  onClick={() => onStatusChange(record.id, action.to)}
                >
                  {action.label}
                </Button>
              ))}
          </Space>
        ),
      },
    ],
    [baseColumns, onOpenDetail, onStatusChange, role, visibleColumns],
  )

  return (
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
                onChange: onSelectedIdsChange,
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
        onChange={onChange}
      />
    </div>
  )
}
