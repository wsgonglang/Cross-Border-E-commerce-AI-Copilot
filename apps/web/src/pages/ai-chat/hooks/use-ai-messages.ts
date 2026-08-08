import type {
  AiMessage,
  AiMessageLinkType,
  AiSessionDetail,
  AiSessionSummary,
} from '@cross-border/shared'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  favoriteAiMessage,
  getAiSession,
  linkAiMessage,
  selectAiSessionBranch,
} from '../../../api/ai'
import { cancelAgentRun, runAgent } from '../../../api/agent'
import { getAgentRun } from '../../../api/ai-results'
import { getActiveLineage } from '../branching'

interface UseAiMessagesInput {
  createSession: () => Promise<AiSessionSummary | null>
  currentSessionId: string | null
  merchantId: string
  onError: (message: string) => void
  onSessionLoaded: (session: AiSessionDetail) => void
  refreshSessions: () => Promise<void>
  token: string
  storeId?: string
}

interface StreamInput {
  merchantId: string
  onComplete: () => Promise<void>
  onError: (message: string) => void
  parentMessageId?: string
  regenerateMessageId?: string
  sessionId: string
  updateMessages: (
    sessionId: string,
    update: (messages: AiMessage[]) => AiMessage[],
  ) => void
  updateStreaming: (sessionId: string, streaming: boolean) => void
  updateActiveLeaf: (sessionId: string, messageId: string) => void
  onRunStarted: (runId: string) => void
  text: string
  token: string
  storeId?: string
}

