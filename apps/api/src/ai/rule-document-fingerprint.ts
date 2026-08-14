import { createHash } from 'node:crypto'

export interface RuleDocumentFingerprintInput {
  merchantId: string | null
  platform: string
  market: string | null
  language: string | null
  category: string | null
  effectiveFrom: Date | null
  effectiveTo: Date | null
  version: string | null
  supersedesDocumentId: string | null
  title: string
  content: string
}

/**
 * Builds the stable identity used to reject an identical active rule document.
 * Callers must pass already-normalized metadata and source text so imports,
 * seeds, and future ingestion paths share exactly the same fingerprint format.
 */
export function createRuleDocumentFingerprint(
  input: RuleDocumentFingerprintInput,
): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        merchantId: input.merchantId,
        platform: input.platform,
        market: input.market,
        language: input.language,
        category: input.category,
        effectiveFrom: input.effectiveFrom?.toISOString(),
        effectiveTo: input.effectiveTo?.toISOString(),
        version: input.version,
        supersedesDocumentId: input.supersedesDocumentId,
        title: input.title,
        content: input.content,
      }),
    )
    .digest('hex')
}
