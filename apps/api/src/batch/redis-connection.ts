import type { ConnectionOptions } from 'bullmq'

export function redisConnectionFromUrl(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl)
  const database = url.pathname.slice(1)
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(database ? { db: Number(database) } : {}),
  }
}
