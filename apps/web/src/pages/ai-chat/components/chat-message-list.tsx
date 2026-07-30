import { HeartFilled, HeartOutlined, LinkOutlined } from '@ant-design/icons'
import type { AiMessage, AiMessageLinkType } from '@cross-border/shared'
import { Alert, Avatar, Button, Empty, Space, Tooltip } from 'antd'
import type { RefObject } from 'react'

import type { AiSessionView } from '../ai-chat.types'

interface ChatMessageListProps {
  currentSessionId: string | null
  endRef: RefObject<HTMLDivElement | null>
  error: string | null
  messages: AiMessage[]
  onBusinessNavigate: (
    entityType: AiMessageLinkType,
    entityCode: string,
  ) => void
  onClearError: () => void
  onFavorite: (message: AiMessage) => Promise<void>
  onLink: (message: AiMessage) => void
  sessionView: AiSessionView
}

export function ChatMessageList({
  currentSessionId,
  endRef,
  error,
  messages,
  onBusinessNavigate,
  onClearError,
  onFavorite,
  onLink,
  sessionView,
}: ChatMessageListProps) {
  return (
    <div className="ai-chat-messages">
      {error ? (
        <Alert type="error" title={error} closable onClose={onClearError} />
      ) : null}
      {!currentSessionId ? (
        <Empty
          description={
            sessionView === 'archived'
              ? '没有已归档会话'
              : '新建或选择一个会话开始协作'
          }
        />
      ) : null}
      {messages.map((item) => (
        <div
          key={item.id}
          className={`ai-chat-message ${
            item.role === 'user' ? 'ai-chat-message-user' : 'ai-chat-message-ai'
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
              {item.content || (
                <span className="ai-chat-thinking">思考中…</span>
              )}
            </div>
            {!item.id.startsWith('optimistic-') ? (
              <Space size={4} className="ai-message-actions">
                <Tooltip title={item.favorited ? '取消收藏' : '收藏消息'}>
                  <Button
                    type="text"
                    size="small"
                    aria-label={item.favorited ? '取消收藏消息' : '收藏消息'}
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
                  aria-label="关联业务"
                  icon={<LinkOutlined />}
                  onClick={() => onLink(item)}
                >
                  关联业务
                </Button>
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
      ))}
      <div ref={endRef} />
    </div>
  )
}
