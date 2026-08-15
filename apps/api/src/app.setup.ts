import { ValidationPipe, type INestApplication } from '@nestjs/common'
import type { ApiEnvironment } from '@cross-border/shared'
import cookieParser from 'cookie-parser'
import type { RequestHandler } from 'express'
import { json, urlencoded } from 'express'
import helmet from 'helmet'

import { HttpExceptionFilter } from './observability/http-exception.filter'

export function configureApiApplication(
  app: INestApplication,
  environment: ApiEnvironment,
): void {
  app.enableCors({ origin: environment.WEB_ORIGIN, credentials: true })
  app.use(
    helmet({
      // Swagger UI uses inline assets. Production keeps CSP because Swagger is
      // disabled by default; local demo mode explicitly trades CSP for the UI.
      contentSecurityPolicy: environment.SWAGGER_ENABLED ? false : undefined,
    }) as RequestHandler,
  )
  app.use(json({ limit: environment.JSON_BODY_LIMIT }))
  app.use(urlencoded({ extended: true, limit: environment.JSON_BODY_LIMIT }))
  app.use(cookieParser())
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  )
  app.useGlobalFilters(new HttpExceptionFilter())
  app.enableShutdownHooks()
}
