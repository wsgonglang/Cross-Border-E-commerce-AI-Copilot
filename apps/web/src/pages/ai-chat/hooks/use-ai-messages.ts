import type {
  AiMessage,
  AiMessageLinkType,
  AiSessionDetail,
  AiSessionSummary,
} from '@cross-border/shared'
import { useCallback, useEffect, useRef, useState } from 'react'

import { favoriteAiMessage, getAiSession, linkAiMessage } from '../../../api/ai'

interface UseAiMessagesInput {
  createSession: () => Promise<AiSessionSummary | null>
  currentSessionId: string | null
  merchantId: string
  onError: (message: string) => void
  onSessionLoaded: (session: AiSessionDetail) => void
  refreshSessions: () => Promise<void>
  token: string
}

interface StreamInput {
  merchantId: string
  onComplete: () => Promise<void>
  onError: (message: string) => void
  parentMessageId?: string
  sessionId: string
  setMessages: React.Dispatch<React.SetStateAction<AiMessage[]>>
  setStreaming: React.Dispatch<React.SetStateAction<boolean>>
  text: string
  token: string
}

function streamMessage(input: StreamInput): AbortController {
  const userMessageId = `optimistic-user-${Date.now()}`
  const assistantId = `optimistic-assistant-${Date.now()}`
  input.setMessages((previous) => [
    ...previous,
    {
      id: userMessageId,
      sessionId: input.sessionId,
      role: 'user',
      content: input.text,
      childrenIds: [],
      links: [],
      createdAt: new Date().toISOString(),
    },
    {
      id: assistantId,
      sessionId: input.sessionId,
      role: 'assistant',
      content: '',
      childrenIds: [],
      links: [],
      createdAt: new Date().toISOString(),
    },
  ])
  input.setStreaming(true)
  const controller = new AbortController()

  void fetch(`/api/merchants/${input.merchantId}/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.token}`,
    },
    body: JSON.stringify({
      content: input.text,
      sessionId: input.sessionId,
      parentMessageId: input.parentMessageId,
    }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`请求失败：${response.status}`)
      const reader = response.body?.getReader()
      if (!reader) throw new Error('当前浏览器不支持流式响应')
      const decoder = new TextDecoder('utf-8')
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        input.setMessages((previous) =>
          previous.map((item) =>
            item.id === assistantId
              ? { ...item, content: item.content + chunk }
              : item,
          ),
        )
      }
    })
    .catch((error: Error) => {
      if (error.name !== 'AbortError') input.onError(error.message)
    })
    .finally(() => {
      input.setStreaming(false)
      void input.onComplete()
    })

  return controller
}

export function useAiMessages({
  createSession,
  currentSessionId,
  merchantId,
  onError,
  onSessionLoaded,
  refreshSessions,
  token,
}: UseAiMessagesInput) {
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const loadCurrentSession = useCallback(
    async (sessionId = currentSessionId) => {
      if (!sessionId || !token || !merchantId) {
        setMessages([])
        return
      }
      const session = await getAiSession(token, merchantId, sessionId)
      setMessages(session.messages)
      onSessionLoaded(session)
    },
    [currentSessionId, merchantId, onSessionLoaded, token],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCurrentSession().catch((error: Error) => onError(error.message))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadCurrentSession, onError])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = useCallback(async () => {
    const text = inputValue.trim()
    if (!text || !token || !merchantId || streaming) return
    setInputValue('')
    const created = currentSessionId ? null : await createSession()
    const sessionId = currentSessionId ?? created?.id
    if (!sessionId) return
    const parentMessageId = [...messages]
      .reverse()
      .find((item) => !item.id.startsWith('optimistic-'))?.id
    abortRef.current = streamMessage({
      token,
      merchantId,
      sessionId,
      text,
      parentMessageId,
      setMessages,
      setStreaming,
      onError,
      onComplete: async () => {
        abortRef.current = null
        await loadCurrentSession(sessionId)
        await refreshSessions()
      },
    })
  }, [
    createSession,
    currentSessionId,
    inputValue,
    loadCurrentSession,
    merchantId,
    messages,
    onError,
    refreshSessions,
    streaming,
    token,
  ])

  const stop = useCallback(() => abortRef.current?.abort(), [])

  const favorite = useCallback(
    async (item: AiMessage) => {
      if (!currentSessionId || item.id.startsWith('optimistic-')) return
      const updated = await favoriteAiMessage(
        token,
        merchantId,
        currentSessionId,
        item.id,
        !item.favorited,
      )
      setMessages((current) =>
        current.map((message) =>
          message.id === updated.id ? updated : message,
        ),
      )
    },
    [currentSessionId, merchantId, token],
  )

  const link = useCallback(
    async (
      item: AiMessage,
      values: {
        entityType: AiMessageLinkType
        entityReference: string
      },
    ) => {
      if (!currentSessionId) return
      const createdLink = await linkAiMessage(
        token,
        merchantId,
        currentSessionId,
        item.id,
        values,
      )
      setMessages((current) =>
        current.map((message) =>
          message.id === item.id
            ? {
                ...message,
                links: [
                  ...message.links.filter(
                    (currentLink) => currentLink.id !== createdLink.id,
                  ),
                  createdLink,
                ],
              }
            : message,
        ),
      )
    },
    [currentSessionId, merchantId, token],
  )

  return {
    favorite,
    inputValue,
    link,
    messages,
    messagesEndRef,
    send,
    setInputValue,
    stop,
    streaming,
  }
}
