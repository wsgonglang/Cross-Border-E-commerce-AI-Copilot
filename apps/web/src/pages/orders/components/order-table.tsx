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
import { useTranslation } from 'react-i18next'

import {
  actionSteps,
  canAct,
  formatDate,
  fulfillmentMeta,
  fulfillmentLabel,
  paymentLabel,
  paymentMeta,
  statusLabel,
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
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? i18n.language
  const baseColumns = useMemo<
    Record<OrderViewColumn, TableColumnsType<OrderSummary>[number]>
  >(
    () => ({
      store: {
        title: t('orders.store'),
        key: 'store',
        render: (_, record) => record.store?.name ?? t('orders.unlinked'),
      },
      orderNo: {
        title: t('orders.orderNo'),
        dataIndex: 'orderNo',
        key: 'orderNo',
        sorter: true,
      },
      customer: {
        title: t('orders.customer'),
        dataIndex: 'customerName',
        key: 'customer',
      },
      amount: {
        title: t('orders.amount'),
        dataIndex: 'totalAmount',
        key: 'totalAmount',
        sorter: true,
        render: (amount: string, record) => `${record.currency} ${amount}`,
      },
      status: {
        title: t('orders.lifecycle'),
        dataIndex: 'status',
        key: 'status',
        render: (status: OrderStatus) => (
          <Tag color={statusMeta[status].color}>{statusLabel(t, status)}</Tag>
        ),
      },
      paymentStatus: {
        title: t('orders.payment'),
        dataIndex: 'paymentStatus',
        key: 'paymentStatus',
        render: (status: PaymentStatus) => (
          <Tag color={paymentMeta[status].color}>{paymentLabel(t, status)}</Tag>
        ),
      },
      fulfillmentStatus: {
        title: t('orders.fulfillment'),
        dataIndex: 'fulfillmentStatus',
        key: 'fulfillmentStatus',
        render: (status: FulfillmentStatus) => (
          <Tag color={fulfillmentMeta[status].color}>
            {fulfillmentLabel(t, status)}
          </Tag>
        ),
      },
      createdAt: {
        title: t('orders.createdAt'),
        dataIndex: 'createdAt',
        key: 'createdAt',
        sorter: true,
        render: (value: string) => formatDate(value, locale),
      },
    }),
    [locale, t],
  )

  const columns = useMemo<TableColumnsType<OrderSummary>>(
    () => [
      ...visibleColumns.map((key) => baseColumns[key]),
      {
        title: t('common.actions'),
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
              {t('orders.details')}
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
                  {t(action.labelKey)}
                </Button>
              ))}
          </Space>
        ),
      },
    ],
    [baseColumns, onOpenDetail, onStatusChange, role, t, visibleColumns],
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
          showTotal: (total) => t('orders.total', { count: total }),
        }}
        onChange={onChange}
      />
    </div>
  )
}
