import { describe, expect, it } from 'vitest'

import {
  evaluateRuleRetrieval,
  ruleEvaluationCandidates,
  ruleEvaluationThresholds,
  ruleDevelopmentDataset,
  ruleTestDataset,
} from './rule-retrieval.evaluation'
import { chunkRuleContent, rankRuleChunks } from './rule-retrieval'

describe('rule retrieval v2 offline evaluation', () => {
  it('meets the fixed retrieval and abstention baseline', () => {
    const development = evaluateRuleRetrieval(ruleDevelopmentDataset)
    const test = evaluateRuleRetrieval(ruleTestDataset)

    expect(development.totalCases + test.totalCases).toBeGreaterThanOrEqual(30)
    for (const report of [development, test]) {
      expect(report.metrics.hitAt1).toBeGreaterThanOrEqual(
        ruleEvaluationThresholds.hitAt1,
      )
      expect(report.metrics.recallAt3).toBeGreaterThanOrEqual(
        ruleEvaluationThresholds.recallAt3,
      )
      expect(report.metrics.mrr).toBeGreaterThanOrEqual(
        ruleEvaluationThresholds.mrr,
      )
      expect(report.metrics.abstentionAccuracy).toBeGreaterThanOrEqual(
        ruleEvaluationThresholds.abstentionAccuracy,
      )
      expect(report.passed).toBe(true)
    }
  })

  it('rejects entity-only hard negatives without supporting rule terms', () => {
    const ranked = rankRuleChunks(
      '充电器保修期是几年',
      ruleEvaluationCandidates,
      3,
    )

    expect(ranked).toEqual([])
  })

  it('preserves term frequency and diversifies documents before adjacent chunks', () => {
    const repeated = chunkRuleContent(
      '# 认证\n\n充电器认证认证认证资料。\n\n充电器认证补充要求。',
      20,
    )
    expect(
      repeated[0]!.searchTerms.filter((term) => term === '认证').length,
    ).toBeGreaterThan(1)

    const candidates = ruleEvaluationCandidates
    const duplicated = [
      ...candidates,
      { ...candidates[0]!, id: 'electric-2' },
      {
        ...candidates[0]!,
        id: 'electric-supplement-1',
        document: {
          ...candidates[0]!.document,
          id: 'electric-supplement',
          title: '充电器认证补充说明',
        },
      },
    ]
    const ranked = rankRuleChunks('充电器认证资料', duplicated, 3)
    expect(
      ranked.slice(0, 2).map((item) => item.candidate.document.id),
    ).toEqual([
      ...new Set(ranked.slice(0, 2).map((item) => item.candidate.document.id)),
    ])
  })

  it('preserves headings and splits oversized text deterministically', () => {
    const chunks = chunkRuleContent(
      `# 第一节\n\n${'认证资料必须核对。'.repeat(120)}`,
      160,
    )
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.heading === '第一节')).toBe(true)
    expect(chunks.map((chunk) => chunk.sequence)).toEqual(
      chunks.map((_, index) => index),
    )
  })
})
