'use client'

import { Play, Loader2, Wallet, Copy, Check, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useUser } from '@/context/user'
import { useAppKit } from '@reown/appkit/react'
import { useApiTryIt } from '@/features/marketplace/model/useApiTryIt'
import type { VariableDefinition } from '@/features/proxy/model/variables'

interface ApiTryItProps {
  proxyId: string
  proxyUrl: string
  pricePerRequest: number
  httpMethod: string
  variablesSchema: VariableDefinition[]
  requestBodyTemplate: string | null
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

export function ApiTryIt({
  proxyId,
  proxyUrl,
  pricePerRequest,
  httpMethod,
  variablesSchema,
  requestBodyTemplate,
}: ApiTryItProps) {
  const { session } = useUser()
  const { open } = useAppKit()
  const [copied, setCopied] = useState(false)

  const {
    variables,
    setVariable,
    isLoading,
    response,
    error,
    executeRequest,
  } = useApiTryIt({
    proxyUrl,
    httpMethod,
    variablesSchema,
  })

  const isAuthenticated = session?.isAuthenticated

  const handleTryIt = async () => {
    if (!isAuthenticated) {
      open()
      return
    }
    await executeRequest()
  }

  const handleCopyResponse = async () => {
    if (response) {
      await navigator.clipboard.writeText(response.body)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="size-5" />
          Try It
        </CardTitle>
        <CardDescription>
          Test this API by filling in the variables and making a request.
          You'll need to sign a payment of {formatPrice(pricePerRequest)} USDC.E.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Variables inputs */}
        {variablesSchema.length > 0 && (
          <div className="space-y-4">
            <Label className="text-base font-semibold">Variables</Label>
            <div className="grid gap-4 sm:grid-cols-2">
              {variablesSchema.map((variable) => (
                <div key={variable.name} className="space-y-2">
                  <Label htmlFor={variable.name} className="flex items-center gap-2">
                    {variable.name}
                    {variable.required && (
                      <Badge variant="secondary" className="text-xs">Required</Badge>
                    )}
                  </Label>
                  {variable.description && (
                    <p className="text-xs text-muted-foreground">{variable.description}</p>
                  )}
                  <Input
                    id={variable.name}
                    type={variable.type === 'number' ? 'number' : 'text'}
                    value={variables[variable.name] || ''}
                    onChange={(e) => setVariable(variable.name, e.target.value)}
                    placeholder={variable.example ? String(variable.example) : undefined}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action button */}
        <div className="flex items-center gap-4">
          <Button
            onClick={handleTryIt}
            disabled={isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Processing...
              </>
            ) : !isAuthenticated ? (
              <>
                <Wallet className="size-4" />
                Connect Wallet to Try
              </>
            ) : (
              <>
                <Play className="size-4" />
                Make Request ({formatPrice(pricePerRequest)})
              </>
            )}
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive">
            <AlertCircle className="size-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Response */}
        {response && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Response</Label>
              <div className="flex items-center gap-2">
                <Badge
                  variant={response.status >= 200 && response.status < 300 ? 'default' : 'destructive'}
                >
                  {response.status} {response.statusText}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={handleCopyResponse}
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </Button>
              </div>
            </div>
            <Textarea
              readOnly
              value={response.body}
              className="font-mono text-sm min-h-[200px]"
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
