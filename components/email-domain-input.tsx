'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type EmailDomainInputProps = {
  domains: string[]
  defaultDomain?: string
  value?: string
  onChange?: (email: string) => void
  label?: string
  description?: string
  error?: string
  id?: string
  name?: string
  required?: boolean
  disabled?: boolean
  autoComplete?: string
  placeholder?: string
  className?: string
  inputClassName?: string
  selectClassName?: string
}

function useDomainEmail({
  domains,
  defaultDomain,
  value,
  onChange,
}: Pick<
  EmailDomainInputProps,
  'domains' | 'defaultDomain' | 'value' | 'onChange'
>) {
  // Clean and validate domains
  const cleanDomains = React.useMemo(() => {
    return domains
      .map((d) => d.replace(/^@/, '').toLowerCase().trim())
      .filter(Boolean)
  }, [domains])

  // Determine initial domain
  const initialDomain = React.useMemo(() => {
    const cleaned = defaultDomain?.replace(/^@/, '').toLowerCase().trim()
    if (cleaned && cleanDomains.includes(cleaned)) {
      return cleaned
    }
    return cleanDomains[0] || ''
  }, [defaultDomain, cleanDomains])

  // Parse controlled value
  const parseValue = React.useCallback(
    (email: string) => {
      if (!email) return { username: '', domain: initialDomain }

      const atIndex = email.lastIndexOf('@')
      if (atIndex === -1) return { username: email, domain: initialDomain }

      const username = email.substring(0, atIndex)
      const domain = email.substring(atIndex + 1).toLowerCase()

      return {
        username,
        domain: cleanDomains.includes(domain) ? domain : initialDomain,
      }
    },
    [cleanDomains, initialDomain],
  )

  // Initialize state
  const initial = React.useMemo(
    () => parseValue(value || ''),
    [value, parseValue],
  )
  const [username, setUsername] = React.useState(initial.username)
  const [domain, setDomain] = React.useState<string>(initial.domain)

  // Update state when controlled value changes. Adjusts during render — the
  // React-recommended alternative to a sync effect — keyed on the same inputs
  // the effect depended on (`value` and `parseValue`).
  const [lastSync, setLastSync] = React.useState({ value, parseValue })
  if (
    value !== undefined &&
    (lastSync.value !== value || lastSync.parseValue !== parseValue)
  ) {
    const parsed = parseValue(value)
    setLastSync({ value, parseValue })
    setUsername(parsed.username)
    setDomain(parsed.domain)
  }

  // Handle username change
  const handleUsernameChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newUsername = e.target.value.trimStart()
      setUsername(newUsername)

      const email = newUsername ? `${newUsername}@${domain}` : ''
      onChange?.(email)
    },
    [domain, onChange],
  )

  // Handle domain change
  const handleDomainChange = React.useCallback(
    (newDomain: string) => {
      setDomain(newDomain)

      const email = username ? `${username}@${newDomain}` : ''
      onChange?.(email)
    },
    [username, onChange],
  )

  // Simple validation
  const isInvalidUsername =
    username.length > 0 && !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(username)

  return {
    cleanDomains,
    username,
    domain,
    isInvalidUsername,
    handleUsernameChange,
    handleDomainChange,
  }
}

