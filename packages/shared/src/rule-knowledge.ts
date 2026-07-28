export const RULE_DOCUMENT_SCOPES = ['GLOBAL', 'MERCHANT'] as const
export const RULE_DOCUMENT_STATUSES = ['ACTIVE', 'ARCHIVED'] as const

export type RuleDocumentScope = (typeof RULE_DOCUMENT_SCOPES)[number]
export type RuleDocumentStatus = (typeof RULE_DOCUMENT_STATUSES)[number]

export interface RuleDocumentSummary {
  id: string
  merchantId?: string
  title: string
  platform: string
  scope: RuleDocumentScope
  sourceUrl?: string
  status: RuleDocumentStatus
  contentHash: string
  chunkCount: number
  createdById: string
  createdAt: string
  updatedAt: string
}

export interface RuleDocumentDetail extends RuleDocumentSummary {
  content: string
}

export interface RuleSearchSource {
  citation: string
  documentId: string
  chunkId: string
  title: string
  platform: string
  scope: RuleDocumentScope
  sourceUrl?: string
  heading?: string
  excerpt: string
  score: number
}

export interface RuleSearchResult {
  query: string
  sufficient: boolean
  notice: string
  sources: RuleSearchSource[]
}
