import { NextRequest } from 'next/server'

/**
 * MCP Proxy Route
 *
 * Proxies requests from /mcp/* to the MCP server.
 * This allows running both services behind a single domain/ngrok tunnel.
 */

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3001'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Proxy GET requests (including SSE connections)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const targetPath = `/mcp/${path.join('/')}`
  const targetUrl = `${MCP_SERVER_URL}${targetPath}${request.nextUrl.search}`

  console.log(`[MCP Proxy] GET ${targetPath}`)

  // Forward headers, preserving authorization
  const headers = new Headers()
  request.headers.forEach((value, key) => {
    // Skip host header as it will be set by fetch
    if (key.toLowerCase() !== 'host') {
      headers.set(key, value)
    }
  })

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers,
      // @ts-expect-error - Node.js fetch supports duplex for streaming
      duplex: 'half',
    })

    // Build response headers, rewriting OAuth URLs to use the correct origin
    const responseHeaders = new Headers()
    const requestOrigin = request.headers.get('x-forwarded-host')
      ? `https://${request.headers.get('x-forwarded-host')}`
      : request.nextUrl.origin

    response.headers.forEach((value, key) => {
      // Rewrite WWW-Authenticate header to use correct origin
      if (key.toLowerCase() === 'www-authenticate') {
        value = value.replace(/http:\/\/localhost:3000/g, requestOrigin)
      }
      responseHeaders.set(key, value)
    })

    // For SSE, we need to stream the response
    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      })
    }

    // For 401 responses, rewrite the body to use correct origin
    if (response.status === 401) {
      const body = await response.text()
      const rewrittenBody = body.replace(/http:\/\/localhost:3000/g, requestOrigin)
      return new Response(rewrittenBody, {
        status: response.status,
        headers: responseHeaders,
      })
    }

    // For regular responses, return as-is
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('[MCP Proxy] GET error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to connect to MCP server' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * Proxy POST requests (MCP messages)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const targetPath = `/mcp/${path.join('/')}`
  const targetUrl = `${MCP_SERVER_URL}${targetPath}${request.nextUrl.search}`

  console.log(`[MCP Proxy] POST ${targetPath}`)

  // Forward headers
  const headers = new Headers()
  request.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'host') {
      headers.set(key, value)
    }
  })

  try {
    const body = await request.text()

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body,
    })

    const responseHeaders = new Headers()
    response.headers.forEach((value, key) => {
      responseHeaders.set(key, value)
    })

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('[MCP Proxy] POST error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to connect to MCP server' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
