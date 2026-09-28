import { KeyboardButton } from '@/components/keyboard-button'
import { EmailDomainInputDemo } from '@/components/email-domain-input-demo'
import { BookPreviewDemo } from '@/components/book-preview-demo/book-preview-demo'
import { PromotionsDemo } from '@/components/promotions-demo/promotions-demo'

export const registry = {
  list: [
    {
      name: 'Interactive Book & PDF Reader',
      path: 'book-reader',
      description:
        'Shadcn-compatible book preview with a lightweight default reader and optional curl, spread, WebGL, and PDF engines.',
      component: BookPreviewDemo,
      image: {
        url: '',
        alt: 'Interactive Book & PDF Reader',
      },
    },
    {
      name: 'Promotions',
      path: 'promotions',
      description:
        'A campaign system for shadcn: bars, toasts, dialogs, spotlights, side cards and stories with frequency rules, audiences, A/B tests, event triggers and one-tap coupon apply.',
      component: PromotionsDemo,
      image: {
        url: '',
        alt: 'Promotions',
      },
    },
    {
      name: 'Keyboard Button',
      path: 'keyboard',
      description:
        'A tactile keycap with spring press physics, entrance animation, and click sound.',
      component: KeyboardButton,
      image: {
        url: '/key_press/opengraph-image.png',
        alt: 'Keyboard Button',
      },
    },
    {
      name: 'Email Domain Input',
      path: 'email-domain',
      description:
        'Email input restricted to approved domains — an inline domain picker keeps the local part and suffix in one field. ARIA wired, form-ready.',
      component: EmailDomainInputDemo,
      image: {
        url: '',
        alt: 'Email Domain Input',
      },
    },
  ],
}
