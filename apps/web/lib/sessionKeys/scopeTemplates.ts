import type { Address, Hex } from 'viem'
import { cronosTestnet } from '@reown/appkit/networks'
import { getUsdceConfig } from '@/config/tokens'
import { getKnownContract } from '@/lib/contracts'
import type { EIP712Scope, ExecuteScope, SessionScope } from './types'

/**
 * Common function selectors for reference
 */
export const SELECTORS = {
  // ERC20
  transfer: '0xa9059cbb' as Hex,
  transferFrom: '0x23b872dd' as Hex,
  approve: '0x095ea7b3' as Hex,
  // EIP-3009 (USDC)
  transferWithAuthorization: '0xe3ee160e' as Hex,
  receiveWithAuthorization: '0xef55bec6' as Hex,
  // EIP-2612 (Permit)
  permit: '0xd505accf' as Hex,
} as const

// Default chain ID for the app (Cronos Testnet)
const DEFAULT_CHAIN_ID = cronosTestnet.id

/**
 * Scope template factory functions
 * Each returns a properly typed scope for the given chain
 */
export const SCOPE_TEMPLATES = {
  /**
   * x402 Payments via EIP-3009 TransferWithAuthorization
   * This is an EIP-712 scope - budgets CANNOT be enforced on-chain
   */
  'x402:payments': (chainId: number): EIP712Scope => {
    const usdce = getUsdceConfig(chainId)
    // Get known contract metadata (includes domain info)
    const knownContract = getKnownContract(usdce.address, chainId)

    return {
      id: 'x402:payments',
      type: 'eip712',
      name: 'x402 Payments',
      description: 'Sign USDC transfer authorizations for x402 API payments. Enables automated payments to API providers.',
      budgetEnforceable: false,
      approvedContracts: [{
        address: usdce.address,
        name: knownContract?.name ?? usdce.symbol,
        // Domain comes from the known contract registry
        domain: knownContract?.eip712Domain ?? { name: 'Bridged USDC (Stargate)', version: '1' },
        supportedTypes: knownContract?.supportedTypes ?? ['TransferWithAuthorization'],
      }],
    }
  },

  /**
   * EIP-2612 Permit signatures
   * Allows gasless token approvals for supported tokens
   */
  'erc20:permit': (chainId: number, tokens: { address: Address; name: string }[]): EIP712Scope => ({
    id: 'erc20:permit',
    type: 'eip712',
    name: 'Token Permits',
    description: 'Sign gasless token approval permits. Allows dApps to spend tokens without a separate approval transaction.',
    budgetEnforceable: false,
    approvedContracts: tokens.map(token => {
      const known = getKnownContract(token.address, chainId)
      return {
        address: token.address,
        name: known?.name ?? token.name,
        domain: known?.eip712Domain ?? { name: token.name, version: '1' },
        supportedTypes: ['Permit'],
      }
    }),
  }),

  /**
   * Direct Token Transfers via executeWithSession
   * This is an execute scope - target contracts and selectors are enforced on-chain
   */
  'execute:token-transfers': (
    chainId: number,
    tokens: { token: Address; symbol: string }[]
  ): ExecuteScope => ({
    id: 'execute:token-transfers',
    type: 'execute',
    name: 'Token Transfers',
    description: 'Execute token transfers directly. Target contracts are enforced on-chain.',
    budgetEnforceable: true,
    targets: tokens.map(t => ({
      address: t.token,
      name: t.symbol,
      selectors: [
        { selector: SELECTORS.transfer, name: 'transfer', description: 'Transfer tokens to an address' },
      ],
    })),
  }),

  /**
   * Token Approvals via executeWithSession
   * Allows setting token allowances for DeFi protocols
   */
  'execute:token-approvals': (tokens: { address: Address; name: string }[]): ExecuteScope => ({
    id: 'execute:token-approvals',
    type: 'execute',
    name: 'Token Approvals',
    description: 'Approve tokens for DeFi protocols. No direct spending, just allowance setting.',
    budgetEnforceable: true,
    targets: tokens.map(token => ({
      address: token.address,
      name: token.name,
      selectors: [
        { selector: SELECTORS.approve, name: 'approve', description: 'Set token allowance for a spender' },
      ],
    })),
  }),

  /**
   * Native Token (CRO/ETH) Transfers via executeWithSession
   * Target contracts are enforced on-chain for native token
   */
  'execute:native-transfers': (
    symbol: string
  ): ExecuteScope => ({
    id: 'execute:native-transfers',
    type: 'execute',
    name: `${symbol} Transfers`,
    description: `Execute native ${symbol} transfers. Target contracts are enforced on-chain.`,
    budgetEnforceable: true,
    targets: [], // Native transfers don't need target contracts
  }),
} as const

/**
 * Get the default scope for a chain (x402 payments)
 */
export function getDefaultScope(chainId: number): EIP712Scope {
  return SCOPE_TEMPLATES['x402:payments'](chainId)
}

/**
 * Get all available scope templates for UI display
 */
export function getAvailableScopeTemplates(chainId: number): {
  id: string
  name: string
  description: string
  type: 'execute' | 'eip712'
  budgetEnforceable: boolean
  factory: () => SessionScope
}[] {
  const usdce = getUsdceConfig(chainId)

  return [
    {
      id: 'x402:payments',
      name: 'x402 Payments',
      description: 'Sign USDC transfer authorizations for x402 API payments',
      type: 'eip712',
      budgetEnforceable: false,
      factory: () => SCOPE_TEMPLATES['x402:payments'](chainId),
    },
    {
      id: 'execute:token-transfers',
      name: 'USDC Transfers',
      description: 'Execute direct USDC transfers with on-chain target enforcement',
      type: 'execute',
      budgetEnforceable: true,
      factory: () => SCOPE_TEMPLATES['execute:token-transfers'](chainId, [{
        token: usdce.address,
        symbol: usdce.symbol,
      }]),
    },
  ]
}

/**
 * Validate that a scope ID is known
 */
export function isKnownScopeId(scopeId: string): boolean {
  return scopeId in SCOPE_TEMPLATES || scopeId.startsWith('custom:')
}

/**
 * Get a scope template by ID
 * Used for OAuth authorization flows where we need to instantiate scopes from IDs
 */
export function getScopeTemplateById(scopeId: string, chainId: number = DEFAULT_CHAIN_ID): {
  id: string
  factory: () => SessionScope
} | null {
  const templates = getAvailableScopeTemplates(chainId)
  const template = templates.find(t => t.id === scopeId)
  if (template) {
    return {
      id: template.id,
      factory: template.factory,
    }
  }

  // Handle known template IDs that might not be in the available list
  if (scopeId === 'x402:payments') {
    return {
      id: scopeId,
      factory: () => SCOPE_TEMPLATES['x402:payments'](chainId),
    }
  }

  return null
}
