import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MethodBadge } from '@/features/proxy/view/HttpMethodSelect'
import { getCategoryById } from '@/features/proxy/model/tags'
import { db, apiProxies, users } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { ExplorePageClient } from './client'
import type { HttpMethod, VariableDefinition } from '@/features/proxy/model/variables'

type PageProps = {
  params: Promise<{ id: string }>
}

function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

function formatPrice(priceInSmallestUnit: number): string {
  const price = priceInSmallestUnit / 1_000_000
  if (price < 0.01) {
    return `$${price.toFixed(6)}`
  }
  if (price < 1) {
    return `$${price.toFixed(4)}`
  }
  return `$${price.toFixed(2)}`
}

export default async function ExplorePage({ params }: PageProps) {
  const { id } = await params
  const isId = isUUID(id)

  // Fetch proxy with user info (only if public)
  const result = await db
    .select({
      id: apiProxies.id,
      slug: apiProxies.slug,
      name: apiProxies.name,
      description: apiProxies.description,
      paymentAddress: apiProxies.paymentAddress,
      pricePerRequest: apiProxies.pricePerRequest,
      category: apiProxies.category,
      tags: apiProxies.tags,
      httpMethod: apiProxies.httpMethod,
      requestBodyTemplate: apiProxies.requestBodyTemplate,
      queryParamsTemplate: apiProxies.queryParamsTemplate,
      variablesSchema: apiProxies.variablesSchema,
      exampleResponse: apiProxies.exampleResponse,
      contentType: apiProxies.contentType,
      isPublic: apiProxies.isPublic,
    })
    .from(apiProxies)
    .innerJoin(users, eq(apiProxies.userId, users.id))
    .where(
      and(
        isId ? eq(apiProxies.id, id) : eq(apiProxies.slug, id),
        eq(apiProxies.isPublic, true)
      )
    )
    .limit(1)

  if (result.length === 0) {
    notFound()
  }

  const api = result[0]
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const proxyUrl = `${baseUrl}/api/proxy/${api.slug || api.id}`
  const category = api.category ? getCategoryById(api.category) : null
  const variablesSchema = (api.variablesSchema || []) as VariableDefinition[]

  return (
    <div className="container py-8 max-w-4xl">
      {/* Back button */}
      <div className="mb-6">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="size-4" />
            Back to Marketplace
          </Button>
        </Link>
      </div>

      {/* API Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <MethodBadge method={(api.httpMethod || 'GET') as HttpMethod} />
              <h1 className="text-3xl font-bold">{api.name}</h1>
            </div>
            {api.description && (
              <p className="text-lg text-muted-foreground">{api.description}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold text-primary">
              {formatPrice(api.pricePerRequest)}
            </div>
            <div className="text-sm text-muted-foreground">per request</div>
          </div>
        </div>

        {/* Tags and category */}
        <div className="flex flex-wrap gap-2 mb-4">
          {category && (
            <Badge variant="default" className="gap-1">
              <span>{category.icon}</span>
              <span>{category.label}</span>
            </Badge>
          )}
          {((api.tags as string[]) || []).map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>

        {/* Proxy URL with copy button */}
        <ExplorePageClient proxyUrl={proxyUrl} />
      </div>

      <div className="grid gap-6">
        {/* Documentation */}
        <Card>
          <CardHeader>
            <CardTitle>Documentation</CardTitle>
            <CardDescription>
              Learn how to integrate this API into your application
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Variables Schema */}
            {variablesSchema.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Variables</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 font-medium">Name</th>
                        <th className="text-left p-3 font-medium">Type</th>
                        <th className="text-left p-3 font-medium">Required</th>
                        <th className="text-left p-3 font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variablesSchema.map((v) => (
                        <tr key={v.name} className="border-t">
                          <td className="p-3 font-mono">{v.name}</td>
                          <td className="p-3">
                            <Badge variant="outline">{v.type}</Badge>
                          </td>
                          <td className="p-3">
                            {v.required ? (
                              <Badge variant="default">Yes</Badge>
                            ) : (
                              <span className="text-muted-foreground">No</span>
                            )}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {v.description || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Request Body Template */}
            {api.requestBodyTemplate && (
              <div>
                <h3 className="font-semibold mb-3">Request Body Template</h3>
                <pre className="p-4 rounded-lg bg-muted overflow-x-auto">
                  <code className="text-sm font-mono">{api.requestBodyTemplate}</code>
                </pre>
              </div>
            )}

            {/* Query Params Template */}
            {api.queryParamsTemplate && (
              <div>
                <h3 className="font-semibold mb-3">Query Parameters</h3>
                <pre className="p-4 rounded-lg bg-muted overflow-x-auto">
                  <code className="text-sm font-mono">{api.queryParamsTemplate}</code>
                </pre>
              </div>
            )}

            {/* Example Response */}
            {api.exampleResponse && (
              <div>
                <h3 className="font-semibold mb-3">Example Response</h3>
                <pre className="p-4 rounded-lg bg-muted overflow-x-auto max-h-[300px]">
                  <code className="text-sm font-mono">{api.exampleResponse}</code>
                </pre>
              </div>
            )}

            {/* Usage example */}
            <div>
              <h3 className="font-semibold mb-3">Integration Example</h3>
              <pre className="p-4 rounded-lg bg-muted overflow-x-auto">
                <code className="text-sm font-mono">{`// 1. Make initial request (will return 402)
const response = await fetch('${proxyUrl}', {
  method: '${api.httpMethod || 'GET'}',
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
  method: '${api.httpMethod || 'GET'}',
  headers: {
    'Content-Type': 'application/json',
    'X-Variables': JSON.stringify({ /* your variables */ }),
    'X-402-Payment': JSON.stringify({ signature, amount, token, recipient, chainId, nonce })
  }
});`}</code>
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Try It */}
        <ExplorePageClient
          showTryIt
          proxyId={api.id}
          proxyUrl={proxyUrl}
          pricePerRequest={api.pricePerRequest}
          httpMethod={api.httpMethod || 'GET'}
          variablesSchema={variablesSchema}
          requestBodyTemplate={api.requestBodyTemplate}
        />
      </div>
    </div>
  )
}
