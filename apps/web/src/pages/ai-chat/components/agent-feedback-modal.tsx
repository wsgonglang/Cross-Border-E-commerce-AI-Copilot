import type { AgentFeedbackReason } from '@cross-border/shared'
import { Form, Input, Modal, Select } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

export interface AgentFeedbackFormValues {
  reason: AgentFeedbackReason
  comment?: string
}

interface AgentFeedbackModalProps {
  open: boolean
  onCancel: () => void
  onSubmit: (values: AgentFeedbackFormValues) => Promise<boolean>
}

const reasons: AgentFeedbackReason[] = [
  'WRONG_TOOL',
  'INACCURATE_DATA',
  'INCOMPLETE_ANSWER',
  'CITATION_ISSUE',
  'TOO_SLOW',
  'OTHER',
]

export function AgentFeedbackModal({
  open,
  onCancel,
  onSubmit,
}: AgentFeedbackModalProps) {
  const { t } = useTranslation()
  const [form] = Form.useForm<AgentFeedbackFormValues>()
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) form.resetFields()
  }, [form, open])

  const submit = async (values: AgentFeedbackFormValues) => {
    setSubmitting(true)
    try {
      if (await onSubmit(values)) form.resetFields()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      title={t('aiChat.feedback.title')}
      okText={t('aiChat.feedback.submit')}
      cancelText={t('common.cancel')}
      confirmLoading={submitting}
      onCancel={onCancel}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => void submit(values)}
      >
        <Form.Item
          name="reason"
          label={t('aiChat.feedback.reason')}
          rules={[
            { required: true, message: t('aiChat.feedback.reasonRequired') },
          ]}
        >
          <Select
            options={reasons.map((reason) => ({
              value: reason,
              label: t(`aiChat.feedback.reasons.${reason}`),
            }))}
          />
        </Form.Item>
        <Form.Item name="comment" label={t('aiChat.feedback.comment')}>
          <Input.TextArea
            maxLength={500}
            showCount
            autoSize={{ minRows: 3, maxRows: 6 }}
            placeholder={t('aiChat.feedback.commentPlaceholder')}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
