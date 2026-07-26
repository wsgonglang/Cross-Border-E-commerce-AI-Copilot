import { useEffect, useState } from 'react'

import { getApiHealth } from '../api/health'

type HealthState = 'checking' | 'online' | 'offline'

export function useApiHealth(): HealthState {
  const [state, setState] = useState<HealthState>('checking')

  useEffect(() => {
    const controller = new AbortController()

    getApiHealth(controller.signal)
      .then(() => setState('online'))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setState('offline')
      })

    return () => controller.abort()
  }, [])

  return state
}
