import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RouteErrorBoundary } from './route-error-boundary'

let shouldThrow = true

function RetryExample() {
  if (shouldThrow) throw new Error('broken route')
  return <div>页面已恢复</div>
}

describe('RouteErrorBoundary', () => {
  beforeEach(() => {
    shouldThrow = true
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows a recoverable fallback instead of a blank page', () => {
    render(
      <MemoryRouter>
        <RouteErrorBoundary>
          <RetryExample />
        </RouteErrorBoundary>
      </MemoryRouter>,
      {
        onCaughtError: () => undefined,
        onRecoverableError: () => undefined,
      },
    )

    expect(screen.getByRole('alert')).toHaveTextContent('页面暂时无法显示')
    expect(screen.getByRole('button', { name: '重试当前页面' })).toBeVisible()
    expect(screen.getByRole('button', { name: '返回工作台' })).toBeVisible()
  })

  it('recovers when the user returns to a healthy route', () => {
    render(
      <MemoryRouter initialEntries={['/broken']}>
        <RouteErrorBoundary>
          <Routes>
            <Route path="/" element={<div>运营工作台</div>} />
            <Route path="/broken" element={<RetryExample />} />
          </Routes>
        </RouteErrorBoundary>
      </MemoryRouter>,
      {
        onCaughtError: () => undefined,
        onRecoverableError: () => undefined,
      },
    )

    fireEvent.click(screen.getByRole('button', { name: '返回工作台' }))

    expect(screen.getByText('运营工作台')).toBeVisible()
  })

  it('retries the current route without a full-page reload', () => {
    render(
      <MemoryRouter>
        <RouteErrorBoundary>
          <RetryExample />
        </RouteErrorBoundary>
      </MemoryRouter>,
      {
        onCaughtError: () => undefined,
        onRecoverableError: () => undefined,
      },
    )

    shouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: '重试当前页面' }))

    expect(screen.getByText('页面已恢复')).toBeVisible()
  })
})
