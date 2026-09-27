/**
 * The Kitsu Pro plans shown on /pro. Prices here are what the page says;
 * what the buyer is charged is the Dodo product's price, so keep the two
 * in step when you change one. Each plan's product id comes from the
 * environment, so test and live products never mix.
 */
export type ProPlanId = 'personal' | 'team' | 'monthly'

export type ProPlan = {
  id: ProPlanId
  name: string
  price: string
  cadence: string
  summary: string
  features: string[]
  /** Environment variable holding the Dodo product id. */
  productEnv: string
  highlight?: boolean
}

export const PRO_PLANS: readonly ProPlan[] = [
  {
    id: 'monthly',
    name: 'Pro monthly',
    price: '$12',
    cadence: 'per month, cancel any time',
    summary: 'Every pro component and kit while you subscribe.',
    features: [
      'All pro components, kits and the editor',
      'New components the month they ship',
      'One developer, unlimited projects',
    ],
    productEnv: 'DODO_PRODUCT_MONTHLY',
  },
  {
    id: 'personal',
    name: 'Lifetime',
    price: '$79',
    cadence: 'once',
    summary: 'Pay once, keep everything, with a year of updates.',
    features: [
      'All pro components, kits and the editor',
      '12 months of new components and fixes',
      'One developer, unlimited projects',
      'Keep what you installed forever',
    ],
    productEnv: 'DODO_PRODUCT_PERSONAL',
    highlight: true,
  },
  {
    id: 'team',
    name: 'Team lifetime',
    price: '$199',
    cadence: 'once, up to 5 developers',
    summary: 'The lifetime plan for a small team or agency.',
    features: [
      'Everything in Lifetime',
      'Up to 5 developers',
      'Client projects included',
      'Priority email support',
    ],
    productEnv: 'DODO_PRODUCT_TEAM',
  },
]

export function findPlan(id: unknown): ProPlan | null {
  return PRO_PLANS.find((plan) => plan.id === id) ?? null
}
