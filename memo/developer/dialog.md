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

## Review fixes (memo/reviewer/dialog.md), 2026-10-16

- **H1 nested confirm.** Final pattern (for design 11.10 / 12.5 and the docs): no action awaits
  user input. The outer "Discard…" button is the `Dialog.Trigger` of a nested **JS-free** confirm
  Dialog (native command: opens synchronously in the click, no transition). The confirm's
  "Discard" is a `Dialog.Close action={async () => { await discard(); startTransition(() =>
  setOpen(false)); }}` and the outer Root is controlled (`open` + `openChangeAction={(next) =>
  setOpen(next)}`). "Keep editing" / Escape close the confirm only. The outer close is the
  parent's (apply effect `close()`), so the outer `openChangeAction(false)` is not called for it
  and `returnValue` is `""`; consumers record the outcome in the Close action. Verified in the
  example with Playwright (Chromium, Firefox): inner `:modal` true synchronously after `click()`.
  jsdom has a characterisation test that the old shape holds every transition (flags a React
  change). The reviewer's alternative, `setTimeout(() => setConfirming(true))`, also works but
  keeps an action awaiting input, and every transition in the app is held until the user answers.
- **M1** press-and-click rule: `pointerdown` records "outside" (modal: on the dialog outside its
  rect; non-modal: document capture, outside dialog and Trigger), `click` closes only if both.
  Keyboard-synthesised clicks no longer dismiss (no press), same as native. Real-drag browser row
  uses `user.dragAndDrop(input, popup, { targetPosition: {x:-20,y:-20}, force: true })`; it fails
  without the fix in Chromium only (Firefox never fired the click).
- **M2** non-modal Escape: skipped (not prevented) when the target is inside an open nested dialog
  or open auto/hint popover, or when any open auto/hint popover is inside the dialog (close
  watchers are per document, not per focus). `manual` popovers (and `hint` where the engine maps
  it to manual, read through the `popover` IDL attribute) do not take Escape.
- **M3** `Dialog.Form closeOnSettle` (default true). **L4** `method` passes through only with a
  string `action`.
