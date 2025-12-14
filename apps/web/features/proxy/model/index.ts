// Schema and types
export { proxyFormSchema, defaultValues, type ProxyFormValues, type ProxyHeader } from './schema'

// Hook (business logic)
export { useProxyForm, type ProxyFormApi } from './useProxyForm'

// Context (consumes hook, provides to views)
export { ProxyFormProvider, useProxyFormContext } from './context'
