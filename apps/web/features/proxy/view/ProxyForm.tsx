'use client'

import { Plus, Trash2, Loader2, Wallet } from 'lucide-react'
import { useAppKit } from '@reown/appkit/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Field, FieldLabel, FieldError, FieldGroup, FieldDescription } from '@/components/ui/field'
import { useProxyFormContext } from '../model'
import { useIsAuthenticated } from '@/context/user'

/** Extract error messages from TanStack Form errors (handles Zod v4 Standard Schema format) */
function getErrorMessages(errors: unknown[]): string {
  return errors
    .filter((e): e is { message: string } | string => e != null)
    .map(e => typeof e === 'string' ? e : e.message)
    .join(', ')
}

export function ProxyForm() {
  const { form, addHeader, removeHeader, isEditing } = useProxyFormContext()
  const { isAuthenticated, isLoading: isAuthLoading } = useIsAuthenticated()
  const { open } = useAppKit()

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? 'Edit API Proxy' : 'Monetize Your API'}</CardTitle>
          <CardDescription>
            {isEditing
              ? 'Update your payment-gated proxy configuration'
              : 'Create a payment-gated proxy for your existing API endpoint'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <FieldGroup>
            {/* Name Field */}
            <form.Field name="name">
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor={field.name}>API Name</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    placeholder="My Awesome API"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={field.state.meta.errors.length > 0}
                  />
                  {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                    <FieldError>{getErrorMessages(field.state.meta.errors)}</FieldError>
                  )}
                </Field>
              )}
            </form.Field>

            {/* Description Field */}
            <form.Field name="description">
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor={field.name}>
                    Description
                    <span className="text-muted-foreground font-normal"> (optional)</span>
                  </FieldLabel>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    placeholder="Describe what your API does..."
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    rows={3}
                    aria-invalid={field.state.meta.errors.length > 0}
                  />
                  {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                    <FieldError>{getErrorMessages(field.state.meta.errors)}</FieldError>
                  )}
                </Field>
              )}
            </form.Field>

            {/* Payment Address Field */}
            <form.Field name="paymentAddress">
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor={field.name}>Payment Address</FieldLabel>
                  <FieldDescription>
                    Ethereum address where you will receive payments
                  </FieldDescription>
                  <Input
                    id={field.name}
                    name={field.name}
                    placeholder="0x..."
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={field.state.meta.errors.length > 0}
                  />
                  {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                    <FieldError>{getErrorMessages(field.state.meta.errors)}</FieldError>
                  )}
                </Field>
              )}
            </form.Field>

            {/* Target URL Field */}
            <form.Field name="targetUrl">
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor={field.name}>Target API URL</FieldLabel>
                  <FieldDescription>
                    The actual endpoint that will receive requests after payment
                  </FieldDescription>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="url"
                    placeholder="https://api.example.com/v1/endpoint"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={field.state.meta.errors.length > 0}
                  />
                  {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                    <FieldError>{getErrorMessages(field.state.meta.errors)}</FieldError>
                  )}
                </Field>
              )}
            </form.Field>

            {/* Price Field */}
            <form.Field name="pricePerRequest">
              {(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor={field.name}>Price per Request (USDC.E)</FieldLabel>
                  <FieldDescription>Amount charged for each API call</FieldDescription>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="number"
                    step="0.000001"
                    min="0"
                    placeholder="0.01"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={field.state.meta.errors.length > 0}
                  />
                  {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                    <FieldError>{getErrorMessages(field.state.meta.errors)}</FieldError>
                  )}
                </Field>
              )}
            </form.Field>

            {/* Headers Field */}
            <form.Field name="headers" mode="array">
              {(headersField) => (
                <Field>
                  <FieldLabel>
                    Authentication Headers
                    <span className="text-muted-foreground font-normal"> (optional)</span>
                  </FieldLabel>
                  <FieldDescription>
                    Add headers that will be sent to your API (encrypted at rest)
                  </FieldDescription>

                  <div className="space-y-2">
                    {headersField.state.value.map((_, index) => (
                      <div key={index} className="flex gap-2">
                        <form.Field name={`headers[${index}].key`}>
                          {(keyField) => (
                            <Input
                              placeholder="Header name"
                              value={keyField.state.value}
                              onBlur={keyField.handleBlur}
                              onChange={(e) => keyField.handleChange(e.target.value)}
                              className="flex-1"
                            />
                          )}
                        </form.Field>
                        <form.Field name={`headers[${index}].value`}>
                          {(valueField) => (
                            <Input
                              placeholder="Header value"
                              type="password"
                              value={valueField.state.value}
                              onBlur={valueField.handleBlur}
                              onChange={(e) => valueField.handleChange(e.target.value)}
                              className="flex-1"
                            />
                          )}
                        </form.Field>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeHeader(index)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addHeader}
                      className="w-full"
                    >
                      <Plus className="size-4" />
                      Add Header
                    </Button>
                  </div>
                </Field>
              )}
            </form.Field>

            {/* Public Toggle */}
            <form.Field name="isPublic">
              {(field) => (
                <Field orientation="horizontal">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={field.state.value}
                      onChange={(e) => field.handleChange(e.target.checked)}
                      className="size-4 rounded border-input"
                    />
                    <div>
                      <div className="text-sm font-medium">Make API Public</div>
                      <div className="text-sm text-muted-foreground">
                        List this API in the public marketplace
                      </div>
                    </div>
                  </label>
                </Field>
              )}
            </form.Field>
          </FieldGroup>
        </CardContent>

        <CardFooter className="flex justify-between gap-2">
          <form.Subscribe selector={(state) => state.isDirty}>
            {(isDirty) => (
              <Button
                type="button"
                variant="ghost"
                onClick={() => form.reset()}
                disabled={!isDirty}
              >
                Reset
              </Button>
            )}
          </form.Subscribe>

          <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
            {([canSubmit, isSubmitting]) => {
              // Show sign in button if not authenticated
              if (!isAuthenticated) {
                return (
                  <Button
                    type="button"
                    onClick={() => open()}
                    disabled={isAuthLoading}
                  >
                    {isAuthLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Wallet className="size-4" />
                    )}
                    {isAuthLoading ? 'Connecting...' : 'Sign In'}
                  </Button>
                )
              }

              return (
                <Button type="submit" disabled={!canSubmit}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  {isSubmitting ? 'Saving...' : isEditing ? 'Update Proxy' : 'Create Proxy'}
                </Button>
              )
            }}
          </form.Subscribe>
        </CardFooter>
      </Card>
    </form>
  )
}
