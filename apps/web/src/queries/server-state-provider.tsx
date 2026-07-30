import { QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useEffect, useRef } from 'react'

import { useAppSelector } from '../store/hooks'
import { queryClient } from './query-client'

function AuthQueryBoundary({ children }: { children: ReactNode }) {
  const userId = useAppSelector((state) => state.auth.user?.id)
  const client = useQueryClient()
  const previousUserId = useRef(userId)

  useEffect(() => {
    if (previousUserId.current !== userId) {
      client.clear()
      previousUserId.current = userId
    }
  }, [client, userId])

  return children
}

export function ServerStateProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthQueryBoundary>{children}</AuthQueryBoundary>
    </QueryClientProvider>
  )
}
