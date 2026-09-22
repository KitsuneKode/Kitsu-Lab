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
        label="University email"
        name="email"
        domains={['cuchd.in', 'edu.in', 'unimail.in']}
        defaultDomain="cuchd.in"
        value={email}
        onChange={setEmail}
        description="Sign in with the official university mail."
        required
      />
      <Button type="submit">Sign in</Button>
    </form>
  )
}
