'use client'

import { Layers, Activity, CheckCircle, DollarSign } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DashboardTotals } from '../model/types'

interface StatsCardsProps {
  totals: DashboardTotals
}

function formatEarnings(amountInSmallestUnit: number): string {
  const amount = amountInSmallestUnit / 1_000_000
  if (amount === 0) return '$0.00'
  if (amount < 0.01) return `$${amount.toFixed(6)}`
  if (amount < 1) return `$${amount.toFixed(4)}`
  return `$${amount.toFixed(2)}`
}

function formatSuccessRate(successful: number, total: number): string {
  if (total === 0) return '0%'
  const rate = (successful / total) * 100
  return `${rate.toFixed(1)}%`
}

export function StatsCards({ totals }: StatsCardsProps) {
  const stats = [
    {
      title: 'Total APIs',
      value: totals.apiCount.toString(),
      icon: Layers,
      description: 'Active API proxies',
    },
    {
      title: 'Total Requests',
      value: totals.totalRequests.toLocaleString(),
      icon: Activity,
      description: 'All-time requests',
    },
    {
      title: 'Success Rate',
      value: formatSuccessRate(totals.successfulRequests, totals.totalRequests),
      icon: CheckCircle,
      description: `${totals.successfulRequests.toLocaleString()} successful`,
    },
    {
      title: 'Total Earnings',
      value: formatEarnings(totals.totalEarnings),
      icon: DollarSign,
      description: 'USDC.E earned',
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <Icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
