import type { AiQualityReport, AiQualityWindowDays } from '@cross-border/shared'

import { apiRequest } from './client'

export function getAiQualityReport(
  token: string,
  merchantId: string,
  days: AiQualityWindowDays,
): Promise<AiQualityReport> {
  return apiRequest(
    token,
    `/api/merchants/${merchantId}/ai/quality?days=${days}`,
  )
}
