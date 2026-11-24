# #157 overlay step 3: shared apply effect

Branch `refactor/157-apply-open` (not merged), from master eab50e5. Internal only; no test was
weakened or removed (the `overlay-show.test.ts` rows only follow the `takeRefusedFact` rename).
User decision: share only the "apply open state" effect; the `toggle` / `close` and
`beforetoggle` handlers stay per Popup.

## Commits

- 41cc0cf `refactor(ui): share the apply effect of the two Popups as useApplyOpenState (#157)`:
  new `internal/use-apply-open-state.ts` ("use client"), conventions 9.1 line, CHANGELOG entry,
  `directives.test.ts` client file, `overlay-popup.tsx` header.
- 4927e00 `refactor(ui): name the refused flag once and pin Dialog's take order (#157)`: review
  nits 2-4.
- 7cccf20 `test(ui): a native open between a Dialog close and its close event (#157)`: M3 rows.

## The hook

`useApplyOpenState(ctx, { flags, exit, probe, isShown, show, hide })`, one dependency-free
`useLayoutEffect`. Inside: mode / connected guard, `factAdopted()` on committed `false`, the
in-flight check, the `awaitingClose` wait before `show`, `recordCloseIntent(undefined)` +
`markLibraryClose()` before `hide`, `probe.forget()` while committed and shown,
`releaseIfIdle`. Driver: `isShown` (`isPopoverOpen` / `el.open`), `show` (`showPopup` /
`openDialog`), `hide` (cut + `hidePopover()` + `focusWasInside` fallback / `takeCloseReturnValue`
+ cut + `close(rv)` + `contentProbe` fallback). Same statement order as before in both; `isShown`
is evaluated three times, as `isPopoverOpen(element)` / `element.open` were. Replacing a layout
effect with a custom hook holding one layout effect keeps the hook order; the call sits exactly
where the old effect was, right after mount reconciliation, with a comment saying why.

`ctx` type: `Pick<OverlayRootValue, mode | committed | pending | latestInFlight |
recordCloseIntent>` plus a generic `popupRef`, so both `PopoverRootValue` and
`DialogContextValue` fit.

Line counts: use-popover-popup.ts 465 -> 447, dialog-popup.tsx 473 -> 456 (458 after the nit
commit), use-apply-open-state.ts new, 82 (about 25 of code).

## M3 rows (dialog.test.tsx, "a native open between a close and its close event")

The `else flags.endClose()` at an open `beforetoggle` is only observable when the close's
`close` event never reaches the Popup: otherwise `onClose` clears the flag before anything
reads it (it is read only while the dialog is hidden, and getting hidden again goes through a
`beforetoggle` that sets it anyway). The rows lose the event with an element remount (setting
`transition` remounts the `<dialog>` while DialogPopup's state, the flags, stays):

1. dismissal (`close()`) + `show()` + remount in one task: the new element opens (committed is
   still `true`).
2. controlled close (close commit holds the content; `close` spied to call `show()` right after)
   + remount: the hold is released, content unmounted.

Both fail with the mutation (checked, reverted). Side observation: without the foreign
`show()`, the same remount leaves `awaitingClose` set for good (row 1: the dialog never
re-opens; row 2: the hold never releases). Pre-existing, edge case (a `transition` change during
a close); not fixed here. Worth an issue if anyone cares: the listener effect cleanup could end
the close when the element it listens on goes away.

## Test runs

At 41cc0cf and at 7cccf20: `pnpm typecheck`, `pnpm lint` (two pre-existing warnings), `pnpm
format:check`, `pnpm build`, `pnpm test:jsdom` (74 files; 3798 then 3800 tests) green;
`FUNSTACK_BROWSERS=chromium,firefox pnpm test:browser` 54 files, 1049 passed, 39 skipped at both
(master baseline 39). WebKit not run locally.
