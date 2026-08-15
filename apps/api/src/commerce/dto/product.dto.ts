import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

export class ProductQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @Min(1)
  page = 1

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @Min(1)
  @Max(100)
  pageSize = 20

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string

  @ApiPropertyOptional({ enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'ARCHIVED'])
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  storeId?: string
}

export class CreateProductDto {
  @ApiProperty({ example: 'P-10001' })
  @Matches(/^[A-Z0-9][A-Z0-9_-]{1,63}$/)
  code!: string

  @ApiProperty()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string

  @ApiProperty()
  @IsString()
  @MaxLength(10_000)
  description!: string

  @ApiProperty({ example: 'zh-CN' })
  @Matches(/^[a-z]{2}(?:-[A-Z]{2})?$/)
  language!: string

  @ApiPropertyOptional({ enum: ['DRAFT', 'ACTIVE'], default: 'DRAFT' })
  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE'])
  status?: 'DRAFT' | 'ACTIVE'
}

export class UpdateProductDto {
  @ApiPropertyOptional({
    description: '客户端最后一次读取到的商品版本，用于防止并发编辑覆盖',
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  description?: string

  @ApiPropertyOptional({ example: 'en-US' })
  @IsOptional()
  @Matches(/^[a-z]{2}(?:-[A-Z]{2})?$/)
  language?: string

  @ApiPropertyOptional({ enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'ARCHIVED'])
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
}
