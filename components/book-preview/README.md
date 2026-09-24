# Book Preview

`BookPreview` is a shadcn registry component for page data and PDFs. The core install contains the accessible shell and lightweight page reader; heavier engines are separate registry items and load only when selected.

## Install

This registry targets shadcn's Base UI styles (`base-*`, including `base-nova`). After the registry is deployed:

```bash
npx shadcn@latest add https://kitsulab.vercel.app/r/book-preview.json
```

Add only the engines the product needs:

```bash
npx shadcn@latest add https://kitsulab.vercel.app/r/book-preview-curl.json
npx shadcn@latest add https://kitsulab.vercel.app/r/book-preview-pdf.json
npx shadcn@latest add https://kitsulab.vercel.app/r/book-preview-scroll.json
npx shadcn@latest add https://kitsulab.vercel.app/r/book-preview-spread.json
npx shadcn@latest add https://kitsulab.vercel.app/r/book-preview-archival-curl.json
npx shadcn@latest add https://kitsulab.vercel.app/r/book-preview-premier.json
npx shadcn@latest add https://kitsulab.vercel.app/r/book-preview-webgl.json
```

`book-preview-engines.json` is a convenience bundle for demos that genuinely need every mode. Production apps should prefer individual engine items to avoid installing unused PDF, page-flip, or Three.js packages.

## Core usage

```tsx
import { BookPreview } from '@/components/book-preview'

const source = {
  title: 'Field Notes',
  author: 'A. Reader',
  pages: [
    { id: 'cover', pageNumber: 1, title: 'Field Notes', isCover: true },
    { id: 'p-2', pageNumber: 2, paragraphs: ['The first entry.'] },
  ],
}

export function Reader() {
  return (
    <BookPreview
      source={source}
      persistPage
      persistPreferences
      pageParam="page"
    />
  )
}
```

`persistPage` remembers the reading position per source, `persistPreferences` remembers appearance, reader mode, and engine-level settings like PDF zoom, and `pageParam="page"` deep-links `?page=12` — applied once per source on open, then kept current with `history.replaceState`. All three are opt-in and inert while the matching prop is controlled.

## Shareable links

`urlState` mirrors the reader into the query string — `?page=12&mode=premier&view=spread&theme=sepia` — so a copied link or a refresh reopens exactly the same view. Writes use `history.replaceState` (no back-stack spam). Pass an object to rename or pick keys: `urlState={{ page: 'p', mode: 'reader' }}`. The older `pageParam` prop still works.

## Fullscreen and layout

Fullscreen floats the toolbar and pager over the page and fades them out after a short idle. Moving the mouse, nearing an edge, tabbing, or tapping the middle of the page brings them back; page turns never do. Native fullscreen targets the document, so menus, sheets and tooltips keep working inside it. `layout="fill"` stretches the reader to its parent's height for app shells and dedicated reader routes.

## Reading settings

One "Aa" popover holds paper (match site, paper, sepia, dusk, night), type size, typeface (serif, sans, a legibility face, mono), line spacing, measure, justification and page-turn sound. Size, spacing and measure reflow text pages and the premier Text view; PDF scans keep their own type. `defaultTypography` seeds it, `persistPreferences` remembers it, `onTypographyChange` reports it.

## Highlights, notes and bookmarks

Select any passage on a text surface to highlight it in one of four inks, add a note, copy it, or ask about it. Tap a highlight to recolour, annotate or delete it. `B` bookmarks the page (a ribbon marks it). The notebook sheet lists everything by page, filters by ink, notes or bookmarks, and exports Markdown.

Highlights are anchored by text quote (the exact words plus a little context, W3C TextQuoteSelector style), not DOM positions, so they survive zoom, view switches, reloads and devices. They are painted with the CSS Custom Highlight API, which never touches the engine's DOM.

