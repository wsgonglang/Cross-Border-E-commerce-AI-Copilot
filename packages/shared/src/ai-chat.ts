export type AiRole = 'system' | 'user' | 'assistant'

export interface AiMessageRevision {
  id: string
  content: string
  createdAt: number
}

export interface AiMessage {
  id: string
  sessionId: string
  role: AiRole
  content: string
  parentId?: string
  childrenIds: string[]
  revisions?: AiMessageRevision[]
  revisionIndex?: number
  favorited?: boolean
  createdAt: string
}

export type AiSessionStatus = 'idle' | 'streaming' | 'done' | 'error'

export interface AiSessionSummary {
  id: string
  merchantId: string
  userId: string
  title: string
  status: AiSessionStatus
  error?: string
  pinned: boolean
  groupId?: string
  messageCount: number
  createdAt: string
  updatedAt: string
}

export interface AiSessionDetail extends AiSessionSummary {
  messages: AiMessage[]
}

export interface AiChatMessage {
  role: AiRole
  content: string
}

export interface AiTitleResponse {
  title: string
}
