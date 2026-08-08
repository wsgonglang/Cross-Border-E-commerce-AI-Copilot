import type { AiSessionDetail, AiSessionSummary } from '@cross-border/shared'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  createAiSession,
  deleteAiSession,
  listAiSessions,
  setAiSessionArchived,
  updateAiSession,
} from '../../../api/ai'
import type { AiSessionView } from '../ai-chat.types'

interface UseAiConversationsInput {
  merchantId: string
  onError: (message: string) => void
  token: string
}

export function useAiConversations({
  merchantId,
  onError,
  token,
}: UseAiConversationsInput) {
  const { t } = useTranslation()
  const [sessions, setSessions] = useState<AiSessionSummary[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [sessionView, setSessionView] = useState<AiSessionView>('active')
  const [keyword, setKeyword] = useState('')
  const [groupId, setGroupId] = useState<string>()
  const [knownGroups, setKnownGroups] = useState<string[]>([])

  const loadSessions = useCallback(async () => {
    if (!token || !merchantId) return
    const result = await listAiSessions(token, merchantId, {
      keyword: keyword.trim() || undefined,
      archived: sessionView === 'archived',
      groupId,
    })
    setSessions(result.items)
    setKnownGroups((current) =>
      Array.from(
        new Set([
          ...current,
          ...result.items.flatMap((session) =>
            session.groupId ? [session.groupId] : [],
          ),
        ]),
      ).sort(),
    )
    setCurrentSessionId((current) => {
      if (result.items.some((session) => session.id === current)) return current
      return result.items[0]?.id ?? null
    })
  }, [groupId, keyword, merchantId, sessionView, token])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSessions().catch((error: Error) => onError(error.message))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [loadSessions, onError])

  const createSession = useCallback(async () => {
    if (!token || !merchantId) return null
    try {
      const session = await createAiSession(
        token,
        merchantId,
        t('aiChat.defaultSessionTitle'),
      )
      setSessionView('active')
      setSessions((previous) => [session, ...previous])
      setCurrentSessionId(session.id)
      return session
    } catch (error: unknown) {
      onError(error instanceof Error ? error.message : t('aiChat.createFailed'))
      return null
    }
  }, [merchantId, onError, t, token])

  const updateSession = useCallback(
    async (
      session: AiSessionSummary,
      data: { title?: string; pinned?: boolean; groupId?: string },
    ) => {
      const updated = await updateAiSession(token, merchantId, session.id, data)
      setSessions((current) =>
        current
          .map((item) => (item.id === updated.id ? updated : item))
          .sort(
            (first, second) =>
              Number(second.pinned) - Number(first.pinned) ||
              second.updatedAt.localeCompare(first.updatedAt),
          ),
      )
      return updated
    },
    [merchantId, token],
  )

  const archiveSession = useCallback(
    async (session: AiSessionSummary, archived: boolean) => {
      await setAiSessionArchived(token, merchantId, session.id, archived)
      await loadSessions()
    },
    [loadSessions, merchantId, token],
  )

  const removeSession = useCallback(
    async (session: AiSessionSummary) => {
      await deleteAiSession(token, merchantId, session.id)
      await loadSessions()
    },
    [loadSessions, merchantId, token],
  )

  const updateSessionSummary = useCallback((session: AiSessionDetail) => {
    setSessions((current) =>
      current.map((item) =>
        item.id === session.id
          ? {
              ...item,
              title: session.title,
              messageCount: session.messageCount,
            }
          : item,
      ),
    )
  }, [])

  const addKnownGroup = useCallback((value: string) => {
    setKnownGroups((current) => Array.from(new Set([...current, value])).sort())
  }, [])

  const selectSession = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId)
  }, [])

  const currentSession = useMemo(
    () => sessions.find((session) => session.id === currentSessionId),
    [currentSessionId, sessions],
  )

  return {
    addKnownGroup,
    archiveSession,
    createSession,
    currentSession,
    currentSessionId,
    groupId,
    keyword,
    knownGroups,
    loadSessions,
    removeSession,
    selectSession,
    sessionView,
    sessions,
    setGroupId,
    setKeyword,
    setSessionView,
    updateSession,
    updateSessionSummary,
  }
}
