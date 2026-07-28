import {
  OPTIMIZATION_LANGUAGES,
  productOptimizationDraftSchema,
  type ProductOptimizationSource,
} from '@cross-border/shared'
import { describe, expect, it } from 'vitest'

import { MockAiProvider } from './ai-provider.service'

const source: ProductOptimizationSource = {
  title: '便携式旅行充电器',
  description: '多口 USB 旅行充电器。',
  sellingPoints: ['便携', '多口输出'],
  language: 'zh-CN',
  version: 1,
}

describe('MockAiProvider product optimization', () => {
  it.each(OPTIMIZATION_LANGUAGES)(
    'returns a valid %s structured draft without paid model usage',
    async (targetLanguage) => {
      const result = await new MockAiProvider().optimizeProduct({
        source,
        targetLanguage,
      })

      expect(productOptimizationDraftSchema.parse(result.draft).language).toBe(
        targetLanguage,
      )
      expect(result.draft.complianceRisks.length).toBeGreaterThan(0)
      expect(result.usage.totalTokens).toBe(0)
    },
  )
})
