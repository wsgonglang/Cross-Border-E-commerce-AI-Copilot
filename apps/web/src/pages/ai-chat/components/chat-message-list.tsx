import {
  CopyOutlined,
  EditOutlined,
  HeartFilled,
  HeartOutlined,
  LeftOutlined,
  LinkOutlined,
  ReloadOutlined,
  RightOutlined,
} from '@ant-design/icons'
import type { AiMessage, AiMessageLinkType } from '@cross-border/shared'
import {
  Alert,
  Avatar,
  Button,
  Collapse,
  Empty,
  Space,
  Tag,
  Tooltip,
} from 'antd'
import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'

import type { AiSessionView } from '../ai-chat.types'
import { getMessageSiblings } from '../branching'
import { MarkdownMessage } from './markdown-message'

interface ChatMessageListProps {
  currentSessionId: string | null
  endRef: RefObject<HTMLDivElement | null>
  error: string | null
  messages: AiMessage[]
  allMessages?: AiMessage[]
  streaming?: boolean
  onBusinessNavigate: (
    entityType: AiMessageLinkType,
    entityCode: string,
  ) => void
  onClearError: () => void
  onCopy: (message: AiMessage) => Promise<void>
  onFavorite: (message: AiMessage) => Promise<void>
  onLink: (message: AiMessage) => void
  onEdit?: (message: AiMessage) => void
  onRegenerate?: (message: AiMessage) => Promise<void>
  onSelectBranch?: (messageId: string) => Promise<void>
  sessionView: AiSessionView
}

