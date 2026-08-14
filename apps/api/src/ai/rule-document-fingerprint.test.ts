import { describe, expect, it } from 'vitest'

import { createRuleDocumentFingerprint } from './rule-document-fingerprint'

const baseRule = {
  merchantId: null,
  platform: 'AMAZON',
  market: 'US',
  language: 'zh-CN',
  category: 'ELECTRONICS',
  effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
  effectiveTo: null,
  version: '2026.2',
  supersedesDocumentId: 'rule-v1',
  title: '电器商品规则',
  content: '充电器发布前必须核对输入电压和安全测试资料。',
} as const

describe('createRuleDocumentFingerprint', () => {
  it('is deterministic for the same normalized document', () => {
    expect(createRuleDocumentFingerprint(baseRule)).toBe(
      createRuleDocumentFingerprint({ ...baseRule }),
    )
    expect(createRuleDocumentFingerprint(baseRule)).toMatch(/^[a-f0-9]{64}$/)
  })

  it('treats applicability metadata as part of the document identity', () => {
    expect(
      createRuleDocumentFingerprint({ ...baseRule, market: 'BR' }),
    ).not.toBe(createRuleDocumentFingerprint(baseRule))
    expect(
      createRuleDocumentFingerprint({ ...baseRule, version: '2026.3' }),
    ).not.toBe(createRuleDocumentFingerprint(baseRule))
  })
})
