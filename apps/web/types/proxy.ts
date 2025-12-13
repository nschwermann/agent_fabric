import type { ApiProxy } from '@/lib/db/schema'

export interface ProxyHeader {
  key: string
  value: string
}

export interface ProxyFormData {
  name: string
  description: string
  targetUrl: string
  headers: ProxyHeader[]
  pricePerRequest: string
  isPublic: boolean
}

export interface ProxyFormErrors {
  name?: string
  description?: string
  targetUrl?: string
  headers?: string
  pricePerRequest?: string
  general?: string
}

export interface ProxyFormState {
  data: ProxyFormData
  errors: ProxyFormErrors
  isSubmitting: boolean
  isEncrypting: boolean
  isDirty: boolean
}

export type ProxyListItem = Pick<ApiProxy, 'id' | 'name' | 'description' | 'targetUrl' | 'pricePerRequest' | 'isPublic' | 'createdAt'>
