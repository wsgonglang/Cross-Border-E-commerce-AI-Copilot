import type {
  AuditLogSummary,
  ProductStatus,
  ProductSummary,
  SkuSummary,
} from '@cross-border/shared'
import { useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import {
  adjustStock,
  createProduct,
  createSku,
  disableSku,
  getAuditLogs,
  updateProduct,
  updateSku,
  type ProductInput,
  type SkuInput,
} from '../../api/commerce'
import { ProductOptimizationDrawer } from '../../components/product-optimization-drawer/product-optimization-drawer'
import { useBusinessContext } from '../../contexts/business-context'
import { formatDateTime } from '../../i18n/formatters'
import type { AppLanguage } from '../../i18n/i18n'
import { useProductsQuery } from '../../queries/commerce.queries'
import { queryKeys } from '../../queries/query-keys'
import { useAppSelector } from '../../store/hooks'

import './styles.css'

interface StockForm {
  delta: number
  reason: string
}

const emptyProducts: ProductSummary[] = []

export function ProductsPage() {
  const { t, i18n } = useTranslation()
  const language: AppLanguage =
    i18n.resolvedLanguage === 'en-US' ? 'en-US' : 'zh-CN'
  const productStatusLabels: Record<ProductStatus, string> = {
    DRAFT: t('products.status.DRAFT'),
    ACTIVE: t('products.status.ACTIVE'),
    ARCHIVED: t('products.status.ARCHIVED'),
  }
  const [searchParams] = useSearchParams()
  const token = useAppSelector((state) => state.auth.accessToken)
  const user = useAppSelector((state) => state.auth.user)
  const { merchantId, storeId, currentMerchant, currentStore, setMerchantId } =
    useBusinessContext()
  const canWrite =
    user?.roles.some((role) => role === 'admin' || role === 'operator') ?? false
  const [productForm] = Form.useForm<ProductInput>()
  const [skuForm] = Form.useForm<SkuInput>()
  const [stockForm] = Form.useForm<StockForm>()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState<string | undefined>(
    searchParams.get('keyword') ?? undefined,
  )
  const [status, setStatus] = useState<ProductStatus>()
  const [saving, setSaving] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductSummary | null>(
    null,
  )
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [skuProduct, setSkuProduct] = useState<ProductSummary | null>(null)
  const [editingSku, setEditingSku] = useState<SkuSummary | null>(null)
  const [skuModalOpen, setSkuModalOpen] = useState(false)
  const [stockSku, setStockSku] = useState<SkuSummary | null>(null)
  const [stockModalOpen, setStockModalOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [auditLogs, setAuditLogs] = useState<AuditLogSummary[]>([])
  const [optimizationProduct, setOptimizationProduct] =
    useState<ProductSummary | null>(null)
  const [messageApi, messageContext] = message.useMessage()
  const productsQuery = useProductsQuery(token ?? '', merchantId, {
    page,
    pageSize,
    keyword,
    status,
    storeId: searchParams.get('optimizationId')
      ? undefined
      : storeId || undefined,
  })
  const products = productsQuery.data?.items ?? emptyProducts
  const total = productsQuery.data?.total ?? 0
  const loading = productsQuery.isFetching
  const error =
    productsQuery.error instanceof Error ? productsQuery.error.message : null

  useEffect(() => {
    const requestedMerchant = searchParams.get('merchantId')
    if (requestedMerchant && requestedMerchant !== merchantId) {
      setMerchantId(requestedMerchant)
    }
  }, [merchantId, searchParams, setMerchantId])

  const refreshProducts = useCallback(async () => {
    if (!merchantId) return
    await queryClient.invalidateQueries({
      queryKey: queryKeys.productsRoot(merchantId),
    })
  }, [merchantId, queryClient])

  useEffect(() => {
    const requestedProductId = searchParams.get('productId')
    if (!requestedProductId) return
    const product = products.find((item) => item.id === requestedProductId)
    if (!product) return
    const timer = window.setTimeout(() => setOptimizationProduct(product), 0)
    return () => window.clearTimeout(timer)
  }, [products, searchParams])

  const openProduct = (product?: ProductSummary) => {
    setEditingProduct(product ?? null)
    productForm.setFieldsValue(
      product
        ? {
            code: product.code,
            title: product.title,
            description: product.description,
            language: product.language,
            status: product.status,
          }
        : {
            code: '',
            title: '',
            description: '',
            language: 'zh-CN',
            status: 'DRAFT',
          },
    )
    setProductModalOpen(true)
  }

  const saveProduct = async () => {
    if (!token || !merchantId) return
    const values = await productForm.validateFields()
    setSaving(true)
    try {
      if (editingProduct) {
        await updateProduct(token, merchantId, editingProduct.id, values)
      } else {
        await createProduct(token, merchantId, {
          ...values,
          code: values.code ?? '',
        })
      }
      setProductModalOpen(false)
      await refreshProducts()
      void messageApi.success(
        editingProduct
          ? t('products.productSaved')
          : t('products.productCreated'),
      )
    } catch (saveError: unknown) {
      void messageApi.error(
        saveError instanceof Error
          ? saveError.message
          : t('products.productSaveFailed'),
      )
    } finally {
      setSaving(false)
    }
  }

  const openSku = (product: ProductSummary, sku?: SkuSummary) => {
    setSkuProduct(product)
    setEditingSku(sku ?? null)
    skuForm.setFieldsValue(
      sku
        ? {
            code: sku.code,
            name: sku.name,
            price: sku.price,
            currency: sku.currency,
            stock: sku.stock,
          }
        : {
            code: '',
            name: '',
            price: '0.00',
            currency: currentMerchant?.defaultCurrency ?? 'USD',
            stock: 0,
          },
    )
    setSkuModalOpen(true)
  }

  const saveSku = async () => {
    if (!token || !merchantId || !skuProduct) return
    const values = await skuForm.validateFields()
    setSaving(true)
    try {
      if (editingSku) {
        await updateSku(token, merchantId, editingSku.id, {
          name: values.name,
          price: values.price,
          status: editingSku.status,
        })
      } else {
        await createSku(token, merchantId, skuProduct.id, {
          ...values,
          code: values.code ?? '',
          currency: values.currency ?? 'USD',
          stock: values.stock ?? 0,
        })
      }
      setSkuModalOpen(false)
      await refreshProducts()
      void messageApi.success(
        editingSku ? t('products.skuUpdated') : t('products.skuCreated'),
      )
    } catch (saveError: unknown) {
      void messageApi.error(
        saveError instanceof Error
          ? saveError.message
          : t('products.skuSaveFailed'),
      )
    } finally {
      setSaving(false)
    }
  }

  const setSkuDisabled = async (sku: SkuSummary) => {
    if (!token || !merchantId) return
    try {
      await disableSku(token, merchantId, sku.id)
      await refreshProducts()
      void messageApi.success(t('products.skuDisabled'))
    } catch (updateError: unknown) {
      void messageApi.error(
        updateError instanceof Error
          ? updateError.message
          : t('products.skuDisableFailed'),
      )
    }
  }

  const openStock = (sku: SkuSummary) => {
    setStockSku(sku)
    stockForm.setFieldsValue({ delta: 1, reason: '' })
    setStockModalOpen(true)
  }

  const saveStock = async () => {
    if (!token || !merchantId || !stockSku) return
    const values = await stockForm.validateFields()
    setSaving(true)
    try {
      await adjustStock(token, merchantId, stockSku.id, values)
      setStockModalOpen(false)
      await refreshProducts()
      void messageApi.success(t('products.stockAdjusted'))
    } catch (saveError: unknown) {
      void messageApi.error(
        saveError instanceof Error
          ? saveError.message
          : t('products.stockAdjustFailed'),
      )
    } finally {
      setSaving(false)
    }
  }

  const showAudit = async () => {
    if (!token || !merchantId) return
    try {
      setAuditLogs(await getAuditLogs(token, merchantId))
      setAuditOpen(true)
    } catch (loadError: unknown) {
      void messageApi.error(
        loadError instanceof Error
          ? loadError.message
          : t('products.auditLoadFailed'),
      )
    }
  }

  return (
    <main className="workspace-page products-page">
      {messageContext}
      <header className="workspace-header">
        <div>
          <span className="page-kicker">{t('products.kicker')}</span>
          <h1>{t('products.title')}</h1>
          <p>
            {currentStore
              ? t('products.listedStore', { store: currentStore.name })
              : t('products.description')}
          </p>
        </div>
        <Space>
          {canWrite ? (
            <Button onClick={() => void showAudit()}>
              {t('products.audit')}
            </Button>
          ) : null}
          {canWrite ? (
            <Button type="primary" onClick={() => openProduct()}>
              {t('products.create')}
            </Button>
          ) : null}
        </Space>
      </header>

      <div className="catalog-toolbar">
        <Input.Search
          allowClear
          placeholder={t('products.search')}
          onSearch={(value) => {
            setKeyword(value || undefined)
            setPage(1)
          }}
        />
        <Select
          allowClear
          placeholder={t('products.allStatus')}
          onChange={(value: ProductStatus | undefined) => {
            setStatus(value)
            setPage(1)
          }}
          options={Object.entries(productStatusLabels).map(
            ([value, label]) => ({
              value,
              label,
            }),
          )}
        />
      </div>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      <div className="table-card">
        <Table<ProductSummary>
          rowKey="id"
          loading={loading}
          dataSource={products}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage)
              setPageSize(nextPageSize)
            },
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
                        <Tag
                          color={sku.status === 'ACTIVE' ? 'green' : 'default'}
                        >
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
                              onClick={() => openSku(product, sku)}
                            >
                              {t('common.edit')}
                            </Button>
                            <Button
                              type="link"
                              onClick={() => openStock(sku)}
                              disabled={sku.status !== 'ACTIVE'}
                            >
                              {t('products.adjustStock')}
                            </Button>
                            <Button
                              type="link"
                              danger
                              disabled={sku.status !== 'ACTIVE'}
                              onClick={() => void setSkuDisabled(sku)}
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
                  {productStatusLabels[value]}
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
                    <Button type="link" onClick={() => openProduct(product)}>
                      {t('common.edit')}
                    </Button>
                    <Button
                      type="link"
                      onClick={() => setOptimizationProduct(product)}
                      disabled={product.status === 'ARCHIVED'}
                    >
                      {t('products.aiOptimize')}
                    </Button>
                    <Button
                      type="link"
                      onClick={() => openSku(product)}
                      disabled={product.status === 'ARCHIVED'}
                    >
                      {t('products.addSku')}
                    </Button>
                  </Space>
                ) : null,
            },
          ]}
        />
      </div>

      <Modal
        title={
          editingProduct ? t('products.editProduct') : t('products.create')
        }
        open={productModalOpen}
        confirmLoading={saving}
        onOk={() => void saveProduct()}
        onCancel={() => setProductModalOpen(false)}
        width={680}
      >
        <Form form={productForm} layout="vertical">
          <Form.Item
            name="code"
            label={t('products.code')}
            rules={[{ required: true }, { pattern: /^[A-Z0-9][A-Z0-9_-]+$/ }]}
          >
            <Input disabled={Boolean(editingProduct)} />
          </Form.Item>
          <Form.Item
            name="title"
            label={t('products.titleField')}
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('products.descriptionField')}>
            <Input.TextArea rows={5} />
          </Form.Item>
          <div className="form-grid">
            <Form.Item
              name="language"
              label={t('common.language')}
              rules={[{ required: true }]}
            >
              <Select
                options={['zh-CN', 'en-US', 'es-ES', 'pt-BR'].map((value) => ({
                  value,
                  label: value,
                }))}
              />
            </Form.Item>
            <Form.Item
              name="status"
              label={t('common.status')}
              rules={[{ required: true }]}
            >
              <Select
                options={Object.entries(productStatusLabels).map(
                  ([value, label]) => ({ value, label }),
                )}
              />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal
        title={editingSku ? t('products.editSku') : t('products.addSku')}
        open={skuModalOpen}
        confirmLoading={saving}
        onOk={() => void saveSku()}
        onCancel={() => setSkuModalOpen(false)}
      >
        <Form form={skuForm} layout="vertical">
          <Form.Item
            name="code"
            label={t('products.skuCode')}
            rules={[{ required: true }, { pattern: /^[A-Z0-9][A-Z0-9_-]+$/ }]}
          >
            <Input disabled={Boolean(editingSku)} />
          </Form.Item>
          <Form.Item
            name="name"
            label={t('products.skuName')}
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <div className="form-grid">
            <Form.Item
              name="price"
              label={t('products.price')}
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="currency"
              label={t('products.currency')}
              rules={[{ required: true }]}
            >
              <Select
                disabled={Boolean(editingSku)}
                options={['USD', 'EUR', 'GBP', 'CNY'].map((value) => ({
                  value,
                  label: value,
                }))}
              />
            </Form.Item>
          </div>
          <Form.Item
            name="stock"
            label={t('products.initialStock')}
            rules={[{ required: true }]}
          >
            <InputNumber disabled={Boolean(editingSku)} min={0} precision={0} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('products.adjustStockTitle', {
          code: stockSku?.code ?? '',
        })}
        open={stockModalOpen}
        confirmLoading={saving}
        onOk={() => void saveStock()}
        onCancel={() => setStockModalOpen(false)}
      >
        <Form form={stockForm} layout="vertical">
          <Form.Item
            name="delta"
            label={t('products.delta')}
            extra={t('products.deltaHelp')}
            rules={[{ required: true }]}
          >
            <InputNumber precision={0} />
          </Form.Item>
          <Form.Item
            name="reason"
            label={t('products.reason')}
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={t('products.auditTitle')}
        width={560}
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
      >
        {auditLogs.map((log) => (
          <Descriptions
            key={log.id}
            className="audit-entry"
            size="small"
            column={1}
            bordered
          >
            <Descriptions.Item label={t('products.time')}>
              {formatDateTime(log.createdAt, language)}
            </Descriptions.Item>
            <Descriptions.Item label={t('common.actions')}>
              {log.entityType} · {log.action}
            </Descriptions.Item>
            <Descriptions.Item label={t('products.object')}>
              {log.entityId}
            </Descriptions.Item>
          </Descriptions>
        ))}
      </Drawer>

      {token && merchantId ? (
        <ProductOptimizationDrawer
          open={Boolean(optimizationProduct)}
          token={token}
          merchantId={merchantId}
          product={optimizationProduct}
          initialOptimizationId={
            optimizationProduct
              ? (searchParams.get('optimizationId') ?? undefined)
              : undefined
          }
          onClose={() => setOptimizationProduct(null)}
          onApplied={refreshProducts}
        />
      ) : null}
    </main>
  )
}
