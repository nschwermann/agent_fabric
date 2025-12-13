import Redis from 'ioredis'

/**
 * Redis client configuration and singleton instance.
 *
 * This module provides a single Redis connection that can be
 * injected into repositories and services.
 */

export interface RedisConfig {
  host: string
  port: number
  maxRetriesPerRequest?: number
}

function parseRedisUrl(url?: string): RedisConfig {
  if (url) {
    try {
      const parsed = new URL(url)
      return {
        host: parsed.hostname || 'localhost',
        port: parseInt(parsed.port, 10) || 6379,
      }
    } catch {
      console.warn('[Redis] Invalid REDIS_URL, using defaults')
    }
  }
  return { host: 'localhost', port: 6379 }
}

// Singleton instance
let instance: Redis | null = null

/**
 * Get the Redis client instance.
 * Creates a new connection if one doesn't exist.
 */
export function getRedisClient(): Redis {
  if (!instance) {
    const config = parseRedisUrl(process.env.REDIS_URL)

    instance = new Redis({
      host: config.host,
      port: config.port,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null
        return Math.min(times * 100, 3000)
      },
    })

    instance.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message)
    })

    instance.on('connect', () => {
      console.log(`[Redis] Connected to ${config.host}:${config.port}`)
    })
  }

  return instance
}

/**
 * Close the Redis connection gracefully.
 * Call this during application shutdown.
 */
export async function closeRedisClient(): Promise<void> {
  if (instance) {
    await instance.quit()
    instance = null
  }
}

/**
 * Check if Redis is connected and healthy.
 */
export async function isRedisHealthy(): Promise<boolean> {
  try {
    const client = getRedisClient()
    const result = await client.ping()
    return result === 'PONG'
  } catch {
    return false
  }
}
