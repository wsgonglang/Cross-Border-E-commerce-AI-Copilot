import { Injectable } from '@nestjs/common'
import type {
  AgentToolName,
  AiQualityDailyPoint,
  AiQualityRateMetric,
  AiQualityReport,
  AiQualityTrace,
  AiQualityWindowDays,
  AuthenticatedUser,
} from '@cross-border/shared'

import { MerchantAccessService } from '../commerce/merchant-access.service'
import { PrismaService } from '../database/prisma.service'

function rate(numerator: number, denominator: number): AiQualityRateMetric {
  return {
    numerator,
    denominator,
    rate:
      denominator === 0
        ? null
        : Math.round((numerator / denominator) * 10_000) / 10_000,
  }
}

function startOfWindow(now: Date, days: AiQualityWindowDays): Date {
  const start = new Date(now)
  start.setUTCHours(0, 0, 0, 0)
  start.setUTCDate(start.getUTCDate() - (days - 1))
  return start
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

@Injectable()
export class AiQualityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly merchantAccess: MerchantAccessService,
  ) {}

  async getReport(
    actor: AuthenticatedUser,
    merchantId: string,
    days: AiQualityWindowDays,
  ): Promise<AiQualityReport> {
    await this.merchantAccess.assertAccess(actor, merchantId)

    const now = new Date()
    const from = startOfWindow(now, days)
    const [runs, optimizations] = await Promise.all([
      this.prisma.agentRun.findMany({
        where: { merchantId, createdAt: { gte: from, lte: now } },
        include: {
          toolCalls: {
            select: { name: true, status: true },
            orderBy: { sequence: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.productOptimization.findMany({
        where: { merchantId, createdAt: { gte: from, lte: now } },
        include: {
          product: { select: { id: true, code: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const completedRuns = runs.filter(
      (run) => run.status === 'COMPLETED' || run.status === 'FAILED',
    )
    const failedRuns = completedRuns.filter(
      (run) => run.status === 'FAILED',
    ).length
    const reviewedOptimizations = optimizations.filter(
      (optimization) =>
        optimization.status === 'APPLIED' || optimization.status === 'REJECTED',
    )
    const appliedOptimizations = reviewedOptimizations.filter(
      (optimization) => optimization.status === 'APPLIED',
    ).length
    const toolCalls = runs.flatMap((run) => run.toolCalls)
    const successfulToolCalls = toolCalls.filter(
      (call) => call.status === 'success',
    ).length
    const latencies = completedRuns
      .filter((run) => run.completedAt)
      .map((run) => run.completedAt!.getTime() - run.createdAt.getTime())
      .filter((latency) => latency >= 0)

    const tokenUsage = [...runs, ...optimizations].reduce(
      (usage, item) => ({
        promptTokens: usage.promptTokens + item.promptTokens,
        completionTokens: usage.completionTokens + item.completionTokens,
        totalTokens: usage.totalTokens + item.totalTokens,
      }),
      { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    )

    const tools = new Map<
      string,
      { name: AgentToolName | 'unknown'; calls: number; successes: number }
    >()
    for (const call of toolCalls) {
      const name = call.name as AgentToolName | 'unknown'
      const current = tools.get(name) ?? {
        name,
        calls: 0,
        successes: 0,
      }
      current.calls += 1
      if (call.status === 'success') current.successes += 1
      tools.set(name, current)
    }

    const daily = this.buildDaily(days, now)
    const dailyByDate = new Map(daily.map((point) => [point.date, point]))
    for (const run of runs) {
      const point = dailyByDate.get(dayKey(run.createdAt))
      if (!point) continue
      point.agentRuns += 1
      if (run.status === 'FAILED') point.failedRuns += 1
      point.toolCalls += run.toolCalls.length
      point.successfulToolCalls += run.toolCalls.filter(
        (call) => call.status === 'success',
      ).length
      point.totalTokens += run.totalTokens
    }
    for (const optimization of optimizations) {
      const point = dailyByDate.get(dayKey(optimization.createdAt))
      if (!point) continue
      point.generatedDrafts += 1
      if (optimization.status === 'APPLIED') point.appliedDrafts += 1
      if (optimization.status === 'REJECTED') point.rejectedDrafts += 1
      point.totalTokens += optimization.totalTokens
    }

    const traces: AiQualityTrace[] = [
      ...runs.map((run) => ({
        id: run.id,
        type: 'AGENT_RUN' as const,
        title: run.message,
        status: run.status,
        createdAt: run.createdAt.toISOString(),
        ...(run.completedAt
          ? {
              completedAt: run.completedAt.toISOString(),
              latencyMs: Math.max(
                0,
                run.completedAt.getTime() - run.createdAt.getTime(),
              ),
            }
          : {}),
        totalTokens: run.totalTokens,
        ...(run.providerName ? { providerName: run.providerName } : {}),
        ...(run.modelName ? { modelName: run.modelName } : {}),
        ...(run.sourcePage ? { sourcePage: run.sourcePage } : {}),
      })),
      ...optimizations.map((optimization) => ({
        id: optimization.id,
        type: 'PRODUCT_OPTIMIZATION' as const,
        title: `${optimization.product.code} · ${optimization.product.title}`,
        status: optimization.status,
        createdAt: optimization.createdAt.toISOString(),
        totalTokens: optimization.totalTokens,
        ...(optimization.providerName
          ? { providerName: optimization.providerName }
          : {}),
        ...(optimization.modelName
          ? { modelName: optimization.modelName }
          : {}),
        product: optimization.product,
      })),
    ]
      .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
      .slice(0, 12)

    return {
      merchantId,
      windowDays: days,
      period: { from: from.toISOString(), to: now.toISOString() },
      generatedDrafts: optimizations.length,
      reviewedDrafts: reviewedOptimizations.length,
      acceptance: rate(appliedOptimizations, reviewedOptimizations.length),
      agentRuns: runs.length,
      agentFailures: rate(failedRuns, completedRuns.length),
      toolCalls: rate(successfulToolCalls, toolCalls.length),
      averageAgentLatencyMs:
        latencies.length === 0
          ? null
          : Math.round(
              latencies.reduce((total, latency) => total + latency, 0) /
                latencies.length,
            ),
      tokenUsage,
      tools: [...tools.values()]
        .map((tool) => ({
          ...tool,
          successRate: rate(tool.successes, tool.calls).rate,
        }))
        .sort((first, second) => second.calls - first.calls),
      daily,
      recentTraces: traces,
      methodology: {
        acceptance:
          'APPLIED / (APPLIED + REJECTED); pending drafts are excluded.',
        toolSuccess:
          'Successful persisted tool calls / all persisted tool calls.',
        failure:
          'FAILED / (COMPLETED + FAILED); in-progress runs are excluded.',
        latency:
          'Average completedAt - createdAt for terminal Agent runs with valid timestamps.',
        tokens:
          'Sum of persisted model usage for Agent runs and product optimization generations.',
      },
    }
  }

  private buildDaily(
    days: AiQualityWindowDays,
    now: Date,
  ): AiQualityDailyPoint[] {
    const start = startOfWindow(now, days)
    return Array.from({ length: days }, (_, offset) => {
      const date = new Date(start)
      date.setUTCDate(date.getUTCDate() + offset)
      return {
        date: dayKey(date),
        agentRuns: 0,
        failedRuns: 0,
        toolCalls: 0,
        successfulToolCalls: 0,
        generatedDrafts: 0,
        appliedDrafts: 0,
        rejectedDrafts: 0,
        totalTokens: 0,
      }
    })
  }
}
