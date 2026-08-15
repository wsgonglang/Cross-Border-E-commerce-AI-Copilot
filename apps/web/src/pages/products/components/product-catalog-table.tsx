import type {
  ProductStatus,
  ProductSummary,
  SkuSummary,
} from '@cross-border/shared'
import { Button, Empty, Space, Table, Tag } from 'antd'
import { useTranslation } from 'react-i18next'

interface Props {
  products: ProductSummary[]
  loading: boolean
  page: number
  pageSize: number
  total: number
  canWrite: boolean
  statusLabels: Record<ProductStatus, string>
  onPageChange: (page: number, pageSize: number) => void
  onEditProduct: (product: ProductSummary) => void
  onOptimizeProduct: (product: ProductSummary) => void
  onAddSku: (product: ProductSummary) => void
  onEditSku: (product: ProductSummary, sku: SkuSummary) => void
  onAdjustStock: (sku: SkuSummary) => void
  onDisableSku: (sku: SkuSummary) => Promise<void>
}

export function ProductCatalogTable({
  products,
  loading,
  page,
  pageSize,
  total,
  canWrite,
  statusLabels,
  onPageChange,
  onEditProduct,
  onOptimizeProduct,
  onAddSku,
  onEditSku,
  onAdjustStock,
  onDisableSku,
}: Props) {
  const { t } = useTranslation()

  return (
    <Table<ProductSummary>
      rowKey="id"
      loading={loading}
      dataSource={products}
      pagination={{
        current: page,
        pageSize,
        total,
        showSizeChanger: true,
        onChange: onPageChange,
      }}
      expandable={{
        expandedRowRender: (product) =>
          product.skus.length ? (
            <Table<SkuSummary>
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={product.skus}
              columns={[
                { title: 'SKU', dataIndex: 'code' },
                { title: t('products.specification'), dataIndex: 'name' },
                {
                  title: t('products.price'),
                  render: (_, sku) => `${sku.currency} ${sku.price}`,
                },
                { title: t('products.stock'), dataIndex: 'stock' },
                {
                  title: t('common.status'),
                  render: (_, sku) => (
                    <Tag color={sku.status === 'ACTIVE' ? 'green' : 'default'}>
                      {sku.status === 'ACTIVE'
                        ? t('common.active')
                        : t('common.disabled')}
                    </Tag>
                  ),
                },
                {
                  title: t('common.actions'),
                  render: (_, sku) =>
                    canWrite ? (
                      <Space>
                        <Button
                          type="link"
                          onClick={() => onEditSku(product, sku)}
                        >
                          {t('common.edit')}
                        </Button>
                        <Button
                          type="link"
                          onClick={() => onAdjustStock(sku)}
                          disabled={sku.status !== 'ACTIVE'}
                        >
                          {t('products.adjustStock')}
                        </Button>
                        <Button
                          type="link"
                          danger
                          disabled={sku.status !== 'ACTIVE'}
                          onClick={() => void onDisableSku(sku)}
                        >
                          {t('products.disable')}
                        </Button>
                      </Space>
                    ) : null,
                },
              ]}
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('products.emptySku')}
            />
          ),
      }}
      columns={[
        { title: t('products.code'), dataIndex: 'code' },
        { title: t('products.titleField'), dataIndex: 'title' },
        {
          title: t('common.language'),
          dataIndex: 'language',
          width: 100,
        },
        {
          title: t('products.version'),
          dataIndex: 'version',
          width: 72,
          render: (value: number) => `v${value}`,
        },
        {
          title: t('common.status'),
          dataIndex: 'status',
          width: 100,
          render: (value: ProductStatus) => (
            <Tag color={value === 'ACTIVE' ? 'green' : 'default'}>
              {statusLabels[value]}
            </Tag>
          ),
        },
        {
          title: 'SKU',
          width: 80,
          render: (_, product) => product.skus.length,
        },
        {
          title: t('common.actions'),
          width: 260,
          render: (_, product) =>
            canWrite ? (
              <Space>
                <Button type="link" onClick={() => onEditProduct(product)}>
                  {t('common.edit')}
                </Button>
                <Button
                  type="link"
                  onClick={() => onOptimizeProduct(product)}
                  disabled={product.status === 'ARCHIVED'}
                >
                  {t('products.aiOptimize')}
                </Button>
                <Button
                  type="link"
                  onClick={() => onAddSku(product)}
                  disabled={product.status === 'ARCHIVED'}
                >
                  {t('products.addSku')}
                </Button>
              </Space>
            ) : null,
        },
      ]}
    />
  )
}
