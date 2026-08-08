import type { AiMessage } from '@cross-border/shared'
import { Alert, Form, Input, Modal } from 'antd'
import { useEffect } from 'react'

export function MessageEditModal({
  message,
  onCancel,
  onSave,
}: {
  message: AiMessage | null
  onCancel: () => void
  onSave: (content: string) => Promise<void>
}) {
  const [form] = Form.useForm<{ content: string }>()
  useEffect(() => {
    if (message) form.setFieldsValue({ content: message.content })
  }, [form, message])

  return (
    <Modal
      title="编辑消息并创建分支"
      open={Boolean(message)}
      okText="发送新分支"
      cancelText="取消"
      onCancel={onCancel}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <Alert
        type="info"
        showIcon
        title="原消息和原回答会保留，可随时通过分支导航切换回来。"
      />
      <Form
        form={form}
        layout="vertical"
        onFinish={({ content }) => void onSave(content)}
      >
        <Form.Item
          name="content"
          label="消息内容"
          rules={[
            { required: true, whitespace: true, message: '请输入消息内容' },
          ]}
        >
          <Input.TextArea rows={6} maxLength={10_000} showCount />
        </Form.Item>
      </Form>
    </Modal>
  )
}
