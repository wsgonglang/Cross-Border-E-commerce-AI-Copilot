import { Injectable } from '@nestjs/common'

import { BatchQueueService } from '../batch/batch-queue.service'
import { PrismaService } from '../database/prisma.service'
import type {
  DependencyStatus,
  LivenessStatus,
  ReadinessStatus,
} from './health.types'

@Injectable()
export class HealthService {
  private static readonly CHECK_TIMEOUT_MS = 1_500

  constructor(
    private readonly prisma: PrismaService,
    private readonly batchQueue: BatchQueueService,
  ) {}

  getLiveness(): LivenessStatus {
    return {
      status: 'ok',
      service: 'api',
      timestamp: new Date().toISOString(),
    }
  }

  async getReadiness(): Promise<ReadinessStatus> {
    const [mysql, redis] = await Promise.all([
      this.check(() => this.prisma.$queryRaw`SELECT 1`),
      this.check(() => this.batchQueue.ping()),
    ])
    return {
      status:
        mysql.status === 'up' && redis.status === 'up' ? 'ready' : 'not_ready',
      service: 'api',
      timestamp: new Date().toISOString(),
      dependencies: { mysql, redis },
    }
  }

  private async check(
    operation: () => Promise<unknown>,
  ): Promise<DependencyStatus> {
    const startedAt = Date.now()
    let timer: NodeJS.Timeout | undefined
    try {
      await Promise.race([
        operation(),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('health check timeout')),
            HealthService.CHECK_TIMEOUT_MS,
          )
        }),
      ])
      return { status: 'up', latencyMs: Date.now() - startedAt }
    } catch {
      return { status: 'down', latencyMs: Date.now() - startedAt }
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
}
