import {
  EditOutlined,
  HeartFilled,
  HeartOutlined,
  LeftOutlined,
  LinkOutlined,
  ReloadOutlined,
  RightOutlined,
} from '@ant-design/icons'
import type { AiMessage, AiMessageLinkType } from '@cross-border/shared'
import { Alert, Avatar, Button, Empty, Space, Tooltip } from 'antd'
import type { RefObject } from 'react'

import type { AiSessionView } from '../ai-chat.types'
import { getMessageSiblings } from '../branching'

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
  onFavorite,
  onLink,
  onEdit,
  onRegenerate,
  onSelectBranch,
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
                  {item.role === 'user' ? (
                    <Button
                      type="text"
                      size="small"
                      aria-label="编辑并分叉"
                      icon={<EditOutlined />}
                      disabled={streaming}
                      onClick={() => onEdit?.(item)}
                    >
                      编辑
                    </Button>
                  ) : (
                    <Button
                      type="text"
                      size="small"
                      aria-label="重新生成回答"
                      icon={<ReloadOutlined />}
                      disabled={streaming}
                      onClick={() => void onRegenerate?.(item)}
                    >
                      重新生成
                    </Button>
                  )}
                </Space>
              ) : null}
              {siblings.length > 1 && branchIndex >= 0 ? (
                <Space size={2} className="ai-message-branch-nav">
                  <Button
                    type="text"
                    size="small"
                    aria-label="上一个分支"
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
                    aria-label="下一个分支"
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
