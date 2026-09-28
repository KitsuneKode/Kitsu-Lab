import type { BookPreviewHotspot } from '@/components/book-preview'

/** The 1915 original, public domain, on the Internet Archive. */
const ORIGINAL = 'https://archive.org/details/birdbookillustra00reed'

/**
 * A pretend museum shop on the Bird Book's plates: each bird is a print,
 * placed by page-relative coordinates. The links open the original scan.
 */
export const BIRD_HOTSPOTS: BookPreviewHotspot[] = [
  {
    id: 'print-tanager',
    pageIndex: 3,
    x: 0.47,
    y: 0.37,
    title: 'Scarlet Tanager, Plate VII',
    price: '$48',
    description:
      'Giclée print on 310gsm cotton rag, 30 × 40 cm, from the 1915 plate. Framed in oiled walnut.',
    image: { src: '/shop/print-tanager.svg', alt: 'The tanager plate, framed' },
    href: ORIGINAL,
    action: 'See the 1915 original',
  },
  {
    id: 'egg-cards',
    pageIndex: 3,
    x: 0.7,
    y: 0.25,
    title: 'Egg specimen cards',
    label: 'Egg specimen cards, set of 12',
    price: '$18',
    description:
      'Twelve letterpress cards, one egg each, with the collector’s notes on the back.',
  },
  {
    id: 'print-bluebird',
    pageIndex: 5,
    x: 0.5,
    y: 0.37,
    title: 'Eastern Bluebird, Plate XII',
    price: '$48',
    description:
      'Giclée print on 310gsm cotton rag, 30 × 40 cm. The orchard plate, colour-matched to the first edition.',
    image: {
      src: '/shop/print-bluebird.svg',
      alt: 'The bluebird plate, framed',
    },
    href: ORIGINAL,
    action: 'See the 1915 original',
  },
  {
    id: 'print-owl',
    pageIndex: 7,
    x: 0.5,
    y: 0.4,
    title: 'Snowy Owl, Plate XVIII',
    price: '$64',
    description:
      'Large format, 50 × 70 cm, on warm white cotton rag. Ships rolled in a tube.',
    image: { src: '/shop/print-owl.svg', alt: 'The snowy owl plate, framed' },
    href: ORIGINAL,
    action: 'See the 1915 original',
  },
  {
    id: 'print-hummingbird',
    pageIndex: 9,
    x: 0.56,
    y: 0.37,
    title: 'Ruby-throated Hummingbird, Plate XXIV',
    price: '$48',
    description:
      'Giclée print on 310gsm cotton rag, 30 × 40 cm, with the trumpet vine in full.',
    image: {
      src: '/shop/print-hummingbird.svg',
      alt: 'The hummingbird plate, framed',
    },
    href: ORIGINAL,
    action: 'See the 1915 original',
  },
]
