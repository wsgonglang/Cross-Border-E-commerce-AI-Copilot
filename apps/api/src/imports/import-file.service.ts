import { BadRequestException, Injectable } from '@nestjs/common'
import type {
  ImportFileAnalysis,
  ImportMapping,
  ImportPreviewRow,
  NormalizedImportRow,
} from '@cross-border/shared'
import { parse as parseCsv } from 'csv-parse/sync'
import ExcelJS from 'exceljs'
import { createHash } from 'node:crypto'
import { extname } from 'node:path'

const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_WORKSHEETS = 10
const MAX_ROWS = 1_000
const MAX_COLUMNS = 80

interface ParsedSheet {
  name: string
  rows: Array<{ values: string[]; hasFormula: boolean }>
}

@Injectable()
export class ImportFileService {
  async analyze(
    file: Express.Multer.File,
    headerRow = 1,
  ): Promise<ImportFileAnalysis> {
    const parsed = await this.parse(file)
    this.assertHeaderRow(headerRow)
    return {
      fileName: file.originalname,
      fileHash: this.hash(file.buffer),
      fileType: this.fileType(file),
      worksheets: parsed.map((sheet) => {
        const headers = this.headers(sheet, headerRow)
        return {
          name: sheet.name,
          rowCount: Math.max(0, sheet.rows.length - headerRow),
          headers,
          sampleRows: sheet.rows
            .slice(headerRow, headerRow + 5)
            .map((row) => this.toSource(headers, row.values)),
        }
      }),
    }
  }

  async mappedRows(
    file: Express.Multer.File,
    worksheet: string | undefined,
    headerRow: number,
    mapping: ImportMapping,
  ): Promise<ImportPreviewRow[]> {
    this.assertHeaderRow(headerRow)
    const sheets = await this.parse(file)
    const sheet = worksheet
      ? sheets.find((candidate) => candidate.name === worksheet)
      : sheets[0]
    if (!sheet) throw new BadRequestException('工作表不存在')
    const headers = this.headers(sheet, headerRow)
    const missingHeaders = Object.values(mapping).filter(
      (header) => !headers.includes(header),
    )
    if (missingHeaders.length > 0) {
      throw new BadRequestException(
        `字段映射包含不存在的表头：${[...new Set(missingHeaders)].join('、')}`,
      )
    }

    return sheet.rows
      .slice(headerRow)
      .map((row, index) => {
        const source = this.toSource(headers, row.values)
        const rowNumber = headerRow + index + 1
        if (row.hasFormula) {
          return {
            rowNumber,
            source,
            valid: false,
            errors: ['不支持公式、宏或外部链接，请先转换为静态值'],
            warnings: [],
          }
        }
        const value = (field: keyof ImportMapping) =>
          (source[mapping[field]] ?? '').trim()
        const stockText = value('stock')
        const normalized: NormalizedImportRow = {
          productCode: value('productCode').toUpperCase(),
          title: value('title'),
          description: value('description'),
          language: value('language') || 'zh-CN',
          skuCode: value('skuCode').toUpperCase(),
          skuName: value('skuName'),
          price: value('price'),
          currency: value('currency').toUpperCase(),
          stock: Number(stockText),
        }
        const errors = this.validate(normalized, stockText)
        return {
          rowNumber,
          source,
          normalized,
          valid: errors.length === 0,
          errors,
          warnings: [],
        }
      })
      .filter((row) =>
        Object.values(row.source).some((value) => value.trim().length > 0),
      )
  }

