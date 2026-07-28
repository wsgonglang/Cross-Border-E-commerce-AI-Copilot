import { z } from 'zod'

export const OPTIMIZATION_LANGUAGES = ['en-US', 'es-ES', 'pt-BR'] as const
export const OPTIMIZATION_STATUSES = [
  'GENERATING',
  'DRAFT',
  'APPLIED',
  'REJECTED',
  'ERROR',
] as const

export const productOptimizationDraftSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).max(10_000),
  sellingPoints: z.array(z.string().trim().min(1).max(500)).min(1).max(8),
  complianceRisks: z.array(z.string().trim().min(1).max(500)).max(10),
  suggestions: z.array(z.string().trim().min(1).max(500)).max(10),
  language: z.string().trim().min(2).max(16),
  confidence: z.number().min(0).max(1),
})

export type OptimizationLanguage = (typeof OPTIMIZATION_LANGUAGES)[number]
export type OptimizationStatus = (typeof OPTIMIZATION_STATUSES)[number]
export type ProductOptimizationDraft = z.infer<
  typeof productOptimizationDraftSchema
>

export interface ProductOptimizationSource {
  title: string
  description: string
  sellingPoints: string[]
  language: string
  version: number
}

export interface AiUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface ProductOptimizationSummary {
  id: string
  merchantId: string
  productId: string
  requestedById: string
  status: OptimizationStatus
  targetLanguage: OptimizationLanguage
  source: ProductOptimizationSource
  draft?: ProductOptimizationDraft
  providerName?: string
  modelName?: string
  usage: AiUsage
  error?: string
  appliedAt?: string
  createdAt: string
  updatedAt: string
}
