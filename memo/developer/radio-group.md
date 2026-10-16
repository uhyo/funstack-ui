# Developer memo: RadioGroup (#31), 2026-10-16

Implementation of `design/components/radio-group.md` on top of the shared native-input machinery
from Switch/Checkbox (#30). No shared hook was changed.

## What is where

- `packages/ui/src/radio-group/`: `radio-group-context.ts`, `radio-group-root.tsx`,
  `radio-group-label.tsx`, `radio-group-item.tsx` (all `"use client"`), `index.ts` (no directive,
  imports platform-attributes), `radio-group.test.tsx` (jsdom, 79 tests),
  `radio-group.browser.test.tsx` (Chromium + Firefox locally, 12 tests per engine).
- Exports: root `src/index.ts`, `tsdown.config.ts` entry, `package.json` `./radio-group`.
- `directives.test.ts`: the four part files + `internal/use-native-group-reconciliation.mjs`
  (TODO from #30 resolved) as client files, `radio-group/index.mjs` as directive-free.
- Example: `packages/example/src/radio-group-demo.{tsx,css}` (classes prefixed `rg-`: the
  switch-checkbox demo's `.row`/`.stack` are global).

## Decisions / deviations

- `base()` uses an explicit `latestInFlight() === null ? optimistic : inFlight.next`, not the
  design's `latestInFlight()?.next ?? optimistic` (13.3): with `T = string | null`, `??` would
  discard an in-flight dispatch of `null` (a pending reset to "nothing checked"). Same reasoning
  for the design's `dispatchFromDom`; I did not add a separate `dispatchFromDom` because
  `useNativeGroupReconciliation` already compares against `base()` before calling
  `onPlatformChange`, so `onPlatformChange` just dispatches.
- `select` (context) only does the optimistic no-op check; the `defaultPrevented` check and the
  dev warning are `guardCheckableChange(e, () => ctx.select(...), "RadioGroup.Item")` in the
  Item, as 13.5 says (13.3 puts them in `select`; same behaviour).
- Item `onChange` also returns early when `disabled` (Switch precedent: covers `render`
  elements that ignore `disabled`).
- Root's library ref is a callback ref that fills a `useRef` (for the group hook) and does the
  `FIELDSET` tag warning once.
- `Root form` is a destructured prop applied as an owned key on the fieldset and on each radio
  (through context). A `form` in Item `rest` is overridden (owned).

## Test findings

- **A rejection unmounts the group.** The Error Boundary above the Root replaces it, so the
  design's "rejection: the previously checked input is checked again in the DOM" (test plan row
  "Rejection") cannot be observed on the rejected group. The DOM rollback is asserted where the
  group stays mounted: controlled veto, caught-inside rejection in controlled mode, refused
  hydration dispatch. Same as Switch row 9b.
- Async actions are globally entangled: a harness's post-await `startTransition(setCommitted)`
  for a newer dispatch does not commit while an older dispatch is still pending, so the harness
  mirror cannot be asserted mid-burst (superseded-rejection rows). It also is not latest-wins
  (rapid arrows resolved out of order leave the mirror on the older value); the DOM, which shows
  the converged optimistic = internal value, is the assertion there.
- user-event 14.6.8 cannot press Home/End on a radio in jsdom (`setSelectionRange` "Not
  implemented"); the jsdom test uses `fireEvent.keyDown` to show the library has no handler and
  the browser test presses the real keys.
- A `Recorder` child of Root bails out of re-rendering (no props, no context); put it inside
  Root's function `children` so it is re-created on every Root render.
- jsdom's cancelled activation for radios restores the previous radio correctly (unlike the
  checkbox bug in `switch-checkbox.md`), so the pass-through-cancel row asserts the DOM in jsdom
  too.
- WebKit could not launch locally (host libraries, `browser-mode.md`); CI covers it. Unverified
  there: RTL arrow mirroring, `:user-invalid` after a submit attempt, Tab into radios.
