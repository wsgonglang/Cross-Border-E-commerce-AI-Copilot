import type { OrderSavedView } from '@cross-border/shared'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { getOrderSavedViews } from '../../../api/orders'
import { useOrderSavedViews } from './use-order-saved-views'

vi.mock('../../../api/orders', () => ({
  createOrderSavedView: vi.fn(),
  deleteOrderSavedView: vi.fn(),
  getOrderSavedViews: vi.fn(),
  updateOrderSavedView: vi.fn(),
}))

const mockedGetOrderSavedViews = vi.mocked(getOrderSavedViews)

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function view(id: string, merchantId: string): OrderSavedView {
  return { id, merchantId, name: id } as OrderSavedView
}

describe('useOrderSavedViews', () => {
  it('does not expose or apply saved views from a previous merchant', async () => {
    const first = deferred<OrderSavedView[]>()
    const second = deferred<OrderSavedView[]>()
    mockedGetOrderSavedViews.mockImplementation((_token, merchantId) =>
      merchantId === 'merchant-a' ? first.promise : second.promise,
    )
    const onError = vi.fn()
    const { result, rerender } = renderHook(
      ({ merchantId }: { merchantId: string }) =>
        useOrderSavedViews({ token: 'token', merchantId, onError }),
      { initialProps: { merchantId: 'merchant-a' } },
    )
    await waitFor(() =>
      expect(mockedGetOrderSavedViews).toHaveBeenCalledWith(
        'token',
        'merchant-a',
      ),
    )

    rerender({ merchantId: 'merchant-b' })
    expect(result.current.views).toEqual([])
    await waitFor(() =>
      expect(mockedGetOrderSavedViews).toHaveBeenCalledWith(
        'token',
        'merchant-b',
      ),
    )

    await act(async () => {
      second.resolve([view('view-b', 'merchant-b')])
      await second.promise
    })
    expect(result.current.views.map((item) => item.id)).toEqual(['view-b'])

    await act(async () => {
      first.resolve([view('view-a', 'merchant-a')])
      await first.promise
    })
    expect(result.current.views.map((item) => item.id)).toEqual(['view-b'])
    expect(onError).not.toHaveBeenCalled()
  })
})
