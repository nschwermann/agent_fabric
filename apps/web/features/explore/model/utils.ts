/**
 * Utility functions for the explore feature
 */

/**
 * UUID regex pattern for validation
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Check if a string is a valid UUID
 */
export function isUUID(str: string): boolean {
  return UUID_REGEX.test(str)
}

/**
 * Format a price from smallest unit (1/1,000,000 of a dollar) to display format
 *
 * Examples:
 * - 100 => "$0.000100"
 * - 10000 => "$0.0100"
 * - 1000000 => "$1.00"
 * - 5000000 => "$5.00"
 */
export function formatPrice(priceInSmallestUnit: number): string {
  const price = priceInSmallestUnit / 1_000_000

  if (price < 0.01) {
    return `$${price.toFixed(6)}`
  }

  if (price < 1) {
    return `$${price.toFixed(4)}`
  }

  return `$${price.toFixed(2)}`
}

/**
 * Build the proxy URL from base URL and slug/id
 */
export function buildProxyUrl(baseUrl: string, slugOrId: string): string {
  return `${baseUrl}/api/proxy/${slugOrId}`
}

/**
 * Generate integration example code for the API
 */
export function generateIntegrationExample(
  proxyUrl: string,
  httpMethod: string
): string {
  return `// 1. Make initial request (will return 402)
const response = await fetch('${proxyUrl}', {
  method: '${httpMethod}',
  headers: {
    'Content-Type': 'application/json',
    'X-Variables': JSON.stringify({ /* your variables */ })
  }
});

// 2. Extract payment requirements from 402 response headers
const amount = response.headers.get('X-402-Amount');
const token = response.headers.get('X-402-Token');
const recipient = response.headers.get('X-402-Recipient');
const chainId = response.headers.get('X-402-Chain-Id');
const nonce = response.headers.get('X-402-Nonce');

// 3. Sign payment message with your wallet
const paymentMessage = JSON.stringify({ amount, token, recipient, chainId, nonce });
const signature = await wallet.signMessage(paymentMessage);

// 4. Retry with payment header
const paidResponse = await fetch('${proxyUrl}', {
  method: '${httpMethod}',
  headers: {
    'Content-Type': 'application/json',
    'X-Variables': JSON.stringify({ /* your variables */ }),
    'X-402-Payment': JSON.stringify({ signature, amount, token, recipient, chainId, nonce })
  }
});`
}
