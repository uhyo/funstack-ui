# Developer memo: Combobox (#50, wave 4), 2026-10-17

Design: design/components/combobox.md (accepted in 7349e2d; conventions 2.6 urgent lane and 11
built-in strings applied there). Branch `worktree-agent-a3bd43c20c2270d19`.

## Files

- `packages/ui/src/combobox/`: index (no directive), context, root, label, input, trigger, clear,
  popup, list, option, group (Group, GroupLabel, Empty, Status in one file), all "use client".
  Tests: `combobox.test.tsx` (jsdom), `combobox.browser.test.tsx` (22 rows per engine).
- `internal/types.ts`: `UrgentChangeAction` (root entry exports it). `internal/use-form-reset.ts`:
  optional third argument `onResetEvent`, called synchronously from the `reset` event (before
  the reset algorithm). `__tests__/engine.ts`: `supportsAriaNotify`.
- Example `packages/example/src/combobox-demo.{tsx,css}`; docs `ComboboxPage` + `ComboboxCountry`,
  `ComboboxDrink`, `combobox.css`; nav, routes, Roadmap, Home, Action props (urgent lane
  section), Transitions (types), Suspense, Browser-owned state, Server Components, Select links.

## How it is built

- Root: `usePopoverRoot({ component: "combobox", mode: "library" })`; the Input registers itself
  as the popover's `triggerRef`, so the shared Popup hook's `showPopover({ source })` anchors to
  the input and `returnFocus` targets it. `resolveInitialFocus: () => null` (nothing in the popup
  is ever focused). The Trigger does not use `usePopoverTrigger` (no `commandfor`).
- Value: `useControllableAction<string | null>` with a wrapped action. Per-dispatch metadata (id,
  open generation, close?, text written) is kept in a `WeakMap` keyed by the `details` Proxy, so
  the wrapper knows after the `await` whether to close (latest dispatch, same open generation,
  text unchanged since) and what text to roll back on rejection.
- Text: `useState` + optional controlled prop; `writeText` sets state and calls the urgent action
  synchronously (thenable warning once). `query = useDeferredValue(text)`.
- Registry of mounted Options (`Map` in state-held ref) with an `optionCount` state for `Empty`;
  label cache `Map` seeded at mount with the initial value's text, written on registration, on
  accept, on free text, and when a committed value changes from outside (learns the text the
  consumer passed with it).
- Active option: plain `useState` + ref; revalidation in a Root layout effect after every commit
  (children's registration layout effects ran first). ArrowDown/Up on a closed listbox records a
  pending edge applied once the open commit has options.
- Refusal detection (controlled parent does not adopt): a "text record" settled by the wrapper,
  checked in a layout effect once nothing is in flight; reverts the text when committed !== the
  dispatched value and the text is still what the library wrote.

## Deviations / additions (reported to the caller)

1. **Escape then Enter race** (found in the docs smoke, Chromium): the keyboard handler judges
   open/closed by `:popover-open`, not `intended()`. Right after Escape the popup is hidden but the
   `toggle` notification is queued, so Enter was prevented and a form did not submit.
2. **Firefox implicit submission** happens before React's scheduled flush of the optimistic
   render (probed outside `act` with a plain `useOptimistic` hidden input: Chromium posts the new
   value, Firefox the old). The closed-Enter free-text commit runs in `flushSync`.
3. **Typing while a save is pending keeps the listbox open**: the accept's close is dropped when
   the text changed since the accept (the user is searching again). Not in the design.
4. **Controlled refusal closes the listbox** (text and selection revert): the close is part of the
   action's commit and adoption cannot be known before it. The design says the listbox stays open
   (as for a rejection, which does skip the close).
5. **Empty and "loading"**: the design wants Empty hidden during the Suspense fallback but gives no
   way to know it. A `Combobox.Status` mounted *inside the List* (the anatomy's fallback) counts
   as loading: Empty and `data-empty` stay off and nothing is announced. A Status in the Popup is
   a plain hint.
6. **Hidden input `defaultValue` mirror** (11.1) is meaningless for `type=hidden` (its value *is*
   the attribute; reset does not touch it). The value reset target is computed in JS. The visible
   input's `defaultValue` mirror is written in the `reset` event (react-dom's attribute syncing
   overwrites `defaultValue` with the value after every keystroke, so a layout-effect mirror does
   not survive).
7. **`relatedTarget === null`**: still closes nothing synchronously; a task later, if the document
   still has focus and focus is outside (a click on non-focusable page), the revert / free-text
   commit runs (the light dismiss already closed the listbox). Window blur stays a no-op.
8. Popup and Option own `onMouseDown` (prevented) besides `onPointerDown`; Trigger and Clear too.
9. Clear while the listbox is open closes it (light dismiss: the button is outside the popup).
   Design 3.3 says "the listbox stays as it is". The Trigger records the state at `pointerdown`
   so its toggle is not undone by the same light dismiss.
10. `Combobox.Label` has a state (`{ disabled }`); Group / GroupLabel / Status state is `{}`;
    Empty's is the List's.

## Verification asked for (design section 4)

`useDeferredValue` re-render while a `valueChangeAction` is pending: **not entangled**. The
results re-render for the new query before the save settles, in jsdom (act) and in Chromium 156 /
Firefox 157 (browser rows "typing while a save is pending", sync filter and async search through
Suspense). React 19.3.1 source agrees: `requestDeferredLane` claims a deferred lane
(262144..2097152) directly, not through `requestTransitionLane`, which is where async-action
entanglement happens. The design's sentence is right. (An open dispatched while the save is pending
is a transition and does wait, as designed.)

## Engine facts

- `position-area: block-end span-inline-end` under `dir="rtl"` on a **container** (not the root):
  Chromium 156 keeps the left edges aligned (logical keywords resolve against the top-layer
  containing block = root); Firefox 157 gives offsets matching neither edge. `span-self-inline-end`
  is not even supported; `self-block-end span-self-inline-end` fixes Chromium only. Page-level
  `dir="rtl"` works in both. Design 7.2 / 12.2 claim the container case works: it does not. The
  browser row tests page-level RTL; the docs say so.
- Firefox keeps keyboard focus in a removed iframe: the hydration row restores `window.focus()`.
- `ariaNotify` present in Chromium 156 and Firefox 157 (Playwright builds).

## Results

- jsdom `combobox.test.tsx`: 111 tests.
- browser `combobox.browser.test.tsx`: 22 rows per engine; Chromium and Firefox 42 passed, 2
  skipped (the WebKit-only 302008 row).
- Docs smoke (static build, Chromium + Firefox): async search with fallback then stale results,
  one view transition for the open, none for a results change, one for the accept-close, focus
  stays in the input, free text submits, no console errors. Playground smoke likewise.

## Not verified / watch on WebKit CI

- 302008 row (15 s timeout), placement and flip rows, the iframe keyboard (tolerant fallback logs
  a warning), Escape inside Dialog / Popover, ViewTransition counts, IME (asserts the composing
  keydown guard only).
- Screen-reader pass (design 9) not done (no AT here).
- Lint: `pnpm lint` ignores `**/.claude/**`, which is where agent worktrees live, so it checks
  nothing in a worktree. Linted the changed files one by one with a copy of the config.
