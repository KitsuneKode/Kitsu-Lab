import KeyComponent from '@/app/components/keyboard-button-component'

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
  ],
}
