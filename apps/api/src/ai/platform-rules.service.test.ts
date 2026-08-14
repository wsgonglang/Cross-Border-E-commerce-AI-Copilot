import type { AuthenticatedUser } from '@cross-border/shared'
import { describe, expect, it, vi } from 'vitest'

import { MerchantAccessService } from '../commerce/merchant-access.service'
import { PrismaService } from '../database/prisma.service'
import { PlatformRulesService } from './platform-rules.service'
import { buildSearchTerms } from './rule-retrieval'

const admin: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: '管理员',
  roles: ['admin'],
  merchantIds: ['merchant-1'],
}

const viewer: AuthenticatedUser = {
  ...admin,
  id: 'viewer-1',
  email: 'viewer@example.com',
  roles: ['viewer'],
}

function chunk(
  id: string,
  documentId: string,
  content: string,
  merchantId: string | null = null,
) {
  return {
    id,
    documentId,
    sequence: 0,
    heading: '发布要求',
    content,
    searchTerms: buildSearchTerms(content),
    createdAt: new Date(),
    document: {
      id: documentId,
      merchantId,
      title: '电器商品发布规范',
      platform: 'DEMO_MARKETPLACE',
      market: null,
      category: null,
      version: null,
      scope: merchantId ? ('MERCHANT' as const) : ('GLOBAL' as const),
      sourceUrl: 'https://example.invalid/rules/electrical',
    },
  }
}

function service(prisma: object) {
  const access = { assertAccess: vi.fn().mockResolvedValue(undefined) }
  return {
    rules: new PlatformRulesService(
      prisma as PrismaService,
      access as unknown as MerchantAccessService,
    ),
    access,
  }
}

