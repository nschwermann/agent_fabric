import Link from 'next/link'
import { Plus, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDashboard } from '../model/useDashboard'
import { StatsCards } from './StatsCards'
import { PeriodFilter } from './PeriodFilter'
import { ProxyManagementCard } from './ProxyManagementCard'
import { RequestLogsTable } from './RequestLogsTable'
import { SessionManager } from '@/features/sessionKeys/view'

export function DashboardView() {
  const {
    totals,
    proxies,
    recentLogs,
    isLoading,
    error,
    period,
    setPeriod,
    deleteProxy,
    isDeleting,
    toggleVisibility,
    isTogglingVisibility,
  } = useDashboard()

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container py-8">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="size-12 text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Error Loading Dashboard</h2>
          <p className="text-muted-foreground mb-4">
            {error instanceof Error ? error.message : 'Failed to load dashboard data'}
          </p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage your APIs and track their performance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodFilter period={period} onPeriodChange={setPeriod} />
          <Link href="/create">
            <Button className="gap-2">
              <Plus className="size-4" />
              Create API
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <StatsCards totals={totals} />

      {/* Session Keys */}
      <SessionManager />

      {/* APIs */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Your APIs</h2>
        {proxies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/50">
            <p className="text-muted-foreground mb-4">
              You haven't created any APIs yet. Create your first one to start earning!
            </p>
            <Link href="/create">
              <Button className="gap-2">
                <Plus className="size-4" />
                Create Your First API
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {proxies.map((proxy) => (
              <ProxyManagementCard
                key={proxy.id}
                proxy={proxy}
                onDelete={deleteProxy}
                onToggleVisibility={toggleVisibility}
                isDeleting={isDeleting}
                isTogglingVisibility={isTogglingVisibility}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recent Requests */}
      <RequestLogsTable logs={recentLogs} />
    </div>
  )
}
