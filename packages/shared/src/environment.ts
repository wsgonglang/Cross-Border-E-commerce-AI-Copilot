import { z } from 'zod'

const nodeEnvironmentSchema = z.enum(['development', 'test', 'production'])

const apiEnvironmentSchema = z.object({
  NODE_ENV: nodeEnvironmentSchema.default('development'),
  API_PORT: z.coerce.number().int().positive().max(65_535).default(3000),
  WEB_ORIGIN: z.url().default('http://localhost:5173'),
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
