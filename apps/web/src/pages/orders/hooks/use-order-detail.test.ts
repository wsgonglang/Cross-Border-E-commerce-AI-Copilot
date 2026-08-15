import type { OrderSummary } from '@cross-border/shared'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { getOrder } from '../../../api/orders'
import { useOrderDetail } from './use-order-detail'

vi.mock('../../../api/orders', () => ({
  getOrder: vi.fn(),
  updateOrderStatus: vi.fn(),
}))

const mockedGetOrder = vi.mocked(getOrder)

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function order(id: string): OrderSummary {
  return { id, orderNo: `ORDER-${id}` } as OrderSummary
}

describe('useOrderDetail', () => {
  it('does not let an older detail request overwrite the latest order', async () => {
    const first = deferred<OrderSummary>()
    const second = deferred<OrderSummary>()
    mockedGetOrder.mockImplementation((_token, _merchantId, orderId) =>
      orderId === 'order-a' ? first.promise : second.promise,
    )

    const { result } = renderHook(() =>
      useOrderDetail({
        initialOrderId: null,
        merchantId: 'merchant-1',
        onError: vi.fn(),
        onUpdated: vi.fn().mockResolvedValue(undefined),
        token: 'token',
      }),
    )

    act(() => result.current.open('order-a'))
    await waitFor(() =>
      expect(mockedGetOrder).toHaveBeenCalledWith(
        'token',
        'merchant-1',
        'order-a',
        undefined,
      ),
    )
    act(() => result.current.open('order-b'))
    await waitFor(() =>
      expect(mockedGetOrder).toHaveBeenCalledWith(
        'token',
        'merchant-1',
        'order-b',
        undefined,
      ),
    )

    await act(async () => {
      second.resolve(order('order-b'))
      await second.promise
    })
    expect(result.current.data?.id).toBe('order-b')

    await act(async () => {
      first.resolve(order('order-a'))
      await first.promise
    })
    expect(result.current.data?.id).toBe('order-b')
  })
})
