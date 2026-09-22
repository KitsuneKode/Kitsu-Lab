# Book Preview Hardening Implementation Plan

**Goal:** Turn the current reader prototype into a shadcn-installable, cross-input component with reliable fallbacks, bounded heavy work, accessible controls, and restrained Apple-like page motion.

**Constraints:** Preserve existing user work and all seven shipped modes. Keep optional PDF/WebGL/page-flip code outside the default bundle. Prefer native controls and CSS/WAAPI motion; honor reduced motion. Do not claim device parity without real-device evidence.

## 1. State and compatibility correctness

- Add regression tests for compatible-engine filtering, zero-page upload readiness, source identity, and nested interactive keyboard targets.
- Derive the active engine from the current controlled/uncontrolled mode on every render.
- Expose only compatible modes in the picker and remove render-phase state updates.
- Give source identity a consumer-provided revision escape hatch and include normalized content in the default identity.

## 2. Input, accessibility, and navigation motion

- Prevent reader shortcuts from consuming keys owned by inputs, sliders, buttons, menus, tabs, links, and other widgets.
- Distinguish immediate keyboard/slider navigation from animated deliberate page turns.
- Keep every action named, focus-visible, touch-sized, and operable with touch, mouse, keyboard, and assistive technology.
- Ensure reduced-motion mode removes page travel and curl flourish rather than merely shortening it.

## 3. PDF, WebGL, and lifecycle performance

- Keep upload-only PDF mode visible before a document is selected.
- Cancel PDF work safely, release object URLs, avoid state writes during render/cleanup, cap raster DPR, and prioritize a bounded window around the current page.
- Pause WebGL when the reader is offscreen or the document is hidden; remove browser globals from render-time state initialization and dispose GPU resources.

## 4. Registry and shadcn distribution

- Include every transitive local file in the correct registry item.
- Preserve the explicit Base UI shadcn target used by the generated primitives and document that compatibility boundary.
- Build registry artifacts and verify installation in a clean temporary consumer.

## 5. Integration cleanup and verification

- Fix the Next 16 `useLinkStatus` provider/descendant misuse using the repository's installed documentation.
- Address actionable React Doctor findings in the touched reader path and remove unused heavy dependencies.
- Run focused tests after each behavioral change, then full tests, typecheck, lint, production build, registry build/install, React Doctor, diff checks, and a responsive keyboard/touch browser pass where tooling permits.
