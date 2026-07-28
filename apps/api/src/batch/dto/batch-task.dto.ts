import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

export class CreateBatchTaskDto {
  @ApiProperty({ type: [String], maxItems: 20 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  productIds!: string[]

  @ApiProperty({ enum: ['en-US', 'es-ES', 'pt-BR'] })
  @IsIn(['en-US', 'es-ES', 'pt-BR'])
  targetLanguage!: 'en-US' | 'es-ES' | 'pt-BR'

  @ApiProperty({ minLength: 8, maxLength: 64 })
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$/)
  idempotencyKey!: string
}

export class BatchTaskQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page = 1

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  pageSize = 20
}