- **L2** Trigger `pending` is now `root.pending` (design 4.2 said `pending && O !== C`; that hid
  the re-open window where both are `true`). Form: a `close` of the dialog after the last submit
  blocks the settle close (fixes the reviewer's 5-step variant).
- **L1** `disabled` owned on Trigger and Close.
- **L3** Browser tests use `user` (added optional click options and `dragAndDrop` to
  browser-user.ts); exit-animation row awaits the captured animations inside `act`: 0 act
  warnings. Shim: invalid commands fire no `command` event (`show-modal` on an open dialog,
  close / request-close on a closed one); custom `--x` commands fire and do nothing.
- Docs page (packages/docs DialogPage) updated for the props and the Escape callout; the
  design text (11.10, 12.5, 4.2, 8.1, 9) still describes the old behaviour, for the architect.

## #46: library-owned part-initiated closes (2026-10-17/18)

Implemented the accepted amendment (design 2.3, 3.4, 4.4, 8.1, 10.3, 11.11-11.16, 13.2, 13.3,
14, "Amendment" steps 1-7) plus #48 review findings 4 (apply-effect comments: "after every
commit that re-renders the Popup") and 5 (Dialog `intended` through `useLatest`).

- `internal/content-focus-probe.tsx`: `useContentFocusProbe(popupRef)` -> `{ wrapContent,
  hadFocus(), forget() }`. Function API, not a ref: the compiler lint (`react(immutability)`)
  flags writes to a ref returned by a custom hook.
- Root: `requestClose(event, reason, returnValue)`, `takeCloseReturnValue()` (returns `""`
  when none), the pending return value is cleared in an insertion effect whenever
  `latestInFlight()?.next ?? optimistic` is true (veto snap-back or re-open).
- Popup: `useExitAnimation` + render-time `holdDuringRender` (no `transition`), release rule
  in the apply effect, echo check in `close`; `command` listener cancels `request-close` /
  `close` in library mode (value from `event.source`, `""` without one); `submit` listener on
  the **document** (bubble), cancels unless `defaultPrevented`.
- Close: `onClick` installed in library mode or with `action`; Form: settle -> `requestClose`.

### Things worth knowing

- **jsdom shim**: its `method="dialog"` close was a document listener registered at setup, so
  it ran before the Popup's document listener. Moved to a window bubble listener, plus a
  microtask path armed by wrapping `stopPropagation` (a stopped submit still closes natively,
  like a real default action). The stopped path cannot cancel the event, so jsdom logs "Not
  implemented: requestSubmit()" in that one test.
- Close with `action`: the Close's `isPending` does stay true until the Root's
  `openChangeAction(false)` settles (React entangles the transitions); asserted in jsdom.
- **CSS exit + `transition` (Chromium)**: probe (not committed) showed that with the 10.1 CSS
  exit (`display` / `overlay` allow-discrete) on the dialog, a library-driven close's view
  transition also captures the still-rendered, fading dialog as `::view-transition-new`
  (dialog `display: block`, opacity ~0.89 at `ready`); without the CSS exit there is no new
  image. Firefox: never a new image (no CSS exit). Design 10.3 recommends "at most a CSS exit
  for dismissals" with `transition`; that CSS runs for library closes too. Docs example and
  playground therefore drop the dialog box's CSS transition in the `transition` variant
  (`.demo-dialog-vt`, `.dlg-vt`). Popover's docs recipe keeps the fade and likely has the same
  artifact in Chromium (not probed). For the architect.
- The opening-capture row (10.3's open question) passes on Chromium 156 and Firefox 157:
  `::view-transition-new` exists at `ready` for a `showModal()` in the update callback.
- Local engines: Chromium + Firefox only. WebKit rows for CI: the 13.3 VT rows (open + close
  capture after `showModal()`, Escape = one VT, CSS exit + Escape = one VT, focus return with
  Enter on Close for non-modal/keepMounted/modal), the controlled-close CSS fade row (content
  held, mounted once), `close()` inside the update callback restoring focus to the Trigger,
  and `event.source` on a foreign `request-close` (browser row added; passes on Chromium 156 and
  Firefox 157, `returnValue` is the invoker's `value`).

## #46 review fixes (memo/reviewer/dialog-46.md), 2026-10-18

Commits 56e1ea8 (code + jsdom rows) and 5dcce5f (recipe, docs, browser rows).

- **M1 (PO: option a).** Popup ref `dismissedWhilePending = { event, returnValue, generation }`,
  set in the `close` listener when the close is not the library's own and `false` is already
  intended (an in-flight part close). The apply effect, finding committed `true` and the dialog
  closed (nothing in flight, no `awaitingClose`), calls `ctx.notifyClosed(event, "dismiss",
  returnValue)` instead of `openDialog()` when the record's generation is the current
  `openGeneration()`. Cleared on `beforetoggle` open, when the close settles as `false`, and when
  consumed. A Trigger re-open in between bumps the generation, so it supersedes the dismissal
  (row). A parent that refuses the dismissal too gets the usual re-open.
- **M3.** `if (event.cancelBubble) return;` after the `defaultPrevented` check. jsdom row: a
  `document` submit listener that calls `stopPropagation()` registered before mount (stands in
  for React's root on the document, FUNSTACK Static).
- **L1.** Submit listener on `dialog.getRootNode()`. jsdom row renders into a shadow root (the
  shim's window listener never sees that submit, so the old code left the dialog open: the row
  failed before the fix).
- **L2.** `closeOnSettle` doc (code and docs page): "a submit button in a separate
  `method="dialog"` form"; a `formMethod="dialog"` submitter in a function-action Form re-runs
  the action.
- **L4.** `libraryClose` ref set right before the apply effect's `close()`, consumed by the
  `close` listener: echo by source. A non-echo close also drops the Root's pending part
  `returnValue` (`takeCloseReturnValue()`). `notifyClosed` is now only called for non-echo
  closes; L3 is fixed along with it (the hold is skipped only for a real echo).
- **L5 rows:** P2 (uncontrolled only: a controlled Harness that adopts in arrival order ends
  with the superseded `false`, conventions 2.5), 11.16, Close action plus a controlled veto,
  nested library / JS-free inner Root with the shared submit listener. All new M1/M3/L1/L4 rows
  fail against 885d1ed's popup.
- **M2.** Recipe: keep the CSS exit, add `html:active-view-transition .x { transition: none; }`
  (dialog box only; the backdrop leaves the top layer with it). Applied to docs `dialog.css`,
  `popover.css`, DialogPage / PopoverPage text and code blocks, playground `dialog-demo.css`,
  `popover-demo.css`. Browser rows read pseudo-element names from `document.getAnimations()` at
  `ready`; the dialog group is `_t_N_`. Chromium 156: without the recipe a Close has
  `old(_t_N_)` + `new(_t_N_)` (dialog `display: block`); with it `old(_t_N_)` only, `display:
  none`. Firefox: old only either way. **Popover's recipe had the same artifact** (Chromium probe,
  same shape), now fixed the same way, with a row.
- **WebKit (CI only, run 5dc99d0).** At the close's `ready` the box is already `display: none`
  with or without the recipe, so WebKit shows no double image (the docs now say "Chromium" only;
  commit 5dcce5f's message still says "and WebKit", which was wrong). WebKit also lists the
  dialog group's animation under `::view-transition-new(_t_N_)` and nothing under
  `old(_t_N_)`, while the box cannot have a new image: pseudo-element names from
  `getAnimations()` are not reliable there, so the WebKit rows assert `display` only. Worth a
  look by someone with WebKit (is it a mislabel or a stale open animation?). The older row "the
  open and %s each run one view transition" passes in WebKit only through `old(root)`.
