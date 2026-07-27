import 'reflect-metadata'

import cookieParser from 'cookie-parser'
import { config } from 'dotenv'
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { resolve } from 'node:path'

import { AppModule } from './app.module'
import { API_ENVIRONMENT } from './config/api-config.constants'
import type { ApiEnvironment } from '@cross-border/shared'

config({ path: resolve(process.cwd(), '../../.env') })

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  const environment = app.get<ApiEnvironment>(API_ENVIRONMENT)

  app.enableCors({
    origin: environment.WEB_ORIGIN,
    credentials: true,
  })
  app.use(cookieParser())
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  )
  app.enableShutdownHooks()

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Cross-Border E-commerce AI Copilot API')
    .setDescription('跨境电商 AI 运营助手业务 API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build()
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  )

  await app.listen(environment.API_PORT)
}

void bootstrap()
