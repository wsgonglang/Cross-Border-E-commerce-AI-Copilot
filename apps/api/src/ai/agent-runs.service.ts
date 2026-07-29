import { Injectable, NotFoundException } from '@nestjs/common'
import type {
  AgentRunSummary,
  AgentToolCallSummary,
  AiUsage,
  AuthenticatedUser,
} from '@cross-border/shared'

import { asJson, toStringArray } from '../commerce/commerce.utils'
import { MerchantAccessService } from '../commerce/merchant-access.service'
import { PrismaService } from '../database/prisma.service'

interface AgentRunRecord {
  id: string
  merchantId: string
  storeId: string | null
  userId: string
  message: string
  sourcePage: string | null
  answer: string | null
  status: 'PLANNING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  providerName: string | null
  modelName: string | null
  promptTokens: number
  completionTokens: number
  totalTokens: number
  createdOptimizationIds: unknown
  error: string | null
  createdAt: Date
  updatedAt: Date
  completedAt: Date | null
  toolCalls: Array<{
    externalCallId: string
    name: string
    status: string
    input: unknown
    output: unknown
    error: string | null
  }>
}

@Injectable()
export class AgentRunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly merchantAccess: MerchantAccessService,
  ) {}

  async start(
    actor: AuthenticatedUser,
    merchantId: string,
    message: string,
    storeId?: string,
    sourcePage?: string,
  ): Promise<string> {
    const run = await this.prisma.agentRun.create({
      data: {
        merchantId,
        ...(storeId ? { storeId } : {}),
        userId: actor.id,
        message,
        ...(sourcePage ? { sourcePage } : {}),
        status: 'PLANNING',
      },
      select: { id: true },
    })
    return run.id
  }

  async markRunning(runId: string): Promise<void> {
    await this.prisma.agentRun.update({
      where: { id: runId },
      data: { status: 'RUNNING' },
    })
  }

  async complete(input: {
    runId: string
    answer: string
    usage: AiUsage
    providerName: string
    modelName: string
    toolCalls: AgentToolCallSummary[]
    createdOptimizationIds: string[]
  }): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.agentToolCall.createMany({
        data: input.toolCalls.map((call, sequence) => ({
          runId: input.runId,
          externalCallId: call.id,
          name: call.name,
          status: call.status,
          sequence,
          input: asJson(call.input),
          ...(call.output !== undefined ? { output: asJson(call.output) } : {}),
          error: call.error,
        })),
        skipDuplicates: true,
      })
      await transaction.agentRun.update({
        where: { id: input.runId },
        data: {
          status: 'COMPLETED',
          answer: input.answer,
          providerName: input.providerName,
          modelName: input.modelName,
          promptTokens: input.usage.promptTokens,
          completionTokens: input.usage.completionTokens,
          totalTokens: input.usage.totalTokens,
          createdOptimizationIds: asJson(input.createdOptimizationIds),
          completedAt: new Date(),
        },
      })
    })
  }

  async fail(runId: string, error: string): Promise<void> {
    await this.prisma.agentRun.update({
      where: { id: runId },
      data: {
        status: 'FAILED',
        error: error.slice(0, 1000),
        completedAt: new Date(),
      },
    })
  }

  async get(
    actor: AuthenticatedUser,
    merchantId: string,
    runId: string,
  ): Promise<AgentRunSummary> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    const record = await this.prisma.agentRun.findFirst({
      where: { id: runId, merchantId },
      include: { toolCalls: { orderBy: { sequence: 'asc' } } },
    })
    if (!record) throw new NotFoundException('Agent 运行记录不存在')
    return this.toSummary(record)
  }

  toSummary(record: AgentRunRecord): AgentRunSummary {
    const toolCalls: AgentToolCallSummary[] = record.toolCalls.map((call) => ({
      id: call.externalCallId,
      name: call.name as AgentToolCallSummary['name'],
      status: call.status as AgentToolCallSummary['status'],
      input:
        typeof call.input === 'object' && call.input !== null
          ? (call.input as Record<string, unknown>)
          : {},
      ...(call.output !== null ? { output: call.output } : {}),
      ...(call.error ? { error: call.error } : {}),
    }))
    return {
      id: record.id,
      runId: record.id,
      merchantId: record.merchantId,
      ...(record.storeId ? { storeId: record.storeId } : {}),
      userId: record.userId,
      message: record.message,
      ...(record.sourcePage ? { sourcePage: record.sourcePage } : {}),
      answer: record.answer ?? '',
      status: record.status,
      toolCalls,
      usage: {
        promptTokens: record.promptTokens,
        completionTokens: record.completionTokens,
        totalTokens: record.totalTokens,
      },
      createdOptimizationIds: toStringArray(record.createdOptimizationIds),
      ...(record.providerName ? { providerName: record.providerName } : {}),
      ...(record.modelName ? { modelName: record.modelName } : {}),
      ...(record.error ? { error: record.error } : {}),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      ...(record.completedAt
        ? { completedAt: record.completedAt.toISOString() }
        : {}),
    }
  }
}
