import { ShareAltOutlined } from '@ant-design/icons'
import type {
  AiShareCandidate,
  AiSessionShareSummary,
  AiSessionSummary,
} from '@cross-border/shared'
import { Alert, Button, Form, List, Modal, Select, Space, Tag } from 'antd'
import { useEffect } from 'react'

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
      title="内部只读分享"
      footer={null}
      onCancel={onCancel}
    >
      <Alert
        type="warning"
        showIcon
        title="仅当前商家的指定登录用户可访问"
        description="分享保存创建时的脱敏快照，不会随原会话后续修改；到期或撤销后立即失效。"
      />
      <Form form={form} layout="vertical" className="modal-form">
        <Form.Item
          name="recipientUserIds"
          label="授权同事"
          rules={[{ required: true, message: '请选择至少一位同事' }]}
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
          label="有效期"
          rules={[{ required: true }]}
        >
          <Select
            options={[
              { label: '1 小时', value: 1 },
              { label: '24 小时', value: 24 },
              { label: '3 天', value: 72 },
              { label: '7 天', value: 168 },
            ]}
          />
        </Form.Item>
        <Button
          type="primary"
          icon={<ShareAltOutlined />}
          onClick={() => void create()}
        >
          创建分享快照
        </Button>
      </Form>
      <List
        header="已创建分享"
        locale={{ emptyText: '暂无分享' }}
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
                      复制链接
                    </Button>,
                    <Button
                      key="revoke"
                      type="link"
                      danger
                      onClick={() => void onRevoke(share.id)}
                    >
                      撤销
                    </Button>,
                  ]
            }
          >
            <List.Item.Meta
              title={
                <Space>
                  <span>{share.recipientCount} 位收件人</span>
                  {share.revokedAt ? <Tag color="red">已撤销</Tag> : null}
                </Space>
              }
              description={`有效期至 ${new Date(share.expiresAt).toLocaleString('zh-CN')}`}
            />
          </List.Item>
        )}
      />
    </Modal>
  )
}
