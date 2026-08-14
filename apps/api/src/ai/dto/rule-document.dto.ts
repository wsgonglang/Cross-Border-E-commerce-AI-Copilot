import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator'

export class ImportRuleDocumentDto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  title!: string

  @ApiProperty({ maxLength: 64, example: 'DEMO_MARKETPLACE' })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  platform!: string

  @ApiPropertyOptional({ maxLength: 32, example: 'US' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  market?: string

  @ApiPropertyOptional({ maxLength: 16, example: 'zh-CN' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  language?: string

  @ApiPropertyOptional({ maxLength: 64, example: 'ELECTRONICS' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  effectiveFrom?: string

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  effectiveTo?: string

  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  version?: string

  @ApiPropertyOptional({ maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  supersedesDocumentId?: string

  @ApiProperty({ enum: ['GLOBAL', 'MERCHANT'] })
  @IsIn(['GLOBAL', 'MERCHANT'])
  scope!: 'GLOBAL' | 'MERCHANT'

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  sourceUrl?: string

  @ApiProperty({
    minLength: 20,
    maxLength: 30_000,
    description: 'Markdown 或纯文本规则原文',
  })
  @IsString()
  @MinLength(20)
  @MaxLength(30_000)
  content!: string
}

export class SearchRuleDocumentsDto {
  @ApiProperty({ minLength: 2, maxLength: 200 })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  query!: string

  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  platform?: string

  @ApiPropertyOptional({ maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  market?: string

  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  asOf?: string
}
