# Developer memo: Accordion (#12), 2026-10-16

Implementation of `design/components/accordion.md`. Started by a previous agent (parts, context,
`use-dev-warning`, `reducer` option on `useControllableAction`); finished and then reworked after
the review (`memo/reviewer/accordion.md`). Landed on master: c66167e (merge), 2e0ed5d
(libraryProps), 63bf685 (owned keys), 7162774 (platform path / hydration), 5b69d59 (nested
controls, browser tests), f1ddb5c (chevron CSS).

## What is where

- `packages/ui/src/accordion/`: `accordion-root.tsx`, `accordion-item.tsx`,
  `accordion-trigger.tsx`, `accordion-panel.tsx`, `accordion-context.ts` (all `"use client"`),
  `index.ts` (directive-free), `accordion.test.tsx` (jsdom), `accordion.browser.test.tsx`
  (Chromium, issue #22), `accordion.types.test.tsx` (`expectTypeOf` for the `exclusive`
  discrimination).
- Shared internals touched: `use-controllable-action.ts` (`reducer` option; `latestInFlight()`
  in the return value), `use-dev-warning.ts` (new), `merge-props.ts` (owned library keys).
- Example: `packages/example/src/accordion-demo.tsx` + `.css`.

## How the platform path works now (review fix 1 and 2)

- `dispatchFromDom(item, open, event)` never reads the DOM. `next = reduce(base, item, open)`
  with `base = latestInFlight()?.next ?? optimistic`, so a pending optimistic open survives a
  find-in-page reveal of another item (race test, both modes, multiple and exclusive).
- `latestInFlight()` lives in the shared hook: the `next` of the most recent dispatch while any
  action is unsettled, else `null`. The Root also uses it to gate the re-apply effect. It is read
  from handlers and effects only (oxlint's React rules flag ref reads in render, and flag ref
  *mutation* in a closure passed to a hook, which is why the counter could not live in the Root).
- Mount reconciliation is one Root `useLayoutEffect([])` behind a `useEffectEvent`: it walks the
  registered `<details>` in registration order, puts disabled mismatches back, folds the others
  into ONE dispatch (`reason: "platform"`, `event: undefined`, `details.item`/`open` from the
  first mismatch; exclusive: the first *opened* mismatch wins). The optimistic reducer applies
  that whole `next` for this one case (it is keyed by `details.item` otherwise), so the queued
  `toggle` events of the pre-clicked items find nothing new. StrictMode's second run is
  deduplicated by `latestInFlight()` (the first dispatch's `next` equals the recomputed one).
- A second Root layout effect `[committed, pending]` re-applies committed state to every item
  once `!pending && latestInFlight() === null`. Item has no effect of its own any more.
- `<details>` renders `suppressHydrationWarning` in both modes.
- The hydration tests use `renderToString` + `render(ui, { container, hydrate: true })`, set
  `open` on the server HTML, and **await a `setImmediate` before hydrating**: jsdom queues
  `toggle` through `setImmediate`, and in a browser those events fired long before hydration. The
  same reason `flushToggle()` awaits `setImmediate`, not `setTimeout(0)`: the two race under load
  (this showed up as a flake in the full run only).

## Owned library keys (review fix 3)

- `mergeProps` library layer: a key present with `undefined` sets an explicit own `undefined`
  (not a `delete`: `cloneElement` layers the merged props over the render element's original
  props, so only an own `undefined` wins there).
- Call sites: Item installs `onToggle` only in library mode (`...(isLibrary && { onToggle })`),
  Trigger `onClick` only when it has one, so JS-free render elements keep their own handlers.
  `name` is owned in both modes (removes a render element's second writer of `open`).
- Toggle unaffected (its handler and `aria-pressed` are always defined).

## Nested controls in the Trigger (review item 5, verified in Chromium)

- Chromium: clicks on a nested `select` / `textarea` / text `input` did **not** toggle the
  details; a nested `contenteditable` **did** (and then went through the platform path). jsdom:
  a nested `select` toggles. One rule covers all engines: for a nested interactive element
  without its own activation behaviour, `preventDefault()` the click (focus/pickers happen on
  mousedown, unaffected); for self-activating ones (`a[href]`, `button`, `label`, button-like /
  checkbox / radio / file / color inputs) do nothing, the browser already skips the summary.
  Never dispatch for either. JS-free mode attaches no handler, so a nested contenteditable there
  toggles natively; left as is (the design says nothing runs in JS-free mode).

## Browser tests

- `import { userEvent } from "vitest/browser"` gives Playwright-driven keys and clicks.
  First run of a new browser file may fail with "Cannot read properties of null (reading
  'useState')" while Vite re-optimises deps (`[vitest] Vite unexpectedly reloaded a test`);
  the second run is fine.
- Failure screenshots go to `packages/ui/.vitest/attachments/`, now gitignored.

## Decisions / gotchas

- Context value is **not** `useMemo`'d (design 12): the hook's `dispatch` is a new function every
  render, so the memo could never hold, and oxlint's `react(preserve-manual-memoization)` flags
  it. A stable `dispatch` in the shared hook would be the prerequisite.
- Multiple-mode `next` is listed in registration order (document order for a list rendered top
  to bottom), computed in `fromSet` from the Item registry.
- Controlled "update on success" with a whole-set `next` writes in completion order, so an
  overlapping A-then-B whose B resolves first ends with `["a"]` in the parent (reviewer probe 6).
  Uncontrolled is latest-wins and ends A+B open. The overlap tests therefore assert the DOM, not
  the harness mirror.
- `AccordionRootBaseProps` omits the native `defaultValue` (type clash). `transition` is typed
  `ViewTransitionClass` like Toggle.
- `experimental_interpolateSize` is observable in jsdom only through `render`'s `props.style`.
- Dynamic boolean `exclusive={flag}` typechecks only without a value (the union needs a static
  discriminant once `value` / `defaultValue` / `valueChangeAction` is present).

## 2026-10-16 — flaky "sync action (uncontrolled)" tests (fixed in 5fbaa51)

Root cause was in the tests: RTL's asyncWrapper runs user-event with IS_REACT_ACT_ENVIRONMENT off, so the
click's transition (and the post-await `startTransition(setCommitted)`) rendered on the real time-sliced
Scheduler and could land after `user.click` returned on a cold start. Fix: a file-local `setupUser` that
runs click/keyboard inside one async `act` (asyncWrapper swapped for a pass-through meanwhile). The shared
`helpers.tsx` `setupUser` has the same latent race for suites that assert synchronously right after a
user-event call into a transition — move the wrapper there if another suite flakes the same way.
