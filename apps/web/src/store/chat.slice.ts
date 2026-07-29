import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { AiSessionDetail, AiSessionSummary } from '@cross-border/shared'

export interface ChatState {
  sessions: AiSessionSummary[]
  totalSessions: number
  currentSessionId: string | null
  currentSession: AiSessionDetail | null
  loading: boolean
  streaming: boolean
  error: string | null
}

const initialState: ChatState = {
  sessions: [],
  totalSessions: 0,
  currentSessionId: null,
  currentSession: null,
  loading: false,
  streaming: false,
  error: null,
}

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setSessions(
      state,
      action: PayloadAction<{ items: AiSessionSummary[]; total: number }>,
    ) {
      state.sessions = action.payload.items
      state.totalSessions = action.payload.total
    },
    setCurrentSession(state, action: PayloadAction<AiSessionDetail | null>) {
      state.currentSession = action.payload
      state.currentSessionId = action.payload?.id ?? null
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload
    },
    setStreaming(state, action: PayloadAction<boolean>) {
      state.streaming = action.payload
    },
    appendStreamContent(
      state,
      action: PayloadAction<{ messageId: string; chunk: string }>,
    ) {
      const { messageId, chunk } = action.payload
      const session = state.currentSession
      if (!session) return
      const msg = session.messages.find((m) => m.id === messageId)
      if (msg) {
        msg.content += chunk
      }
    },
    addOptimisticMessage(
      state,
      action: PayloadAction<{
        id: string
        role: 'user' | 'assistant'
        content: string
        parentId?: string
      }>,
    ) {
      if (!state.currentSession) return
      const { id, role, content, parentId } = action.payload
      state.currentSession.messages.push({
        id,
        sessionId: state.currentSession.id,
        role,
        content,
        parentId,
        childrenIds: [],
        links: [],
        createdAt: new Date().toISOString(),
      })
    },
    removeOptimisticMessage(state, action: PayloadAction<string>) {
      if (!state.currentSession) return
      state.currentSession.messages = state.currentSession.messages.filter(
        (m) => m.id !== action.payload,
      )
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload
    },
    addSession(state, action: PayloadAction<AiSessionSummary>) {
      state.sessions.unshift(action.payload)
      state.totalSessions++
    },
    updateSessionInList(state, action: PayloadAction<AiSessionSummary>) {
      const idx = state.sessions.findIndex((s) => s.id === action.payload.id)
      if (idx >= 0) {
        state.sessions[idx] = action.payload
      }
    },
    removeSessionFromList(state, action: PayloadAction<string>) {
      state.sessions = state.sessions.filter((s) => s.id !== action.payload)
      state.totalSessions--
    },
    resetChat() {
      return initialState
    },
  },
})

export const {
  setSessions,
  setCurrentSession,
  setLoading,
  setStreaming,
  appendStreamContent,
  addOptimisticMessage,
  removeOptimisticMessage,
  setError,
  addSession,
  updateSessionInList,
  removeSessionFromList,
  resetChat,
} = chatSlice.actions

export const chatReducer = chatSlice.reducer
