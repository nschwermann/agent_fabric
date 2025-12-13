import { NextRequest, NextResponse } from 'next/server'
import { db, apiProxies } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/session'
import { updateProxySchema, proxyIdSchema } from '@/lib/validations/proxy'
import { type HybridEncryptedData } from '@/lib/crypto/encryption'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * GET /api/proxies/[id] - Get single proxy details
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const idResult = proxyIdSchema.safeParse({ id })
    if (!idResult.success) {
      return NextResponse.json(
        { error: 'Invalid proxy ID' },
        { status: 400 }
      )
    }

    const proxy = await db.query.apiProxies.findFirst({
      where: and(
        eq(apiProxies.id, id),
        eq(apiProxies.userId, user.id)
      ),
    })

    if (!proxy) {
      return NextResponse.json(
        { error: 'Proxy not found' },
        { status: 404 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin

    return NextResponse.json({
      id: proxy.id,
      name: proxy.name,
      description: proxy.description,
      proxyUrl: `${baseUrl}/api/proxy/${proxy.id}`,
      targetUrl: proxy.targetUrl,
      pricePerRequest: proxy.pricePerRequest,
      isPublic: proxy.isPublic,
      hasEncryptedHeaders: proxy.encryptedHeaders !== null,
      createdAt: proxy.createdAt.toISOString(),
      updatedAt: proxy.updatedAt.toISOString(),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.error('[GET /api/proxies/[id]] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/proxies/[id] - Update proxy
 *
 * Headers should be encrypted client-side using the server's public key.
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const idResult = proxyIdSchema.safeParse({ id })
    if (!idResult.success) {
      return NextResponse.json(
        { error: 'Invalid proxy ID' },
        { status: 400 }
      )
    }

    // Check ownership
    const existing = await db.query.apiProxies.findFirst({
      where: and(
        eq(apiProxies.id, id),
        eq(apiProxies.userId, user.id)
      ),
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Proxy not found' },
        { status: 404 }
      )
    }

    const body = await request.json()

    // Extract encrypted headers before validation
    const { encryptedHeaders, clearHeaders, ...proxyData } = body

    const result = updateProxySchema.safeParse(proxyData)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { name, description, targetUrl, pricePerRequest, isPublic } = result.data

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (targetUrl !== undefined) updateData.targetUrl = targetUrl
    if (pricePerRequest !== undefined) updateData.pricePerRequest = pricePerRequest
    if (isPublic !== undefined) updateData.isPublic = isPublic

    // Handle encrypted headers update
    if (clearHeaders === true) {
      // Explicitly clear headers
      updateData.encryptedHeaders = null
    } else if (encryptedHeaders) {
      // Validate encrypted headers structure
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
      updateData.encryptedHeaders = encryptedHeaders as HybridEncryptedData
    }

    const [updated] = await db.update(apiProxies)
      .set(updateData)
      .where(eq(apiProxies.id, id))
      .returning()

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      proxyUrl: `${baseUrl}/api/proxy/${updated.id}`,
      targetUrl: updated.targetUrl,
      pricePerRequest: updated.pricePerRequest,
      isPublic: updated.isPublic,
      hasEncryptedHeaders: updated.encryptedHeaders !== null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.error('[PUT /api/proxies/[id]] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/proxies/[id] - Delete proxy
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const idResult = proxyIdSchema.safeParse({ id })
    if (!idResult.success) {
      return NextResponse.json(
        { error: 'Invalid proxy ID' },
        { status: 400 }
      )
    }

    // Check ownership and delete
    const result = await db.delete(apiProxies)
      .where(and(
        eq(apiProxies.id, id),
        eq(apiProxies.userId, user.id)
      ))
      .returning({ id: apiProxies.id })

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Proxy not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.error('[DELETE /api/proxies/[id]] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
