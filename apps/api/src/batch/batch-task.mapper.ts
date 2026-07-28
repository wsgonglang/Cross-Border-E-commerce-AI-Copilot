import type {
  BatchTaskDetail,
  BatchTaskItemStatus,
  BatchTaskStatus,
  BatchTaskSummary,
  OptimizationLanguage,
} from '@cross-border/shared'

interface TaskSource {
  id: string
  merchantId: string
  createdById: string
  idempotencyKey: string
  targetLanguage: string
  status: string
  totalItems: number
  completedItems: number
  failedItems: number
  cancelledItems: number
  startedAt: Date | null
  completedAt: Date | null
  cancelledAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface TaskDetailSource extends TaskSource {
  items: Array<{
    id: string
    productId: string
    status: string
    attempts: number
    error: string | null
    startedAt: Date | null
    completedAt: Date | null
    createdAt: Date
    updatedAt: Date
    product: { code: string; title: string }
    optimization: { id: string } | null
  }>
}

export function toBatchTaskSummary(source: TaskSource): BatchTaskSummary {
  const processed =
    source.completedItems + source.failedItems + source.cancelledItems
  return {
    id: source.id,
    merchantId: source.merchantId,
    createdById: source.createdById,
    idempotencyKey: source.idempotencyKey,
    targetLanguage: source.targetLanguage as OptimizationLanguage,
    status: source.status as BatchTaskStatus,
    totalItems: source.totalItems,
    completedItems: source.completedItems,
    failedItems: source.failedItems,
    cancelledItems: source.cancelledItems,
    progress:
      source.totalItems === 0
        ? 0
        : Math.round((processed / source.totalItems) * 100),
    startedAt: source.startedAt?.toISOString(),
    completedAt: source.completedAt?.toISOString(),
    cancelledAt: source.cancelledAt?.toISOString(),
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  }
}

export function toBatchTaskDetail(source: TaskDetailSource): BatchTaskDetail {
  return {
    ...toBatchTaskSummary(source),
    items: source.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productCode: item.product.code,
      productTitle: item.product.title,
      status: item.status as BatchTaskItemStatus,
      attempts: item.attempts,
      optimizationId: item.optimization?.id,
      error: item.error ?? undefined,
      startedAt: item.startedAt?.toISOString(),
      completedAt: item.completedAt?.toISOString(),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  }
}
