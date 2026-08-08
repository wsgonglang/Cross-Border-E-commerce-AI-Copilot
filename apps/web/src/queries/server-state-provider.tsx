import { QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useMemo } from 'react'

import { useAppSelector } from '../store/hooks'
import { createQueryClient } from './query-client'

export function ServerStateProvider({ children }: { children: ReactNode }) {
  const userId = useAppSelector((state) => state.auth.user?.id)
  // A per-user client prevents cross-account cache reuse and avoids clearing a
  // newly-started merchant query in an effect immediately after session restore.
  // userId intentionally invalidates the client even though client creation
  // itself does not read it; the dependency is the cache ownership boundary.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const client = useMemo(() => createQueryClient(), [userId])
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
