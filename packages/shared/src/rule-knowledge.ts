export const RULE_DOCUMENT_SCOPES = ['GLOBAL', 'MERCHANT'] as const
export const RULE_DOCUMENT_STATUSES = ['ACTIVE', 'ARCHIVED'] as const

export type RuleDocumentScope = (typeof RULE_DOCUMENT_SCOPES)[number]
export type RuleDocumentStatus = (typeof RULE_DOCUMENT_STATUSES)[number]

export interface RuleDocumentSummary {
  id: string
  merchantId?: string
  title: string
  platform: string
  market?: string
  language?: string
  category?: string
  effectiveFrom?: string
  effectiveTo?: string
  version?: string
  supersedesDocumentId?: string
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
  market?: string
  category?: string
  version?: string
  scope: RuleDocumentScope
  sourceUrl?: string
  heading?: string
  excerpt: string
  score: number
  coverage: number
}

export type RuleSearchReason =
  'MATCHED' | 'NO_CANDIDATES' | 'LOW_RELEVANCE' | 'CANDIDATE_LIMIT_EXCEEDED'

export interface RuleSearchFilters {
  platform?: string
  market?: string
  category?: string
  asOf?: string
}

export interface RuleSearchResult {
  query: string
  sufficient: boolean
  reason: RuleSearchReason
  notice: string
  filters: RuleSearchFilters
  diagnostics: {
    candidateCount: number
    candidateLimit: number
    truncated: boolean
    topScore?: number
    topCoverage?: number
    scoreGap?: number
  }
  sources: RuleSearchSource[]
}
