import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsIn,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator'

export class CreateStoreDto {
  @ApiProperty({ example: 'AMZ-US' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  code!: string

  @ApiProperty({ example: 'Amazon 美国店' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string

  @ApiProperty({ example: 'Amazon' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  platform!: string

  @ApiProperty({ example: 'US' })
  @IsString()
  @Length(2, 2)
  market!: string

  @ApiProperty({ example: 'USD' })
  @IsString()
  @Length(3, 3)
  currency!: string

  @ApiProperty({ example: 'en-US' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  locale!: string

  @ApiProperty({ example: 'America/Los_Angeles' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  timezone!: string
}

export class UpdateStoreDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED'])
  status?: 'ACTIVE' | 'DISABLED'

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  locale?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string
}

export class CreateProductListingDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  productId!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  externalProductId?: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description!: string

  @ApiProperty({ example: 'en-US' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  language!: string

  @ApiProperty({ example: '29.99' })
  @IsNumberString()
  price!: string

  @ApiProperty({ example: 'USD' })
  @IsString()
  @Length(3, 3)
  currency!: string

  @ApiPropertyOptional({ enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
}

export class UpdateProductListingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  externalProductId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  language?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  price?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string

  @ApiPropertyOptional({ enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
}
