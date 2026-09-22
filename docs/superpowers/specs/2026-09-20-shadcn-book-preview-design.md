# Shadcn-Compatible Book Preview Redesign

Date: 2026-09-20
Status: Approved design

## Objective

Rebuild the current book-reader experiment as a reusable, accessible, performant shadcn-compatible component while preserving all six reader modes as optional engines. The default installation and initial render must remain lightweight. The project showcase may demonstrate every engine, but consumers must be able to install and use the core component without inheriting showcase copy, sample assets, WebGL, PDF.js, or page-curl dependencies they do not need.

## Current State

The current implementation is a client-only showcase containing six reader modes:

1. Archival Apple Curl
2. Archival 2-Up
3. Apple Curl
4. WebGL 3D Book
5. Kindle Lite
6. Live PDF

`BookReaderShowcase` imports all six modes and combines product copy, reader controls, theme state, audio state, mode selection, status badges, rendering engines, and a benchmark table. Its UI uses several existing shadcn primitives, but it is not yet portable because it relies on project routes and assets, eagerly references heavyweight engines, hard-codes presentation colors, repeats mode-panel markup, and does not expose a stable consumer API.

## Product Principles

- The reader should feel calm, direct, and tactile rather than theatrical.
- User input receives immediate feedback. Gesture-driven motion remains interruptible.
- Common navigation is simple; advanced capabilities appear only when supported by the active engine.
- The component adapts equally to phones, tablets, laptops, and desktops.
- Light, dark, and host-defined themes work through semantic tokens.
- Optional features remain optional in both runtime behavior and dependency cost.
- Accessibility and reduced-motion behavior are default capabilities, not add-ons.

## Architecture

### Core package surface

The primary public component is `BookPreview`. It accepts a normalized book source, a default or controlled mode, an allowed set of engines, appearance preferences, and capability callbacks.

```tsx
<BookPreview
  source={book}
  defaultMode="page"
  enabledModes={['page', 'curl', 'pdf']}
  appearance="system"
  sound={false}
/>
```

The public API must support controlled and uncontrolled navigation without exposing engine-specific implementation details. Consumer data is normalized into pages or an external document source. Engines report page index, total pages, readiness, errors, and supported capabilities through a shared adapter contract.

### Shared component structure

- `BookPreview`: public API, controlled/uncontrolled state, engine selection, and event callbacks.
- `BookPreviewProvider`: narrowly scoped shared state for descendants that cannot receive direct props cleanly.
- `BookPreviewToolbar`: mode selection, appearance, audio, fullscreen, download, and capability-dependent actions.
- `BookPreviewViewport`: stable aspect-ratio surface, focus ownership, keyboard scope, loading, errors, and engine mounting.
- `BookPreviewNavigation`: previous/next actions, page indicator, progress, and boundary states.
- `BookPreviewModePicker`: responsive shadcn control for switching enabled engines.
- `BookPreviewStatus`: accessible loading, unsupported, empty, and error feedback.
- `BookPreviewDemo`: project-only composition containing descriptive copy, all modes, sample data, and the comparison matrix.

Repeated headings, badges, panels, navigation controls, and status states become shared components driven by mode metadata.

### Engine adapter contract

Each engine implements a common contract similar to:

```ts
type BookPreviewEngine = {
  id: BookPreviewMode
  label: string
  capabilities: BookPreviewCapabilities
  load: () => Promise<React.ComponentType<BookPreviewEngineProps>>
  isSupported?: () => boolean
}
```

The engine component receives normalized source data and navigation state and emits navigation, readiness, and error events. It does not own global keyboard listeners, global theme state, or showcase copy.

The six existing modes remain available, but only the lightweight page reader is eligible to load by default. Curl, archival, PDF, and WebGL engines are loaded after explicit selection or opt-in prefetching.

## Shadcn Compatibility

The component will follow the existing project configuration: React Server Components enabled, Tailwind CSS v4, CSS variables, Lucide icons, and the configured aliases.

The reusable shell composes shadcn primitives instead of recreating them:

- `Button` for actions
- `ToggleGroup` for small mutually exclusive option sets
- `Tabs` only where tab semantics match visible content panels
- `Tooltip` for icon-only controls
- `DropdownMenu` or `Sheet` for responsive overflow controls
- `Collapsible` for the project-only comparison section
- `Table` for structured comparison data
- `Badge` for concise status labels
- `Alert`, `Empty`, and `Skeleton` for feedback states
- `Separator` where structural separation is required

