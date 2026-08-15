import type { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { ApiEnvironment } from '@cross-border/shared'
import { hash } from 'bcryptjs'
import { Queue } from 'bullmq'
import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import request from 'supertest'

import { AppModule } from '../app.module'
import { configureApiApplication } from '../app.setup'
import { BATCH_OPTIMIZATION_QUEUE } from '../batch/batch.constants'
import { redisConnectionFromUrl } from '../batch/redis-connection'
import { API_ENVIRONMENT } from '../config/api-config.constants'
import { PrismaService } from '../database/prisma.service'

interface BatchResponse {
  id: string
  items: Array<{ id: string }>
}

async function run(): Promise<void> {
  if (
    process.env.RUN_INTEGRATION_TESTS !== 'true' ||
    process.env.NODE_ENV !== 'test'
  ) {
    throw new Error(
      'Integration suite requires RUN_INTEGRATION_TESTS=true and NODE_ENV=test',
    )
  }

  const suffix = `${Date.now()}`.slice(-10)
  const viewerEmail = `it-viewer-${suffix}@example.test`
  const operatorEmail = `it-operator-${suffix}@example.test`
  const password = 'Integration123!'
  const merchantAId = `itma${suffix}`
  const merchantBId = `itmb${suffix}`
  const viewerId = `ituv${suffix}`
  const operatorId = `ituo${suffix}`
  const productId = `itpr${suffix}`
  let app: INestApplication | undefined
  let prisma: PrismaService | undefined
  let queue: Queue | undefined
  let batchItemId: string | undefined

  try {
    app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn'],
      abortOnError: false,
      bodyParser: false,
    })
    const environment = app.get<ApiEnvironment>(API_ENVIRONMENT)
    configureApiApplication(app, environment)
    await app.init()
    const httpServer = app.getHttpServer() as unknown as Server
    const database = app.get(PrismaService)
    prisma = database
    const taskQueue = new Queue(BATCH_OPTIMIZATION_QUEUE, {
      connection: redisConnectionFromUrl(environment.REDIS_URL),
    })
    queue = taskQueue

    const passwordHash = await hash(password, 4)
    const viewerRole = await database.role.upsert({
      where: { code: 'viewer' },
      create: { code: 'viewer', name: 'Viewer' },
      update: {},
    })
    const operatorRole = await database.role.upsert({
      where: { code: 'operator' },
      create: { code: 'operator', name: 'Operator' },
      update: {},
    })
    await database.merchant.createMany({
      data: [
        {
          id: merchantAId,
          code: `ITA${suffix}`,
          name: 'Integration Merchant A',
        },
        {
          id: merchantBId,
          code: `ITB${suffix}`,
          name: 'Integration Merchant B',
        },
      ],
    })
    await database.user.create({
      data: {
        id: viewerId,
        email: viewerEmail,
        name: 'Integration Viewer',
        passwordHash,
        userRoles: { create: { roleId: viewerRole.id } },
        merchantUsers: { create: { merchantId: merchantAId } },
      },
    })
    await database.user.create({
      data: {
        id: operatorId,
        email: operatorEmail,
        name: 'Integration Operator',
        passwordHash,
        userRoles: { create: { roleId: operatorRole.id } },
        merchantUsers: { create: { merchantId: merchantAId } },
      },
    })
    await database.product.create({
      data: {
        id: productId,
        merchantId: merchantAId,
        code: `IT_PRODUCT_${suffix}`,
        title: 'Integration product',
        description: 'Created by the isolated integration suite.',
        language: 'en-US',
        status: 'ACTIVE',
      },
    })

    const viewerLogin = await request(httpServer)
      .post('/api/auth/login')
      .set('x-request-id', 'integration-login-001')
      .send({ email: viewerEmail, password })
      .expect(200)
    const viewerToken = String(
      (viewerLogin.body as { accessToken?: unknown }).accessToken,
    )
    const me = await request(httpServer)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200)
    assert.equal((me.body as { id?: unknown }).id, viewerId)
    const invalid = await request(httpServer)
      .post('/api/auth/login')
      .set('x-request-id', 'integration-invalid-001')
      .send({ email: viewerEmail, password, unexpected: true })
      .expect(400)
    const invalidBody = invalid.body as unknown as {
      statusCode: number
      code: string
      requestId: string
    }
    assert.deepEqual(
      {
        statusCode: invalidBody.statusCode,
        code: invalidBody.code,
        requestId: invalidBody.requestId,
      },
      {
        statusCode: 400,
        code: 'BAD_REQUEST',
        requestId: 'integration-invalid-001',
      },
    )
    process.stdout.write('✓ HTTP login, JWT and DTO error contract\n')

    await request(httpServer)
      .post(`/api/merchants/${merchantAId}/products`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        code: `DENIED_${suffix}`,
        title: 'Denied',
        description: '',
        language: 'en-US',
      })
      .expect(403)
    await request(httpServer)
      .get(`/api/merchants/${merchantBId}/products`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(403)
    process.stdout.write('✓ Role and merchant isolation\n')

    const operatorLogin = await request(httpServer)
      .post('/api/auth/login')
      .send({ email: operatorEmail, password })
      .expect(200)
    const operatorToken = String(
      (operatorLogin.body as { accessToken?: unknown }).accessToken,
    )
    const payload = {
      productIds: [productId],
      targetLanguage: 'es-ES',
      idempotencyKey: `integration_${suffix}`,
    }
    const first = await request(httpServer)
      .post(`/api/merchants/${merchantAId}/ai/batch-tasks`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send(payload)
      .expect(201)
    const second = await request(httpServer)
      .post(`/api/merchants/${merchantAId}/ai/batch-tasks`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send(payload)
      .expect(201)
    const firstBatch = first.body as BatchResponse
    const secondBatch = second.body as BatchResponse
    assert.equal(secondBatch.id, firstBatch.id)
    batchItemId = firstBatch.items[0]?.id
    assert.ok(batchItemId)
    assert.equal(
      await database.batchOptimizationTask.count({
        where: {
          merchantId: merchantAId,
          idempotencyKey: payload.idempotencyKey,
        },
      }),
      1,
    )
    assert.ok(await taskQueue.getJob(batchItemId))
    process.stdout.write('✓ HTTP/MySQL/Redis idempotent batch creation\n')

    const ready = await request(httpServer).get('/api/health/ready').expect(200)
    const readyBody = ready.body as unknown as {
      status: string
      dependencies: { mysql: { status: string }; redis: { status: string } }
    }
    assert.equal(readyBody.status, 'ready')
    assert.equal(readyBody.dependencies.mysql.status, 'up')
    assert.equal(readyBody.dependencies.redis.status, 'up')
    const metrics = await request(httpServer).get('/api/metrics').expect(200)
    assert.match(metrics.text, /copilot_http_requests_total/)
    assert.match(metrics.text, /copilot_queue_jobs/)
    process.stdout.write('✓ MySQL/Redis readiness and Prometheus metrics\n')
  } finally {
    if (batchItemId && queue) await (await queue.getJob(batchItemId))?.remove()
    await queue?.close()
    if (prisma) {
      await prisma.auditLog.deleteMany({
        where: { merchantId: { in: [merchantAId, merchantBId] } },
      })
      await prisma.batchOptimizationTask.deleteMany({
        where: { merchantId: merchantAId },
      })
      await prisma.product.deleteMany({ where: { id: productId } })
      await prisma.loginLog.deleteMany({
        where: { email: { in: [viewerEmail, operatorEmail] } },
      })
      await prisma.refreshToken.deleteMany({
        where: { userId: { in: [viewerId, operatorId] } },
      })
      await prisma.user.deleteMany({
        where: { id: { in: [viewerId, operatorId] } },
      })
      await prisma.merchant.deleteMany({
        where: { id: { in: [merchantAId, merchantBId] } },
      })
    }
    await app?.close()
  }
}

void run().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.stack || error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
