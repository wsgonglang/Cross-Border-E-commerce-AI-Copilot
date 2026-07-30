import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { OrderFilterCard } from './order-filter-card'

describe('OrderFilterCard', () => {
  it('keeps keyword editing separate from applying the search', () => {
    const onKeywordDraftChange = vi.fn()
    const onPatch = vi.fn()
    const { container } = render(
      <OrderFilterCard
        filters={{}}
        keywordDraft=""
        onKeywordDraftChange={onKeywordDraftChange}
        onPatch={onPatch}
        onReset={vi.fn()}
      />,
    )
    const searchInput = container.querySelector<HTMLInputElement>(
      '.order-keyword-search input',
    )

    expect(searchInput).not.toBeNull()
    fireEvent.change(searchInput!, { target: { value: '  CB-1001  ' } })
    expect(onKeywordDraftChange).toHaveBeenCalledWith('  CB-1001  ')
    expect(onPatch).not.toHaveBeenCalled()
  })

  it('resets all order criteria from the filter card', () => {
    const onReset = vi.fn()
    render(
      <OrderFilterCard
        filters={{ keyword: 'CB-1001' }}
        keywordDraft="CB-1001"
        onKeywordDraftChange={vi.fn()}
        onPatch={vi.fn()}
        onReset={onReset}
      />,
    )

    fireEvent.click(screen.getAllByRole('button').at(-1)!)
    expect(onReset).toHaveBeenCalledOnce()
  })
})
