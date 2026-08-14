import { BadRequestException, NotFoundException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'

import { AgentFeedbackService } from './agent-feedback.service'

const actor = {
  id: 'user-1',
  email: 'operator@example.com',
  name: 'Operator',
  roles: ['operator' as const],
  merchantIds: ['merchant-1'],
}

describe('AgentFeedbackService', () => {
  it('upserts one merchant-scoped feedback record per user and run', async () => {
    const upsert = vi.fn().mockResolvedValue({
      id: 'feedback-1',
      runId: 'run-1',
      merchantId: 'merchant-1',
      userId: 'user-1',
      rating: 'NOT_HELPFUL',
      reason: 'WRONG_TOOL',
      comment: null,
      createdAt: new Date('2026-08-15T00:00:00.000Z'),
      updatedAt: new Date('2026-08-15T00:00:00.000Z'),
    })
    const service = new AgentFeedbackService(
      {
        agentRun: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'run-1',
            status: 'COMPLETED',
          }),
        },
        agentRunFeedback: { upsert },
      } as never,
      { assertAccess: vi.fn().mockResolvedValue(undefined) } as never,
    )

    const result = await service.upsert(actor, 'merchant-1', 'run-1', {
      rating: 'NOT_HELPFUL',
      reason: 'WRONG_TOOL',
    })

    expect(result.reason).toBe('WRONG_TOOL')
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { runId_userId: { runId: 'run-1', userId: 'user-1' } },
      }),
    )
  })

  it('rejects feedback for missing or unfinished runs', async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'run-1', status: 'RUNNING' })
    const service = new AgentFeedbackService(
      {
        agentRun: { findFirst },
        agentRunFeedback: { upsert: vi.fn() },
      } as never,
      { assertAccess: vi.fn().mockResolvedValue(undefined) } as never,
    )

    await expect(
      service.upsert(actor, 'merchant-1', 'run-1', { rating: 'HELPFUL' }),
    ).rejects.toBeInstanceOf(NotFoundException)
    await expect(
      service.upsert(actor, 'merchant-1', 'run-1', { rating: 'HELPFUL' }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})
