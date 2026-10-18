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

## Review fixes (2026-10-16, after memo/reviewer/tooltip.md)

- Escape (JS path): when the popup is open, `hidePopover()` then `event.preventDefault()`, so an
  enclosing modal `<dialog>` or `popover="auto"` menu stays open; Escape while closed is untouched.
  Native path (interestfor + hint) attaches nothing: Chromium 153 closes hint and dialog together
  there, documented in a code comment.
- Open state is never copied: every decision reads `popup.matches(":popover-open")` (and
  `isConnected`). Document listeners attach synchronously after `showPopover()` and detach on hide
  or when `toggle` runs and the DOM says closed (DOM, not `newState`, so a stale task cannot
  detach). A pointerdown / Escape / cleanup in the same task as the show now hides.
- `disabled` turning on hides an open popup on both paths (effect start, before the native-path
  early return).
- Shim: `beforetoggle` sync, `toggle` queued with `setTimeout(0)` and coalesced like the spec's
  toggle task tracker; NotSupportedError without `popover`, InvalidStateError when disconnected
  (after the redundant-call check, as in the spec); patches `matches(":popover-open")` (jsdom
  parses it but never matches). Fake-timer tests flush `toggle` via `advance`; to stay between
  show and toggle use `vi.advanceTimersToNextTimer()`.
- Browser tests added: pointer into popup, pointerdown outside, same-task dismissal (microtask
  after a wrapped `showPopover`), Escape in modal dialog / auto menu (manual and hint), hint over
  an auto menu, native-path disable while open. All fail against the pre-fix hook.
- Example: Save copy depends on whether the native path is active; new minimal "Inside a menu"
  section (`popover="auto"` opened by `popoverTarget`).

## Open / not done

- Native path: Escape closes an enclosing modal dialog too (Chromium behaviour, not ours).
- Design text listed in the reviewer memo (2.3 rows, 13 Disabled row) still needs the architect.
- Conventions resolved question 11 says Tooltip's default "switches to name when the trigger has
  no accessible name of its own"; the design (and this implementation) keeps an explicit prop
  with default `"description"`. Reported as ambiguous.
- Example verified by `vite build` only, not clicked through in a browser.

## #57 roving-tabindex triggers (wave 6)

- Dev check now accepts `tabIndex < 0` when the trigger has an explicit `tabindex` attribute and
  an ancestor composite (`menu`, `menubar`, `tablist`, `toolbar`, `radiogroup`, `listbox`, `grid`,
  `treegrid`, `tree`, `[focusgroup]`). Still warns for a bare `tabindex="-1"` and for a role item
  without any tabindex. Checked once at mount (roving tabindex values change later; fine).
- Menu browser row "a Tooltip on an item" now asserts no "not focusable" error (Chromium items
  have no tabindex under native focusgroup, so the row only bites in Firefox/WebKit).
