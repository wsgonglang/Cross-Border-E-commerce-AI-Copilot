import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type {
  AuthenticatedUser,
  RuleDocumentDetail,
  RuleDocumentSummary,
  RuleSearchResult,
} from '@cross-border/shared'
import { createHash } from 'node:crypto'

import { asJson, toStringArray } from '../commerce/commerce.utils'
import { MerchantAccessService } from '../commerce/merchant-access.service'
import { PrismaService } from '../database/prisma.service'
import type { ImportRuleDocumentDto } from './dto/rule-document.dto'
import {
  toRuleDocumentDetail,
  toRuleDocumentSummary,
} from './rule-document.mapper'
import {
  chunkRuleContent,
  rankRuleChunks,
  type RetrievalCandidate,
} from './rule-retrieval'

const documentInclude = { _count: { select: { chunks: true } } } as const

@Injectable()
export class PlatformRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly merchantAccess: MerchantAccessService,
  ) {}

  async list(
    user: AuthenticatedUser,
    merchantId: string,
  ): Promise<RuleDocumentSummary[]> {
    await this.merchantAccess.assertAccess(user, merchantId)
    const documents = await this.prisma.ruleDocument.findMany({
      where: {
        OR: [{ merchantId: null }, { merchantId }],
      },
      include: documentInclude,
      orderBy: { createdAt: 'desc' },
    })
    return documents.map(toRuleDocumentSummary)
  }

  async get(
    user: AuthenticatedUser,
    merchantId: string,
    documentId: string,
  ): Promise<RuleDocumentDetail> {
    await this.merchantAccess.assertAccess(user, merchantId)
    const document = await this.prisma.ruleDocument.findFirst({
      where: {
        id: documentId,
        OR: [{ merchantId: null }, { merchantId }],
      },
      include: documentInclude,
    })
    if (!document) throw new NotFoundException('规则文档不存在')
    return toRuleDocumentDetail(document)
  }

  async import(
    actor: AuthenticatedUser,
    auditMerchantId: string,
    dto: ImportRuleDocumentDto,
  ): Promise<RuleDocumentDetail> {
    await this.merchantAccess.assertAccess(actor, auditMerchantId)
    const merchantId = dto.scope === 'MERCHANT' ? auditMerchantId : null
    const normalizedContent = dto.content.replace(/\r\n?/g, '\n').trim()
    const title = dto.title.trim()
    const platform = dto.platform.trim().toUpperCase()
    const contentHash = createHash('sha256')
      .update(
        JSON.stringify({
          merchantId,
          platform,
          title,
          content: normalizedContent,
        }),
      )
      .digest('hex')
    const duplicate = await this.prisma.ruleDocument.findFirst({
      where: { merchantId, contentHash, status: 'ACTIVE' },
      select: { id: true },
    })
    if (duplicate) {
      throw new ConflictException('相同作用域中已存在内容一致的有效文档')
    }

    const chunks = chunkRuleContent(normalizedContent)
    if (chunks.length === 0) {
      throw new BadRequestException('规则原文必须包含可检索的正文')
    }
    const created = await this.prisma.$transaction(async (transaction) => {
      const document = await transaction.ruleDocument.create({
        data: {
          merchantId,
          createdById: actor.id,
          title,
          platform,
          scope: dto.scope,
          sourceUrl: dto.sourceUrl?.trim() || null,
          content: normalizedContent,
          contentHash,
          chunks: {
            create: chunks.map((chunk) => ({
              sequence: chunk.sequence,
              heading: chunk.heading,
              content: chunk.content,
              searchTerms: asJson(chunk.searchTerms),
            })),
          },
        },
        include: documentInclude,
      })
      await transaction.auditLog.create({
        data: {
          merchantId: auditMerchantId,
          actorUserId: actor.id,
          entityType: 'RULE_DOCUMENT',
          entityId: document.id,
          action: 'IMPORT',
          afterData: asJson({
            scope: dto.scope,
            merchantId,
            title: document.title,
            platform: document.platform,
            contentHash,
            chunkCount: chunks.length,
          }),
        },
      })
      return document
    })
    return toRuleDocumentDetail(created)
  }

  async archive(
    actor: AuthenticatedUser,
    auditMerchantId: string,
    documentId: string,
  ): Promise<RuleDocumentSummary> {
    await this.merchantAccess.assertAccess(actor, auditMerchantId)
    const current = await this.prisma.ruleDocument.findFirst({
      where: {
        id: documentId,
        OR: [{ merchantId: null }, { merchantId: auditMerchantId }],
      },
      include: documentInclude,
    })
    if (!current) throw new NotFoundException('规则文档不存在')
    if (current.status === 'ARCHIVED') return toRuleDocumentSummary(current)

    const archived = await this.prisma.$transaction(async (transaction) => {
      const document = await transaction.ruleDocument.update({
        where: { id: documentId },
        data: { status: 'ARCHIVED' },
        include: documentInclude,
      })
      await transaction.auditLog.create({
        data: {
          merchantId: auditMerchantId,
          actorUserId: actor.id,
          entityType: 'RULE_DOCUMENT',
          entityId: documentId,
          action: 'ARCHIVE',
          beforeData: asJson({ status: current.status }),
          afterData: asJson({ status: 'ARCHIVED' }),
        },
      })
      return document
    })
    return toRuleDocumentSummary(archived)
  }

  async search(
    user: AuthenticatedUser,
    merchantId: string,
    query: string,
  ): Promise<RuleSearchResult> {
    await this.merchantAccess.assertAccess(user, merchantId)
    const chunks = await this.prisma.ruleChunk.findMany({
      where: {
        document: {
          status: 'ACTIVE',
          OR: [{ merchantId: null }, { merchantId }],
        },
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            platform: true,
            scope: true,
            sourceUrl: true,
          },
        },
      },
      orderBy: [{ documentId: 'asc' }, { sequence: 'asc' }],
      take: 500,
    })
    const candidates: RetrievalCandidate[] = chunks.map((chunk) => ({
      id: chunk.id,
      content: chunk.content,
      heading: chunk.heading,
      searchTerms: toStringArray(chunk.searchTerms),
      document: chunk.document,
    }))
    const ranked = rankRuleChunks(query, candidates)
    const sources = ranked.map((result, index) => ({
      citation: `R${index + 1}`,
      documentId: result.candidate.document.id,
      chunkId: result.candidate.id,
      title: result.candidate.document.title,
      platform: result.candidate.document.platform,
      scope: result.candidate.document.scope,
      sourceUrl: result.candidate.document.sourceUrl ?? undefined,
      heading: result.candidate.heading ?? undefined,
      excerpt: result.candidate.content,
      score: result.score,
    }))
    return {
      query,
      sufficient: sources.length > 0,
      notice:
        sources.length > 0
          ? '已检索到可访问规则文档，请根据引用核对原文、生效范围和来源。'
          : '当前可访问规则文档信息不足，不能据此判断平台合规性。',
      sources,
    }
  }
}
