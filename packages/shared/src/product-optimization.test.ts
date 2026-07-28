import { describe, expect, it } from 'vitest'

import { productOptimizationDraftSchema } from './product-optimization'

describe('productOptimizationDraftSchema', () => {
  it('accepts the complete structured optimization draft', () => {
    expect(
      productOptimizationDraftSchema.parse({
        title: 'Portable Travel Charger',
        description: 'Compact multi-port charger for international travel.',
        sellingPoints: ['Compact design', 'Multiple USB ports'],
        complianceRisks: ['Verify destination-market plug certification'],
        suggestions: ['Add package dimensions'],
        language: 'en-US',
        confidence: 0.88,
      }).language,
    ).toBe('en-US')
  })

  it('rejects an incomplete or overconfident draft', () => {
    expect(() =>
      productOptimizationDraftSchema.parse({
        title: '',
        description: 'Description',
        sellingPoints: [],
        complianceRisks: [],
        suggestions: [],
        language: 'en-US',
        confidence: 1.2,
      }),
    ).toThrow()
  })
})
