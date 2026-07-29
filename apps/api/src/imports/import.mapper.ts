import type {
  ImportItemSummary,
  ImportJobDetail,
  ImportJobSummary,
  ImportMapping,
  NormalizedImportRow,
} from '@cross-border/shared'

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

export function toImportJobSummary(record: {
  id: string
  fileName: string
  fileHash: string
  mode: string
  targetLanguage: string | null
  status: string
  totalItems: number
  validItems: number
  invalidItems: number
  completedItems: number
  failedItems: number
  cancelledItems: number
  createdAt: Date
  updatedAt: Date
  completedAt: Date | null
}): ImportJobSummary {
  return {
    id: record.id,
    fileName: record.fileName,
    fileHash: record.fileHash,
    mode: record.mode as ImportJobSummary['mode'],
    targetLanguage: record.targetLanguage ?? undefined,
    status: record.status as ImportJobSummary['status'],
    totalItems: record.totalItems,
    validItems: record.validItems,
    invalidItems: record.invalidItems,
    completedItems: record.completedItems,
    failedItems: record.failedItems,
    cancelledItems: record.cancelledItems,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    completedAt: record.completedAt?.toISOString(),
  }
}

export function toImportItemSummary(record: {
  id: string
  rowNumber: number
  status: string
  normalizedData: unknown
  productId: string | null
  warnings: unknown
  error: string | null
  attempts: number
  optimization?: { id: string } | null
}): ImportItemSummary {
  const normalized =
    typeof record.normalizedData === 'object' && record.normalizedData !== null
      ? (record.normalizedData as Partial<NormalizedImportRow>)
      : {}
  return {
    id: record.id,
    rowNumber: record.rowNumber,
    status: record.status as ImportItemSummary['status'],
    productCode: normalized.productCode,
    skuCode: normalized.skuCode,
    productId: record.productId ?? undefined,
    optimizationId: record.optimization?.id,
    warnings: strings(record.warnings),
    error: record.error ?? undefined,
    attempts: record.attempts,
  }
}

export function toImportJobDetail(
  record: Parameters<typeof toImportJobSummary>[0] & {
    worksheet: string | null
    headerRow: number
    mapping: unknown
    items: Array<Parameters<typeof toImportItemSummary>[0]>
  },
): ImportJobDetail {
  return {
    ...toImportJobSummary(record),
    worksheet: record.worksheet ?? undefined,
    headerRow: record.headerRow,
    mapping: record.mapping as ImportMapping,
    items: record.items.map(toImportItemSummary),
  }
}
