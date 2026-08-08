import type {
  AiMessage,
  AiMessageLinkType,
  AiSessionSummary,
} from '@cross-border/shared'
import { message as antMessage } from 'antd'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { downloadAiSession } from '../../api/ai'
import { AgentPanel } from '../../components/agent-panel/agent-panel'
import { useBusinessContext } from '../../contexts/business-context'
import { useAppSelector } from '../../store/hooks'
import type {
  AiAssistantMode,
  LinkFormValues,
  SessionFormValues,
  ShareFormValues,
} from './ai-chat.types'
import { AssistantModeHeader } from './components/assistant-mode-header'
import { ChatComposer } from './components/chat-composer'
import { ChatMessageList } from './components/chat-message-list'
import { ConversationSidebar } from './components/conversation-sidebar'
import { MessageLinkModal } from './components/message-link-modal'
import { SessionEditModal } from './components/session-edit-modal'
import { SessionShareModal } from './components/session-share-modal'
import { useAiConversations } from './hooks/use-ai-conversations'
import { useAiMessages } from './hooks/use-ai-messages'
import { useAiSharing } from './hooks/use-ai-sharing'

import './components/styles.css'
import './message-styles.css'
import './styles.css'

export function AiChatPage() {
  const token = useAppSelector((state) => state.auth.accessToken) ?? ''
  const user = useAppSelector((state) => state.auth.user)
  const { merchantId, storeId, currentStore } = useBusinessContext()
  const navigate = useNavigate()
  const [messageApi, messageContext] = antMessage.useMessage()
  const [error, setError] = useState<string | null>(null)
  const [assistantMode, setAssistantMode] = useState<AiAssistantMode>('chat')
  const [editingSession, setEditingSession] = useState<AiSessionSummary | null>(
    null,
  )
  const [linkingMessage, setLinkingMessage] = useState<AiMessage | null>(null)

  const conversations = useAiConversations({
    token,
    merchantId,
    onError: setError,
  })
  const chat = useAiMessages({
    token,
    merchantId,
    currentSessionId: conversations.currentSessionId,
    createSession: conversations.createSession,
    refreshSessions: conversations.loadSessions,
    onSessionLoaded: conversations.updateSessionSummary,
    onError: setError,
  })
  const sharing = useAiSharing({ token, merchantId })

  const groupOptions = useMemo(
    () => conversations.knownGroups.map((value) => ({ label: value, value })),
    [conversations.knownGroups],
  )

  const runAction = async (
    action: () => Promise<unknown>,
    successMessage?: string,
  ): Promise<boolean> => {
    try {
      await action()
      if (successMessage) messageApi.success(successMessage)
      return true
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : '操作失败')
      return false
    }
  }

  const saveSession = async (
    session: AiSessionSummary,
    values: SessionFormValues,
  ) => {
    const saved = await runAction(
      () =>
        conversations.updateSession(session, {
          title: values.title,
          groupId: values.groupId ?? '',
        }),
      '会话信息已更新',
    )
    if (saved) setEditingSession(null)
  }

  const saveMessageLink = async (target: AiMessage, values: LinkFormValues) => {
    const saved = await runAction(
      () => chat.link(target, values),
      '消息已关联业务对象',
    )
    if (saved) setLinkingMessage(null)
  }

  const createShare = async (values: ShareFormValues): Promise<boolean> =>
    runAction(
      () => sharing.create(values.recipientUserIds, values.expiresInHours),
      '内部只读分享已创建',
    )

  const navigateToBusiness = (
    entityType: AiMessageLinkType,
    entityCode: string,
  ) => {
    void navigate(
      entityType === 'PRODUCT'
        ? `/products?keyword=${encodeURIComponent(entityCode)}`
        : `/orders?keyword=${encodeURIComponent(entityCode)}`,
    )
  }

  return (
    <div className="ai-chat-layout">
      {messageContext}
      <ConversationSidebar
        sessions={conversations.sessions}
        streamingSessionIds={chat.streamingSessionIds}
        currentSessionId={conversations.currentSessionId}
        keyword={conversations.keyword}
        sessionView={conversations.sessionView}
        groupId={conversations.groupId}
        groupOptions={groupOptions}
        onNew={async () => {
          await conversations.createSession()
        }}
        onKeywordChange={conversations.setKeyword}
        onViewChange={conversations.setSessionView}
        onGroupChange={conversations.setGroupId}
        onSelect={(sessionId) => {
          conversations.selectSession(sessionId)
          setError(null)
        }}
        onEdit={setEditingSession}
        onPin={(session) =>
          runAction(() =>
            conversations.updateSession(session, {
              pinned: !session.pinned,
            }),
          ).then(() => undefined)
        }
        onShare={(session) =>
          runAction(() => sharing.open(session)).then(() => undefined)
        }
        onDownload={(session, format) =>
          runAction(() =>
            downloadAiSession(token, merchantId, session.id, format),
          ).then(() => undefined)
        }
        onArchive={(session, archived) =>
          runAction(
            () => conversations.archiveSession(session, archived),
            archived ? '会话已归档' : '会话已恢复',
          ).then(() => undefined)
        }
        onDelete={(session) =>
          runAction(() => conversations.removeSession(session)).then(
            () => undefined,
          )
        }
      />

      <div className="ai-chat-main">
        <AssistantModeHeader
          mode={assistantMode}
          currentSession={conversations.currentSession}
          onChange={setAssistantMode}
        />
        {assistantMode === 'agent' ? (
          <AgentPanel
            token={token}
            merchantId={merchantId}
            storeId={storeId || undefined}
            storeName={currentStore?.name}
            sourcePage="ai-chat"
            canWrite={
              user?.roles.some((role) =>
                ['admin', 'operator'].includes(role),
              ) ?? false
            }
          />
        ) : (
          <>
            <ChatMessageList
              currentSessionId={conversations.currentSessionId}
              sessionView={conversations.sessionView}
              messages={chat.messages}
              error={error}
              endRef={chat.messagesEndRef}
              onClearError={() => setError(null)}
              onFavorite={(item) =>
                runAction(() => chat.favorite(item)).then(() => undefined)
              }
              onLink={setLinkingMessage}
              onBusinessNavigate={navigateToBusiness}
            />
            <ChatComposer
              currentSession={conversations.currentSession}
              inputValue={chat.inputValue}
              streaming={chat.streaming}
              onChange={chat.setInputValue}
              onSend={async () => {
                setError(null)
                await chat.send()
              }}
              onStop={chat.stop}
            />
          </>
        )}
      </div>

      <SessionEditModal
        session={editingSession}
        groupOptions={groupOptions}
        onAddGroup={conversations.addKnownGroup}
        onCancel={() => setEditingSession(null)}
        onSave={saveSession}
      />
      <MessageLinkModal
        message={linkingMessage}
        onCancel={() => setLinkingMessage(null)}
        onSave={saveMessageLink}
      />
      <SessionShareModal
        session={sharing.session}
        candidates={sharing.candidates}
        shares={sharing.shares}
        onCancel={sharing.close}
        onCreate={createShare}
        onCopy={async (shareId) => {
          await runAction(() => sharing.copyLink(shareId), '分享链接已复制')
        }}
        onRevoke={async (shareId) => {
          await runAction(() => sharing.revoke(shareId))
        }}
      />
    </div>
  )
}
