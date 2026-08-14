import { describe, expect, it, vi } from 'vitest'

import { AgentProcessorService } from './agent-processor.service'

const context = {
  actor: {
    id: 'user-1',
    email: 'operator@example.com',
    name: 'Operator',
    roles: ['operator' as const],
    merchantIds: ['merchant-1'],
  },
  runId: 'run-1',
  merchantId: 'merchant-1',
  message: '查询库存',
  days: 7,
  status: 'PLANNING' as const,
}

function setup(executeRun: ReturnType<typeof vi.fn>) {
  const runs = {
    getExecutionContext: vi.fn().mockResolvedValue(context),
    markRunning: vi.fn().mockResolvedValue(undefined),
    isCancelled: vi.fn().mockResolvedValue(false),
    prepareRetry: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
  }
  const stop = vi.fn()
  const service = new AgentProcessorService(
    runs as never,
    {
      executeRun,
      takeFailedUsage: vi.fn().mockReturnValue({
        promptTokens: 10,
        completionTokens: 2,
        totalTokens: 12,
      }),
    } as never,
    {
      watch: vi.fn().mockReturnValue({
        signal: new AbortController().signal,
        stop,
      }),
    } as never,
  )
  return { service, runs, stop }
}

describe('AgentProcessorService', () => {
  it('executes a persisted run in the worker', async () => {
    const executeRun = vi.fn().mockResolvedValue(undefined)
    const { service, runs, stop } = setup(executeRun)

    await service.process({
      data: { runId: 'run-1' },
      attemptsMade: 0,
      opts: { attempts: 2 },
    } as never)

    expect(runs.markRunning).toHaveBeenCalledWith('run-1')
    const executionInput = executeRun.mock.calls[0]?.[0] as {
      runId: string
      signal: AbortSignal
    }
    expect(executionInput.runId).toBe('run-1')
    expect(executionInput.signal).toBeInstanceOf(AbortSignal)
    expect(stop).toHaveBeenCalledOnce()
  })

  it('returns a transient timeout to PLANNING for BullMQ retry', async () => {
    const executeRun = vi.fn().mockRejectedValue(new Error('provider timeout'))
    const { service, runs } = setup(executeRun)

    await expect(
      service.process({
        data: { runId: 'run-1' },
        attemptsMade: 0,
        opts: { attempts: 2 },
      } as never),
    ).rejects.toThrow('provider timeout')

    expect(runs.prepareRetry).toHaveBeenCalledWith('run-1', 'PROVIDER_TIMEOUT')
    expect(runs.fail).not.toHaveBeenCalled()
  })

  it('persists a safe final failure with partial usage', async () => {
    const executeRun = vi.fn().mockRejectedValue(new Error('provider timeout'))
    const { service, runs } = setup(executeRun)

    await expect(
      service.process({
        data: { runId: 'run-1' },
        attemptsMade: 1,
        opts: { attempts: 2 },
      } as never),
    ).rejects.toThrow('provider timeout')

    expect(runs.fail).toHaveBeenCalledWith('run-1', '模型服务响应超时', {
      code: 'PROVIDER_TIMEOUT',
      usage: { promptTokens: 10, completionTokens: 2, totalTokens: 12 },
    })
  })
})
