import { Checkbox, Input, Modal, Space, Typography } from 'antd'

interface SaveOrderViewModalProps {
  isDefault: boolean
  name: string
  onCancel: () => void
  onDefaultChange: (value: boolean) => void
  onNameChange: (value: string) => void
  onSave: () => void
  open: boolean
}

export function SaveOrderViewModal({
  isDefault,
  name,
  onCancel,
  onDefaultChange,
  onNameChange,
  onSave,
  open,
}: SaveOrderViewModalProps) {
  return (
    <Modal
      title="保存订单视图"
      open={open}
      onCancel={onCancel}
      onOk={onSave}
      okButtonProps={{ disabled: !name.trim() }}
    >
      <Space direction="vertical" className="order-view-form">
        <Input
          maxLength={80}
          placeholder="例如：待发货高金额订单"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
        />
        <Checkbox
          checked={isDefault}
          onChange={(event) => onDefaultChange(event.target.checked)}
        >
          设为默认视图
        </Checkbox>
        <Typography.Text type="secondary">
          将保存当前店铺、筛选条件、排序和列设置。
        </Typography.Text>
      </Space>
    </Modal>
  )
}
