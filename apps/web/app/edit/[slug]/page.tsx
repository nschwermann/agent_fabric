import { notFound } from 'next/navigation'
import { ArrowLeft, Wallet } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { db, apiProxies } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { EditPageClient } from './client'
import type { HttpMethod } from '@/features/proxy/model/variables'

type PageProps = {
  params: Promise<{ slug: string }>
}

// Check if string is a valid UUID
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

export default async function EditPage({ params }: PageProps) {
  const { slug } = await params
  const session = await getSession()

  if (!session?.isLoggedIn || !session.userId) {
    return (
      <div className="container max-w-3xl py-8">
        <div className="mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="size-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
        <div className="text-center py-12">
          <Wallet className="size-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
          <p className="text-muted-foreground mb-4">
            Please sign in to edit your API proxy.
          </p>
        </div>
      </div>
    )
  }

  // Lookup by UUID or slug
  const isId = isUUID(slug)

  const proxy = await db.query.apiProxies.findFirst({
    where: and(
      isId
        ? eq(apiProxies.id, slug)
        : eq(apiProxies.slug, slug),
      eq(apiProxies.userId, session.userId)
    ),
  })

  if (!proxy) {
    notFound()
  }

  // Convert to form values
  const initialValues = {
    name: proxy.name,
    slug: proxy.slug || '',
    description: proxy.description || '',
    paymentAddress: proxy.paymentAddress,
    targetUrl: proxy.targetUrl,
    headers: [], // Headers are encrypted, can't prefill
    pricePerRequest: (proxy.pricePerRequest / 1_000_000).toString(),
    isPublic: proxy.isPublic,
    category: proxy.category || '',
    tags: (proxy.tags as string[]) || [],
    httpMethod: (proxy.httpMethod || 'GET') as HttpMethod,
    requestBodyTemplate: proxy.requestBodyTemplate || '',
    queryParamsTemplate: proxy.queryParamsTemplate || '',
    variablesSchema: proxy.variablesSchema || [],
    exampleResponse: proxy.exampleResponse || '',
    contentType: proxy.contentType || 'application/json',
  }

  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-6">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="size-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Edit API</h1>
        <p className="text-muted-foreground mt-1">
          Update your payment-gated API proxy configuration
        </p>
      </div>

      <EditPageClient proxyId={proxy.id} initialValues={initialValues} />
    </div>
  )
}
