import { SetMetadata } from '@nestjs/common'

export const RATE_LIMIT_KEY = 'rate-limit-policy'

export type RateLimitIdentity = 'ip' | 'ip-email' | 'user'

export interface RateLimitPolicy {
  limit: number
  windowMs: number
  identity: RateLimitIdentity
}

export const RateLimit = (policy: RateLimitPolicy) =>
  SetMetadata(RATE_LIMIT_KEY, policy)
