import type { OrderBulkOperationResult } from '@cross-border/shared'
import { Alert, Button, Modal, Table, Tag } from 'antd'

interface OrderBulkResultModalProps {
  onClose: () => void
  result: OrderBulkOperationResult | null
}

export function OrderBulkResultModal({
  onClose,
  result,
}: OrderBulkResultModalProps) {
  return (
    <Modal
      title="批量操作结果"
      open={result !== null}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
      ]}
      width={760}
    >
      {result ? (
        <>
          <Alert
            type={result.failedItems ? 'warning' : 'success'}
            showIcon
            title={`${result.succeededItems} 个成功，${result.failedItems} 个失败`}
            description="每个订单都独立执行权限、状态机和幂等校验。"
            className="order-bulk-result-alert"
          />
          <Table
            rowKey="id"
            pagination={false}
            dataSource={result.items}
            columns={[
              { title: '订单', dataIndex: 'orderNo', key: 'orderNo' },
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
  )
}
