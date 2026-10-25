# Review: #133 S6/S7 file splits (branch refactor/133-splits, 2026-10-25)

Commits c9a9deb (S6), 01df37f (S7), 7c4a7b8 (dev memo) on 3cfa3e3. Branch CI 40155816495 green.

## Verdict: merge

Both are pure moves. Compared old and new code side by side: bodies are textually identical apart
from the extraction seams.

## S6 `internal/use-interest-dismiss.ts`

- Call points identical: `noteOpen(toggle)` in the routed-open branch before `ctx.requestOpen`
  (use-popover-popup.ts:268); `takeLostInterest()` right after `awaitingClose = false`, before
  `setShown` and the focus return (:297); `noteClosed()` first in the hidden branch (:304);
  `reset()` right after listener removal in the detach cleanup (:402).
- Same `ctx`, `isLibrary` (`ctx.mode === "library"`) and `popupRef` (`ctx.popupRef`) as before;
  `onInterest`/`onLoseInterest` still reach the listeners through `useLatest`, so the timer
  closure captures the same render's `ctx`.
- One-task deferral, `isPopoverOpen && intended()` check, regained-interest guard, intent recorded
  before `hidePopover()`, flag set before the hide, pending-open `requestClose` branch: unchanged.
- `reset` is `useCallback([])`, so `setElement`'s deps stay stable (mutant `[{}]` fails 11 jsdom /
  5 browser rows: guarded).
- Hook order: four refs at the same point plus one `useCallback`; no state persists across
  versions, so harmless.

## S7 `combobox/use-deferred-leave.ts`

- Called where `leaveRef` was built (combobox-root.tsx:724), after `leave`; effect order unchanged.
- `[]` -> `[inputRef]`: `inputRef` is the Root's `useRef` (combobox-root.tsx:268), stable; effect
  still mount-only. An every-render mutant fails 2 jsdom / 1 browser rows, so the deps are guarded.
- `focusOut` immediate branch still calls the render's `leave`; the deferred check still calls
  `leaveRef.current`. Identical to before.

## Mutation spot-checks (Chromium for browser rows)

Caught: S6 guard removed (2/0), S6 hide synchronous (6/1), S6 hide never runs (5/4), S6
takeLostInterest false (4/2), S6 reset unstable (11/5), S7 no deferral (6/6), S7 effect every
render (2/1).
Survive: S6 reset no-op, S6 noteOpen always true, S6 intent recorded after hidePopover, S7
relatedTarget-in-popup as leave, S7 deferred check ignoring focus in popup (new, same gap).

Gap rows worth adding:
1. (medium) noteOpen: a non-interest routed open (foreign show-popover invoker / script
   showPopover) then interest + loseinterest from an interestfor button: popup must stay open
   (popover.md 2.3 lost-interest row: "after an interest open"). jsdom shim row + Chromium row.
2. (medium-low) Combobox focus moving to focusable content inside the Popup (relatedTarget path,
   and the null-relatedTarget deferred path landing in the popup) must not close/revert. jsdom.
3. (skip/low) reset no-op: only observable if the popup detaches between the lost-interest
   hidePopover and its toggle, leaving a stale flag that skips a later fallback focus return.
   Contrived.
4. (skip) intent-after-hide is an equivalent mutant: clearLater only clears while the popup is
   shown, and the toggle task consumes the intent either way. No row can observe it.

Browser tests (popover, tooltip, menu, menu-context-trigger, combobox) Chromium + Firefox:
502 passed, 20 engine-gated skips. jsdom for the same dirs: 866 passed.

## Nits
- Dev memo says the returned functions are "stable, useCallback"; only `reset` is. Fine as used.
