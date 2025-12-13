import { NextRequest, NextResponse } from 'next/server'
import { db, apiProxies, requestLogs } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { decryptHybrid, type HybridEncryptedData } from '@/lib/crypto/encryption'
import {
  verifyPayment,
  generatePaymentNonce,
  buildPaymentRequiredHeaders,
  getUsdceAddress,
  getPaymentRecipient,
  type PaymentVerificationRequest,
} from '@/lib/x402'

type RouteParams = { params: Promise<{ id: string }> }

// Timeout for proxied requests (30 seconds)
const PROXY_TIMEOUT_MS = 30_000

/**
 * Main proxy endpoint that handles x402 payments.
 *
 * Flow:
 * 1. Check if payment header exists
 * 2. If no payment -> return 402 with payment details
 * 3. If payment exists -> verify with facilitator
 * 4. If verified -> decrypt headers, proxy to target, return response
 * 5. Log request
 */
async function handleProxyRequest(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id } = await params
  let proxyId = id
  let status: 'success' | 'payment_failed' | 'payment_required' | 'proxy_error' = 'proxy_error'
  let requesterWallet: string | null = null

  try {
    // Get proxy configuration
    const proxy = await db.query.apiProxies.findFirst({
      where: eq(apiProxies.id, id),
    })

    if (!proxy) {
      return NextResponse.json(
        { error: 'Proxy not found' },
        { status: 404 }
      )
    }

    // Extract payment header
    const paymentHeader = request.headers.get('X-402-Payment')

    // If no payment, return 402 Payment Required
    if (!paymentHeader) {
      const chainId = parseInt(process.env.NEXT_PUBLIC_CRONOS_CHAIN_ID || '338', 10)
      const nonce = await generatePaymentNonce()

      const paymentHeaders = buildPaymentRequiredHeaders({
        amount: proxy.pricePerRequest,
        token: getUsdceAddress(chainId),
        recipient: getPaymentRecipient(),
        chainId,
        nonce,
      })

      status = 'payment_required'

      // Log the request
      await logRequest(proxyId, requesterWallet, status)

      return new NextResponse(
        JSON.stringify({
          error: 'Payment required',
          message: 'This API requires payment via x402 protocol',
        }),
        {
          status: 402,
          headers: paymentHeaders,
        }
      )
    }

    // Parse and verify payment
    let paymentData: PaymentVerificationRequest
    try {
      paymentData = JSON.parse(paymentHeader)
      requesterWallet = paymentData.signature ? extractWalletFromSignature(paymentData.signature) : null
    } catch {
      status = 'payment_failed'
      await logRequest(proxyId, requesterWallet, status)

      return NextResponse.json(
        { error: 'Invalid payment header format' },
        { status: 400 }
      )
    }

    // Verify payment
    const isValid = await verifyPayment(paymentData)

    if (!isValid) {
      status = 'payment_failed'
      await logRequest(proxyId, requesterWallet, status)

      return NextResponse.json(
        { error: 'Payment verification failed' },
        { status: 402 }
      )
    }

    // Payment verified - proxy the request
    try {
      const response = await proxyToTarget(request, proxy)
      status = 'success'
      await logRequest(proxyId, requesterWallet, status)

      return response
    } catch (error) {
      console.error('[Proxy] Error forwarding request:', error)
      status = 'proxy_error'
      await logRequest(proxyId, requesterWallet, status)

      return NextResponse.json(
        { error: 'Failed to proxy request to target' },
        { status: 502 }
      )
    }
  } catch (error) {
    console.error('[Proxy] Unexpected error:', error)
    await logRequest(proxyId, requesterWallet, status)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Proxy the request to the target URL.
 */
async function proxyToTarget(
  request: NextRequest,
  proxy: {
    targetUrl: string
    encryptedHeaders: unknown
  }
): Promise<NextResponse> {
  // Build headers for target request
  const targetHeaders = new Headers()

  // Copy safe headers from original request
  const safeHeaders = [
    'accept',
    'accept-language',
    'content-type',
    'content-length',
  ]

  for (const header of safeHeaders) {
    const value = request.headers.get(header)
    if (value) {
      targetHeaders.set(header, value)
    }
  }

  // Decrypt and add stored headers
  if (proxy.encryptedHeaders) {
    try {
      const decryptedHeaders = decryptHybrid(proxy.encryptedHeaders as HybridEncryptedData)
      for (const [key, value] of Object.entries(decryptedHeaders)) {
        targetHeaders.set(key, value)
      }
    } catch (error) {
      console.error('[Proxy] Failed to decrypt headers:', error)
      throw new Error('Failed to decrypt proxy headers')
    }
  }

  // Get request body if present
  let body: BodyInit | null = null
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await request.text()
  }

  // Create abort controller for timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS)

  try {
    const targetResponse = await fetch(proxy.targetUrl, {
      method: request.method,
      headers: targetHeaders,
      body,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // Build response headers (filter out hop-by-hop headers)
    const responseHeaders = new Headers()
    const hopByHopHeaders = [
      'connection',
      'keep-alive',
      'proxy-authenticate',
      'proxy-authorization',
      'te',
      'trailers',
      'transfer-encoding',
      'upgrade',
    ]

    targetResponse.headers.forEach((value, key) => {
      if (!hopByHopHeaders.includes(key.toLowerCase())) {
        responseHeaders.set(key, value)
      }
    })

    // Return proxied response
    const responseBody = await targetResponse.arrayBuffer()

    return new NextResponse(responseBody, {
      status: targetResponse.status,
      statusText: targetResponse.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout')
    }

    throw error
  }
}

/**
 * Log a proxy request to the database.
 */
async function logRequest(
  proxyId: string,
  requesterWallet: string | null,
  status: string
): Promise<void> {
  try {
    await db.insert(requestLogs).values({
      proxyId,
      requesterWallet,
      status,
    })
  } catch (error) {
    // Don't fail the request if logging fails
    console.error('[Proxy] Failed to log request:', error)
  }
}

/**
 * Extract wallet address from payment signature (placeholder).
 * In production, this would recover the address from the signature.
 */
function extractWalletFromSignature(signature: string): string | null {
  // TODO: Implement proper signature recovery
  // For now, return null
  return null
}

// Export handlers for all HTTP methods
export async function GET(request: NextRequest, context: RouteParams) {
  return handleProxyRequest(request, context)
}

export async function POST(request: NextRequest, context: RouteParams) {
  return handleProxyRequest(request, context)
}

export async function PUT(request: NextRequest, context: RouteParams) {
  return handleProxyRequest(request, context)
}

export async function PATCH(request: NextRequest, context: RouteParams) {
  return handleProxyRequest(request, context)
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  return handleProxyRequest(request, context)
}

export async function OPTIONS(request: NextRequest, context: RouteParams) {
  return handleProxyRequest(request, context)
}
