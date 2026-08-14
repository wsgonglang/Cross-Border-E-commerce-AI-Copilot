import type {
  RuleDocumentDetail,
  RuleDocumentScope,
  RuleDocumentStatus,
  RuleDocumentSummary,
} from '@cross-border/shared'

interface RuleDocumentSource {
  id: string
  merchantId: string | null
  createdById: string
  title: string
  platform: string
  market: string | null
  language: string | null
  category: string | null
  effectiveFrom: Date | null
  effectiveTo: Date | null
  version: string | null
  supersedesDocumentId: string | null
  scope: string
  sourceUrl: string | null
  content: string
  contentHash: string
  status: string
  createdAt: Date
  updatedAt: Date
  _count: { chunks: number }
}

export function toRuleDocumentSummary(
  source: RuleDocumentSource,
): RuleDocumentSummary {
  return {
    id: source.id,
    merchantId: source.merchantId ?? undefined,
    createdById: source.createdById,
    title: source.title,
    platform: source.platform,
    market: source.market ?? undefined,
    language: source.language ?? undefined,
    category: source.category ?? undefined,
    effectiveFrom: source.effectiveFrom?.toISOString(),
    effectiveTo: source.effectiveTo?.toISOString(),
    version: source.version ?? undefined,
    supersedesDocumentId: source.supersedesDocumentId ?? undefined,
    scope: source.scope as RuleDocumentScope,
    sourceUrl: source.sourceUrl ?? undefined,
    status: source.status as RuleDocumentStatus,
    contentHash: source.contentHash,
    chunkCount: source._count.chunks,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  }
}

export function toRuleDocumentDetail(
  source: RuleDocumentSource,
): RuleDocumentDetail {
  return {
    ...toRuleDocumentSummary(source),
    content: source.content,
  }
}
