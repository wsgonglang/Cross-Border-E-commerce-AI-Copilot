import { Controller, Get, Res } from '@nestjs/common'
import type { Response } from 'express'

import { Public } from '../auth/decorators/public.decorator'
import { HealthService } from './health.service'
import type { LivenessStatus, ReadinessStatus } from './health.types'
import { RateLimit } from '../security/rate-limit.decorator'

@Controller('api')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get(['health', 'health/live'])
  getLiveness(): LivenessStatus {
    return this.healthService.getLiveness()
  }

  @Public()
  @Get('health/ready')
  @RateLimit({ limit: 60, windowMs: 60_000, identity: 'ip' })
  async getReadiness(
    @Res({ passthrough: true }) response: Response,
  ): Promise<ReadinessStatus> {
    const status = await this.healthService.getReadiness()
    if (status.status === 'not_ready') response.status(503)
    return status
  }
}
