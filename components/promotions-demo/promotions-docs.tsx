'use client'

import * as React from 'react'
import { IconCheck, IconCopy } from '@tabler/icons-react'
import { cn } from '@/lib/utils'

type Doc = {
  item: string
  name: string
  tier: 'Core' | 'Surface' | 'Add-on' | 'Kit'
  /** Installs from the authenticated `@kitsu-pro` registry. */
  pro?: boolean
  summary: string
  code: string
  notes: string[]
}

const DOCS: Doc[] = [
  {
    item: 'promotions',
    name: 'Free core',
    tier: 'Core',
    summary:
      'Rules, provider, stores, plugins, label packs, and the bar, card, badge, toast and dialog.',
    code: `// app/providers.tsx
'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { PromotionProvider, promotionLabels } from '@/components/promotions'

export function Promotions({ records, children }) {
  return (
    <PromotionProvider
      source={records}
      pathname={usePathname()}
      linkComponent={Link}
      labels={promotionLabels.en}
      suppressOn={['/checkout', '/login']}
      onEvent={(e) => analytics.track(\`promo_\${e.type}\`, e)}
    >
      {children}
    </PromotionProvider>
  )
}`,
    notes: [
      'Records are plain JSON. Validate editor input with parsePromotion on the server too.',
      'A { load } source runs once per mount; change sourceKey to reload.',
      'Keep the plugins array stable: define it outside render.',
    ],
  },
  {
    item: 'promotions-pro',
    pro: true,
    name: 'Pro registry',
    tier: 'Core',
    summary:
      'Every pro add-on. Pro items install from an authenticated registry with your key.',
    code: `// components.json
"registries": {
  "@kitsu": "https://kitsu-lab.vercel.app/r/{name}.json",
  "@kitsu-pro": {
    "url": "https://kitsu-lab.vercel.app/pro/r/{name}.json",
    "headers": { "Authorization": "Bearer \${KITSU_PRO_KEY}" }
  }
}

// .env.local (never commit it)
KITSU_PRO_KEY=kp_…

// then import pro pieces from one place
import { PromoSideCard, storeSaleKit } from '@/components/promotions/pro'`,
    notes: [
      'The CLI reads KITSU_PRO_KEY from your environment and sends it as a bearer token.',
      'Pro items depend only on the free core, so each installs on its own.',
    ],
  },
  {
    item: 'promotion-account-store',
    pro: true,
    name: 'Account store',
    tier: 'Add-on',
    summary:
      'Dismissals that follow a signed-in visitor across devices, for dismiss.scope: "account".',
    code: `import { composeStores } from '@/components/promotions'
import { accountDismissalStore, fetchAccountTransport } from '@/components/promotions/pro'

// one store per signed-in account; close it when the user changes
const accountStore = useMemo(
  () => accountDismissalStore({
    accountId: user.id,
    transport: fetchAccountTransport('/api/promotions/state'),
    initial, // read on the server, so the first render already knows
  }),
  [user.id],
)
useEffect(() => () => accountStore.close(), [accountStore])
const storage = composeStores({ account: accountStore })

// app/api/promotions/state/route.ts
export async function GET(request: Request) {
  const user = await getUser()               // your auth
  if (!user) return new Response(null, { status: 401 })
  if (request.headers.get('x-promo-account') !== user.id)
    return new Response(null, { status: 409 })  // store is for another account
  return Response.json(await db.promoState(user.id))  // { [key]: epochMs }
}

export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return new Response(null, { status: 401 })
  if (request.headers.get('x-promo-account') !== user.id)
    return new Response(null, { status: 409 })
  const { changes } = await request.json()   // { [key]: epochMs | null }
  await db.mergePromoState(user.id, changes) // null deletes the key
  return new Response(null, { status: 204 })
}`,
    notes: [
      'Reads are instant from a local copy; writes are batched and sent again when the tab is hidden.',
      'On the server, accept only keys starting with promo: and finite numbers, and cap the count.',
      'Signed-out visitors: route account records to cookie until they sign in.',
      'The 409 check stops a store made for one user from writing into another user’s session after a switch in another tab.',
    ],
  },
  {
    item: 'promo-bar',
    name: 'Bar',
    tier: 'Surface',
    summary:
      'A one-line announcement, inline above the header or floating at the bottom.',
    code: `<PromoBar />                     // inline, above your header
<PromoBar variant="floating" />  // docked, never shifts layout`,
    notes: [
      'Use floating when Core Web Vitals matter, or read dismissals from a cookie on the server.',
    ],
  },
  {
    item: 'promo-pill',
    pro: true,
    name: 'Announcement pill',
    tier: 'Surface',
    summary:
      'The “New: … →” pill above a hero headline, filled from a card slot.',
    code: `<PromoPill slot="announcement" />
<h1>Plan the week your team actually has.</h1>`,
    notes: ['In the flow, never interrupts. Right for launches.'],
  },
  {
    item: 'promo-card',
    name: 'Card and carousel',
    tier: 'Surface',
    summary:
      'An inline card for a named slot. PromoCarousel shows every live card in the slot.',
    code: `<PromoCard slot="hero" dismissible />
<PromoCarousel slot="hero" label="Offers" />  // pro: several campaigns, one place`,
    notes: [
      'Cards lay out from their own width (container queries).',
      'A record with gallery shows a swipeable image carousel. Nothing auto-advances.',
    ],
  },
  {
    item: 'promo-toast',
    name: 'Toast',
    tier: 'Surface',
    summary:
      'A corner card after light engagement. Minimise folds it into a chip; swipe or Escape dismisses.',
    code: `<PromoToast />            // bottom end corner
<PromoToast side="start" />`,
    notes: ['Never takes focus. Sits above a docked sticky CTA on phones.'],
  },
  {
    item: 'promo-sheet',
    pro: true,
    name: 'Offer sheet',
    tier: 'Surface',
    summary:
      'An edge tab that opens a swipeable offer sheet, with a revealable code and an apply link.',
    code: `<PromoSheet />                  // right edge, bottom sheet on phones
<PromoSheet side="start" />`,
    notes: [
      'Opens only when asked, so it spends none of the interruption budget.',
    ],
  },
  {
    item: 'promo-dialog',
    name: 'Dialog',
    tier: 'Surface',
    summary:
      'The loudest surface: a centred dialog, or a swipe-down sheet on phones.',
    code: `<PromoDialog />`,
    notes: [
      'Once per frequency window, only after engagement, never over a form or another modal.',
    ],
  },
  {
    item: 'promo-side-card',
    pro: true,
    name: 'Side card',
    tier: 'Surface',
    summary:
      'A “what’s on” card in the page margin on wide screens; a 56px peek at the edge elsewhere.',
    code: `const main = useRef(null)
<main ref={main}>…</main>
<PromoSideCard content={main} />   // measures the real free space`,
    notes: [
      'Opens on hover, focus or tap when peeking; transform-only on the drawer curve.',
      'Several side cards become a pager. Hidden on phones by default.',
    ],
  },
  {
    item: 'promo-spotlight',
    pro: true,
    name: 'Spotlight',
    tier: 'Surface',
    summary:
      'Points at one feature, once, with a halo on the element and an anchored popover.',
    code: `const share = useRef(null)
<Button ref={share}>Share</Button>
<PromoSpotlight name="share" anchor={share} />
// record: { placement: 'spotlight', slot: 'share', … }`,
    notes: ['Never takes focus. Using the feature closes it as a conversion.'],
  },
  {
    item: 'promo-story',
    pro: true,
    name: 'Split and story dialogs',
    tier: 'Surface',
    summary:
      'presentation: "split" (free) puts images beside the copy; "story" (pro) is full screen with slides.',
    code: `import { PromoStory } from '@/components/promotions/pro'

<PromoDialog story={PromoStory} />

// record
{ placement: 'dialog', presentation: 'story', gallery: [...] }

// a story only opens when asked
<Button onClick={() => openPromotion('whatsnew')}>See what’s new</Button>`,
    notes: [
      'Stories pause while pressed, on hidden tabs and under reduced motion.',
      'Closing a story records nothing, so it can be watched again.',
      'Without the story prop, a story record opens as a centred dialog.',
    ],
  },
  {
    item: 'promo-inbox',
    pro: true,
    name: 'Offers inbox',
    tier: 'Surface',
    summary:
      'A gift button with a count that lists every live offer, one per campaign.',
    code: `<header>
  <Logo />
  <Nav />
  <PromoInbox />
</header>`,
    notes: [
      'Dismissed offers stay listed as hidden, so a discount is never lost.',
    ],
  },
  {
    item: 'promo-badge',
    name: 'Nav badge',
    tier: 'Surface',
    summary:
      'A “New” pill or dot beside a link while a live promotion points there.',
    code: `<Link href="/books">Books <PromoBadge href="/books" /></Link>`,
    notes: ['No record of its own and no animation.'],
  },
  {
    item: 'promo-progress',
    pro: true,
    name: 'Progress to a reward',
    tier: 'Surface',
    summary:
      '“€16 away from free shipping”. Standalone; pass the value, goal and reward.',
    code: `<PromoProgress
  value={cart.total}
  goal={50}
  reward="free shipping"
  format={(n) => euro.format(n)}
/>`,
    notes: ['Transform-only fill, polite live region.'],
  },
  {
    item: 'promo-sticky-cta',
    pro: true,
    name: 'Sticky CTA',
    tier: 'Surface',
    summary:
      'A thumb-zone bar that appears once the pricing card has scrolled away.',
    code: `const pricing = useRef(null)
<section ref={pricing}>…</section>
<PromoStickyCta slot="sticky" watch={pricing} />`,
    notes: ['Phones only by default. Floating surfaces rise above it.'],
  },
  {
    item: 'promotion-provider',
    name: 'Event triggers',
    tier: 'Core',
    summary:
      'Offers for a moment: open a toast, dialog or sheet when the visitor does something, like clicking Upgrade.',
    code: `// record: never opens by itself, only on its event
{ placement: 'dialog', title: '20% off your first year',
  include: ['/pricing'], triggers: ['upgrade-intent'], frequency: { hours: 24 } }

// in React: true when an offer opened
const { trigger } = usePromotions()
<Button onClick={() => trigger('upgrade-intent') || router.push('/checkout')}>
  Upgrade
</Button>

// anywhere else: analytics, a payment callback, a web component
import { triggerPromotion } from '@/components/promotions'
triggerPromotion('plan:limit-reached')`,
    notes: [
      'The visitor just acted, so the engagement wait and daily budget are skipped.',
      'Dismissals and frequency still apply: it gets one chance, then the button just works.',
      'Event names are short and lowercase; : _ and - are allowed.',
    ],
  },
  {
    item: 'promotion-provider',
    name: 'Plugins',
    tier: 'Add-on',
    summary: 'Extra triggers and rules without growing the provider.',
    code: `import { exitIntent, idle, excludeCampaigns } from '@/components/promotions'

const plugins = [
  exitIntent({ placement: 'dialog' }),
  idle({ placement: 'toast', ms: 20_000 }),
  excludeCampaigns(() => purchased),
]

<PromotionProvider plugins={plugins} … />`,
    notes: ['A plugin is { name, allow?, setup?, onEvent? }.'],
  },
  {
    item: 'promotion-provider',
    name: 'Stores',
    tier: 'Add-on',
    summary:
      'Route each promotion’s dismissal to the tab, the browser, a cookie or the account.',
    code: `import { composeStores, cookieDismissalStore } from '@/components/promotions'

const storage = composeStores({
  cookie: cookieDismissalStore(),
  account: accountStore,        // pro: see Account store
})

// on a record
dismiss: { mode: 'days', days: 7, scope: 'account' }`,
    notes: [
      'readPromotionCookies(header) lets a server render an inline bar with no layout shift.',
    ],
  },
  {
    item: 'promotion-labels',
    name: 'Languages',
    tier: 'Add-on',
    summary:
      'Label packs for six languages, record translations and right-to-left layouts.',
    code: `import { promotionLabels, createPromotionLabels } from '@/components/promotions'

<PromotionProvider locale="fr-CA" labels={promotionLabels.fr} … />

// your own language
const pt = createPromotionLabels('pt', { … })`,
    notes: [
      'Countdowns come from Intl.RelativeTimeFormat, so “tomorrow” and plurals are right.',
    ],
  },
  {
    item: 'promotion-kits',
    pro: true,
    name: 'Kits',
    tier: 'Kit',
    summary:
      'Ready-made campaigns: records that work together plus the provider settings they need.',
    code: `import { storeSaleKit } from '@/components/promotions/pro'

const sale = storeSaleKit({
  startsAt: Date.parse('2026-10-01T09:00:00+02:00'),
  id: 'autumn-26',
  routes: { shop: '/store', product: '/store/overshirt', cart: '/bag' },
  overrides: { bar: { title: 'Up to 40% off wool until Sunday' } },
  images: myProductShots,
})

<PromotionProvider source={sale.promotions} {...sale.provider} … />`,
    notes: [
      'storeSaleKit, productLaunchKit and courseEnrolmentKit. Each lists the slots it fills.',
    ],
  },
]

