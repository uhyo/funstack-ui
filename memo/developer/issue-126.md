# #126: a press on a foreign invoker of an open Menu / Combobox (2026-10-25)

Branch `fix/126-foreign-invoker-press`. Design: conventions 3.5 (after the #110 trap), menu.md
decision 10 / 2.2 / 13.1 / 14 / amendment, combobox.md decision 6 / 5.4 / 12.2 / 14 / amendment,
memo/architect/issue-126-foreign-invoker-press.md.

## What was done

- `src/internal/invoker-press.ts` (directive-free): `isPopoverInvoker(target, popup)` (closest
  `<button>`, outside the popup, `popoverTargetElement === popup`, or `commandForElement === popup`
  with `/-popover$/` on `command`; read through the IDL, absent IDL is `false`) and
  `listenInvokerPresses(popup)` (document capture `mousedown`, `button === 0`, returns cleanup).
- `menu-popup.tsx`: the root's `onToggle` starts it together with `listenOutside`; the `outside`
  ref now holds a combined cleanup, so `stopOutside()` (close and unmount) stops both.
- `combobox-popup.tsx`: new `onToggle` for `usePopoverPopup` (start on open while
  `:popover-open`, stop on closed), cleanup on unmount, same ref pattern as Menu's.
- jsdom invoker shim: reflects `commandForElement` and `command` on `HTMLButtonElement.prototype`
  (#125's popover shim reflects `popoverTargetElement`).
- Docs: one sentence in each `openChangeAction` row (MenuPage, ComboboxPage); JSDoc of both Popups.

## Tests

- `internal/invoker-press.test.ts` (plain DOM): positives (popovertarget, the three popover
  commands, a press on the button's content), negatives (plain, `--custom`, `close`, no command,
  another popover, a button inside the popup, non-buttons, null), primary-only, cleanup.
- `invoker-shim.test.ts`: the IDL reflection.
- `menu.test.tsx` / `combobox.test.tsx`: prevented only while shown (closed before and after),
  secondary button not prevented, commandfor variants, plain / other-popover negatives.
- Browser (`menu.browser.test.tsx`, `combobox.browser.test.tsx`), real pointer via `mouse.down` /
  `mouse.up` (state checked between the two), no engine branch: popovertarget and
  commandfor+toggle-popover rows (one `(false, "activate")`, `source` = the button, focus on the
  Trigger / input, Combobox text "Jamaicax" kept, no re-open in 100 ms); dragged-off press (open,
  focus kept, nothing dispatched); Menu Tab onto the foreign invoker still `"dismiss"`.
- Mutation check (listener registration removed), Chromium + Firefox: every press and drag-off
  row fails (open: false at the press, `"dismiss"`), the jsdom guard rows fail; the Tab row and
  the negatives pass, as they should.
- The popovertarget rows need #125 (`ToggleEvent.source` → `"activate"`); before it they failed on
  `reason` only. Rebased onto #125 (134c871): its Menu browser row no longer prevents the button's
  `mousedown` by hand (it fails under the mutation, as the new rows do), and its jsdom rows'
  comments now point at the guard.

## Gates (after the rebase)

typecheck, lint (0 errors; the one `menu-submenu-trigger.tsx` warning predates this), format:check,
test:jsdom (68 files, 3333 tests), build: green. Browser, Chromium + Firefox: menu,
combobox and menu-context-trigger files, 297 passed / 7 skipped. WebKit: branch CI.

## Notes

- The Menu's own Trigger is a `popovertarget` invoker of the root popup, so the guard also covers
  it whenever the popup is shown, including the pending-close window where `intended()` is false
  and `Menu.Trigger`'s own `onMouseDown` does not prevent. A press there now keeps focus in the
  menu and the click re-opens through `requestOpen` instead of a focusout `"dismiss"` first. The
  design names the rule without excluding own parts; consistent with 3.5's single-source rule.
- WebKit cannot launch locally; CI decides it.

## Release notes

- Menu and Combobox: pressing your own `popovertarget` / `commandfor` button for an open menu or
  listbox no longer closes it as `"dismiss"` at the press (and re-opens it on Firefox); focus stays
  put, the button's click closes it as `"activate"`, and a Combobox keeps the typed text (#126).
