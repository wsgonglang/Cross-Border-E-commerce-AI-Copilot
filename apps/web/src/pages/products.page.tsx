import type {
  AuditLogSummary,
  MerchantSummary,
  ProductStatus,
  ProductSummary,
  SkuSummary,
} from '@cross-border/shared'
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
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  adjustStock,
  createProduct,
  createSku,
  disableSku,
  getAuditLogs,
  getMerchants,
  getProducts,
  updateProduct,
  updateSku,
  type ProductInput,
  type SkuInput,
} from '../api/commerce'
import { ProductOptimizationDrawer } from '../components/product-optimization-drawer'
import { useAppSelector } from '../store/hooks'

interface StockForm {
  delta: number
  reason: string
}

const productStatusLabels: Record<ProductStatus, string> = {
  DRAFT: '草稿',
  ACTIVE: '在售',
  ARCHIVED: '已归档',
}

export function ProductsPage() {
  const [searchParams] = useSearchParams()
  const token = useAppSelector((state) => state.auth.accessToken)
  const user = useAppSelector((state) => state.auth.user)
  const canWrite =
    user?.roles.some((role) => role === 'admin' || role === 'operator') ?? false
  const [productForm] = Form.useForm<ProductInput>()
  const [skuForm] = Form.useForm<SkuInput>()
  const [stockForm] = Form.useForm<StockForm>()
  const [merchants, setMerchants] = useState<MerchantSummary[]>([])
  const [merchantId, setMerchantId] = useState<string>()
  const [products, setProducts] = useState<ProductSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState<string | undefined>(
    searchParams.get('keyword') ?? undefined,
  )
  const [status, setStatus] = useState<ProductStatus>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
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

  useEffect(() => {
    if (!token) return
    const loadMerchants = async () => {
      try {
        const result = await getMerchants(token)
        setMerchants(result)
        const requestedMerchant = searchParams.get('merchantId')
        setMerchantId(
          (current) =>
            current ??
            result.find((merchant) => merchant.id === requestedMerchant)?.id ??
            result[0]?.id,
        )
      } catch (loadError: unknown) {
        setError(
          loadError instanceof Error ? loadError.message : '商家加载失败',
        )
      }
    }
    void loadMerchants()
  }, [searchParams, token])

  const loadProducts = useCallback(async () => {
    if (!token || !merchantId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const result = await getProducts(token, merchantId, {
        page,
        pageSize,
        keyword,
        status,
      })
      setProducts(result.items)
      setTotal(result.total)
      setError(null)
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : '商品加载失败')
    } finally {
      setLoading(false)
    }
  }, [keyword, merchantId, page, pageSize, status, token])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadProducts(), 0)
    return () => window.clearTimeout(timer)
  }, [loadProducts])

  useEffect(() => {
    const requestedProductId = searchParams.get('productId')
    if (!requestedProductId) return
    const product = products.find((item) => item.id === requestedProductId)
    if (!product) return
    const timer = window.setTimeout(() => setOptimizationProduct(product), 0)
    return () => window.clearTimeout(timer)
  }, [products, searchParams])

  const currentMerchant = useMemo(
    () => merchants.find((merchant) => merchant.id === merchantId),
    [merchantId, merchants],
  )

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
      await loadProducts()
      void messageApi.success(editingProduct ? '商品已更新' : '商品已创建')
    } catch (saveError: unknown) {
      void messageApi.error(
        saveError instanceof Error ? saveError.message : '商品保存失败',
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
      await loadProducts()
      void messageApi.success(editingSku ? 'SKU 已更新' : 'SKU 已创建')
    } catch (saveError: unknown) {
      void messageApi.error(
        saveError instanceof Error ? saveError.message : 'SKU 保存失败',
      )
    } finally {
      setSaving(false)
    }
  }

  const setSkuDisabled = async (sku: SkuSummary) => {
    if (!token || !merchantId) return
    try {
      await disableSku(token, merchantId, sku.id)
      await loadProducts()
      void messageApi.success('SKU 已停用')
    } catch (updateError: unknown) {
      void messageApi.error(
        updateError instanceof Error ? updateError.message : 'SKU 停用失败',
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
      await loadProducts()
      void messageApi.success('库存已调整')
    } catch (saveError: unknown) {
      void messageApi.error(
        saveError instanceof Error ? saveError.message : '库存调整失败',
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
        loadError instanceof Error ? loadError.message : '审计日志加载失败',
      )
    }
  }

  return (
    <main className="workspace-page">
      {messageContext}
      <header className="workspace-header">
        <div>
          <span className="page-kicker">Catalog & inventory</span>
          <h1>商品与 SKU</h1>
          <p>商品、变体、库存和每次修改都受商家隔离与服务端权限保护。</p>
        </div>
        <Space>
          {canWrite ? (
            <Button onClick={() => void showAudit()}>操作审计</Button>
          ) : null}
          {canWrite ? (
            <Button type="primary" onClick={() => openProduct()}>
              新建商品
            </Button>
          ) : null}
        </Space>
      </header>

      <div className="catalog-toolbar">
        <Select
          value={merchantId}
          placeholder="选择商家"
          onChange={(value) => {
            setMerchantId(value)
            setPage(1)
          }}
          options={merchants.map((merchant) => ({
            value: merchant.id,
            label: `${merchant.name} · ${merchant.code}`,
          }))}
        />
        <Input.Search
          allowClear
          placeholder="搜索商品编码、标题或 SKU"
          onSearch={(value) => {
            setKeyword(value || undefined)
            setPage(1)
          }}
        />
        <Select
          allowClear
          placeholder="全部状态"
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
                    { title: '规格', dataIndex: 'name' },
                    {
                      title: '售价',
                      render: (_, sku) => `${sku.currency} ${sku.price}`,
                    },
                    { title: '库存', dataIndex: 'stock' },
                    {
                      title: '状态',
                      render: (_, sku) => (
                        <Tag
                          color={sku.status === 'ACTIVE' ? 'green' : 'default'}
                        >
                          {sku.status === 'ACTIVE' ? '启用' : '停用'}
                        </Tag>
                      ),
                    },
                    {
                      title: '操作',
                      render: (_, sku) =>
                        canWrite ? (
                          <Space>
                            <Button
                              type="link"
                              onClick={() => openSku(product, sku)}
                            >
                              编辑
                            </Button>
                            <Button
                              type="link"
                              onClick={() => openStock(sku)}
                              disabled={sku.status !== 'ACTIVE'}
                            >
                              调整库存
                            </Button>
                            <Button
                              type="link"
                              danger
                              disabled={sku.status !== 'ACTIVE'}
                              onClick={() => void setSkuDisabled(sku)}
                            >
                              停用
                            </Button>
                          </Space>
                        ) : null,
                    },
                  ]}
                />
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="暂无 SKU"
                />
              ),
          }}
          columns={[
            { title: '商品编码', dataIndex: 'code' },
            { title: '标题', dataIndex: 'title' },
            { title: '语言', dataIndex: 'language', width: 100 },
            {
              title: '版本',
              dataIndex: 'version',
              width: 72,
              render: (value: number) => `v${value}`,
            },
            {
              title: '状态',
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
              title: '操作',
              width: 260,
              render: (_, product) =>
                canWrite ? (
                  <Space>
                    <Button type="link" onClick={() => openProduct(product)}>
                      编辑
                    </Button>
                    <Button
                      type="link"
                      onClick={() => setOptimizationProduct(product)}
                      disabled={product.status === 'ARCHIVED'}
                    >
                      AI 优化
                    </Button>
                    <Button
                      type="link"
                      onClick={() => openSku(product)}
                      disabled={product.status === 'ARCHIVED'}
                    >
                      新增 SKU
                    </Button>
                  </Space>
                ) : null,
            },
          ]}
        />
      </div>

      <Modal
        title={editingProduct ? '编辑商品' : '新建商品'}
        open={productModalOpen}
        confirmLoading={saving}
        onOk={() => void saveProduct()}
        onCancel={() => setProductModalOpen(false)}
        width={680}
      >
        <Form form={productForm} layout="vertical">
          <Form.Item
            name="code"
            label="商品编码"
            rules={[{ required: true }, { pattern: /^[A-Z0-9][A-Z0-9_-]+$/ }]}
          >
            <Input disabled={Boolean(editingProduct)} />
          </Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={5} />
          </Form.Item>
          <div className="form-grid">
            <Form.Item
              name="language"
              label="语言"
              rules={[{ required: true }]}
            >
              <Select
                options={['zh-CN', 'en-US', 'es-ES', 'pt-BR'].map((value) => ({
                  value,
                  label: value,
                }))}
              />
            </Form.Item>
            <Form.Item name="status" label="状态" rules={[{ required: true }]}>
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
        title={editingSku ? '编辑 SKU' : '新增 SKU'}
        open={skuModalOpen}
        confirmLoading={saving}
        onOk={() => void saveSku()}
        onCancel={() => setSkuModalOpen(false)}
      >
        <Form form={skuForm} layout="vertical">
          <Form.Item
            name="code"
            label="SKU 编码"
            rules={[{ required: true }, { pattern: /^[A-Z0-9][A-Z0-9_-]+$/ }]}
          >
            <Input disabled={Boolean(editingSku)} />
          </Form.Item>
          <Form.Item name="name" label="规格名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <div className="form-grid">
            <Form.Item name="price" label="售价" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item
              name="currency"
              label="币种"
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
          <Form.Item name="stock" label="初始库存" rules={[{ required: true }]}>
            <InputNumber disabled={Boolean(editingSku)} min={0} precision={0} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`调整库存 · ${stockSku?.code ?? ''}`}
        open={stockModalOpen}
        confirmLoading={saving}
        onOk={() => void saveStock()}
        onCancel={() => setStockModalOpen(false)}
      >
        <Form form={stockForm} layout="vertical">
          <Form.Item
            name="delta"
            label="调整数量"
            extra="正数增加，负数扣减"
            rules={[{ required: true }]}
          >
            <InputNumber precision={0} />
          </Form.Item>
          <Form.Item name="reason" label="原因" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="最近 100 条业务审计"
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
            <Descriptions.Item label="时间">
              {new Date(log.createdAt).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="操作">
              {log.entityType} · {log.action}
            </Descriptions.Item>
            <Descriptions.Item label="对象">{log.entityId}</Descriptions.Item>
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
          onApplied={loadProducts}
        />
      ) : null}
    </main>
  )
}
