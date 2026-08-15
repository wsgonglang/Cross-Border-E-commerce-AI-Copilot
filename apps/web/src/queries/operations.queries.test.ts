import { describe, expect, it } from 'vitest'

import { agentRunRefetchInterval } from './operations.queries'

describe('Agent run polling policy', () => {
  it.each(['COMPLETED', 'FAILED', 'CANCELLED'])(
    'stops polling for the %s terminal state',
    (status) => {
      expect(agentRunRefetchInterval(status)).toBe(false)
    },
  )

  it.each([undefined, 'PLANNING', 'RUNNING'])(
    'keeps polling for the %s state',
    (status) => {
      expect(agentRunRefetchInterval(status)).toBe(1200)
    },
  )
})
