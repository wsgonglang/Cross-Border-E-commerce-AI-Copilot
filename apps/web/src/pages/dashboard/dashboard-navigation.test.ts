import type { AiResultItem } from '@cross-border/shared'
import { describe, expect, it } from 'vitest'

import { getDashboardResultPath } from './dashboard-navigation'

const baseResult: AiResultItem = {
  id: 'result-1',
  type: 'AGENT_RUN',
  status: 'COMPLETED',
  title: '库存分析',
  description: '已完成',
  createdAt: '2026-08-15T00:00:00.000Z',
  updatedAt: '2026-08-15T00:00:00.000Z',
}

describe('getDashboardResultPath', () => {
  it('links an Agent result to its exact trace', () => {
    expect(
      getDashboardResultPath(
        { ...baseResult, agentRunId: 'run-1' },
        'merchant-1',
      ),
    ).toBe('/ai-results?merchantId=merchant-1&agentRunId=run-1')
  })

  it('links a product draft to the exact optimization', () => {
    expect(
      getDashboardResultPath(
        {
          ...baseResult,
          type: 'PRODUCT_OPTIMIZATION',
          optimizationId: 'optimization-1',
          product: { id: 'product-1', code: 'P 001', title: 'Product' },
        },
        'merchant-1',
      ),
    ).toBe(
      '/products?merchantId=merchant-1&productId=product-1&optimizationId=optimization-1&keyword=P+001',
    )
  })

  it('falls back to the result list without a precise identifier', () => {
    expect(getDashboardResultPath(baseResult, 'merchant-1')).toBe('/ai-results')
  })
})
