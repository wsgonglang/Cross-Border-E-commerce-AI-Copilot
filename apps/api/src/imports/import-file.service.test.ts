import { BadRequestException } from '@nestjs/common'
import type { ImportMapping } from '@cross-border/shared'
import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'

import { ImportFileService } from './import-file.service'

const mapping: ImportMapping = {
  productCode: 'product_code',
  title: 'title',
  description: 'description',
  language: 'language',
  skuCode: 'sku_code',
  skuName: 'sku_name',
  price: 'price',
  currency: 'currency',
  stock: 'stock',
}

function file(name: string, buffer: Buffer): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: name,
    encoding: '7bit',
    mimetype: 'application/octet-stream',
    size: buffer.length,
    buffer,
    destination: '',
    filename: name,
    path: '',
    stream: undefined as never,
  }
}

describe('ImportFileService', () => {
  it('analyzes CSV and validates each mapped row without persistence', async () => {
    const service = new ImportFileService()
    const csv = [
      'product_code,title,description,language,sku_code,sku_name,price,currency,stock',
      'P-IMPORT-1,Travel Charger,Demo,en-US,SKU-IMPORT-1,US,29.99,USD,5',
      'bad,Invalid,Demo,en-US,SKU-IMPORT-2,US,-1,USD,-2',
    ].join('\n')
    const uploaded = file('products.csv', Buffer.from(csv))

    const analysis = await service.analyze(uploaded)
    const rows = await service.mappedRows(uploaded, 'CSV', 1, mapping)

    expect(analysis.worksheets[0]?.headers).toContain('product_code')
    expect(analysis.fileHash).toHaveLength(64)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ rowNumber: 2, valid: true })
    expect(rows[1]?.valid).toBe(false)
    expect(rows[1]?.errors).toContain('价格必须为非负数且最多两位小数')
  })

  it('rejects formulas instead of executing XLSX cell expressions', async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Products')
    sheet.addRow(Object.values(mapping))
    sheet.addRow([
      { formula: '1+1', result: 'P-IMPORT-1' },
      'Title',
      'Description',
      'en-US',
      'SKU-IMPORT-1',
      'US',
      '29.99',
      'USD',
      5,
    ])
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
    const rows = await new ImportFileService().mappedRows(
      file('products.xlsx', buffer),
      'Products',
      1,
      mapping,
    )

    expect(rows[0]?.valid).toBe(false)
    expect(rows[0]?.errors[0]).toContain('不支持公式')
  })

  it('rejects unsupported file formats', async () => {
    await expect(
      new ImportFileService().analyze(file('products.xls', Buffer.from('x'))),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})
