import type { AuthenticatedUser } from '@cross-border/shared'
import {
  BadRequestException,
  GoneException,
  NotFoundException,
} from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'

import { MerchantAccessService } from '../commerce/merchant-access.service'
import { PrismaService } from '../database/prisma.service'
import { AiSessionSharesService } from './ai-session-shares.service'

const operator: AuthenticatedUser = {
  id: 'operator-1',
  email: 'operator@example.com',
  name: '运营人员',
  roles: ['operator'],
  merchantIds: ['merchant-1'],
}

const viewer: AuthenticatedUser = {
  id: 'viewer-1',
  email: 'viewer@example.com',
  name: '查看人员',
  roles: ['viewer'],
  merchantIds: ['merchant-1'],
}

const now = new Date('2026-07-29T10:00:00.000Z')
const future = new Date(Date.now() + 24 * 60 * 60 * 1000)

function createService(prisma: object) {
  return new AiSessionSharesService(
    prisma as PrismaService,
    {
      assertAccess: vi.fn().mockResolvedValue(undefined),
    } as unknown as MerchantAccessService,
  )
}

describe('AiSessionSharesService', () => {
  it('creates a recipient-scoped immutable snapshot with sensitive data redacted', async () => {
    const transaction = {
      aiSessionShare: {
        create: vi.fn().mockResolvedValue({
          id: 'share-1',
          sessionId: 'session-1',
          title: '订单跟进',
          expiresAt: future,
          revokedAt: null,
          createdAt: now,
          _count: { recipients: 1 },
        }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    const prisma = {
      aiSession: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ id: 'session-1' })
          .mockResolvedValueOnce({
            id: 'session-1',
            title: '订单跟进',
            messages: [
              {
                id: 'message-1',
                role: 'user',
                content:
                  '客户 alice@example.com，电话 138-1234-5678，收货地址：深圳市南山区测试路 1 号',
                createdAt: now,
              },
            ],
          }),
      },
      merchantUser: {
        findMany: vi.fn().mockResolvedValue([{ userId: viewer.id }]),
      },
      $transaction: vi.fn(
        (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    }
    const service = createService(prisma)

    const result = await service.create(operator, 'merchant-1', 'session-1', {
      recipientUserIds: [viewer.id],
      expiresInHours: 24,
    })

    const createInput = transaction.aiSessionShare.create.mock
      .calls[0]?.[0] as {
      data: { snapshot: unknown }
    }
    const snapshot = JSON.stringify(createInput.data.snapshot)
    expect(result.recipientCount).toBe(1)
    expect(snapshot).not.toContain('alice@example.com')
    expect(snapshot).not.toContain('138-1234-5678')
    expect(snapshot).not.toContain('深圳市南山区')
    expect(transaction.auditLog.create).toHaveBeenCalledOnce()
  })

  it('rejects recipients outside the current merchant', async () => {
    const prisma = {
      aiSession: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ id: 'session-1' })
          .mockResolvedValueOnce({
            id: 'session-1',
            title: '会话',
            messages: [],
          }),
      },
      merchantUser: { findMany: vi.fn().mockResolvedValue([]) },
    }
    const service = createService(prisma)

    await expect(
      service.create(operator, 'merchant-1', 'session-1', {
        recipientUserIds: ['outside-user'],
        expiresInHours: 24,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('allows only the creator or an explicit recipient to read a share', async () => {
    const prisma = {
      aiSessionShare: { findFirst: vi.fn().mockResolvedValue(null) },
    }
    const service = createService(prisma)

    await expect(
      service.get(operator, 'merchant-1', 'share-1'),
    ).rejects.toBeInstanceOf(NotFoundException)
    expect(prisma.aiSessionShare.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'share-1',
        merchantId: 'merchant-1',
        OR: [
          { createdById: operator.id },
          { recipients: { some: { userId: operator.id } } },
        ],
      },
    })
  })

  it.each([
    ['revoked', now, future],
    ['expired', null, new Date('2026-07-28T10:00:00.000Z')],
  ])('rejects a %s share immediately', async (_label, revokedAt, expiresAt) => {
    const prisma = {
      aiSessionShare: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'share-1',
          merchantId: 'merchant-1',
          sessionId: 'session-1',
          title: '共享会话',
          snapshot: {},
          revokedAt,
          expiresAt,
          createdAt: now,
        }),
      },
      auditLog: { create: vi.fn() },
    }
    const service = createService(prisma)

    await expect(
      service.get(viewer, 'merchant-1', 'share-1'),
    ).rejects.toBeInstanceOf(GoneException)
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })

  it('records access to a valid read-only snapshot', async () => {
    const prisma = {
      aiSessionShare: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'share-1',
          merchantId: 'merchant-1',
          sessionId: 'session-1',
          title: '共享会话',
          snapshot: {
            title: '共享会话',
            ownerName: operator.name,
            messages: [
              {
                id: 'message-1',
                role: 'assistant',
                content: '已完成分析',
                createdAt: now.toISOString(),
              },
            ],
          },
          revokedAt: null,
          expiresAt: future,
          createdAt: now,
        }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    const service = createService(prisma)

    const result = await service.get(viewer, 'merchant-1', 'share-1')

    expect(result.messages).toHaveLength(1)
    expect(result.messages[0]?.content).toBe('已完成分析')
    const auditInput = prisma.auditLog.create.mock.calls[0]?.[0] as {
      data: { actorUserId: string; action: string }
    }
    expect(auditInput.data.actorUserId).toBe(viewer.id)
    expect(auditInput.data.action).toBe('ACCESS')
  })
})
