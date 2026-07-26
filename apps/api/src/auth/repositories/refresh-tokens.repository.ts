import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../database/prisma.service'
import type { AuthUserRecord } from '../auth.types'
import { toAuthUserRecord } from '../user-record.mapper'

interface CreateRefreshTokenInput {
  userId: string
  tokenHash: string
  familyId: string
  expiresAt: Date
}

interface RotateRefreshTokenInput {
  currentTokenHash: string
  nextTokenHash: string
  nextExpiresAt: Date
}

@Injectable()
export class RefreshTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateRefreshTokenInput): Promise<void> {
    await this.prisma.refreshToken.create({
      data: input,
    })
  }

  async rotate(input: RotateRefreshTokenInput): Promise<AuthUserRecord | null> {
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.refreshToken.findUnique({
        where: {
          tokenHash: input.currentTokenHash,
        },
        include: {
          user: {
            include: {
              userRoles: {
                include: {
                  role: true,
                },
              },
            },
          },
        },
      })

      if (!current) {
        return null
      }

      const isInvalid =
        current.revokedAt !== null ||
        current.expiresAt.getTime() <= Date.now() ||
        current.user.status !== 'ACTIVE' ||
        current.user.deletedAt !== null

      if (isInvalid) {
        await transaction.refreshToken.updateMany({
          where: {
            familyId: current.familyId,
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
          },
        })
        return null
      }

      const consumed = await transaction.refreshToken.updateMany({
        where: {
          id: current.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      })

      if (consumed.count !== 1) {
        await transaction.refreshToken.updateMany({
          where: {
            familyId: current.familyId,
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
          },
        })
        return null
      }

      await transaction.refreshToken.create({
        data: {
          userId: current.userId,
          familyId: current.familyId,
          tokenHash: input.nextTokenHash,
          expiresAt: input.nextExpiresAt,
        },
      })

      return toAuthUserRecord(current.user)
    })
  }

  async revoke(tokenHash: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    })
  }
}
