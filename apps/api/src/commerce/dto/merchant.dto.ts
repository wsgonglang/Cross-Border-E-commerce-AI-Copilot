import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  Matches,
  MaxLength,
} from 'class-validator'

export class CreateMerchantDto {
  @ApiProperty({ example: 'DEMO-EU' })
  @Matches(/^[A-Z0-9][A-Z0-9_-]{1,31}$/)
  code!: string

  @ApiProperty({ example: 'Demo 欧洲店铺' })
  @IsNotEmpty()
  @MaxLength(120)
  name!: string

  @ApiProperty({ example: 'EUR' })
  @Matches(/^[A-Z]{3}$/)
  defaultCurrency!: string
}

export class UpdateMerchantDto {
  @ApiPropertyOptional({ example: '欧洲旗舰店' })
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string

  @ApiPropertyOptional({ enum: ['ACTIVE', 'DISABLED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED'])
  status?: 'ACTIVE' | 'DISABLED'

  @ApiPropertyOptional({ example: 'EUR' })
  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  defaultCurrency?: string
}
