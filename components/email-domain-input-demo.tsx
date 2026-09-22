'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { EmailDomainInput } from '@/components/email-domain-input'

export function EmailDomainInputDemo() {
  const [email, setEmail] = useState('')

  return (
    <form
      className="max-w-md space-y-6 text-center"
      onSubmit={(event) => event.preventDefault()}
    >
      <p className="text-muted-foreground mb-10 font-mono text-sm">
        Email: {email || '—'}
      </p>

      <EmailDomainInput
        label="Email"
        name="email"
        domains={['gmail.com', 'outlook.com', 'proton.me']}
        defaultDomain="gmail.com"
        value={email}
        onChange={setEmail}
        description="Pick a provider — the domain is appended for you."
        required
      />
      <Button type="submit">Sign in</Button>
    </form>
  )
}
