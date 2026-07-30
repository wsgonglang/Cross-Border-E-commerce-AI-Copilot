import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { OrderBulkBar } from './order-bulk-bar'

describe('OrderBulkBar', () => {
  it('prevents execution until an action and at least one order are selected', () => {
    const onRun = vi.fn()
    render(
      <OrderBulkBar
        onActionChange={vi.fn()}
        onRun={onRun}
        role="operator"
        running={false}
        selectedCount={0}
      />,
    )

    const runButton = screen.getByRole('button')
    expect(runButton).toBeDisabled()
    fireEvent.click(runButton)
    expect(onRun).not.toHaveBeenCalled()
  })

  it('runs a permitted bulk action for the selected orders', () => {
    const onRun = vi.fn()
    render(
      <OrderBulkBar
        action="CONFIRM"
        onActionChange={vi.fn()}
        onRun={onRun}
        role="operator"
        running={false}
        selectedCount={2}
      />,
    )

    const runButton = screen.getByRole('button')
    expect(runButton).toBeEnabled()
    fireEvent.click(runButton)
    expect(onRun).toHaveBeenCalledOnce()
  })
})
