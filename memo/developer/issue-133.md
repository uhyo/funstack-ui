# Issue #133 (wave 18): S6 and S7 file splits

Branch `refactor/133-splits` (worktree under the session scratchpad), not merged. Pure moves; no
test file changed (no test imports the moved code).

## S6: `internal/use-interest-dismiss.ts`

- `useInterestDismiss(ctx)` holds the #127 refs (interest invoker, interest open, hide task,
  lost-interest flag), `onInterest` / `onLoseInterest` with the Chromium JSDoc, and returns
  `noteOpen(toggle)`, `noteClosed()`, `takeLostInterest()`, `reset()` (stable, `useCallback`).
- usePopoverPopup calls them at the old points: routed opening `beforetoggle` (noteOpen, before
  `requestOpen`), first thing in `toggle` after `awaitingClose` (takeLostInterest, so it is read
  before the focus return), hidden `toggle` (noteClosed, before the focus return), detach cleanup
  right after the listeners are removed (reset). The handlers still go through `useLatest`.
- The hook's refs are created where the inline refs were, so hook order is unchanged.
- use-popover-popup.ts 478 -> 439 lines; new file 101.

Mutations (popover.test.tsx jsdom with the interest shim; popover.browser.test.tsx Chromium):
focus-fallback skip off (4 jsdom / 2 browser rows fail), no one-task deferral (6 / 1), no
regained-interest guard (2 / 0), noteClosed no-op (2 / 0), lost-interest flag never set (4 / 2).
Survive, and survive identically on the pre-move code (checked on 3cfa3e3): reset() clearing
nothing, every routed open counted as an interest open, the dismiss intent recorded after
`hidePopover()` instead of before. Test gaps to note for whoever next touches popover tests:
- unmount / re-ref while a lost-interest hide task is pending;
- a foreign `show-popover` invoker open (non-interest source) followed by `loseinterest` from an
  `interestfor` button that had interest;
- the intent order (would need a check that the hide's notify sees the "dismiss" intent with the
  `loseinterest` event even when `toggle` clears intents in between).

## S7: `combobox/use-deferred-leave.ts`

- `useDeferredLeave({ inputRef, popupRef, leave })` returns `{ focusIn, focusOut }`; the
  `relatedTarget` branch, `leaveRef` (`useLatest(leave)`), the mount effect and its `unwatch`
  cleanup moved with it. Called where `leaveRef` was built, so insertion-effect and effect order
  in the Root is unchanged.
- Only non-mechanical change: the mount effect's deps are `[inputRef]` instead of `[]`
  (exhaustive-deps sees a parameter now). It is the Root's own `useRef` object, so the effect
  still runs once.
- combobox-root.tsx 882 -> 794 lines; new file 126.

Mutations (combobox.test.tsx jsdom; combobox.browser.test.tsx Chromium + Firefox): all caught
except one: no deferral while pressed (6 / 17), first release decides (1 / 0), window blur keeps
presses (1 / 0), focus does not start tracking (5 / 17), mount does not track a focused input
(1 / 0), no unwatch on unmount (1 / 0), deferred check always leaves (2 / 18), release decides
synchronously (1 / 18), no-press check synchronous (2 / 0). Survives (also on the pre-move code):
focus moving into the popup (`relatedTarget` inside the popup) treated as a leave. The listbox
takes no focus (aria-activedescendant), so only focusable consumer content in the Popup would
hit it; a row could cover it.
