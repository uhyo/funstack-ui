# Developer memo: Tooltip (#13), 2026-10-16

Implementation of `design/components/tooltip.md` on branch `worktree-agent-ae02df24174c75eda`
(not pushed; the product owner merges). master merged in after the feature commits.

## What landed

- `packages/ui/src/tooltip/`: `tooltip-context.ts`, `tooltip-root.tsx`, `tooltip-trigger.tsx`,
  `tooltip-popup.tsx`, `use-tooltip-interaction.ts` (all "use client"), `index.ts` (none).
  Exported from the root entry and `@funstack/ui/tooltip`. **No Arrow** (held for v0,
  conventions resolved question 10), so no `TooltipPopupContext` either.
- `internal/platform-attributes.ts` (was `.d.ts`): a module with `declare module "react"`
  only; every entry `index.ts` (root, toggle, accordion, tabs, tooltip) does
  `import "../internal/platform-attributes.js"`. tsdown then emits
  `dist/internal/platform-attributes.d.mts` and an import of it in each entry `.d.mts`; the
  `.mjs` has no import (empty module dropped). Verified by a throwaway file in
  `packages/example` (`<button interestfor>` + `style={{ interestDelayStart }}` typecheck,
  `interestfor={1}` errors).
- `__tests__/popover-shim.ts` (jsdom only, guarded by `"showPopover" in HTMLElement.prototype`),
  imported from `vitest.setup.ts`. Exports `isPopoverOpen(el)`.
- Tests: `tooltip.test.tsx` (jsdom, 75), `tooltip.browser.test.tsx` (Chromium, 8 including the
  native interestfor path, which runs: Playwright 1.63's Chromium 1243 has `interestForElement`).
- Example: `packages/example/src/tooltip-demo.tsx` / `.css`.

## Decisions / gotchas

- **csstype**: `declare module "csstype"` fails with TS2664 because `csstype` is a dependency of
  `@types/react`, not of `@funstack/ui` (pnpm strict layout). The interest-delay properties go on
  `React.CSSProperties` instead (same effect for `style` props). Deviation from conventions 7.4
  wording; reported.
- `interestForRequested` state in Root, set by the Trigger in a layout effect, so the effect
  re-detects when `experimental_interestFor` flips after mount (design's effect deps did not
  include the flag).
- Extra trigger listeners: `pointerdown` and `keydown` Escape on the trigger cancel a *pending*
  open timer (document listeners only exist while open). Without them a click or Escape before
  `delay` elapses still opened the tooltip afterwards.
- `hidePopover()` / `showPopover()` are guarded by `isConnected`: on unmount the passive cleanup
  runs after the DOM removal, and `hidePopover()` on a disconnected popover throws.
- Popup `data-side` / `data-align` are omitted (not owned) with `side={null}`. Trigger owns only
  the relation in use (`aria-describedby` or `aria-labelledby`); `interestfor` owned only while
  flagged. `type="button"` only via `rendersButton(render)` (from master's Toggle fix).
- Dev warnings use `console.error` (like `useDevWarning`), once per instance per kind; the design
  sketch says `console.warn`.
- jsdom: `:focus-visible` (via @asamuzakjp/dom-selector) keeps heuristic state across tests and
  stops matching after a few Tab tests. The test file stubs `Element.prototype.matches` for that
  selector with a keyboard-vs-pointer modality flag.
- Fake timers + user-event: RTL's async wrapper waits on `setTimeout(0)` and only advances it when
  `jest` exists. `setupTimers()` installs a minimal `globalThis.jest` and fakes only
  `setTimeout`/`clearTimeout`.
- A suspending child rendered by plain `render()` never revealed after resolve; render inside
  `await act(async () => render(...))`, then `findByText` (reveal throttle).

## Open / not done

- Escape is not `preventDefault`ed: a tooltip inside a modal `<dialog>` closes the dialog too on
  Escape (JS path). Native `hint` handles this via close watchers. Worth a design decision.
- Conventions resolved question 11 says Tooltip's default "switches to name when the trigger has
  no accessible name of its own"; the design (and this implementation) keeps an explicit prop
  with default `"description"`. Reported as ambiguous.
- Example verified by `vite build` only, not clicked through in a browser.
