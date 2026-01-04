import { NextRequest, NextResponse } from 'next/server'
import { db, oauthAuthCodes, sessionKeys } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { withAuth } from '@/lib/auth'
import {
  getOAuthClient,
  validateRedirectUri,
  validateScopes,
  generateAuthCode,
} from '@/lib/auth/oauth'
import { getScopeTemplateById } from '@/lib/sessionKeys/scopeTemplates'
import { serializeScope, type SessionScope } from '@/lib/sessionKeys/types'

/**
 * GET /api/oauth/authorize
 *
 * OAuth 2.1 authorization endpoint - returns client info for consent page.
 *
 * Query params:
 * - client_id: OAuth client identifier
 * - redirect_uri: Where to redirect after authorization
 * - response_type: Must be "code"
 * - code_challenge: PKCE code challenge (base64url-encoded SHA256)
 * - code_challenge_method: Must be "S256"
 * - scope: Space-separated list of scope IDs (e.g., "x402:payments")
 * - state: Opaque value for CSRF protection
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const clientId = searchParams.get('client_id')
  const redirectUri = searchParams.get('redirect_uri')
  const responseType = searchParams.get('response_type')
  const codeChallenge = searchParams.get('code_challenge')
  const codeChallengeMethod = searchParams.get('code_challenge_method')
  const scopeParam = searchParams.get('scope')
  const state = searchParams.get('state')

  // Validate required params
  if (!clientId) {
    return NextResponse.json({ error: 'missing_client_id' }, { status: 400 })
  }
  if (!redirectUri) {
    return NextResponse.json({ error: 'missing_redirect_uri' }, { status: 400 })
  }
  if (responseType !== 'code') {
    return NextResponse.json({ error: 'unsupported_response_type' }, { status: 400 })
  }
  if (!codeChallenge) {
    return NextResponse.json({ error: 'missing_code_challenge' }, { status: 400 })
  }
  if (codeChallengeMethod !== 'S256') {
    return NextResponse.json({ error: 'unsupported_code_challenge_method' }, { status: 400 })
  }
  if (!scopeParam) {
    return NextResponse.json({ error: 'missing_scope' }, { status: 400 })
  }

  // Get the client
  const client = await getOAuthClient(clientId)
  if (!client) {
    return NextResponse.json({ error: 'invalid_client' }, { status: 400 })
  }

  // Validate redirect URI
  if (!validateRedirectUri(client, redirectUri)) {
    return NextResponse.json({ error: 'invalid_redirect_uri' }, { status: 400 })
  }

  // Parse and validate scopes
  const requestedScopes = scopeParam.split(' ').filter(Boolean)
  const scopeValidation = validateScopes(client, requestedScopes)

  if (!scopeValidation.valid) {
    return NextResponse.json({
      error: 'invalid_scope',
      invalid_scopes: scopeValidation.invalidScopes,
    }, { status: 400 })
  }

  // Build scope details for the consent page
  const scopeDetails = requestedScopes.map(scopeId => {
    const template = getScopeTemplateById(scopeId)
    if (template) {
      const scope = template.factory()
      return {
        id: scopeId,
        name: scope.name,
        description: scope.description,
        type: scope.type,
        budgetEnforceable: scope.budgetEnforceable,
      }
    }
    return {
      id: scopeId,
      name: scopeId,
      description: 'Unknown scope',
      type: 'unknown',
      budgetEnforceable: false,
    }
  })

  // Return client info for consent page
  return NextResponse.json({
    client: {
      id: client.id,
      name: client.name,
      description: client.description,
      logoUrl: client.logoUrl,
    },
    scopes: scopeDetails,
    redirectUri,
    state,
  })
}

/**
 * POST /api/oauth/authorize
 *
 * Called after user approves the authorization request and has created a session.
 * Creates an authorization code that can be exchanged for an access token.
 *
 * The user must have already created a session key (via grantSession transaction)
 * before calling this endpoint. The session_id links the auth code to that session.
 *
 * Body:
 * - client_id: OAuth client identifier
 * - redirect_uri: Where to redirect after authorization
 * - code_challenge: PKCE code challenge
 * - approved_scopes: Array of scope IDs the user approved
 * - session_id: The session ID from grantSession (bytes32 hex)
 * - state: Opaque value for CSRF protection
 */
