import {
  OPTIMIZATION_LANGUAGES,
  productOptimizationDraftSchema,
  type ProductOptimizationSource,
} from '@cross-border/shared'
import { describe, expect, it } from 'vitest'

import { MockAiProvider } from './ai-provider.service'
import { AGENT_TOOL_DEFINITIONS } from './agent-tools.contract'

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

  it('plans constrained business tools without paid usage', async () => {
    const provider = new MockAiProvider()
    const result = await provider.runAgentStep({
      messages: [
        { role: 'user', content: '查询 P-DEMO-001 的库存并检查充电器规则' },
      ],
      tools: AGENT_TOOL_DEFINITIONS,
    })

    expect(result.toolCalls.map((call) => call.name)).toEqual([
      'get_inventory',
      'search_platform_rules',
    ])
    expect(result.answer).toBeNull()
    expect(result.usage.totalTokens).toBe(0)
  })

  it('answers chit-chat directly without forcing a tool call', async () => {
    const result = await new MockAiProvider().runAgentStep({
      messages: [{ role: 'user', content: '你好，你能做什么？' }],
      tools: AGENT_TOOL_DEFINITIONS,
    })

    expect(result.toolCalls).toEqual([])
    expect(result.answer).toContain('受控业务 Agent')
  })

  it('chains inventory before draft creation across loop rounds', async () => {
    const provider = new MockAiProvider()
    const message = '先查 P-DEMO-001 的库存，再创建英文优化草稿'
    const round1 = await provider.runAgentStep({
      messages: [{ role: 'user', content: message }],
      tools: AGENT_TOOL_DEFINITIONS,
    })
    expect(round1.toolCalls.map((call) => call.name)).toEqual(['get_inventory'])

    const round2 = await provider.runAgentStep({
      messages: [
        { role: 'user', content: message },
        { role: 'assistant', content: null, toolCalls: round1.toolCalls },
        {
          role: 'tool',
          toolCallId: round1.toolCalls[0]!.id,
          name: 'get_inventory',
          content: JSON.stringify({ totalStock: 20 }),
        },
      ],
      tools: AGENT_TOOL_DEFINITIONS,
    })
    expect(round2.toolCalls.map((call) => call.name)).toEqual([
      'create_product_optimization_draft',
    ])

    const round3 = await provider.runAgentStep({
      messages: [
        { role: 'user', content: message },
        { role: 'assistant', content: null, toolCalls: round1.toolCalls },
        {
          role: 'tool',
          toolCallId: round1.toolCalls[0]!.id,
          name: 'get_inventory',
          content: JSON.stringify({ totalStock: 20 }),
        },
        { role: 'assistant', content: null, toolCalls: round2.toolCalls },
        {
          role: 'tool',
          toolCallId: round2.toolCalls[0]!.id,
          name: 'create_product_optimization_draft',
          content: JSON.stringify({ optimizationId: 'optimization-1' }),
        },
      ],
      tools: AGENT_TOOL_DEFINITIONS,
    })
    expect(round3.toolCalls).toEqual([])
    expect(round3.answer).toContain('人工确认')
  })

  it('always answers when the loop forces a finish', async () => {
    const result = await new MockAiProvider().runAgentStep({
      messages: [{ role: 'user', content: '查询 P-DEMO-001 的库存' }],
      tools: AGENT_TOOL_DEFINITIONS,
      forceFinish: true,
    })

    expect(result.toolCalls).toEqual([])
    expect(result.answer).not.toBeNull()
  })
})