  hash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex')
  }

  private validate(row: NormalizedImportRow, stockText: string): string[] {
    const errors: string[] = []
    if (!/^[A-Z0-9][A-Z0-9_-]{1,63}$/.test(row.productCode))
      errors.push('商品编码格式无效')
    if (!row.title || row.title.length > 255)
      errors.push('商品标题必填且最多 255 字')
    if (row.description.length > 10_000) errors.push('商品描述最多 10000 字')
    if (!/^[a-z]{2}(?:-[A-Z]{2})?$/.test(row.language))
      errors.push('语言必须使用 zh-CN、en-US 等格式')
    if (!/^[A-Z0-9][A-Z0-9_-]{1,63}$/.test(row.skuCode))
      errors.push('SKU 编码格式无效')
    if (!row.skuName || row.skuName.length > 120)
      errors.push('SKU 名称必填且最多 120 字')
    if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(row.price))
      errors.push('价格必须为非负数且最多两位小数')
    if (!/^[A-Z]{3}$/.test(row.currency)) errors.push('币种必须为三位大写代码')
    if (
      !/^\d+$/.test(stockText) ||
      !Number.isInteger(row.stock) ||
      row.stock < 0 ||
      row.stock > 1_000_000
    )
      errors.push('库存必须为 0 至 1000000 的整数')
    return errors
  }

  private async parse(file: Express.Multer.File): Promise<ParsedSheet[]> {
    if (!file?.buffer) throw new BadRequestException('请选择导入文件')
    if (file.size > MAX_FILE_BYTES)
      throw new BadRequestException('文件不能超过 5MB')
    const type = this.fileType(file)
    if (type === 'csv') {
      const records = parseCsv(file.buffer, {
        bom: true,
        relaxColumnCount: true,
        skipEmptyLines: false,
      }) as unknown[][]
      this.assertSize(
        1,
        records.length,
        Math.max(0, ...records.map((row) => row.length)),
      )
      return [
        {
          name: 'CSV',
          rows: records.map((record) => ({
            values: record.map((value) => this.primitiveText(value)),
            hasFormula: false,
          })),
        },
      ]
    }

    const workbook = new ExcelJS.Workbook()
    const arrayBuffer = file.buffer.buffer.slice(
      file.buffer.byteOffset,
      file.buffer.byteOffset + file.buffer.byteLength,
    ) as ArrayBuffer
    await workbook.xlsx.load(arrayBuffer)
    this.assertSize(
      workbook.worksheets.length,
      Math.max(0, ...workbook.worksheets.map((sheet) => sheet.rowCount)),
      Math.max(0, ...workbook.worksheets.map((sheet) => sheet.columnCount)),
    )
    return workbook.worksheets.map((sheet) => ({
      name: sheet.name,
      rows: Array.from({ length: sheet.rowCount }, (_, index) => {
        const row = sheet.getRow(index + 1)
        let hasFormula = false
        const values = Array.from(
          { length: sheet.columnCount },
          (_item, column) => {
            const value = row.getCell(column + 1).value
            if (
              typeof value === 'object' &&
              value !== null &&
              'formula' in value
            ) {
              hasFormula = true
              return ''
            }
            if (value instanceof Date) return value.toISOString()
            if (typeof value === 'object' && value !== null && 'text' in value)
              return String(value.text)
            return this.primitiveText(value)
          },
        )
        return { values, hasFormula }
      }),
    }))
  }

  private fileType(file: Express.Multer.File): 'csv' | 'xlsx' {
    const extension = extname(file.originalname).toLowerCase()
    if (extension === '.csv') return 'csv'
    if (extension === '.xlsx') return 'xlsx'
    throw new BadRequestException('仅支持 .csv 和 .xlsx 文件')
  }

  private assertSize(sheets: number, rows: number, columns: number): void {
    if (sheets > MAX_WORKSHEETS)
      throw new BadRequestException(`工作表不能超过 ${MAX_WORKSHEETS} 个`)
    if (rows > MAX_ROWS + 20)
      throw new BadRequestException(`数据行不能超过 ${MAX_ROWS} 行`)
    if (columns > MAX_COLUMNS)
      throw new BadRequestException(`列数不能超过 ${MAX_COLUMNS} 列`)
  }

  private assertHeaderRow(headerRow: number): void {
    if (!Number.isInteger(headerRow) || headerRow < 1 || headerRow > 20)
      throw new BadRequestException('表头行必须在 1 至 20 之间')
  }

  private headers(sheet: ParsedSheet, headerRow: number): string[] {
    const values = sheet.rows[headerRow - 1]?.values ?? []
    const headers = values.map((value) => value.trim())
    if (headers.length === 0 || headers.every((header) => !header))
      throw new BadRequestException('所选表头行为空')
    if (
      new Set(headers.filter(Boolean)).size !== headers.filter(Boolean).length
    )
      throw new BadRequestException('表头不能重复')
    return headers.map((header, index) => header || `未命名列${index + 1}`)
  }

  private toSource(
    headers: string[],
    values: string[],
  ): Record<string, string> {
    return Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? '']),
    )
  }

  private primitiveText(value: unknown): string {
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean')
      return String(value)
    return ''
  }
}
