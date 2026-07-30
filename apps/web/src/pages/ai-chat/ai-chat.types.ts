import type { AiMessageLinkType } from '@cross-border/shared'

export type AiAssistantMode = 'chat' | 'agent'
export type AiSessionView = 'active' | 'archived'

export interface SessionFormValues {
  groupId?: string
  title: string
}

export interface LinkFormValues {
  entityReference: string
  entityType: AiMessageLinkType
}

export interface ShareFormValues {
  expiresInHours: number
  recipientUserIds: string[]
}
