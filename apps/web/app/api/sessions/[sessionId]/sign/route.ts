import { NextResponse } from 'next/server'
import { db, sessionKeys } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { withAuth } from '@/lib/auth'
import { decryptHybrid } from '@/lib/crypto/encryption'
import { privateKeyToAccount } from 'viem/accounts'
import { concat, keccak256, encodeAbiParameters, type Hex, type Address } from 'viem'
// Note: We compute structHash directly instead of using hashTypedData with domain/types
import { isContractApproved } from '@/lib/sessionKeys/flattenScopes'
import { deserializeScope, type SerializedSessionScope } from '@/lib/sessionKeys/types'

/**
 * EIP-712 types for session key signatures
 * Used to bind session signatures to specific contracts with domain verification
 */
const SESSION_SIGNATURE_TYPES = {
  SessionSignature: [
    { name: 'verifyingContract', type: 'address' },
    { name: 'structHash', type: 'bytes32' },
  ],
} as const

/**
 * Compute the EIP-712 struct hash for TransferWithAuthorization
 * structHash = keccak256(abi.encode(TYPE_HASH, from, to, value, validAfter, validBefore, nonce))
 */
function computeTransferWithAuthorizationStructHash(message: {
  from: Address
  to: Address
  value: bigint
  validAfter: bigint
  validBefore: bigint
  nonce: Hex
}): Hex {
  // Type hash for TransferWithAuthorization
  const typeHash = keccak256(
    new TextEncoder().encode(
      'TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)'
    )
  ) as Hex

  // Encode and hash the struct
  const encoded = encodeAbiParameters(
    [
      { type: 'bytes32' },  // typeHash
      { type: 'address' },  // from
      { type: 'address' },  // to
      { type: 'uint256' },  // value
      { type: 'uint256' },  // validAfter
      { type: 'uint256' },  // validBefore
      { type: 'bytes32' },  // nonce
    ],
    [
      typeHash,
      message.from,
      message.to,
      message.value,
      message.validAfter,
      message.validBefore,
      message.nonce,
    ]
  )

  return keccak256(encoded)
}

/**
 * Build EIP-712 domain for AgentDelegator contract
 * The verifyingContract is the user's wallet address (where AgentDelegator is delegated)
 */
function buildAgentDelegatorDomain(walletAddress: Address, chainId: number) {
  return {
    name: 'AgentDelegator',
    version: '1',
    chainId,
    verifyingContract: walletAddress,
  } as const
}

/**
 * POST /api/sessions/[sessionId]/sign - Sign an EIP-3009 payment with session key
 *
 * This endpoint:
 * 1. Verifies the session belongs to the authenticated user
 * 2. Verifies the session is active and not expired
 * 3. Verifies the tokenAddress is in the session's approvedContracts
 * 4. Decrypts the session key's private key
 * 5. Computes structHash = keccak256(abi.encode(TYPE_HASH, message params))
 * 6. Signs EIP-712 typed data: SessionSignature(verifyingContract, structHash)
 * 7. Returns a 149-byte signature: sessionId (32) + tokenAddress (20) + structHash (32) + ecdsaSig (65)
 *
 * The 149-byte signature format allows on-chain preimage verification:
 * - Contract can verify hash == keccak256("\x19\x01" || domainSeparator || structHash)
 * - This proves the signature is bound to this specific contract's domain
 */
