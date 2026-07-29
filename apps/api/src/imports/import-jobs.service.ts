import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import type {
  AuthenticatedUser,
  ImportJobDetail,
  ImportMapping,
  ImportMode,
  ImportPreview,
  ImportPreviewRow,
  PaginatedImportJobs,
} from '@cross-border/shared'

import { asJson } from '../commerce/commerce.utils'
import { MerchantAccessService } from '../commerce/merchant-access.service'
import { PrismaService } from '../database/prisma.service'
import type { ImportJobQueryDto } from './dto/import.dto'
import { ImportFileService } from './import-file.service'
import { ImportQueueService } from './import-queue.service'
import { toImportJobDetail, toImportJobSummary } from './import.mapper'

const detailInclude = {
  items: {
    include: { optimization: { select: { id: true } } },
    orderBy: { rowNumber: 'asc' as const },
  },
} as const

export interface ImportSubmission {
  worksheet?: string
  headerRow: number
  mapping: ImportMapping
  mode: ImportMode
  targetLanguage?: 'en-US' | 'es-ES' | 'pt-BR'
  idempotencyKey: string
}

@Injectable()
export class ImportJobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly merchantAccess: MerchantAccessService,
    private readonly files: ImportFileService,
    private readonly queue: ImportQueueService,
  ) {}

  async analyze(
    actor: AuthenticatedUser,
    merchantId: string,
    file: Express.Multer.File,
    headerRow: number,
  ) {
    await this.merchantAccess.assertAccess(actor, merchantId)
    return this.files.analyze(file, headerRow)
  }

  async preview(
    actor: AuthenticatedUser,
    merchantId: string,
    file: Express.Multer.File,
    worksheet: string | undefined,
    headerRow: number,
    mapping: ImportMapping,
  ): Promise<ImportPreview> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    const rows = await this.files.mappedRows(
      file,
      worksheet,
      headerRow,
      mapping,
    )
    if (rows.length === 0)
      throw new BadRequestException('文件没有可导入的数据行')
    const checked = await this.checkBusinessRisks(merchantId, rows)
    return {
      fileHash: this.files.hash(file.buffer),
      totalRows: checked.length,
      validRows: checked.filter((row) => row.valid).length,
      invalidRows: checked.filter((row) => !row.valid).length,
      warningRows: checked.filter((row) => row.warnings.length > 0).length,
      rows: checked,
    }
  }

  async create(
    actor: AuthenticatedUser,
    merchantId: string,
    file: Express.Multer.File,
    submission: ImportSubmission,
  ): Promise<ImportJobDetail> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    this.assertSubmission(submission)
    const preview = await this.preview(
      actor,
      merchantId,
      file,
      submission.worksheet,
      submission.headerRow,
      submission.mapping,
    )
    const existing = await this.prisma.importJob.findUnique({
      where: {
        merchantId_idempotencyKey: {
          merchantId,
          idempotencyKey: submission.idempotencyKey,
        },
      },
      include: detailInclude,
    })
    if (existing) {
      if (
        existing.fileHash !== preview.fileHash ||
        existing.mode !== submission.mode ||
        existing.targetLanguage !== (submission.targetLanguage ?? null) ||
        !this.sameMapping(existing.mapping, submission.mapping)
      ) {
        throw new ConflictException('幂等键已用于不同的导入参数')
      }
      await this.enqueuePending(existing.items)
      return toImportJobDetail(existing)
    }

    const validRows = preview.rows.filter((row) => row.valid)
    const invalidRows = preview.rows.length - validRows.length
    const job = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.importJob.create({
        data: {
          merchantId,
          createdById: actor.id,
          idempotencyKey: submission.idempotencyKey,
          fileName: file.originalname,
          fileHash: preview.fileHash,
          fileType: file.originalname.toLowerCase().endsWith('.csv')
            ? 'csv'
            : 'xlsx',
          worksheet: submission.worksheet,
          headerRow: submission.headerRow,
          mapping: asJson(submission.mapping),
          mode: submission.mode,
          targetLanguage: submission.targetLanguage,
          status: validRows.length === 0 ? 'PARTIAL_FAILED' : 'PENDING',
          totalItems: preview.totalRows,
          validItems: validRows.length,
          invalidItems: invalidRows,
          failedItems: invalidRows,
          ...(validRows.length === 0 ? { completedAt: new Date() } : {}),
          items: {
            create: preview.rows.map((row) => ({
              rowNumber: row.rowNumber,
              status: row.valid ? 'PENDING' : 'VALIDATION_FAILED',
              sourceData: asJson(row.source),
              normalizedData: row.normalized
                ? asJson(row.normalized)
                : undefined,
              warnings: asJson(row.warnings),
              error: row.errors.join('；') || undefined,
            })),
          },
        },
        include: detailInclude,
      })
      await transaction.auditLog.create({
        data: {
          merchantId,
          actorUserId: actor.id,
          entityType: 'IMPORT_JOB',
          entityId: created.id,
          action: 'CREATE',
          afterData: asJson({
            fileName: created.fileName,
            fileHash: created.fileHash,
            mode: created.mode,
            totalItems: created.totalItems,
            validItems: created.validItems,
            invalidItems: created.invalidItems,
          }),
        },
      })
      return created
    })
    await this.enqueuePending(job.items)
    return toImportJobDetail(job)
  }

  async list(
    actor: AuthenticatedUser,
    merchantId: string,
    query: ImportJobQueryDto,
  ): Promise<PaginatedImportJobs> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    const where = {
      merchantId,
      ...(query.status ? { status: query.status } : {}),
    }
    const [records, total] = await this.prisma.$transaction([
      this.prisma.importJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.importJob.count({ where }),
    ])
    return {
      items: records.map(toImportJobSummary),
      page: query.page,
      pageSize: query.pageSize,
      total,
    }
  }

  async get(
    actor: AuthenticatedUser,
    merchantId: string,
    jobId: string,
  ): Promise<ImportJobDetail> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    const job = await this.prisma.importJob.findFirst({
      where: { id: jobId, merchantId },
      include: detailInclude,
    })
    if (!job) throw new NotFoundException('导入任务不存在')
    return toImportJobDetail(job)
  }

  async cancel(
    actor: AuthenticatedUser,
    merchantId: string,
    jobId: string,
  ): Promise<ImportJobDetail> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    const current = await this.prisma.importJob.findFirst({
      where: { id: jobId, merchantId },
      include: detailInclude,
    })
    if (!current) throw new NotFoundException('导入任务不存在')
    if (['COMPLETED', 'PARTIAL_FAILED', 'CANCELLED'].includes(current.status))
      return toImportJobDetail(current)
    const pending = current.items
      .filter((item) => item.status === 'PENDING')
      .map((item) => item.id)
    await this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.importItem.updateMany({
        where: { jobId, status: 'PENDING' },
        data: {
          status: 'CANCELLED',
          completedAt: new Date(),
          error: '任务已由用户取消',
        },
      })
      await transaction.importJob.update({
        where: { id: jobId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledItems: { increment: changed.count },
        },
      })
      await transaction.auditLog.create({
        data: {
          merchantId,
          actorUserId: actor.id,
          entityType: 'IMPORT_JOB',
          entityId: jobId,
          action: 'CANCEL',
          afterData: asJson({ cancelledItems: changed.count }),
        },
      })
    })
    try {
      await this.queue.cancelWaiting(pending)
    } catch {
      // MySQL is authoritative.
    }
    return this.get(actor, merchantId, jobId)
  }

  async failuresCsv(
    actor: AuthenticatedUser,
    merchantId: string,
    jobId: string,
  ): Promise<string> {
    const job = await this.get(actor, merchantId, jobId)
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`
    return [
      ['rowNumber', 'productCode', 'skuCode', 'status', 'error'].join(','),
      ...job.items
        .filter((item) =>
          ['VALIDATION_FAILED', 'FAILED', 'CANCELLED'].includes(item.status),
        )
        .map((item) =>
          [
            String(item.rowNumber),
            escape(item.productCode ?? ''),
            escape(item.skuCode ?? ''),
            item.status,
            escape(item.error ?? ''),
          ].join(','),
        ),
    ].join('\r\n')
  }

  private async checkBusinessRisks(
    merchantId: string,
    rows: ImportPreviewRow[],
  ): Promise<ImportPreviewRow[]> {
    const normalized = rows.flatMap((row) =>
      row.normalized ? [row.normalized] : [],
    )
    const [products, skus] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          merchantId,
          code: { in: normalized.map((row) => row.productCode) },
        },
        select: { id: true, code: true, status: true },
      }),
      this.prisma.sku.findMany({
        where: {
          merchantId,
          code: { in: normalized.map((row) => row.skuCode) },
        },
        select: { code: true, product: { select: { code: true } } },
      }),
    ])
    const productByCode = new Map(
      products.map((product) => [product.code, product]),
    )
    const skuByCode = new Map(skus.map((sku) => [sku.code, sku]))
    const seenSku = new Set<string>()
    const titleByProduct = new Map<string, string>()
    return rows.map((row) => {
      if (!row.normalized) return row
      const errors = [...row.errors]
      const warnings = [...row.warnings]
      const product = productByCode.get(row.normalized.productCode)
      if (product?.status !== undefined) {
        if (product.status === 'DRAFT')
          warnings.push('同编码商品草稿已存在，将覆盖草稿字段')
        else errors.push('同编码正式商品已存在，不允许覆盖')
      }
      const sku = skuByCode.get(row.normalized.skuCode)
      if (sku) {
        if (sku.product.code === row.normalized.productCode)
          warnings.push('同编码 SKU 已存在，将同步名称、价格和库存')
        else errors.push('SKU 编码已属于当前商家的其他商品')
      }
      if (seenSku.has(row.normalized.skuCode))
        errors.push('文件内 SKU 编码重复')
      seenSku.add(row.normalized.skuCode)
      const previousTitle = titleByProduct.get(row.normalized.productCode)
      if (previousTitle && previousTitle !== row.normalized.title)
        errors.push('同一商品编码在文件中使用了不同标题')
      titleByProduct.set(row.normalized.productCode, row.normalized.title)
      return { ...row, valid: errors.length === 0, errors, warnings }
    })
  }

  private assertSubmission(submission: ImportSubmission): void {
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(submission.idempotencyKey))
      throw new BadRequestException('幂等键格式无效')
    if (submission.mode === 'DRAFT_AND_AI' && !submission.targetLanguage)
      throw new BadRequestException('创建 AI 优化任务时必须选择目标语言')
  }

  private sameMapping(value: unknown, expected: ImportMapping): boolean {
    if (typeof value !== 'object' || value === null) return false
    const candidate = value as Record<string, unknown>
    return Object.entries(expected).every(
      ([key, column]) => candidate[key] === column,
    )
  }

  private async enqueuePending(
    items: Array<{ id: string; status: string }>,
  ): Promise<void> {
    const pending = items.filter((item) => item.status === 'PENDING')
    if (pending.length === 0) return
    try {
      await this.queue.enqueue(pending)
    } catch {
      throw new ServiceUnavailableException(
        '导入任务入队失败，请使用相同幂等键重试',
      )
    }
  }
}
