import type {
  ProductOptimizationSummary,
  ProductSummary,
} from '@cross-border/shared'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  applyProductOptimization,
  createProductOptimization,
  getProductOptimizations,
  rejectProductOptimization,
} from '../../api/product-optimizations'
import { ProductOptimizationDrawer } from './product-optimization-drawer'

vi.mock('../../api/product-optimizations', () => ({
  applyProductOptimization: vi.fn(),
  createProductOptimization: vi.fn(),
  getProductOptimization: vi.fn(),
  getProductOptimizations: vi.fn(),
  rejectProductOptimization: vi.fn(),
}))

const product = (id: string, code: string): ProductSummary => ({
  id,
  merchantId: 'merchant-1',
  code,
  title: `Original ${code}`,
  description: 'Original description',
  sellingPoints: ['Original point'],
  language: 'zh-CN',
  status: 'ACTIVE',
  version: 1,
  skus: [],
  createdAt: '2026-08-15T00:00:00.000Z',
  updatedAt: '2026-08-15T00:00:00.000Z',
})

const optimization = (
  target: ProductSummary,
  status: ProductOptimizationSummary['status'] = 'DRAFT',
): ProductOptimizationSummary => ({
  id: `optimization-${target.id}`,
  merchantId: target.merchantId,
  productId: target.id,
  requestedById: 'user-1',
  status,
  targetLanguage: 'en-US',
  source: {
    title: target.title,
    description: target.description,
    sellingPoints: target.sellingPoints,
    language: target.language,
    version: target.version,
  },
  draft: {
    title: `Optimized ${target.code}`,
    description: 'Optimized description',
    sellingPoints: ['Optimized point'],
    complianceRisks: [],
    suggestions: ['Keep evidence'],
    language: 'en-US',
    confidence: 0.9,
  },
  providerName: 'mock',
  modelName: 'mock-product-optimizer-v1',
  usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
  createdAt: '2026-08-15T00:00:00.000Z',
  updatedAt: '2026-08-15T00:00:00.000Z',
})

describe('ProductOptimizationDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('generates a draft once and applies it only after human confirmation', async () => {
    const user = userEvent.setup()
    const target = product('product-1', 'P-001')
    const draft = optimization(target)
    vi.mocked(getProductOptimizations).mockResolvedValue([])
    vi.mocked(createProductOptimization).mockResolvedValue(draft)
    vi.mocked(applyProductOptimization).mockResolvedValue({
      ...draft,
      status: 'APPLIED',
    })
    const onApplied = vi.fn().mockResolvedValue(undefined)

    render(
      <ProductOptimizationDrawer
        open
        token="token"
        merchantId="merchant-1"
        product={target}
        onClose={vi.fn()}
        onApplied={onApplied}
      />,
    )

    await screen.findByText('选择目标语言并生成第一份 AI 草稿')
    await user.click(screen.getByRole('button', { name: '生成草稿' }))
    expect(createProductOptimization).toHaveBeenCalledOnce()
    await screen.findByText('Optimized P-001')

    await user.click(screen.getByRole('button', { name: '人工确认并写回' }))
    expect(applyProductOptimization).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '确认写回' }))

    await waitFor(() => expect(applyProductOptimization).toHaveBeenCalledOnce())
    expect(onApplied).toHaveBeenCalledOnce()
  })

  it('rejects a draft without invoking the product write callback', async () => {
    const user = userEvent.setup()
    const target = product('product-1', 'P-001')
    const draft = optimization(target)
    vi.mocked(getProductOptimizations).mockResolvedValue([draft])
    vi.mocked(rejectProductOptimization).mockResolvedValue({
      ...draft,
      status: 'REJECTED',
    })
    const onApplied = vi.fn().mockResolvedValue(undefined)

    render(
      <ProductOptimizationDrawer
        open
        token="token"
        merchantId="merchant-1"
        product={target}
        onClose={vi.fn()}
        onApplied={onApplied}
      />,
    )

    await screen.findByText('Optimized P-001')
    await user.click(screen.getByRole('button', { name: '拒绝草稿' }))
    await waitFor(() =>
      expect(rejectProductOptimization).toHaveBeenCalledOnce(),
    )
    expect(onApplied).not.toHaveBeenCalled()
  })

  it('does not let a stale product response overwrite the newly selected product', async () => {
    const first = product('product-1', 'P-001')
    const second = product('product-2', 'P-002')
    let resolveFirst:
      ((value: ProductOptimizationSummary[]) => void) | undefined
    vi.mocked(getProductOptimizations)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve
          }),
      )
      .mockResolvedValueOnce([optimization(second)])

    const { rerender } = render(
      <ProductOptimizationDrawer
        open
        token="token"
        merchantId="merchant-1"
        product={first}
        onClose={vi.fn()}
        onApplied={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    rerender(
      <ProductOptimizationDrawer
        open
        token="token"
        merchantId="merchant-1"
        product={second}
        onClose={vi.fn()}
        onApplied={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    await screen.findByText('Optimized P-002')
    resolveFirst?.([optimization(first)])
    fireEvent(window, new Event('focus'))
    await waitFor(() =>
      expect(screen.queryByText('Optimized P-001')).not.toBeInTheDocument(),
    )
    expect(screen.getByText('Optimized P-002')).toBeInTheDocument()
  })
})
