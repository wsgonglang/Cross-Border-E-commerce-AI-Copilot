import type { AiMessage } from '@cross-border/shared'
import { Alert, Form, Input, Modal } from 'antd'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export function MessageEditModal({
  message,
  onCancel,
  onSave,
}: {
  message: AiMessage | null
  onCancel: () => void
  onSave: (content: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const [form] = Form.useForm<{ content: string }>()
  useEffect(() => {
    if (message) form.setFieldsValue({ content: message.content })
  }, [form, message])

  return (
    <Modal
      title={t('aiChat.editMessage.title')}
      open={Boolean(message)}
      okText={t('aiChat.editMessage.submit')}
      cancelText={t('common.cancel')}
      onCancel={onCancel}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <Alert type="info" showIcon title={t('aiChat.editMessage.hint')} />
      <Form
        form={form}
        layout="vertical"
        onFinish={({ content }) => void onSave(content)}
      >
        <Form.Item
          name="content"
          label={t('aiChat.editMessage.content')}
          rules={[
            {
              required: true,
              whitespace: true,
              message: t('aiChat.editMessage.required'),
            },
          ]}
        >
          <Input.TextArea rows={6} maxLength={10_000} showCount />
        </Form.Item>
      </Form>
    </Modal>
  )
}
