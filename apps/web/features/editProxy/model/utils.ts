/**
 * Utility functions for the edit proxy feature
 */

/**
 * UUID v4 regex pattern
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Check if a string is a valid UUID v4
 *
 * @param value - The string to validate
 * @returns true if the string is a valid UUID, false otherwise
 *
 * @example
 * isValidUUID('550e8400-e29b-41d4-a716-446655440000') // true
 * isValidUUID('my-proxy-slug') // false
 */
export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value)
}

/**
 * Convert price from database format (smallest unit with 6 decimals) to display format
 *
 * @param priceInSmallestUnit - Price in USDC smallest unit (1 USDC = 1,000,000)
 * @returns Price as a string for form display
 *
 * @example
 * formatPriceForDisplay(1_000_000) // "1"
 * formatPriceForDisplay(500_000) // "0.5"
 */
export function formatPriceForDisplay(priceInSmallestUnit: number): string {
  return (priceInSmallestUnit / 1_000_000).toString()
}

/**
 * Parse tags from database JSON field
 * The database stores tags as jsonb which could be null or an array
 *
 * @param tags - The tags value from database (could be null, undefined, or array)
 * @returns Normalized string array of tags
 */
export function parseTags(tags: unknown): string[] {
  if (!tags) return []
  if (Array.isArray(tags)) {
    return tags.filter((tag): tag is string => typeof tag === 'string')
  }
  return []
}

/**
 * Parse variables schema from database JSON field
 *
 * @param schema - The variablesSchema value from database
 * @returns Normalized array or empty array if invalid
 */
export function parseVariablesSchema<T>(schema: unknown): T[] {
  if (!schema) return []
  if (Array.isArray(schema)) return schema as T[]
  return []
}
