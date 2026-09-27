# Reader and campaigns: review and product direction

## Decision brief

The intended product serves both developers/agencies buying components and businesses operating a hosted campaign dashboard. Impact Coaching Center (ICT) and course-selling projects are the first concrete integration targets. Success means attributable qualified enquiries, confirmed enrolments and paid orders, alongside a reliable reading experience. More popups or clicks alone do not establish success.

Recommended direction: a shared, framework-independent campaign contract and delivery rules, installable React surfaces, a hosted publishing/reporting service, and project-owned adapters. Keep the standalone component path useful without a hosted subscription. Keep all existing reader modes available, with lightweight defaults appropriate to each deployment.

This is a review and proposed roadmap, not a claim that a hosted product or ICT integration is implemented.

## Review scope and evidence

GitHub PR heads inspected:

| PR  | Scope                                           | Head inspected |
| --- | ----------------------------------------------- | -------------- |
| #3  | Reader engines, annotations, AI, sharing        | `2a151372`     |
| #7  | Reader layout, resume, selectors, browser tests | `986fdb04`     |
| #5  | Promotions, experiments, editor, paid registry  | `bf59d2fe`     |
| #6  | Payments, pricing and licensing                 | `c121e82`      |

PR #5 includes the work from #4; do not merge both as independent feature sets. #7 stacks on #3, and #6 stacks on the promotions branch. These stacks overlap in the reader, generated registry, layout and package files; integration needs a deliberate combined validation pass.

Local branches were newer than those GitHub snapshots. The review compared their follow-up changes: reader browser CI, upload limits, source hashing and opt-in prefetch already have local work. Do not reimplement those as missing features. The corrective worktree starts at promotions `162da0f`, including the newer timeline/collision checks. Its provider still reproduced the four defect categories below.

Baseline verification: reader snapshot 143 unit tests passed using workspace dependencies; promotions snapshot 101 promotion/lib tests passed; payments snapshot 19 lib tests passed. The newer promotions worktree baseline passed 199 tests. None of these runs qualifies the combined release, a real device, fresh registry installation or payment-provider integration.

## Standards review

No consequential hard violation of the supplied repository conventions was established. The following are behavior defects, not style objections.

1. **P1: conversions lose their assigned variant.** `components/promotions/promotion-provider.tsx`, original lines 1001–1014, selects the raw source record for `convert`; assignment exists on a derived record. A visitor shown B produces a conversion without B. A provider regression test reproduced this. The corrective pass resolves the variant from the existing stable seed. Campaign-level calls still select a representative record: attribution to the actual clicked/exposed surface, durable exposure history, experiment revision and revenue reconciliation remain work.
2. **P2: ineligible people enter the holdout denominator.** Original lines 1050–1058 check schedule and route but omit audience, plugin and conversion eligibility. The corrective pass applies availability checks to holdouts too. This repairs eligibility, but does not implement a complete causal experiment service: opportunity matching, sample-ratio checks and a defined analysis window remain necessary.
3. **P2: false viewable impressions.** Original lines 1198–1203 count `isIntersecting` as half visibility and allow a timer to finish in a hidden tab. The corrective pass requires at least 50% visibility continuously for a second, cancels when hidden or below threshold, and restarts on return. Tests exercise the real hook with browser-observer events.
4. **P2: account dismissal state crosses account boundaries.** Original lines 628–635 and 687–703 keep in-memory overrides after swapping the supplied account store. A dismisses an offer; B wrongly inherits it. The corrective pass binds overrides to their store and tests switching A → B → A.

## Reader specification review

The separate reader corrective branch fixes findings 1 and 3. The campaign branch does not modify reader behavior. Findings 2 and 4 remain follow-up work.