export const POST = withAuth(async (user, request) => {
  const body = await request.json()

  const {
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    approved_scopes: approvedScopes,
    session_id: sessionId,
    state,
  } = body

  // Validate required params
  if (!clientId || typeof clientId !== 'string') {
    return NextResponse.json({ error: 'missing_client_id' }, { status: 400 })
  }
  if (!redirectUri || typeof redirectUri !== 'string') {
    return NextResponse.json({ error: 'missing_redirect_uri' }, { status: 400 })
  }
  if (!codeChallenge || typeof codeChallenge !== 'string') {
    return NextResponse.json({ error: 'missing_code_challenge' }, { status: 400 })
  }
  if (!Array.isArray(approvedScopes) || approvedScopes.length === 0) {
    return NextResponse.json({ error: 'no_scopes_approved' }, { status: 400 })
  }
  if (!sessionId || typeof sessionId !== 'string' || !/^0x[0-9a-f]{64}$/i.test(sessionId)) {
    return NextResponse.json({ error: 'invalid_session_id' }, { status: 400 })
  }

  // Get the client
  const client = await getOAuthClient(clientId)
  if (!client) {
    return NextResponse.json({ error: 'invalid_client' }, { status: 400 })
  }

  // Validate redirect URI
  if (!validateRedirectUri(client, redirectUri)) {
    return NextResponse.json({ error: 'invalid_redirect_uri' }, { status: 400 })
  }

  // Validate approved scopes are allowed
  const scopeValidation = validateScopes(client, approvedScopes)
  if (!scopeValidation.valid) {
    return NextResponse.json({
      error: 'invalid_scope',
      invalid_scopes: scopeValidation.invalidScopes,
    }, { status: 400 })
  }

  // Verify the session exists and belongs to this user
  const session = await db.query.sessionKeys.findFirst({
    where: and(
      eq(sessionKeys.sessionId, sessionId.toLowerCase()),
      eq(sessionKeys.userId, user.id),
      eq(sessionKeys.isActive, true)
    ),
  })

  if (!session) {
    return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
  }

  // Build scope objects from approved scope IDs
  const scopes: SessionScope[] = []
  for (const scopeId of approvedScopes) {
    const template = getScopeTemplateById(scopeId)
    if (template) {
      scopes.push(template.factory())
    }
  }

  // Generate authorization code
  const code = generateAuthCode()
  const now = new Date()

  // Store the authorization code (linked to session via sessionConfig)
  await db.insert(oauthAuthCodes).values({
    code,
    clientId,
    userId: user.id,
    requestedScopes: approvedScopes,
    approvedScopes,
    sessionConfig: {
      validAfter: Math.floor(session.validAfter.getTime() / 1000),
      validUntil: Math.floor(session.validUntil.getTime() / 1000),
      scopes: scopes.map(serializeScope),
      sessionId: session.sessionId, // Link to actual session
    },
    codeChallenge,
    codeChallengeMethod: 'S256',
    redirectUri,
    expiresAt: new Date(now.getTime() + 10 * 60 * 1000), // 10 minutes
  })

  // Update session with OAuth binding
  await db.update(sessionKeys)
    .set({
      oauthClientId: clientId,
      updatedAt: now,
    })
    .where(eq(sessionKeys.id, session.id))

  console.log('[POST /api/oauth/authorize] Auth code created:', {
    clientId,
    userId: user.id,
    sessionId: session.sessionId,
    scopes: approvedScopes,
  })

  // Build redirect URL with code
  const redirectUrl = new URL(redirectUri)
  redirectUrl.searchParams.set('code', code)
  if (state) {
    redirectUrl.searchParams.set('state', state)
  }

  return NextResponse.json({
    redirect_uri: redirectUrl.toString(),
  })
})
