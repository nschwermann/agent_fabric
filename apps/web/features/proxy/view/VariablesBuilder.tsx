'use client'

import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { VARIABLE_TYPES, type VariableDefinition, type VariableType } from '../model/variables'
import { cn } from '@/lib/utils'

interface VariablesBuilderProps {
  variables: VariableDefinition[]
  onAdd: (variable?: Partial<VariableDefinition>) => void
  onRemove: (index: number) => void
  onUpdate: (index: number, updates: Partial<VariableDefinition>) => void
}

export function VariablesBuilder({
  variables,
  onAdd,
  onRemove,
  onUpdate,
}: VariablesBuilderProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  return (
    <div className="space-y-3">
      {variables.map((variable, index) => (
        <VariableItem
          key={index}
          variable={variable}
          index={index}
          isExpanded={expandedIndex === index}
          onToggle={() => setExpandedIndex(expandedIndex === index ? null : index)}
          onUpdate={(updates) => onUpdate(index, updates)}
          onRemove={() => onRemove(index)}
        />
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onAdd()}
        className="w-full"
      >
        <Plus className="size-4" />
        Add Variable
      </Button>
    </div>
  )
}

interface VariableItemProps {
  variable: VariableDefinition
  index: number
  isExpanded: boolean
  onToggle: () => void
  onUpdate: (updates: Partial<VariableDefinition>) => void
  onRemove: () => void
}

function VariableItem({
  variable,
  isExpanded,
  onToggle,
  onUpdate,
  onRemove,
}: VariableItemProps) {
  const isValid = variable.name && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variable.name)

  return (
    <div
      className={cn(
        'rounded-lg border bg-card',
        !isValid && variable.name && 'border-destructive'
      )}
    >
      {/* Header row - always visible */}
      <div className="flex items-center gap-2 p-3">
        <Input
          placeholder="variableName"
          value={variable.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className={cn(
            'flex-1 font-mono',
            !isValid && variable.name && 'border-destructive'
          )}
        />
        <Select
          value={variable.type}
          onValueChange={(v) => onUpdate({ type: v as VariableType })}
        >
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VARIABLE_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={variable.required}
            onChange={(e) => onUpdate({ required: e.target.checked })}
            className="size-4 rounded border-input"
          />
          Required
        </label>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggle}
        >
          {isExpanded ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t px-3 pb-3 pt-3 space-y-3">
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={variable.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Describe what this variable is for..."
              rows={2}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Default Value</label>
              <Input
                value={variable.default !== undefined ? String(variable.default) : ''}
                onChange={(e) => {
                  const val = e.target.value
                  onUpdate({
                    default: val === '' ? undefined : parseValue(val, variable.type),
                  })
                }}
                placeholder="Default value"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Example Value</label>
              <Input
                value={variable.example !== undefined ? String(variable.example) : ''}
                onChange={(e) => {
                  const val = e.target.value
                  onUpdate({
                    example: val === '' ? undefined : parseValue(val, variable.type),
                  })
                }}
                placeholder="Example value"
                className="mt-1"
              />
            </div>
          </div>

          {/* Validation rules based on type */}
          {(variable.type === 'string' || variable.type === 'number') && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Validation Rules</label>
              <div className="grid grid-cols-2 gap-3">
                {variable.type === 'string' && (
                  <>
                    <div>
                      <label className="text-xs text-muted-foreground">Min Length</label>
                      <Input
                        type="number"
                        min={0}
                        value={variable.validation?.minLength ?? ''}
                        onChange={(e) =>
                          onUpdate({
                            validation: {
                              ...variable.validation,
                              minLength: e.target.value ? parseInt(e.target.value) : undefined,
                            },
                          })
                        }
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Max Length</label>
                      <Input
                        type="number"
                        min={0}
                        value={variable.validation?.maxLength ?? ''}
                        onChange={(e) =>
                          onUpdate({
                            validation: {
                              ...variable.validation,
                              maxLength: e.target.value ? parseInt(e.target.value) : undefined,
                            },
                          })
                        }
                        className="mt-1"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Pattern (Regex)</label>
                      <Input
                        value={variable.validation?.pattern ?? ''}
                        onChange={(e) =>
                          onUpdate({
                            validation: {
                              ...variable.validation,
                              pattern: e.target.value || undefined,
                            },
                          })
                        }
                        placeholder="^0x[a-fA-F0-9]{40}$"
                        className="mt-1 font-mono"
                      />
                    </div>
                  </>
                )}
                {variable.type === 'number' && (
                  <>
                    <div>
                      <label className="text-xs text-muted-foreground">Min Value</label>
                      <Input
                        type="number"
                        value={variable.validation?.min ?? ''}
                        onChange={(e) =>
                          onUpdate({
                            validation: {
                              ...variable.validation,
                              min: e.target.value ? parseFloat(e.target.value) : undefined,
                            },
                          })
                        }
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Max Value</label>
                      <Input
                        type="number"
                        value={variable.validation?.max ?? ''}
                        onChange={(e) =>
                          onUpdate({
                            validation: {
                              ...variable.validation,
                              max: e.target.value ? parseFloat(e.target.value) : undefined,
                            },
                          })
                        }
                        className="mt-1"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function parseValue(value: string, type: VariableType): unknown {
  switch (type) {
    case 'number':
      return parseFloat(value) || 0
    case 'boolean':
      return value.toLowerCase() === 'true'
    case 'array':
    case 'object':
      try {
        return JSON.parse(value)
      } catch {
        return value
      }
    default:
      return value
  }
}
