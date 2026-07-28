import type {
  RuleDocumentDetail,
  RuleDocumentScope,
  RuleDocumentSummary,
  RuleSearchResult,
} from '@cross-border/shared'

import { apiRequest } from './client'

function basePath(merchantId: string): string {
  return `/api/merchants/${merchantId}/rule-documents`
}

export function getRuleDocuments(
  token: string,
  merchantId: string,
): Promise<RuleDocumentSummary[]> {
  return apiRequest(token, basePath(merchantId))
}

export function getRuleDocument(
  token: string,
  merchantId: string,
  documentId: string,
): Promise<RuleDocumentDetail> {
  return apiRequest(token, `${basePath(merchantId)}/${documentId}`)
}

export function importRuleDocument(
  token: string,
  merchantId: string,
  input: {
    title: string
    platform: string
    scope: RuleDocumentScope
    sourceUrl?: string
    content: string
  },
): Promise<RuleDocumentDetail> {
  return apiRequest(token, basePath(merchantId), {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function archiveRuleDocument(
  token: string,
  merchantId: string,
  documentId: string,
): Promise<RuleDocumentSummary> {
  return apiRequest(token, `${basePath(merchantId)}/${documentId}/archive`, {
    method: 'PATCH',
  })
}

export function searchRuleDocuments(
  token: string,
  merchantId: string,
  query: string,
): Promise<RuleSearchResult> {
  return apiRequest(token, `${basePath(merchantId)}/search`, {
    method: 'POST',
    body: JSON.stringify({ query }),
  })
}
