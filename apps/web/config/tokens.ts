import type { Address } from 'viem'
import { cronos, cronosTestnet } from '@reown/appkit/networks'

export interface TokenConfig {
  address: Address
  symbol: string
  decimals: number
}

export interface ChainTokens {
  usdce: TokenConfig
  native: {
    symbol: string
    decimals: number
  }
}

export const tokens: Record<number, ChainTokens> = {
  // Cronos Mainnet
  [cronos.id]: {
    usdce: {
      address: '0xf951eC28187D9E5Ca673Da8FE6757E6f0Be5F77C',
      symbol: 'USDC.E',
      decimals: 6,
    },
    native: {
      symbol: 'CRO',
      decimals: 18,
    },
  },
  // Cronos Testnet
  [cronosTestnet.id]: {
    usdce: {
      address: '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0',
      symbol: 'USDC.E',
      decimals: 6,
    },
    native: {
      symbol: 'TCRO',
      decimals: 18,
    },
  },
} as const

export function isChainSupported(chainId: number): boolean {
  return chainId in tokens
}

export function getTokens(chainId: number): ChainTokens {
  const chainTokens = tokens[chainId]
  if (!chainTokens) {
    throw new Error(`Unsupported chain: ${chainId}`)
  }
  return chainTokens
}

export function getUsdceConfig(chainId: number): TokenConfig {
  return getTokens(chainId).usdce
}

export function getUsdceConfigSafe(chainId: number): TokenConfig | null {
  return tokens[chainId]?.usdce ?? null
}

export function getNativeConfig(chainId: number): ChainTokens['native'] {
  return getTokens(chainId).native
}

// Default chain for the app
export const defaultChainId = cronos.id