Component variants use `class-variance-authority` where they represent a stable public variant. Conditional class composition uses the project `cn` helper. Layout classes may be supplied through `className`, while core component colors and typography remain semantic and internally consistent.

The registry item will declare its shadcn dependencies, npm dependencies, files, CSS requirements, and optional engine dependencies explicitly. It must not assume a route, bundled PDF, app font, registry entry, or global dark-only background.

## Data and State Flow

1. The consumer passes a normalized page collection, a PDF source, or supported engine source.
2. `BookPreview` resolves the enabled engines and selects a supported default.
3. The selected engine is dynamically imported and rendered within the stable viewport.
4. Shared controls call normalized navigation commands.
5. The engine reports page changes and capability state to the shell.
6. Controlled consumers receive events without the shell mutating controlled values.
7. Uncontrolled consumers use internal reducer state with predictable initialization and reset behavior when the source changes.

State that updates every pointer frame remains local to the interacting engine and must not travel through React context. Shared context is limited to low-frequency reader state.

## Performance Requirements

- Do not include Three.js, React Three Fiber, Drei, PDF.js, or react-pageflip in the initial core reader chunk unless the active engine requires them.
- Dynamically import each heavyweight engine at its boundary.
- Keep the viewport dimensions stable during engine loading and mode changes.
- Cancel obsolete PDF loading and render tasks when the source, page, or component changes.
- Revoke object URLs created for uploaded files.
- Dispose Three.js geometries, materials, textures, controls, and animation work on unmount.
- Pause expensive animation or rendering when the document is hidden and when practical when the reader is offscreen.
- Memoize expensive static page assets while avoiding memoization of trivial markup.
- Avoid parent-level per-frame state and inheritable CSS-variable updates for gesture coordinates.
- Use compositor-friendly `transform` and `opacity` for motion; do not animate layout properties.
- Avoid `transition-all`.
- Prefetch an optional engine only in response to meaningful intent, such as hover on a fine pointer or explicit configuration.
- Provide a capability-safe fallback for devices without WebGL, speech synthesis, fullscreen, or audio support.

## Interaction and Motion

Motion follows a restrained, tactile system:

- Press feedback uses `transform: scale(0.97)` with a 160ms response.
- Entering contextual surfaces use opacity plus a starting scale near `0.97`, never `scale(0)`.
- UI entry and exit use `cubic-bezier(0.23, 1, 0.32, 1)` and remain below 300ms unless a physical gesture requires a spring.
- Mode changes use a short crossfade that preserves viewport geometry. Keyboard-triggered page navigation remains immediate.
- Page gestures track the pointer one-to-one after a small intent threshold, capture the pointer, preserve the original grab offset, resist beyond boundaries, and hand release velocity into an interruptible spring.
- Visible bounce is reserved for momentum-driven page gestures. Ordinary controls use no bounce.
- Hover motion is restricted to fine pointers. Touch devices receive press feedback without sticky hover behavior.
- Persistent pulses and decorative ambient motion are removed from functional states.
- Audio is opt-in, synchronized to committed page movement, and never required for understanding.

Motion tokens belong in the component styling layer so all engines share durations and easing. Reduced motion replaces spatial movement with brief opacity or color feedback. Reduced transparency increases material opacity and removes blur. Increased contrast receives stronger boundaries and near-solid control surfaces.

## Responsive UX

### Phone

- The reader receives priority over descriptive content.
- Primary navigation targets are at least 44 CSS pixels.
- The toolbar exposes essential actions and places secondary controls in a bottom sheet or overflow menu.
- Page gestures and explicit navigation buttons both remain available.
- Controls do not overlay important page content without a dismissible or auto-hiding strategy.

### Tablet

- The reader remains centered with touch-reachable controls.
- Two-page layouts activate only when page size and orientation preserve legibility.
- Rotation and resize do not reset the current location.

### Laptop and desktop

- Full toolbar and mode controls may remain visible.
- Keyboard input works only while focus is within the reader.
- Pointer-only enhancements such as the loupe appear only when supported and do not obscure navigation.

## Accessibility

