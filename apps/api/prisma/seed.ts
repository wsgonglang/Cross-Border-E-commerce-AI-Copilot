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
