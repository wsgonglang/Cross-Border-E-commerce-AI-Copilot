import type {
  AiMessage,
  AiMessageLinkType,
  AiSessionSummary,
} from '@cross-border/shared'
import { message as antMessage } from 'antd'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { downloadAiSession } from '../../api/ai'
import { submitAgentFeedback } from '../../api/agent'
import { useBusinessContext } from '../../contexts/business-context'
import { useAppSelector } from '../../store/hooks'
import type {
  LinkFormValues,
  SessionFormValues,
  ShareFormValues,
} from './ai-chat.types'
import { ChatComposer } from './components/chat-composer'
import {
  AgentFeedbackModal,
  type AgentFeedbackFormValues,
} from './components/agent-feedback-modal'
import { ChatMessageList } from './components/chat-message-list'
import { ConversationSidebar } from './components/conversation-sidebar'
import { MessageLinkModal } from './components/message-link-modal'
import { MessageEditModal } from './components/message-edit-modal'
import { SessionEditModal } from './components/session-edit-modal'
import { SessionShareModal } from './components/session-share-modal'
import { useAiConversations } from './hooks/use-ai-conversations'
import { useAiMessages } from './hooks/use-ai-messages'
import { useAiSharing } from './hooks/use-ai-sharing'

import './components/styles.css'
import './message-styles.css'
import './styles.css'

export function AiChatPage() {
  const { t } = useTranslation()
  const token = useAppSelector((state) => state.auth.accessToken) ?? ''
  const user = useAppSelector((state) => state.auth.user)
  const canCreateDraft = Boolean(
    user?.roles.some((role) => role === 'admin' || role === 'operator'),
  )
  const { merchantId, storeId } = useBusinessContext()
  const navigate = useNavigate()
  const [messageApi, messageContext] = antMessage.useMessage()
  const [error, setError] = useState<string | null>(null)
  const [editingSession, setEditingSession] = useState<AiSessionSummary | null>(
    null,
  )
  const [linkingMessage, setLinkingMessage] = useState<AiMessage | null>(null)
  const [editingMessage, setEditingMessage] = useState<AiMessage | null>(null)
  const [feedbackRunId, setFeedbackRunId] = useState<string | null>(null)

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
    storeId: storeId || undefined,
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
      setError(
        actionError instanceof Error
          ? actionError.message
          : t('aiChat.actionFailed'),
      )
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
      t('aiChat.sessionUpdated'),
    )
    if (saved) setEditingSession(null)
  }

  const saveMessageLink = async (target: AiMessage, values: LinkFormValues) => {
    const saved = await runAction(
      () => chat.link(target, values),
      t('aiChat.messageLinked'),
    )
    if (saved) setLinkingMessage(null)
  }

  const createShare = async (values: ShareFormValues): Promise<boolean> =>
    runAction(
      () => sharing.create(values.recipientUserIds, values.expiresInHours),
      t('aiChat.shareCreated'),
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
            archived ? t('aiChat.archived') : t('aiChat.restored'),
          ).then(() => undefined)
        }
        onDelete={(session) =>
          runAction(() => conversations.removeSession(session)).then(
            () => undefined,
          )
        }
      />

      <div className="ai-chat-main">
        <div className="ai-assistant-mode">
          <div>
            <strong>{t('aiChat.title')}</strong>
            <div>{t('aiChat.description')}</div>
          </div>
        </div>
        <>
          <ChatMessageList
            currentSessionId={conversations.currentSessionId}
            sessionView={conversations.sessionView}
            messages={chat.messages}
            allMessages={chat.allMessages}
            streaming={chat.streaming}
            error={error}
            endRef={chat.messagesEndRef}
            onClearError={() => setError(null)}
            onCopy={(item) =>
              runAction(
                () => navigator.clipboard.writeText(item.content),
                t('aiChat.copied'),
              ).then(() => undefined)
            }
            onFavorite={(item) =>
              runAction(() => chat.favorite(item)).then(() => undefined)
            }
            onFeedback={(runId, rating) =>
              rating === 'HELPFUL'
                ? runAction(
                    () =>
                      submitAgentFeedback(token, merchantId, runId, { rating }),
                    t('aiChat.feedbackSaved'),
                  ).then(() => undefined)
                : Promise.resolve(setFeedbackRunId(runId))
            }
            onLink={setLinkingMessage}
            onEdit={setEditingMessage}
            onRegenerate={chat.regenerate}
            onSelectBranch={chat.selectBranch}
            onBusinessNavigate={navigateToBusiness}
          />
          <ChatComposer
            currentSession={conversations.currentSession}
            inputValue={chat.inputValue}
            streaming={chat.streaming}
            canCreateDraft={canCreateDraft}
            allowDraftCreation={chat.allowDraftCreation}
            onAllowDraftCreationChange={chat.setAllowDraftCreation}
            onChange={chat.setInputValue}
            onSend={async () => {
              setError(null)
              await chat.send()
            }}
            onStop={chat.stop}
          />
        </>
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
      <MessageEditModal
        message={editingMessage}
        onCancel={() => setEditingMessage(null)}
        onSave={async (content) => {
          if (!editingMessage) return
          await chat.edit(editingMessage, content)
          setEditingMessage(null)
        }}
      />
      <SessionShareModal
        session={sharing.session}
        candidates={sharing.candidates}
        shares={sharing.shares}
        onCancel={sharing.close}
        onCreate={createShare}
        onCopy={async (shareId) => {
          await runAction(
            () => sharing.copyLink(shareId),
            t('aiChat.shareLinkCopied'),
          )
        }}
        onRevoke={async (shareId) => {
          await runAction(() => sharing.revoke(shareId))
        }}
      />
      <AgentFeedbackModal
        open={Boolean(feedbackRunId)}
        onCancel={() => setFeedbackRunId(null)}
        onSubmit={async (values: AgentFeedbackFormValues) => {
          if (!feedbackRunId) return false
          const saved = await runAction(
            () =>
              submitAgentFeedback(token, merchantId, feedbackRunId, {
                rating: 'NOT_HELPFUL',
                reason: values.reason,
                comment: values.comment,
              }),
            t('aiChat.feedbackSaved'),
          )
          if (saved) setFeedbackRunId(null)
          return saved
        }}
      />
    </div>
  )
}
