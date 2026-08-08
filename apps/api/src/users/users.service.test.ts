import { BadRequestException, ConflictException } from '@nestjs/common'
import type { AuthenticatedUser } from '@cross-border/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PrismaService } from '../database/prisma.service'
import { UsersService } from './users.service'

const actor: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@copilot.local',
  name: '平台管理员',
  roles: ['admin'],
  merchantIds: ['merchant-1'],
}

const baseRecord = {
  id: 'user-1',
  email: 'operator@copilot.local',
  name: '商品运营',
  passwordHash: 'hash',
  status: 'ACTIVE' as const,
  deletedAt: null,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  userRoles: [{ role: { code: 'operator' } }],
  merchantUsers: [{ merchantId: 'merchant-1' }],
}

function createTransaction() {
  return {
    role: { findMany: vi.fn().mockResolvedValue([{ id: 'role-operator' }]) },
    merchant: { count: vi.fn().mockResolvedValue(1) },
    user: {
      create: vi.fn().mockResolvedValue(baseRecord),
      findFirst: vi.fn().mockResolvedValue(baseRecord),
      findUniqueOrThrow: vi.fn().mockResolvedValue(baseRecord),
      update: vi.fn().mockResolvedValue(baseRecord),
      count: vi.fn().mockResolvedValue(1),
    },
    userRole: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    merchantUser: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    refreshToken: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
  }
}

describe('UsersService', () => {
  let transaction: ReturnType<typeof createTransaction>
  let service: UsersService

  beforeEach(() => {
    transaction = createTransaction()
    const prisma = {
      $transaction: vi.fn(
        (callback: (value: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    }
    service = new UsersService(prisma as unknown as PrismaService)
  })

  it('creates a user with roles, merchant scope and an audit record', async () => {
    const result = await service.create(actor, {
      email: ' OPERATOR@copilot.local ',
      name: '商品运营',
      password: 'Demo123!',
      roles: ['operator'],
      merchantIds: ['merchant-1'],
    })

    const createCall = transaction.user.create.mock.calls[0]?.[0] as {
      data: { email: string; passwordHash: string }
    }
    expect(createCall.data.email).toBe('operator@copilot.local')
    expect(createCall.data.passwordHash).toEqual(expect.any(String))
    expect(transaction.auditLog.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ entityType: 'USER', action: 'CREATE' })],
    })
    expect(result).toMatchObject({ email: 'operator@copilot.local' })
  })

  it('prevents the current administrator from disabling itself', async () => {
    transaction.user.findFirst.mockResolvedValue({
      ...baseRecord,
      id: actor.id,
      userRoles: [{ role: { code: 'admin' } }],
    })

    await expect(
      service.update(actor, actor.id, { status: 'DISABLED' }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(transaction.user.update).not.toHaveBeenCalled()
  })

  it('keeps at least one enabled administrator', async () => {
    transaction.user.findFirst.mockResolvedValue({
      ...baseRecord,
      id: 'admin-2',
      userRoles: [{ role: { code: 'admin' } }],
    })
    transaction.user.count.mockResolvedValue(0)

    await expect(service.remove(actor, 'admin-2')).rejects.toBeInstanceOf(
      ConflictException,
    )
    expect(transaction.user.update).not.toHaveBeenCalled()
  })

  it('soft deletes a user, revokes refresh tokens and retains an audit trail', async () => {
    await expect(service.remove(actor, 'user-1')).resolves.toEqual({
      id: 'user-1',
    })

    const deleteCall = transaction.user.update.mock.calls[0]?.[0] as {
      where: { id: string }
      data: { status: string; deletedAt: Date }
    }
    expect(deleteCall.where).toEqual({ id: 'user-1' })
    expect(deleteCall.data.status).toBe('DISABLED')
    expect(deleteCall.data.deletedAt).toBeInstanceOf(Date)
    expect(transaction.refreshToken.updateMany).toHaveBeenCalled()
    expect(transaction.auditLog.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ entityType: 'USER', action: 'DELETE' })],
    })
  })
})
