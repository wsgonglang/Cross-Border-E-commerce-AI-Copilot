import type {
  AgentToolCallSummary,
  RuleSearchResult,
} from '@cross-border/shared'
import { describe, expect, it } from 'vitest'

import {
  scopeRuleCitationsToToolCall,
  validateRuleCitations,
} from './rule-citation-validator'

function ruleCall(
  result: Partial<RuleSearchResult>,
  id = 'call-1',
): AgentToolCallSummary {
  return {
    id,
    name: 'search_platform_rules',
    status: 'success',
    input: { query: '充电器认证' },
    output: {
      query: '充电器认证',
      sufficient: true,
      reason: 'MATCHED',
      notice: 'ok',
      filters: {},
      diagnostics: {
        candidateCount: 1,
        candidateLimit: 500,
        truncated: false,
      },
      sources: [],
      ...result,
    },
  }
}

describe('validateRuleCitations', () => {
  const source = {
    citation: 'R1',
    documentId: 'doc-1',
    chunkId: 'chunk-1',
    title: '电器规范',
    platform: 'AMAZON',
    scope: 'GLOBAL' as const,
    excerpt: '充电器需要核对安全认证。',
    score: 0.8,
    coverage: 0.75,
  }

  it('accepts citations returned by the current rule tool', () => {
    const result = validateRuleCitations('需要核对认证。[R1]', [
      ruleCall({ sources: [source] }),
    ])
    expect(result).toMatchObject({ valid: true, available: ['R1'] })
  })

  it('binds citation labels to each Agent tool call to prevent collisions', () => {
    const first = scopeRuleCitationsToToolCall(
      ruleCall({ sources: [source] }).output as RuleSearchResult,
      'call-1',
    )
    const second = scopeRuleCitationsToToolCall(
      ruleCall({ sources: [source] }).output as RuleSearchResult,
      'call-2',
    )

    expect(first.sources[0]?.citation).toMatch(/^R[A-F0-9]{8}-1$/)
    expect(first.sources[0]?.citation).not.toBe(second.sources[0]?.citation)
    const answer = `第一条依据。[${first.sources[0]!.citation}] 第二条依据。[${second.sources[0]!.citation}]`
    expect(
      validateRuleCitations(answer, [
        ruleCall(first, 'call-1'),
        ruleCall(second, 'call-2'),
      ]).valid,
    ).toBe(true)
  })

  it('rejects invented and missing citations', () => {
    expect(
      validateRuleCitations('规则要求如此。[R9]', [
        ruleCall({ sources: [source] }),
      ]).reason,
    ).toBe('INVALID_CITATION')
    expect(
      validateRuleCitations('规则要求如此。', [ruleCall({ sources: [source] })])
        .reason,
    ).toBe('MISSING_CITATION')
  })

  it('forces an insufficient-information answer when retrieval abstains', () => {
    const result = validateRuleCitations('模型自行补充的规则。', [
      ruleCall({ sufficient: false, reason: 'LOW_RELEVANCE', sources: [] }),
    ])
    expect(result.reason).toBe('INSUFFICIENT_SOURCES')
    expect(result.answer).toContain('信息不足')
  })

  it('fails closed when the rule tool itself errors', () => {
    const failedCall: AgentToolCallSummary = {
      id: 'call-error',
      name: 'search_platform_rules',
      status: 'error',
      input: { query: '充电器认证' },
      error: 'database unavailable',
    }

    const result = validateRuleCitations('模型自行补充的规则。', [failedCall])

    expect(result.reason).toBe('INSUFFICIENT_SOURCES')
    expect(result.answer).toContain('信息不足')
  })
})
