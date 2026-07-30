import type { AiSessionSummary } from '@cross-border/shared'
import { Form, Input, Modal, Select } from 'antd'
import { useEffect } from 'react'

import type { SessionFormValues } from '../ai-chat.types'

interface SessionEditModalProps {
  groupOptions: Array<{ label: string; value: string }>
  onAddGroup: (group: string) => void
  onCancel: () => void
  onSave: (
    session: AiSessionSummary,
    values: SessionFormValues,
  ) => Promise<void>
  session: AiSessionSummary | null
}

export function SessionEditModal({
  groupOptions,
  onAddGroup,
  onCancel,
  onSave,
  session,
}: SessionEditModalProps) {
  const [form] = Form.useForm<SessionFormValues>()

  useEffect(() => {
    if (!session) return
    form.setFieldsValue({
      title: session.title,
      groupId: session.groupId,
    })
  }, [form, session])

  const save = async () => {
    if (!session) return
    await onSave(session, await form.validateFields())
  }

  return (
    <Modal
      open={Boolean(session)}
      title="重命名与分组"
      okText="保存"
      cancelText="取消"
      onOk={() => void save()}
      onCancel={onCancel}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="title"
          label="会话名称"
          rules={[{ required: true, max: 255 }]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="groupId" label="分组">
          <Select
            allowClear
            showSearch
            options={groupOptions}
            placeholder="选择或输入分组名称"
            popupRender={(menu) => (
              <>
                {menu}
                <Input
                  placeholder="输入新分组后按 Enter"
                  onPressEnter={(event) => {
                    const value = event.currentTarget.value.trim().slice(0, 30)
                    if (!value) return
                    onAddGroup(value)
                    form.setFieldValue('groupId', value)
                    event.currentTarget.value = ''
                  }}
                />
              </>
            )}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
