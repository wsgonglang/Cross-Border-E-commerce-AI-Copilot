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
  links: AiMessageLink[]
  createdAt: string
}

export type AiMessageLinkType = 'PRODUCT' | 'ORDER'

export interface AiMessageLink {
  id: string
  entityType: AiMessageLinkType
  entityId: string
  entityCode: string
  entityLabel: string
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
  archivedAt?: string
  messageCount: number
  createdAt: string
  updatedAt: string
}

export interface AiSessionDetail extends AiSessionSummary {
  activeLeafMessageId?: string
  messages: AiMessage[]
}

export interface AiChatMessage {
  role: AiRole
  content: string
}

export interface AiTitleResponse {
  title: string
}

export interface AiShareCandidate {
  id: string
  name: string
  email: string
}

export interface AiSessionShareSummary {
  id: string
  sessionId: string
  title: string
  recipientCount: number
  expiresAt: string
  revokedAt?: string
  createdAt: string
}

export interface AiSharedSession {
  id: string
  merchantId: string
  title: string
  ownerName: string
  expiresAt: string
  createdAt: string
  messages: Array<{
    id: string
    role: AiRole
    content: string
    createdAt: string
  }>
}
