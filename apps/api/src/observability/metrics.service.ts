import { Injectable } from '@nestjs/common'
import { Counter, Gauge, Histogram, Registry } from 'prom-client'

import { AgentQueueService } from '../ai/agent-queue.service'
import { BatchQueueService } from '../batch/batch-queue.service'
import { PrismaService } from '../database/prisma.service'
import { ImportQueueService } from '../imports/import-queue.service'

const AGENT_STATUSES = [
  'PLANNING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const
const QUEUE_NAMES = [
  'agent',
  'batch_optimization',
  'structured_import',
] as const
const QUEUE_STATES = ['waiting', 'active', 'delayed', 'failed'] as const

@Injectable()
export class MetricsService {
  readonly contentType: string
  private readonly registry = new Registry()
  private readonly httpRequests: Counter<'method' | 'route' | 'status_code'>
  private readonly httpErrors: Counter<'route'>
  private readonly httpDuration: Histogram<'method' | 'route'>
  private readonly agentRuns: Gauge<'status'>
  private readonly agentTokens: Gauge<string>
  private readonly queueJobs: Gauge<'queue' | 'state'>

  constructor(
    private readonly prisma: PrismaService,
    private readonly agentQueue: AgentQueueService,
    private readonly batchQueue: BatchQueueService,
    private readonly importQueue: ImportQueueService,
  ) {
    this.contentType = this.registry.contentType
    this.httpRequests = new Counter({
      name: 'copilot_http_requests_total',
      help: 'Total API HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    })
    this.httpErrors = new Counter({
      name: 'copilot_http_5xx_total',
      help: 'Total API HTTP 5xx responses',
      labelNames: ['route'],
      registers: [this.registry],
    })
    this.httpDuration = new Histogram({
      name: 'copilot_http_request_duration_seconds',
      help: 'API HTTP request duration',
      labelNames: ['method', 'route'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 15, 30],
      registers: [this.registry],
    })
    this.agentRuns = new Gauge({
      name: 'copilot_agent_runs_total',
      help: 'Persisted Agent runs by final or active status',
      labelNames: ['status'],
      registers: [this.registry],
    })
    this.agentTokens = new Gauge({
      name: 'copilot_agent_tokens_total',
      help: 'Persisted total Agent token usage',
      registers: [this.registry],
    })
    this.queueJobs = new Gauge({
      name: 'copilot_queue_jobs',
      help: 'Current BullMQ jobs by queue and state',
      labelNames: ['queue', 'state'],
      registers: [this.registry],
    })
  }

  observeHttp(
    method: string,
    route: string,
    statusCode: number,
    durationMs: number,
  ): void {
    const labels = { method, route, status_code: String(statusCode) }
    this.httpRequests.inc(labels)
    this.httpDuration.observe({ method, route }, durationMs / 1000)
    if (statusCode >= 500) this.httpErrors.inc({ route })
  }

  async render(): Promise<string> {
    await this.refreshRuntimeGauges()
    return this.registry.metrics()
  }

  private async refreshRuntimeGauges(): Promise<void> {
    const [runs, tokenSum, agent, batch, imports] = await Promise.all([
      this.prisma.agentRun.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.agentRun.aggregate({ _sum: { totalTokens: true } }),
      this.agentQueue.getJobCounts(),
      this.batchQueue.getJobCounts(),
      this.importQueue.getJobCounts(),
    ])
    for (const status of AGENT_STATUSES) this.agentRuns.set({ status }, 0)
    for (const run of runs)
      this.agentRuns.set({ status: run.status }, run._count._all)
    this.agentTokens.set(tokenSum._sum.totalTokens ?? 0)

    const queueCounts = {
      agent,
      batch_optimization: batch,
      structured_import: imports,
    }
    for (const queue of QUEUE_NAMES) {
      for (const state of QUEUE_STATES) {
        this.queueJobs.set({ queue, state }, queueCounts[queue][state])
      }
    }
  }
}
