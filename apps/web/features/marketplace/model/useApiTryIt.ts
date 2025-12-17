'use client'

import { useState, useCallback } from 'react'
import { useSignTypedData, useConnection } from 'wagmi'
import { type Address, hashTypedData, recoverTypedDataAddress } from 'viem'
import type { VariableDefinition, VariableType } from '@/features/proxy/model/variables'
import {
  EIP3009_TYPES,
  buildUsdceDomain,
  buildEIP3009Message,
  buildPaymentHeader,
  encodePaymentHeader,
  parseChainId,
} from '@/lib/x402/client'

/**
 * Payment requirements per Cronos x402 spec
 * Received in 402 response body
 */
interface PaymentRequirements {
  scheme: string
  network: string
  payTo: Address
  asset: Address
  maxAmountRequired: string
  maxTimeoutSeconds: number
  description?: string
  mimeType?: string
}

interface ApiResponse {
  status: number
  statusText: string
  body: string
  headers: Record<string, string>
}

interface UseApiTryItOptions {
  proxyUrl: string
  httpMethod: string
  variablesSchema: VariableDefinition[]
}

interface UseApiTryItReturn {
  variables: Record<string, string>
  setVariable: (name: string, value: string) => void
  isLoading: boolean
  response: ApiResponse | null
  error: string | null
  executeRequest: () => Promise<void>
}

/**
 * Convert string input to the appropriate type based on schema
 */
function convertToType(value: string, type: VariableType): unknown {
  if (value === '') return undefined

  switch (type) {
    case 'number':
      const num = Number(value)
      return isNaN(num) ? value : num
    case 'boolean':
      return value.toLowerCase() === 'true'
    case 'array':
      try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed) ? parsed : [value]
      } catch {
        return value.split(',').map(s => s.trim()).filter(s => s !== '')
      }
    case 'object':
      try {
        return JSON.parse(value)
      } catch {
        return value
      }
    default:
      return value
  }
}

/**
 * Convert all variables to their proper types based on schema
 */
