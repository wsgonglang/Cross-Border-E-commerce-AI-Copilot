import type { OrderBulkOperationResult } from '@cross-border/shared'
import { Alert, Button, Modal, Table, Tag } from 'antd'
import { useTranslation } from 'react-i18next'

interface OrderBulkResultModalProps {
  onClose: () => void
  result: OrderBulkOperationResult | null
}

export function OrderBulkResultModal({
  onClose,
  result,
}: OrderBulkResultModalProps) {
  const { t } = useTranslation()
  return (
    <Modal
      title={t('orders.bulkResult')}
      open={result !== null}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          {t('orders.close')}
        </Button>,
      ]}
      width={760}
    >
      {result ? (
        <>
          <Alert
            type={result.failedItems ? 'warning' : 'success'}
            showIcon
            title={t('orders.bulkSummary', {
              succeeded: result.succeededItems,
              failed: result.failedItems,
            })}
            description={t('orders.bulkDescription')}
            className="order-bulk-result-alert"
          />
          <Table
            rowKey="id"
            pagination={false}
            dataSource={result.items}
            columns={[
              {
                title: t('orders.orderNo'),
                dataIndex: 'orderNo',
                key: 'orderNo',
              },
              {
                title: t('orders.result'),
                dataIndex: 'status',
                key: 'status',
                render: (status: string) => (
                  <Tag color={status === 'SUCCEEDED' ? 'green' : 'red'}>
                    {t(
                      status === 'SUCCEEDED'
                        ? 'orders.succeeded'
                        : 'orders.failed',
                    )}
                  </Tag>
                ),
              },
              {
                title: t('orders.statusChange'),
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
                title: t('orders.failureReason'),
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
