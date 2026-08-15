import { describe, expect, it, vi } from 'vitest'

import type { BatchQueueService } from '../batch/batch-queue.service'
import type { PrismaService } from '../database/prisma.service'
import { HealthService } from './health.service'

function service(
  mysql = vi.fn().mockResolvedValue([1]),
  redis = vi.fn().mockResolvedValue(undefined),
) {
  return new HealthService(
    { $queryRaw: mysql } as unknown as PrismaService,
    { ping: redis } as unknown as BatchQueueService,
  )
}

describe('HealthService', () => {
  it('reports API liveness without checking dependencies', () => {
    const status = service().getLiveness()
    expect(status.status).toBe('ok')
    expect(status.service).toBe('api')
    expect(Number.isNaN(Date.parse(status.timestamp))).toBe(false)
  })

  it('reports readiness only when MySQL and Redis are available', async () => {
    const status = await service().getReadiness()
    expect(status.status).toBe('ready')
    expect(status.dependencies.mysql.status).toBe('up')
    expect(status.dependencies.redis.status).toBe('up')
  })

  it('returns not_ready without exposing the dependency exception', async () => {
    const status = await service(
      vi.fn().mockRejectedValue(new Error('secret connection string')),
    ).getReadiness()
    expect(status.status).toBe('not_ready')
    expect(status.dependencies.mysql.status).toBe('down')
    expect(status.dependencies.mysql.latencyMs).toBeTypeOf('number')
  })
})