function convertVariables(
  variables: Record<string, string>,
  schema: VariableDefinition[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const schemaMap = new Map(schema.map(s => [s.name, s]))

  for (const [name, value] of Object.entries(variables)) {
    const def = schemaMap.get(name)
    if (def) {
      const converted = convertToType(value, def.type)
      if (converted !== undefined) {
        result[name] = converted
      }
    } else {
      if (value !== '') {
        result[name] = value
      }
    }
  }

  return result
}

/**
 * Hook for executing API requests with x402 payment
 * Handles EIP-3009 TransferWithAuthorization signing
 */
export function useApiTryIt({
  proxyUrl,
  httpMethod,
  variablesSchema,
}: UseApiTryItOptions): UseApiTryItReturn {
  const { address } = useConnection()
  const { mutateAsync: signTypedData } = useSignTypedData()

  const [variables, setVariables] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    variablesSchema.forEach((v) => {
      if (v.default !== undefined) {
        initial[v.name] = String(v.default)
      } else if (v.example !== undefined) {
        initial[v.name] = String(v.example)
      } else {
        initial[v.name] = ''
      }
    })
    return initial
  })

  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState<ApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const setVariable = useCallback((name: string, value: string) => {
    setVariables(prev => ({ ...prev, [name]: value }))
  }, [])

  /**
   * Sign EIP-3009 TransferWithAuthorization and create payment header
   * Per Cronos x402 spec: https://docs.cronos.org/cronos-x402-facilitator/quick-start-for-buyers
   */
  const createPaymentHeader = useCallback(async (
    requirements: PaymentRequirements,
    from: Address
  ): Promise<string> => {
    const { payTo, asset, maxAmountRequired, maxTimeoutSeconds, network } = requirements
    const chainId = parseChainId(network)

    // Build EIP-712 domain using shared utility
    const domain = buildUsdceDomain(asset, chainId)

    // Build EIP-3009 message using shared utility
    const message = buildEIP3009Message({
      from,
      to: payTo,
      value: BigInt(maxAmountRequired),
      validitySeconds: maxTimeoutSeconds,
    })

    console.log('[x402 Client] Signing payment with domain:', domain)
    console.log('[x402 Client] Signing payment with message:', {
      ...message,
      value: message.value.toString(),
      validAfter: message.validAfter.toString(),
      validBefore: message.validBefore.toString(),
    })

    const signature = await signTypedData({
      domain,
      types: EIP3009_TYPES,
      primaryType: 'TransferWithAuthorization',
      message,
    })

    console.log('[x402 Client] Signature:', signature)
    console.log('[x402 Client] Nonce:', message.nonce)

    // Debug: Verify the signature locally before sending
    try {
      const hash = hashTypedData({
        domain,
        types: EIP3009_TYPES,
        primaryType: 'TransferWithAuthorization',
        message,
      })
      console.log('[x402 Client] EIP-712 hash:', hash)

      const recoveredAddress = await recoverTypedDataAddress({
        domain,
        types: EIP3009_TYPES,
        primaryType: 'TransferWithAuthorization',
        message,
        signature,
      })
      console.log('[x402 Client] Recovered address:', recoveredAddress)
      console.log('[x402 Client] Expected address:', from)
      console.log('[x402 Client] Signature valid:', recoveredAddress.toLowerCase() === from.toLowerCase())
    } catch (verifyError) {
      console.error('[x402 Client] Local verification failed:', verifyError)
    }

    // Build payment header using shared utility
    const header = buildPaymentHeader({
      message,
      signature,
      asset,
      chainId,
    })

    console.log('[x402 Client] Payment header:', JSON.stringify(header, null, 2))

    // Encode to base64 using shared utility
    return encodePaymentHeader(header)
  }, [signTypedData])

  /**
   * Execute the API request with x402 payment flow
   */
  const executeRequest = useCallback(async () => {
    if (!address) {
      setError('Wallet not connected')
      return
    }

    setIsLoading(true)
    setError(null)
    setResponse(null)

    try {
      const typedVariables = convertVariables(variables, variablesSchema)

      console.log('[x402 Client] Making initial request to:', proxyUrl)

      // Step 1: Make initial request to get payment requirements
      const initialResponse = await fetch(proxyUrl, {
        method: httpMethod,
        headers: {
          'Content-Type': 'application/json',
          'X-Variables': JSON.stringify(typedVariables),
        },
      })

      console.log('[x402 Client] Initial response status:', initialResponse.status)

      // If not 402, the request went through without payment
      if (initialResponse.status !== 402) {
        const body = await initialResponse.text()
        setResponse({
          status: initialResponse.status,
          statusText: initialResponse.statusText,
          body,
          headers: Object.fromEntries(initialResponse.headers.entries()),
        })
        return
      }

      // Step 2: Extract payment requirements from 402 response body (per Cronos x402 spec)
      const responseData = await initialResponse.json()
      const { paymentRequirements } = responseData

      console.log('[x402 Client] Payment requirements:', paymentRequirements)

      if (!paymentRequirements || !paymentRequirements.payTo || !paymentRequirements.asset || !paymentRequirements.maxAmountRequired) {
        throw new Error('Invalid payment requirements from server')
      }

      const requirements: PaymentRequirements = {
        scheme: paymentRequirements.scheme,
        network: paymentRequirements.network,
        payTo: paymentRequirements.payTo as Address,
        asset: paymentRequirements.asset as Address,
        maxAmountRequired: paymentRequirements.maxAmountRequired,
        maxTimeoutSeconds: paymentRequirements.maxTimeoutSeconds ?? 300,
        description: paymentRequirements.description,
        mimeType: paymentRequirements.mimeType,
      }

      // Step 3: Create signed payment header
      const paymentHeaderBase64 = await createPaymentHeader(requirements, address)

      console.log('[x402 Client] Sending payment with X-PAYMENT header')

      // Step 4: Make the actual request with payment
      const paidResponse = await fetch(proxyUrl, {
        method: httpMethod,
        headers: {
          'Content-Type': 'application/json',
          'X-Variables': JSON.stringify(typedVariables),
          'X-PAYMENT': paymentHeaderBase64,
        },
      })

      console.log('[x402 Client] Paid response status:', paidResponse.status)

      const body = await paidResponse.text()
      console.log('[x402 Client] Paid response body:', body)

      setResponse({
        status: paidResponse.status,
        statusText: paidResponse.statusText,
        body,
        headers: Object.fromEntries(paidResponse.headers.entries()),
      })
    } catch (err) {
      console.error('[x402 Client] API request failed:', err)
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setIsLoading(false)
    }
  }, [address, variables, variablesSchema, proxyUrl, httpMethod, createPaymentHeader])

  return {
    variables,
    setVariable,
    isLoading,
    response,
    error,
    executeRequest,
  }
}
