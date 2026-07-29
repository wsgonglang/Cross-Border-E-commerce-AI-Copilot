import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

export class OrderQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @Min(1)
  page = 1

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @Min(1)
  @Max(100)
  pageSize = 20

  @ApiPropertyOptional({
    enum: [
      'PENDING',
      'CONFIRMED',
      'SHIPPED',
      'DELIVERED',
      'COMPLETED',
      'CANCELLED',
      'REFUNDING',
      'REFUNDED',
    ],
  })
  @IsOptional()
  @IsIn([
    'PENDING',
    'CONFIRMED',
    'SHIPPED',
    'DELIVERED',
    'COMPLETED',
    'CANCELLED',
    'REFUNDING',
    'REFUNDED',
  ])
  status?:
    | 'PENDING'
    | 'CONFIRMED'
    | 'SHIPPED'
    | 'DELIVERED'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'REFUNDING'
    | 'REFUNDED'

  @ApiPropertyOptional()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(64)
  keyword?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(30)
  storeId?: string
}

export class UpdateOrderStatusDto {
  @ApiProperty({ example: 'SHIPPED' })
  @IsIn([
    'CONFIRMED',
    'SHIPPED',
    'DELIVERED',
    'COMPLETED',
    'CANCELLED',
    'REFUNDING',
    'REFUNDED',
  ])
  status!:
    | 'CONFIRMED'
    | 'SHIPPED'
    | 'DELIVERED'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'REFUNDING'
    | 'REFUNDED'
}

export class DashboardQueryDto {
  @ApiPropertyOptional({ example: 7, minimum: 1, maximum: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsNotEmpty()
  startDate?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsNotEmpty()
  endDate?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(30)
  storeId?: string
}