function streamMessage(input: StreamInput): AbortController {
  const userMessageId = `optimistic-user-${Date.now()}`
  const assistantId = `optimistic-assistant-${Date.now()}`
  const optimisticUser: AiMessage = {
    id: userMessageId,
    sessionId: input.sessionId,
    role: 'user',
    content: input.text,
    parentId: input.parentMessageId,
    childrenIds: [],
    links: [],
    createdAt: new Date().toISOString(),
  }
  const optimisticAssistant: AiMessage = {
    id: assistantId,
    sessionId: input.sessionId,
    role: 'assistant',
    content: '',
    parentId: input.regenerateMessageId ? input.parentMessageId : userMessageId,
    childrenIds: [],
    links: [],
    createdAt: new Date().toISOString(),
  }
  input.updateMessages(input.sessionId, (previous) => [
    ...previous,
    ...(input.regenerateMessageId ? [] : [optimisticUser]),
    optimisticAssistant,
  ])
  input.updateActiveLeaf(input.sessionId, assistantId)
  input.updateStreaming(input.sessionId, true)
  const controller = new AbortController()

  void runAgent(input.token, input.merchantId, input.text, {
    storeId: input.storeId,
    sourcePage: 'ai-chat',
    sessionId: input.sessionId,
    parentMessageId: input.parentMessageId,
    regenerateMessageId: input.regenerateMessageId,
  })
    .then(async (started) => {
      input.onRunStarted(started.runId)
      while (!controller.signal.aborted) {
        const run = await getAgentRun(
          input.token,
          input.merchantId,
          started.runId,
        )
        const progressText = run.toolCalls.length
          ? `已调用 ${run.toolCalls.map((call) => call.name).join('、')}，正在整理结论…`
          : 'Agent 正在理解问题并规划…'
        input.updateMessages(input.sessionId, (previous) =>
          previous.map((item) =>
            item.id === assistantId
              ? {
                  ...item,
                  content:
                    run.status === 'COMPLETED' ? run.answer : progressText,
                  agentRun: {
                    runId: run.runId,
                    status: run.status,
                    toolCalls: run.toolCalls,
                    usage: run.usage,
                    providerName: run.providerName,
                    modelName: run.modelName,
                  },
                }
              : item,
          ),
        )
        if (run.status === 'COMPLETED') return
        if (run.status === 'FAILED') {
          throw new Error(run.error || 'Agent 运行失败')
        }
        await new Promise<void>((resolve) => {
          const timer = window.setTimeout(resolve, 600)
          controller.signal.addEventListener(
            'abort',
            () => {
              window.clearTimeout(timer)
              resolve()
            },
            { once: true },
          )
        })
      }
    })
    .catch((error: Error) => {
      if (error.name !== 'AbortError') input.onError(error.message)
    })
    .finally(() => {
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
  storeId,
}: UseAiMessagesInput) {
  const [messagesBySession, setMessagesBySession] = useState<
    Record<string, AiMessage[]>
  >({})
  const [activeLeafBySession, setActiveLeafBySession] = useState<
    Record<string, string | undefined>
  >({})
  const [streamingSessionIds, setStreamingSessionIds] = useState<string[]>([])
  const [inputValue, setInputValue] = useState('')
  const abortControllersRef = useRef(new Map<string, AbortController>())
  const runIdsRef = useRef(new Map<string, string>())
  const streamingSessionIdsRef = useRef(new Set<string>())
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const allMessages = useMemo(
    () => (currentSessionId ? (messagesBySession[currentSessionId] ?? []) : []),
    [currentSessionId, messagesBySession],
  )
  const messages = useMemo(
    () =>
      getActiveLineage(
        allMessages,
        currentSessionId ? activeLeafBySession[currentSessionId] : undefined,
      ),
    [activeLeafBySession, allMessages, currentSessionId],
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

  const updateActiveLeaf = useCallback(
    (sessionId: string, messageId: string | undefined) => {
      setActiveLeafBySession((current) => ({
        ...current,
        [sessionId]: messageId,
      }))
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
      updateActiveLeaf(sessionId, session.activeLeafMessageId)
      onSessionLoaded(session)
    },
    [
      currentSessionId,
      merchantId,
      onSessionLoaded,
      token,
      updateActiveLeaf,
      updateMessages,
    ],
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
      storeId,
      sessionId,
      text,
      parentMessageId,
      updateMessages,
      updateStreaming,
      updateActiveLeaf,
      onRunStarted: (runId) => runIdsRef.current.set(sessionId, runId),
      onError,
      onComplete: async () => {
        if (abortControllersRef.current.get(sessionId) === controller) {
          abortControllersRef.current.delete(sessionId)
          runIdsRef.current.delete(sessionId)
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
    storeId,
    updateMessages,
    updateStreaming,
    updateActiveLeaf,
  ])

  const startBranchStream = useCallback(
    (
      sessionId: string,
      options: {
        text: string
        parentMessageId?: string
        regenerateMessageId?: string
      },
    ) => {
      const controller = streamMessage({
        token,
        merchantId,
        storeId,
        sessionId,
        ...options,
        updateMessages,
        updateStreaming,
        updateActiveLeaf,
        onRunStarted: (runId) => runIdsRef.current.set(sessionId, runId),
        onError,
        onComplete: async () => {
          if (abortControllersRef.current.get(sessionId) === controller) {
            abortControllersRef.current.delete(sessionId)
            runIdsRef.current.delete(sessionId)
          }
          await loadCurrentSession(sessionId, true)
          await refreshSessions()
        },
      })
      abortControllersRef.current.set(sessionId, controller)
    },
    [
      loadCurrentSession,
      merchantId,
      onError,
      refreshSessions,
      token,
      storeId,
      updateActiveLeaf,
      updateMessages,
      updateStreaming,
    ],
  )

  const edit = useCallback(
    (message: AiMessage, content: string): Promise<void> => {
      const text = content.trim()
      if (!currentSessionId || message.role !== 'user' || !text || streaming)
        return Promise.resolve()
      startBranchStream(currentSessionId, {
        text,
        parentMessageId: message.parentId,
      })
      return Promise.resolve()
    },
    [currentSessionId, startBranchStream, streaming],
  )

  const regenerate = useCallback(
    (message: AiMessage): Promise<void> => {
      if (
        !currentSessionId ||
        message.role !== 'assistant' ||
        !message.parentId ||
        streaming
      )
        return Promise.resolve()
      startBranchStream(currentSessionId, {
        text:
          allMessages.find((item) => item.id === message.parentId)?.content ??
          '',
        parentMessageId: message.parentId,
        regenerateMessageId: message.id,
      })
      return Promise.resolve()
    },
    [allMessages, currentSessionId, startBranchStream, streaming],
  )

  const selectBranch = useCallback(
    async (messageId: string) => {
      if (!currentSessionId || streaming) return
      const session = await selectAiSessionBranch(
        token,
        merchantId,
        currentSessionId,
        messageId,
      )
      updateMessages(currentSessionId, () => session.messages)
      updateActiveLeaf(currentSessionId, session.activeLeafMessageId)
      onSessionLoaded(session)
    },
    [
      currentSessionId,
      merchantId,
      onSessionLoaded,
      streaming,
      token,
      updateActiveLeaf,
      updateMessages,
    ],
  )

  const stop = useCallback(() => {
    if (currentSessionId) {
      const runId = runIdsRef.current.get(currentSessionId)
      if (runId) {
        void cancelAgentRun(token, merchantId, runId).catch((error: Error) =>
          onError(error.message),
        )
      }
      abortControllersRef.current.get(currentSessionId)?.abort()
    }
  }, [currentSessionId, merchantId, onError, token])

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
    allMessages,
    edit,
    favorite,
    inputValue,
    link,
    messages,
    messagesEndRef,
    regenerate,
    selectBranch,
    send,
    setInputValue,
    stop,
    streaming,
    streamingSessionIds,
  }
}
