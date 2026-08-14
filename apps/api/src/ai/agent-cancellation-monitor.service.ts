import { Injectable } from '@nestjs/common'

import { AgentRunsService } from './agent-runs.service'

@Injectable()
export class AgentCancellationMonitorService {
  constructor(private readonly runs: AgentRunsService) {}

  watch(runId: string): { signal: AbortSignal; stop: () => void } {
    const controller = new AbortController()
    let checking = false
    const timer = setInterval(() => {
      if (checking || controller.signal.aborted) return
      checking = true
      void this.runs
        .isCancelled(runId)
        .then((cancelled) => {
          if (cancelled) controller.abort()
        })
        .finally(() => {
          checking = false
        })
    }, 250)
    timer.unref?.()
    return {
      signal: controller.signal,
      stop: () => clearInterval(timer),
    }
  }
}
