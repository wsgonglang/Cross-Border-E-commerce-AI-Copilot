import {
  DeleteOutlined,
  SaveOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import type { OrderSavedView, OrderViewColumn } from '@cross-border/shared'
import { Button, Checkbox, Popconfirm, Popover, Select } from 'antd'
import { useTranslation } from 'react-i18next'

import { columnDefinitions } from '../order.constants'

interface OrderViewBarProps {
  activeViewId?: string
  onApply: (viewId?: string) => void
  onColumnsChange: (columns: OrderViewColumn[]) => void
  onOpenSave: () => void
  onOverwrite: () => void
  onRemove: () => void
  views: OrderSavedView[]
  visibleColumns: OrderViewColumn[]
}

export function OrderViewBar({
  activeViewId,
  onApply,
  onColumnsChange,
  onOpenSave,
  onOverwrite,
  onRemove,
  views,
  visibleColumns,
}: OrderViewBarProps) {
  const { t } = useTranslation()
  return (
    <section className="order-view-bar" aria-label={t('orders.savedViews')}>
      <Select
        allowClear
        className="order-view-select"
        placeholder={t('orders.selectView')}
        value={activeViewId}
        onChange={onApply}
        options={views.map((view) => ({
          value: view.id,
          label: `${view.name}${view.isDefault ? ` · ${t('orders.default')}` : ''}`,
        }))}
      />
      <Button icon={<SaveOutlined />} onClick={onOpenSave}>
        {t('orders.saveView')}
      </Button>
      <Button disabled={!activeViewId} onClick={onOverwrite}>
        {t('orders.overwriteView')}
      </Button>
      <Popconfirm title={t('orders.deleteViewTitle')} onConfirm={onRemove}>
        <Button danger icon={<DeleteOutlined />} disabled={!activeViewId}>
          {t('orders.delete')}
        </Button>
      </Popconfirm>
      <Popover
        trigger="click"
        content={
          <Checkbox.Group
            value={visibleColumns}
            options={columnDefinitions.map((item) => ({
              value: item.value,
              label: t(item.labelKey),
            }))}
            onChange={(values) => {
              if (values.length) onColumnsChange(values)
            }}
          />
        }
      >
        <Button icon={<SettingOutlined />}>{t('orders.columns')}</Button>
      </Popover>
    </section>
  )
}
