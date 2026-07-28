import type {
  BatchTaskDetail,
  OptimizationLanguage,
  PaginatedBatchTasks,
} from '@cross-border/shared'

import { apiRequest } from './client'

function basePath(merchantId: string): string {
  return `/api/merchants/${merchantId}/ai/batch-tasks`
}

export function getBatchTasks(
  token: string,
  merchantId: string,
  page = 1,
  pageSize = 20,
): Promise<PaginatedBatchTasks> {
  return apiRequest(
    token,
    `${basePath(merchantId)}?page=${page}&pageSize=${pageSize}`,
  )
}

export function getBatchTask(
  token: string,
  merchantId: string,
  taskId: string,
): Promise<BatchTaskDetail> {
  return apiRequest(token, `${basePath(merchantId)}/${taskId}`)
}

export function createBatchTask(
  token: string,
  merchantId: string,
  input: {
    productIds: string[]
    targetLanguage: OptimizationLanguage
    idempotencyKey: string
  },
): Promise<BatchTaskDetail> {
  return apiRequest(token, basePath(merchantId), {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function cancelBatchTask(
  token: string,
  merchantId: string,
  taskId: string,
): Promise<BatchTaskDetail> {
  return apiRequest(token, `${basePath(merchantId)}/${taskId}/cancel`, {
    method: 'POST',
  })
}
