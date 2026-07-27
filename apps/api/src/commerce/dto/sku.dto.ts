import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  Matches,
  Max,
  MaxLength,
  Min,
  NotEquals,
} from 'class-validator'

export class CreateSkuDto {
  @ApiProperty({ example: 'SKU-BLACK-US' })
  @Matches(/^[A-Z0-9][A-Z0-9_-]{1,63}$/)
  code!: string

  @ApiProperty({ example: '黑色 / 美规' })
  @IsNotEmpty()
  @MaxLength(120)
  name!: string

  @ApiProperty({ example: '29.99' })
  @Matches(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/)
  price!: string

  @ApiProperty({ example: 'USD' })
  @Matches(/^[A-Z]{3}$/)
  currency!: string

  @ApiProperty({ minimum: 0, maximum: 1_000_000 })
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stock!: number
}

export class UpdateSkuDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string

  @ApiPropertyOptional({ example: '32.99' })
  @IsOptional()
  @Matches(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/)
  price?: string

  @ApiPropertyOptional({ enum: ['ACTIVE', 'DISABLED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED'])
  status?: 'ACTIVE' | 'DISABLED'
}

export class AdjustStockDto {
  @ApiProperty({ description: '正数入库，负数扣减', example: -2 })
  @IsInt()
  @Min(-1_000_000)
  @Max(1_000_000)
  @NotEquals(0)
  delta!: number

  @ApiProperty({ example: '订单出库' })
  @IsNotEmpty()
  @MaxLength(200)
  reason!: string
}
