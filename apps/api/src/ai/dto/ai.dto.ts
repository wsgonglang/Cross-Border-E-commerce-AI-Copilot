import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'

export class ChatSendDto {
  @ApiProperty({ example: '帮我优化这个商品标题' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  content!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  sessionId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  parentMessageId?: string
}

export class ChatMessageItemDto {
  @ApiProperty({ enum: ['user', 'assistant', 'system'] })
  @IsString()
  @IsIn(['user', 'assistant', 'system'])
  role!: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50_000)
  content!: string
}

export class ChatStreamDto {
  @ApiProperty({ type: [ChatMessageItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageItemDto)
  messages!: ChatMessageItemDto[]
}

export class CreateAiSessionDto {
  @ApiProperty({ example: '商品优化对话' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  groupId?: string
}

export class UpdateAiSessionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pinned?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  groupId?: string
}

export class AiSessionQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @Min(1)
  page = 1

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @Type(() => Number)
  @Min(1)
  @Max(200)
  pageSize = 50

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  keyword?: string
}
