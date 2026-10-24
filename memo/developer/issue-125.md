# #125: a foreign popovertarget close is "activate" (ToggleEvent.source)

Branch `feat/125-toggle-source` (worktree `.claude/worktrees/dev-125`).

## What changed

- `use-popover-popup.ts` `onBeforeToggle`, close branch, library mode: when `ToggleEvent.source`
  is non-null, `recordCloseIntent({ reason: "activate", event }, { unlessRecorded: true })`.
  `details.event` is the `beforetoggle` ToggleEvent (PO decision: the ToggleEvent).
- `use-overlay-root.ts` `recordCloseIntent` gained `{ unlessRecorded }`: the guard lives in the
  recording, `takeCloseIntent` is unchanged. Needed because a `commandfor` click sets `source` on
  the `beforetoggle` too (probe rows 3.native.cf-btn), and its `command` listener runs first.
- Shims: `beforetoggle` / `toggle` carry `source` (invoker for popovertarget and commandfor show
  and hide, `showPopover({source})` / `togglePopover({source})` on show, `null` for
  `hidePopover()`, `togglePopover()` hiding (HTML step 5) and nested hides).

## Own parts

No guard on the Trigger / Close identity: in library mode their clicks are always
`preventDefault()`ed (use-popover-trigger onClick, use-overlay-close), so no native toggle runs;
the close is the apply effect's `hidePopover()`, source `null`. Combobox.Trigger cancels every
click too. JS-free mode is excluded (`isLibrary`): nothing is notified there.

## Menu / Combobox

Both use `usePopoverPopup`, so the rule applies. Consistent with Popover 2.3 and Combobox's open
table (foreign opens are "activate"). But a real press on a plain foreign button moves focus first:
- Menu: focusout (relatedTarget = button) hides the menu as "dismiss" before the click.
  Measured (exploratory row, removed): Chromium ends closed `[open, (false, dismiss)]`; Firefox
  then runs the popovertarget toggle on the now-hidden menu and **re-opens** it
  `[..., (true, activate, beforetoggle)]`, focus on the first item. Pre-existing (#121), not #125.
  Worth an issue: a foreign popovertarget button for a Menu (and probably Combobox, whose
  focusout closes at once for a non-null relatedTarget) flickers closed and reopens on Firefox.
- So the Menu browser row uses a button that prevents its mousedown; the Combobox jsdom row uses
  `foreign.click()` (no focus move).

## Tests

- jsdom: popover (foreign popovertarget close; commandfor toggle-popover keeps CommandEvent;
  Trigger/Close keep the click and script hide stays dismiss), menu, combobox, invoker shim
  source row. Existing "foreign hide-popover" row now also guards the recording order.
- browser (chromium, firefox): popover foreign popovertarget + Escape + outside click; commandfor
  hide-popover keeps the CommandEvent; menu foreign popovertarget (mousedown-prevented) + Escape.
- Mutations (jsdom and browser): no recording, no `unlessRecorded` guard, record without the source
  check: each caught.

## Release notes

- fix: a consumer's own `<button popovertarget>` closing a library-mode Popover, Menu or Combobox
  now reports `openChangeAction(false, { reason: "activate" })` with the `beforetoggle`
  `ToggleEvent` (its `source` is the button) instead of `"dismiss"` (#125).

## CI

Branch run 40107078736 (workflow_dispatch on `feat/125-toggle-source`): ci, browser chromium,
firefox and webkit all green (WebKit covers ToggleEvent.source from Safari 26.5).
