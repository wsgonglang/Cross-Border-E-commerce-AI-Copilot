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
import type {
  ImportRuleDocumentDto,
  SearchRuleDocumentsDto,
} from './dto/rule-document.dto'
import {
  toRuleDocumentDetail,
  toRuleDocumentSummary,
} from './rule-document.mapper'
import {
  chunkRuleContent,
  assessRuleRanking,
  rankRuleChunks,
  type RetrievalCandidate,
} from './rule-retrieval'

const documentInclude = { _count: { select: { chunks: true } } } as const
const RULE_CANDIDATE_LIMIT = 500

function optionalUpper(value?: string): string | null {
  return value?.trim().toUpperCase() || null
}

function optionalText(value?: string): string | null {
  return value?.trim() || null
}

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
    const market = optionalUpper(dto.market)
    const language = optionalText(dto.language)
    const category = optionalUpper(dto.category)
    const version = optionalText(dto.version)
    const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : null
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null
    if (effectiveFrom && effectiveTo && effectiveFrom >= effectiveTo) {
      throw new BadRequestException('规则失效时间必须晚于生效时间')
    }
    const superseded = dto.supersedesDocumentId
      ? await this.prisma.ruleDocument.findFirst({
          where: {
            id: dto.supersedesDocumentId,
            status: 'ACTIVE',
            platform,
            scope: dto.scope,
            merchantId,
          },
          select: { id: true },
        })
      : null
    if (dto.supersedesDocumentId && !superseded) {
      throw new BadRequestException(
        '被替代规则必须是同平台、同作用域中的有效文档',
      )
    }
    const contentHash = createHash('sha256')
      .update(
        JSON.stringify({
          merchantId,
          platform,
          market,
          language,
          category,
          effectiveFrom: effectiveFrom?.toISOString(),
          effectiveTo: effectiveTo?.toISOString(),
          version,
          supersedesDocumentId: superseded?.id ?? null,
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
          market,
          language,
          category,
          effectiveFrom,
          effectiveTo,
          version,
          supersedesDocumentId: superseded?.id,
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
      if (superseded) {
        await transaction.ruleDocument.update({
          where: { id: superseded.id },
          data: { status: 'ARCHIVED' },
        })
      }
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
            market,
            language,
            category,
            effectiveFrom: effectiveFrom?.toISOString(),
            effectiveTo: effectiveTo?.toISOString(),
            version,
            supersedesDocumentId: superseded?.id,
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
    input: string | SearchRuleDocumentsDto,
  ): Promise<RuleSearchResult> {
    await this.merchantAccess.assertAccess(user, merchantId)
    const dto = typeof input === 'string' ? { query: input } : input
    const query = dto.query
    const platform = optionalUpper(dto.platform)
    const market = optionalUpper(dto.market)
    const category = optionalUpper(dto.category)
    const asOf = dto.asOf ? new Date(dto.asOf) : new Date()
    const chunks = await this.prisma.ruleChunk.findMany({
      where: {
        document: {
          status: 'ACTIVE',
          OR: [{ merchantId: null }, { merchantId }],
          ...(platform ? { platform } : {}),
          AND: [
            ...(market ? [{ OR: [{ market: null }, { market }] }] : []),
            ...(category ? [{ OR: [{ category: null }, { category }] }] : []),
            { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: asOf } }] },
            { OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }] },
          ],
        },
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            platform: true,
            market: true,
            category: true,
            version: true,
            scope: true,
            sourceUrl: true,
          },
        },
      },
      orderBy: [{ documentId: 'asc' }, { sequence: 'asc' }],
      take: RULE_CANDIDATE_LIMIT + 1,
    })
    const truncated = chunks.length > RULE_CANDIDATE_LIMIT
    const candidates: RetrievalCandidate[] = chunks
      .slice(0, RULE_CANDIDATE_LIMIT)
      .map((chunk) => ({
        id: chunk.id,
        content: chunk.content,
        heading: chunk.heading,
        searchTerms: toStringArray(chunk.searchTerms),
        document: chunk.document,
      }))
    const ranked = rankRuleChunks(query, candidates)
    const assessment = assessRuleRanking(ranked)
    const sources = ranked.map((result, index) => ({
      citation: `R${index + 1}`,
      documentId: result.candidate.document.id,
      chunkId: result.candidate.id,
      title: result.candidate.document.title,
      platform: result.candidate.document.platform,
      market: result.candidate.document.market ?? undefined,
      category: result.candidate.document.category ?? undefined,
      version: result.candidate.document.version ?? undefined,
      scope: result.candidate.document.scope,
      sourceUrl: result.candidate.document.sourceUrl ?? undefined,
      heading: result.candidate.heading ?? undefined,
      excerpt: result.candidate.content,
      score: result.score,
      coverage: result.coverage,
    }))
    const sufficient = !truncated && assessment.sufficient
    const reason = truncated
      ? ('CANDIDATE_LIMIT_EXCEEDED' as const)
      : candidates.length === 0
        ? ('NO_CANDIDATES' as const)
        : sufficient
          ? ('MATCHED' as const)
          : ('LOW_RELEVANCE' as const)
    return {
      query,
      sufficient,
      reason,
      notice: truncated
        ? `可访问规则超过 ${RULE_CANDIDATE_LIMIT} 个引用块，本次结果不完整，不能据此判断平台合规性。`
        : sufficient
          ? '已检索到可访问规则文档，请根据引用核对原文、生效范围和来源。'
          : '当前可访问规则文档信息不足，不能据此判断平台合规性。',
      filters: {
        ...(platform ? { platform } : {}),
        ...(market ? { market } : {}),
        ...(category ? { category } : {}),
        asOf: asOf.toISOString(),
      },
      diagnostics: {
        candidateCount: candidates.length,
        candidateLimit: RULE_CANDIDATE_LIMIT,
        truncated,
        ...(assessment.topScore === undefined
          ? {}
          : { topScore: assessment.topScore }),
        ...(assessment.topCoverage === undefined
          ? {}
          : { topCoverage: assessment.topCoverage }),
        ...(assessment.scoreGap === undefined
          ? {}
          : { scoreGap: assessment.scoreGap }),
      },
      sources,
    }
  }
}
