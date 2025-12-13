import { NextRequest, NextResponse } from 'next/server'
import { db, apiProxies } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/session'
import { createProxySchema } from '@/lib/validations/proxy'
import { type HybridEncryptedData } from '@/lib/crypto/encryption'

/**
 * POST /api/proxies - Create a new API proxy
 *
 * Headers should be encrypted client-side using the server's public key.
 * See /api/crypto/public-key for the public key.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()

    const body = await request.json()

    // Extract encrypted headers before validation
    const { encryptedHeaders, ...proxyData } = body

    const result = createProxySchema.safeParse(proxyData)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { name, description, targetUrl, pricePerRequest, isPublic } = result.data

    // Validate encrypted headers structure if provided
    let validatedEncryptedHeaders: HybridEncryptedData | null = null
    if (encryptedHeaders) {
      if (
        typeof encryptedHeaders.encryptedKey !== 'string' ||
        typeof encryptedHeaders.iv !== 'string' ||
        typeof encryptedHeaders.ciphertext !== 'string' ||
        typeof encryptedHeaders.tag !== 'string'
      ) {
        return NextResponse.json(
          { error: 'Invalid encrypted headers format' },
          { status: 400 }
        )
      }
      validatedEncryptedHeaders = encryptedHeaders as HybridEncryptedData
    }

    // Create the proxy
    const [proxy] = await db.insert(apiProxies).values({
      userId: user.id,
      name,
      description: description ?? null,
      targetUrl,
      encryptedHeaders: validatedEncryptedHeaders,
      pricePerRequest,
      isPublic,
    }).returning()

    // Build the proxy URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
    const proxyUrl = `${baseUrl}/api/proxy/${proxy.id}`

    return NextResponse.json({
      id: proxy.id,
      proxyUrl,
      name: proxy.name,
      description: proxy.description,
      pricePerRequest: proxy.pricePerRequest,
      isPublic: proxy.isPublic,
      createdAt: proxy.createdAt.toISOString(),
    }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.error('[POST /api/proxies] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/proxies - List user's proxies
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    const proxies = await db.query.apiProxies.findMany({
      where: eq(apiProxies.userId, user.id),
      orderBy: (apiProxies, { desc }) => [desc(apiProxies.createdAt)],
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin

    const result = proxies.map((proxy) => ({
      id: proxy.id,
      name: proxy.name,
      description: proxy.description,
      proxyUrl: `${baseUrl}/api/proxy/${proxy.id}`,
      targetUrl: proxy.targetUrl, // Show to owner
      pricePerRequest: proxy.pricePerRequest,
      isPublic: proxy.isPublic,
      hasEncryptedHeaders: proxy.encryptedHeaders !== null,
      createdAt: proxy.createdAt.toISOString(),
    }))

    return NextResponse.json({ proxies: result })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.error('[GET /api/proxies] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
