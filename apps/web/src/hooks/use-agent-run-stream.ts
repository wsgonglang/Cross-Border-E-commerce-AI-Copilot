import type { AgentRunSummary } from '@cross-border/shared'
import { useEffect, useState } from 'react'

import { streamAgentRunEvents } from '../api/agent'
import { getAgentRun } from '../api/ai-results'

const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED', 'CANCELLED'])
const FALLBACK_INTERVAL_MS = 1_000
const MAX_FALLBACK_POLLS = 360

function isTerminal(run: AgentRunSummary): boolean {
  return TERMINAL_STATUSES.has(run.status)
}

function waitForFallback(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, FALLBACK_INTERVAL_MS)
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
}

/**
 * Agent 运行统一实时策略：SSE 只承载体验，MySQL-backed GET 是恢复路径。
 * 组件卸载只关闭订阅，不会取消服务端运行。
 */
export function useAgentRunStream(
  token: string,
  merchantId: string,
  runId?: string,
) {
  const [state, setState] = useState<{
    runId?: string
    data?: AgentRunSummary
    error: string | null
  }>({ error: null })

  useEffect(() => {
    if (!token || !merchantId || !runId) return

    const controller = new AbortController()
    const apply = (run: AgentRunSummary) => {
      if (!controller.signal.aborted) {
        setState({ runId, data: run, error: null })
      }
    }

    void (async () => {
      try {
        const streamed = await streamAgentRunEvents(
          token,
          merchantId,
          runId,
          controller.signal,
          (_event, run) => apply(run),
        )
        if (streamed && isTerminal(streamed)) return
      } catch {
        if (controller.signal.aborted) return
      }

      try {
        for (
          let attempt = 0;
          attempt < MAX_FALLBACK_POLLS && !controller.signal.aborted;
          attempt += 1
        ) {
          const run = await getAgentRun(token, merchantId, runId)
          apply(run)
          if (isTerminal(run)) return
          await waitForFallback(controller.signal)
        }
        if (!controller.signal.aborted) {
          setState({ runId, error: 'AGENT_RUN_RECOVERY_TIMEOUT' })
        }
      } catch (runError: unknown) {
        if (!controller.signal.aborted) {
          setState({
            runId,
            error:
              runError instanceof Error
                ? runError.message
                : 'AGENT_RUN_RECOVERY_FAILED',
          })
        }
      }
    })()

    return () => controller.abort()
  }, [merchantId, runId, token])

  return state.runId === runId
    ? { data: state.data, error: state.error }
    : { data: undefined, error: null }
}
