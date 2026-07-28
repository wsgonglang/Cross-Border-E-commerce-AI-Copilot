import { describe, expect, it } from 'vitest'

import {
  chunkRuleContent,
  rankRuleChunks,
  type RetrievalCandidate,
} from './rule-retrieval'

const documents = [
  {
    id: 'electric',
    title: '电器商品发布规范',
    content:
      '# 充电器\n\n充电器发布前必须核对插头类型、输入电压和目标市场安全认证。不得在资料不完整时声称已经通过认证。',
  },
  {
    id: 'claims',
    title: '标题与营销声明规范',
    content:
      '# 营销声明\n\n商品标题不得堆砌无关关键词。最好、第一、百分百有效等绝对化声明必须有可验证依据。',
  },
  {
    id: 'battery',
    title: '锂电池运输规范',
    content:
      '# 航空运输\n\n含锂电池商品航空运输前应核对额定能量、UN38.3 测试摘要和承运人限制。',
  },
]

const candidates: RetrievalCandidate[] = documents.flatMap((document) =>
  chunkRuleContent(document.content).map((chunk) => ({
    id: `${document.id}-${chunk.sequence}`,
    content: chunk.content,
    heading: chunk.heading ?? null,
    searchTerms: chunk.searchTerms,
    document: {
      id: document.id,
      title: document.title,
      platform: 'DEMO_MARKETPLACE',
      scope: 'GLOBAL',
      sourceUrl: null,
    },
  })),
)

describe('rule retrieval baseline evaluation', () => {
  it('reaches Recall@3 = 1.0 on the fixed interview demo set', () => {
    const evaluationSet = [
      { query: '充电器需要核对哪些电压和认证', expected: 'electric' },
      { query: '标题可以写最好和百分百有效吗', expected: 'claims' },
      { query: '锂电池航空运输需要 UN38.3 吗', expected: 'battery' },
      { query: '关键词堆砌是否违反标题规范', expected: 'claims' },
    ]
    const hits = evaluationSet.filter(({ query, expected }) =>
      rankRuleChunks(query, candidates, 3).some(
        (result) => result.candidate.document.id === expected,
      ),
    ).length

    expect(hits / evaluationSet.length).toBe(1)
  })

  it('returns no citation for an unsupported cold-chain question', () => {
    expect(rankRuleChunks('宠物食品冷链温度要求', candidates)).toEqual([])
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
