import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { payParamsSchema } from '@/lib/validations/pay'
import { resolveCroDomain, isCroDomain, isValidAddress } from '@/lib/cronosid'
import { PaymentForm } from '@/features/pay'
import { PayErrorClient } from './error-client'
import type { Address } from 'viem'

type PageProps = {
  params: Promise<{ recipient: string; amount: string }>
}

type ErrorType = 'invalid_format' | 'domain_not_found' | 'invalid_address'

export default async function PayPage({ params }: PageProps) {
  const { recipient, amount } = await params

  // Decode URL-encoded params
  const decodedRecipient = decodeURIComponent(recipient)
  const decodedAmount = decodeURIComponent(amount)

  // Validate params with zod
  const validation = payParamsSchema.safeParse({
    recipient: decodedRecipient,
    amount: decodedAmount,
  })

  // Handle validation errors with custom UI
  if (!validation.success) {
    console.log('[Pay] Validation failed:', validation.error.issues)
    return (
      <PayPageWrapper>
        <PayErrorClient
          errorType="invalid_format"
          recipient={decodedRecipient}
          amount={decodedAmount}
        />
      </PayPageWrapper>
    )
  }

  // Resolve recipient address
  let resolvedAddress: Address
  let displayName: string
  let originalDomain: string | undefined

  const normalizedRecipient = decodedRecipient.toLowerCase().trim()

  if (isCroDomain(normalizedRecipient)) {
    // Resolve .cro domain to address (always uses mainnet)
    const address = await resolveCroDomain(normalizedRecipient)
    if (!address) {
      console.log('[Pay] Failed to resolve .cro domain:', normalizedRecipient)
      return (
        <PayPageWrapper>
          <PayErrorClient
            errorType="domain_not_found"
            recipient={decodedRecipient}
            amount={decodedAmount}
          />
        </PayPageWrapper>
      )
    }
    resolvedAddress = address
    displayName = normalizedRecipient
    originalDomain = normalizedRecipient
  } else if (isValidAddress(normalizedRecipient)) {
    // Use the address directly
    resolvedAddress = normalizedRecipient as Address
    displayName = `${normalizedRecipient.slice(0, 6)}...${normalizedRecipient.slice(-4)}`
  } else {
    // Invalid address format
    return (
      <PayPageWrapper>
        <PayErrorClient
          errorType="invalid_address"
          recipient={decodedRecipient}
          amount={decodedAmount}
        />
      </PayPageWrapper>
    )
  }

  // Parse and validate amount
  const amountUsd = parseFloat(decodedAmount)
  const amountSmallestUnit = Math.round(amountUsd * 1_000_000) // USDC.E has 6 decimals

  return (
    <PayPageWrapper>
      <PaymentForm
        recipient={resolvedAddress}
        displayName={displayName}
        amountUsd={amountUsd}
        amountSmallestUnit={amountSmallestUnit}
        originalDomain={originalDomain}
      />
    </PayPageWrapper>
  )
}

function PayPageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="container py-8 max-w-lg mx-auto">
      {/* Back button */}
      <div className="mb-6">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="size-4" />
            Back
          </Button>
        </Link>
      </div>
      {children}
    </div>
  )
}
