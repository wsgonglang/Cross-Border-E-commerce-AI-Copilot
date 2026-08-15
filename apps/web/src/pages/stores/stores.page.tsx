import type {
  ProductListingSummary,
  ProductSummary,
  StoreSummary,
} from '@cross-border/shared'
import {
  Alert,
  Button,
  Form,
  Input,
  message,
  Modal,
  Select,
  Space,
  Table,
  Tag,
} from 'antd'
import { useCallback, useEffect, useState } from 'react'

import { getProducts } from '../../api/commerce'
import {
  createProductListing,
  createStore,
  getProductListings,
  type ProductListingInput,
  type StoreInput,
  updateProductListing,
  updateStore,
} from '../../api/stores'
import { useBusinessContext } from '../../contexts/business-context'
import { useLatestRequestGuard } from '../../hooks/use-latest-request-guard'
import { useAppSelector } from '../../store/hooks'

import './styles.css'

const storePresets = [
  {
    label: 'Amazon 美国',
    platform: 'Amazon',
    market: 'US',
    currency: 'USD',
    locale: 'en-US',
    timezone: 'America/Los_Angeles',
  },
  {
    label: 'Shopee 巴西',
    platform: 'Shopee',
    market: 'BR',
    currency: 'BRL',
    locale: 'pt-BR',
    timezone: 'America/Sao_Paulo',
  },
]

