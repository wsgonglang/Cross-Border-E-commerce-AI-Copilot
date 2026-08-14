import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type {
  AgentFeedbackRating,
  AgentFeedbackReason,
  AgentRunFeedbackSummary,
  AuthenticatedUser,
} from '@cross-border/shared'

import { MerchantAccessService } from '../commerce/merchant-access.service'
import { PrismaService } from '../database/prisma.service'

@Injectable()
export class AgentFeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly merchantAccess: MerchantAccessService,
  ) {}

  async upsert(
    actor: AuthenticatedUser,
    merchantId: string,
    runId: string,
    input: {
      rating: AgentFeedbackRating
      reason?: AgentFeedbackReason
      comment?: string
    },
  ): Promise<AgentRunFeedbackSummary> {
    await this.merchantAccess.assertAccess(actor, merchantId)
    const run = await this.prisma.agentRun.findFirst({
      where: { id: runId, merchantId, userId: actor.id },
      select: { id: true, status: true },
    })
    if (!run) throw new NotFoundException('Agent 运行记录不存在')
    if (run.status !== 'COMPLETED') {
      throw new BadRequestException('只能评价已完成的 Agent 运行')
    }
    if (input.rating === 'HELPFUL' && input.reason) {
      throw new BadRequestException('有帮助的反馈不应包含失败原因')
    }
    const feedback = await this.prisma.agentRunFeedback.upsert({
      where: { runId_userId: { runId, userId: actor.id } },
      create: {
        runId,
        merchantId,
        userId: actor.id,
        rating: input.rating,
        reason: input.reason,
        comment: input.comment?.trim() || null,
      },
      update: {
        rating: input.rating,
        reason: input.reason ?? null,
        comment: input.comment?.trim() || null,
      },
    })
    return {
      id: feedback.id,
      runId: feedback.runId,
      merchantId: feedback.merchantId,
      userId: feedback.userId,
      rating: feedback.rating,
      ...(feedback.reason ? { reason: feedback.reason } : {}),
      ...(feedback.comment ? { comment: feedback.comment } : {}),
      createdAt: feedback.createdAt.toISOString(),
      updatedAt: feedback.updatedAt.toISOString(),
    }
  }
}
