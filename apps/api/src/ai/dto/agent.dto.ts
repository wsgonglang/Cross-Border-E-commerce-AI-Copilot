import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

export class AgentRunDto {
  @ApiProperty({
    example: '查询 P-DEMO-001 的库存，并检查充电器合规规则',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  storeId?: string
}

export class AiResultsQueryDto {
  @IsOptional()
  @IsIn(['ALL', 'AGENT_RUN', 'PRODUCT_OPTIMIZATION'])
  type: 'ALL' | 'AGENT_RUN' | 'PRODUCT_OPTIMIZATION' = 'ALL'

  @IsOptional()
  @IsString()
  @MaxLength(32)
  status?: string

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page = 1

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  pageSize = 20
}
