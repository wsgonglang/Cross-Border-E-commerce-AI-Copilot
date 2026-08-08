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

  @ApiPropertyOptional({ example: 7, minimum: 1, maximum: 90 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(90)
  days?: number

  @ApiPropertyOptional({ example: 'dashboard' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourcePage?: string

  @ApiPropertyOptional({
    description: 'Persist this run in an AI conversation',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  sessionId?: string

  @ApiPropertyOptional({
    description: 'Create the user turn under this message',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  parentMessageId?: string

  @ApiPropertyOptional({ description: 'Regenerate an existing assistant turn' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  regenerateMessageId?: string
}

export class AiResultsQueryDto {
  @IsOptional()
  @IsIn(['ALL', 'AGENT_RUN', 'PRODUCT_OPTIMIZATION', 'IMPORT_JOB'])
  type: 'ALL' | 'AGENT_RUN' | 'PRODUCT_OPTIMIZATION' | 'IMPORT_JOB' = 'ALL'

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
