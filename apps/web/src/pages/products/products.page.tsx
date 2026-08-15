import type {
  AuditLogSummary,
  ProductStatus,
  ProductSummary,
  SkuSummary,
} from '@cross-border/shared'
import { useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Form, Input, Select, Space, message } from 'antd'
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
import type { AppLanguage } from '../../i18n/i18n'
import { useProductsQuery } from '../../queries/commerce.queries'
import { queryKeys } from '../../queries/query-keys'
import { useAppSelector } from '../../store/hooks'
import { ProductAuditDrawer } from './components/product-audit-drawer'
import { ProductCatalogTable } from './components/product-catalog-table'
import {
  ProductEditModals,
  type StockFormInput,
} from './components/product-edit-modals'

import './styles.css'

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
  const [stockForm] = Form.useForm<StockFormInput>()
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
        await updateProduct(token, merchantId, editingProduct.id, {
          ...values,
          expectedVersion: editingProduct.version,
        })
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
        <ProductCatalogTable
          loading={loading}
          products={products}
          page={page}
          pageSize={pageSize}
          total={total}
          canWrite={canWrite}
          statusLabels={productStatusLabels}
          onPageChange={(nextPage, nextPageSize) => {
            setPage(nextPage)
            setPageSize(nextPageSize)
          }}
          onEditProduct={openProduct}
          onOptimizeProduct={setOptimizationProduct}
          onAddSku={openSku}
          onEditSku={openSku}
          onAdjustStock={openStock}
          onDisableSku={setSkuDisabled}
        />
      </div>

      <ProductEditModals
        productForm={productForm}
        skuForm={skuForm}
        stockForm={stockForm}
        editingProduct={editingProduct}
        editingSku={editingSku}
        stockSku={stockSku}
        productOpen={productModalOpen}
        skuOpen={skuModalOpen}
        stockOpen={stockModalOpen}
        saving={saving}
        statusLabels={productStatusLabels}
        onSaveProduct={saveProduct}
        onSaveSku={saveSku}
        onSaveStock={saveStock}
        onCloseProduct={() => setProductModalOpen(false)}
        onCloseSku={() => setSkuModalOpen(false)}
        onCloseStock={() => setStockModalOpen(false)}
      />

      <ProductAuditDrawer
        open={auditOpen}
        logs={auditLogs}
        language={language}
        onClose={() => setAuditOpen(false)}
      />

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
