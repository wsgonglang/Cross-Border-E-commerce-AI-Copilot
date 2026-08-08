import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsArray,
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsBoolean,
  IsIn,
  IsInt,
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

  @ApiPropertyOptional({ enum: ['true', 'false'], default: 'false' })
  @IsOptional()
  @IsIn(['true', 'false'])
  archived?: 'true' | 'false'

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  groupId?: string
}

export class FavoriteAiMessageDto {
  @ApiProperty()
  @IsBoolean()
  favorited!: boolean
}

export class SelectAiBranchDto {
  @ApiProperty({ description: '要切换到的同级分支消息 ID' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  messageId!: string
}

export class LinkAiMessageDto {
  @ApiProperty({ enum: ['PRODUCT', 'ORDER'] })
  @IsIn(['PRODUCT', 'ORDER'])
  entityType!: 'PRODUCT' | 'ORDER'

  @ApiProperty({ description: '商品编码或订单号' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  entityReference!: string
}

export class AiSessionExportQueryDto {
  @ApiPropertyOptional({ enum: ['markdown', 'json'], default: 'markdown' })
  @IsIn(['markdown', 'json'])
  format: 'markdown' | 'json' = 'markdown'
}

export class CreateAiSessionShareDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsString({ each: true })
  recipientUserIds!: string[]

  @ApiPropertyOptional({ default: 24, minimum: 1, maximum: 168 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  expiresInHours = 24
}
