import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsIn, IsOptional, Max, Min } from 'class-validator'

export class ImportJobQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @Min(1)
  page = 1

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @Min(1)
  @Max(100)
  pageSize = 20

  @ApiPropertyOptional({
    enum: ['PENDING', 'RUNNING', 'COMPLETED', 'PARTIAL_FAILED', 'CANCELLED'],
  })
  @IsOptional()
  @IsIn(['PENDING', 'RUNNING', 'COMPLETED', 'PARTIAL_FAILED', 'CANCELLED'])
  status?: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PARTIAL_FAILED' | 'CANCELLED'
}
