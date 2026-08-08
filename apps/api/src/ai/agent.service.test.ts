import { BadGatewayException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'

import type { MerchantAccessService } from '../commerce/merchant-access.service'
import type { StoresService } from '../commerce/stores.service'
import type { AiProvider } from './ai-provider.service'
import { AgentService } from './agent.service'
import type { AgentRunsService } from './agent-runs.service'
import type { AgentToolsService } from './agent-tools.service'

const operator = {
  id: 'user-1',
  email: 'operator@example.com',
  name: 'Operator',
  roles: ['operator' as const],
  merchantIds: ['merchant-1'],
}

const zeroUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }

function provider(overrides: Partial<AiProvider> = {}): AiProvider {
  return {
    name: 'test',
    model: 'test',
    chat: vi.fn(),
    generateTitle: vi.fn(),
    optimizeProduct: vi.fn(),
    runAgentStep: vi.fn().mockResolvedValue({
      toolCalls: [],
      answer: '已完成',
      usage: { promptTokens: 2, completionTokens: 1, totalTokens: 3 },
    }),
    ...overrides,
  }
}

function runs() {
  return {
    start: vi.fn().mockResolvedValue('run-1'),
    markRunning: vi.fn().mockResolvedValue(undefined),
    appendToolCall: vi.fn().mockResolvedValue(undefined),
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
  }
}

function service(input: {
  aiProvider: AiProvider
  tools?: { execute: ReturnType<typeof vi.fn> }
  agentRuns?: ReturnType<typeof runs>
  assertStore?: ReturnType<typeof vi.fn>
}) {
  return new AgentService(
    {
      assertAccess: vi.fn().mockResolvedValue(undefined),
    } as unknown as MerchantAccessService,
    (input.tools ?? { execute: vi.fn() }) as unknown as AgentToolsService,
    (input.agentRuns ?? runs()) as unknown as AgentRunsService,
    {
      assertStore: input.assertStore ?? vi.fn(),
    } as unknown as StoresService,
    input.aiProvider,
  )
}

