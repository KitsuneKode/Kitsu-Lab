import type { BookPreviewPage } from '@/components/book-preview'

export const DEMO_BOOK_PAGES: BookPreviewPage[] = [
  {
    id: 'cover',
    pageNumber: 1,
    title: 'The Celestial Mechanics',
    subtitle: 'A treatise on motion, space, and digital interfaces',
    kicker: 'Physical edition preview',
    isCover: true,
  },
  {
    id: 'frontispiece',
    pageNumber: 2,
    kicker: 'Frontispiece',
    title: 'The Architecture of the Cosmos',
    paragraphs: [
      'Published in Florence, anno 1632.',
      'Digitized and rendered for modern screens with mechanical fidelity.',
      'First edition. Restricted sample circulation.',
    ],
  },
  {
    id: 'contents',
    pageNumber: 3,
    kicker: 'Table of Contents',
    title: 'Contents & Treatises',
    paragraphs: [
      'I. The Principle of Natural Motion',
      'II. Friction, Resistance & Tactile Feedback',
      'III. Parabolic Curves of Physical Paper',
      'IV. Geometry in Constrained Systems',
    ],
  },
  {
    id: 'motion',
    pageNumber: 4,
    kicker: 'Chapter I',
    title: 'The Principle of Natural Motion',
    paragraphs: [
      'In the physical universe, no object transitions instantly between two discrete states without traversing the continuum in between. When human hands open a volume, the paper offers elastic resistance.',
      'The corner curls inward first, forming a parabolic cone before the weight of the folio draws the leaf across the meridian.',
    ],
    quote: {
      text: 'Motion is the cause of all life; without resistance, motion has no weight.',
      attribution: 'Leonardo da Vinci, Codex Arundel',
    },
  },
  {
    id: 'diagram',
    pageNumber: 5,
    kicker: 'Diagram I',
    title: 'Observation of the Orbiting Spheres',
    paragraphs: [
      'Geometric representation of light refraction across a curved sheet.',
      'The gradient of shadow shifts from the spine to the outer margin.',
    ],
  },
  {
    id: 'friction',
    pageNumber: 6,
    kicker: 'Chapter II',
    title: 'Tactile Friction',
    paragraphs: [
      'Digital interfaces frequently either over-decorate or sterilize interaction. A useful page curl is deterministic: it reacts to the exact vector of the thumb.',
      'If the reader pauses halfway, the page should hover in equilibrium. If released with insufficient velocity, it settles back onto the stack.',
    ],
  },
  {
    id: 'close',
    pageNumber: 7,
    kicker: 'Conclusion',
    title: 'End of Physical Preview',
    paragraphs: [
      'You have completed the preview chapters. Optional engines can be selected above when their dependencies are available.',
    ],
    isBackCover: true,
  },
]
