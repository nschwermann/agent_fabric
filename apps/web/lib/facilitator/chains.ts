import type { Address } from 'viem'
import type { ChainConfig, PaymentRequirements } from './types'

/** Default chain ID (testnet) */
export const defaultChainId = 338

/**
 * Chain configurations for the facilitator
 *
 * Each chain has:
 * - Official facilitator URL (if one exists)
 * - USDC.E token address
 * - RPC URL for on-chain calls
 */
export const chainConfigs: Record<number, ChainConfig> = {
  // Cronos Mainnet
  25: {
    chainId: 25,
    name: 'cronos',
    officialFacilitatorUrl: 'https://facilitator.cronoslabs.org/v2/x402',
    usdcAddress: '0xf951eC28187D9E5Ca673Da8FE6757E6f0Be5F77C' as Address,
    rpcUrl: 'https://evm.cronos.org',
  },
  // Cronos Testnet
  338: {
    chainId: 338,
    name: 'cronos-testnet',
    officialFacilitatorUrl: 'https://facilitator.cronoslabs.org/v2/x402',
    usdcAddress: '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0' as Address,
    rpcUrl: 'https://evm-t3.cronos.org',
  },
  // Future chains can be added here
  // Base, Arbitrum, etc. would have officialFacilitatorUrl: null
  // and would only support smart account signatures via our local verification
}

/**
 * Get chain configuration by chain ID
 */
export function getChainConfig(chainId: number): ChainConfig | null {
  return chainConfigs[chainId] ?? null
}

/**
 * Parse network string to chain ID
 * Supports both "cronos-testnet" format and "eip155:338" format
 */
export function parseChainId(network: string): number {
  // Handle Cronos network names
  if (network === 'cronos-testnet') return 338
  if (network === 'cronos') return 25

  // Handle CAIP-2 format (eip155:chainId)
  const parts = network.split(':')
  if (parts.length === 2 && parts[0] === 'eip155') {
    return parseInt(parts[1], 10)
  }

  throw new Error(`Invalid network format: ${network}`)
}

/**
 * Get network string from chain ID
 */
export function getNetworkFromChainId(chainId: number): string {
  const config = chainConfigs[chainId]
  if (config) {
    return config.name
  }
  return `eip155:${chainId}`
}

/**
 * Get USDC.E token address for a chain
 */
export function getUsdceAddress(chainId: number = defaultChainId): Address {
  const config = chainConfigs[chainId]
  if (!config) {
    throw new Error(`Unsupported chain: ${chainId}`)
  }
  return config.usdcAddress
}

/**
 * Payment details for building requirements
 */
export interface PaymentDetails {
  amount: number
  asset: Address
  recipient: Address
  chainId: number
  description?: string
  mimeType?: string
  maxTimeoutSeconds?: number
}

/**
 * Build payment requirements for 402 response
 */
export function buildPaymentRequirements(details: PaymentDetails): PaymentRequirements {
  const network = getNetworkFromChainId(details.chainId)

  return {
    scheme: 'exact',
    network,
    payTo: details.recipient,
    asset: details.asset,
    maxAmountRequired: details.amount.toString(),
    maxTimeoutSeconds: details.maxTimeoutSeconds ?? 300,
    description: details.description,
    mimeType: details.mimeType,
  }
}
