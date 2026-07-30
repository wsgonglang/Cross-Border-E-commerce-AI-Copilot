import type {
  AiQualityWindowDays,
  AiResultType,
  OrderFilters,
  OrderSortField,
  OrderSortOrder,
  ProductStatus,
} from '@cross-border/shared'

export interface ProductQueryInput {
  keyword?: string
  page: number
  pageSize: number
  status?: ProductStatus
  storeId?: string
}

export interface OrderQueryInput extends OrderFilters {
  page: number
  pageSize: number
  sortBy: OrderSortField
  sortOrder: OrderSortOrder
  storeId?: string
}

export interface AiResultsQueryInput {
  page: number
  pageSize: number
  status?: string
  type?: AiResultType
}

export const queryKeys = {
  merchants: ['merchants'] as const,
  stores: (merchantId: string) => ['stores', merchantId] as const,
  productsRoot: (merchantId: string) => ['products', merchantId] as const,
  products: (merchantId: string, input: ProductQueryInput) =>
    [...queryKeys.productsRoot(merchantId), input] as const,
  ordersRoot: (merchantId: string) => ['orders', merchantId] as const,
  orders: (merchantId: string, input: OrderQueryInput) =>
    [...queryKeys.ordersRoot(merchantId), input] as const,
  batchTasksRoot: (merchantId: string) => ['batch-tasks', merchantId] as const,
  batchTasks: (merchantId: string, page: number) =>
    [...queryKeys.batchTasksRoot(merchantId), { page }] as const,
  batchTask: (merchantId: string, taskId: string) =>
    [...queryKeys.batchTasksRoot(merchantId), 'detail', taskId] as const,
  importJobsRoot: (merchantId: string) => ['import-jobs', merchantId] as const,
  importJobs: (merchantId: string) =>
    [...queryKeys.importJobsRoot(merchantId), 'list'] as const,
  importJob: (merchantId: string, jobId: string) =>
    [...queryKeys.importJobsRoot(merchantId), 'detail', jobId] as const,
  aiResultsRoot: (merchantId: string) => ['ai-results', merchantId] as const,
  aiResults: (merchantId: string, input: AiResultsQueryInput) =>
    [...queryKeys.aiResultsRoot(merchantId), input] as const,
  agentRun: (merchantId: string, runId: string) =>
    ['agent-run', merchantId, runId] as const,
  aiQuality: (merchantId: string, days: AiQualityWindowDays) =>
    ['ai-quality', merchantId, { days }] as const,
}
