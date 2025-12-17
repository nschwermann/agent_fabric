'use client'

import { useConnection } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'
import { Copy, Check, X, ExternalLink, Wallet, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { usePayLinkGenerator } from '@/features/pay/model'

export function PayLinkGenerator() {
  const { address } = useConnection()
  const { open } = useAppKit()

  const {
    state,
    isTransitioning,
    recipient,
    amount,
    croName,
    isLookingUp,
    copied,
    baseHost,
    isValidRecipient,
    isValidAmount,
    canGenerate,
    displayRecipient,
    setRecipient,
    setAmount,
    generate,
    edit,
    copy,
    shareOnX,
    openLink,
    useAddress,
    useCroName,
  } = usePayLinkGenerator()

  const truncatedAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : ''

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div
        className={cn(
          "flex flex-col items-center w-full transition-all duration-300 ease-out",
          isTransitioning ? "opacity-0 scale-95" : "opacity-100 scale-100"
        )}
      >
      {state === 'input' ? (
        <>
          {/* Header */}
          <p className="text-lg text-muted-foreground mb-2">3 Quick Steps to</p>
          <h1 className="text-6xl md:text-7xl font-bold mb-4 bg-gradient-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent">
            Get Paid
          </h1>
          <Badge variant="secondary" className="mb-8 gap-1.5 px-3 py-1">
            <Zap className="size-3.5" />
            Gas-Free Payments
          </Badge>

          {/* Steps */}
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-8 mb-12">
            <Step number={1} label="Connect Wallet" active={!address} completed={!!address} />
            <Step number={2} label="Enter Amount" active={!!address && !canGenerate} completed={canGenerate} />
            <Step number={3} label="Share Link" active={canGenerate} />
          </div>

          {/* URL Builder */}
          <div className="w-full max-w-2xl">
            <div className="flex items-center gap-0 p-2 rounded-lg border-2 border-border bg-card">
              {/* Domain */}
              <span className="px-4 py-2 text-lg font-medium text-muted-foreground whitespace-nowrap">
                {baseHost || '...'}
              </span>
              <span className="text-2xl text-muted-foreground/50">/</span>

              {/* Recipient Input */}
              <Input
                type="text"
                placeholder="wallet.cro"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                disabled={isLookingUp}
                className={cn(
                  "border-0 bg-transparent text-lg font-medium text-primary focus-visible:ring-0 focus-visible:ring-offset-0 px-2",
                  "placeholder:text-muted-foreground/50 min-w-[120px] max-w-[200px]"
                )}
              />
              <span className="text-2xl text-muted-foreground/50">/</span>

              {/* Amount Input */}
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max="1000000"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={cn(
                  "border-0 bg-transparent text-lg font-medium text-primary focus-visible:ring-0 focus-visible:ring-offset-0 px-2 w-24",
                  "placeholder:text-muted-foreground/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                )}
              />

              {/* Get Paid Button */}
              <Button
                size="lg"
                onClick={generate}
                disabled={!canGenerate}
                className="ml-auto whitespace-nowrap"
              >
                Get Paid
              </Button>
            </div>

            {/* Wallet Info */}
            {address ? (
              <div className="flex items-center justify-center gap-4 mt-4 text-sm text-muted-foreground">
                <span className="font-mono">{truncatedAddress}</span>
                {croName && recipient !== croName && (
                  <button
                    onClick={useCroName}
                    className="underline hover:text-foreground transition-colors"
                  >
                    Use {croName}
                  </button>
                )}
                {recipient !== address && (
                  <button
                    onClick={useAddress}
                    className="underline hover:text-foreground transition-colors"
                  >
                    Use Address
                  </button>
                )}
                <button
                  onClick={() => open()}
                  className="underline hover:text-foreground transition-colors"
                >
                  View Wallet
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button variant="ghost" size="sm" onClick={() => open()} className="gap-2">
                  <Wallet className="size-4" />
                  Connect Wallet to auto-fill your .cro name
                </Button>
              </div>
            )}

            {/* Validation Messages */}
            {recipient && !isValidRecipient && (
              <p className="text-center text-sm text-destructive mt-2">
                Enter a valid wallet address (0x...) or .cro domain
              </p>
            )}
            {amount && !isValidAmount && (
              <p className="text-center text-sm text-destructive mt-2">
                Amount must be between $0.01 and $1,000,000
              </p>
            )}
            {isLookingUp && (
              <p className="text-center text-sm text-muted-foreground mt-2">
                Looking up .cro name...
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Header - Generated State */}
          <p className="text-lg text-muted-foreground mb-2">You are Ready to</p>
          <h1 className="text-6xl md:text-7xl font-bold mb-4 bg-gradient-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent">
            Get Paid
          </h1>
          <p className="text-2xl font-semibold mb-4">Share the Link, Now!</p>
          <Badge variant="secondary" className="mb-10 gap-1.5 px-3 py-1">
            <Zap className="size-3.5" />
            Gas-Free USDC.E Payment
          </Badge>

          {/* URL Display */}
          <div className="w-full max-w-2xl mb-8">
            <div className="flex items-center gap-2 p-4 rounded-lg border-2 border-primary/30 bg-card">
              <span className="flex-1 text-lg font-medium text-primary truncate">
                {baseHost} / {displayRecipient} / {amount}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={edit}
                className="shrink-0"
              >
                <X className="size-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={openLink}
                className="shrink-0"
              >
                <ExternalLink className="size-5" />
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button
              variant="outline"
              size="lg"
              onClick={copy}
              className="gap-2 min-w-[140px]"
            >
              {copied ? (
                <>
                  <Check className="size-5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="size-5" />
                  Copy Link
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={shareOnX}
              className="gap-2 min-w-[140px]"
            >
              <XIcon className="size-5" />
              Share on X
            </Button>

            <Button
              size="lg"
              onClick={openLink}
              className="gap-2 min-w-[140px]"
            >
              <ExternalLink className="size-5" />
              Try It Out
            </Button>
          </div>
        </>
      )}
      </div>
    </div>
  )
}

function Step({
  number,
  label,
  active,
  completed,
}: {
  number: number
  label: string
  active?: boolean
  completed?: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded border-2 text-lg font-semibold transition-colors",
          completed
            ? "border-primary bg-primary text-primary-foreground"
            : active
            ? "border-primary text-primary"
            : "border-muted-foreground/30 text-muted-foreground/50"
        )}
      >
        {number}
      </div>
      <span
        className={cn(
          "text-base font-medium transition-colors",
          completed || active ? "text-foreground" : "text-muted-foreground/50"
        )}
      >
        {label}
      </span>
    </div>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}
