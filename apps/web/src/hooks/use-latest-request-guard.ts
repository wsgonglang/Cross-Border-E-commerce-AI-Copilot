import { useCallback, useEffect, useMemo, useRef } from 'react'

interface LatestRequestGuard {
  begin: () => number
  invalidate: () => void
  isLatest: (requestId: number) => boolean
}

export function useLatestRequestGuard(): LatestRequestGuard {
  const latestRequestId = useRef(0)
  const begin = useCallback(() => ++latestRequestId.current, [])
  const invalidate = useCallback(() => {
    latestRequestId.current += 1
  }, [])
  const isLatest = useCallback(
    (requestId: number) => latestRequestId.current === requestId,
    [],
  )

  useEffect(() => invalidate, [invalidate])

  return useMemo(
    () => ({ begin, invalidate, isLatest }),
    [begin, invalidate, isLatest],
  )
}
