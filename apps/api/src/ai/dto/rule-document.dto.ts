import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsIn,
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
}
