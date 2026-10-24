# #109: shared overlay browser suite and disabled-render suite

Branch `test/109-overlay-browser-suite`. Two suites, one environment fix.

## 1. `__tests__/overlay-browser-suite.tsx` (`describeOverlayInBrowser`)

Driver per component: `Harness` (library mode, `content` first, the part close, `inside`),
`isOpen(el)`, `openPseudo` (`:open` also fades `::backdrop`), `open()`, `partClose()` (real input),
`dismissEvent` (`close` / `toggle`, also what `watchExit` listens for), `ariaExpanded`,
`dismissReturnValue`, `viewTransition: { Plain, partCloses[], dismiss, afterOpen? }`.

- Dialog: open = `openWithTrigger`; partClose = the Close part click; VT partCloses = Close
  (`returnValue` "cancel"), `method="dialog"` submit ("ok"), controlled `open={false}` (""); VT
  dismiss = real Escape; afterOpen = `:modal`.
- Popover: open = Trigger click + settle; partClose = Trigger click; VT dismiss = `hidePopover()`.
- Menu: open = `openWithKeyboard`; partClose = Enter on the focused item; VT partClose = item
  click, afterClose = focus back on the Trigger; afterOpen = the item has focus. The Trigger click
  while open is not used anywhere in the suite (#110 is deciding that behaviour on WebKit).

No module-level state in either suite (nothing to reset in vitest.setup.ts).

Rows added (a component now runs a row it did not have; all green on chromium + firefox):
- Dialog: part-initiated close held exit (Close part); dismissal + CSS exit with recipe=false;
  CSS exit part close for `method="dialog"` submit (both recipes) and controlled (recipe=false).
- Popover: dismissal + CSS exit with recipe=true (asserts no new popup image).
- Menu: both #64 rows, all CSS-exit rows (dismissal x2, part close x2).
- Assertions added to kept rows: Escape row on Menu now checks the call count, `next`, event type
  and `aria-expanded` (was: last reason only); quiet periods "no third view transition" on
  Popover/Menu; `updateCallbackDone` -> shown / hidden in the open/close row (see mutations).

### Title mapping (old -> new; new rows are under `<Name> (shared overlay browser suite)`)

dialog.browser.test.tsx
- library mode > Escape closes with reason 'dismiss'; focus returns to the Trigger
  -> Escape closes with reason 'dismiss'; focus returns to the Trigger
- exit animation… > keeps the content mounted while the exit animation runs; none in Firefox
  -> exit animation… > an Escape dismissal keeps the content while the CSS exit runs; none in Firefox
- exit animation… > Escape: the close ignores a finite animation… (#64)
  -> exit animation… > an Escape dismissal ignores a finite animation that was already running inside (#64)
- exit animation… > Close part: the close ignores a finite animation… (#64)
  -> exit animation… > a part-initiated close ignores a finite animation… (#64)
- ViewTransition > transition="pop": the open and {a Dialog.Close | a method="dialog" submit | a controlled open={false}} each run one view transition
  -> ViewTransition > (same titles)
- ViewTransition > transition="pop": an Escape runs one only for the notification commit, dialog already closed
  -> ViewTransition > transition="pop": a dismissal runs one only for the notification commit, popup already closed
- ViewTransition > transition="pop", a CSS exit and the recipe: an Escape runs one view transition, no new dialog image
  -> ViewTransition > transition="pop" plus a CSS exit (recipe=true): a dismissal runs one view transition, not two
- ViewTransition > transition="pop" plus a CSS exit and the recipe: {a Dialog.Close | a controlled open={false}} has the old image only
  -> ViewTransition > a CSS exit (recipe=true) > transition="pop": {…} has the old image, a live new image only in Chromium without the recipe
- ViewTransition > characterisation: transition="pop" plus a CSS exit without the recipe has a live new image in Chromium
  -> ViewTransition > a CSS exit (recipe=false) > transition="pop": a Dialog.Close has the old image, a live new image only in Chromium without the recipe
- ViewTransition > without transition: no view transition for an open, a Close close or an Escape
  -> ViewTransition > without transition: no view transition for an open, a part-initiated close or a dismissal
- Kept local: 10.3 capture row, `modal=… keepMounted=…` focus rows, controlled close #46 row.

popover.browser.test.tsx
- library mode > Escape closes with reason 'dismiss'; focus returns to the Trigger -> same title
- exit… > a part-initiated close keeps the content while the CSS exit runs; none in Firefox -> same title
- exit… > a dismissal keeps the content… -> an Escape dismissal keeps the content…
- exit… > a {part-initiated close | dismissal} ignores a finite animation… (#64)
  -> {a part-initiated close | an Escape dismissal} ignores a finite animation… (#64)
- VT > transition="pop": the open and the part-initiated close each run one view transition
  -> VT > transition="pop": the open and a Trigger click each run one view transition
- VT > transition="pop": a dismissal runs one only for the notification commit, popup already hidden
  -> VT > … popup already closed
- VT > transition="pop" plus a CSS exit: a dismissal runs one view transition, not two
  -> VT > transition="pop" plus a CSS exit (recipe=false): a dismissal runs one view transition, not two
- VT > transition="pop" plus a CSS exit, a part-initiated close (recipe=false|true): …
  -> VT > a CSS exit (recipe=false|true) > transition="pop": a Trigger click has the old image, a live new image only in Chromium without the recipe
- VT > without transition: no view transition for an open or a close
  -> VT > without transition: no view transition for an open, a part-initiated close or a dismissal
- Kept local: `transition=… keepMounted=…` focus rows, `transition="none"` shielded row.

menu.browser.test.tsx
- keyboard end to end > Escape closes ('dismiss') with focus on the Trigger
  -> Escape closes with reason 'dismiss'; focus returns to the Trigger
- exit animation > after an item's activation the items stay while the CSS exit runs; none in Firefox
  -> exit… > a part-initiated close keeps the content while the CSS exit runs; none in Firefox
- exit animation > after Escape likewise -> exit… > an Escape dismissal keeps the content…
- VT > transition="pop": the open and an item activation each run one; focus returns to the Trigger
  -> VT > transition="pop": the open and an item activation each run one view transition (focus checks in the driver's afterOpen / afterClose)
- VT > transition="pop": Escape runs one only for the notification commit, popup already hidden
  -> VT > transition="pop": a dismissal runs one only for the notification commit, popup already closed
- VT > without transition: no view transition for an open or an activation
  -> VT > without transition: no view transition for an open, a part-initiated close or a dismissal

environment.browser.test.tsx "fires ToggleEvent when a popover opens": same title; now asserts no
`toggle` synchronously after `showPopover()`, then awaits the event (no `setTimeout(0)` race).

### Mutations (only the suite rows, `-t "shared overlay browser suite"`; restored after each)

| mutation | chromium | firefox |
| --- | --- | --- |
| M1 overlay-popup `afterClose` never holds | 6 fail: both held-exit rows x3 | 0 (Firefox animates no exit; expected) |
| M2 use-exit-animation ignores the baseline | 6 fail: both #64 rows x3 | 6 same |
| M3 use-overlay-root `notifyClosed` reason "activate" | 3 fail: Escape row x3 | 3 same |
| M4 transition-boundary always wraps (`default="auto"`) | 3 fail: without-transition x3 | 3 same |
| M5 hold release inside `startTransition` | 6 fail: dismissal + CSS exit (both recipes) x3 | 0 (no exit animations) |
| M6 library close 150 ms after the commit (popover/menu `hidePopover`, dialog `close`) | 10 fail: pop open/close (all partCloses) + CSS exit recipe=true | 16 |
| M7 library open 150 ms after the commit | 5 fail: pop open/close (all partCloses) | 5 |
| M8 hold during render even with `transition` | 5 fail: pop open/close | 5 |
| M9 `afterClose` holds for an echo with `transition` | 0 survive | - |

- M6/M7 with a 0 ms delay survived the original row shape (it polled `isOpen` before checking at
  `updateCallbackDone`). The row now polls the call count first and checks the popup at
  `updateCallbackDone` for the open and the close; M6/M7 with 150 ms fail. The 0 ms variant is
  not distinguishable (React's update callback outlives a 0 ms timer).
- M9 survivor: with `transition` the content would be re-mounted into the hidden popup for the
  CSS exit; only Chromium without the recipe would show it, and a check races the fade. Pre-existing
  gap, not covered by any old row either.

## 2. `__tests__/overlay-disabled-render-suite.tsx` (`describeOverlayDisabledRenders`)

Config: `Harness` (the jsdom open-state harness), `isOpen`, `spyOpen`, `triggerVariants` (Dialog:
modal true / false), `close?: { props, spyClose, openStatic }` (Dialog, Popover). Menu's
`OpenStateHarness` Trigger now takes `Partial<MenuTriggerProps>` (it took `{ disabled }` only).

Title mapping (new rows under `<Name> disabled on link and component renders (shared suite, …)`):

dialog-disabled.test.tsx
- Close, %s render > library mode: aria-disabled, the click is cancelled, nothing closes -> same
  (now opened through the Trigger: `action` called once, the open; was `initialOpen`, not called)
- Close, %s render > JS-free mode with action: … nothing closes -> same (+ `data-disabled`)
- Close, a host <button> render and no render: native disabled, no aria-disabled
  -> Close, {a host <button> render | no render} in library mode: native disabled, no aria-disabled
- Close, JS-free mode without action, a component render: native disabled (the command)
  + Trigger, JS-free modal with a component render: native disabled (the command)
  -> JS-free mode, component renders: native disabled on the Trigger and an action-less Close (the commands)
- Trigger, %s render > library mode (modal=%s): aria-disabled, cancelled, nothing opens
  -> Trigger, %s render > library mode (modal=true|false): aria-disabled, the click is cancelled; click, Enter and ArrowDown do not open
- disabled component renders in library mode are no invokers: no commandfor / command
  -> library mode, disabled component renders are no invokers: no commandfor / command
- JS-free mode with action, a disabled component-render Close is no invoker -> same
- Trigger, a host <button> render in library mode: native disabled, no aria-disabled
  -> Trigger, a host <button> render in library mode: native disabled, no aria-disabled, never opens
- Kept local: JS-free non-modal Trigger, enabled commands, Fold W8 `data-disabled`, owned disabled.

popover.test.tsx
- %s render > Close, library mode: … nothing closes -> Close, %s render > library mode: …
- %s render > Close, JS-free mode with action: aria-disabled, cancelled, nothing hides
  -> Close, %s render > JS-free mode with action: aria-disabled, the click is cancelled, nothing closes
- JS-free mode, a disabled component-render Close with action carries data-disabled
  -> folded into the row above (`data-disabled` asserted for both renders)
- %s render > Trigger, library mode: aria-disabled, the click is cancelled, no dispatch
  -> Trigger, %s render > library mode: aria-disabled, the click is cancelled; click, Enter and ArrowDown do not open
- library mode, disabled component renders are no invokers -> same
- JS-free mode with action, a disabled component-render Close is no invoker -> same
- JS-free mode with a component render: native disabled on Trigger and action-less Close
  -> JS-free mode, component renders: native disabled on the Trigger and an action-less Close (the commands)
- library mode, a host <button> render and no render: native disabled, no aria-disabled
  -> Trigger, {a host <button> render | no render} in library mode: … never opens
     + Close, {a host <button> render | no render} in library mode: native disabled, no aria-disabled
- Kept local: host render keeps its own aria-disabled; `disabled` as an own undefined key.

menu.test.tsx
- a disabled Trigger is natively disabled and never opens
  -> Trigger, no render in library mode: native disabled, no aria-disabled, never opens (+ host button row)
- a disabled Trigger with %s render is aria-disabled; click, Enter and ArrowDown do not open (#83)
  -> Trigger, %s render > library mode: aria-disabled, the click is cancelled; click, Enter and ArrowDown do not open
     (+ `showPopover` spy not called)
- a disabled Trigger with a component render is no invoker: no commandfor / command
  -> library mode, disabled component renders are no invokers: no commandfor / command

Mutations (jsdom, suite rows only):
- D1 `disabledButton` invoker always true: 13 fail (no-invoker x3, all Close aria rows, JS-free no-invoker x2).
- D2 never the aria branch: 21 fail (every link/component Trigger and Close row, all three components).
- D3 ignore `handlesClick`: 2 fail (JS-free native-disabled row, Dialog + Popover).
- D4 Trigger click dispatches while disabled (use-popover-trigger + dialog-trigger): 8 fail (Trigger aria rows x all).
- D5 Close runs while disabled (use-overlay-close): 8 fail (Close aria rows, Dialog + Popover).
- D6 `isHostButton` false for a host button / no render: 5 fail (native rows: Trigger x3, Close x2).

## Line delta

- Browser: dialog/popover/menu .browser files +244 / -802, suite +456: net -102 lines, with more
  rows than before (Menu and Dialog gained variants).
- jsdom: dialog-disabled / popover / menu tests +53 / -368, suite +248: net -67.
