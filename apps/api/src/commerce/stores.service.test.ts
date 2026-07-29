import type { AuthenticatedUser } from '@cross-border/shared'
import { ConflictException, NotFoundException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'

import type { PrismaService } from '../database/prisma.service'
import type { MerchantAccessService } from './merchant-access.service'
import { StoresService } from './stores.service'

const operator: AuthenticatedUser = {
  id: 'operator-1',
  email: 'operator@example.com',
  name: 'Operator',
  roles: ['operator'],
  merchantIds: ['merchant-1'],
}

function storeRecord(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-07-29T10:00:00.000Z')
  return {
    id: 'store-1',
    merchantId: 'merchant-1',
    code: 'AMZ-US',
    name: 'Amazon 美国店',
    platform: 'Amazon',
    market: 'US',
    currency: 'USD',
    locale: 'en-US',
    timezone: 'America/Los_Angeles',
    status: 'ACTIVE' as const,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('StoresService', () => {
  it('creates a store inside the authorized merchant and records an audit', async () => {
    const transaction = {
      store: { create: vi.fn().mockResolvedValue(storeRecord()) },
      auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    }
    const prisma = {
      $transaction: vi.fn(
        (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    }
    const assertAccess = vi.fn().mockResolvedValue(undefined)
    const service = new StoresService(
      prisma as unknown as PrismaService,
      { assertAccess } as unknown as MerchantAccessService,
    )

    const result = await service.create(operator, 'merchant-1', {
      code: 'AMZ-US',
      name: 'Amazon 美国店',
      platform: 'Amazon',
      market: 'us',
      currency: 'usd',
      locale: 'en-US',
      timezone: 'America/Los_Angeles',
    })

    expect(result).toMatchObject({
      id: 'store-1',
      merchantId: 'merchant-1',
      market: 'US',
      currency: 'USD',
    })
    expect(assertAccess).toHaveBeenCalledWith(operator, 'merchant-1')
    expect(transaction.store.create).toHaveBeenCalledWith({
      data: {
        code: 'AMZ-US',
        name: 'Amazon 美国店',
        platform: 'Amazon',
        merchantId: 'merchant-1',
        market: 'US',
        currency: 'USD',
        locale: 'en-US',
        timezone: 'America/Los_Angeles',
      },
    })
    expect(transaction.auditLog.create).toHaveBeenCalledOnce()
  })

  it('rejects a listing when its currency does not match the selected store', async () => {
    const prisma = {
      store: { findFirst: vi.fn().mockResolvedValue(storeRecord()) },
      product: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'product-1',
          merchantId: 'merchant-1',
        }),
      },
    }
    const service = new StoresService(
      prisma as unknown as PrismaService,
      {
        assertAccess: vi.fn().mockResolvedValue(undefined),
      } as unknown as MerchantAccessService,
    )

    await expect(
      service.createListing(operator, 'merchant-1', 'store-1', {
        productId: 'product-1',
        title: 'Travel Charger',
        description: 'Description',
        language: 'en-US',
        price: '29.99',
        currency: 'BRL',
      }),
    ).rejects.toBeInstanceOf(ConflictException)
  })

  it('uses merchant and store together when resolving the active context', async () => {
    const findFirst = vi.fn().mockResolvedValue(null)
    const service = new StoresService(
      { store: { findFirst } } as unknown as PrismaService,
      {
        assertAccess: vi.fn().mockResolvedValue(undefined),
      } as unknown as MerchantAccessService,
    )

    await expect(
      service.assertStore(operator, 'merchant-1', 'store-from-merchant-2'),
    ).rejects.toBeInstanceOf(NotFoundException)
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: 'store-from-merchant-2',
        merchantId: 'merchant-1',
        status: 'ACTIVE',
      },
    })
  })
})
