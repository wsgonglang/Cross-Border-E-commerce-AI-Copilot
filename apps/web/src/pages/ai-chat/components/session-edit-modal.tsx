import type { AiSessionSummary } from '@cross-border/shared'
import { Form, Input, Modal, Select } from 'antd'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
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
      title={t('aiChat.editSession.title')}
      okText={t('users.save')}
      cancelText={t('common.cancel')}
      onOk={() => void save()}
      onCancel={onCancel}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="title"
          label={t('aiChat.editSession.name')}
          rules={[{ required: true, max: 255 }]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="groupId" label={t('aiChat.editSession.group')}>
          <Select
            allowClear
            showSearch
            options={groupOptions}
            placeholder={t('aiChat.editSession.groupPlaceholder')}
            popupRender={(menu) => (
              <>
                {menu}
                <Input
                  placeholder={t('aiChat.editSession.newGroup')}
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
