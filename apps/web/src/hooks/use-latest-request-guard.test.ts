import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useLatestRequestGuard } from './use-latest-request-guard'

describe('useLatestRequestGuard', () => {
  it('only accepts the most recently started request', () => {
    const { result } = renderHook(() => useLatestRequestGuard())
    const first = result.current.begin()
    const second = result.current.begin()

    expect(result.current.isLatest(first)).toBe(false)
    expect(result.current.isLatest(second)).toBe(true)
  })

  it('invalidates an in-flight request explicitly and on unmount', () => {
    const { result, unmount } = renderHook(() => useLatestRequestGuard())
    const first = result.current.begin()
    result.current.invalidate()
    expect(result.current.isLatest(first)).toBe(false)

    const second = result.current.begin()
    unmount()
    expect(result.current.isLatest(second)).toBe(false)
  })
})
