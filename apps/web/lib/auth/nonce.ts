import { randomUUID } from "crypto"
import Redis from "ioredis"

/**
 * Nonce storage for SIWX authentication using Redis.
 * Nonces are single-use and expire automatically after 5 minutes.
 */

// Nonce TTL in seconds (5 minutes)
const NONCE_TTL_SECONDS = 5 * 60

// Redis key prefix
const NONCE_PREFIX = "siwx:nonce:"

// Redis client singleton
let redis: Redis | null = null

function parseRedisConfig(): { host: string; port: number } {
  const redisUrl = process.env.REDIS_URL

  if (redisUrl) {
    try {
      const url = new URL(redisUrl)
      return {
        host: url.hostname || "localhost",
        port: parseInt(url.port, 10) || 6379,
      }
    } catch {
      // Invalid URL, fall through to defaults
      console.warn("[Redis] Invalid REDIS_URL, using defaults")
    }
  }

  return { host: "localhost", port: 6379 }
}

function getRedis(): Redis {
  if (!redis) {
    const { host, port } = parseRedisConfig()

    redis = new Redis({
      host,
      port,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) {
          return null // Stop retrying
        }
        return Math.min(times * 100, 3000)
      },
    })

    redis.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message)
    })

    redis.on("connect", () => {
      console.log(`[Redis] Connected to ${host}:${port}`)
    })
  }
  return redis
}

/**
 * Generate a new nonce for SIWX authentication.
 * Nonces expire after 5 minutes.
 */
export async function generateNonce(): Promise<string> {
  const client = getRedis()
  const nonce = randomUUID()
  const key = `${NONCE_PREFIX}${nonce}`

  // Store nonce with TTL, value "pending" means not yet used
  await client.set(key, "pending", "EX", NONCE_TTL_SECONDS)

  return nonce
}

/**
 * Verify and consume a nonce.
 * Returns true if the nonce is valid and unused, false otherwise.
 * A nonce can only be used once (atomic operation).
 */
export async function verifyNonce(nonce: string): Promise<boolean> {
  const client = getRedis()
  const key = `${NONCE_PREFIX}${nonce}`

  // Atomic: get current value and set to "used" if it was "pending"
  // Using a Lua script ensures atomicity
  const script = `
    local value = redis.call('GET', KEYS[1])
    if value == 'pending' then
      redis.call('SET', KEYS[1], 'used', 'KEEPTTL')
      return 1
    end
    return 0
  `

  const result = await client.eval(script, 1, key)
  return result === 1
}

/**
 * Check if a nonce exists and is valid (without consuming it).
 * Useful for validation before signature verification.
 */
export async function isNonceValid(nonce: string): Promise<boolean> {
  const client = getRedis()
  const key = `${NONCE_PREFIX}${nonce}`

  const value = await client.get(key)
  return value === "pending"
}

/**
 * Get the number of active nonces (for monitoring/debugging).
 * Note: This uses SCAN which may be slow on large datasets.
 */
export async function getActiveNonceCount(): Promise<number> {
  const client = getRedis()
  let count = 0
  let cursor = "0"

  do {
    const [nextCursor, keys] = await client.scan(
      cursor,
      "MATCH",
      `${NONCE_PREFIX}*`,
      "COUNT",
      100
    )
    cursor = nextCursor
    count += keys.length
  } while (cursor !== "0")

  return count
}

/**
 * Close the Redis connection (for graceful shutdown).
 */
export async function closeRedisConnection(): Promise<void> {
  if (redis) {
    await redis.quit()
    redis = null
  }
}
