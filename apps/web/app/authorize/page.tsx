'use client'

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, AlertTriangle, ShieldCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useSmartAccount } from '@/features/smartAccount/model/useSmartAccount'
import { useGrantSession } from '@/features/sessionKeys/model'
import { ScopeApprovalCard } from '@/features/sessionKeys/view/ScopeApprovalCard'
import { getScopeTemplateById } from '@/lib/sessionKeys/scopeTemplates'
import type { SessionScope } from '@/lib/sessionKeys/types'
import { useIsAuthenticated } from '@/context/user'

interface OAuthClientInfo {
  client: {
    id: string
    name: string
    description: string | null
    logoUrl: string | null
  }
  scopes: {
    id: string
    name: string
    description: string
    type: string
    budgetEnforceable: boolean
  }[]
  redirectUri: string
  state: string | null
}

function AuthorizePageContent() {
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading: isUserLoading } = useIsAuthenticated()
  const { isEnabled: isSmartAccountEnabled, enable: enableSmartAccount, status: smartAccountStatus } = useSmartAccount()
  const { grantSession, status: grantStatus, isLoading: isGranting } = useGrantSession()

  // OAuth params from URL
  const clientId = searchParams.get('client_id')
  const redirectUri = searchParams.get('redirect_uri')
  const responseType = searchParams.get('response_type')
  const codeChallenge = searchParams.get('code_challenge')
  const codeChallengeMethod = searchParams.get('code_challenge_method')
  const scopeParam = searchParams.get('scope')
  const state = searchParams.get('state')

  // State
  const [clientInfo, setClientInfo] = useState<OAuthClientInfo | null>(null)
  const [isLoadingClient, setIsLoadingClient] = useState(true)
  const [clientError, setClientError] = useState<string | null>(null)
  const [selectedScopeIds, setSelectedScopeIds] = useState<string[]>([])
  const [validityDays, setValidityDays] = useState('7')
  const [isApproving, setIsApproving] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)

  // Fetch client info on mount
  useEffect(() => {
    if (!clientId || !redirectUri || !codeChallenge || !scopeParam) {
      setClientError('Missing required OAuth parameters')
      setIsLoadingClient(false)
      return
    }

    if (responseType !== 'code') {
      setClientError('Only authorization code flow is supported')
      setIsLoadingClient(false)
      return
    }

    if (codeChallengeMethod !== 'S256') {
      setClientError('Only S256 code challenge method is supported')
      setIsLoadingClient(false)
      return
    }

    const fetchClient = async () => {
      try {
        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: responseType,
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
          scope: scopeParam,
        })
        if (state) params.set('state', state)

        const response = await fetch(`/api/oauth/authorize?${params}`)

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to fetch client info')
        }

        const data: OAuthClientInfo = await response.json()
        setClientInfo(data)
        // Pre-select all requested scopes
        setSelectedScopeIds(data.scopes.map(s => s.id))
      } catch (err) {
        setClientError(err instanceof Error ? err.message : 'Failed to fetch client info')
      } finally {
        setIsLoadingClient(false)
      }
    }

    fetchClient()
  }, [clientId, redirectUri, responseType, codeChallenge, codeChallengeMethod, scopeParam, state])

  // Build selected scope objects from templates
  const selectedScopes = useMemo(() => {
    const scopes: SessionScope[] = []
    for (const scopeId of selectedScopeIds) {
      const template = getScopeTemplateById(scopeId)
      if (template) {
        scopes.push(template.factory())
      }
    }
    return scopes
  }, [selectedScopeIds])

  // Check if any selected scope is non-enforceable
  const hasNonEnforceableScope = useMemo(() => {
    return selectedScopes.some(s => !s.budgetEnforceable)
  }, [selectedScopes])

  const toggleScope = useCallback((scopeId: string) => {
    setSelectedScopeIds(prev =>
      prev.includes(scopeId)
        ? prev.filter(id => id !== scopeId)
        : [...prev, scopeId]
    )
  }, [])

  // Handle approval flow
  const handleApprove = async () => {
    if (!clientInfo || selectedScopes.length === 0) return

    setIsApproving(true)
    setApproveError(null)

    try {
      // Step 1: Create session key with grantSession
      const sessionId = await grantSession({
        validityDays: parseInt(validityDays),
        scopes: selectedScopes,
      })

      // Step 2: Create authorization code
      const response = await fetch('/api/oauth/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          redirect_uri: redirectUri,
          code_challenge: codeChallenge,
          approved_scopes: selectedScopeIds,
          session_id: sessionId,
          state,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create authorization')
      }

      const { redirect_uri: finalRedirectUri } = await response.json()

      // Step 3: Redirect back to client
      window.location.href = finalRedirectUri
    } catch (err) {
      setApproveError(err instanceof Error ? err.message : 'Failed to approve')
      setIsApproving(false)
    }
  }

  // Handle denial
  const handleDeny = () => {
    if (!clientInfo) return

    const redirectUrl = new URL(clientInfo.redirectUri)
    redirectUrl.searchParams.set('error', 'access_denied')
    redirectUrl.searchParams.set('error_description', 'User denied the authorization request')
    if (state) redirectUrl.searchParams.set('state', state)

    window.location.href = redirectUrl.toString()
  }

  // Loading state
  if (isLoadingClient || isUserLoading) {
    return (
      <div className="container max-w-lg mx-auto py-16 px-4">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Loading authorization request...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (clientError) {
    return (
      <div className="container max-w-lg mx-auto py-16 px-4">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              Authorization Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{clientError}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="container max-w-lg mx-auto py-16 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Sign In Required</CardTitle>
            <CardDescription>
              You need to connect your wallet to authorize this application.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Click the Connect button in the header to sign in with your wallet.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Smart account not enabled
  if (!isSmartAccountEnabled) {
    return (
      <div className="container max-w-lg mx-auto py-16 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Smart Account Required</CardTitle>
            <CardDescription>
              You need to enable your Smart Account before authorizing applications.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={enableSmartAccount}
              disabled={smartAccountStatus === 'enabling'}
              className="w-full"
            >
              {smartAccountStatus === 'enabling' ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Enabling...
                </>
              ) : (
                'Enable Smart Account'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!clientInfo) return null

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <Card>
        <CardHeader className="text-center pb-2">
          {/* Client info */}
          <div className="flex flex-col items-center gap-4">
            {clientInfo.client.logoUrl ? (
              <img
                src={clientInfo.client.logoUrl}
                alt={clientInfo.client.name}
                className="size-16 rounded-lg"
              />
            ) : (
              <div className="size-16 rounded-lg bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="size-8 text-primary" />
              </div>
            )}
            <div>
              <CardTitle className="text-xl">{clientInfo.client.name}</CardTitle>
              {clientInfo.client.description && (
                <CardDescription className="mt-1">
                  {clientInfo.client.description}
                </CardDescription>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Authorization message */}
          <div className="text-center text-sm text-muted-foreground">
            <p>This application is requesting access to your wallet.</p>
            <p>Review the permissions below carefully.</p>
          </div>

          {/* Scope selection */}
          <div className="space-y-3">
            <Label>Requested Permissions</Label>
            {clientInfo.scopes.map(scopeInfo => {
              const template = getScopeTemplateById(scopeInfo.id)
              if (!template) return null
              const scope = template.factory()
              return (
                <ScopeApprovalCard
                  key={scopeInfo.id}
                  scope={scope}
                  isSelected={selectedScopeIds.includes(scopeInfo.id)}
                  onToggle={() => toggleScope(scopeInfo.id)}
                />
              )
            })}
          </div>

          {/* Validity period */}
          <div className="space-y-2">
            <Label>Session Validity</Label>
            <Select value={validityDays} onValueChange={setValidityDays}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 day</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Warning for non-enforceable scopes */}
          {hasNonEnforceableScope && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="size-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-amber-800">No Spending Limits</p>
                  <p className="text-sm text-amber-700 mt-1">
                    Some permissions you're approving cannot enforce spending limits.
                    This application will be able to request signatures without budget restrictions.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error message */}
          {approveError && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{approveError}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleDeny}
              disabled={isApproving || isGranting}
              className="flex-1"
            >
              <X className="size-4 mr-2" />
              Deny
            </Button>
            <Button
              onClick={handleApprove}
              disabled={isApproving || isGranting || selectedScopes.length === 0}
              className="flex-1"
            >
              {isApproving || isGranting ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  {grantStatus === 'generating' && 'Generating key...'}
                  {grantStatus === 'signing' && 'Sign in wallet...'}
                  {grantStatus === 'confirming' && 'Confirming...'}
                  {grantStatus === 'saving' && 'Saving...'}
                  {grantStatus === 'idle' && 'Processing...'}
                </>
              ) : (
                <>
                  <ShieldCheck className="size-4 mr-2" />
                  Authorize
                </>
              )}
            </Button>
          </div>

          {/* Redirect info */}
          <p className="text-xs text-center text-muted-foreground">
            After authorizing, you'll be redirected to{' '}
            <span className="font-mono">{new URL(clientInfo.redirectUri).hostname}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AuthorizePage() {
  return (
    <Suspense fallback={
      <div className="container max-w-lg mx-auto py-16 px-4">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <AuthorizePageContent />
    </Suspense>
  )
}
