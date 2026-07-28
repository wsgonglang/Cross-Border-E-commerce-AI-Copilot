import { config } from 'dotenv'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { hash } from 'bcryptjs'

import { PrismaClient } from '../src/generated/prisma/client'

config({ path: '../../.env' })

if (process.env.NODE_ENV === 'production') {
  throw new Error('Development seed must not run in production')
}

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to seed the database')
}

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(databaseUrl),
})

const roleSeeds = [
  { code: 'admin', name: '管理员' },
  { code: 'operator', name: '运营人员' },
  { code: 'viewer', name: '只读用户' },
] as const

interface UserSeed {
  email: string
  name: string
  password: string
  roleCodes: string[]
}

const userSeeds: UserSeed[] = [
  {
    email: 'admin@copilot.local',
    name: '平台管理员',
    password: 'Demo123!',
    roleCodes: ['admin'],
  },
  {
    email: 'operator@copilot.local',
    name: '商品运营',
    password: 'Demo123!',
    roleCodes: ['operator'],
  },
  {
    email: 'viewer@copilot.local',
    name: '数据访客',
    password: 'Demo123!',
    roleCodes: ['viewer'],
  },
]

async function seed(): Promise<void> {
  const merchant = await prisma.merchant.upsert({
    where: { code: 'DEMO-US' },
    create: {
      code: 'DEMO-US',
      name: 'Demo 北美店铺',
      defaultCurrency: 'USD',
    },
    update: {
      name: 'Demo 北美店铺',
      status: 'ACTIVE',
      defaultCurrency: 'USD',
    },
  })

  const roles = await Promise.all(
    roleSeeds.map((role) =>
      prisma.role.upsert({
        where: { code: role.code },
        create: role,
        update: { name: role.name },
      }),
    ),
  )
  const roleIds = new Map(roles.map((role) => [role.code, role.id]))

  for (const userSeed of userSeeds) {
    const passwordHash = await hash(userSeed.password, 12)
    const user = await prisma.user.upsert({
      where: { email: userSeed.email },
      create: {
        email: userSeed.email,
        name: userSeed.name,
        passwordHash,
      },
      update: {
        name: userSeed.name,
        passwordHash,
        status: 'ACTIVE',
        deletedAt: null,
      },
    })

    await prisma.userRole.deleteMany({
      where: { userId: user.id },
    })

    await prisma.userRole.createMany({
      data: userSeed.roleCodes.map((roleCode) => {
        const roleId = roleIds.get(roleCode)
        if (!roleId) {
          throw new Error(`Missing seeded role: ${roleCode}`)
        }
        return {
          userId: user.id,
          roleId,
        }
      }),
    })

    await prisma.merchantUser.upsert({
      where: {
        merchantId_userId: {
          merchantId: merchant.id,
          userId: user.id,
        },
      },
      create: {
        merchantId: merchant.id,
        userId: user.id,
      },
      update: {},
    })
  }

  const product = await prisma.product.upsert({
    where: {
      merchantId_code: {
        merchantId: merchant.id,
        code: 'P-DEMO-001',
      },
    },
    create: {
      merchantId: merchant.id,
      code: 'P-DEMO-001',
      title: '便携式多口旅行充电器',
      description: '适合跨境旅行场景的多口 USB 充电器。',
      sellingPoints: ['多口输出', '便携设计', '适合跨境旅行'],
      language: 'zh-CN',
      status: 'ACTIVE',
    },
    update: {
      title: '便携式多口旅行充电器',
      description: '适合跨境旅行场景的多口 USB 充电器。',
      sellingPoints: ['多口输出', '便携设计', '适合跨境旅行'],
      language: 'zh-CN',
      status: 'ACTIVE',
    },
  })

  await prisma.sku.upsert({
    where: {
      merchantId_code: {
        merchantId: merchant.id,
        code: 'SKU-DEMO-BLACK',
      },
    },
    create: {
      merchantId: merchant.id,
      productId: product.id,
      code: 'SKU-DEMO-BLACK',
      name: '黑色 / 美规',
      price: '29.99',
      currency: 'USD',
      stock: 120,
    },
    update: {
      productId: product.id,
      name: '黑色 / 美规',
      price: '29.99',
      currency: 'USD',
      stock: 120,
      status: 'ACTIVE',
    },
  })

  // Demo orders
  const existingOrders = await prisma.order.count({
    where: { merchantId: merchant.id },
  })

  if (existingOrders === 0) {
    const now = new Date()
    const orderData = [
      {
        orderNo: 'ORD-20260701-001',
        status: 'COMPLETED' as const,
        customerName: 'Alice Johnson',
        customerEmail: 'alice@example.com',
        totalAmount: '89.97',
        createdAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
        items: [
          {
            productName: '便携式多口旅行充电器',
            skuName: '黑色 / 美规',
            quantity: 3,
            unitPrice: '29.99',
            subtotal: '89.97',
          },
        ],
      },
      {
        orderNo: 'ORD-20260705-002',
        status: 'COMPLETED' as const,
        customerName: 'Bob Smith',
        customerEmail: 'bob@example.com',
        totalAmount: '29.99',
        createdAt: new Date(now.getTime() - 16 * 24 * 60 * 60 * 1000),
        items: [
          {
            productName: '便携式多口旅行充电器',
            skuName: '黑色 / 美规',
            quantity: 1,
            unitPrice: '29.99',
            subtotal: '29.99',
          },
        ],
      },
      {
        orderNo: 'ORD-20260710-003',
        status: 'SHIPPED' as const,
        customerName: 'Carol Davis',
        customerEmail: 'carol@example.com',
        totalAmount: '59.98',
        createdAt: new Date(now.getTime() - 11 * 24 * 60 * 60 * 1000),
        items: [
          {
            productName: '便携式多口旅行充电器',
            skuName: '黑色 / 美规',
            quantity: 2,
            unitPrice: '29.99',
            subtotal: '59.98',
          },
        ],
      },
      {
        orderNo: 'ORD-20260715-004',
        status: 'CONFIRMED' as const,
        customerName: 'David Wilson',
        customerEmail: null,
        totalAmount: '29.99',
        createdAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
        items: [
          {
            productName: '便携式多口旅行充电器',
            skuName: '黑色 / 美规',
            quantity: 1,
            unitPrice: '29.99',
            subtotal: '29.99',
          },
        ],
      },
      {
        orderNo: 'ORD-20260720-005',
        status: 'PENDING' as const,
        customerName: 'Eva Martinez',
        customerEmail: 'eva@example.com',
        totalAmount: '89.97',
        createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        items: [
          {
            productName: '便携式多口旅行充电器',
            skuName: '黑色 / 美规',
            quantity: 3,
            unitPrice: '29.99',
            subtotal: '89.97',
          },
        ],
      },
    ]

    for (const order of orderData) {
      const { items, ...orderFields } = order
      await prisma.order.create({
        data: {
          ...orderFields,
          merchantId: merchant.id,
          currency: 'USD',
          items: {
            create: items.map((item) => ({
              ...item,
              productId: product.id,
              currency: 'USD',
            })),
          },
        },
      })
    }
  }
}

seed()
  .then(async () => prisma.$disconnect())
  .catch(async (error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Unknown seed error'}\n`,
    )
    await prisma.$disconnect()
    process.exitCode = 1
  })
