import type { CSSProperties } from 'react'
import { registry } from '@/app/utils/registry'
import { ExhibitLink } from '@/components/exhibit-link'

const ShowCaseList = () => {
  return (
    <ul className="border-border border-t">
      {registry.list.map((component, index) => (
        <li
          key={component.path}
          className="border-border exhibit-row border-b"
          style={{ '--i': index } as CSSProperties}
        >
          <ExhibitLink
            path={component.path}
            name={component.name}
            description={component.description}
            index={index}
          />
        </li>
      ))}
    </ul>
  )
}

export default ShowCaseList
