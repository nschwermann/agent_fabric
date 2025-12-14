'use client'

import { ProxyFormProvider, ProxyForm } from '@/features/proxy'
import { UserStatus } from '@/features/user'

export default function Page() {
  return (
    <div className="container mx-auto max-w-2xl py-8 px-4">
      <div className="mb-6 flex justify-end">
        <UserStatus />
      </div>
      <ProxyFormProvider
        onSuccess={(id) => {
          console.log('Proxy created:', id)
          alert('Proxy created successfully!')
        }}
      >
        <ProxyForm />
      </ProxyFormProvider>
    </div>
  )
}
