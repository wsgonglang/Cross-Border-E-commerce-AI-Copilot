import { describe, expect, it } from 'vitest'

import { HealthService } from './health.service'

describe('HealthService', () => {
  it('reports a healthy API process', () => {
    const status = new HealthService().getStatus()

    expect(status.status).toBe('ok')
    expect(status.service).toBe('api')
    expect(Number.isNaN(Date.parse(status.timestamp))).toBe(false)
  })
})
