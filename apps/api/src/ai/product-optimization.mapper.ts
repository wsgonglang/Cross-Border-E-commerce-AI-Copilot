import {
  productOptimizationDraftSchema,
  type OptimizationLanguage,
  type OptimizationStatus,
  type ProductOptimizationSource,
  type ProductOptimizationSummary,
} from '@cross-border/shared'

interface OptimizationSource {
  id: string
  merchantId: string
  productId: string
  requestedById: string
  status: string
  targetLanguage: string
  sourceData: unknown
  draftData: unknown
  providerName: string | null
  modelName: string | null
  promptVersion: string | null
  errorCode: string | null
  promptTokens: number
  completionTokens: number
  totalTokens: number
  error: string | null
  appliedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

function parseSource(value: unknown): ProductOptimizationSource {
  if (typeof value !== 'object' || value === null) {
    throw new Error('商品优化源快照无效')
  }
  const source = value as Record<string, unknown>
  if (
    typeof source.title !== 'string' ||
    typeof source.description !== 'string' ||
    !Array.isArray(source.sellingPoints) ||
    typeof source.language !== 'string' ||
    typeof source.version !== 'number'
  ) {
    throw new Error('商品优化源快照字段不完整')
  }
  return {
    title: source.title,
    description: source.description,
    sellingPoints: source.sellingPoints.filter(
      (item): item is string => typeof item === 'string',
    ),
    language: source.language,
    version: source.version,
  }
}

export function toProductOptimizationSummary(
  source: OptimizationSource,
): ProductOptimizationSummary {
  return {
    id: source.id,
    merchantId: source.merchantId,
    productId: source.productId,
    requestedById: source.requestedById,
    status: source.status as OptimizationStatus,
    targetLanguage: source.targetLanguage as OptimizationLanguage,
    source: parseSource(source.sourceData),
    draft: source.draftData
      ? productOptimizationDraftSchema.parse(source.draftData)
      : undefined,
    providerName: source.providerName ?? undefined,
    modelName: source.modelName ?? undefined,
    promptVersion: source.promptVersion ?? undefined,
    errorCode: source.errorCode ?? undefined,
    usage: {
      promptTokens: source.promptTokens,
      completionTokens: source.completionTokens,
      totalTokens: source.totalTokens,
    },
    error: source.error ?? undefined,
    appliedAt: source.appliedAt?.toISOString(),
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  }
}
