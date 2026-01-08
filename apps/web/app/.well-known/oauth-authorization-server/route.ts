import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /.well-known/oauth-authorization-server
 *
 * OAuth 2.0 Authorization Server Metadata (RFC 8414)
 * https://datatracker.ietf.org/doc/html/rfc8414
 *
 * MCP clients use this endpoint to discover OAuth configuration.
 */
export async function GET(request: NextRequest) {
  // Get the actual URL from forwarded headers (for tunnels/proxies)
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const issuer = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin)

  const metadata = {
    // Required
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/api/oauth/token`,

    // Dynamic client registration (RFC 7591)
    registration_endpoint: `${issuer}/api/oauth/register`,

    // Supported features
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],

    // Scopes
    scopes_supported: ['x402:payments', 'mcp:tools'],

    // Token configuration
    token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],

    // Service documentation
    service_documentation: `${issuer}/docs/oauth`,
  }

  return NextResponse.json(metadata, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, mcp-protocol-version',
    },
  })
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, mcp-protocol-version',
    },
  })
}
