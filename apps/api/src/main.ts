import 'reflect-metadata'

import cookieParser from 'cookie-parser'
import { config } from 'dotenv'
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
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

  await app.listen(environment.API_PORT)
}

void bootstrap()
