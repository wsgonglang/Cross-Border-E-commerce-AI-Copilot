import type { AiSharedSession } from '@cross-border/shared'
import { Alert, Avatar, Button, Card, Empty, Spin, Tag, Typography } from 'antd'
import { ArrowLeftOutlined, LockOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { getSharedAiSession } from '../../api/ai'
import { useBusinessContext } from '../../contexts/business-context'
import { useAppSelector } from '../../store/hooks'

import '../ai-chat/message-styles.css'
import './styles.css'

export function AiSharePage() {
  const token = useAppSelector((state) => state.auth.accessToken) ?? ''
  const { merchantId, setMerchantId, merchants } = useBusinessContext()
  const { shareId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const requestedMerchantId = searchParams.get('merchantId') ?? ''
  const [share, setShare] = useState<AiSharedSession>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (
      requestedMerchantId &&
      requestedMerchantId !== merchantId &&
      merchants.some((merchant) => merchant.id === requestedMerchantId)
    ) {
      setMerchantId(requestedMerchantId)
    }
  }, [merchantId, merchants, requestedMerchantId, setMerchantId])

  useEffect(() => {
    const targetMerchantId = requestedMerchantId || merchantId
    if (!token || !targetMerchantId || !shareId) return
    void getSharedAiSession(token, targetMerchantId, shareId)
      .then(setShare)
      .catch((loadError: Error) => setError(loadError.message))
  }, [merchantId, requestedMerchantId, shareId, token])

  return (
    <main className="workspace-page shared-session-page">
      <header className="workspace-header">
        <div>
          <span className="page-kicker">内部只读分享</span>
          <h1>{share?.title ?? 'AI 会话快照'}</h1>
          <p>
            {share
              ? `${share.ownerName} 创建 · 有效期至 ${new Date(
                  share.expiresAt,
                ).toLocaleString('zh-CN')}`
              : '正在验证访问权限'}
          </p>
        </div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => void navigate('/')}>
          返回工作台
        </Button>
      </header>

      <Alert
        type="info"
        showIcon
        icon={<LockOutlined />}
        title="这是创建分享时保存的脱敏只读快照"
        description="该页面不会展示原会话中的客户邮箱、电话或地址，也不能继续生成或修改消息。"
      />

      {error ? (
        <Alert type="error" showIcon title="无法访问分享" description={error} />
      ) : !share ? (
        <div className="dashboard-loading">
          <Spin size="large" />
        </div>
      ) : share.messages.length ? (
        <Card className="shared-session-card">
          {share.messages.map((message) => (
            <div
              key={message.id}
              className={`ai-chat-message ${
                message.role === 'user'
                  ? 'ai-chat-message-user'
                  : 'ai-chat-message-ai'
              }`}
            >
              <Avatar
                className={`ai-chat-avatar ${
                  message.role === 'user'
                    ? 'ai-chat-avatar-user'
                    : 'ai-chat-avatar-assistant'
                }`}
              >
                {message.role === 'user' ? 'U' : 'AI'}
              </Avatar>
              <div className="ai-chat-message-content">
                <Tag>{message.role}</Tag>
                <Typography.Paragraph className="ai-chat-bubble">
                  {message.content}
                </Typography.Paragraph>
              </div>
            </div>
          ))}
        </Card>
      ) : (
        <Empty description="分享快照中没有消息" />
      )}
    </main>
  )
}