- The reader root has an understandable accessible label and documented keyboard behavior.
- Global keyboard listeners are removed. Scoped handlers do not capture keystrokes from inputs, textareas, selects, or editable content.
- All icon-only controls have accessible names and tooltips.
- Disabled navigation remains perceivable, correctly disabled, and excluded from misleading hover behavior.
- Loading, errors, uploads, unsupported modes, and meaningful page changes are communicated appropriately without excessive live-region announcements.
- Focus remains stable through mode and page changes and returns predictably after overlays close.
- Fullscreen and speech controls expose pressed or active state.
- Color is never the only signal for state.
- Text scaling and narrow layouts do not clip controls or essential content.

## Error and Capability Handling

The shell distinguishes between:

- unsupported engine or browser capability;
- engine loading failure;
- invalid or inaccessible source;
- PDF parsing or rendering failure;
- upload rejection;
- recoverable page rendering failure; and
- empty book data.

Errors use concise user-facing messages and preserve retry or fallback actions where meaningful. Engine exceptions are contained so one optional renderer cannot make the entire showcase unusable. The default fallback is the lightweight page reader when compatible page data exists.

## Demo and Content Separation

Project-specific content remains outside the reusable component:

- marketing-style headings and explanatory descriptions;
- benchmark and performance claims;
- the Chester Reed sample content;
- `/sample-book.pdf`;
- mode recommendation badges; and
- the exhibition page layout.

The demo may use the reusable API to present all six modes and a comparison section, but the registry component ships neutral defaults and honest capability labels. Unmeasured performance claims will not be represented as factual runtime guarantees.

## Testing and Verification

### Static and unit verification

- TypeScript passes without suppressions introduced by the redesign.
- The production build succeeds.
- Public types cover controlled and uncontrolled usage.
- Reducer and adapter behavior is tested for navigation, source changes, boundaries, and unsupported modes.
- PDF cleanup, uploaded object URL cleanup, and engine unmount cleanup receive focused tests where practical.

### Interaction verification

- Keyboard navigation is scoped to the focused reader and ignores editable controls.
- Pointer, touch, and button navigation agree on page state.
- Rapid reversals do not lock the UI or jump to stale gesture targets.
- Loading, retry, empty, unsupported, and error paths remain usable.
- Reduced motion, coarse pointer, and capability fallbacks behave correctly.

### Performance verification

- Bundle analysis confirms heavyweight optional dependencies are absent from the initial core-reader chunk.
- WebGL and PDF resources are released after leaving their modes.
- The default reader does not run continuous work while idle.
- Layout remains stable during engine loading and mode transitions.

### Visual and motion verification

- Inspect representative phone and desktop sizes in light and dark themes.
- Verify no clipped controls, unintended horizontal scrolling, or content-obscuring overlays.
- Review interactions in slow motion and frame-by-frame for easing, origin, and synchronized feedback.
- Perform the final motion review against the Emil Kowalski standards.
- Validate gesture feel on a real touch device when available.

### Registry verification

- Generate the registry item with explicit files and dependencies.
- Install it into a clean temporary shadcn fixture.
- Confirm aliases, CSS variables, imports, optional dependencies, and the minimal usage example work without project-specific files.

## Migration Strategy

1. Introduce public types, normalized data, shared state, and engine contracts without deleting existing modes.
2. Build the shared shell and lightweight default engine.
3. Adapt existing engines individually behind lazy boundaries.
4. Move project-only presentation into `BookPreviewDemo`.
5. Replace repeated controls and status markup with shared shadcn compositions.
6. Apply performance cleanup and capability guards per engine.
7. Apply the shared motion and accessibility system.
8. Add the registry definition and clean-install verification.
9. Remove superseded showcase code only after the new demo reaches feature parity.

Each stage should remain independently reviewable and should preserve unrelated uncommitted work.

## Scope Boundaries

Included:

- all current reader modes as optional adapters;
- reusable component API;
- shadcn registry compatibility;
- responsive, accessible UI;
- performance and resource-lifecycle repairs;
- restrained interaction and motion refinement;
- demo migration and verification.

Excluded unless separately requested:

- backend document processing or storage;
- DRM, accounts, annotations synchronization, or purchases;
- OCR generation;
- remote analytics;
- claims of measured network, memory, or frame-rate performance without a repeatable benchmark;
- redesign of unrelated exhibits or the overall Kitsu Lab site.

## Completion Criteria

The work is complete when the default component installs cleanly into a fresh shadcn project, renders without project-specific assumptions, excludes unused heavyweight engines from its initial bundle, supports all retained modes through optional adapters, handles cleanup and error paths, works across target device sizes and input types, respects accessibility preferences, and passes build, interaction, visual, motion, and registry checks.