function DomainSelect({
  domains,
  domain,
  disabled,
  onChange,
  className,
}: {
  domains: string[]
  domain: string
  disabled?: boolean
  onChange: (domain: string) => void
  className?: string
}) {
  // One allowed domain is a constant, not a choice — static text instead of a
  // dead dropdown.
  if (domains.length <= 1) {
    return (
      <span className="text-muted-foreground flex h-10 shrink-0 items-center px-3 text-sm">
        @{domain}
      </span>
    )
  }
  return (
    <Select
      items={domains.map((d) => ({ value: d, label: `@${d}` }))}
      value={domain || undefined}
      onValueChange={(value) => {
        if (value) onChange(value)
      }}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn(
          'h-10 w-[11rem] min-w-[9rem] shrink-0 rounded-none border-0 px-3',
          'justify-between focus:ring-0 focus:ring-offset-0',
          className,
        )}
        aria-label="Select email domain"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        alignItemWithTrigger={false}
        side="bottom"
        align="end"
        className="max-h-64"
      >
        <SelectGroup>
          {domains.map((d) => (
            <SelectItem key={d} value={d}>
              @{d}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function DomainFieldMessages({
  id,
  description,
  error,
  invalid,
}: {
  id?: string
  description?: string
  error?: string
  invalid: boolean
}) {
  return (
    <>
      {description && !error && !invalid && (
        <p id={`${id}-desc`} className="text-muted-foreground mt-1 text-xs">
          {description}
        </p>
      )}

      {(error || invalid) && (
        <p id={`${id}-error`} className="text-destructive mt-1 text-xs">
          {error || 'Please enter a valid email'}
        </p>
      )}
    </>
  )
}

export const EmailDomainInput = React.memo(
  React.forwardRef<HTMLInputElement, EmailDomainInputProps>(
    function EmailDomainInput(props, ref) {
      const {
        domains,
        defaultDomain,
        value,
        onChange,
        label,
        description,
        error,
        id,
        name = 'email',
        required,
        disabled,
        autoComplete = 'email',
        placeholder = 'Username',
        className,
        inputClassName,
        selectClassName,
      } = props

      // Without a consumer id the label/description wiring would point at
      // "undefined-*" — generate a stable one.
      const generatedId = React.useId()
      const fieldId = id ?? generatedId

      const {
        cleanDomains,
        username,
        domain,
        isInvalidUsername,
        handleUsernameChange,
        handleDomainChange,
      } = useDomainEmail({ domains, defaultDomain, value, onChange })

      const describedBy = error
        ? `${fieldId}-error`
        : description
          ? `${fieldId}-desc`
          : undefined

      return (
        <div className={cn('w-full', className)}>
          {label && (
            <label
              htmlFor={fieldId}
              id={`${fieldId}-label`}
              className="text-foreground mb-1 block text-sm font-medium"
            >
              {label}
            </label>
          )}

          <div
            aria-labelledby={label ? `${fieldId}-label` : undefined}
            aria-describedby={describedBy}
            className={cn(
              'group bg-background relative flex w-full items-stretch overflow-hidden rounded-md border',
              'ring-offset-background focus-within:ring-ring focus-within:ring-2 focus-within:ring-offset-2',
              error || isInvalidUsername
                ? 'border-destructive'
                : 'border-input',
            )}
          >
            <Input
              ref={ref}
              id={fieldId}
              name={`${name}__username`}
              // Not type="email" — the box holds only the local part, and
              // native email validation would reject it. inputMode still
              // gives touch keyboards the @ layout.
              inputMode="email"
              autoComplete={autoComplete}
              placeholder={placeholder}
              required={required}
              disabled={disabled}
              value={username}
              onChange={handleUsernameChange}
              aria-invalid={Boolean(error || isInvalidUsername)}
              aria-describedby={describedBy}
              className={cn(
                'h-10 flex-1 rounded-none border-0 focus-visible:ring-0',
                'placeholder:text-muted-foreground',
                inputClassName,
              )}
            />

            <div className="bg-border my-1 w-px self-stretch" />

            <DomainSelect
              domains={cleanDomains}
              domain={domain}
              disabled={disabled}
              onChange={handleDomainChange}
              className={selectClassName}
            />
          </div>

          {/* Hidden field carries the joined address on form submit. */}
          <input
            type="hidden"
            name={name}
            value={username ? `${username}@${domain}` : ''}
          />

          <DomainFieldMessages
            id={fieldId}
            description={description}
            error={error}
            invalid={isInvalidUsername}
          />
        </div>
      )
    },
  ),
)