1. **P2: Ask retains a passage from another document.** At the reader snapshot, `book-preview.tsx:469–471` preserves `askSeed` when no new selection is supplied. `book-preview-companion.tsx:575–576,637–642` then combines the old passage/page with the new document title and text. Reproduction: Ask about a selection in A, close, replace the source with B, reopen Ask. Reset/source-tag the seed and abort requests on document change. The README promises answers grounded in the passage/page.
2. **P2: the “One” preference is ignored by flat spread views.** `book-preview-reading-settings.tsx:71` promises “Always one page”; `engines/spread-engine.tsx:326–327` and `engines/premier-views.tsx:615–617` read the cover preference but not the spread preference. Curl does respect it. Apply one shared layout decision across engines or accurately scope the control.
3. **P2: controlled persistence still writes.** README:53 says persistence/deep links are inert for controlled props. `hooks/use-reader-preferences.ts:55–58` still writes controlled mode/appearance; `hooks/use-page-memory.ts:143–146` still updates history for a controlled page. Guard writes as well as restoration; test controlled and uncontrolled readers together.
4. **Inherited navigation defect:** WebGL uses sheet coordinates as document coordinates. `engines/webgl-engine.tsx:251` reports sheet count, causing shared state to clamp. A seven-page reducer roundtrip reproduced page index 6 → 4 → 4 when switching page → WebGL → page. Map internal sheet coordinates to canonical document locations. This predates these PRs; new sharing/resume features make its impact broader.

Axis totals: four standards/correctness findings (worst: lost conversion variant); three reader spec findings (most consequential: document context leakage into Ask), plus one inherited reader issue.

## Paid-launch blockers

