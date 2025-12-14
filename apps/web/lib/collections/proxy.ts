'use client'

import { QueryClient } from '@tanstack/react-query'
import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { z } from 'zod'
import { encryptForServer } from '@/lib/crypto/client'
import type { ProxyHeader } from '@/types'

// Schema for stored proxy data (from server)
export const proxySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  proxyUrl: z.string(),
  targetUrl: z.string(),
  paymentAddress: z.string(),
  pricePerRequest: z.number(),
  isPublic: z.boolean(),
  hasEncryptedHeaders: z.boolean(),
  createdAt: z.string(),
})

export type Proxy = z.infer<typeof proxySchema>

// Input type for creating/updating proxies (before encryption)
export interface ProxyInput {
  name: string
  description?: string
  paymentAddress: string
  targetUrl: string
  headers?: ProxyHeader[]
  pricePerRequest: number
  isPublic: boolean
}

// Helper to convert headers array to encrypted format - exported for direct API calls
export async function prepareProxyPayload(input: ProxyInput) {
  let encryptedHeaders = null

  if (input.headers && input.headers.length > 0) {
    const headersWithValues = input.headers.filter((h) => h.key && h.value)
    if (headersWithValues.length > 0) {
      const headersObject = headersWithValues.reduce(
        (acc, h) => ({ ...acc, [h.key]: h.value }),
        {} as Record<string, string>
      )
      encryptedHeaders = await encryptForServer(headersObject)
    }
  }

  return {
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    paymentAddress: input.paymentAddress,
    targetUrl: input.targetUrl.trim(),
    encryptedHeaders,
    pricePerRequest: input.pricePerRequest,
    isPublic: input.isPublic,
  }
}

// Shared query client for the collection - exported for query invalidation
export const proxyQueryClient = new QueryClient()
export const PROXY_QUERY_KEY = ['proxies']

export const proxyCollection = createCollection(
  queryCollectionOptions({
    id: 'proxies',
    queryKey: PROXY_QUERY_KEY,
    queryClient: proxyQueryClient,
    schema: proxySchema,
    queryFn: async () => {
      const response = await fetch('/api/proxies')
      if (!response.ok) {
        throw new Error('Failed to fetch proxies')
      }
      const data = await response.json()
      return data.proxies as Proxy[]
    },
    getKey: (item) => item.id,

    onInsert: async ({ transaction }) => {
      const { changes } = transaction.mutations[0]
      const input = changes as unknown as ProxyInput

      const payload = await prepareProxyPayload(input)

      const response = await fetch('/api/proxies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create proxy')
      }

      return await response.json()
    },

    onUpdate: async ({ transaction }) => {
      const { original, changes } = transaction.mutations[0]
      const proxyId = original.id

      const response = await fetch(`/api/proxies/${proxyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to update proxy')
      }

      return await response.json()
    },

    onDelete: async ({ transaction }) => {
      const { original } = transaction.mutations[0]
      const proxyId = original.id

      const response = await fetch(`/api/proxies/${proxyId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to delete proxy')
      }
    },
  })
)
