import { ShareAltOutlined } from '@ant-design/icons'
import type {
  AiShareCandidate,
  AiSessionShareSummary,
  AiSessionSummary,
} from '@cross-border/shared'
import { Alert, Button, Form, List, Modal, Select, Space, Tag } from 'antd'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import type { ShareFormValues } from '../ai-chat.types'

interface SessionShareModalProps {
  candidates: AiShareCandidate[]
  onCancel: () => void
  onCopy: (shareId: string) => Promise<void>
  onCreate: (values: ShareFormValues) => Promise<boolean>
  onRevoke: (shareId: string) => Promise<void>
  session: AiSessionSummary | null
  shares: AiSessionShareSummary[]
}

export function SessionShareModal({
  candidates,
  onCancel,
  onCopy,
  onCreate,
  onRevoke,
  session,
  shares,
}: SessionShareModalProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage === 'en-US' ? 'en-US' : 'zh-CN'
  const [form] = Form.useForm<ShareFormValues>()

  useEffect(() => {
    if (!session) return
    form.setFieldsValue({ expiresInHours: 24, recipientUserIds: [] })
  }, [form, session])

  const create = async () => {
    const created = await onCreate(await form.validateFields())
    if (created) form.setFieldValue('recipientUserIds', [])
  }

  return (
    <Modal
      width={720}
      open={Boolean(session)}
      title={t('aiChat.share.title')}
      footer={null}
      onCancel={onCancel}
    >
      <Alert
        type="warning"
        showIcon
        title={t('aiChat.share.warning')}
        description={t('aiChat.share.description')}
      />
      <Form form={form} layout="vertical" className="modal-form">
        <Form.Item
          name="recipientUserIds"
          label={t('aiChat.share.recipients')}
          rules={[
            { required: true, message: t('aiChat.share.recipientsRequired') },
          ]}
        >
          <Select
            mode="multiple"
            options={candidates.map((candidate) => ({
              label: `${candidate.name} · ${candidate.email}`,
              value: candidate.id,
            }))}
          />
        </Form.Item>
        <Form.Item
          name="expiresInHours"
          label={t('aiChat.share.expiry')}
          rules={[{ required: true }]}
        >
          <Select
            options={[
              { label: t('aiChat.share.hour'), value: 1 },
              { label: t('aiChat.share.hours24'), value: 24 },
              { label: t('aiChat.share.days3'), value: 72 },
              { label: t('aiChat.share.days7'), value: 168 },
            ]}
          />
        </Form.Item>
        <Button
          type="primary"
          icon={<ShareAltOutlined />}
          onClick={() => void create()}
        >
          {t('aiChat.share.create')}
        </Button>
      </Form>
      <List
        header={t('aiChat.share.created')}
        locale={{ emptyText: t('aiChat.share.empty') }}
        dataSource={shares}
        renderItem={(share) => (
          <List.Item
            actions={
              share.revokedAt
                ? []
                : [
                    <Button
                      key="copy"
                      type="link"
                      onClick={() => void onCopy(share.id)}
                    >
                      {t('aiChat.share.copy')}
                    </Button>,
                    <Button
                      key="revoke"
                      type="link"
                      danger
                      onClick={() => void onRevoke(share.id)}
                    >
                      {t('aiChat.share.revoke')}
                    </Button>,
                  ]
            }
          >
            <List.Item.Meta
              title={
                <Space>
                  <span>
                    {t('aiChat.share.recipientsCount', {
                      count: share.recipientCount,
                    })}
                  </span>
                  {share.revokedAt ? (
                    <Tag color="red">{t('aiChat.share.revoked')}</Tag>
                  ) : null}
                </Space>
              }
              description={t('aiChat.share.expiresAt', {
                date: new Date(share.expiresAt).toLocaleString(locale),
              })}
            />
          </List.Item>
        )}
      />
    </Modal>
  )
}
