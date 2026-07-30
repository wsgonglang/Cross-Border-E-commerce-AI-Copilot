import {
  DeleteOutlined,
  SaveOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import type { OrderSavedView, OrderViewColumn } from '@cross-border/shared'
import { Button, Checkbox, Popconfirm, Popover, Select } from 'antd'

import { allColumns } from '../order.constants'

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
  return (
    <section className="order-view-bar" aria-label="订单保存视图">
      <Select
        allowClear
        className="order-view-select"
        placeholder="选择保存视图"
        value={activeViewId}
        onChange={onApply}
        options={views.map((view) => ({
          value: view.id,
          label: `${view.name}${view.isDefault ? ' · 默认' : ''}`,
        }))}
      />
      <Button icon={<SaveOutlined />} onClick={onOpenSave}>
        保存当前视图
      </Button>
      <Button disabled={!activeViewId} onClick={onOverwrite}>
        覆盖视图
      </Button>
      <Popconfirm title="删除当前保存视图？" onConfirm={onRemove}>
        <Button danger icon={<DeleteOutlined />} disabled={!activeViewId}>
          删除
        </Button>
      </Popconfirm>
      <Popover
        trigger="click"
        content={
          <Checkbox.Group
            value={visibleColumns}
            options={allColumns}
            onChange={(values) => {
              if (values.length) onColumnsChange(values)
            }}
          />
        }
      >
        <Button icon={<SettingOutlined />}>列设置</Button>
      </Popover>
    </section>
  )
}
