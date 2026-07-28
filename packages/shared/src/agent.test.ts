import { describe, expect, it } from 'vitest'

import { AGENT_TOOL_NAMES } from './agent'

describe('agent tool contract', () => {
  it('keeps a small explicit tool allowlist', () => {
    expect(AGENT_TOOL_NAMES).toEqual([
      'search_products',
      'get_inventory',
      'get_order_status',
      'get_business_overview',
      'search_platform_rules',
      'create_product_optimization_draft',
    ])
    expect(new Set(AGENT_TOOL_NAMES).size).toBe(AGENT_TOOL_NAMES.length)
  })
})
