import { paymentNonceRepository } from '@/lib/repositories'
import { getUsdceConfig, defaultChainId } from '@/config/tokens'

/**
 * x402 Payment Verification Service
 *
 * Handles verification of x402 payments via the Cronos facilitator
 * and manages payment nonces to prevent replay attacks.
 */

export interface PaymentVerificationRequest {
  /** The payment signature from the client */
  signature: string
  /** Unique nonce to prevent replay attacks */
  nonce: string
  /** Payment amount in smallest unit (e.g., 1000000 = 1 USDC) */
  amount: string
  /** Token contract address */
  token: string
  /** Payment recipient address */
  recipient: string
  /** Chain ID (25 for Cronos mainnet, 338 for testnet) */
  chainId: number
}

export interface PaymentDetails {
  amount: number
  token: string
  recipient: string
  chainId: number
  nonce: string
}

/**
 * Generate a unique nonce for a payment request.
 */
export async function generatePaymentNonce(): Promise<string> {
  return paymentNonceRepository.generate()
}

/**
 * Check if a payment nonce has been used (for replay attack detection).
 */
export async function isPaymentNonceUsed(nonce: string): Promise<boolean> {
  return paymentNonceRepository.isUsed(nonce)
}

/**
 * Verify a payment with the x402 facilitator.
 *
 * @param request - The payment verification request from the client
 * @returns true if payment is valid and nonce was consumed
 */
export async function verifyPayment(
  request: PaymentVerificationRequest
): Promise<boolean> {
  const facilitatorUrl = process.env.NEXT_PUBLIC_X402_FACILITATOR_URL

  if (!facilitatorUrl) {
    console.error('[x402] NEXT_PUBLIC_X402_FACILITATOR_URL is not configured')
    return false
  }

  try {
    // Check for replay attack
    if (await paymentNonceRepository.isUsed(request.nonce)) {
      console.warn('[x402] Nonce already used:', request.nonce)
      return false
    }

    // Verify with facilitator
    const response = await fetch(`${facilitatorUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      console.error('[x402] Facilitator returned error:', response.status)
      return false
    }

    const result = await response.json()

    if (result.verified === true) {
      // Mark nonce as used atomically
      const consumed = await paymentNonceRepository.consume(request.nonce)
      if (!consumed) {
        // Race condition - nonce was used between check and consume
        console.warn('[x402] Nonce consumed by another request:', request.nonce)
        return false
      }
      return true
    }

    return false
  } catch (error) {
    console.error('[x402] Payment verification failed:', error)
    return false
  }
}

/**
 * Build the x402 payment required response headers.
 */
export function buildPaymentRequiredHeaders(details: PaymentDetails): Headers {
  const headers = new Headers()

  headers.set('X-402-Version', '1')
  headers.set('X-402-Amount', details.amount.toString())
  headers.set('X-402-Token', details.token)
  headers.set('X-402-Recipient', details.recipient)
  headers.set('X-402-Chain-Id', details.chainId.toString())
  headers.set('X-402-Nonce', details.nonce)

  return headers
}

/**
 * Get the USDC.E token address for the chain.
 */
export function getUsdceAddress(chainId: number = defaultChainId): string {
  return getUsdceConfig(chainId).address
}

/**
 * Get the platform payment recipient address.
 */
export function getPaymentRecipient(): string {
  const recipient = process.env.PAYMENT_RECIPIENT_ADDRESS

  if (!recipient) {
    throw new Error('PAYMENT_RECIPIENT_ADDRESS is not configured')
  }

  return recipient
}