export const POST = withAuth(async (user, request, context) => {
  const { sessionId } = await context.params
  const body = await request.json()

  const {
    from,
    to,
    value,
    validAfter,
    validBefore,
    nonce,
    chainId,
    tokenAddress,
  } = body

  // Validate required fields
  if (!from || !/^0x[0-9a-f]{40}$/i.test(from)) {
    return NextResponse.json({ error: 'Invalid from address' }, { status: 400 })
  }
  if (!to || !/^0x[0-9a-f]{40}$/i.test(to)) {
    return NextResponse.json({ error: 'Invalid to address' }, { status: 400 })
  }
  if (!value || typeof value !== 'string') {
    return NextResponse.json({ error: 'Invalid value' }, { status: 400 })
  }
  if (typeof validAfter !== 'number' || typeof validBefore !== 'number') {
    return NextResponse.json({ error: 'Invalid validAfter/validBefore' }, { status: 400 })
  }
  if (!nonce || !/^0x[0-9a-f]{64}$/i.test(nonce)) {
    return NextResponse.json({ error: 'Invalid nonce - must be bytes32 hex' }, { status: 400 })
  }
  if (typeof chainId !== 'number') {
    return NextResponse.json({ error: 'Invalid chainId' }, { status: 400 })
  }
  if (!tokenAddress || !/^0x[0-9a-f]{40}$/i.test(tokenAddress)) {
    return NextResponse.json({ error: 'Invalid tokenAddress' }, { status: 400 })
  }

  // Find the session and verify ownership
  const session = await db.query.sessionKeys.findFirst({
    where: and(
      eq(sessionKeys.sessionId, sessionId.toLowerCase()),
      eq(sessionKeys.userId, user.id),
      eq(sessionKeys.isActive, true)
    ),
  })

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // Verify session is still valid
  const now = new Date()
  if (now < session.validAfter) {
    return NextResponse.json({ error: 'Session not yet active' }, { status: 400 })
  }
  if (now > session.validUntil) {
    return NextResponse.json({ error: 'Session expired' }, { status: 400 })
  }

  // Verify from address matches user's wallet
  if (from.toLowerCase() !== user.walletAddress.toLowerCase()) {
    return NextResponse.json({ error: 'From address must match authenticated wallet' }, { status: 403 })
  }

  // Verify tokenAddress is approved for this session
  // First check new scopes format, then fall back to legacy approvedContracts
  let isApproved = false
  let matchedScopeName: string | undefined

  const sessionScopes = session.scopes as SerializedSessionScope[] | undefined
  if (sessionScopes && sessionScopes.length > 0) {
    // New format: check scopes
    const deserializedScopes = sessionScopes.map(deserializeScope)
    const result = isContractApproved(deserializedScopes, tokenAddress.toLowerCase() as Address)
    isApproved = result.approved
    matchedScopeName = result.scope?.name
  } else {
    // Legacy format: check approvedContracts directly
    const approvedContracts = session.approvedContracts || []
    isApproved = approvedContracts.some(
      (c: { address: string }) => c.address.toLowerCase() === tokenAddress.toLowerCase()
    )
  }

  if (!isApproved) {
    // Build list of approved contracts for error message
    const approvedList: string[] = []
    if (sessionScopes && sessionScopes.length > 0) {
      for (const scope of sessionScopes) {
        if (scope.type === 'eip712' && scope.approvedContracts) {
          for (const contract of scope.approvedContracts) {
            approvedList.push(contract.address)
          }
        }
      }
    } else if (session.approvedContracts) {
      for (const c of session.approvedContracts) {
        approvedList.push(c.address)
      }
    }

    return NextResponse.json({
      error: 'Token contract not approved for this session',
      approvedContracts: approvedList,
      availableScopes: sessionScopes?.map(s => ({ id: s.id, type: s.type, name: s.name })),
    }, { status: 403 })
  }

  // Log which scope matched (for debugging)
  if (matchedScopeName) {
    console.log('[sign] Token approved via scope:', matchedScopeName)
  }

  try {
    // Decrypt the session key private key
    const decrypted = decryptHybrid(session.encryptedPrivateKey)
    const privateKey = decrypted.privateKey as Hex

    // Verify we got the right key
    const account = privateKeyToAccount(privateKey)
    if (account.address.toLowerCase() !== session.sessionKeyAddress.toLowerCase()) {
      console.error('[sign] Session key mismatch:', {
        expected: session.sessionKeyAddress,
        got: account.address,
      })
      return NextResponse.json({ error: 'Session key mismatch' }, { status: 500 })
    }

    // Build the message for structHash computation
    const message = {
      from: from as `0x${string}`,
      to: to as `0x${string}`,
      value: BigInt(value),
      validAfter: BigInt(validAfter),
      validBefore: BigInt(validBefore),
      nonce: nonce as `0x${string}`,
    }

    console.log('[sign] Signing EIP-3009 with 149-byte format:', {
      sessionId,
      from,
      to,
      value,
      chainId,
      tokenAddress,
    })

    // Step 1: Compute the structHash for TransferWithAuthorization
    // This is the inner hash that will be used for preimage verification on-chain
    const structHash = computeTransferWithAuthorizationStructHash(message)

    // Step 2: Build AgentDelegator EIP-712 domain (verifyingContract = user's wallet)
    const delegatorDomain = buildAgentDelegatorDomain(from as Address, chainId)

    // Step 3: Sign EIP-712 typed data: SessionSignature(verifyingContract, structHash)
    // This properly binds the session signature to the target contract using EIP-712
    const ecdsaSignature = await account.signTypedData({
      domain: delegatorDomain,
      types: SESSION_SIGNATURE_TYPES,
      primaryType: 'SessionSignature',
      message: {
        verifyingContract: tokenAddress as Address,
        structHash,
      },
    })

    // Step 4: Build 149-byte signature:
    // sessionId (32) + verifyingContract (20) + structHash (32) + ecdsaSig (65) = 149 bytes
    const signature = concat([
      session.sessionId as Hex,    // 32 bytes
      tokenAddress as Hex,          // 20 bytes (verifyingContract)
      structHash,                   // 32 bytes
      ecdsaSignature,               // 65 bytes
    ])

    console.log('[sign] 149-byte signature created:', {
      sessionId: session.sessionId,
      tokenAddress,
      structHash,
      ecdsaSignatureLength: (ecdsaSignature.length - 2) / 2,
      signatureLength: (signature.length - 2) / 2,
    })

    return NextResponse.json({ signature })
  } catch (error) {
    console.error('[sign] Error signing:', error)
    return NextResponse.json({ error: 'Failed to sign' }, { status: 500 })
  }
})