/** Copies a snippet and confirms briefly. */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <button
      type="button"
      aria-label={copied ? 'Copied' : 'Copy'}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1400)
        } catch {
          // Clipboard refused: the text is selectable.
        }
      }}
      className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/50 grid size-7 shrink-0 place-items-center rounded-md transition-[color,background-color,transform] duration-150 ease-out outline-none focus-visible:ring-3 active:scale-[0.96]"
    >
      {copied ? (
        <IconCheck aria-hidden className="size-4" />
      ) : (
        <IconCopy aria-hidden className="size-4" />
      )}
    </button>
  )
}

const TIER_CLASS: Record<Doc['tier'], string> = {
  Core: 'bg-foreground text-background',
  Surface: 'bg-muted text-foreground',
  'Add-on': 'bg-primary/10 text-primary',
  Kit: 'bg-primary text-primary-foreground',
}

/** Install commands and usage snippets for every surface, add-on and kit. */
export function PromotionsDocs() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground max-w-2xl text-sm">
        Each piece installs on its own with the shadcn CLI.{' '}
        <code className="font-mono text-xs">@kitsu/promotions</code> installs
        the free core; items marked Pro come from{' '}
        <code className="font-mono text-xs">@kitsu-pro</code> with your key.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {DOCS.map((doc) => {
          const install = `npx shadcn@latest add @${doc.pro ? 'kitsu-pro' : 'kitsu'}/${doc.item}`
          return (
            <article
              key={doc.name}
              className="border-border/60 flex min-w-0 flex-col gap-3 rounded-xl border p-4 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium">{doc.name}</h3>
                <span className="ms-auto flex gap-1.5">
                  {doc.pro ? (
                    <span className="rounded-full border border-current/20 px-2 py-0.5 text-[0.6875rem] font-medium">
                      Pro
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[0.6875rem] font-medium',
                      TIER_CLASS[doc.tier],
                    )}
                  >
                    {doc.tier}
                  </span>
                </span>
              </div>
              <p className="text-muted-foreground text-pretty">{doc.summary}</p>
              <div className="bg-muted/50 flex items-center gap-2 rounded-lg py-1 ps-3 pe-1 font-mono text-xs">
                <span className="min-w-0 flex-1 truncate">{install}</span>
                <CopyButton text={install} />
              </div>
              <div className="bg-muted/50 relative rounded-lg">
                <pre className="overflow-x-auto p-3 pe-10 font-mono text-xs leading-relaxed">
                  {doc.code}
                </pre>
                <div className="absolute end-1 top-1">
                  <CopyButton text={doc.code} />
                </div>
              </div>
              <ul className="text-muted-foreground flex list-disc flex-col gap-1 ps-4 text-xs">
                {doc.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </article>
          )
        })}
      </div>
    </div>
  )
}
