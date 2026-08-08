import type { AiMessage } from '@cross-border/shared'
import { Alert, Form, Input, Modal, Select } from 'antd'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
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
      title={t('aiChat.linkMessage.title')}
      okText={t('aiChat.linkMessage.submit')}
      cancelText={t('common.cancel')}
      onOk={() => void save()}
      onCancel={onCancel}
    >
      <Alert type="info" showIcon title={t('aiChat.linkMessage.hint')} />
      <Form form={form} layout="vertical" className="modal-form">
        <Form.Item
          name="entityType"
          label={t('aiChat.linkMessage.type')}
          rules={[{ required: true }]}
        >
          <Select
            options={[
              { label: t('aiChat.linkMessage.product'), value: 'PRODUCT' },
              { label: t('aiChat.linkMessage.order'), value: 'ORDER' },
            ]}
          />
        </Form.Item>
        <Form.Item
          name="entityReference"
          label={t('aiChat.linkMessage.reference')}
          rules={[{ required: true, max: 64 }]}
        >
          <Input placeholder={t('aiChat.linkMessage.placeholder')} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
