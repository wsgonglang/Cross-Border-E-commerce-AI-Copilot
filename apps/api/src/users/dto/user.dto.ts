import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ROLE_CODES, USER_STATUSES, type RoleCode } from '@cross-border/shared'
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'

export class CreateUserDto {
  @ApiProperty({ example: 'member@copilot.local' })
  @IsEmail()
  @MaxLength(191)
  email!: string

  @ApiProperty({ example: '新运营成员' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string

  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string

  @ApiProperty({ enum: ROLE_CODES, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(ROLE_CODES, { each: true })
  roles!: RoleCode[]

  @ApiProperty({ type: [String], description: '允许访问的商家 ID' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  merchantIds!: string[]
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'member@copilot.local' })
  @IsOptional()
  @IsEmail()
  @MaxLength(191)
  email?: string

  @ApiPropertyOptional({ example: '新运营成员' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string

  @ApiPropertyOptional({ minLength: 8, maxLength: 72 })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password?: string

  @ApiPropertyOptional({ enum: ROLE_CODES, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(ROLE_CODES, { each: true })
  roles?: RoleCode[]

  @ApiPropertyOptional({ type: [String], description: '允许访问的商家 ID' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  merchantIds?: string[]

  @ApiPropertyOptional({ enum: USER_STATUSES })
  @IsOptional()
  @IsIn(USER_STATUSES)
  status?: 'ACTIVE' | 'DISABLED'
}
