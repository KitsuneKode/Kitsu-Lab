// DomainEmailInput.tsx
import * as React from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type DomainEmailInputProps = {
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

export const DomainEmailInput = React.memo(
  React.forwardRef<HTMLInputElement, DomainEmailInputProps>(
    function DomainEmailInput(props, ref) {
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
        autoComplete = 'username',
        placeholder = 'Username',
        className,
        inputClassName,
        selectClassName,
      } = props

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

      // Update state when controlled value changes
      React.useEffect(() => {
        if (value !== undefined) {
          const parsed = parseValue(value)
          setUsername(parsed.username)
          setDomain(parsed.domain)
        }
      }, [value, parseValue])

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
        username.length > 0 &&
        !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(username)

      return (
        <div className={cn('w-full', className)}>
          {label && (
            <label
              htmlFor={id}
              id={id ? `${id}-label` : undefined}
              className="text-foreground mb-1 block text-sm font-medium"
            >
              {label}
            </label>
          )}

          <div
            // Remove role="group" and aria-invalid - not needed here
            aria-labelledby={id ? `${id}-label` : undefined}
            aria-describedby={
              error ? `${id}-error` : description ? `${id}-desc` : undefined
            }
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
              id={id}
              name={`${name}__username`}
              autoComplete={autoComplete}
              placeholder={placeholder}
              required={required}
              disabled={disabled}
              value={username}
              onChange={handleUsernameChange}
              aria-invalid={Boolean(error || isInvalidUsername)} // Move aria-invalid here
              aria-describedby={
                error ? `${id}-error` : description ? `${id}-desc` : undefined
              }
              className={cn(
                'h-10 flex-1 rounded-none border-0 focus-visible:ring-0',
                'placeholder:text-muted-foreground',
                inputClassName,
              )}
            />

            <div className="bg-border my-1 w-px self-stretch" />

            <Select
              value={domain || undefined}
              onValueChange={handleDomainChange}
              disabled={disabled || cleanDomains.length <= 1}
            >
              <SelectTrigger
                className={cn(
                  'h-10 w-[11rem] min-w-[9rem] shrink-0 rounded-none border-0 px-3',
                  'justify-between focus:ring-0 focus:ring-offset-0',
                  selectClassName,
                )}
                aria-label="Select email domain"
              >
                <SelectValue>@{domain || 'domain'}</SelectValue>
              </SelectTrigger>
              <SelectContent align="end" className="max-h-64">
                {cleanDomains.map((d) => (
                  <SelectItem key={d} value={d}>
                    @{d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Hidden field for form submission */}
          <input
            type="hidden"
            name={name}
            value={username ? `${username}@${domain}` : ''}
          />

          {description && !error && !isInvalidUsername && (
            <p id={`${id}-desc`} className="text-muted-foreground mt-1 text-xs">
              {description}
            </p>
          )}

          {(error || isInvalidUsername) && (
            <p id={`${id}-error`} className="text-destructive mt-1 text-xs">
              {error || 'Please enter a valid email'}
            </p>
          )}
        </div>
      )
    },
  ),
)
