import { z } from 'zod'

const BLOCKED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']

function isPrivateIP(hostname: string): boolean {
  if (hostname.startsWith('10.')) return true
  if (hostname.startsWith('192.168.')) return true
  if (hostname.startsWith('172.')) {
    const parts = hostname.split('.')
    if (parts.length >= 2) {
      const second = parseInt(parts[1], 10)
      if (second >= 16 && second <= 31) return true
    }
  }
  if (hostname.startsWith('169.254.')) return true
  return false
}

export const proxyHeaderSchema = z.object({
  key: z.string(),
  value: z.string(),
})

export const proxyFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less'),

  description: z
    .string()
    .max(1000, 'Description must be 1000 characters or less'),

  paymentAddress: z
    .string()
    .min(1, 'Payment address is required')
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Must be a valid Ethereum address'),

  targetUrl: z
    .string()
    .min(1, 'Target URL is required')
    .url('Must be a valid URL')
    .refine(
      (url) => {
        try {
          const parsed = new URL(url)
          return parsed.protocol === 'https:' || parsed.protocol === 'http:'
        } catch {
          return false
        }
      },
      { message: 'Must be HTTP or HTTPS' }
    )
    .refine(
      (url) => {
        try {
          const parsed = new URL(url)
          const hostname = parsed.hostname.toLowerCase()
          return !BLOCKED_HOSTS.includes(hostname)
        } catch {
          return true
        }
      },
      { message: 'Cannot target localhost or loopback addresses' }
    )
    .refine(
      (url) => {
        try {
          const parsed = new URL(url)
          return !isPrivateIP(parsed.hostname)
        } catch {
          return true
        }
      },
      { message: 'Cannot target private IP addresses' }
    ),

  pricePerRequest: z
    .string()
    .min(1, 'Price is required')
    .refine((val) => !isNaN(parseFloat(val)), { message: 'Must be a valid number' })
    .refine((val) => parseFloat(val) >= 0, { message: 'Price cannot be negative' })
    .refine((val) => parseFloat(val) <= 1_000_000, { message: 'Price exceeds maximum' }),

  headers: z.array(proxyHeaderSchema),

  isPublic: z.boolean(),
})

export type ProxyFormValues = z.infer<typeof proxyFormSchema>
export type ProxyHeader = z.infer<typeof proxyHeaderSchema>

export const defaultValues: ProxyFormValues = {
  name: '',
  description: '',
  paymentAddress: '',
  targetUrl: '',
  pricePerRequest: '',
  headers: [],
  isPublic: false,
}
