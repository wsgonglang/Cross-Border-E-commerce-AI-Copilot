import { Controller, Get } from '@nestjs/common'

import { HealthService } from './health.service'
import type { HealthStatus } from './health.types'

@Controller('api')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  getHealth(): HealthStatus {
    return this.healthService.getStatus()
  }
}
