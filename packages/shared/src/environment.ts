import { z } from 'zod'

const nodeEnvironmentSchema = z.enum(['development', 'test', 'production'])

const environmentBooleanSchema = z.preprocess((value) => {
  if (value === 'true') {
    return true
  }
  if (value === 'false') {
    return false
  }
  return value
}, z.boolean())

const apiEnvironmentSchema = z.object({
  NODE_ENV: nodeEnvironmentSchema.default('development'),
  API_PORT: z.coerce.number().int().positive().max(65_535).default(3000),
  WEB_ORIGIN: z.url().default('http://localhost:5173'),
  DATABASE_URL: z.url().refine((value) => value.startsWith('mysql://'), {
    message: 'DATABASE_URL must use the mysql:// protocol',
  }),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .max(86_400)
    .default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().max(90).default(7),
  AUTH_COOKIE_SECURE: environmentBooleanSchema.default(false),
})

const workerEnvironmentSchema = z.object({
  NODE_ENV: nodeEnvironmentSchema.default('development'),
  WORKER_NAME: z.string().trim().min(1).default('ai-task-worker'),
})

export type ApiEnvironment = z.infer<typeof apiEnvironmentSchema>
export type WorkerEnvironment = z.infer<typeof workerEnvironmentSchema>

export function loadApiEnvironment(
  environment: NodeJS.ProcessEnv,
): ApiEnvironment {
  return apiEnvironmentSchema.parse(environment)
}

export function loadWorkerEnvironment(
  environment: NodeJS.ProcessEnv,
): WorkerEnvironment {
  return workerEnvironmentSchema.parse(environment)
}
