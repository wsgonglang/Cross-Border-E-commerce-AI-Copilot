import { describe, expect, it } from 'vitest'

import { MockAiProvider } from './ai-provider.service'
import { AGENT_TOOL_DEFINITIONS } from './agent-tools.contract'

/**
 * Agent 规划基线评估：固定输入集 → 期望的首轮工具选择。
 * 与规则 RAG 的 Recall@3 评估对齐，用确定性 Mock Provider 在 CI 中守住
 * 「输入意图 → 工具选择」映射不被无意改坏；真实模型的准确率需人工抽测记录。
 */
const readOnlyTools = AGENT_TOOL_DEFINITIONS.filter(
  (tool) => tool.name !== 'create_product_optimization_draft',
)

describe('agent planning baseline evaluation', () => {
  it('reaches tool-selection accuracy = 1.0 on the fixed evaluation set', async () => {
    const provider = new MockAiProvider()
    const evaluationSet: Array<{
      message: string
      tools: typeof AGENT_TOOL_DEFINITIONS
      expected: string[]
    }> = [
      {
        message: '查询 P-DEMO-001 的库存',
        tools: AGENT_TOOL_DEFINITIONS,
        expected: ['get_inventory'],
      },
      {
        message: '查询订单 ORD-20260701-001 的状态',
        tools: AGENT_TOOL_DEFINITIONS,
        expected: ['get_order_status'],
      },
      {
        message: '查看今日经营看板',
        tools: AGENT_TOOL_DEFINITIONS,
        expected: ['get_business_overview'],
      },
      {
        message: '检查充电器标题和认证相关规则',
        tools: AGENT_TOOL_DEFINITIONS,
        expected: ['search_platform_rules'],
      },
      {
        message: '为 P-DEMO-001 创建西班牙语优化草稿',
        tools: AGENT_TOOL_DEFINITIONS,
        expected: ['create_product_optimization_draft'],
      },
      {
        message: '查询 P-DEMO-001 的库存并检查充电器规则',
        tools: AGENT_TOOL_DEFINITIONS,
        expected: ['get_inventory', 'search_platform_rules'],
      },
      {
        message: '看看 P-DEMO-002 这个商品',
        tools: AGENT_TOOL_DEFINITIONS,
        expected: ['search_products'],
      },
      {
        message: '先查 P-DEMO-001 的库存，再创建英文优化草稿',
        tools: AGENT_TOOL_DEFINITIONS,
        // 依赖链首轮只查库存，草稿在拿到结果后的下一轮再决定。
        expected: ['get_inventory'],
      },
      {
        // viewer 场景：草稿工具未暴露时，优化意图必须降级为只读查询而不是报错。
        message: '为 P-DEMO-001 创建英文优化草稿',
        tools: readOnlyTools,
        expected: ['search_products'],
      },
      {
        message: '订单 ORD-20260701-002 状态，另外看下销售数据',
        tools: AGENT_TOOL_DEFINITIONS,
        expected: ['get_order_status', 'get_business_overview'],
      },
    ]

    const outcomes = await Promise.all(
      evaluationSet.map(async ({ message, tools, expected }) => {
        const step = await provider.runAgentStep({
          messages: [{ role: 'user', content: message }],
          tools,
        })
        const actual = step.toolCalls.map((call) => call.name)
        return {
          message,
          hit:
            actual.length === expected.length &&
            expected.every((name) => actual.includes(name)),
        }
      }),
    )

    const misses = outcomes.filter((outcome) => !outcome.hit)
    expect(misses).toEqual([])
  })

  it('declines tool usage for out-of-scope small talk', async () => {
    const step = await new MockAiProvider().runAgentStep({
      messages: [{ role: 'user', content: '今天天气怎么样？' }],
      tools: AGENT_TOOL_DEFINITIONS,
    })

    expect(step.toolCalls).toEqual([])
    expect(step.answer).not.toBeNull()
  })
})
