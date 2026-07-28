import { describe, expect, it } from 'vitest'

import { redisConnectionFromUrl } from './redis-connection'

describe('redisConnectionFromUrl', () => {
  it('parses authentication, port, and database from a Redis URL', () => {
    expect(
      redisConnectionFromUrl('redis://worker:p%40ss@redis.local:6380/2'),
    ).toEqual({
      host: 'redis.local',
      port: 6380,
      username: 'worker',
      password: 'p@ss',
      db: 2,
    })
  })

  it('uses the standard port when none is provided', () => {
    expect(redisConnectionFromUrl('redis://127.0.0.1')).toEqual({
      host: '127.0.0.1',
      port: 6379,
    })
  })
})
