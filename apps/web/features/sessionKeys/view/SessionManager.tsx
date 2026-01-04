'use client'

import { useMemo } from 'react'
import { Key, Trash2, Clock, Loader2, AlertTriangle, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSmartAccount } from '@/features/smartAccount/model/useSmartAccount'
import { useGrantSession, useSessions, useRevokeSession } from '../model'
import { format } from 'date-fns'
import { ScopesSummaryBadges } from './ScopeApprovalCard'
import { getDefaultScope } from '@/lib/sessionKeys/scopeTemplates'
import { deserializeScope, type SerializedSessionScope } from '@/lib/sessionKeys/types'
import { useConnection } from 'wagmi'

/**
 * Session management component
 *
 * Displays:
 * - List of active sessions with expiry info
 * - Enable x402 button to create default session
 * - Revoke session button
 *
 * If smart account is not enabled, shows prompt to enable it first.
 */
export function SessionManager() {
  const { chainId } = useConnection()
  const { isEnabled, enable, status: smartAccountStatus, delegatedTo, isLoading: isSmartAccountLoading } = useSmartAccount()
  const { sessions, isLoading: isLoadingSessions, refresh } = useSessions()
  const { grantSession, status: grantStatus, isLoading: isGranting } = useGrantSession()
  const { revokeSession, isLoading: isRevoking } = useRevokeSession()

  // Check if there's already an active x402 session
  const hasActiveSession = useMemo(() => sessions.length > 0, [sessions])

  const handleEnableX402 = async () => {
    if (!chainId) return

    try {
      // Create session with default x402 payments scope (30 days)
      await grantSession({
        validityDays: 30,
        scopes: [getDefaultScope(chainId)],
      })
      refresh()
    } catch (error) {
      // Error is handled in the hook
    }
  }

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await revokeSession(sessionId)
      refresh()
    } catch (error) {
      // Error is handled in the hook
    }
  }

  // Incompatible delegation - show warning
  if (smartAccountStatus === 'incompatible_delegation') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="size-5" />
            x402 Payments
          </CardTitle>
          <CardDescription>
            Your wallet has an incompatible smart account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-medium text-amber-800">Incompatible Smart Account</p>
                <p className="text-sm text-amber-700">
                  Your wallet is delegated to a different smart account contract that isn't compatible with this platform.
                </p>
                {delegatedTo && (
                  <p className="text-xs text-amber-600 font-mono break-all">
                    Current: {delegatedTo}
                  </p>
                )}
              </div>
            </div>
            <Button
              onClick={enable}
              disabled={isSmartAccountLoading}
              className="w-full"
              variant="outline"
            >
              {isSmartAccountLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Re-delegating...
                </>
              ) : (
                'Re-delegate to x402'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Smart account not enabled - show prompt
  if (!isEnabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="size-5" />
            x402 Payments
          </CardTitle>
          <CardDescription>
            Enable Smart Account to use automated API payments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={enable}
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
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Key className="size-5" />
            x402 Payments
          </CardTitle>
          <CardDescription>
            Manage automated payment sessions
          </CardDescription>
        </div>
        {!hasActiveSession && (
          <Button
            size="sm"
            onClick={handleEnableX402}
            disabled={isGranting}
          >
            {isGranting ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                {grantStatus === 'generating' && 'Generating...'}
                {grantStatus === 'signing' && 'Sign tx...'}
                {grantStatus === 'confirming' && 'Confirming...'}
                {grantStatus === 'saving' && 'Saving...'}
              </>
            ) : (
              'Enable x402'
            )}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoadingSessions ? (
          <div className="flex justify-center py-4">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            No active sessions. Enable x402 to start using automated payments.
          </p>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.sessionId}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-xs text-muted-foreground">
                      {session.sessionId.slice(0, 10)}...{session.sessionId.slice(-8)}
                    </p>
                    {/* Show scope badges if session has scopes */}
                    {session.scopes && session.scopes.length > 0 && (
                      <ScopesSummaryBadges scopes={session.scopes.map((s: SerializedSessionScope) =>
                        deserializeScope(s)
                      )} />
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      Until {format(new Date(session.validUntil), 'MMM d, yyyy')}
                    </span>
                    {session.oauthClientId && (
                      <span className="flex items-center gap-1">
                        <ExternalLink className="size-3" />
                        Via: {session.oauthClientId}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleRevokeSession(session.sessionId)}
                  disabled={isRevoking}
                  title="Revoke session"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
