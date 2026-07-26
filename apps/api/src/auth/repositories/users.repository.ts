import { Injectable } from '@nestjs/common'
import type { AuthenticatedUser } from '@cross-border/shared'

import { PrismaService } from '../../database/prisma.service'
import type { AuthUserRecord } from '../auth.types'
import { toAuthUserRecord } from '../user-record.mapper'

const authUserInclude = {
  userRoles: {
    include: {
      role: true,
    },
  },
} as const

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<AuthUserRecord | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
      include: authUserInclude,
    })

    return user ? toAuthUserRecord(user) : null
  }

  async findById(id: string): Promise<AuthUserRecord | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: authUserInclude,
    })

    return user ? toAuthUserRecord(user) : null
  }

  async list(): Promise<AuthenticatedUser[]> {
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
      },
      include: authUserInclude,
      orderBy: {
        createdAt: 'asc',
      },
    })

    return users.map((user) => {
      const record = toAuthUserRecord(user)
      return {
        id: record.id,
        email: record.email,
        name: record.name,
        roles: record.roles,
      }
    })
  }
}
