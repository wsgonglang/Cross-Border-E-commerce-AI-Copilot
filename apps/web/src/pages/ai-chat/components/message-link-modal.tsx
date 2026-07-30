import type { AiMessage } from '@cross-border/shared'
import { Alert, Form, Input, Modal, Select } from 'antd'
import { useEffect } from 'react'

import type { LinkFormValues } from '../ai-chat.types'

interface MessageLinkModalProps {
  message: AiMessage | null
  onCancel: () => void
  onSave: (message: AiMessage, values: LinkFormValues) => Promise<void>
}

export function MessageLinkModal({
  message,
  onCancel,
  onSave,
}: MessageLinkModalProps) {
  const [form] = Form.useForm<LinkFormValues>()

  useEffect(() => {
    if (!message) return
    form.setFieldsValue({
      entityType: 'PRODUCT',
      entityReference: '',
    })
  }, [form, message])

  const save = async () => {
    if (!message) return
    await onSave(message, await form.validateFields())
    form.resetFields()
  }

  return (
    <Modal
      open={Boolean(message)}
      title="关联业务对象"
      okText="关联"
      cancelText="取消"
      onOk={() => void save()}
      onCancel={onCancel}
    >
      <Alert
        type="info"
        showIcon
        title="使用业务编号关联，服务端会验证当前商家范围"
      />
      <Form form={form} layout="vertical" className="modal-form">
        <Form.Item
          name="entityType"
          label="对象类型"
          rules={[{ required: true }]}
        >
          <Select
            options={[
              { label: '商品', value: 'PRODUCT' },
              { label: '订单', value: 'ORDER' },
            ]}
          />
        </Form.Item>
        <Form.Item
          name="entityReference"
          label="商品编码或订单号"
          rules={[{ required: true, max: 64 }]}
        >
          <Input placeholder="例如 P-DEMO-001 或 ORD-20260701-001" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
