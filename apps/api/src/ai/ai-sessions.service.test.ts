import type { AuthenticatedUser } from '@cross-border/shared'
import { BadRequestException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'

import { MerchantAccessService } from '../commerce/merchant-access.service'
import { PrismaService } from '../database/prisma.service'
import { AiSessionsService } from './ai-sessions.service'

const operator: AuthenticatedUser = {
  id: 'user-1',
  email: 'operator@example.com',
  name: '运营',
  roles: ['operator'],
  merchantIds: ['merchant-1'],
}

describe('AiSessionsService', () => {
  it('isolates session lists by merchant and current user', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const count = vi.fn().mockResolvedValue(0)
    const prisma = {
      aiSession: { findMany, count },
      $transaction: vi.fn((operations: Array<Promise<unknown>>) =>
        Promise.all(operations),
      ),
    }
    const merchantAccess = {
      assertAccess: vi.fn().mockResolvedValue(undefined),
    }
    const service = new AiSessionsService(
      prisma as unknown as PrismaService,
      merchantAccess as unknown as MerchantAccessService,
    )

    await service.list(operator, 'merchant-1', {
      page: 1,
      pageSize: 50,
    })

    const arguments_ = findMany.mock.calls[0]?.[0] as unknown as {
      where: { merchantId: string; userId: string }
    }
    expect(arguments_.where).toEqual({
      merchantId: 'merchant-1',
      userId: operator.id,
      archivedAt: null,
    })
    expect(merchantAccess.assertAccess).toHaveBeenCalledWith(
      operator,
      'merchant-1',
    )
  })

  it('rejects access to a session owned by another user', async () => {
    const prisma = {
      aiSession: { findFirst: vi.fn().mockResolvedValue(null) },
    }
    const merchantAccess = {
      assertAccess: vi.fn().mockResolvedValue(undefined),
    }
    const service = new AiSessionsService(
      prisma as unknown as PrismaService,
      merchantAccess as unknown as MerchantAccessService,
    )

    await expect(
      service.get(operator, 'merchant-1', 'other-session'),
    ).rejects.toThrow('会话不存在')
    expect(prisma.aiSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'other-session',
          merchantId: 'merchant-1',
          userId: operator.id,
        },
      }),
    )
  })

  it('searches title and message content while keeping archived sessions separate', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const prisma = {
      aiSession: {
        findMany,
        count: vi.fn().mockResolvedValue(0),
      },
      $transaction: vi.fn((operations: Array<Promise<unknown>>) =>
        Promise.all(operations),
      ),
    }
    const service = new AiSessionsService(
      prisma as unknown as PrismaService,
      {
        assertAccess: vi.fn().mockResolvedValue(undefined),
      } as unknown as MerchantAccessService,
    )

    await service.list(operator, 'merchant-1', {
      page: 1,
      pageSize: 50,
      keyword: 'charger',
      archived: 'true',
      groupId: '商品运营',
    })

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          merchantId: 'merchant-1',
          userId: operator.id,
          archivedAt: { not: null },
          groupId: '商品运营',
          OR: [
            { title: { contains: 'charger' } },
            {
              messages: {
                some: { content: { contains: 'charger' } },
              },
            },
          ],
        },
        orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
      }),
    )
  })

  it('auto-titles only a session that still has the default title', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 })
    const service = new AiSessionsService(
      {
        aiSession: { updateMany },
      } as unknown as PrismaService,
      {
        assertAccess: vi.fn().mockResolvedValue(undefined),
      } as unknown as MerchantAccessService,
    )

    const changed = await service.updateTitleIfDefault(
      operator,
      'merchant-1',
      'session-1',
      '自动标题',
    )

    expect(changed).toBe(false)
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'session-1',
        merchantId: 'merchant-1',
        userId: operator.id,
        title: 'AI 对话',
      },
      data: { title: '自动标题' },
    })
  })

  it('archives with an audit record and requires archive before permanent deletion', async () => {
    const now = new Date('2026-07-29T10:00:00.000Z')
    const session = {
      id: 'session-1',
      merchantId: 'merchant-1',
      userId: operator.id,
      title: '商品运营',
      status: 'IDLE',
      error: null,
      pinned: true,
      groupId: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
      _count: { messages: 2 },
    }
    const transaction = {
      aiSession: {
        update: vi.fn().mockResolvedValue({
          ...session,
          pinned: false,
          archivedAt: now,
        }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    const prisma = {
      aiSession: {
        findFirst: vi.fn().mockResolvedValue(session),
        delete: vi.fn(),
      },
      $transaction: vi.fn(
        (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    }
    const service = new AiSessionsService(
      prisma as unknown as PrismaService,
      {
        assertAccess: vi.fn().mockResolvedValue(undefined),
      } as unknown as MerchantAccessService,
    )

    const archived = await service.setArchived(
      operator,
      'merchant-1',
      'session-1',
      true,
    )

    expect(archived.archivedAt).toBe(now.toISOString())
    expect(archived.pinned).toBe(false)
    expect(transaction.auditLog.create).toHaveBeenCalledOnce()
    await expect(
      service.remove(operator, 'merchant-1', 'session-1'),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(prisma.aiSession.delete).not.toHaveBeenCalled()
  })

  it('returns an explicit result after permanently deleting an archived session', async () => {
    const deleteSession = vi.fn().mockResolvedValue({})
    const service = new AiSessionsService(
      {
        aiSession: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'session-1',
            archivedAt: new Date(),
          }),
          delete: deleteSession,
        },
      } as unknown as PrismaService,
      {
        assertAccess: vi.fn().mockResolvedValue(undefined),
      } as unknown as MerchantAccessService,
    )

    await expect(
      service.remove(operator, 'merchant-1', 'session-1'),
    ).resolves.toEqual({ deleted: true })
    expect(deleteSession).toHaveBeenCalledWith({
      where: { id: 'session-1' },
    })
  })

  it('favorites a message through the owned session and writes an audit record', async () => {
    const now = new Date()
    const current = {
      id: 'message-1',
      sessionId: 'session-1',
      role: 'assistant',
      content: '建议',
      parentId: null,
      childrenIds: [],
      revisionJson: null,
      revisionIdx: 0,
      favorited: false,
      createdAt: now,
      links: [],
    }
    const transaction = {
      aiMessage: {
        update: vi.fn().mockResolvedValue({ ...current, favorited: true }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    const prisma = {
      aiSession: {
        findFirst: vi.fn().mockResolvedValue({ id: 'session-1' }),
      },
      aiMessage: { findFirst: vi.fn().mockResolvedValue(current) },
      $transaction: vi.fn(
        (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    }
    const service = new AiSessionsService(
      prisma as unknown as PrismaService,
      {
        assertAccess: vi.fn().mockResolvedValue(undefined),
      } as unknown as MerchantAccessService,
    )

    const result = await service.favoriteMessage(
      operator,
      'merchant-1',
      'session-1',
      'message-1',
      true,
    )

    expect(result.favorited).toBe(true)
    expect(transaction.auditLog.create).toHaveBeenCalledOnce()
  })

  it('links a message to a merchant product through its business code', async () => {
    const now = new Date()
    const createdLink = {
      id: 'link-1',
      entityType: 'PRODUCT',
      entityId: 'product-1',
      entityCode: 'P-DEMO-001',
      entityLabel: 'P-DEMO-001 · GaN 充电器',
      createdAt: now,
    }
    const transaction = {
      aiMessageLink: {
        upsert: vi.fn().mockResolvedValue(createdLink),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    const prisma = {
      aiSession: {
        findFirst: vi.fn().mockResolvedValue({ id: 'session-1' }),
      },
      aiMessage: {
        findFirst: vi.fn().mockResolvedValue({ id: 'message-1' }),
      },
      product: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'product-1',
          code: 'P-DEMO-001',
          title: 'GaN 充电器',
        }),
      },
      order: { findFirst: vi.fn() },
      $transaction: vi.fn(
        (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    }
    const service = new AiSessionsService(
      prisma as unknown as PrismaService,
      {
        assertAccess: vi.fn().mockResolvedValue(undefined),
      } as unknown as MerchantAccessService,
    )

    const result = await service.linkMessage(
      operator,
      'merchant-1',
      'session-1',
      'message-1',
      { entityType: 'PRODUCT', entityReference: 'P-DEMO-001' },
    )

    expect(result.entityCode).toBe('P-DEMO-001')
    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { merchantId: 'merchant-1', code: 'P-DEMO-001' },
      }),
    )
    expect(transaction.aiMessageLink.upsert).toHaveBeenCalledOnce()
    expect(transaction.auditLog.create).toHaveBeenCalledOnce()
  })

  it('redacts customer contact information from Markdown and JSON exports', async () => {
    const service = new AiSessionsService(
      {} as PrismaService,
      {} as MerchantAccessService,
    )
    vi.spyOn(service, 'get').mockResolvedValue({
      id: 'session-1',
      merchantId: 'merchant-1',
      userId: operator.id,
      title: '订单跟进',
      status: 'done',
      pinned: false,
      messageCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: 'message-1',
          sessionId: 'session-1',
          role: 'user',
          content:
            '客户 alice@example.com，电话 138-1234-5678，收货地址：深圳市南山区测试路 1 号',
          childrenIds: [],
          links: [],
          createdAt: new Date().toISOString(),
        },
      ],
    })

    const markdown = await service.export(
      operator,
      'merchant-1',
      'session-1',
      'markdown',
    )
    const json = await service.export(
      operator,
      'merchant-1',
      'session-1',
      'json',
    )

    expect(markdown.content).not.toContain('alice@example.com')
    expect(markdown.content).not.toContain('138-1234-5678')
    expect(markdown.content).not.toContain('深圳市南山区')
    expect(json.content).toContain('[邮箱已脱敏]')
    expect(json.content).toContain('[地址已脱敏]')
  })
})
