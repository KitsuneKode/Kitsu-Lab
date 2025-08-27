import KeyComponent from '@/components/keyboard-button-component'
import { EmailDomainInputDemo } from '@/components/email-domain-input-demo'

export const registry = {
  list: [
    {
      name: 'Keyboard Button Component',
      path: 'keyboard',
      description:
        'A 3d like component that simulates a keyboard button press effect.',
      component: KeyComponent,
      image: {
        url: '/key_press/opengraph-image.png',
        alt: 'Keyboard Button Component',
      },
    },
    {
      name: 'Email Domain Input Component',
      path: 'email-domain',
      description:
        'Reusable React email input component with domain restriction dropdown.shadcn / ui, TypeScript, Tailwind CSS, ARIA accessible.Perfect for enterprise apps.',
      component: EmailDomainInputDemo,
      image: {
        url: '',
        alt: 'Email Domain Input',
      },
    },
  ],
}
