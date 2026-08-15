import { Controller, Get, Header, Res } from '@nestjs/common'
import type { Response } from 'express'

import { Public } from '../auth/decorators/public.decorator'
import { MetricsService } from './metrics.service'
import { RateLimit } from '../security/rate-limit.decorator'

@Controller('api')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Public()
  @Get('metrics')
  @Header('Cache-Control', 'no-store')
  @RateLimit({ limit: 30, windowMs: 60_000, identity: 'ip' })
  async metrics(
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    response.type(this.metricsService.contentType)
    return this.metricsService.render()
  }
}
