import { config } from 'dotenv'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { hash } from 'bcryptjs'

import { createRuleDocumentFingerprint } from '../src/ai/rule-document-fingerprint'
import { chunkRuleContent } from '../src/ai/rule-retrieval'
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

  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: 'admin@copilot.local' },
    select: { id: true },
  })

  const ruleDocuments = [
    {
      id: 'rule_demo_electric_001',
      merchantId: null,
      title: '演示平台电器商品发布规范',
      platform: 'DEMO_MARKETPLACE',
      market: null,
      language: 'zh-CN',
      category: 'ELECTRONICS',
      effectiveFrom: null,
      effectiveTo: null,
      version: '2026.1',
      supersedesDocumentId: null,
      scope: 'GLOBAL' as const,
      status: 'ACTIVE' as const,
      sourceUrl: 'https://example.invalid/rules/electrical-products',
      content: `# 电器商品信息要求

充电器、转换插头等电器商品发布前，运营人员必须核对目标市场适用的插头类型、输入电压、输出功率和安全认证。资料不完整时，不得声称商品已经通过当地认证。

## 标题与详情

标题和详情页不得使用无法验证的“全球通用”“绝对安全”等保证性表述。认证编号和检测结论必须与可追溯资料一致。`,
    },
    {
      id: 'rule_demo_claims_001',
      merchantId: null,
      title: '演示平台标题与营销声明规范',
      platform: 'DEMO_MARKETPLACE',
      market: null,
      language: 'zh-CN',
      category: 'LISTING',
      effectiveFrom: null,
      effectiveTo: null,
      version: '2026.1',
      supersedesDocumentId: null,
      scope: 'GLOBAL' as const,
      status: 'ACTIVE' as const,
      sourceUrl: 'https://example.invalid/rules/title-and-claims',
      content: `# 商品标题

标题应准确描述商品，不得堆砌无关关键词，不得包含无法证明的排名、独家或保证性用语。

## 营销声明

“最好”“第一”“百分百有效”和保证结果等绝对化声明必须有可验证依据；无法提供依据时应删除相关表述。`,
    },
    {
      id: 'rule_demo_battery_001',
      merchantId: null,
      title: '演示平台含锂电池商品运输资料要求',
      platform: 'DEMO_MARKETPLACE',
      market: null,
      language: 'zh-CN',
      category: 'BATTERY',
      effectiveFrom: null,
      effectiveTo: null,
      version: '2026.1',
      supersedesDocumentId: null,
      scope: 'GLOBAL' as const,
      status: 'ACTIVE' as const,
      sourceUrl: 'https://example.invalid/rules/lithium-battery-shipping',
      content: `# 锂电池运输

含锂电池商品发货前应核对电池类型、额定能量和运输资料。需要航空运输时，应由运营人员确认适用的 UN38.3 测试摘要和承运人限制。

## 信息不足

无法确认电池参数或运输资料时，不得向买家保证该商品可以通过所有航空渠道运输。`,
    },
    {
      id: 'rule_demo_amz_us_elec_2025',
      merchantId: null,
      title: 'Amazon 美国站电器商品演示规则（2025 版）',
      platform: 'AMAZON',
      market: 'US',
      language: 'zh-CN',
      category: 'ELECTRONICS',
      effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
      effectiveTo: new Date('2026-07-01T00:00:00.000Z'),
      version: '2025.1',
      supersedesDocumentId: null,
      scope: 'GLOBAL' as const,
      status: 'ARCHIVED' as const,
      sourceUrl: 'https://example.invalid/amazon/us/electronics/2025',
      content: `# 适用范围

本演示规则适用于 Amazon 美国站电器商品，规则版本为 2025.1，有效期截止到 2026 年 7 月 1 日。

## 充电器资料

旅行充电器发布前应记录输入电压、输出功率、插头制式和已有安全测试资料。缺少证明材料时不得使用“完全安全”或“适用于所有国家”等绝对化表述。`,
    },
    {
      id: 'rule_demo_amz_us_elec_2026',
      merchantId: null,
      title: 'Amazon 美国站电器商品演示规则（2026 版）',
      platform: 'AMAZON',
      market: 'US',
      language: 'zh-CN',
      category: 'ELECTRONICS',
      effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
      effectiveTo: null,
      version: '2026.2',
      supersedesDocumentId: 'rule_demo_amz_us_elec_2025',
      scope: 'GLOBAL' as const,
      status: 'ACTIVE' as const,
      sourceUrl: 'https://example.invalid/amazon/us/electronics/2026',
      content: `# 适用范围

本演示规则适用于 Amazon 美国站电器商品，自 2026 年 7 月 1 日起生效，并替代 2025.1 版本。

## 充电器资料

旅行充电器发布前必须核对输入电压、输出功率、美国插头制式和可追溯的安全测试资料。认证名称、编号和检测结论必须与原始资料一致。

## 营销声明

标题和详情不得使用无法证明的“美国第一”“百分百安全”或“全球通用”等保证性表述。资料不完整时，运营人员必须停止发布并补充证据。`,
    },
    {
      id: 'rule_demo_amz_us_review',
      merchantId: merchant.id,
      title: 'Demo 商家 Amazon 美国站合规复核补充规则',
      platform: 'AMAZON',
      market: 'US',
      language: 'zh-CN',
      category: 'ELECTRONICS',
      effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
      effectiveTo: null,
      version: 'internal-1.0',
      supersedesDocumentId: null,
      scope: 'MERCHANT' as const,
      status: 'ACTIVE' as const,
      sourceUrl: 'https://example.invalid/demo-merchant/amazon-us-review',
      content: `# 商家内部复核

Demo 商家的 Amazon 美国站电器商品在提交发布前，必须由运营主管复核电压、插头制式、安全测试资料和所有绝对化营销声明。

## 处理要求

复核未通过时只能保存为修改草稿，不得写入正式商品刊登；复核结论和证据链接需要进入审计记录。`,
    },
    {
      id: 'rule_demo_shopee_br_2026',
      merchantId: null,
      title: 'Shopee 巴西站商品声明演示规则（2026 版）',
      platform: 'SHOPEE',
      market: 'BR',
      language: 'zh-CN',
      category: 'LISTING',
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      effectiveTo: null,
      version: '2026.1',
      supersedesDocumentId: null,
      scope: 'GLOBAL' as const,
      status: 'ACTIVE' as const,
      sourceUrl: 'https://example.invalid/shopee/br/listing-claims/2026',
      content: `# 巴西站商品声明

Shopee 巴西站商品标题和葡萄牙语详情必须准确表达商品功能，不得加入无法由资料证明的排名、治疗效果或保证性声明。

## 本地化要求

将中文卖点翻译为葡萄牙语时，应保留型号、规格和限制条件，不得把“有助于”扩大翻译为“保证有效”。`,
    },
  ]

  for (const rule of ruleDocuments) {
    const normalizedContent = rule.content.replace(/\r\n?/g, '\n').trim()
    const contentHash = createRuleDocumentFingerprint({
      merchantId: rule.merchantId,
      platform: rule.platform,
      market: rule.market,
      language: rule.language,
      category: rule.category,
      effectiveFrom: rule.effectiveFrom,
      effectiveTo: rule.effectiveTo,
      version: rule.version,
      supersedesDocumentId: rule.supersedesDocumentId,
      title: rule.title,
      content: normalizedContent,
    })
    const chunks = chunkRuleContent(normalizedContent)
    await prisma.$transaction(async (transaction) => {
      await transaction.ruleDocument.upsert({
        where: { id: rule.id },
        create: {
          id: rule.id,
          merchantId: rule.merchantId,
          createdById: admin.id,
          title: rule.title,
          platform: rule.platform,
          market: rule.market,
          language: rule.language,
          category: rule.category,
          effectiveFrom: rule.effectiveFrom,
          effectiveTo: rule.effectiveTo,
          version: rule.version,
          supersedesDocumentId: rule.supersedesDocumentId,
          scope: rule.scope,
          sourceUrl: rule.sourceUrl,
          content: normalizedContent,
          contentHash,
          status: rule.status,
          chunks: {
            create: chunks.map((chunk) => ({
              sequence: chunk.sequence,
              heading: chunk.heading,
              content: chunk.content,
              searchTerms: chunk.searchTerms,
            })),
          },
        },
        update: {
          title: rule.title,
          platform: rule.platform,
          merchantId: rule.merchantId,
          market: rule.market,
          language: rule.language,
          category: rule.category,
          effectiveFrom: rule.effectiveFrom,
          effectiveTo: rule.effectiveTo,
          version: rule.version,
          supersedesDocumentId: rule.supersedesDocumentId,
          scope: rule.scope,
          sourceUrl: rule.sourceUrl,
          content: normalizedContent,
          contentHash,
          status: rule.status,
        },
      })
      await transaction.ruleChunk.deleteMany({
        where: { documentId: rule.id },
      })
      await transaction.ruleChunk.createMany({
        data: chunks.map((chunk) => ({
          documentId: rule.id,
          sequence: chunk.sequence,
          heading: chunk.heading,
          content: chunk.content,
          searchTerms: chunk.searchTerms,
        })),
      })
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

  const additionalProducts = [
    {
      productCode: 'P-DEMO-002',
      title: '轻量旅行收纳包套装',
      description: '适合行李分类整理的防泼水旅行收纳包。',
      sellingPoints: ['轻量便携', '多尺寸组合', '防泼水面料'],
      skuCode: 'SKU-DEMO-ORGANIZER-GRAY',
      skuName: '灰色 / 六件套',
      price: '24.99',
      stock: 80,
    },
    {
      productCode: 'P-DEMO-003',
      title: '可折叠硅胶旅行水瓶',
      description: '便于收纳携带的食品级硅胶折叠水瓶。',
      sellingPoints: ['折叠收纳', '食品级硅胶', '适合户外旅行'],
      skuCode: 'SKU-DEMO-BOTTLE-BLUE',
      skuName: '蓝色 / 600ml',
      price: '18.99',
      stock: 65,
    },
  ]

  for (const item of additionalProducts) {
    const additionalProduct = await prisma.product.upsert({
      where: {
        merchantId_code: {
          merchantId: merchant.id,
          code: item.productCode,
        },
      },
      create: {
        merchantId: merchant.id,
        code: item.productCode,
        title: item.title,
        description: item.description,
        sellingPoints: item.sellingPoints,
        language: 'zh-CN',
        status: 'ACTIVE',
      },
      update: {
        title: item.title,
        description: item.description,
        sellingPoints: item.sellingPoints,
        language: 'zh-CN',
        status: 'ACTIVE',
      },
    })

    await prisma.sku.upsert({
      where: {
        merchantId_code: {
          merchantId: merchant.id,
          code: item.skuCode,
        },
      },
      create: {
        merchantId: merchant.id,
        productId: additionalProduct.id,
        code: item.skuCode,
        name: item.skuName,
        price: item.price,
        currency: 'USD',
        stock: item.stock,
      },
      update: {
        productId: additionalProduct.id,
        name: item.skuName,
        price: item.price,
        currency: 'USD',
        stock: item.stock,
        status: 'ACTIVE',
      },
    })
  }

  const amazonStore = await prisma.store.upsert({
    where: {
      merchantId_code: { merchantId: merchant.id, code: 'AMZ-US' },
    },
    create: {
      merchantId: merchant.id,
      code: 'AMZ-US',
      name: 'Amazon 美国店',
      platform: 'Amazon',
      market: 'US',
      currency: 'USD',
      locale: 'en-US',
      timezone: 'America/Los_Angeles',
    },
    update: {
      name: 'Amazon 美国店',
      status: 'ACTIVE',
      currency: 'USD',
      locale: 'en-US',
      timezone: 'America/Los_Angeles',
    },
  })
  const shopeeStore = await prisma.store.upsert({
    where: {
      merchantId_code: { merchantId: merchant.id, code: 'SHP-BR' },
    },
    create: {
      merchantId: merchant.id,
      code: 'SHP-BR',
      name: 'Shopee 巴西店',
      platform: 'Shopee',
      market: 'BR',
      currency: 'BRL',
      locale: 'pt-BR',
      timezone: 'America/Sao_Paulo',
    },
    update: {
      name: 'Shopee 巴西店',
      status: 'ACTIVE',
      currency: 'BRL',
      locale: 'pt-BR',
      timezone: 'America/Sao_Paulo',
    },
  })
  const demoProducts = await prisma.product.findMany({
    where: { merchantId: merchant.id },
    orderBy: { code: 'asc' },
  })
  for (const [index, demoProduct] of demoProducts.entries()) {
    await prisma.productListing.upsert({
      where: {
        storeId_productId: {
          storeId: amazonStore.id,
          productId: demoProduct.id,
        },
      },
      create: {
        merchantId: merchant.id,
        storeId: amazonStore.id,
        productId: demoProduct.id,
        externalProductId: `AMZ-${demoProduct.code}`,
        title: demoProduct.title,
        description: demoProduct.description,
        language: 'en-US',
        price: (18.99 + index * 5).toFixed(2),
        currency: 'USD',
        status: 'PUBLISHED',
      },
      update: { status: 'PUBLISHED' },
    })
    await prisma.productListing.upsert({
      where: {
        storeId_productId: {
          storeId: shopeeStore.id,
          productId: demoProduct.id,
        },
      },
      create: {
        merchantId: merchant.id,
        storeId: shopeeStore.id,
        productId: demoProduct.id,
        externalProductId: `SHP-${demoProduct.code}`,
        title: demoProduct.title,
        description: demoProduct.description,
        language: 'pt-BR',
        price: (99.9 + index * 20).toFixed(2),
        currency: 'BRL',
        status: index === 2 ? 'DRAFT' : 'PUBLISHED',
      },
      update: {},
    })
  }

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
          paymentStatus: orderFields.status === 'PENDING' ? 'UNPAID' : 'PAID',
          fulfillmentStatus:
            orderFields.status === 'PENDING'
              ? 'UNFULFILLED'
              : orderFields.status === 'CONFIRMED'
                ? 'PROCESSING'
                : orderFields.status === 'SHIPPED'
                  ? 'SHIPPED'
                  : 'DELIVERED',
          shippingAddress: {
            recipient: orderFields.customerName,
            phone: '+1 202-555-0188',
            line1: '100 Market Street',
            city: 'San Francisco',
            region: 'CA',
            postalCode: '94105',
            country: 'US',
          },
          ...(orderFields.status === 'SHIPPED'
            ? {
                carrier: 'DHL',
                trackingNumber: 'DHL-DEMO-20260710',
              }
            : {}),
          items: {
            create: items.map((item) => ({
              ...item,
              productId: product.id,
              currency: 'USD',
            })),
          },
          events: {
            create: {
              type: 'CREATED',
              title: '订单已创建',
              description: '演示种子订单',
              metadata: { status: orderFields.status },
              createdAt: orderFields.createdAt,
            },
          },
        },
      })
    }
  }

  await prisma.order.updateMany({
    where: {
      merchantId: merchant.id,
      orderNo: {
        in: ['ORD-20260701-001', 'ORD-20260710-003', 'ORD-20260720-005'],
      },
    },
    data: { storeId: amazonStore.id },
  })
  await prisma.order.updateMany({
    where: {
      merchantId: merchant.id,
      orderNo: { in: ['ORD-20260705-002', 'ORD-20260715-004'] },
    },
    data: { storeId: shopeeStore.id },
  })
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
