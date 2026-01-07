'use client'

import { Label } from '@/components/ui/label'
import { ScopeApprovalCard } from '@/features/sessionKeys/view/ScopeApprovalCard'
import { getScopeTemplateById } from '@/lib/sessionKeys/scopeTemplates'
import type { OAuthScopeInfo } from '../model/types'

interface ScopeSelectorProps {
  scopes: OAuthScopeInfo[]
  selectedScopeIds: string[]
  onToggleScope: (scopeId: string) => void
}

/**
 * Component for selecting OAuth scopes/permissions
 * Displays available scopes as approval cards
 */
export function ScopeSelector({ scopes, selectedScopeIds, onToggleScope }: ScopeSelectorProps) {
  return (
    <div className="space-y-3">
      <Label>Requested Permissions</Label>
      {scopes.map((scopeInfo) => {
        const template = getScopeTemplateById(scopeInfo.id)
        if (!template) return null
        const scope = template.factory()
        return (
          <ScopeApprovalCard
            key={scopeInfo.id}
            scope={scope}
            isSelected={selectedScopeIds.includes(scopeInfo.id)}
            onToggle={() => onToggleScope(scopeInfo.id)}
          />
        )
      })}
    </div>
  )
}
