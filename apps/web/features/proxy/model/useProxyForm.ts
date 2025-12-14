'use client'

import { useForm } from '@tanstack/react-form'
import { proxyFormSchema, defaultValues, type ProxyFormValues } from './schema'
import {
  prepareProxyPayload,
  proxyQueryClient,
  PROXY_QUERY_KEY,
  type ProxyInput,
} from '@/lib/collections'

interface UseProxyFormOptions {
  initialValues?: Partial<ProxyFormValues>
  proxyId?: string
  onSuccess?: (proxyId: string) => void
}

export function useProxyForm(options: UseProxyFormOptions = {}) {
  const { initialValues, proxyId, onSuccess } = options

  const form = useForm({
    defaultValues: {
      ...defaultValues,
      ...initialValues,
    },
    validators: {
      onChange: proxyFormSchema,
    },
    onSubmit: async ({ value }) => {
      // Convert price to smallest unit (6 decimals for USDC.E)
      const priceInSmallestUnit = Math.round(parseFloat(value.pricePerRequest) * 1_000_000)

      const input: ProxyInput = {
        name: value.name.trim(),
        description: value.description?.trim() || undefined,
        paymentAddress: value.paymentAddress,
        targetUrl: value.targetUrl.trim(),
        headers: value.headers.filter((h) => h.key && h.value),
        pricePerRequest: priceInSmallestUnit,
        isPublic: value.isPublic,
      }

      // Prepare payload with encryption
      const payload = await prepareProxyPayload(input)

      if (proxyId) {
        // Update existing proxy
        const response = await fetch(`/api/proxies/${proxyId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.message || 'Failed to update proxy')
        }
      } else {
        // Create new proxy
        const response = await fetch('/api/proxies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.message || 'Failed to create proxy')
        }

        const newProxy = await response.json()
        // Invalidate queries to refetch fresh data
        await proxyQueryClient.invalidateQueries({ queryKey: PROXY_QUERY_KEY })
        onSuccess?.(newProxy.id)
        return
      }

      // Invalidate queries to refetch fresh data
      await proxyQueryClient.invalidateQueries({ queryKey: PROXY_QUERY_KEY })
      onSuccess?.(proxyId)
    },
  })

  // Header management helpers
  const addHeader = () => {
    const currentHeaders = form.getFieldValue('headers') ?? []
    form.setFieldValue('headers', [...currentHeaders, { key: '', value: '' }])
  }

  const removeHeader = (index: number) => {
    const currentHeaders = form.getFieldValue('headers') ?? []
    form.setFieldValue(
      'headers',
      currentHeaders.filter((_, i) => i !== index)
    )
  }

  return {
    form,
    addHeader,
    removeHeader,
    isEditing: !!proxyId,
  }
}

export type ProxyFormApi = ReturnType<typeof useProxyForm>
