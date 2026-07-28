import { BadGatewayException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'

import type { MerchantAccessService } from '../commerce/merchant-access.service'
import type { AiProvider } from './ai-provider.service'
import { AgentService } from './agent.service'
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
    const service = new AgentService(
      {
        assertAccess: vi.fn().mockResolvedValue(undefined),
      } as unknown as MerchantAccessService,
      tools as unknown as AgentToolsService,
      aiProvider,
    )

    const result = await service.run(
      operator,
      'merchant-1',
      '为 P-DEMO-001 创建英文优化草稿',
    )

    expect(result.answer).toBe('已完成')
    expect(result.createdOptimizationIds).toEqual(['optimization-1'])
    expect(result.usage.totalTokens).toBe(8)
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

  it('returns a safe gateway error when planning fails', async () => {
    const service = new AgentService(
      {
        assertAccess: vi.fn().mockResolvedValue(undefined),
      } as unknown as MerchantAccessService,
      { execute: vi.fn() } as unknown as AgentToolsService,
      provider({
        planAgentTools: vi.fn().mockRejectedValue(new Error('provider secret')),
      }),
    )

    await expect(
      service.run(operator, 'merchant-1', '查询商品'),
    ).rejects.toBeInstanceOf(BadGatewayException)
  })
})
