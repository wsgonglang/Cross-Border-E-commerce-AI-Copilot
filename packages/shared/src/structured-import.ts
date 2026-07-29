export const IMPORT_FIELD_KEYS = [
  'productCode',
  'title',
  'description',
  'language',
  'skuCode',
  'skuName',
  'price',
  'currency',
  'stock',
] as const

export type ImportFieldKey = (typeof IMPORT_FIELD_KEYS)[number]
export type ImportMode = 'DRAFT_ONLY' | 'DRAFT_AND_AI'
export type ImportJobStatus =
  'PENDING' | 'RUNNING' | 'COMPLETED' | 'PARTIAL_FAILED' | 'CANCELLED'
export type ImportItemStatus =
  | 'VALIDATION_FAILED'
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'

export type ImportMapping = Record<ImportFieldKey, string>

export interface ImportWorksheetAnalysis {
  name: string
  rowCount: number
  headers: string[]
  sampleRows: Array<Record<string, string>>
}

export interface ImportFileAnalysis {
  fileName: string
  fileHash: string
  fileType: 'csv' | 'xlsx'
  worksheets: ImportWorksheetAnalysis[]
}

export interface NormalizedImportRow {
  productCode: string
  title: string
  description: string
  language: string
  skuCode: string
  skuName: string
  price: string
  currency: string
  stock: number
}

export interface ImportPreviewRow {
  rowNumber: number
  source: Record<string, string>
  normalized?: NormalizedImportRow
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface ImportPreview {
  fileHash: string
  totalRows: number
  validRows: number
  invalidRows: number
  warningRows: number
  rows: ImportPreviewRow[]
}

export interface ImportItemSummary {
  id: string
  rowNumber: number
  status: ImportItemStatus
  productCode?: string
  skuCode?: string
  productId?: string
  optimizationId?: string
  warnings: string[]
  error?: string
  attempts: number
}

export interface ImportJobSummary {
  id: string
  fileName: string
  fileHash: string
  mode: ImportMode
  targetLanguage?: string
  status: ImportJobStatus
  totalItems: number
  validItems: number
  invalidItems: number
  completedItems: number
  failedItems: number
  cancelledItems: number
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface ImportJobDetail extends ImportJobSummary {
  worksheet?: string
  headerRow: number
  mapping: ImportMapping
  items: ImportItemSummary[]
}

export interface PaginatedImportJobs {
  items: ImportJobSummary[]
  page: number
  pageSize: number
  total: number
}
