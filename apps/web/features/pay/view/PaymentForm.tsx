'use client'

import type { Address } from 'viem'
import { useAppKit } from '@reown/appkit/react'
import { useConnection } from 'wagmi'
import { cronos, cronosTestnet } from '@reown/appkit/networks'
import { Wallet, Send, Loader2, Check, AlertCircle, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useUser } from '@/context/user'
import { defaultChainId } from '@/config/tokens'
import { usePayment } from '../model'

interface PaymentFormProps {
  /** Resolved recipient address */
  recipient: Address
  /** Display name (truncated address or .cro domain) */
  displayName: string
  /** Initial amount in USD */
  amountUsd: number
  /** Initial amount in smallest unit */
  amountSmallestUnit: number
  /** Original .cro domain if recipient was resolved from one */
  originalDomain?: string
}

export function PaymentForm({
  recipient,
  displayName,
  amountUsd,
  amountSmallestUnit: initialAmountSmallestUnit,
  originalDomain,
}: PaymentFormProps) {
  const { session } = useUser()
  const { open } = useAppKit()
  const { chainId } = useConnection()

  const {
    status,
    error,
    txHash,
    amount,
    isValidAmount,
    setAmount,
    pay,
  } = usePayment({
    recipient,
    initialAmountUsd: amountUsd,
    initialAmountSmallestUnit,
  })

  const isAuthenticated = session?.isAuthenticated
  const currentChainId = chainId || defaultChainId
  const isProcessing = status === 'signing' || status === 'submitting'
  const chain = currentChainId === cronos.id ? cronos : cronosTestnet
  const explorerUrl = chain.blockExplorers?.default.url ?? 'https://cronoscan.com'
  const parsedAmount = parseFloat(amount)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="size-5" />
          Send Payment
        </CardTitle>
        <CardDescription>
          Pay {originalDomain || 'recipient'} with USDC.E on Cronos
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Recipient Display */}
        <div className="space-y-2">
          <Label>Recipient</Label>
          <div className="p-3 rounded-lg bg-muted">
            <div className="flex items-center justify-between">
              <span className="font-medium">{displayName}</span>
              {originalDomain && (
                <Badge variant="secondary">.cro domain</Badge>
              )}
            </div>
            {originalDomain && (
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                {recipient}
              </p>
            )}
          </div>
        </div>

        {/* Amount Input */}
        <div className="space-y-2">
          <Label htmlFor="amount">Amount (USD)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              max="1000000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pl-7"
              disabled={isProcessing}
            />
          </div>
          {!isValidAmount && amount && (
            <p className="text-xs text-destructive">
              Invalid amount. Must be between $0.01 and $1,000,000.
            </p>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive">
            <AlertCircle className="size-5 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Success Display */}
        {status === 'success' && txHash && (
          <div className="flex flex-col gap-2 p-4 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400">
            <div className="flex items-center gap-2">
              <Check className="size-5 shrink-0" />
              <span className="font-medium">Payment Successful!</span>
            </div>
            <a
              href={`${explorerUrl}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline flex items-center gap-1"
            >
              View transaction <ExternalLink className="size-3" />
            </a>
          </div>
        )}
      </CardContent>

      <CardFooter>
        <Button
          className="w-full gap-2"
          size="lg"
          onClick={isAuthenticated ? pay : () => open()}
          disabled={(isAuthenticated && !isValidAmount) || isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {status === 'signing' ? 'Sign in Wallet...' : 'Processing...'}
            </>
          ) : !isAuthenticated ? (
            <>
              <Wallet className="size-4" />
              Connect Wallet
            </>
          ) : (
            <>
              <Send className="size-4" />
              Pay ${isValidAmount ? parsedAmount.toFixed(2) : '0.00'}
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
