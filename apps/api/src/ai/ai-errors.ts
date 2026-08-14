export const AI_ERROR_CODES = [
  'PROVIDER_TIMEOUT',
  'RATE_LIMITED',
  'INVALID_OUTPUT',
  'TOOL_ERROR',
  'CANCELLED',
  'INTERNAL_ERROR',
] as const

export type AiErrorCode = (typeof AI_ERROR_CODES)[number]

export class AiExecutionError extends Error {
  constructor(
    readonly code: AiErrorCode,
    message: string,
    readonly retryable: boolean = false,
  ) {
    super(message)
    this.name = 'AiExecutionError'
  }
}

export function classifyAiError(error: unknown): AiExecutionError {
  if (error instanceof AiExecutionError) return error
  if (error instanceof Error && error.name === 'AbortError') {
    return new AiExecutionError('CANCELLED', 'AI 运行已取消')
  }
  const record =
    typeof error === 'object' && error !== null
      ? (error as Record<string, unknown>)
      : undefined
  const status = typeof record?.status === 'number' ? record.status : undefined
  const code = typeof record?.code === 'string' ? record.code : undefined
  if (status === 429 || code === 'rate_limit_exceeded') {
    return new AiExecutionError('RATE_LIMITED', '模型服务请求过于频繁', true)
  }
  if (
    code === 'ETIMEDOUT' ||
    code === 'ECONNABORTED' ||
    (error instanceof Error && /timeout/i.test(error.message))
  ) {
    return new AiExecutionError('PROVIDER_TIMEOUT', '模型服务响应超时', true)
  }
  return new AiExecutionError('INTERNAL_ERROR', 'AI 服务暂时不可用', true)
}
