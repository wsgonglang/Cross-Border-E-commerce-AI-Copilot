import { describe, expect, it } from 'vitest'

import { loadApiEnvironment, loadWorkerEnvironment } from './environment'

describe('environment validation', () => {
  const requiredApiEnvironment = {
    DATABASE_URL:
      'mysql://copilot:copilot_dev@127.0.0.1:3307/cross_border_copilot',
    JWT_ACCESS_SECRET: 'test-secret-with-at-least-32-characters',
  }

  it('provides safe non-secret defaults', () => {
    expect(loadApiEnvironment(requiredApiEnvironment)).toEqual({
      NODE_ENV: 'development',
      API_PORT: 3000,
      WEB_ORIGIN: 'http://localhost:5173',
      DATABASE_URL:
        'mysql://copilot:copilot_dev@127.0.0.1:3307/cross_border_copilot',
      JWT_ACCESS_SECRET: 'test-secret-with-at-least-32-characters',
      JWT_ACCESS_TTL_SECONDS: 900,
      REFRESH_TOKEN_TTL_DAYS: 7,
      AUTH_COOKIE_SECURE: false,
      REDIS_URL: 'redis://127.0.0.1:6379',
      OPENAI_API_KEY: '',
      OPENAI_BASE_URL: 'https://api.siliconflow.cn/v1',
      AI_MODEL: 'Qwen/Qwen2.5-7B-Instruct',
      AI_TIMEOUT_MS: 30_000,
      JSON_BODY_LIMIT: '1mb',
      SWAGGER_ENABLED: true,
    })
    expect(loadWorkerEnvironment({})).toEqual({
      NODE_ENV: 'development',
      WORKER_NAME: 'ai-task-worker',
      REDIS_URL: 'redis://127.0.0.1:6379',
    })
  })

  it('rejects an invalid API port', () => {
    expect(() =>
      loadApiEnvironment({ ...requiredApiEnvironment, API_PORT: '70000' }),
    ).toThrow()
  })

  it('requires secrets and a MySQL connection', () => {
    expect(() => loadApiEnvironment({})).toThrow()
  })
})
