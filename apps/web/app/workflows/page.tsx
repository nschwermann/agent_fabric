import { Metadata } from 'next'
import { WorkflowsClient } from './client'

export const metadata: Metadata = {
  title: 'Workflows | x402',
  description: 'Manage your workflow templates',
}

export default function WorkflowsPage() {
  return (
    <div className="container max-w-6xl py-8">
      <WorkflowsClient />
    </div>
  )
}
