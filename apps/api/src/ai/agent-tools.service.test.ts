import { describe, expect, it, vi } from 'vitest'

import type { AuditLogsService } from '../commerce/audit-logs.service'
import type { DashboardService } from '../commerce/dashboard.service'
import type { OrdersService } from '../commerce/orders.service'
import type { ProductsService } from '../commerce/products.service'
import { AgentToolsService } from './agent-tools.service'
import type { PlatformRulesService } from './platform-rules.service'
import type { ProductOptimizationsService } from './product-optimizations.service'

const operator = {
  id: 'user-1',
  email: 'operator@example.com',
  name: 'Operator',
  roles: ['operator' as const],
  merchantIds: ['merchant-1'],
}

function createHarness() {
  const product = {
    id: 'product-1',
    merchantId: 'merchant-1',
    code: 'P-DEMO-001',
    title: '旅行充电器',
    description: '描述',
    sellingPoints: [],
    language: 'zh-CN',
    status: 'ACTIVE' as const,
    version: 1,
    skus: [
      {
        id: 'sku-1',
        merchantId: 'merchant-1',
        productId: 'product-1',
        code: 'SKU-1',
        name: '黑色',
        price: '29.99',
        currency: 'USD',
        stock: 12,
        status: 'ACTIVE' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  const products = {
    list: vi.fn().mockResolvedValue({
      items: [product],
      total: 1,
      page: 1,
      pageSize: 5,
    }),
  }
  const orders = { list: vi.fn() }
  const dashboard = { getOverview: vi.fn() }
  const rules = { search: vi.fn() }
  const optimizations = {
    create: vi.fn().mockResolvedValue({
      id: 'optimization-1',
      status: 'DRAFT',
      targetLanguage: 'en-US',
    }),
  }
  const audit = { recordAgentToolCall: vi.fn().mockResolvedValue(undefined) }
  const service = new AgentToolsService(
    products as unknown as ProductsService,
    orders as unknown as OrdersService,
    dashboard as unknown as DashboardService,
    rules as unknown as PlatformRulesService,
    optimizations as unknown as ProductOptimizationsService,
    audit as unknown as AuditLogsService,
  )
  return { service, products, optimizations, audit }
}

describe('AgentToolsService', () => {
  it('queries inventory through ProductsService and audits the read', async () => {
    const { service, products, audit } = createHarness()

    const result = await service.execute(operator, 'merchant-1', {
      id: 'call-1',
      name: 'get_inventory',
      arguments: { productCode: 'P-DEMO-001' },
    })

    expect(result.status).toBe('success')
    expect(products.list).toHaveBeenCalledOnce()
    expect(result.output).toMatchObject({ totalStock: 12 })
    expect(audit.recordAgentToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'get_inventory',
        status: 'success',
      }),
    )
  })

  it('creates only an optimization draft through the existing service', async () => {
    const { service, optimizations } = createHarness()

    const result = await service.execute(operator, 'merchant-1', {
      id: 'call-2',
      name: 'create_product_optimization_draft',
      arguments: {
        productCode: 'P-DEMO-001',
        targetLanguage: 'en-US',
      },
    })

    expect(result.status).toBe('success')
    expect(optimizations.create).toHaveBeenCalledWith(
      operator,
      'merchant-1',
      'product-1',
      { targetLanguage: 'en-US' },
    )
    expect(result.output).toMatchObject({
      status: 'DRAFT',
      requiresHumanConfirmation: true,
    })
  })

  it('rejects invalid model arguments before calling business services', async () => {
    const { service, products, audit } = createHarness()

    const result = await service.execute(operator, 'merchant-1', {
      id: 'call-3',
      name: 'get_inventory',
      arguments: { productCode: '../other-merchant' },
    })

    expect(result.status).toBe('error')
    expect(products.list).not.toHaveBeenCalled()
    expect(audit.recordAgentToolCall).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error' }),
    )
  })
})
