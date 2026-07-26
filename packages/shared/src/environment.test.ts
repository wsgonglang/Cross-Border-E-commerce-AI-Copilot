import { describe, expect, it } from 'vitest'

import { loadApiEnvironment, loadWorkerEnvironment } from './environment'

describe('environment validation', () => {
  it('provides safe local defaults', () => {
    expect(loadApiEnvironment({})).toEqual({
      NODE_ENV: 'development',
      API_PORT: 3000,
      WEB_ORIGIN: 'http://localhost:5173',
    })
    expect(loadWorkerEnvironment({}).WORKER_NAME).toBe('ai-task-worker')
  })

  it('rejects an invalid API port', () => {
    expect(() => loadApiEnvironment({ API_PORT: '70000' })).toThrow()
  })
})
