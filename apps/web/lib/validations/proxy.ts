import { z } from 'zod'

/**
 * Validates that a URL is safe to proxy to (prevents SSRF attacks).
 */
const safeTargetUrl = z.string().url().refine(
  (url) => {
    try {
      const parsed = new URL(url)

      // Must be HTTPS in production
      if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
        return false
      }

      // Allow HTTP in development for local testing
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return false
      }

      const hostname = parsed.hostname.toLowerCase()

      // Block localhost and loopback addresses
      const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']
      if (blockedHosts.includes(hostname)) {
        return false
      }

      // Block private IP ranges (RFC 1918)
      // 10.0.0.0/8
      if (hostname.startsWith('10.')) {
        return false
      }

      // 192.168.0.0/16
      if (hostname.startsWith('192.168.')) {
        return false
      }

      // 172.16.0.0/12
      if (hostname.startsWith('172.')) {
        const parts = hostname.split('.')
        if (parts.length >= 2) {
          const second = parseInt(parts[1], 10)
          if (second >= 16 && second <= 31) {
            return false
          }
        }
      }

      // Block link-local addresses (169.254.0.0/16)
      if (hostname.startsWith('169.254.')) {
        return false
      }

      // Block metadata endpoints (cloud provider internal APIs)
      const metadataHosts = [
        '169.254.169.254', // AWS/GCP/Azure metadata
        'metadata.google.internal',
        'metadata.google.com',
      ]
      if (metadataHosts.includes(hostname)) {
        return false
      }

      return true
    } catch {
      return false
    }
  },
  { message: 'Invalid or unsafe target URL. Must be HTTPS and not target internal networks.' }
)

/**
 * Schema for creating a new API proxy.
 */
export const createProxySchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .trim(),
  description: z
    .string()
    .max(1000, 'Description must be 1000 characters or less')
    .trim()
    .optional(),
  targetUrl: safeTargetUrl,
  headers: z
    .record(z.string(), z.string())
    .optional()
    .refine(
      (headers) => {
        if (!headers) return true
        // Limit number of headers
        if (Object.keys(headers).length > 20) return false
        // Validate header names (alphanumeric, hyphens, underscores)
        const validHeaderName = /^[a-zA-Z0-9_-]+$/
        return Object.keys(headers).every((key) => validHeaderName.test(key))
      },
      { message: 'Invalid headers format. Maximum 20 headers with alphanumeric names.' }
    ),
  pricePerRequest: z
    .number()
    .int('Price must be an integer')
    .min(0, 'Price cannot be negative')
    .max(1_000_000_000_000, 'Price exceeds maximum'), // Max ~1M USDC
  isPublic: z.boolean().default(false),
})

/**
 * Schema for updating an existing API proxy.
 */
export const updateProxySchema = createProxySchema.partial()

/**
 * Schema for proxy ID parameter.
 */
export const proxyIdSchema = z.object({
  id: z.string().uuid('Invalid proxy ID'),
})

export type CreateProxyInput = z.infer<typeof createProxySchema>
export type UpdateProxyInput = z.infer<typeof updateProxySchema>
