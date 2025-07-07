import React from 'react'
import Link from 'next/link'
import { ArrowRightIcon } from 'lucide-react'
import { registry } from '@/app/utils/registry'
const ShowCaseList = () => {
  return (
    <div className="flex flex-col gap-4">
      {registry.list.map((component, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Link
            href={`/exhibition/${component.path}`}
            className="flex items-center gap-2"
          >
            {component.name}
            <span className="ml-2">
              <ArrowRightIcon />
            </span>
          </Link>
        </div>
      ))}
    </div>
  )
}

export default ShowCaseList
