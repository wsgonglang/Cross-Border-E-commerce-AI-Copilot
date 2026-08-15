import type { AiResultItem } from '@cross-border/shared'

export function getDashboardResultPath(
  item: AiResultItem,
  merchantId: string,
): string {
  if (item.product && item.optimizationId) {
    const params = new URLSearchParams({
      merchantId,
      productId: item.product.id,
      optimizationId: item.optimizationId,
      keyword: item.product.code,
    })
    return `/products?${params.toString()}`
  }

  if (item.agentRunId) {
    const params = new URLSearchParams({
      merchantId,
      agentRunId: item.agentRunId,
    })
    return `/ai-results?${params.toString()}`
  }

  if (item.batchTaskId) {
    const params = new URLSearchParams({
      merchantId,
      taskId: item.batchTaskId,
    })
    return `/batch-tasks?${params.toString()}`
  }

  if (item.importJobId) {
    return `/imports?jobId=${encodeURIComponent(item.importJobId)}`
  }

  return '/ai-results'
}
