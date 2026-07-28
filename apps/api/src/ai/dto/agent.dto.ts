import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString, MaxLength } from 'class-validator'

export class AgentRunDto {
  @ApiProperty({
    example: '查询 P-DEMO-001 的库存，并检查充电器合规规则',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message!: string
}
