import type { AiSessionSummary } from '@cross-border/shared'
import { ArrowRightOutlined, MessageOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Input, List, Space, Tag, Typography } from 'antd'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { formatDateTime } from '../../i18n/formatters'
import type { AppLanguage } from '../../i18n/i18n'
import type { AiChatNavigationState } from '../ai-chat/navigation'

interface DashboardAiEntryProps {
  canUseAssistant: boolean
  days: number
  loadingSessions: boolean
  onOpen: (state?: AiChatNavigationState) => void
  sessionError?: string
  sessions: AiSessionSummary[]
  storeName?: string
}

export function DashboardAiEntry({
  canUseAssistant,
  days,
  loadingSessions,
  onOpen,
  sessionError,
  sessions,
  storeName,
}: DashboardAiEntryProps) {
  const { t, i18n } = useTranslation()
  const language: AppLanguage =
    i18n.resolvedLanguage === 'en-US' ? 'en-US' : 'zh-CN'
  const [prompt, setPrompt] = useState('')
  const quickPrompts = useMemo(
    () => [
      t('dashboard.aiPromptPerformance', { days }),
      t('dashboard.aiPromptInventory', {
        store: storeName ?? t('common.allStores'),
      }),
      t('dashboard.aiPromptDrafts'),
    ],
    [days, storeName, t],
  )

  const openPrompt = (value: string) => {
    const prefill = value.trim()
    if (prefill) onOpen({ prefill })
  }

  if (!canUseAssistant) {
    return (
      <Card
        title={t('dashboard.aiAssistant')}
        className="dashboard-full-card dashboard-ai-entry"
      >
        <Alert
          type="info"
          showIcon
          title={t('dashboard.assistantRestrictedTitle')}
          description={t('dashboard.assistantRestrictedDescription')}
        />
      </Card>
    )
  }

  return (
    <Card
      title={t('dashboard.aiAssistant')}
      className="dashboard-full-card dashboard-ai-entry"
      extra={
        <Button type="link" onClick={() => onOpen()}>
          {t('dashboard.openAssistant')}
        </Button>
      }
    >
      <Typography.Paragraph type="secondary">
        {t('dashboard.aiAssistantDescription', {
          store: storeName ?? t('common.allStores'),
          days,
        })}{' '}
        {t('dashboard.writeHint')}
      </Typography.Paragraph>

      <Space wrap className="dashboard-ai-prompts">
        {quickPrompts.map((item) => (
          <Button key={item} size="small" onClick={() => openPrompt(item)}>
            {item}
          </Button>
        ))}
      </Space>

      <Space.Compact block className="dashboard-ai-input">
        <Input
          value={prompt}
          maxLength={1000}
          aria-label={t('dashboard.aiInput')}
          placeholder={t('dashboard.aiInput')}
          onChange={(event) => setPrompt(event.target.value)}
          onPressEnter={() => openPrompt(prompt)}
        />
        <Button
          type="primary"
          icon={<ArrowRightOutlined />}
          disabled={!prompt.trim()}
          onClick={() => openPrompt(prompt)}
        >
          {t('dashboard.continueInAssistant')}
        </Button>
      </Space.Compact>

      <div className="dashboard-recent-sessions-heading">
        <Typography.Text strong>
          {t('dashboard.recentSessions')}
        </Typography.Text>
        <Typography.Text type="secondary">
          {t('dashboard.sessionHint')}
        </Typography.Text>
      </div>
      {sessionError ? (
        <Alert
          type="warning"
          showIcon
          title={t('dashboard.sessionLoadFailed')}
        />
      ) : (
        <List
          size="small"
          loading={loadingSessions}
          locale={{ emptyText: t('dashboard.noSessions') }}
          dataSource={sessions.slice(0, 3)}
          renderItem={(session) => (
            <List.Item
              className="clickable-list-item dashboard-session-item"
              onClick={() => onOpen({ sessionId: session.id })}
            >
              <List.Item.Meta
                avatar={<MessageOutlined />}
                title={session.title}
                description={t('dashboard.sessionMeta', {
                  count: session.messageCount,
                  date: formatDateTime(session.updatedAt, language),
                })}
              />
              {session.status === 'streaming' ? (
                <Tag color="processing">{t('dashboard.sessionStreaming')}</Tag>
              ) : null}
            </List.Item>
          )}
        />
      )}
    </Card>
  )
}