```tsx
// Local only — remembered per document, kept in step across tabs.
<BookPreview source={source} persistAnnotations />

// Synced — you own storage. Every record has an id and createdAt/updatedAt
// for last-write-wins merging.
<BookPreview
  source={source}
  annotations={annotations}
  onAnnotationsChange={(next) => {
    setAnnotations(next)
    void saveToServer(documentId, next)
  }}
/>
```

### Drawing

Press `D` (or the pen button) to draw on the page: pen, marker and eraser, five inks, undo with `mod+Z`, `Esc` to put the pen down. Strokes are stored page-relative (0–1 coordinates, width as a fraction of page width) in the same notebook as highlights, so they land in the same place at any zoom, in every flat view, and on every device. Once a stylus touches the page, finger contacts are ignored (palm rejection), and coalesced pointer events keep fast pen strokes smooth. Engines opt page-sized surfaces in with `data-bp-inkable` + `data-page-index` (premier single, spread and scroll faces and the pdf stage do); the flip book and the text view reflow or move their pages, so they show no ink.

`annotate={false}` turns highlighting and drawing off for read-only previews. Engines opt page surfaces in with `data-bp-annotatable` + `data-page-index` (premier faces, the PDF text layer and page leaves already do).

## Ask (AI)

Pass an `ai` adapter and the selection card and companion sheet gain **Ask**: questions about a passage or the page, grounded in the page text, streamed back. The reader never calls a vendor itself — adapters decide where the question goes.

```tsx
import {
  chainAiAdapters,
  createBuiltInAiAdapter,
  createFetchAiAdapter,
  createOpenAICompatibleAdapter,
} from '@/components/book-preview'

// On-device first (Chrome's built-in model: private, free, offline), then a
// local Ollama server, then your own route for everyone else.
const ai = chainAiAdapters(
  createBuiltInAiAdapter(),
  createOpenAICompatibleAdapter({
    baseUrl: 'http://localhost:11434/v1', // OLLAMA_ORIGINS=* ollama serve
    model: 'llama3.2',
  }),
  createFetchAiAdapter({ url: '/api/ask' }),
)

<BookPreview source={source} ai={ai} />
```

`createFetchAiAdapter` POSTs `{ question, selection, pageIndex, pageText, title, author, prompt: { system, user } }` to your route and streams the plain-text response body back — the route holds the API key and picks the model. Write any adapter by implementing `{ label, isAvailable?, ask(request, { signal }) }` returning a string promise or an async iterable of chunks.

## Compose optional engines

Engine descriptors are deliberately separate from their implementation. Importing a descriptor does not eagerly import its renderer or heavyweight dependency.

```tsx
import { BookPreview, pageEngine } from '@/components/book-preview'
import { curlEngine } from '@/components/book-preview/engines/curl-engine.meta'
import { pdfEngine } from '@/components/book-preview/engines/pdf-engine.meta'

const engines = [pageEngine, curlEngine, pdfEngine]

export function DocumentReader() {
  return (
    <BookPreview
      source={{ pdfUrl: '/manual.pdf', allowPdfUpload: true }}
      engines={engines}
      enabledModes={['curl', 'pdf']}
      defaultMode="pdf"
    />
  )
}
```

PDF URLs must be same-origin or return suitable CORS headers. WebGL is progressively enhanced: capability detection runs after hydration so SSR markup stays deterministic.

With `allowPdfUpload`, the toolbar gains an Open button and the reader surface accepts dropped PDFs. An uploaded file becomes an object URL owned by the shell — it opens in every compatible engine, not just pdf mode, and is revoked when the document or component goes away. Uploaded PDFs stay in the browser.

When the requested mode cannot render a source, the reader falls back by document kind: `pdf` → `scroll` for PDF sources, `page` for page data. Listen to `onModeFallback` if the host wants to announce the switch.

## Controlled state

`mode`, `pageIndex`, `appearance`, and `sound` can each be controlled or uncontrolled. Pair a controlled prop with its callback. Keyboard navigation is immediate; deliberate button and programmatic turns retain directional motion. Nested inputs, sliders, menus, and buttons keep ownership of their own keys.

