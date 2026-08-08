import type {
  AiMessage,
  AiMessageLinkType,
  AiSessionDetail,
  AiSessionSummary,
} from '@cross-border/shared'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
  updateMessages: (
    sessionId: string,
    update: (messages: AiMessage[]) => AiMessage[],
  ) => void
  updateStreaming: (sessionId: string, streaming: boolean) => void
  text: string
  token: string
}

function streamMessage(input: StreamInput): AbortController {
  const userMessageId = `optimistic-user-${Date.now()}`
  const assistantId = `optimistic-assistant-${Date.now()}`
  let renderBuffer = ''
  let animationFrameId: number | null = null

  const flushRenderBuffer = () => {
    if (!renderBuffer) return
    const content = renderBuffer
    renderBuffer = ''
    input.updateMessages(input.sessionId, (previous) =>
      previous.map((item) =>
        item.id === assistantId
          ? { ...item, content: item.content + content }
          : item,
      ),
    )
  }

  const scheduleRender = () => {
    if (animationFrameId !== null) return
    animationFrameId = window.requestAnimationFrame(() => {
      animationFrameId = null
      flushRenderBuffer()
    })
  }

  const appendChunk = (chunk: string) => {
    if (!chunk) return
    renderBuffer += chunk
    scheduleRender()
  }

  const flushPendingRender = () => {
    if (animationFrameId !== null) {
      window.cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    flushRenderBuffer()
  }

  input.updateMessages(input.sessionId, (previous) => [
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
  input.updateStreaming(input.sessionId, true)
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
        if (done) {
          appendChunk(decoder.decode())
          break
        }
        appendChunk(decoder.decode(value, { stream: true }))
      }
    })
    .catch((error: Error) => {
      if (error.name !== 'AbortError') input.onError(error.message)
    })
    .finally(() => {
      flushPendingRender()
      input.updateStreaming(input.sessionId, false)
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
  const [messagesBySession, setMessagesBySession] = useState<
    Record<string, AiMessage[]>
  >({})
  const [streamingSessionIds, setStreamingSessionIds] = useState<string[]>([])
  const [inputValue, setInputValue] = useState('')
  const abortControllersRef = useRef(new Map<string, AbortController>())
  const streamingSessionIdsRef = useRef(new Set<string>())
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const messages = useMemo(
    () => (currentSessionId ? (messagesBySession[currentSessionId] ?? []) : []),
    [currentSessionId, messagesBySession],
  )
  const streaming = currentSessionId
    ? streamingSessionIds.includes(currentSessionId)
    : false

  const updateMessages = useCallback(
    (sessionId: string, update: (messages: AiMessage[]) => AiMessage[]) => {
      setMessagesBySession((current) => ({
        ...current,
        [sessionId]: update(current[sessionId] ?? []),
      }))
    },
    [],
  )

  const updateStreaming = useCallback(
    (sessionId: string, isStreaming: boolean) => {
      if (isStreaming) {
        streamingSessionIdsRef.current.add(sessionId)
      } else {
        streamingSessionIdsRef.current.delete(sessionId)
      }
      setStreamingSessionIds(Array.from(streamingSessionIdsRef.current))
    },
    [],
  )

  const loadCurrentSession = useCallback(
    async (sessionId = currentSessionId, force = false) => {
      if (!sessionId || !token || !merchantId) {
        return
      }
      if (!force && streamingSessionIdsRef.current.has(sessionId)) return
      const session = await getAiSession(token, merchantId, sessionId)
      updateMessages(sessionId, () => session.messages)
      onSessionLoaded(session)
    },
    [currentSessionId, merchantId, onSessionLoaded, token, updateMessages],
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

  useEffect(() => {
    const controllers = abortControllersRef.current
    return () => {
      controllers.forEach((controller) => controller.abort())
      controllers.clear()
    }
  }, [merchantId, token])

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
    const controller = streamMessage({
      token,
      merchantId,
      sessionId,
      text,
      parentMessageId,
      updateMessages,
      updateStreaming,
      onError,
      onComplete: async () => {
        if (abortControllersRef.current.get(sessionId) === controller) {
          abortControllersRef.current.delete(sessionId)
        }
        await loadCurrentSession(sessionId, true)
        await refreshSessions()
      },
    })
    abortControllersRef.current.set(sessionId, controller)
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
    updateMessages,
    updateStreaming,
  ])

  const stop = useCallback(() => {
    if (currentSessionId) {
      abortControllersRef.current.get(currentSessionId)?.abort()
    }
  }, [currentSessionId])

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
      updateMessages(currentSessionId, (current) =>
        current.map((message) =>
          message.id === updated.id ? updated : message,
        ),
      )
    },
    [currentSessionId, merchantId, token, updateMessages],
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
      updateMessages(currentSessionId, (current) =>
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
    [currentSessionId, merchantId, token, updateMessages],
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
    streamingSessionIds,
  }
}
