import type {
  ProductStatus,
  ProductSummary,
  SkuSummary,
} from '@cross-border/shared'
import {
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  type FormInstance,
} from 'antd'
import { useTranslation } from 'react-i18next'

import type { ProductInput, SkuInput } from '../../../api/commerce'

export interface StockFormInput {
  delta: number
  reason: string
}

interface Props {
  productForm: FormInstance<ProductInput>
  skuForm: FormInstance<SkuInput>
  stockForm: FormInstance<StockFormInput>
  editingProduct: ProductSummary | null
  editingSku: SkuSummary | null
  stockSku: SkuSummary | null
  productOpen: boolean
  skuOpen: boolean
  stockOpen: boolean
  saving: boolean
  statusLabels: Record<ProductStatus, string>
  onSaveProduct: () => Promise<void>
  onSaveSku: () => Promise<void>
  onSaveStock: () => Promise<void>
  onCloseProduct: () => void
  onCloseSku: () => void
  onCloseStock: () => void
}

export function ProductEditModals({
  productForm,
  skuForm,
  stockForm,
  editingProduct,
  editingSku,
  stockSku,
  productOpen,
  skuOpen,
  stockOpen,
  saving,
  statusLabels,
  onSaveProduct,
  onSaveSku,
  onSaveStock,
  onCloseProduct,
  onCloseSku,
  onCloseStock,
}: Props) {
  const { t } = useTranslation()

  return (
    <>
      <Modal
        title={
          editingProduct ? t('products.editProduct') : t('products.create')
        }
        open={productOpen}
        confirmLoading={saving}
        onOk={() => void onSaveProduct()}
        onCancel={onCloseProduct}
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
                options={Object.entries(statusLabels).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal
        title={editingSku ? t('products.editSku') : t('products.addSku')}
        open={skuOpen}
        confirmLoading={saving}
        onOk={() => void onSaveSku()}
        onCancel={onCloseSku}
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
        title={t('products.adjustStockTitle', { code: stockSku?.code ?? '' })}
        open={stockOpen}
        confirmLoading={saving}
        onOk={() => void onSaveStock()}
        onCancel={onCloseStock}
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
    </>
  )
}