When pages use custom `render` functions, pass `source.revision` and change it whenever the rendered content changes. Serializable title, author, PDF, and page content are included in source identity automatically.

## Performance expectations

- The page engine is the default and has no PDF, page-flip, or Three.js dependency.
- Optional engines use dynamic imports and production-only idle prefetching.
- The pdf engine opens at fit-width, renders only the current page, and keeps a selectable text layer over the canvas. It adds whole-document search (`/` or `mod+F`, matches highlighted in the text layer), the document outline as the contents menu, a lazy thumbnail rail (bottom sheet on narrow screens), pinch zoom, rotation, a fit-width/fit-page toggle, cursor-centered double-click zoom, `+`/`-`/`0` zoom keys, and clickable in-document links — internal destinations turn pages, external urls are protocol-sanitized and opened in a new tab. A horizontal swipe turns the page when it already fits (the same drag pans once zoomed), a hand-tool toggle and middle-button drag pan with the mouse, and password-protected documents prompt in place.
- Password-protected PDFs prompt in place rather than erroring; a wrong password retries, and cancelling reports a retryable state. The same gate covers scroll, curl, archival-curl, and premier modes.
- The scroll engine keeps a bounded raster window around the reading position; pages that fall behind are revoked and re-rendered on return, so long documents do not hold every bitmap at once. Scroll, curl, and archival-curl all surface the document outline in the contents menu.
- The premier engine is the flagship book: five remembered views — the full curl stage (corner drag, tap zones, edge stacks, page-turn sound), a single-page view, a two-page spread, a continuous scroll, and a bitmap-free text flow — plus whole-document search (a background pass indexes page text even outside the raster window), zoom, thumbnails, the PDF outline as contents, and continuous read-aloud that turns its own pages and skips silent leaves. PDF faces in the flat views wear a live overlay — pdf.js's selectable text layer plus link annotations at the measured display scale — so a document copy stays selectable and linked without a live canvas. Page data and PDFs alike; the flat views rasterize only a window around the reading position, so documents past `CURL_MAX_PAGES` still read there while the flip book bows out.
- Curl engines paint every leaf up front, so PDFs over `CURL_MAX_PAGES` (160) fail with a message pointing at the bounded modes instead of hanging the tab. The resting book sits on a soft shadow with fore-edge page stacks that thin as leaves move to the other side, corners lift on hover to teach the drag, and tap zones flip from either edge.
- PDF raster density is capped to avoid high-DPR memory spikes; object URLs, PDF workers, and password-pending load tasks are released on teardown.
- The premier flat views fit each face to both axes of the stage with container units, so pages use the full height in fullscreen and never overflow narrow screens. A programmatic jump in the continuous views (deep link, contents, search) is not undone by the faces the smooth scroll passes on the way.
- Escape closes the reader's own overlays (search, thumbnails) before it exits immersive mode, and pointer clicks on reader controls return focus to the reader so arrow keys keep working.
- WebGL pauses when the document is hidden or the reader is offscreen and releases renderer, textures, geometry, and context on teardown.
- Reduced-motion disables travel, shadows, page-corner flourishes, and continuous WebGL animation.

The current page-flip adapter intentionally stays in single-leaf orientation. Its landscape mode can enter a synchronous loop in the upstream layout engine and freeze the tab. Do not enable `CURL_SPREAD_ENABLED` until that upstream behavior is replaced or verified fixed; the separate spread engine provides stable facing-page reading meanwhile.

Validate the registry before publishing:

```bash
bun run test
bun run typecheck
bun run lint
bun run build
npx shadcn@latest build
npx shadcn@latest add ./public/r/book-preview.json --dry-run
```

Automated checks do not prove Safari, iOS, Android, screen-reader, or low-memory-device behavior. Run real-device keyboard, touch, pinch/zoom, fullscreen, PDF upload, and reduced-motion checks before making cross-platform guarantees.
