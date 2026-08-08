import { Checkbox, Input, Modal, Space, Typography } from 'antd'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
  return (
    <Modal
      title={t('orders.saveViewTitle')}
      open={open}
      onCancel={onCancel}
      onOk={onSave}
      okButtonProps={{ disabled: !name.trim() }}
    >
      <Space direction="vertical" className="order-view-form">
        <Input
          maxLength={80}
          placeholder={t('orders.viewNameExample')}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
        />
        <Checkbox
          checked={isDefault}
          onChange={(event) => onDefaultChange(event.target.checked)}
        >
          {t('orders.setDefault')}
        </Checkbox>
        <Typography.Text type="secondary">
          {t('orders.viewHint')}
        </Typography.Text>
      </Space>
    </Modal>
  )
}
