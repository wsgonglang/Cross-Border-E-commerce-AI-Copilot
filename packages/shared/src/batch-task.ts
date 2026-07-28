import type { OptimizationLanguage } from './product-optimization'

export const BATCH_TASK_STATUSES = [
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'PARTIAL_FAILED',
  'CANCELLED',
] as const

export const BATCH_TASK_ITEM_STATUSES = [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const

export type BatchTaskStatus = (typeof BATCH_TASK_STATUSES)[number]
export type BatchTaskItemStatus = (typeof BATCH_TASK_ITEM_STATUSES)[number]

export interface BatchTaskItemSummary {
  id: string
  productId: string
  productCode: string
  productTitle: string
  status: BatchTaskItemStatus
  attempts: number
  optimizationId?: string
  error?: string
  startedAt?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
}

export interface BatchTaskSummary {
  id: string
  merchantId: string
  createdById: string
  idempotencyKey: string
  targetLanguage: OptimizationLanguage
  status: BatchTaskStatus
  totalItems: number
  completedItems: number
  failedItems: number
  cancelledItems: number
  progress: number
  startedAt?: string
  completedAt?: string
  cancelledAt?: string
  createdAt: string
  updatedAt: string
}

export interface BatchTaskDetail extends BatchTaskSummary {
  items: BatchTaskItemSummary[]
}

export interface PaginatedBatchTasks {
  items: BatchTaskSummary[]
  total: number
  page: number
  pageSize: number
}
