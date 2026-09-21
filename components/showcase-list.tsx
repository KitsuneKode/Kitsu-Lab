import React from 'react'
import { registry } from '@/app/utils/registry'
import { ExhibitLink } from '@/components/exhibit-link'

const ShowCaseList = () => {
  return (
    <div className="flex flex-col gap-4">
      {registry.list.map((component) => (
        <div key={component.path} className="flex items-center gap-2">
          <ExhibitLink path={component.path} name={component.name} />
        </div>
      ))}
    </div>
  )
}

export default ShowCaseList
