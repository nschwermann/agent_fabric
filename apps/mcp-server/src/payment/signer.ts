import {
  createPrivateKey,
  privateDecrypt,
  createDecipheriv,
  constants,
  KeyObject,
  randomBytes,
} from 'crypto'
import {
  type Address,
  type Hex,
  toHex,
  keccak256,
  encodeAbiParameters,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import type { SessionKey, ApiProxy } from '../db/client.js'

// Constants
const AES_ALGORITHM = 'aes-256-gcm'

/**
 * Hybrid encrypted data structure from the web app
 */
interface HybridEncryptedData {
  encryptedKey: string
  iv: string
  ciphertext: string
  tag: string
}

/**
 * EIP-3009 TransferWithAuthorization typed data structure
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
 * EIP-712 domain for SessionSignature (used by smart account)
 */
const SESSION_SIGNATURE_TYPES = {
  SessionSignature: [
    { name: 'verifyingContract', type: 'address' },
    { name: 'structHash', type: 'bytes32' },
  ],
} as const

// Cache server private key
let serverPrivateKey: KeyObject | null = null

/**
 * Normalize PEM key from environment variable
 */
function normalizePem(pem: string): string {
  return pem.replace(/\\n/g, '\n')
}

/**
 * Get the server's RSA private key for decrypting session keys
 */
function getServerPrivateKey(): KeyObject {
  if (serverPrivateKey) return serverPrivateKey

  const privateKeyPem = process.env.SERVER_PRIVATE_KEY
  if (!privateKeyPem) {
    throw new Error('SERVER_PRIVATE_KEY environment variable is not set')
  }

  serverPrivateKey = createPrivateKey(normalizePem(privateKeyPem))
  return serverPrivateKey
}

/**
 * Decrypt hybrid encrypted data (session key private key)
 */
function decryptHybrid(encrypted: HybridEncryptedData): string {
  const privateKey = getServerPrivateKey()

  // Decrypt the AES key with RSA-OAEP
  const encryptedKeyBuffer = Buffer.from(encrypted.encryptedKey, 'base64')
  const aesKey = privateDecrypt(
    {
      key: privateKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    encryptedKeyBuffer
  )

  // Decrypt the data with AES-GCM
  const iv = Buffer.from(encrypted.iv, 'base64')
  const ciphertext = Buffer.from(encrypted.ciphertext, 'base64')
  const tag = Buffer.from(encrypted.tag, 'base64')

  const decipher = createDecipheriv(AES_ALGORITHM, aesKey, iv)
  decipher.setAuthTag(tag)

  let plaintext = decipher.update(ciphertext, undefined, 'utf8')
  plaintext += decipher.final('utf8')

  return plaintext
}

/**
 * Decrypt a session key's private key
 */
export function decryptSessionKey(encryptedPrivateKey: HybridEncryptedData): Hex {
  const decrypted = decryptHybrid(encryptedPrivateKey)
  // The decrypted data is the private key as a hex string
  return decrypted as Hex
}

/**
 * Generate a random 32-byte nonce for EIP-3009 authorization
 */
export function generateNonce(): Hex {
  const bytes = randomBytes(32)
  return toHex(bytes)
}

/**
 * Build EIP-712 domain for USDC.e token
 */
function buildUsdceDomain(tokenAddress: Address, chainId: number) {
  return {
    name: 'Bridged USDC (Stargate)',
    version: '1',
    chainId,
    verifyingContract: tokenAddress,
  } as const
}

/**
 * Build EIP-712 domain for smart account (for session key signatures)
 */
function buildSmartAccountDomain(smartAccountAddress: Address, chainId: number) {
  return {
    name: 'ERC7702Account',
    version: '1',
    chainId,
    verifyingContract: smartAccountAddress,
  } as const
}

/**
 * Get network string from chain ID
 */
function getNetworkFromChainId(chainId: number): 'cronos' | 'cronos-testnet' {
  return chainId === 25 ? 'cronos' : 'cronos-testnet'
}

/**
 * Get USDC.e address for chain
 */
function getUsdceAddress(chainId: number): Address {
  if (chainId === 25) {
    return '0xf951eC28187D9E5Ca673Da8FE6757E6f0Be5F77C'
  }
  // Testnet
  return '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0'
}

/**
 * Sign an x402 payment using a session key
 *
 * Creates a 149-byte signature in the format:
 * sessionId (32) + verifyingContract (20) + structHash (32) + ecdsaSignature (65)
 */
export async function signPayment(params: {
  session: SessionKey
  ownerAddress: Address
  recipientAddress: Address
  amount: bigint
  chainId: number
}): Promise<string> {
  const { session, ownerAddress, recipientAddress, amount, chainId } = params

  // Decrypt the session key's private key
  const privateKey = decryptSessionKey(session.encryptedPrivateKey as HybridEncryptedData)
  const sessionAccount = privateKeyToAccount(privateKey)

  const usdceAddress = getUsdceAddress(chainId)
  const nonce = generateNonce()
  const validAfter = 0n
  const validBefore = BigInt(Math.floor(Date.now() / 1000) + 300) // 5 minutes validity

  // Build the EIP-3009 message
  const eip3009Message = {
    from: ownerAddress,
    to: recipientAddress,
    value: amount,
    validAfter,
    validBefore,
    nonce,
  }

  // Get the struct hash for EIP-3009 TransferWithAuthorization
  const structHash = keccak256(
    encodeAbiParameters(
      [
        { type: 'bytes32' },
        { type: 'address' },
        { type: 'address' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'bytes32' },
      ],
      [
        keccak256(
          new TextEncoder().encode(
            'TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)'
          )
        ) as Hex,
        ownerAddress,
        recipientAddress,
        amount,
        validAfter,
        validBefore,
        nonce,
      ]
    )
  )

  // Build the SessionSignature message that the session key will sign
  const sessionSignatureMessage = {
    verifyingContract: usdceAddress,
    structHash,
  }

  // Sign with the session key using the smart account's domain
  const signature = await sessionAccount.signTypedData({
    domain: buildSmartAccountDomain(ownerAddress, chainId),
    types: SESSION_SIGNATURE_TYPES,
    primaryType: 'SessionSignature',
    message: sessionSignatureMessage,
  })

  // Build the 149-byte signature format:
  // sessionId (32 bytes) + verifyingContract (20 bytes) + structHash (32 bytes) + ecdsaSignature (65 bytes)
  const sessionIdHex = session.sessionId.slice(2) // Remove 0x prefix (64 chars = 32 bytes)
  const verifyingContractHex = usdceAddress.slice(2).toLowerCase() // Remove 0x prefix (40 chars = 20 bytes)
  const structHashHex = structHash.slice(2) // Remove 0x prefix (64 chars = 32 bytes)
  const signatureHex = signature.slice(2) // Remove 0x prefix (130 chars = 65 bytes)

  const fullSignature = `0x${sessionIdHex}${verifyingContractHex}${structHashHex}${signatureHex}` as Hex

  // Build x402 payment header
  const paymentHeader = {
    x402Version: 1,
    scheme: 'exact',
    network: getNetworkFromChainId(chainId),
    payload: {
      from: ownerAddress,
      to: recipientAddress,
      value: amount.toString(),
      validAfter: Number(validAfter),
      validBefore: Number(validBefore),
      nonce,
      signature: fullSignature,
      asset: usdceAddress,
    },
  }

  // Encode as base64 for X-PAYMENT header
  return Buffer.from(JSON.stringify(paymentHeader)).toString('base64')
}

/**
 * Build payment for a proxy request
 */
export async function buildPaymentForProxy(
  session: SessionKey,
  proxy: ApiProxy,
  chainId: number
): Promise<string> {
  // Get the user's wallet address from the session
  // The session is linked to a user, and we need the owner address for payments
  // For now, we'll use the sessionKeyAddress owner (which should be derived from the smart account)
  // In a real implementation, you'd fetch the user's wallet address

  const { db, users } = await import('../db/client.js')
  const { eq } = await import('drizzle-orm')

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  })

  if (!user) {
    throw new Error('User not found for session')
  }

  return signPayment({
    session,
    ownerAddress: user.walletAddress as Address,
    recipientAddress: proxy.paymentAddress as Address,
    amount: BigInt(proxy.pricePerRequest),
    chainId,
  })
}
