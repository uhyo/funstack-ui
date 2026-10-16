# Developer memo: Dialog (#29), 2026-10-16

Implemented `packages/ui/src/dialog/` per `design/components/dialog.md` (status "proposed" at the
time; the "dismiss" reason was added to `ChangeReason` as instructed).

## Shape

- Root: `useControllableAction<boolean>`, mode fixed at first render, no DOM. Owns `triggerRef`,
  `dialogRef` and the close-intent ref. `requestOpen` / `notifyClosed` judge no-ops against
  `latestInFlight()?.next ?? optimistic` (conventions 3.8 rule 1): dedupes the StrictMode
  reconciliation re-run and recognises the library's own `close()` echo (controlled close,
  refused pre-hydration open) without a separate echo flag.
- Popup: native listeners (`command`, `submit`, `close`, `beforetoggle`, non-modal `keydown`,
  light-dismiss `click` / document click following `toggle`), mount reconciliation layout effect,
  apply layout effect after every commit, `exiting` state for the deferred unmount.
- Close: own `useTransition`; with `action` the click is prevented (cancels the command).
- Form: `<form method="dialog">` or `<form action>` + `FormStatusWatcher` (useFormStatus edge
  true -> false closes). Submitter value from a capture `submit` listener on the form.

## Things the design did not cover (fixed in code)

1. **Close/notification race.** The dialog is closed synchronously, but `close` fires a task
   later. Any commit of the Popup in between (a parent re-render, the Form's pending lift) ran the
   apply effect with committed `true`, dialog closed, nothing in flight -> `showModal()` again.
   Fix: `awaitingClose` ref set from the synchronous `beforetoggle` (newState "closed"), cleared
   by `close`; the apply effect does not re-open while it is set. Test: "a commit between the
   native close and its `close` event does not re-open" (fails without the guard).
2. **Stale close intents.** Instead of a `cancel` listener + setTimeout, `recordCloseIntent`
   schedules one `setTimeout(0)` that clears the intent only if the dialog is still open (the
   close did not happen). Covers a prevented `cancel` and a prevented `command` alike.
3. **keepMounted + exit animation.** `<Activity mode="hidden">` is `display: none`, so a
   keepMounted dialog would also be empty while fading. Activity stays visible while `exiting`.
4. **Infinite animations** (a spinner inside) would hold `exiting` forever: only animations
   with a finite `endTime` are awaited.
5. **Non-modal light dismiss vs the Trigger**: a click on the Trigger is not "outside" (else
   JS-free non-modal would close and `show()` again in the same click).
6. `initialFocus` in JS-free mode: the attribute is written after mount and kept (there is no
   "right before showModal()" when the browser runs the command).

## Findings worth an issue

- **React starts a document view transition whenever a `<ViewTransition>` mounts in a
  transition commit, even with `default="none"`** (react-dom 19.3.1
  `trackEnterViewTransitions`: tag 30 placement sets `shouldStartViewTransition`). The UA's root
  cross-fade (250 ms) then runs, and the next transition commit waits for it. Seen with nested
  dialogs: the inner Popup's boundary mounts with the outer content, so the inner open lands
  ~200 ms after the click. Conventions 5.1 says the cost of `"none"` is nil; that holds for
  updates, not for mounts. Affects every part that mounts a boundary inside a transition (Tabs
  panels with `keepMounted={false}` too). Not changed here.
- Design 4.3 says a rejected close notification re-opens the dialog. With the boundary above
  Root (the only place the error can go) the Root is unmounted, so nothing re-opens; re-open is
  observable only for a controlled parent that refuses (or catches and does not adopt). Tests
  assert that.
- Controlled overlap: a parent that adopts every resolution in arrival order ends with the
  slower (superseded) one; the uncontrolled guard does not apply. Per conventions 2.5.

## Tests

- `src/__tests__/dialog-shim.ts`: also emulates invoker clicks (`commandfor`/`command`) and
  `method="dialog"` submits, so jsdom tests can click Close buttons and assert that the Trigger's
  `preventDefault()` cancels the command. Design 13.1 said "the shim does not emulate invokers";
  `dispatchCommand()` is still exported for foreign-invoker tests.
- Browser: Chromium 156 + Firefox 157 green locally; WebKit not runnable on this machine.
  `aria-modal` exposure and the ViewTransition capture of the opening commit are not asserted
  (no AX tree access in vitest browser mode; VT capture is a manual check in the example).
- Backdrop click in Playwright: `userEvent.click(dialog, { position: { x: -20, y: -20 }, force:
  true })` hits the `::backdrop` (target = the dialog, outside its box) in both engines.
