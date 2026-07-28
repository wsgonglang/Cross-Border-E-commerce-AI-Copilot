import { describe, expect, it, vi } from 'vitest'

import type { MerchantAccessService } from '../commerce/merchant-access.service'
import { PlatformRulesService } from './platform-rules.service'

const viewer = {
  id: 'viewer-1',
  email: 'viewer@example.com',
  name: 'Viewer',
  roles: ['viewer' as const],
  merchantIds: ['merchant-1'],
}

describe('PlatformRulesService', () => {
  const service = new PlatformRulesService({
    assertAccess: vi.fn().mockResolvedValue(undefined),
  } as unknown as MerchantAccessService)

  it('returns traceable demo sources for matching rules', async () => {
    const result = await service.search(
      viewer,
      'merchant-1',
      '充电器需要哪些认证',
    )

    expect(result.sufficient).toBe(true)
    expect(result.sources[0]).toMatchObject({
      sourceId: 'DEMO-RULE-ELECTRIC-001',
      scope: 'DEMO_MARKETPLACE',
    })
  })

  it('states that information is insufficient instead of inventing rules', async () => {
    const result = await service.search(
      viewer,
      'merchant-1',
      '完全未知的特殊品类',
    )

    expect(result.sufficient).toBe(false)
    expect(result.sources).toEqual([])
    expect(result.notice).toContain('信息不足')
  })
})