- **License validity is not product entitlement.** `lib/dodo.ts:53–62` trusts a public `{ valid: true }` without binding the key to Kitsu's business/product. Dodo's [validation API](https://docs.dodopayments.com/api-reference/licenses/validate-license) exposes only validity; its [activation API](https://docs.dodopayments.com/api-reference/licenses/activate-license) provides business and product data. Missing binding is confirmed in code; a cross-merchant purchase exploit was not tested. Implement verified product-specific entitlements before accepting paid access. Do not activate a fresh seat on every registry request.
- **Define what is being sold.** Pro source is in the public repository and README says MIT, while the pricing page sells gated installs. A paid installer does not make public source exclusive. Choose an explicit open-core/support/template model or a private future Pro distribution; align repository notices and buyer terms. Moving files later does not erase previously published source.
- **Separate lifetime use from updates.** A year-expiring key should not silently redefine what “lifetime” means. Specify installed-code use, eligible archived releases, future updates, reinstalls, team seats and support. Hosted service access has ongoing costs and needs its own subscription terms.
- **Qualify the actual buyer lifecycle.** Test purchase → entitlement → registry install, renewal, expiry, cancellation, refund, duplicate webhook and provider outage. In-memory webhook dedupe/cache invalidation is process-local, not a distributed revocation system. No live/test-mode purchase was performed in this review.

## What to inherit from established systems

| Reference                                                                                          | Principle to adopt                                               | Kitsu application                                                                                           |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [Braze global control groups](https://www.braze.com/docs/user_guide/audience/global_control_group) | Compare messaging impact against a persistent control population | Separate campaign eligibility, assignment, opportunity/exposure and conversion; measure incremental results |
| [Braze frequency capping](https://www.braze.com/resources/articles/whats-frequency-capping)        | Manage total contact pressure across campaigns                   | Existing per-campaign limits plus coordinated global limits and suppression after purchase                  |
| [PostHog experiment tooling](https://posthog.com/docs/experiments/no-code-web-experiments)         | Explicit exposure criteria and configured outcome metrics        | Analytics adapter and experiment configuration, with a primary metric and guardrails                        |
| [Readium locators](https://readium.org/architecture/models/locators/)                              | Document locations independent of display layout                 | Stable position, annotations and share targets across reader engines and document revisions                 |

These are design precedents, not evidence that copying them guarantees higher conversion. Establish a baseline, test hypotheses and retain improvements supported by outcomes.

## First customer journey: ICT

Current ICT docs were read directly during this review, including ADRs 0001–0003, Classplus integration research and `convex/checkout.ts`.

- Courses are purchased on **Classplus**. Record an enrolment handoff, then redirect to the supported course destination. A handoff is not a sale. The existing integration research leaves supported API/webhook access account-dependent; absent verified integration, use staff reconciliation/import and label outcomes accordingly.
- Physical books use the site's **Razorpay** path. Current checkout code explicitly calls payment a prototype and creates `awaiting_payment`; verified payment is still a separate gate. Campaign revenue must come from trusted server confirmation, including later refunds.
- Free resources use **pre-rasterized page images** to suit budget Android devices and slower Assam connections. Add responsive image-page support and an accessible text companion. Keep PDF/WebGL bundles out of that path. Do not imply that image delivery prevents copying.
- Preserve ICT's **Person** model and WhatsApp verification rules. Enquiries remain ungated; resource access follows the project's verification policy. A resource request or OTP is not automatically marketing permission.
- Existing ICT schema already has a campaign identifier on enquiries. Extend the existing model and staff workflow rather than creating a disconnected lead database.

Proposed examples:

| Visitor context               | Helpful campaign                                       | Recorded outcome                                       |
| ----------------------------- | ------------------------------------------------------ | ------------------------------------------------------ |
| Reads an exam-specific sample | Related batch, syllabus and next start date            | Qualified course enquiry; Classplus handoff separately |
| Returns to a course page      | Resume research, batch details, counselling option     | Counselling request/booking; confirmed enrolment later |
| Reads a physical book sample  | Relevant book, delivery/collection details, buy action | Verified paid book order and net revenue               |
| Already bought/enrolled       | Relevant preparation resources and onboarding          | Successful resource use; suppress acquisition discount |

Use genuine dates, availability and verified student evidence. Begin with inline offers and contextual sticky actions; interrupt only when the offer warrants it. The first comparison should test helpfulness and relevance, not simply more urgency or more discounting.

## Product structure and alternatives

**Recommended: shared components + hosted service + adapters.** Developers can self-host, businesses can publish without deployment, and agency installations retain common contracts. This best matches the requested two audiences, but requires explicit versioning and tenancy from the start.

**Alternative: components only.** Fastest path to a supported paid library; customers provide their own data/analytics. Does not meet the hosted-dashboard objective.

**Alternative: hosted-only builder.** Simpler central operations, but gives up much of the installable, code-owned value and makes every client depend on the service.

The shared design should contain:

1. **Campaign contract:** tenant/site, campaign revision, objective, audience rule, schedule/time zone, variants, placement, CTA and suppression policy. Publish immutable validated snapshots with a rollback pointer.
2. **Delivery:** consume a snapshot through the existing source loader, evaluate rules, coordinate interruptions, expose reasons an offer was/wasn't shown. Sites keep a last-known-good snapshot with an explicit expiry so outages do not revive stale offers.
3. **Hosted dashboard:** workspaces/sites, owner/editor/viewer permissions, campaign drafts, preview against page/device/segment/time, publish/pause/rollback and audit history. Reuse the existing editor and new timeline/collision work.
4. **Measurement:** separate assignment, eligible opportunity, viewable impression, click, enquiry, handoff, checkout and verified purchase. Include event ID, event time, campaign/experiment revision, stable pseudonymous assignment, originating exposure and trusted order reference. Deduplicate server events. Show gross revenue, refunds and attribution confidence separately.
5. **Project adapters:** ICT/Classplus handoffs, Razorpay outcomes, Person/lead updates, generic checkout callbacks and analytics. Keep client routes, credentials, copy and business policy outside the shared registry.

Keep personal CRM details in the customer's application. Browser events are untrusted and must never grant paid access, set an order to paid or establish a verified enrolment.

## Reader improvements that support the product

- Fix canonical location and document isolation before expanding modes. Preserve all modes; choose a sensible default for each customer's hardware and content.
- Finish responsive image-page fidelity, accessible text, thumbnails/contents/search where the source supports them, keyboard navigation and RTL/localized chrome. These are capability-specific requirements, not promises every image has searchable text.
- Add narrow host events for document opened, meaningful reading progress, sample completed and CTA intent. Define active reading using visibility and dwell; do not count every page animation as engagement.
- Offer a useful sample before a contextual next step. Put offers at natural pauses or the sample boundary; don't cover the text while someone reads.
- Support source-scoped note export and optional account sync. Version content identities so signed URL rotation doesn't lose progress and replaced editions don't inherit misplaced notes.
- Keep AI opt-in: explain selected text, summarize a page, generate practice questions, cite the supporting page. Ask should say when it lacks evidence; scanned image pages need accessible text/OCR before grounded answers are possible.

## AI that can help sell and operate

Start with a campaign assistant that proposes drafts from verified product/batch data, checks dates/links/claim consistency, suggests a small number of variants and explains where users drop out. A human approves publication. Add translation review, experiment summaries and prioritization after reliable analytics exists.

Do not let AI invent discounts, testimonials, seats remaining or statistical certainty. Do not autonomously optimize for clicks while ignoring paid outcomes, refunds, margin or complaints. Keep model credentials server-side and enforce per-tenant budgets.

## Delivery order and acceptance gates

1. **Correctness pass (started):** provider attribution/eligibility/viewability/account isolation, then reader context/layout/navigation fixes. Add meaningful regression coverage and regenerate registries.
2. **One ICT outcome path:** source snapshot → rendered campaign → contextual CTA → enquiry/handoff/order → verified outcome. Prove the handoff boundary, no duplicate orders/events, purchaser suppression and graceful failures.
3. **Hosted publishing MVP:** tenant/site isolation, existing editor, draft/publish/pause/rollback, audit history, delivery API, small funnel report and billing/entitlements. Automated cross-tenant denial tests are mandatory.
4. **Commercial release:** clean Base UI registry-install fixture; current combined branch check/build/registry gates; browser tests including WebKit/Firefox; real Android/iOS/tablet checks; purchase/refund/install lifecycle; documented support and update policy.
5. **Optimization:** holdouts and experiment revisioning, analytics adapters, AI draft assistance and broader kits, driven by observed customer demand.

Suggested product metrics: time to first working installation, time to first published campaign, qualified enquiry rate, verified purchase/enrolment rate, incremental net revenue per eligible visitor, dismissals/complaints, rendering failures and support burden. Component licence revenue and hosted recurring revenue must be tracked separately from customers' campaign revenue.

Pricing is a hypothesis at this stage. Keep free core installation credible; sell production kits/support/update access to developers and ongoing publishing/reporting/collaboration to hosted customers. Validate willingness to pay with a few actual agency and education customers before committing to lifetime promises or a large tier matrix.

## Corrective implementation and verification

Two isolated worktrees preserve the original PR branches:

- `/tmp/kitsu-campaign-hardening`, branch `codex/campaign-measurement-hardening`, base `162da0f`: four provider corrections above; development-only Happy DOM tests mounting the real provider; registry CLI pinned to 4.21.0 because the inherited script referenced an uninstalled executable. Public provider artifact regenerated; both registries build.
- `/tmp/kitsu-reader-hardening`, branch `codex/reader-context-hardening`, base `6477a0e`: source-scoped companion state, companion remount to invoke existing streaming abort cleanup, controlled preference/page persistence guards; extracted hook included in the registry and generated artifacts.

Both branches passed `npm run check`, `npm run build`, and `npm run registry:build`. Promotions: 204 tests; reader: 147 tests. Existing lint warnings remain; these are not warning-free projects. Independent review found no blocker in either corrective diff and independently reran the focused tests. The reader production Chrome suite passed 21 tests, with 13 layout-specific skips. Its phone project emulates a phone in Chromium; it is not a real iPhone or Safari test.

The DOM regressions were observed failing before the corresponding fixes. They exercise actual React hooks/providers, with observer events supplied by a test double. They do not substitute for real mobile hardware, a streaming AI provider, verified checkout or a clean consumer installation. The current React Doctor CLI declined to scan without project installation; no health score is claimed and no unrelated Doctor setup was added.

Outstanding release blockers remain: product-bound paid entitlements, commercial distribution/terms, historical and multi-surface campaign attribution, experiment opportunity matching, flat-spread preference consistency, WebGL canonical locations, and the actual hosted/ICT integration. No merge, deployment, payment or external customer message was performed.
