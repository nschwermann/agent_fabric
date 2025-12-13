'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { type State, WagmiProvider } from 'wagmi'
import { createAppKit } from '@reown/appkit/react'
import { DefaultSIWX, InformalMessenger, EIP155Verifier, LocalStorage } from '@reown/appkit-siwx'

import { cronos, cronosTestnet } from '@reown/appkit/networks'
import { projectId, wagmiAdapter } from '@/config'

// App metadata
const metadata = {
  name: 'x402 Marketplace',
  description: 'Decentralized API marketplace with x402 payments on Cronos',
  url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
  icons: ['/icon.png'],
}

/**
 * Fetch a server-generated nonce for SIWX authentication.
 * Nonces are single-use and expire after 5 minutes.
 */
async function fetchNonce(): Promise<string> {
  const response = await fetch('/api/auth/nonce', {
    method: 'GET',
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch nonce: ${response.status}`)
  }

  const data = await response.json()
  return data.nonce
}

// SIWX configuration for multichain auth
const siwx = new DefaultSIWX({
  messenger: new InformalMessenger({
    domain: typeof window !== 'undefined' ? window.location.host : 'localhost:3000',
    uri: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
    getNonce: fetchNonce,
  }),
  verifiers: [new EIP155Verifier()],
  storage: new LocalStorage({ key: '@x402/siwx' }),
})

// Initialize AppKit
if (projectId) {
  createAppKit({
    adapters: [wagmiAdapter],
    projectId,
    networks: [cronosTestnet, cronos],
    defaultNetwork: cronosTestnet,
    metadata,
    siwx,
    features: {
      analytics: true,
    },
  })
}

export function Web3Provider(props: { children: ReactNode; initialState?: State }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig} initialState={props.initialState}>
      <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>
    </WagmiProvider>
  )
}
