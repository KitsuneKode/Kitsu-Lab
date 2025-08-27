'use client'

import { useState } from 'react'
import { DomainEmailInput } from '@/components/email-domain-input-component'

export function EmailDomainInputDemo() {
  const [email, setEmail] = useState('')

  return (
    <form className="max-w-md space-y-6 text-center">
      <div className="border-accent mb-10 text-center text-xl">
        Email : {email}
      </div>

      <DomainEmailInput
        label="University email"
        name="email"
        domains={['edu.in', 'unimail.in']}
        defaultDomain="cuchd.in"
        value={email}
        onChange={setEmail}
        description="Sign in with the official university mail."
        required
      />
      <button type="submit" className="btn btn-primary">
        Continue
      </button>
    </form>
  )
}
