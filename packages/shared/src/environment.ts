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
  REDIS_URL: z
    .url()
    .refine((value) => value.startsWith('redis://'), {
      message: 'REDIS_URL must use the redis:// protocol',
    })
    .default('redis://127.0.0.1:6379'),
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_BASE_URL: z.string().default('https://api.siliconflow.cn/v1'),
  AI_MODEL: z.string().default('Qwen/Qwen2.5-7B-Instruct'),
  AI_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(120_000)
    .default(30_000),
  JSON_BODY_LIMIT: z
    .string()
    .regex(/^\d+(?:kb|mb)$/i)
    .default('1mb'),
  SWAGGER_ENABLED: environmentBooleanSchema.optional(),
})

const workerEnvironmentSchema = z.object({
  NODE_ENV: nodeEnvironmentSchema.default('development'),
  WORKER_NAME: z.string().trim().min(1).default('ai-task-worker'),
  REDIS_URL: z
    .url()
    .refine((value) => value.startsWith('redis://'), {
      message: 'REDIS_URL must use the redis:// protocol',
    })
    .default('redis://127.0.0.1:6379'),
})

export type ApiEnvironment = z.infer<typeof apiEnvironmentSchema>
export type WorkerEnvironment = z.infer<typeof workerEnvironmentSchema>

export function loadApiEnvironment(
  environment: NodeJS.ProcessEnv,
): ApiEnvironment {
  const parsed = apiEnvironmentSchema.parse(environment)
  return {
    ...parsed,
    SWAGGER_ENABLED: parsed.SWAGGER_ENABLED ?? parsed.NODE_ENV !== 'production',
  }
}

export function loadWorkerEnvironment(
  environment: NodeJS.ProcessEnv,
): WorkerEnvironment {
  return workerEnvironmentSchema.parse(environment)
}