export function ChatMessageList({
  currentSessionId,
  endRef,
  error,
  messages,
  allMessages = messages,
  streaming = false,
  onBusinessNavigate,
  onClearError,
  onCopy,
  onFavorite,
  onLink,
  onEdit,
  onRegenerate,
  onSelectBranch,
  sessionView,
}: ChatMessageListProps) {
  const { t } = useTranslation()

  return (
    <div className="ai-chat-messages">
      {error ? (
        <Alert type="error" title={error} closable onClose={onClearError} />
      ) : null}
      {!currentSessionId ? (
        <Empty
          description={
            sessionView === 'archived'
              ? t('aiChat.messages.noArchived')
              : t('aiChat.messages.empty')
          }
        />
      ) : null}
      {messages.map((item) => {
        const siblings = getMessageSiblings(allMessages, item)
        const branchIndex = siblings.findIndex(
          (sibling) => sibling.id === item.id,
        )
        return (
          <div
            key={item.id}
            className={`ai-chat-message ${
              item.role === 'user'
                ? 'ai-chat-message-user'
                : 'ai-chat-message-ai'
            }`}
          >
            <Avatar
              className={`ai-chat-avatar ${
                item.role === 'user'
                  ? 'ai-chat-avatar-user'
                  : 'ai-chat-avatar-assistant'
              }`}
              size={32}
            >
              {item.role === 'user' ? 'U' : 'AI'}
            </Avatar>
            <div className="ai-chat-message-content">
              <div className="ai-chat-bubble">
                {item.content ? (
                  item.role === 'assistant' ? (
                    <MarkdownMessage content={item.content} />
                  ) : (
                    item.content
                  )
                ) : (
                  <span className="ai-chat-thinking">
                    {t('aiChat.messages.thinking')}
                  </span>
                )}
              </div>
              {item.agentRun?.toolCalls.length ? (
                <Collapse
                  ghost
                  size="small"
                  className="ai-agent-trace"
                  items={[
                    {
                      key: 'trace',
                      label: t('aiChat.messages.trace', {
                        count: item.agentRun.toolCalls.length,
                      }),
                      children: (
                        <Space direction="vertical" size={6}>
                          {item.agentRun.toolCalls.map((call) => (
                            <Space key={call.id} wrap>
                              <Tag
                                color={
                                  call.status === 'success' ? 'green' : 'red'
                                }
                              >
                                {call.status === 'success'
                                  ? t('aiChat.messages.success')
                                  : t('aiChat.messages.failed')}
                              </Tag>
                              <span>{call.name}</span>
                            </Space>
                          ))}
                          <span>
                            Token {item.agentRun.usage.totalTokens}
                            {item.agentRun.modelName
                              ? ` · ${item.agentRun.modelName}`
                              : ''}
                          </span>
                        </Space>
                      ),
                    },
                  ]}
                />
              ) : null}
              {!item.id.startsWith('optimistic-') ? (
                <Space size={4} className="ai-message-actions">
                  <Tooltip title={t('aiChat.messages.copy')}>
                    <Button
                      type="text"
                      size="small"
                      aria-label={t('aiChat.messages.copy')}
                      icon={<CopyOutlined />}
                      onClick={() => void onCopy(item)}
                    />
                  </Tooltip>
                  <Tooltip
                    title={
                      item.favorited
                        ? t('aiChat.messages.unfavorite')
                        : t('aiChat.messages.favorite')
                    }
                  >
                    <Button
                      type="text"
                      size="small"
                      aria-label={
                        item.favorited
                          ? t('aiChat.messages.unfavoriteLabel')
                          : t('aiChat.messages.favorite')
                      }
                      icon={
                        item.favorited ? (
                          <HeartFilled className="favorite-active" />
                        ) : (
                          <HeartOutlined />
                        )
                      }
                      onClick={() => void onFavorite(item)}
                    />
                  </Tooltip>
                  <Button
                    type="text"
                    size="small"
                    aria-label={t('aiChat.messages.link')}
                    icon={<LinkOutlined />}
                    onClick={() => onLink(item)}
                  >
                    {t('aiChat.messages.link')}
                  </Button>
                  {item.role === 'user' ? (
                    <Button
                      type="text"
                      size="small"
                      aria-label={t('aiChat.messages.editLabel')}
                      icon={<EditOutlined />}
                      disabled={streaming}
                      onClick={() => onEdit?.(item)}
                    >
                      {t('aiChat.messages.edit')}
                    </Button>
                  ) : (
                    <Button
                      type="text"
                      size="small"
                      aria-label={t('aiChat.messages.regenerateLabel')}
                      icon={<ReloadOutlined />}
                      disabled={streaming}
                      onClick={() => void onRegenerate?.(item)}
                    >
                      {t('aiChat.messages.regenerate')}
                    </Button>
                  )}
                </Space>
              ) : null}
              {siblings.length > 1 && branchIndex >= 0 ? (
                <Space size={2} className="ai-message-branch-nav">
                  <Button
                    type="text"
                    size="small"
                    aria-label={t('aiChat.messages.previousBranch')}
                    icon={<LeftOutlined />}
                    disabled={streaming || branchIndex === 0}
                    onClick={() =>
                      void onSelectBranch?.(siblings[branchIndex - 1]!.id)
                    }
                  />
                  <span>
                    {branchIndex + 1} / {siblings.length}
                  </span>
                  <Button
                    type="text"
                    size="small"
                    aria-label={t('aiChat.messages.nextBranch')}
                    icon={<RightOutlined />}
                    disabled={streaming || branchIndex === siblings.length - 1}
                    onClick={() =>
                      void onSelectBranch?.(siblings[branchIndex + 1]!.id)
                    }
                  />
                </Space>
              ) : null}
              {item.links.length ? (
                <Space wrap className="message-business-links">
                  {item.links.map((link) => (
                    <Button
                      key={link.id}
                      size="small"
                      icon={<LinkOutlined />}
                      onClick={() =>
                        onBusinessNavigate(link.entityType, link.entityCode)
                      }
                    >
                      {link.entityLabel}
                    </Button>
                  ))}
                </Space>
              ) : null}
            </div>
          </div>
        )
      })}
      <div ref={endRef} />
    </div>
  )
}
