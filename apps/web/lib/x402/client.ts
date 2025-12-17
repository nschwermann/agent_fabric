import { type Address, toHex } from 'viem'

/**
 * x402 Client-side Payment Utilities
 *
 * Shared utilities for creating EIP-3009 TransferWithAuthorization payments
 * used by the Cronos x402 protocol. These can be used by any component that
 * needs to sign and submit payments.
 */

/**
 * EIP-3009 TransferWithAuthorization typed data structure
 * Used by USDC.E and other tokens that support gasless transfers
 */
export const EIP3009_TYPES = {
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
 * EIP-3009 authorization message structure
 */
export interface EIP3009Message {
  from: Address
  to: Address
  value: bigint
  validAfter: bigint
  validBefore: bigint
  nonce: `0x${string}`
}

/**
 * x402 payment header payload structure
 */
export interface PaymentPayloadClient {
  from: Address
  to: Address
  value: string
  validAfter: number
  validBefore: number
  nonce: string
  signature: string
  asset: Address
}

/**
 * x402 payment header structure (before base64 encoding)
 */
export interface PaymentHeaderClient {
  x402Version: 1
  scheme: 'exact'
  network: 'cronos' | 'cronos-testnet'
  payload: PaymentPayloadClient
}

/**
 * Generate a random 32-byte nonce for EIP-3009 authorization
 */
export function generateNonce(): `0x${string}` {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return toHex(bytes)
}

/**
 * Build EIP-712 domain for the USDC.E token contract on Cronos
 *
 * IMPORTANT: The chainId MUST be passed as a number (not BigInt or string)
 * to match how viem/wagmi encodes EIP-712 domains.
 */
export function buildUsdceDomain(tokenAddress: Address, chainId: number) {
  return {
    name: 'Bridged USDC (Stargate)',
    version: '1',
    chainId: chainId,
    verifyingContract: tokenAddress,
  } as const
}

/**
 * Parse chain ID from network string (per Cronos x402 spec)
 */
export function parseChainId(network: string): number {
  if (network === 'cronos-testnet') return 338
  if (network === 'cronos') return 25
  throw new Error(`Unknown network: ${network}`)
}

/**
 * Get network string from chain ID
 */
export function getNetworkFromChainId(chainId: number): 'cronos' | 'cronos-testnet' {
  return chainId === 25 ? 'cronos' : 'cronos-testnet'
}

/**
 * Build an EIP-3009 authorization message for signing
 */
export function buildEIP3009Message(params: {
  from: Address
  to: Address
  value: bigint
  validitySeconds?: number
}): EIP3009Message {
  const { from, to, value, validitySeconds = 300 } = params
  const nonce = generateNonce()
  const validAfter = 0
  const validBefore = Math.floor(Date.now() / 1000) + validitySeconds

  return {
    from,
    to,
    value,
    validAfter: BigInt(validAfter),
    validBefore: BigInt(validBefore),
    nonce,
  }
}

/**
 * Build an x402 payment header from a signed message
 */
export function buildPaymentHeader(params: {
  message: EIP3009Message
  signature: string
  asset: Address
  chainId: number
}): PaymentHeaderClient {
  const { message, signature, asset, chainId } = params

  return {
    x402Version: 1,
    scheme: 'exact',
    network: getNetworkFromChainId(chainId),
    payload: {
      from: message.from,
      to: message.to,
      value: message.value.toString(),
      validAfter: Number(message.validAfter),
      validBefore: Number(message.validBefore),
      nonce: message.nonce,
      signature,
      asset,
    },
  }
}

/**
 * Encode a payment header to base64 for the X-PAYMENT header
 */
export function encodePaymentHeader(header: PaymentHeaderClient): string {
  return Buffer.from(JSON.stringify(header)).toString('base64')
}