describe('PlatformRulesService', () => {
  it('retrieves traceable sources from global and current-merchant scope', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([
        chunk(
          'chunk-global',
          'doc-global',
          '充电器发布前必须核对插头、电压和目标市场安全认证。',
        ),
        chunk(
          'chunk-merchant',
          'doc-merchant',
          '当前商家要求充电器认证资料由运营主管复核。',
          'merchant-1',
        ),
      ])
    const { rules, access } = service({
      ruleChunk: { findMany },
    })

    const result = await rules.search(
      viewer,
      'merchant-1',
      '充电器需要核对哪些认证',
    )

    expect(access.assertAccess).toHaveBeenCalledWith(viewer, 'merchant-1')
    const query = findMany.mock.calls[0]?.[0] as {
      where: {
        document: {
          status: string
          OR: Array<{ merchantId: string | null }>
        }
      }
    }
    expect(query.where.document).toMatchObject({
      status: 'ACTIVE',
      OR: [{ merchantId: null }, { merchantId: 'merchant-1' }],
    })
    expect(result.sufficient, JSON.stringify(result)).toBe(true)
    expect(result.sources[0]).toMatchObject({
      citation: 'R1',
      platform: 'DEMO_MARKETPLACE',
    })
    expect(result.sources[0]?.chunkId).toBeTruthy()
  })

  it('states that accessible documents are insufficient instead of inventing a rule', async () => {
    const { rules } = service({
      ruleChunk: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            chunk('chunk-1', 'doc-1', '商品标题不得使用绝对化声明。'),
          ]),
      },
    })

    const result = await rules.search(
      viewer,
      'merchant-1',
      '宠物食品冷链温度是多少',
    )

    expect(result.sufficient).toBe(false)
    expect(result.sources).toEqual([])
    expect(result.notice).toContain('信息不足')
  })

  it('applies platform, market, category and effective-time filters before ranking', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const { rules } = service({ ruleChunk: { findMany } })

    await rules.search(viewer, 'merchant-1', {
      query: '充电器认证',
      platform: 'amazon',
      market: 'us',
      category: 'electronics',
      asOf: '2026-08-01T00:00:00.000Z',
    })

    const searchInput = findMany.mock.calls[0]?.[0] as {
      where: { document: Record<string, unknown> & { AND: unknown } }
    }
    const documentWhere = searchInput.where.document
    expect(documentWhere).toMatchObject({
      platform: 'AMAZON',
      status: 'ACTIVE',
      OR: [{ merchantId: null }, { merchantId: 'merchant-1' }],
    })
    expect(JSON.stringify(documentWhere.AND)).toContain('US')
    expect(JSON.stringify(documentWhere.AND)).toContain('ELECTRONICS')
    expect(JSON.stringify(documentWhere.AND)).toContain('effectiveFrom')
    expect(JSON.stringify(documentWhere.AND)).toContain('effectiveTo')
  })

  it('marks a search incomplete instead of silently trusting over 500 candidates', async () => {
    const chunks = Array.from({ length: 501 }, (_, index) => ({
      ...chunk(
        `chunk-${index}`,
        `doc-${index}`,
        '充电器发布前必须核对目标市场安全认证。',
      ),
    }))
    const { rules } = service({
      ruleChunk: { findMany: vi.fn().mockResolvedValue(chunks) },
    })

    const result = await rules.search(viewer, 'merchant-1', '充电器安全认证')

    expect(result).toMatchObject({
      sufficient: false,
      reason: 'CANDIDATE_LIMIT_EXCEEDED',
      diagnostics: { candidateCount: 500, truncated: true },
    })
  })

  it('imports immutable source text, chunks, and audit in one transaction', async () => {
    const now = new Date()
    const transaction = {
      ruleDocument: {
        create: vi.fn().mockImplementation(({ data }: { data: object }) => ({
          id: 'document-1',
          merchantId: 'merchant-1',
          createdById: admin.id,
          title: '商家标题规范',
          platform: 'DEMO_MARKETPLACE',
          scope: 'MERCHANT',
          sourceUrl: null,
          content:
            '# 标题要求\n\n标题不得堆砌关键词，也不得包含无法证明的排名声明。',
          contentHash: 'a'.repeat(64),
          status: 'ACTIVE',
          createdAt: now,
          updatedAt: now,
          _count: { chunks: 1 },
          data,
        })),
      },
      auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    }
    const prisma = {
      ruleDocument: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(
        (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    }
    const { rules } = service(prisma)

    const result = await rules.import(admin, 'merchant-1', {
      title: '商家标题规范',
      platform: 'demo_marketplace',
      scope: 'MERCHANT',
      content:
        '# 标题要求\n\n标题不得堆砌关键词，也不得包含无法证明的排名声明。',
    })

    expect(result.chunkCount).toBe(1)
    const createInput = transaction.ruleDocument.create.mock.calls[0]?.[0] as {
      data: {
        merchantId: string
        chunks: { create: Array<{ searchTerms: unknown }> }
      }
    }
    expect(createInput.data.merchantId).toBe('merchant-1')
    expect(createInput.data.chunks.create).toHaveLength(1)
    expect(transaction.auditLog.create).toHaveBeenCalledOnce()
  })

  it('rejects duplicate active content in the same scope', async () => {
    const { rules } = service({
      ruleDocument: {
        findFirst: vi.fn().mockResolvedValue({ id: 'existing-document' }),
      },
    })

    await expect(
      rules.import(admin, 'merchant-1', {
        title: '重复规则文档',
        platform: 'DEMO_MARKETPLACE',
        scope: 'GLOBAL',
        content: '这是一份已经导入过的规则原文，内容长度满足导入要求。',
      }),
    ).rejects.toThrow('已存在内容一致的有效文档')
  })

  it('archives the previous active version in the same import transaction', async () => {
    const now = new Date()
    const transaction = {
      ruleDocument: {
        create: vi.fn().mockImplementation(({ data }: { data: object }) => ({
          id: 'document-v2',
          merchantId: 'merchant-1',
          createdById: admin.id,
          title: '电器规范',
          platform: 'AMAZON',
          market: 'US',
          language: 'zh-CN',
          category: 'ELECTRONICS',
          effectiveFrom: now,
          effectiveTo: null,
          version: '2.0',
          supersedesDocumentId: 'document-v1',
          scope: 'MERCHANT',
          sourceUrl: null,
          content: '充电器发布前必须核对安全认证，规则正文满足最小长度。',
          contentHash: 'b'.repeat(64),
          status: 'ACTIVE',
          createdAt: now,
          updatedAt: now,
          _count: { chunks: 1 },
          data,
        })),
        update: vi.fn().mockResolvedValue(undefined),
      },
      auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    }
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce({ id: 'document-v1' })
      .mockResolvedValueOnce(null)
    const { rules } = service({
      ruleDocument: { findFirst },
      $transaction: vi.fn(
        (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    })

    await rules.import(admin, 'merchant-1', {
      title: '电器规范',
      platform: 'amazon',
      market: 'us',
      language: 'zh-CN',
      category: 'electronics',
      version: '2.0',
      effectiveFrom: now.toISOString(),
      supersedesDocumentId: 'document-v1',
      scope: 'MERCHANT',
      content: '充电器发布前必须核对安全认证，规则正文满足最小长度。',
    })

    expect(transaction.ruleDocument.update).toHaveBeenCalledWith({
      where: { id: 'document-v1' },
      data: { status: 'ARCHIVED' },
    })
    const createInput = transaction.ruleDocument.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>
    }
    expect(createInput.data).toMatchObject({
      market: 'US',
      category: 'ELECTRONICS',
      version: '2.0',
      supersedesDocumentId: 'document-v1',
    })
  })
})
