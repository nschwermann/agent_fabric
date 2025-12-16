'use client'

import { useState, useCallback } from 'react'
import { useSignTypedData, useConnection } from 'wagmi'
import { type Address, toHex, hashTypedData, recoverTypedDataAddress } from 'viem'
import type { VariableDefinition, VariableType } from '@/features/proxy/model/variables'

/**
 * EIP-3009 TransferWithAuthorization typed data structure
 * Used by USDX and other tokens that support gasless transfers
 */
const EIP3009_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const

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
 * Generate a random 32-byte nonce for EIP-3009 authorization
 */
function generateNonce(): `0x${string}` {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return toHex(bytes)
}

/**
 * Build EIP-712 domain for the USDC.e token contract on Cronos
 * Verified by testing against the contract's transferWithAuthorization
 *
 * IMPORTANT: The chainId MUST be passed as a number (not BigInt or string)
 * to match how viem/wagmi encodes EIP-712 domains.
 */
function buildTokenDomain(tokenAddress: Address, chainId: number) {
  return {
    name: 'Bridged USDC (Stargate)',
    version: '1',
    chainId: chainId,
    verifyingContract: tokenAddress,
  } as const
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
   * Parse chain ID from network string (per Cronos x402 spec)
   */
  const parseChainId = (network: string): number => {
    if (network === 'cronos-testnet') return 338
    if (network === 'cronos') return 25
    throw new Error(`Unknown network: ${network}`)
  }

  /**
   * Sign EIP-3009 TransferWithAuthorization and create payment header
   * Per Cronos x402 spec: https://docs.cronos.org/cronos-x402-facilitator/quick-start-for-buyers
   */
  const createPaymentHeader = useCallback(async (
    requirements: PaymentRequirements,
    from: Address
  ): Promise<string> => {
    const { payTo, asset, maxAmountRequired, maxTimeoutSeconds, scheme, network } = requirements
    const chainId = parseChainId(network)

    const domain = buildTokenDomain(asset, chainId)

    // Generate random 32-byte nonce (per Cronos docs)
    const nonce = generateNonce()

    // Calculate validity window (per Cronos docs - use seconds, not milliseconds)
    const validAfter = 0
    const validBefore = Math.floor(Date.now() / 1000) + maxTimeoutSeconds

    // EIP-3009 authorization message (per Cronos x402 spec)
    // viem requires BigInt for uint256 types
    const message = {
      from,
      to: payTo,
      value: BigInt(maxAmountRequired),
      validAfter: BigInt(validAfter),
      validBefore: BigInt(validBefore),
      nonce,
    }

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

    // Debug: Log nonce details
    const nonceWithoutPrefix = nonce.slice(2)
    console.log('[x402 Client] Nonce length (hex chars):', nonceWithoutPrefix.length, '(should be 64 for 32 bytes)')
    console.log('[x402 Client] Nonce:', nonce)

    // Verify the signature locally before sending
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

    // Construct payment header per Cronos x402 spec
    const paymentHeader = {
      x402Version: 1,
      scheme: scheme,
      network: network,
      payload: {
        from: from,
        to: payTo,
        value: maxAmountRequired,
        validAfter: validAfter,
        validBefore: validBefore,
        nonce: nonce,
        signature: signature,
        asset: asset,
      },
    }

    console.log('[x402 Client] Payment header:', JSON.stringify(paymentHeader, null, 2))

    // Base64-encode the payment header (per Cronos x402 spec)
    const base64Header = Buffer.from(JSON.stringify(paymentHeader)).toString('base64')
    return base64Header
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
