import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsIn, IsOptional } from 'class-validator'

import type { AiQualityWindowDays } from '@cross-border/shared'

export class AiQualityQueryDto {
  @ApiPropertyOptional({ enum: [7, 30, 90], default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsIn([7, 30, 90])
  days: AiQualityWindowDays = 30
}