describe('AgentService', () => {
  it('returns the run id immediately and completes in the background', async () => {
    const agentRuns = runs()
    const target = service({ aiProvider: provider(), agentRuns })

    const started = await target.run(operator, 'merchant-1', '查询商品')

    expect(started).toEqual({ runId: 'run-1', status: 'PLANNING' })
    await vi.waitFor(() => {
      expect(agentRuns.complete).toHaveBeenCalledOnce()
    })
  })

  it('feeds tool results back to the model and returns draft ids and usage', async () => {
    const runAgentStep = vi
      .fn()
      .mockResolvedValueOnce({
        toolCalls: [
          {
            id: 'call-1',
            name: 'create_product_optimization_draft',
            arguments: {
              productCode: 'P-DEMO-001',
              targetLanguage: 'en-US',
            },
          },
        ],
        answer: null,
        usage: { promptTokens: 2, completionTokens: 1, totalTokens: 3 },
      })
      .mockResolvedValueOnce({
        toolCalls: [],
        answer: '草稿已创建，待人工确认。',
        usage: { promptTokens: 3, completionTokens: 2, totalTokens: 5 },
      })
    const tools = {
      execute: vi.fn().mockResolvedValue({
        id: 'call-1',
        name: 'create_product_optimization_draft',
        status: 'success',
        input: {},
        output: { optimizationId: 'optimization-1' },
      }),
    }
    const agentRuns = runs()
    const target = service({
      aiProvider: provider({ runAgentStep }),
      tools,
      agentRuns,
    })

    const result = await target.executeRun({
      actor: operator,
      merchantId: 'merchant-1',
      runId: 'run-1',
      message: '为 P-DEMO-001 创建英文优化草稿',
      days: 7,
    })

    expect(result.answer).toBe('草稿已创建，待人工确认。')
    expect(result.createdOptimizationIds).toEqual(['optimization-1'])
    expect(result.usage.totalTokens).toBe(8)
    // 第二步模型输入里必须包含已回填的工具结果消息。
    const secondStepInput = runAgentStep.mock.calls[1]?.[0] as unknown as {
      messages: Array<{ role: string }>
    }
    expect(secondStepInput.messages.map((item) => item.role)).toEqual([
      'user',
      'assistant',
      'tool',
    ])
    expect(agentRuns.appendToolCall).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({ id: 'call-1' }),
      0,
    )
    expect(agentRuns.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-1',
        answer: '草稿已创建，待人工确认。',
        createdOptimizationIds: ['optimization-1'],
      }),
    )
  })

  it('bounds oversized tool feedback for the model while preserving the full audited result', async () => {
    const runAgentStep = vi
      .fn()
      .mockResolvedValueOnce({
        toolCalls: [
          { id: 'call-1', name: 'get_business_overview', arguments: {} },
        ],
        answer: null,
        usage: zeroUsage,
      })
      .mockResolvedValueOnce({
        toolCalls: [],
        answer: '已分析',
        usage: zeroUsage,
      })
    const fullOutput = {
      rows: Array.from({ length: 30 }, (_, index) => ({
        id: `row-${index}`,
        description: '经营数据'.repeat(300),
      })),
    }
    const tools = {
      execute: vi.fn().mockResolvedValue({
        id: 'call-1',
        name: 'get_business_overview',
        status: 'success',
        input: {},
        output: fullOutput,
      }),
    }
    const agentRuns = runs()
    const target = service({
      aiProvider: provider({ runAgentStep }),
      tools,
      agentRuns,
    })

    await target.executeRun({
      actor: operator,
      merchantId: 'merchant-1',
      runId: 'run-1',
      message: '查看经营数据',
      days: 7,
    })

    const secondStep = runAgentStep.mock.calls[1]?.[0] as {
      messages: Array<{ role: string; content?: string }>
    }
    const feedbackContent =
      secondStep.messages.find((message) => message.role === 'tool')?.content ??
      '{}'
    const modelFeedback = JSON.parse(feedbackContent) as {
      truncation: { truncated: boolean; budgetTokens: number }
    }
    expect(modelFeedback.truncation.truncated).toBe(true)
    expect(feedbackContent.length).toBeLessThan(
      JSON.stringify(fullOutput).length,
    )
    expect(agentRuns.appendToolCall).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({ output: fullOutput }),
      0,
    )
  })

  it('does not expose the draft tool without explicit intent and refuses rogue calls', async () => {
    const runAgentStep = vi
      .fn()
      .mockResolvedValueOnce({
        toolCalls: [
          {
            id: 'call-1',
            name: 'create_product_optimization_draft',
            arguments: {
              productCode: 'P-DEMO-001',
              targetLanguage: 'en-US',
            },
          },
        ],
        answer: null,
        usage: zeroUsage,
      })
      .mockResolvedValue({ toolCalls: [], answer: '完成', usage: zeroUsage })
    const tools = { execute: vi.fn() }
    const agentRuns = runs()
    const target = service({
      aiProvider: provider({ runAgentStep }),
      tools,
      agentRuns,
    })

    const result = await target.executeRun({
      actor: operator,
      merchantId: 'merchant-1',
      runId: 'run-1',
      message: '查询 P-DEMO-001',
      days: 7,
    })

    const stepInput = runAgentStep.mock.calls[0]?.[0] as unknown as {
      tools: Array<{ name: string }>
    }
    expect(
      stepInput.tools.some(
        (tool) => tool.name === 'create_product_optimization_draft',
      ),
    ).toBe(false)
    // 越权请求不执行业务工具，但要以错误结果回填，保持会话协议完整并留痕。
    expect(tools.execute).not.toHaveBeenCalled()
    expect(result.toolCalls[0]).toMatchObject({
      id: 'call-1',
      status: 'error',
    })
    expect(agentRuns.appendToolCall).toHaveBeenCalledOnce()
  })

  it('executes the draft tool at most once per run', async () => {
    const draftCall = (id: string) => ({
      id,
      name: 'create_product_optimization_draft',
      arguments: { productCode: 'P-DEMO-001', targetLanguage: 'en-US' },
    })
    const runAgentStep = vi
      .fn()
      .mockResolvedValueOnce({
        toolCalls: [draftCall('call-1'), draftCall('call-2')],
        answer: null,
        usage: zeroUsage,
      })
      .mockResolvedValue({ toolCalls: [], answer: '完成', usage: zeroUsage })
    const tools = {
      execute: vi.fn().mockResolvedValue({
        id: 'call-1',
        name: 'create_product_optimization_draft',
        status: 'success',
        input: {},
        output: { optimizationId: 'optimization-1' },
      }),
    }
    const target = service({ aiProvider: provider({ runAgentStep }), tools })

    const result = await target.executeRun({
      actor: operator,
      merchantId: 'merchant-1',
      runId: 'run-1',
      message: '为 P-DEMO-001 创建优化草稿',
      days: 7,
    })

    expect(tools.execute).toHaveBeenCalledOnce()
    expect(result.toolCalls).toHaveLength(2)
    expect(result.toolCalls[1]?.status).toBe('error')
  })

  it('stops requesting tools after the total budget is exhausted', async () => {
    const overviewCalls = (round: number) =>
      Array.from({ length: 3 }, (_, index) => ({
        id: `call-${round}-${index}`,
        name: 'get_business_overview',
        arguments: {},
      }))
    const runAgentStep = vi
      .fn()
      .mockImplementation(({ forceFinish }: { forceFinish?: boolean }) =>
        forceFinish
          ? Promise.resolve({
              toolCalls: [],
              answer: '预算内结论',
              usage: zeroUsage,
            })
          : Promise.resolve({
              toolCalls: overviewCalls(runAgentStep.mock.calls.length),
              answer: null,
              usage: zeroUsage,
            }),
      )
    const tools = {
      execute: vi.fn().mockResolvedValue({
        id: 'any',
        name: 'get_business_overview',
        status: 'success',
        input: {},
        output: {},
      }),
    }
    const target = service({ aiProvider: provider({ runAgentStep }), tools })

    const result = await target.executeRun({
      actor: operator,
      merchantId: 'merchant-1',
      runId: 'run-1',
      message: '持续查看经营数据',
      days: 7,
    })

    expect(result.toolCalls.length).toBeLessThanOrEqual(6)
    expect(result.answer).toBe('预算内结论')
    const lastStepInput = runAgentStep.mock.calls.at(-1)?.[0] as {
      forceFinish?: boolean
    }
    expect(lastStepInput.forceFinish).toBe(true)
  })

  it('validates and forwards the selected store context to the loop and tools', async () => {
    const runAgentStep = vi
      .fn()
      .mockResolvedValueOnce({
        toolCalls: [
          { id: 'call-1', name: 'get_business_overview', arguments: {} },
        ],
        answer: null,
        usage: zeroUsage,
      })
      .mockResolvedValue({ toolCalls: [], answer: '完成', usage: zeroUsage })
    const tools = {
      execute: vi.fn().mockResolvedValue({
        id: 'call-1',
        name: 'get_business_overview',
        status: 'success',
        input: {},
        output: {},
      }),
    }
    const assertStore = vi.fn().mockResolvedValue({
      id: 'store-1',
      name: 'Amazon 美国店',
      platform: 'Amazon',
      market: 'US',
    })
    const agentRuns = runs()
    const target = service({
      aiProvider: provider({ runAgentStep }),
      tools,
      agentRuns,
      assertStore,
    })

    await target.run(operator, 'merchant-1', '查询经营概览', 'store-1')
    await vi.waitFor(() => {
      expect(agentRuns.complete).toHaveBeenCalledOnce()
    })

    expect(assertStore).toHaveBeenCalledWith(operator, 'merchant-1', 'store-1')
    const stepInput = runAgentStep.mock.calls[0]?.[0] as unknown as {
      messages: Array<{ role: string; content: string }>
    }
    expect(stepInput.messages[0]?.content).toContain('Amazon 美国店')
    expect(tools.execute).toHaveBeenCalledWith(
      operator,
      'merchant-1',
      expect.any(Object),
      'store-1',
      7,
    )
  })

  it('keeps the dashboard Agent read-only for viewers and forwards the time range', async () => {
    const viewer = {
      ...operator,
      id: 'viewer-1',
      roles: ['viewer' as const],
    }
    const runAgentStep = vi.fn().mockResolvedValue({
      toolCalls: [],
      answer: '只读结论',
      usage: zeroUsage,
    })
    const agentRuns = runs()
    const target = service({
      aiProvider: provider({ runAgentStep }),
      agentRuns,
    })

    await target.run(
      viewer,
      'merchant-1',
      '请优化 P-DEMO-001 并分析经营数据',
      undefined,
      30,
      'dashboard',
    )
    await vi.waitFor(() => {
      expect(agentRuns.complete).toHaveBeenCalledOnce()
    })

    const stepInput = runAgentStep.mock.calls[0]?.[0] as unknown as {
      messages: Array<{ role: string; content: string }>
      tools: Array<{ name: string }>
    }
    expect(stepInput.messages[0]?.content).toContain('近 30 天')
    expect(
      stepInput.tools.some(
        (tool) => tool.name === 'create_product_optimization_draft',
      ),
    ).toBe(false)
    expect(agentRuns.start).toHaveBeenCalledWith(
      viewer,
      'merchant-1',
      '请优化 P-DEMO-001 并分析经营数据',
      undefined,
      'dashboard',
    )
  })

  it('marks the run failed with a safe gateway error when the first step fails', async () => {
    const agentRuns = runs()
    const target = service({
      aiProvider: provider({
        runAgentStep: vi.fn().mockRejectedValue(new Error('provider secret')),
      }),
      agentRuns,
    })

    await expect(
      target.executeRun({
        actor: operator,
        merchantId: 'merchant-1',
        runId: 'run-1',
        message: '查询商品',
        days: 7,
      }),
    ).rejects.toBeInstanceOf(BadGatewayException)
    expect(agentRuns.fail).toHaveBeenCalledWith(
      'run-1',
      'AI Agent planning failed',
    )
  })

  it('falls back to a safe answer when a later step fails after tools ran', async () => {
    const runAgentStep = vi
      .fn()
      .mockResolvedValueOnce({
        toolCalls: [
          { id: 'call-1', name: 'get_business_overview', arguments: {} },
        ],
        answer: null,
        usage: zeroUsage,
      })
      .mockRejectedValue(new Error('provider secret'))
    const tools = {
      execute: vi.fn().mockResolvedValue({
        id: 'call-1',
        name: 'get_business_overview',
        status: 'success',
        input: {},
        output: {},
      }),
    }
    const agentRuns = runs()
    const target = service({
      aiProvider: provider({ runAgentStep }),
      tools,
      agentRuns,
    })

    const result = await target.executeRun({
      actor: operator,
      merchantId: 'merchant-1',
      runId: 'run-1',
      message: '查看经营数据',
      days: 7,
    })

    expect(result.answer).toContain('业务工具已经执行')
    expect(agentRuns.complete).toHaveBeenCalledOnce()
    expect(agentRuns.fail).not.toHaveBeenCalled()
  })
})
