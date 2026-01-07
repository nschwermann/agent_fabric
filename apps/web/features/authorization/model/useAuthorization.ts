'use client'

import { useQuery, useMutation } from '@tanstack/react-query'
import { useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSmartAccount } from '@/features/smartAccount/model/useSmartAccount'
import { useGrantSession } from '@/features/sessionKeys/model'
import { getScopeTemplateById } from '@/lib/sessionKeys/scopeTemplates'
import type { SessionScope } from '@/lib/sessionKeys/types'
import type {
  OAuthClientInfo,
  OAuthParams,
  OAuthParamsValidation,
  AuthorizationFormState,
  ValidityDays,
} from './types'

/**
 * Fetch OAuth client info from the authorize endpoint
 */
async function fetchClientInfo(params: OAuthParams): Promise<OAuthClientInfo> {
  const { clientId, redirectUri, responseType, codeChallenge, codeChallengeMethod, scopeParam, state } = params

  if (!clientId || !redirectUri || !responseType || !codeChallenge || !codeChallengeMethod || !scopeParam) {
    throw new Error('Missing required OAuth parameters')
  }

  const searchParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: responseType,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    scope: scopeParam,
  })
  if (state) searchParams.set('state', state)

  const response = await fetch(`/api/oauth/authorize?${searchParams}`)

  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.error || 'Failed to fetch client info')
  }

  return response.json()
}

/**
 * Create authorization code after user approves
 */
async function createAuthorizationCode(params: {
  clientId: string
  redirectUri: string
  codeChallenge: string
  approvedScopeIds: string[]
  sessionId: string
  state: string | null
}): Promise<{ redirect_uri: string }> {
  const response = await fetch('/api/oauth/authorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: params.clientId,
      redirect_uri: params.redirectUri,
      code_challenge: params.codeChallenge,
      approved_scopes: params.approvedScopeIds,
      session_id: params.sessionId,
      state: params.state,
    }),
  })

  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.error || 'Failed to create authorization')
  }

  return response.json()
}

/**
 * Validate OAuth parameters from URL
 */
function validateOAuthParams(params: OAuthParams): OAuthParamsValidation {
  const { clientId, redirectUri, responseType, codeChallenge, codeChallengeMethod, scopeParam } = params

  if (!clientId || !redirectUri || !codeChallenge || !scopeParam) {
    return { isValid: false, error: 'Missing required OAuth parameters' }
  }

  if (responseType !== 'code') {
    return { isValid: false, error: 'Only authorization code flow is supported' }
  }

  if (codeChallengeMethod !== 'S256') {
    return { isValid: false, error: 'Only S256 code challenge method is supported' }
  }

  return { isValid: true, error: null }
}

/**
 * Hook for the OAuth authorization flow
 *
 * Manages:
 * - Fetching OAuth client info
 * - Scope selection state
 * - Session validity period
 * - Approval/denial actions
 * - Smart account requirements
 */
