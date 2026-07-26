import { Controller, Get } from '@nestjs/common'

import { HealthService } from './health.service'
import type { HealthStatus } from './health.types'
import { Public } from '../auth/decorators/public.decorator'

@Controller('api')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get('health')
  getHealth(): HealthStatus {
    return this.healthService.getStatus()
  }
}
