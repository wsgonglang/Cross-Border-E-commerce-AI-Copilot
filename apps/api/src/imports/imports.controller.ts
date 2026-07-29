import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  IMPORT_FIELD_KEYS,
  type AuthenticatedUser,
  type ImportMapping,
} from '@cross-border/shared'
import type { Response } from 'express'

import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { ImportJobQueryDto } from './dto/import.dto'
import { ImportJobsService, type ImportSubmission } from './import-jobs.service'

const uploadOptions = { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }

@ApiTags('structured-imports')
@ApiBearerAuth()
@Roles('admin', 'operator')
@Controller('api/merchants/:merchantId/imports')
export class ImportsController {
  constructor(private readonly jobs: ImportJobsService) {}

  @Post('analyze')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        headerRow: { type: 'integer' },
      },
    },
  })
  analyze(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('headerRow') rawHeaderRow?: string,
  ) {
    return this.jobs.analyze(
      actor,
      merchantId,
      file,
      this.headerRow(rawHeaderRow),
    )
  }

  @Post('preview')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'mapping'],
      properties: {
        file: { type: 'string', format: 'binary' },
        worksheet: { type: 'string' },
        headerRow: { type: 'integer', default: 1 },
        mapping: { type: 'string', description: 'JSON 字段映射' },
      },
    },
  })
  preview(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: Record<string, string>,
  ) {
    return this.jobs.preview(
      actor,
      merchantId,
      file,
      body.worksheet || undefined,
      this.headerRow(body.headerRow),
      this.mapping(body.mapping),
    )
  }

  @Post('jobs')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'mapping', 'mode', 'idempotencyKey'],
      properties: {
        file: { type: 'string', format: 'binary' },
        worksheet: { type: 'string' },
        headerRow: { type: 'integer', default: 1 },
        mapping: { type: 'string', description: 'JSON 字段映射' },
        mode: { type: 'string', enum: ['DRAFT_ONLY', 'DRAFT_AND_AI'] },
        targetLanguage: {
          type: 'string',
          enum: ['en-US', 'es-ES', 'pt-BR'],
        },
        idempotencyKey: { type: 'string' },
      },
    },
  })
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: Record<string, string>,
  ) {
    const submission: ImportSubmission = {
      worksheet: body.worksheet || undefined,
      headerRow: this.headerRow(body.headerRow),
      mapping: this.mapping(body.mapping),
      mode: this.mode(body.mode),
      targetLanguage: this.targetLanguage(body.targetLanguage),
      idempotencyKey: body.idempotencyKey ?? '',
    }
    return this.jobs.create(actor, merchantId, file, submission)
  }

  @Get('jobs')
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Query() query: ImportJobQueryDto,
  ) {
    return this.jobs.list(actor, merchantId, query)
  }

  @Get('jobs/:jobId')
  get(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.jobs.get(actor, merchantId, jobId)
  }

  @Post('jobs/:jobId/cancel')
  cancel(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.jobs.cancel(actor, merchantId, jobId)
  }

  @Get('jobs/:jobId/failures.csv')
  async failures(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('merchantId') merchantId: string,
    @Param('jobId') jobId: string,
    @Res() response: Response,
  ): Promise<void> {
    const csv = await this.jobs.failuresCsv(actor, merchantId, jobId)
    response.setHeader('Content-Type', 'text/csv; charset=utf-8')
    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(`import-${jobId}-failures.csv`)}`,
    )
    response.send(`\uFEFF${csv}`)
  }

  private headerRow(value?: string): number {
    const parsed = Number(value ?? 1)
    if (!Number.isInteger(parsed)) throw new BadRequestException('表头行无效')
    return parsed
  }

  private mapping(value?: string): ImportMapping {
    let parsed: unknown
    try {
      parsed = JSON.parse(value ?? '')
    } catch {
      throw new BadRequestException('字段映射必须是有效 JSON')
    }
    if (typeof parsed !== 'object' || parsed === null)
      throw new BadRequestException('字段映射无效')
    const candidate = parsed as Record<string, unknown>
    if (
      !IMPORT_FIELD_KEYS.every(
        (key) =>
          typeof candidate[key] === 'string' &&
          String(candidate[key]).trim().length > 0,
      )
    )
      throw new BadRequestException('所有商品与 SKU 字段都必须完成映射')
    return Object.fromEntries(
      IMPORT_FIELD_KEYS.map((key) => [key, String(candidate[key]).trim()]),
    ) as ImportMapping
  }

  private targetLanguage(
    value?: string,
  ): 'en-US' | 'es-ES' | 'pt-BR' | undefined {
    if (!value) return undefined
    if (!['en-US', 'es-ES', 'pt-BR'].includes(value))
      throw new BadRequestException('AI 目标语言无效')
    return value as 'en-US' | 'es-ES' | 'pt-BR'
  }

  private mode(value?: string): 'DRAFT_ONLY' | 'DRAFT_AND_AI' {
    if (value !== 'DRAFT_ONLY' && value !== 'DRAFT_AND_AI')
      throw new BadRequestException('导入模式无效')
    return value
  }
}
