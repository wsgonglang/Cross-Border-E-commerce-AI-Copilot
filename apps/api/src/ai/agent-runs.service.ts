import {
  Injectable,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common'
import type {
  AgentRunSummary,
  AgentToolCallSummary,
  AiUsage,
  AuthenticatedUser,
  RoleCode,
} from '@cross-border/shared'

import { asJson, toStringArray } from '../commerce/commerce.utils'
import { MerchantAccessService } from '../commerce/merchant-access.service'
import { PrismaService } from '../database/prisma.service'

interface AgentRunRecord {
  id: string
  merchantId: string
  storeId: string | null
  userId: string
  sessionId: string | null
  userMessageId: string | null
  assistantMessageId: string | null
  message: string
  sourcePage: string | null
  days: number
  allowDraftCreation: boolean
  answer: string | null
  status: 'PLANNING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  providerName: string | null
  modelName: string | null
  promptVersion: string | null
  errorCode: string | null
  promptTokens: number
  completionTokens: number
  totalTokens: number
  createdOptimizationIds: unknown
  error: string | null
  createdAt: Date
  updatedAt: Date
  completedAt: Date | null
  startedAt: Date | null
  toolCalls: Array<{
    externalCallId: string
    name: string
    status: string
    input: unknown
    output: unknown
    error: string | null
    startedAt: Date | null
    completedAt: Date | null
    durationMs: number | null
  }>
}

interface FailureMetadata {
  code?: string
  usage?: AiUsage
}

@Injectable()
export class AgentRunsService implements OnModuleInit, OnModuleDestroy {
  /** 超过该时长仍未终态的运行视为孤儿（进程崩溃/重启遗留），自动标记失败。 */
  private static readonly STALE_RUN_MINUTES = 10
  private static readonly SWEEP_INTERVAL_MS = 5 * 60 * 1000
  private sweepTimer?: NodeJS.Timeout

  constructor(
    private readonly prisma: PrismaService,
    private readonly merchantAccess: MerchantAccessService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.recoverStaleRuns().catch(() => undefined)
    this.sweepTimer = setInterval(() => {
      void this.recoverStaleRuns().catch(() => undefined)
    }, AgentRunsService.SWEEP_INTERVAL_MS)
    this.sweepTimer.unref?.()
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer)
  }

  async recoverStaleRuns(
    maxAgeMinutes: number = AgentRunsService.STALE_RUN_MINUTES,
  ): Promise<number> {
    const threshold = new Date(Date.now() - maxAgeMinutes * 60 * 1000)
    const result = await this.prisma.agentRun.updateMany({
      where: {
        status: { in: ['PLANNING', 'RUNNING'] },
        updatedAt: { lt: threshold },
      },
      data: {
        status: 'FAILED',
        error: 'Agent 运行超时未完成，已自动标记失败',
        completedAt: new Date(),
      },
    })
    return result.count
  }

  async start(
    actor: AuthenticatedUser,
    merchantId: string,
    message: string,
    storeId?: string,
    sourcePage?: string,
    conversation?: { sessionId: string; userMessageId: string },
    days: number = 7,
    promptVersion?: string,
    allowDraftCreation: boolean = false,
  ): Promise<string> {
    const run = await this.prisma.agentRun.create({
      data: {
        merchantId,
        ...(storeId ? { storeId } : {}),
        userId: actor.id,
        message,
        ...(sourcePage ? { sourcePage } : {}),
        days,
        allowDraftCreation,
        ...(promptVersion ? { promptVersion } : {}),
        ...(conversation
          ? {
              sessionId: conversation.sessionId,
              userMessageId: conversation.userMessageId,
            }
          : {}),
        status: 'PLANNING',
      },
      select: { id: true },
    })
    return run.id
  }

  async countActiveForUser(userId: string): Promise<number> {
    return this.prisma.agentRun.count({
      where: { userId, status: { in: ['PLANNING', 'RUNNING'] } },
    })
  }

  async getExecutionContext(runId: string) {
    const run = await this.prisma.agentRun.findUnique({
      where: { id: runId },
      include: {
        store: true,
        user: {
          include: {
            userRoles: { include: { role: true } },
            merchantUsers: true,
          },
        },
      },
    })
    if (!run) return null
    const actor: AuthenticatedUser = {
      id: run.user.id,
      email: run.user.email,
      name: run.user.name,
      roles: run.user.userRoles.map((record) => record.role.code as RoleCode),
      merchantIds: run.user.merchantUsers.map((record) => record.merchantId),
    }
    return {
      actor,
      runId: run.id,
      merchantId: run.merchantId,
      message: run.message,
      storeId: run.storeId ?? undefined,
      storeName: run.store
        ? `${run.store.name} / ${run.store.platform} / ${run.store.market}，storeId=${run.store.id}`
        : undefined,
      storeContext: run.store
        ? { platform: run.store.platform, market: run.store.market }
        : undefined,
      days: run.days,
      allowDraftCreation: run.allowDraftCreation,
      sessionId: run.sessionId ?? undefined,
      userMessageId: run.userMessageId ?? undefined,
      status: run.status,
    }
  }

  async markRunning(runId: string): Promise<void> {
    await this.prisma.agentRun.updateMany({
      where: { id: runId, status: { in: ['PLANNING', 'RUNNING'] } },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
        error: null,
        errorCode: null,
      },
    })
  }

  /** 工具每执行完一次立即落库，支撑轮询实时轨迹；唯一键兼做幂等防重。 */
  async appendToolCall(
    runId: string,
    call: AgentToolCallSummary,
    sequence: number,
  ): Promise<void> {
    const data = {
      runId,
      externalCallId: call.id,
      name: call.name,
      status: call.status,
      sequence,
      input: asJson(call.input),
      ...(call.output !== undefined ? { output: asJson(call.output) } : {}),
      error: call.error ?? null,
      startedAt: call.startedAt ? new Date(call.startedAt) : null,
      completedAt: call.completedAt ? new Date(call.completedAt) : null,
      durationMs: call.durationMs ?? null,
    }
    await this.prisma.$transaction([
      this.prisma.agentToolCall.upsert({
        where: { runId_externalCallId: { runId, externalCallId: call.id } },
        create: data,
        update: {},
      }),
      // 同步刷新运行行的 updatedAt，避免长运行被孤儿回收误杀。
      this.prisma.agentRun.updateMany({
        where: { id: runId, status: { in: ['PLANNING', 'RUNNING'] } },
        data: { status: 'RUNNING' },
      }),
    ])
  }

  async complete(input: {
    runId: string
    answer: string
    usage: AiUsage
    providerName: string
    modelName: string
    createdOptimizationIds: string[]
    assistantMessageId?: string
  }): Promise<void> {
    await this.prisma.agentRun.updateMany({
      where: {
        id: input.runId,
        status: { in: ['PLANNING', 'RUNNING'] },
      },
      data: {
        status: 'COMPLETED',
        answer: input.answer,
        providerName: input.providerName,
        modelName: input.modelName,
        promptTokens: input.usage.promptTokens,
        completionTokens: input.usage.completionTokens,
        totalTokens: input.usage.totalTokens,
        createdOptimizationIds: asJson(input.createdOptimizationIds),
        ...(input.assistantMessageId
          ? { assistantMessageId: input.assistantMessageId }
          : {}),
        completedAt: new Date(),
      },
    })
  }

  async fail(
    runId: string,
    error: string,
    metadata: FailureMetadata = {},
  ): Promise<void> {
    await this.prisma.agentRun.updateMany({
      where: { id: runId, status: { in: ['PLANNING', 'RUNNING'] } },
      data: {
        status: 'FAILED',
        error: error.slice(0, 1000),
        errorCode: metadata.code,
        ...(metadata.usage
          ? {
              promptTokens: metadata.usage.promptTokens,
              completionTokens: metadata.usage.completionTokens,
              totalTokens: metadata.usage.totalTokens,
            }
          : {}),
        completedAt: new Date(),
      },
    })
  }

  async prepareRetry(runId: string, errorCode: string): Promise<void> {
    await this.prisma.agentRun.updateMany({
      where: { id: runId, status: { in: ['PLANNING', 'RUNNING'] } },
      data: {
        status: 'PLANNING',
        errorCode,
        error: '模型服务暂时不可用，正在重试',
      },
    })
  }

  async isCancelled(runId: string): Promise<boolean> {
    const run = await this.prisma.agentRun.findUnique({
      where: { id: runId },
      select: { status: true },
    })
    return run?.status === 'CANCELLED'
  }

  async cancel(
    actor: AuthenticatedUser,
    merchantId: string,
    runId: string,
  ): Promise<{ sessionId?: string; userMessageId?: string }> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    const run = await this.prisma.agentRun.findFirst({
      where: { id: runId, merchantId, userId: actor.id },
      select: { id: true, sessionId: true, userMessageId: true },
    })
    if (!run) throw new NotFoundException('Agent 运行记录不存在')
    await this.prisma.agentRun.updateMany({
      where: { id: runId, status: { in: ['PLANNING', 'RUNNING'] } },
      data: { status: 'CANCELLED', completedAt: new Date() },
    })
    return {
      ...(run.sessionId ? { sessionId: run.sessionId } : {}),
      ...(run.userMessageId ? { userMessageId: run.userMessageId } : {}),
    }
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
      ...(call.startedAt ? { startedAt: call.startedAt.toISOString() } : {}),
      ...(call.completedAt
        ? { completedAt: call.completedAt.toISOString() }
        : {}),
      ...(call.durationMs !== null ? { durationMs: call.durationMs } : {}),
    }))
    return {
      id: record.id,
      runId: record.id,
      merchantId: record.merchantId,
      ...(record.storeId ? { storeId: record.storeId } : {}),
      userId: record.userId,
      ...(record.sessionId ? { sessionId: record.sessionId } : {}),
      ...(record.userMessageId ? { userMessageId: record.userMessageId } : {}),
      ...(record.assistantMessageId
        ? { assistantMessageId: record.assistantMessageId }
        : {}),
      message: record.message,
      ...(record.sourcePage ? { sourcePage: record.sourcePage } : {}),
      allowDraftCreation: record.allowDraftCreation,
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
      ...(record.promptVersion ? { promptVersion: record.promptVersion } : {}),
      ...(record.errorCode
        ? { errorCode: record.errorCode as AgentRunSummary['errorCode'] }
        : {}),
      ...(record.error ? { error: record.error } : {}),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      ...(record.startedAt
        ? { startedAt: record.startedAt.toISOString() }
        : {}),
      ...(record.completedAt
        ? { completedAt: record.completedAt.toISOString() }
        : {}),
    }
  }
}