export function useAuthorization() {
  const searchParams = useSearchParams()
  const { isEnabled: isSmartAccountEnabled, enable: enableSmartAccount, status: smartAccountStatus } = useSmartAccount()
  const { grantSession, status: grantStatus, isLoading: isGranting } = useGrantSession()

  // Extract OAuth params from URL
  const oauthParams: OAuthParams = useMemo(
    () => ({
      clientId: searchParams.get('client_id'),
      redirectUri: searchParams.get('redirect_uri'),
      responseType: searchParams.get('response_type'),
      codeChallenge: searchParams.get('code_challenge'),
      codeChallengeMethod: searchParams.get('code_challenge_method'),
      scopeParam: searchParams.get('scope'),
      state: searchParams.get('state'),
    }),
    [searchParams]
  )

  // Validate OAuth params
  const paramsValidation = useMemo(() => validateOAuthParams(oauthParams), [oauthParams])

  // Form state
  const [formState, setFormState] = useState<AuthorizationFormState>({
    selectedScopeIds: [],
    validityDays: '7',
  })
  const [approveError, setApproveError] = useState<string | null>(null)

  // Fetch client info
  const {
    data: clientInfo,
    isLoading: isLoadingClient,
    error: clientError,
  } = useQuery({
    queryKey: ['oauth-client', oauthParams.clientId, oauthParams.redirectUri, oauthParams.scopeParam],
    queryFn: () => fetchClientInfo(oauthParams),
    enabled: paramsValidation.isValid,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
    // Pre-select all scopes when data is fetched
    select: (data) => {
      // Initialize selected scopes if not already set
      if (formState.selectedScopeIds.length === 0 && data.scopes.length > 0) {
        setFormState((prev) => ({
          ...prev,
          selectedScopeIds: data.scopes.map((s) => s.id),
        }))
      }
      return data
    },
  })

  // Build selected scope objects from templates
  const selectedScopes = useMemo(() => {
    const scopes: SessionScope[] = []
    for (const scopeId of formState.selectedScopeIds) {
      const template = getScopeTemplateById(scopeId)
      if (template) {
        scopes.push(template.factory())
      }
    }
    return scopes
  }, [formState.selectedScopeIds])

  // Check if any selected scope is non-enforceable
  const hasNonEnforceableScope = useMemo(() => {
    return selectedScopes.some((s) => !s.budgetEnforceable)
  }, [selectedScopes])

  // Toggle scope selection
  const toggleScope = useCallback((scopeId: string) => {
    setFormState((prev) => ({
      ...prev,
      selectedScopeIds: prev.selectedScopeIds.includes(scopeId)
        ? prev.selectedScopeIds.filter((id) => id !== scopeId)
        : [...prev.selectedScopeIds, scopeId],
    }))
  }, [])

  // Set validity days
  const setValidityDays = useCallback((days: ValidityDays) => {
    setFormState((prev) => ({ ...prev, validityDays: days }))
  }, [])

  // Approval mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!clientInfo || selectedScopes.length === 0) {
        throw new Error('No scopes selected')
      }

      // Step 1: Create session key
      const sessionId = await grantSession({
        validityDays: parseInt(formState.validityDays),
        scopes: selectedScopes,
      })

      // Step 2: Create authorization code
      const result = await createAuthorizationCode({
        clientId: oauthParams.clientId!,
        redirectUri: oauthParams.redirectUri!,
        codeChallenge: oauthParams.codeChallenge!,
        approvedScopeIds: formState.selectedScopeIds,
        sessionId,
        state: oauthParams.state,
      })

      return result.redirect_uri
    },
    onSuccess: (redirectUri) => {
      // Redirect back to client
      window.location.href = redirectUri
    },
    onError: (error) => {
      setApproveError(error instanceof Error ? error.message : 'Failed to approve')
    },
  })

  // Handle approval
  const handleApprove = useCallback(() => {
    setApproveError(null)
    approveMutation.mutate()
  }, [approveMutation])

  // Handle denial
  const handleDeny = useCallback(() => {
    if (!clientInfo) return

    const redirectUrl = new URL(clientInfo.redirectUri)
    redirectUrl.searchParams.set('error', 'access_denied')
    redirectUrl.searchParams.set('error_description', 'User denied the authorization request')
    if (oauthParams.state) {
      redirectUrl.searchParams.set('state', oauthParams.state)
    }

    window.location.href = redirectUrl.toString()
  }, [clientInfo, oauthParams.state])

  // Compute combined error
  const error = useMemo(() => {
    if (!paramsValidation.isValid) return paramsValidation.error
    if (clientError) return clientError instanceof Error ? clientError.message : 'Failed to fetch client info'
    return null
  }, [paramsValidation, clientError])

  // Compute loading state
  const isLoading = isLoadingClient

  // Compute approval button state
  const isApproving = approveMutation.isPending || isGranting
  const canApprove = !isApproving && selectedScopes.length > 0

  return {
    // Client info
    clientInfo,
    isLoading,
    error,

    // OAuth params
    oauthParams,

    // Smart account
    isSmartAccountEnabled,
    enableSmartAccount,
    smartAccountStatus,

    // Scope selection
    selectedScopeIds: formState.selectedScopeIds,
    selectedScopes,
    hasNonEnforceableScope,
    toggleScope,

    // Validity
    validityDays: formState.validityDays,
    setValidityDays,

    // Actions
    handleApprove,
    handleDeny,
    isApproving,
    canApprove,
    approveError,
    grantStatus,
  }
}

export type UseAuthorizationReturn = ReturnType<typeof useAuthorization>
