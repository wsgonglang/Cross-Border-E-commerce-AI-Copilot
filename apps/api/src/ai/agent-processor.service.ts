import { Injectable } from '@nestjs/common'
import type { Job } from 'bullmq'

import { classifyAiError } from './ai-errors'
import { AgentCancellationMonitorService } from './agent-cancellation-monitor.service'
import type { AgentRunJobData } from './agent-queue.service'
import { AgentRunsService } from './agent-runs.service'
import { AgentService } from './agent.service'

@Injectable()
export class AgentProcessorService {
  constructor(
    private readonly runs: AgentRunsService,
    private readonly agent: AgentService,
    private readonly cancellation: AgentCancellationMonitorService,
  ) {}

  async process(job: Job<AgentRunJobData>): Promise<void> {
    const context = await this.runs.getExecutionContext(job.data.runId)
    if (
      !context ||
      ['COMPLETED', 'FAILED', 'CANCELLED'].includes(context.status)
    ) {
      return
    }
    await this.runs.markRunning(context.runId)
    const monitor = this.cancellation.watch(context.runId)
    try {
      await this.agent.executeRun({ ...context, signal: monitor.signal })
    } catch (error: unknown) {
      const classified = classifyAiError(error)
      if (
        classified.code === 'CANCELLED' ||
        (await this.runs.isCancelled(context.runId))
      ) {
        this.agent.takeFailedUsage(context.runId)
        return
      }
      const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1)
      if (finalAttempt || !classified.retryable) {
        await this.runs.fail(context.runId, classified.message, {
          code: classified.code,
          usage: this.agent.takeFailedUsage(context.runId),
        })
      } else {
        await this.runs.prepareRetry(context.runId, classified.code)
      }
      if (!classified.retryable) return
      throw error
    } finally {
      monitor.stop()
    }
  }
}
