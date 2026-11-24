# Review: refactor/157-apply-open (#157 overlay step 3, shared apply effect)

Branch `refactor/157-apply-open`, commits 41cc0cf, 4927e00, 7cccf20, a6fa05d on eab50e5.
Reviewed 2026-11-24.

Verdict: **mergeable as is.** No blocking or major finding. Two low notes for follow-up (#159).

## Merge with master

Master moved since eab50e5 only by docs/memo commits. Scratch merge of master into the branch
(7141a2a) was clean, no conflicts. On the merge: `pnpm build`, `pnpm typecheck`, `pnpm lint`
(the two pre-existing warnings, menu-submenu-trigger.tsx:149 and toast.test.tsx:1426),
`pnpm format:check` green; jsdom 74 files / 3800 tests passed;
`FUNSTACK_BROWSERS=chromium,firefox` browser suite 54 files, 1049 passed, **39 skipped** (same as
master's 39). WebKit not run.

## Statement order and `isShown` evaluation points

Compared `use-apply-open-state.ts` line by line against both removed effects:

- Guard (`mode !== "library"` = old `!isLibrary`; `ctx.popupRef` is the same ref the old code
  destructured), `isConnected` guard, `factAdopted()` on committed `false`, in-flight check: same.
- `shown` read once before the branch (Popover's old `const shown`; Dialog's old two inline
  `element.open` reads were in the same expression chain with no side effect in between, so one
  read is equivalent).
- Open branch: `awaitingClose()` wait, then `show` (`showPopup` / `openDialog`): same.
- Close branch: `recordCloseIntent(undefined)`, `markLibraryClose()`, then `hide`. Dialog's
  `hide` starts with `takeCloseReturnValue()`, which the old effect also ran after
  `markLibraryClose()`; then cut + `close(rv)`, then the probe fallback. Popover's `hide`: cut +
  `hidePopover()`, then `focusWasInside` fallback. Identical order in both.
- After the branch: `probe.forget()` guarded by a fresh `isShown(element)`, and `releaseIfIdle(...,
  isShown(element))` with a third fresh read: matches the old `isPopoverOpen(element)` /
  `element.open` reads after a possible show/hide.
- Closures (`transition`, `hasTransition`, `focusWasInside`, `triggerRef`) are per-render as
  before; dependency-free effect, so no stale capture.

## Hook position and call-site comments

Both calls sit exactly where the old `useLayoutEffect` was, immediately after the mount
reconciliation effect; a custom hook with one layout effect keeps the hook order. The comments
("layout effects run in call order ... the reconciliation's dispatch must come first, so that
the first apply sees it in flight and waits") are accurate: mutation 4 below confirms it. The
Dialog comment's list of opens/closes is accurate; the moved focus-return and hold-release
sentences now live in the hook's JSDoc. `overlay-popup.tsx` and `overlay-show.ts` headers are
accurate. conventions 9.1 line, CHANGELOG entry and `directives.test.ts` client file are present.

## Mutation spot-checks (scratch worktree, all reverted, worktree removed)

| # | Mutation | Result |
|---|----------|--------|
| 1 | Dialog `onBeforeToggle`: drop `else flags.endClose()` | killed: both M3 rows fail |
| 2 | Hook: evaluate `isShown` once, reuse for `forget` / `releaseIfIdle` | survives (equivalent, see below) |
| 3 | Hook: `markLibraryClose()` after `hide()` | survives (equivalent, see below) |
| 4 | Both Popups: apply call moved before mount reconciliation | killed: 36 tests (Popover 10, Menu 10, Combobox 9, Dialog 7) |
| 5 | Dialog: `!modal && flags.takeRefusedFact()` | survives (equivalent in practice, see below) |
| 6 | Hook: drop `factAdopted()` | killed: 3 tests (Popover 2, Menu 1) |

The survivors are not test gaps:

- 2: after a library show, committed is `true`, so `releaseIfIdle` is a no-op anyway and the
  open `beforetoggle` already forgot the probe; after a library hide, the closing `beforetoggle`
  set `awaitingClose`, so `releaseIfIdle` is a no-op too. Keeping the three reads is still right
  (it is what the old code did, and it stays correct if a driver's show/hide is refused).
- 3: nothing reads the echo synchronously (`toggle` / `close` are queued tasks; Popover's closing
  `beforetoggle` reads the close intent, not the echo). Order kept as before, which is right.
- 5: a flag left set by a modal show is cleared by `factAdopted()` at the next committed `false`
  or overwritten by the next fact before any later show, so it is not observable. The two-step
  take is a clarity choice; the comment says only that the one-liner "would leave it set", which
  is true. "Pin" in the 4927e00 subject means the comment, not a test; fine.

## M3 rows (dialog.test.tsx, "a native open between a close and its close event")

Sound. The state is consumer-reachable: changing `transition` on Dialog.Popup changes the
`useTransitionBoundary` wrapper, so the `<dialog>` remounts while DialogPopup (and its flags)
stays; the listener effect is keyed on the `dialog` element state, so its cleanup removes the
`close` listener and the old element's queued `close` reaches nothing. That is a real prop change,
not a test-only hook; the rows assert the remount (`not.toBe(first)`). The remount is also what
makes the branch observable: it re-runs the apply on a fresh closed element (row 1, committed
`true` must show it) or re-renders with the hold still set (row 2). I tried to think of a path
without remount (a capture-phase `stopPropagation` of `close` on `window`), but then the element
stays open and nothing re-applies, so the stuck flag is cleared by the next close and never
observed. The remount route is the right one. The jsdom shim queues `close` with `setTimeout`
and fires `beforetoggle` synchronously, as the spec does, so the timing is not a shim artefact.
`flushTasks(2)` waits on task boundaries, not wall-clock time: no flakiness concern.

## Findings

### Low

1. **The M3 rows are coupled to #159.** `packages/ui/src/dialog/dialog.test.tsx:1307-1363`. The
   only reason the `else flags.endClose()` at an open `beforetoggle` is observable is that a
   remount loses the `close` event and leaves `awaitingClose` set, which is #159. #159's suggested
   fix ("end the close when the listener effect's element goes away") would end the wait at
   cleanup, so both rows would pass with mutation 1 applied, and the `else endClose()` branch
   would become unobservable (possibly dead). Whoever fixes #159 should revisit these rows and
   that branch together. Suggest adding a line to #159 (done below as a recommendation, not
   filed by me).
2. **#159 may not be Dialog-only (not verified).** usePopoverPopup's listener effect has the same
   shape (element state, cleanup removes `toggle`), and its unmount path does `setShown(false)`
   but not `flags.endClose()` (`packages/ui/src/internal/use-popover-popup.ts:412`). If
   `transition` remounts the popover element mid-hide, `awaitingClose` may stick the same way.
   Worth checking when #159 is picked up.

### Info

- `ApplyOpenStateContext` uses `OverlayRootValue<Popup, never[]>`; fine for a Pick of
  non-argument members, typecheck passes for both contexts.
- Developer notes (memo/developer/issue-157-apply-open.md) match the code and my runs
  (3800 jsdom tests, 39 skips).

## Suggested addition to issue #159 (for a human or the PO to post)

"When fixing: the two rows in dialog.test.tsx 'a native open between a close and its close
event' (#157 M3) rely on this bug to observe the `else flags.endClose()` at an open
`beforetoggle`. After the fix, re-check whether that branch is still needed and adjust the rows.
Also check usePopoverPopup for the same remount-during-hide case."
