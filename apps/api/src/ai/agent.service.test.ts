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

function provider(overrides: Partial<AiProvider> = {}): AiProvider {
  return {
    name: 'test',
    model: 'test',
    chat: vi.fn(),
    generateTitle: vi.fn(),
    optimizeProduct: vi.fn(),
    planAgentTools: vi.fn().mockResolvedValue({
      toolCalls: [],
      usage: { promptTokens: 2, completionTokens: 1, totalTokens: 3 },
    }),
    summarizeAgent: vi.fn().mockResolvedValue({
      answer: '已完成',
      usage: { promptTokens: 3, completionTokens: 2, totalTokens: 5 },
    }),
    ...overrides,
  }
}

function runs() {
  return {
    start: vi.fn().mockResolvedValue('run-1'),
    markRunning: vi.fn().mockResolvedValue(undefined),
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
  }
}

describe('AgentService', () => {
  it('executes planned tools and returns created draft ids and usage', async () => {
    const aiProvider = provider({
      planAgentTools: vi.fn().mockResolvedValue({
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
        usage: { promptTokens: 2, completionTokens: 1, totalTokens: 3 },
      }),
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
    const service = new AgentService(
      {
        assertAccess: vi.fn().mockResolvedValue(undefined),
      } as unknown as MerchantAccessService,
      tools as unknown as AgentToolsService,
      agentRuns as unknown as AgentRunsService,
      {
        assertStore: vi.fn(),
      } as unknown as StoresService,
      aiProvider,
    )

    const result = await service.run(
      operator,
      'merchant-1',
      '为 P-DEMO-001 创建英文优化草稿',
    )

    expect(result.runId).toBe('run-1')
    expect(result.answer).toBe('已完成')
    expect(result.createdOptimizationIds).toEqual(['optimization-1'])
    expect(result.usage.totalTokens).toBe(8)
    expect(agentRuns.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-1',
        answer: '已完成',
        createdOptimizationIds: ['optimization-1'],
      }),
    )
  })

  it('does not expose or execute the draft tool without explicit intent', async () => {
    const planAgentTools = vi.fn().mockResolvedValue({
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
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    })
    const tools = { execute: vi.fn() }
    const service = new AgentService(
      {
        assertAccess: vi.fn().mockResolvedValue(undefined),
      } as unknown as MerchantAccessService,
      tools as unknown as AgentToolsService,
      runs() as unknown as AgentRunsService,
      {
        assertStore: vi.fn(),
      } as unknown as StoresService,
      provider({ planAgentTools }),
    )

    await service.run(operator, 'merchant-1', '查询 P-DEMO-001')

    const planInput = planAgentTools.mock.calls[0]?.[0] as unknown as {
      tools: Array<{ name: string }>
    }
    const definitions = planInput.tools
    expect(
      definitions.some(
        (tool) => tool.name === 'create_product_optimization_draft',
      ),
    ).toBe(false)
    expect(tools.execute).not.toHaveBeenCalled()
  })

  it('validates and forwards the selected store context to planning and tools', async () => {
    const planAgentTools = vi.fn().mockResolvedValue({
      toolCalls: [
        {
          id: 'call-1',
          name: 'get_business_overview',
          arguments: {},
        },
      ],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    })
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
    const service = new AgentService(
      {
        assertAccess: vi.fn().mockResolvedValue(undefined),
      } as unknown as MerchantAccessService,
      tools as unknown as AgentToolsService,
      runs() as unknown as AgentRunsService,
      { assertStore } as unknown as StoresService,
      provider({ planAgentTools }),
    )

    await service.run(operator, 'merchant-1', '查询经营概览', 'store-1')

    expect(assertStore).toHaveBeenCalledWith(operator, 'merchant-1', 'store-1')
    expect(planAgentTools).toHaveBeenCalledOnce()
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
    const planAgentTools = vi.fn().mockResolvedValue({
      toolCalls: [],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    })
    const agentRuns = runs()
    const service = new AgentService(
      {
        assertAccess: vi.fn().mockResolvedValue(undefined),
      } as unknown as MerchantAccessService,
      { execute: vi.fn() } as unknown as AgentToolsService,
      agentRuns as unknown as AgentRunsService,
      { assertStore: vi.fn() } as unknown as StoresService,
      provider({ planAgentTools }),
    )

    await service.run(
      viewer,
      'merchant-1',
      '请优化 P-DEMO-001 并分析经营数据',
      undefined,
      30,
      'dashboard',
    )

    const planInput = planAgentTools.mock.calls[0]?.[0] as unknown as {
      message: string
      tools: Array<{ name: string }>
    }
    expect(planInput.message).toContain('近 30 天')
    expect(
      planInput.tools.some(
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

  it('returns a safe gateway error when planning fails', async () => {
    const agentRuns = runs()
    const service = new AgentService(
      {
        assertAccess: vi.fn().mockResolvedValue(undefined),
      } as unknown as MerchantAccessService,
      { execute: vi.fn() } as unknown as AgentToolsService,
      agentRuns as unknown as AgentRunsService,
      {
        assertStore: vi.fn(),
      } as unknown as StoresService,
      provider({
        planAgentTools: vi.fn().mockRejectedValue(new Error('provider secret')),
      }),
    )

    await expect(
      service.run(operator, 'merchant-1', '查询商品'),
    ).rejects.toBeInstanceOf(BadGatewayException)
    expect(agentRuns.fail).toHaveBeenCalledWith(
      'run-1',
      'AI Agent planning failed',
    )
  })
})
