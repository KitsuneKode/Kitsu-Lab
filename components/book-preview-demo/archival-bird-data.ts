export interface ArchivalPlate {
  pageNumber: number
  facingPageNumber?: number
  order?: string
  family?: string
  commonName: string
  scientificName: string
  isCover?: boolean
  isIndex?: boolean
  length?: string
  nestNotes?: string
  rangeNotes?: string
  eggCount?: string
  description: string[]
  plateType: 'plate' | 'text' | 'cover' | 'index'
  colorTheme: {
    primary: string
    accent: string
    plumageGlow: string
  }
  svgType:
    | 'scarlet-tanager'
    | 'bluebird'
    | 'snowy-owl'
    | 'hummingbird'
    | 'goldfinch'
    | 'cover'
    | 'index'
}

export const ARCHIVAL_BIRD_BOOK_PAGES: ArchivalPlate[] = [
  {
    pageNumber: 1,
    commonName: 'THE BIRD BOOK',
    scientificName: 'Illustrating in Natural Colors',
    isCover: true,
    plateType: 'cover',
    description: [
      'Illustrating in natural colors more than seven hundred North American birds.',
      'Also several hundred photographs of their nests and eggs.',
      'By CHESTER A. REED, B.S.',
      'Author of "North American Birds\' Eggs", "Color Key to North American Birds", etc.',
      'Published by DOUBLEDAY, PAGE & COMPANY, Garden City, New York, 1915.',
    ],
    colorTheme: {
      primary: '#2B422B', // Forest green buckram cloth
      accent: '#D4AF37', // Antique gold stamping
      plumageGlow: '#E8D584',
    },
    svgType: 'cover',
  },
  {
    pageNumber: 2,
    order: 'Order PASSERES',
    family: 'Perching Birds',
    commonName: 'Historical Introduction & Preface',
    scientificName: 'Ornithologia Americana • MCMXV',
    plateType: 'text',
    description: [
      'In this volume an attempt is made to present a guide so simple and concise that anyone may identify any North American bird with certainty.',
      "Few studies possess such lasting fascination as ornithology. In the field, the eye is caught first by motion and color. A flash of fiery scarlet among maple boughs, the mellow carol of an azure bluebird across early spring pastures—these are moments etched into the naturalist's memory.",
      'Each specimen herein is reproduced from original watercolors executed directly from living subjects in their natural habitats.',
    ],
    colorTheme: {
      primary: '#2C2523',
      accent: '#8A5A36',
      plumageGlow: '#C5A059',
    },
    svgType: 'index',
  },
  {
    pageNumber: 14,
    order: 'Order PASSERES',
    family: 'Family THRAUPIDAE (Tanagers)',
    commonName: 'Scarlet Tanager • Life History',
    scientificName: 'Piranga olivacea',
    length: '7.25 inches (18.4 cm)',
    nestNotes:
      'A shallow, saucer-shaped structure of slender twigs and pine needles, placed 15 to 30 feet high on a horizontal limb of an oak or hemlock.',
    rangeNotes:
      'Breeds from southern Canada south through the deciduous forests to northern Georgia; winters in northwestern South America.',
    eggCount:
      '3 to 5, pale greenish-blue speckled with rufous-brown and purplish shell markings (0.95 x 0.65 in).',
    plateType: 'text',
    description: [
      'Male in breeding plumage is brilliant, glowing scarlet, with wings and tail jet black. Female and young are light olive-green above, yellowish beneath, with dusky brownish wings.',
      'The song is a cheerful, robin-like phrase with a distinctive husky or hoarse timbre: "chip-churr, chip-churr." When alarmed near the nest, the male gives a sharp, dry alarm whistle.',
      'Diet consists almost exclusively of destructive insects, particularly beetles, moths, and hairy caterpillars that other songbirds avoid.',
    ],
    colorTheme: {
      primary: '#8A1C14',
      accent: '#C4302B',
      plumageGlow: '#FF4D4D',
    },
    svgType: 'scarlet-tanager',
  },
  {
    pageNumber: 15,
    order: 'Plate VII',
    family: 'Family THRAUPIDAE',
    commonName: 'Scarlet Tanager & Summer Tanager',
    scientificName: 'Piranga olivacea (Left) & Piranga rubra (Right)',
    plateType: 'plate',
    length: 'Male in full adult vernal plumage',
    nestNotes:
      'Illustrated from life specimen No. 498, Worcester Natural History Museum.',
    description: [
      'Fig. 1 (Center): Male Scarlet Tanager in adult breeding array perched upon White Oak branch.',
      'Fig. 2 (Lower inset): Clutch of four eggs, natural coloration and scale.',
      'Fig. 3 (Right margin): Autumn molt showing the transition to greenish-yellow winter dress.',
    ],
    colorTheme: {
      primary: '#B22222',
      accent: '#D9534F',
      plumageGlow: '#FF3333',
    },
    svgType: 'scarlet-tanager',
  },
  {
    pageNumber: 26,
    order: 'Order PASSERES',
    family: 'Family TURDIDAE (Thrushes & Bluebirds)',
    commonName: 'Eastern Bluebird • Life History',
    scientificName: 'Sialia sialis',
    length: '6.75 inches (17.1 cm)',
    nestNotes:
      'Constructed within natural tree cavities, old flicker holes, or wooden nesting boxes; lined with dried grass stems and fine feathers.',
    rangeNotes:
      'Eastern North America, from southern Saskatchewan east to Newfoundland, south to the Gulf Coast.',
    eggCount:
      '4 to 6, clear sky-blue, rarely pure white (0.84 x 0.65 in). Two or three broods reared each season.',
    plateType: 'text',
    description: [
      'Male: Upperparts intense cobalt and sky-blue; throat, breast, and sides rich cinnamon-chestnut; belly and under tail-coverts white.',
      'Female: Blue of upperparts veiled by grayish wash; breast pale cinnamon.',
      'The call is a sweet, soft whistle described by Burroughs as "Bermuda! Bermuda!" or "purity, purity." They are among the earliest heralds of spring, often arriving while lingering snowdrifts still line orchard stone walls.',
    ],
    colorTheme: {
      primary: '#1E3F66',
      accent: '#D35400',
      plumageGlow: '#3B82F6',
    },
    svgType: 'bluebird',
  },
  {
    pageNumber: 27,
    order: 'Plate XII',
    family: 'Family TURDIDAE',
    commonName: 'Eastern Bluebird in Apple Orchard',
    scientificName: 'Sialia sialis • Vernal Foliage',
    plateType: 'plate',
    length: 'Adult male and female at nesting hollow',
    nestNotes: 'Drawn in May amongst blooming Baldwins.',
    description: [
      'Fig. 1: Adult male alighting upon weathered fence post with captured grasshopper.',
      'Fig. 2: Female emerging from lichen-encrusted knothole.',
      'Fig. 3: Typical sky-blue egg clutch alongside comparison dimensions.',
    ],
    colorTheme: {
      primary: '#2563EB',
      accent: '#EA580C',
      plumageGlow: '#60A5FA',
    },
    svgType: 'bluebird',
  },
  {
    pageNumber: 42,
    order: 'Order STRIGIFORMES',
    family: 'Family STRIGIDAE (Owls)',
    commonName: 'Snowy Owl • Arctic Nomad',
    scientificName: 'Bubo scandiacus',
    length: '23 to 27 inches (58 to 68 cm) • Wingspread: 5 feet',
    nestNotes:
      'A shallow depression scooped directly in the arctic tundra moss on elevated knolls or gravel ridges.',
    rangeNotes:
      'Circumpolar arctic barrens; irruptive winter visitor southward across northern United States during lemming cycle collapses.',
    eggCount:
      '5 to 8 (in lemming abundance years up to 11), chalky white and rounded (2.25 x 1.75 in).',
    plateType: 'text',
    description: [
      'Plumage is dense, ivory-white, heavily barred with dark brown in females and young, almost pure immaculate white in old males.',
      'Legs and toes are thickly swathed in long, hair-like down down to the curved black talons, insulating against minus sixty degree Arctic blizzards.',
      'Unlike nocturnal woodland owls, the Snowy Owl hunts by daylight, perching motionless on telephone poles, dunes, or haystacks to spot mice and shorebirds.',
    ],
    colorTheme: {
      primary: '#4A5568',
      accent: '#D97706',
      plumageGlow: '#FBBF24',
    },
    svgType: 'snowy-owl',
  },
  {
    pageNumber: 43,
    order: 'Plate XVIII',
    family: 'Family STRIGIDAE',
    commonName: 'Snowy Owl in Winter Gale',
    scientificName: 'Bubo scandiacus • Coastal Specimen',
    plateType: 'plate',
    length: 'Adult female on salt-marsh drift log',
    nestNotes: 'Observed Plum Island coastal dunes, Massachusetts.',
    description: [
      'Fig. 1: Grand ivory specimen with deep amber-gold irides and feathered talons.',
      'Fig. 2: Detail of barbed flight feather showing silent acoustic fringing.',
      'Fig. 3: Heavy tundra egg clutch with lichen scale.',
    ],
    colorTheme: {
      primary: '#64748B',
      accent: '#F59E0B',
      plumageGlow: '#FDE68A',
    },
    svgType: 'snowy-owl',
  },
  {
    pageNumber: 60,
    order: 'Order APODIFORMES',
    family: 'Family TROCHILIDAE (Hummingbirds)',
    commonName: 'Ruby-throated Hummingbird',
    scientificName: 'Archilochus colubris',
    length: '3.5 inches (8.9 cm) • Weight: 3.2 grams',
    nestNotes:
      'A marvel of animal architecture—scarcely larger than a walnut shell, fashioned of plant down and spider gossamer, shingled with green tree lichens.',
    rangeNotes:
      'Breeds across North America east of the 100th meridian; makes a non-stop 500-mile flight across the Gulf of Mexico each autumn.',
    eggCount:
      '2, pure dead-white, resembling tiny white navy beans (0.50 x 0.35 in).',
    plateType: 'text',
    description: [
      'Male: Upperparts lustrous metallic emerald green; gorget (throat patch) brilliant ruby-red flashing with iridescent gold in direct sunlight.',
      'Wings beat up to 75 times per second, producing the distinctive bee-like hum that gives the family its name.',
      'Frequents scarlet and tubular flowers: columbine, trumpet creeper, cardinal flower, and fuchsia, sipping nectar and capturing tiny spider mites.',
    ],
    colorTheme: {
      primary: '#15803D',
      accent: '#DC2626',
      plumageGlow: '#EF4444',
    },
    svgType: 'hummingbird',
  },
  {
    pageNumber: 61,
    order: 'Plate XXIV',
    family: 'Family TROCHILIDAE',
    commonName: 'Ruby-throated Hummingbird at Trumpet Vine',
    scientificName: 'Archilochus colubris • Campsis radicans',
    plateType: 'plate',
    length: 'Hovering flight studies at life scale (1:1)',
    nestNotes:
      'Lichen nest attached to down-sloping birch branch with spider silk.',
    description: [
      'Fig. 1: Male hovering before scarlet trumpet blossoms.',
      'Fig. 2: Natural scale nest with two miniature white eggs.',
      'Fig. 3: Micro-feather anatomy of the iridescent gorget scales.',
    ],
    colorTheme: {
      primary: '#16A34A',
      accent: '#E11D48',
      plumageGlow: '#F43F5E',
    },
    svgType: 'hummingbird',
  },
  {
    pageNumber: 74,
    order: 'Colophon & Index',
    family: 'Systematic Index of North American Genera',
    commonName: 'Archival Plate Index & Concordance',
    scientificName: 'Index Generum Avium • Chester A. Reed (1915)',
    isIndex: true,
    plateType: 'index',
    description: [
      'Total illustrated species in complete work: 768 species, 480 color lithographic plates.',
      'Digitized from the original 1915 impression housed at the Worcester Public Library Archive.',
      'Original presswork: Doubleday, Page & Co. utilizing the four-color halftone litho process on 90lb deckle-edge coated rag stock.',
      'Interactive Folio Remastering: Kitsu Lab Research Suite (2026).',
    ],
    colorTheme: {
      primary: '#2C2523',
      accent: '#8A5A36',
      plumageGlow: '#D4AF37',
    },
    svgType: 'index',
  },
]
