import 'dotenv/config'
import 'reflect-metadata'

import { loadApiEnvironment } from '@cross-border/shared'
import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module'

async function bootstrap(): Promise<void> {
  const environment = loadApiEnvironment(process.env)
  const app = await NestFactory.create(AppModule)

  app.enableCors({
    origin: environment.WEB_ORIGIN,
    credentials: true,
  })
  app.enableShutdownHooks()

  await app.listen(environment.API_PORT)
}

void bootstrap()
