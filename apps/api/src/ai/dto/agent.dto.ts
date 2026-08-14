import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsBoolean,
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
    default: false,
    description: '用户是否显式授权本次运行创建一条商品优化草稿',
  })
  @IsOptional()
  @IsBoolean()
  allowDraftCreation = false

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

export class AgentFeedbackDto {
  @ApiProperty({ enum: ['HELPFUL', 'NOT_HELPFUL'] })
  @IsIn(['HELPFUL', 'NOT_HELPFUL'])
  rating!: 'HELPFUL' | 'NOT_HELPFUL'

  @ApiPropertyOptional({
    enum: [
      'WRONG_TOOL',
      'INACCURATE_DATA',
      'INCOMPLETE_ANSWER',
      'CITATION_ISSUE',
      'TOO_SLOW',
      'OTHER',
    ],
  })
  @IsOptional()
  @IsIn([
    'WRONG_TOOL',
    'INACCURATE_DATA',
    'INCOMPLETE_ANSWER',
    'CITATION_ISSUE',
    'TOO_SLOW',
    'OTHER',
  ])
  reason?:
    | 'WRONG_TOOL'
    | 'INACCURATE_DATA'
    | 'INCOMPLETE_ANSWER'
    | 'CITATION_ISSUE'
    | 'TOO_SLOW'
    | 'OTHER'

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string
}
