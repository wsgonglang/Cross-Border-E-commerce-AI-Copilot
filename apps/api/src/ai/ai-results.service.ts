import { Injectable } from '@nestjs/common'
import type {
  AiResultItem,
  AuthenticatedUser,
  PaginatedAiResults,
} from '@cross-border/shared'

import { MerchantAccessService } from '../commerce/merchant-access.service'
import { PrismaService } from '../database/prisma.service'
import type { AiResultsQueryDto } from './dto/agent.dto'

@Injectable()
export class AiResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly merchantAccess: MerchantAccessService,
  ) {}

  async list(
    actor: AuthenticatedUser,
    merchantId: string,
    query: AiResultsQueryDto,
  ): Promise<PaginatedAiResults> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    const agentStatus = (
      ['PLANNING', 'RUNNING', 'COMPLETED', 'FAILED'] as const
    ).find((status) => status === query.status)
    const optimizationStatus = (
      ['GENERATING', 'DRAFT', 'APPLIED', 'REJECTED', 'ERROR'] as const
    ).find((status) => status === query.status)
    const [runs, optimizations] = await Promise.all([
      query.type === 'PRODUCT_OPTIMIZATION'
        ? Promise.resolve([])
        : this.prisma.agentRun.findMany({
            where: {
              merchantId,
              ...(query.status
                ? agentStatus
                  ? { status: agentStatus }
                  : { id: '__no_matching_agent_run__' }
                : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: 200,
          }),
      query.type === 'AGENT_RUN'
        ? Promise.resolve([])
        : this.prisma.productOptimization.findMany({
            where: {
              merchantId,
              ...(query.status
                ? optimizationStatus
                  ? { status: optimizationStatus }
                  : { id: '__no_matching_optimization__' }
                : {}),
            },
            include: {
              product: { select: { id: true, code: true, title: true } },
              batchItem: { select: { taskId: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 200,
          }),
    ])

    const items: AiResultItem[] = [
      ...runs.map((run) => ({
        id: `agent:${run.id}`,
        type: 'AGENT_RUN' as const,
        status: run.status,
        title: run.message,
        description: run.answer ?? run.error ?? 'Agent 正在执行',
        createdAt: run.createdAt.toISOString(),
        updatedAt: run.updatedAt.toISOString(),
        agentRunId: run.id,
      })),
      ...optimizations.map((optimization) => ({
        id: `optimization:${optimization.id}`,
        type: 'PRODUCT_OPTIMIZATION' as const,
        status: optimization.status,
        title: `${optimization.product.code} · ${optimization.product.title}`,
        description:
          optimization.error ??
          `面向 ${optimization.targetLanguage} 的商品优化草稿`,
        createdAt: optimization.createdAt.toISOString(),
        updatedAt: optimization.updatedAt.toISOString(),
        optimizationId: optimization.id,
        product: optimization.product,
        ...(optimization.batchItem
          ? { batchTaskId: optimization.batchItem.taskId }
          : {}),
        targetLanguage: optimization.targetLanguage,
      })),
    ].sort((first, second) => second.createdAt.localeCompare(first.createdAt))

    const total = items.length
    const start = (query.page - 1) * query.pageSize
    return {
      items: items.slice(start, start + query.pageSize),
      page: query.page,
      pageSize: query.pageSize,
      total,
    }
  }
}