export function StoresPage() {
  const token = useAppSelector((state) => state.auth.accessToken) ?? ''
  const {
    merchantId,
    storeId,
    stores,
    currentStore,
    setStoreId,
    refreshStores,
  } = useBusinessContext()
  const [storeForm] = Form.useForm<StoreInput>()
  const [listingForm] = Form.useForm<ProductListingInput>()
  const [storeModalOpen, setStoreModalOpen] = useState(false)
  const [listingModalOpen, setListingModalOpen] = useState(false)
  const [editingStore, setEditingStore] = useState<StoreSummary>()
  const [products, setProducts] = useState<ProductSummary[]>([])
  const [listings, setListings] = useState<ProductListingSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const [messageApi, messageContext] = message.useMessage()
  const requestGuard = useLatestRequestGuard()

  const loadListings = useCallback(async () => {
    const requestId = requestGuard.begin()
    if (!token || !merchantId || !storeId) {
      if (requestGuard.isLatest(requestId)) {
        setListings([])
        setProducts([])
        setLoading(false)
      }
      return
    }
    setLoading(true)
    try {
      const [listingRecords, productResult] = await Promise.all([
        getProductListings(token, merchantId, storeId),
        getProducts(token, merchantId, { page: 1, pageSize: 100 }),
      ])
      if (requestGuard.isLatest(requestId)) {
        setListings(listingRecords)
        setProducts(productResult.items)
        setError(undefined)
      }
    } catch (loadError: unknown) {
      if (requestGuard.isLatest(requestId)) {
        setError(
          loadError instanceof Error ? loadError.message : '店铺刊登加载失败',
        )
      }
    } finally {
      if (requestGuard.isLatest(requestId)) setLoading(false)
    }
  }, [merchantId, requestGuard, storeId, token])

  useEffect(() => {
    requestGuard.invalidate()
    const timer = window.setTimeout(() => void loadListings(), 0)
    return () => window.clearTimeout(timer)
  }, [loadListings, requestGuard])

  const openCreateStore = () => {
    setEditingStore(undefined)
    storeForm.resetFields()
    setStoreModalOpen(true)
  }

  const openEditStore = (store: StoreSummary) => {
    setEditingStore(store)
    storeForm.setFieldsValue(store)
    setStoreModalOpen(true)
  }

  const saveStore = async () => {
    if (!merchantId) return
    const values = await storeForm.validateFields()
    setSaving(true)
    try {
      if (editingStore) {
        await updateStore(token, merchantId, editingStore.id, {
          name: values.name,
          currency: values.currency,
          locale: values.locale,
          timezone: values.timezone,
        })
      } else {
        const created = await createStore(token, merchantId, values)
        setStoreId(created.id)
      }
      await refreshStores()
      setStoreModalOpen(false)
      void messageApi.success(editingStore ? '店铺已更新' : '店铺已创建')
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : '店铺保存失败')
    } finally {
      setSaving(false)
    }
  }

  const toggleStore = async (store: StoreSummary) => {
    try {
      await updateStore(token, merchantId, store.id, {
        status: store.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
      })
      await refreshStores()
      void messageApi.success('店铺状态已更新')
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error ? saveError.message : '店铺状态更新失败',
      )
    }
  }

  const openListing = () => {
    if (!currentStore) return
    listingForm.resetFields()
    listingForm.setFieldsValue({
      language: currentStore.locale,
      currency: currentStore.currency,
      status: 'DRAFT',
    })
    setListingModalOpen(true)
  }

  const handleProductChange = (productId: string) => {
    const product = products.find((item) => item.id === productId)
    if (!product) return
    listingForm.setFieldsValue({
      title: product.title,
      description: product.description,
    })
  }

  const saveListing = async () => {
    if (!merchantId || !storeId) return
    const values = await listingForm.validateFields()
    setSaving(true)
    try {
      await createProductListing(token, merchantId, storeId, values)
      setListingModalOpen(false)
      await loadListings()
      void messageApi.success('商品刊登已创建')
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error ? saveError.message : '商品刊登创建失败',
      )
    } finally {
      setSaving(false)
    }
  }

  const changeListingStatus = async (
    listing: ProductListingSummary,
    status: ProductListingSummary['status'],
  ) => {
    try {
      await updateProductListing(
        token,
        merchantId,
        listing.storeId,
        listing.id,
        { status },
      )
      await loadListings()
      void messageApi.success('刊登状态已更新')
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error ? saveError.message : '刊登状态更新失败',
      )
    }
  }

  return (
    <main className="workspace-page stores-page">
      {messageContext}
      <header className="workspace-header">
        <div>
          <span className="page-kicker">Store & listing context</span>
          <h1>店铺与商品刊登</h1>
          <p>
            商家是数据租户，店铺代表具体跨境平台与市场；商品主数据可刊登到多个店铺。
          </p>
        </div>
        <Button type="primary" onClick={openCreateStore}>
          新建店铺
        </Button>
      </header>

      {error ? (
        <Alert
          type="error"
          message={error}
          closable
          onClose={() => setError(undefined)}
          className="stores-error-alert"
        />
      ) : null}

      <div className="table-card">
        <Table<StoreSummary>
          rowKey="id"
          dataSource={stores}
          pagination={false}
          columns={[
            { title: '店铺', dataIndex: 'name' },
            { title: '编码', dataIndex: 'code' },
            { title: '平台', dataIndex: 'platform' },
            { title: '市场', dataIndex: 'market' },
            { title: '币种', dataIndex: 'currency' },
            { title: '语言', dataIndex: 'locale' },
            {
              title: '状态',
              dataIndex: 'status',
              render: (status: StoreSummary['status']) => (
                <Tag color={status === 'ACTIVE' ? 'green' : 'default'}>
                  {status}
                </Tag>
              ),
            },
            {
              title: '操作',
              render: (_, store) => (
                <Space>
                  <Button type="link" onClick={() => setStoreId(store.id)}>
                    查看刊登
                  </Button>
                  <Button type="link" onClick={() => openEditStore(store)}>
                    编辑
                  </Button>
                  <Button type="link" onClick={() => void toggleStore(store)}>
                    {store.status === 'ACTIVE' ? '停用' : '启用'}
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </div>

      <div className="table-card store-listings-card">
        <div className="catalog-toolbar">
          <div>
            <strong>{currentStore?.name ?? '请选择店铺'}</strong>
            <span className="page-muted">
              {currentStore
                ? ` · ${currentStore.platform} / ${currentStore.market}`
                : ''}
            </span>
          </div>
          <Button type="primary" disabled={!storeId} onClick={openListing}>
            新建商品刊登
          </Button>
        </div>
        <Table<ProductListingSummary>
          rowKey="id"
          loading={loading}
          dataSource={listings}
          pagination={false}
          columns={[
            {
              title: '主商品',
              render: (_, item) =>
                `${item.product.code} · ${item.product.title}`,
            },
            { title: '店铺标题', dataIndex: 'title' },
            { title: '语言', dataIndex: 'language' },
            {
              title: '价格',
              render: (_, item) => `${item.currency} ${item.price}`,
            },
            { title: '外部编号', dataIndex: 'externalProductId' },
            {
              title: '状态',
              dataIndex: 'status',
              render: (status: ProductListingSummary['status']) => (
                <Tag color={status === 'PUBLISHED' ? 'green' : 'blue'}>
                  {status}
                </Tag>
              ),
            },
            {
              title: '操作',
              render: (_, item) => (
                <Space>
                  {item.status !== 'PUBLISHED' ? (
                    <Button
                      type="link"
                      onClick={() =>
                        void changeListingStatus(item, 'PUBLISHED')
                      }
                    >
                      发布
                    </Button>
                  ) : null}
                  {item.status !== 'ARCHIVED' ? (
                    <Button
                      type="link"
                      onClick={() => void changeListingStatus(item, 'ARCHIVED')}
                    >
                      归档
                    </Button>
                  ) : null}
                </Space>
              ),
            },
          ]}
        />
      </div>

      <Modal
        title={editingStore ? '编辑店铺' : '新建店铺'}
        open={storeModalOpen}
        confirmLoading={saving}
        onOk={() => void saveStore()}
        onCancel={() => setStoreModalOpen(false)}
      >
        <Form form={storeForm} layout="vertical">
          {!editingStore ? (
            <Form.Item label="快速模板">
              <Select
                options={storePresets.map((preset) => ({
                  value: preset.label,
                  label: preset.label,
                }))}
                onChange={(label) => {
                  const preset = storePresets.find(
                    (item) => item.label === label,
                  )
                  if (preset) storeForm.setFieldsValue(preset)
                }}
              />
            </Form.Item>
          ) : null}
          <Form.Item name="code" label="店铺编码" rules={[{ required: true }]}>
            <Input disabled={Boolean(editingStore)} />
          </Form.Item>
          <Form.Item name="name" label="店铺名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="platform" label="平台" rules={[{ required: true }]}>
            <Input disabled={Boolean(editingStore)} />
          </Form.Item>
          <Space align="start">
            <Form.Item name="market" label="市场" rules={[{ required: true }]}>
              <Input maxLength={2} disabled={Boolean(editingStore)} />
            </Form.Item>
            <Form.Item
              name="currency"
              label="币种"
              rules={[{ required: true }]}
            >
              <Input maxLength={3} />
            </Form.Item>
            <Form.Item name="locale" label="语言" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </Space>
          <Form.Item name="timezone" label="时区" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`新建商品刊登 · ${currentStore?.name ?? ''}`}
        open={listingModalOpen}
        confirmLoading={saving}
        onOk={() => void saveListing()}
        onCancel={() => setListingModalOpen(false)}
      >
        <Form form={listingForm} layout="vertical">
          <Form.Item
            name="productId"
            label="主商品"
            rules={[{ required: true }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              onChange={handleProductChange}
              options={products.map((product) => ({
                value: product.id,
                label: `${product.code} · ${product.title}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="title" label="店铺标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="description"
            label="店铺描述"
            rules={[{ required: true }]}
          >
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="externalProductId" label="平台商品编号">
            <Input />
          </Form.Item>
          <Space align="start">
            <Form.Item
              name="language"
              label="语言"
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item name="price" label="价格" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item
              name="currency"
              label="币种"
              rules={[{ required: true }]}
            >
              <Input disabled />
            </Form.Item>
          </Space>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'DRAFT', label: '草稿' },
                { value: 'PUBLISHED', label: '已发布' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </main>
  )
}
