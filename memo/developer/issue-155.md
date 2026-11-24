# #155: no initial focus on the re-open of a refused fact (2026-11-24)

Branch `fix/155-refused-reopen-focus`, based on `feat/147-vt-css-cut`.

Judged small and local, so implemented: one ref in `usePopoverPopup` (`refusedFact`), set in the
`toggle` listener when a fact is notified, cleared by the apply effect on any commit with
`committed === false` (the fact adopted, uncontrolled or controlled), read and cleared by
`showPopup`, which then resolves no focus target (no `autofocus` attribute, no quiet `.focus()`).
No new state machine, nothing outside the hook.

Scope by element:

- Menu (`<div>`): the trap of review-148 L3 is gone. Escape -> focus stays on the Trigger; Tab out
  -> on the next tab stop.
- Popover `<div>` (render prop): same.
- Popover default `<dialog popover>` and Dialog: **not changed**. `showPopover()` on a `<dialog>`
  runs the dialog focusing steps (focus moves inside whatever the library does; the "platform
  probe" row in popover.browser.test.tsx). Skipping only `initialFocus` there would just change
  which inside element gets focus, so the flag is ignored for `tagName === "DIALOG"`. Not a trap:
  a Popover does not close on Tab, so Tab leaves it. Undoing the platform focus would need a
  `.focus()` back (against design 6.1), i.e. more than a local change.
- Combobox: `resolveInitialFocus: () => null` already; a row pins that focus stays on the next
  field after a refused focus-leave.

Tests (browser): Menu refused Escape / Tab out (focus outside after re-open), Menu adopted Escape
then keyboard open (first item focused again), Popover `<div>` vs `<dialog>`, Combobox
focus-leave. Mutation: with the skip disabled the Menu rows (4, Chromium + Firefox) and the
Popover `<div>` row fail.
