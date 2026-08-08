import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type {
  AuthenticatedUser,
  RoleCode,
  UserSummary,
} from '@cross-border/shared'
import { hash } from 'bcryptjs'

import { asJson, rethrowUniqueConstraint } from '../commerce/commerce.utils'
import { PrismaService } from '../database/prisma.service'
import type { Prisma } from '../generated/prisma/client'
import type { CreateUserDto, UpdateUserDto } from './dto/user.dto'

const userInclude = {
  userRoles: { include: { role: true } },
  merchantUsers: { select: { merchantId: true } },
} as const

type UserRecord = Prisma.UserGetPayload<{ include: typeof userInclude }>
type Transaction = Parameters<Parameters<PrismaService['$transaction']>[0]>[0]

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<UserSummary[]> {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      include: userInclude,
      orderBy: { createdAt: 'asc' },
    })
    return users.map(toUserSummary)
  }

  async create(
    actor: AuthenticatedUser,
    dto: CreateUserDto,
  ): Promise<UserSummary> {
    const passwordHash = await hash(dto.password, 12)
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const roleIds = await this.resolveRoleIds(transaction, dto.roles)
        await this.assertMerchants(transaction, dto.merchantIds)
        const user = await transaction.user.create({
          data: {
            email: normalizeEmail(dto.email),
            name: dto.name.trim(),
            passwordHash,
            userRoles: {
              create: roleIds.map((roleId) => ({ roleId })),
            },
            merchantUsers: {
              create: dto.merchantIds.map((merchantId) => ({ merchantId })),
            },
          },
          include: userInclude,
        })
        const summary = toUserSummary(user)
        await this.writeAudits(transaction, actor.id, dto.merchantIds, {
          entityId: user.id,
          action: 'CREATE',
          afterData: asJson(summary),
        })
        return summary
      })
    } catch (error: unknown) {
      rethrowUniqueConstraint(error, '该邮箱已存在')
    }
  }

  async update(
    actor: AuthenticatedUser,
    userId: string,
    dto: UpdateUserDto,
  ): Promise<UserSummary> {
    const nextPasswordHash = dto.password ? await hash(dto.password, 12) : null
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const current = await transaction.user.findFirst({
          where: { id: userId, deletedAt: null },
          include: userInclude,
        })
        if (!current) throw new NotFoundException('用户不存在')

        const before = toUserSummary(current)
        const nextRoles = dto.roles ?? before.roles
        const nextMerchantIds = dto.merchantIds ?? before.merchantIds
        const nextStatus = dto.status ?? before.status

        this.assertSelfManagement(actor, current, nextRoles, nextStatus)
        await this.assertLastAdmin(transaction, current, nextRoles, nextStatus)
        await this.assertMerchants(transaction, nextMerchantIds)
        const roleIds = dto.roles
          ? await this.resolveRoleIds(transaction, dto.roles)
          : []

        await transaction.user.update({
          where: { id: userId },
          data: {
            ...(dto.email ? { email: normalizeEmail(dto.email) } : {}),
            ...(dto.name ? { name: dto.name.trim() } : {}),
            ...(nextPasswordHash ? { passwordHash: nextPasswordHash } : {}),
            ...(dto.status ? { status: dto.status } : {}),
          },
        })

        if (dto.roles) {
          await transaction.userRole.deleteMany({ where: { userId } })
          await transaction.userRole.createMany({
            data: roleIds.map((roleId) => ({ userId, roleId })),
          })
        }
        if (dto.merchantIds) {
          await transaction.merchantUser.deleteMany({ where: { userId } })
          await transaction.merchantUser.createMany({
            data: dto.merchantIds.map((merchantId) => ({
              userId,
              merchantId,
            })),
          })
        }
        if (dto.password || dto.status === 'DISABLED') {
          await transaction.refreshToken.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
          })
        }

        const updated = await transaction.user.findUniqueOrThrow({
          where: { id: userId },
          include: userInclude,
        })
        const after = toUserSummary(updated)
        await this.writeAudits(
          transaction,
          actor.id,
          [...new Set([...before.merchantIds, ...after.merchantIds])],
          {
            entityId: userId,
            action: 'UPDATE',
            beforeData: asJson(before),
            afterData: asJson({
              ...after,
              passwordChanged: Boolean(dto.password),
            }),
          },
        )
        return after
      })
    } catch (error: unknown) {
      rethrowUniqueConstraint(error, '该邮箱已存在')
    }
  }

  async remove(
    actor: AuthenticatedUser,
    userId: string,
  ): Promise<{ id: string }> {
    if (actor.id === userId) {
      throw new BadRequestException('不能删除当前登录用户')
    }
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.user.findFirst({
        where: { id: userId, deletedAt: null },
        include: userInclude,
      })
      if (!current) throw new NotFoundException('用户不存在')
      await this.assertLastAdmin(transaction, current, [], 'DISABLED')
      const before = toUserSummary(current)
      await transaction.user.update({
        where: { id: userId },
        data: { status: 'DISABLED', deletedAt: new Date() },
      })
      await transaction.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      await this.writeAudits(transaction, actor.id, before.merchantIds, {
        entityId: userId,
        action: 'DELETE',
        beforeData: asJson(before),
      })
      return { id: userId }
    })
  }

  private assertSelfManagement(
    actor: AuthenticatedUser,
    current: UserRecord,
    nextRoles: RoleCode[],
    nextStatus: UserSummary['status'],
  ): void {
    if (actor.id !== current.id) return
    if (nextStatus === 'DISABLED') {
      throw new BadRequestException('不能停用当前登录用户')
    }
    if (!nextRoles.includes('admin')) {
      throw new BadRequestException('不能移除当前登录用户的管理员角色')
    }
  }

  private async assertLastAdmin(
    transaction: Transaction,
    current: UserRecord,
    nextRoles: RoleCode[],
    nextStatus: UserSummary['status'],
  ): Promise<void> {
    const wasActiveAdmin =
      current.status === 'ACTIVE' &&
      current.userRoles.some(({ role }) => role.code === 'admin')
    const remainsActiveAdmin =
      nextStatus === 'ACTIVE' && nextRoles.includes('admin')
    if (!wasActiveAdmin || remainsActiveAdmin) return

    const otherActiveAdmins = await transaction.user.count({
      where: {
        id: { not: current.id },
        status: 'ACTIVE',
        deletedAt: null,
        userRoles: { some: { role: { code: 'admin' } } },
      },
    })
    if (otherActiveAdmins === 0) {
      throw new ConflictException('系统必须至少保留一个启用中的管理员')
    }
  }

  private async resolveRoleIds(
    transaction: Transaction,
    roles: RoleCode[],
  ): Promise<string[]> {
    const records = await transaction.role.findMany({
      where: { code: { in: roles } },
      select: { id: true },
    })
    if (records.length !== roles.length) {
      throw new BadRequestException('包含不存在的角色')
    }
    return records.map(({ id }) => id)
  }

  private async assertMerchants(
    transaction: Transaction,
    merchantIds: string[],
  ): Promise<void> {
    const count = await transaction.merchant.count({
      where: { id: { in: merchantIds } },
    })
    if (count !== merchantIds.length) {
      throw new BadRequestException('包含不存在的商家')
    }
  }

  private async writeAudits(
    transaction: Transaction,
    actorUserId: string,
    merchantIds: string[],
    data: {
      entityId: string
      action: string
      beforeData?: Prisma.InputJsonValue
      afterData?: Prisma.InputJsonValue
    },
  ): Promise<void> {
    await transaction.auditLog.createMany({
      data: merchantIds.map((merchantId) => ({
        merchantId,
        actorUserId,
        entityType: 'USER',
        ...data,
      })),
    })
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function toUserSummary(user: UserRecord): UserSummary {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    roles: user.userRoles
      .map(({ role }) => role.code)
      .filter((role): role is RoleCode =>
        ['admin', 'operator', 'viewer'].includes(role),
      ),
    merchantIds: user.merchantUsers.map(({ merchantId }) => merchantId),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}
