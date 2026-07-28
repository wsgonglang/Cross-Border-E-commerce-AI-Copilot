import { ApiProperty } from '@nestjs/swagger'
import {
  OPTIMIZATION_LANGUAGES,
  type OptimizationLanguage,
} from '@cross-border/shared'
import { IsIn } from 'class-validator'

export class CreateProductOptimizationDto {
  @ApiProperty({ enum: OPTIMIZATION_LANGUAGES, example: 'en-US' })
  @IsIn(OPTIMIZATION_LANGUAGES)
  targetLanguage!: OptimizationLanguage
}
