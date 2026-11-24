# Review: refactor/157-overlay-shared (#157, audit candidates #1 and #9)

Branch commits cb1c823, 42faa07, 3b66e2e on top of 7ec703e. Reviewed 2026-11-24.

**Verdict: mergeable as is.** No behaviour change found; the findings below are test gaps
(pre-existing, not introduced here) and nits. None blocks the merge.

## Behaviour preservation (checked line by line against master)

- Dialog `close` handler (dialog-popup.tsx, `onClose`): order is unchanged:
  `endClose()` (was `awaitingClose = false`) -> focus return (`returnFocusToTrigger`, where a
  focus handler can flush a sync commit) -> `takeCloseIntent()` -> `takeLibraryClose()` (was
  the read + clear of `libraryClose`) -> `!isLibrary` return -> `exit.afterClose` -> echo
  return -> `markFact()` -> `takeCloseReturnValue()` -> `notifyClosed`. Fine-grained flag
  operations were the right call for this reason.
- Dialog `beforetoggle`: `awaitingClose = newState === "closed"` became
  `beginClose()` / `else endClose()`: identical for both values.
- Dialog apply effect: `factAdopted()`, `awaitingClose()`, `markLibraryClose()` right before
  `close(returnValue)`, `releaseIfIdle(..., flags.awaitingClose(), ...)`: same points.
- `openDialog`: `flags.takeRefused() && !modal` evaluates (and clears) the flag first, so it is
  cleared unconditionally as before, also for a modal dialog. `initialFocusTarget` is now
  evaluated before `inert` is set, but it is only called when `refused` is false, when no
  `inert` is set either way: equivalent.
- Popover `showPopup`: `takeRefused()` -> `resolveFocusTarget` (only when not refused) ->
  `inert` -> `autofocus` -> `opening = true` -> source + show -> `opening = false` ->
  remove `autofocus` -> remove `inert`. The finally order on a throw is the same as before.
  `reshow`'s `endClose()`, `beforetoggle`'s `beginClose()`, `toggle`'s `endClose()` +
  `takeLibraryClose()` + `markFact()` all sit where the ref writes were.
- `useState(createPopupFlags)`: stable per instance, same lifetime as the three `useRef`s;
  StrictMode's double initializer call keeps one object. Fine.
- Dialog listeners: the dialog's own listeners attach in the same order (command, submit on the
  root node, close, beforetoggle, then keydown / pointerdown / click / toggle from
  `listenDialogDismiss`). The document capture `pointerdown` / `click` listeners now attach after
  the base listeners instead of before them; no other listener of those types is on the document
  from this effect (the root-node one is `submit`), so no dispatch-order consequence. Cleanup
  removes everything as before. Effect deps unchanged.
- `closedby` path: `nativeClosedBy ? null : listenDialogDismiss(...)` equals the old
  `!modal && !nativeClosedBy` (Escape) and `lightDismiss && !nativeClosedBy` (light dismiss)
  guards. Mutating it to key on the flag instead of native support is killed by 4 jsdom rows
  (the JS fallback rows).
- Directives: both new modules are directive-free, listed in `directives.test.ts`, and import
  only `popover-open.ts` (directive-free). The two Popups keep `"use client"`.

## Browser suite (FUNSTACK_BROWSERS=chromium,firefox pnpm test:browser)

| | Files | Passed | Skipped |
| --- | --- | --- | --- |
| master 9b4b5b7 | 54 | 1049 | 39 |
| branch 3b66e2e | 54 | 1049 | 39 |

The per-file skip distribution is identical (Chromium: combobox, menu, popover, select, slider,
tooltip 1 each; Firefox: button 2, combobox 2, field 1, menu-context-trigger 2, menu 1,
number-field 3, popover 8, select 8, slider 1, tooltip 5). No Dialog file skips anything. The
developer's 39 is the master baseline. WebKit was not run (left to CI).

## Mutation spot-checks (scratch worktree, each reverted, worktree removed)

| # | Mutation | Result |
| --- | --- | --- |
| M1 | Dialog `onClose`: `takeLibraryClose()` moved above the focus return | survives (jsdom full + Dialog browser, both engines) |
| M2 | Dialog `openDialog`: `!modal && flags.takeRefused()` (no clear for modal) | survives |
| M3 | Dialog `beforetoggle`: drop `else flags.endClose()` on an open | survives (jsdom full + Dialog browser) |
| M4 | Dialog: install `listenDialogDismiss` also with native `closedby` | survives (Dialog browser) |
| M5 | Dialog: skip the JS dismissals whenever the flag is on (not native support) | killed, 4 jsdom rows |

Reading of the survivors:

- M1 is close to equivalent: a commit flushed by the focus return cannot mark the echo (the
  dialog is already closed, so the apply effect's close branch does not run), and `markFact()`
  comes later either way. The order is still worth keeping as is.
- M2 is equivalent today: the flag only survives while the dialog is open, and every later show
  is preceded by a fact (sets it) or a committed `false` (clears it). Same family as the
  developer's "takeRefused does not clear" survivor.
- M3 is a real, pre-existing gap: nothing tests a native open that lands between a close's
  `beforetoggle` and its `close` event (a foreign `show()` in the same task as a dismissal).
  Without the clear, `releaseIfIdle` would see `awaitingClose` until the `close` event. Worth a
  safety-net row in a later step. Not introduced by this branch.
- M4: with native `closedby` the platform closes the dialog before the JS `click` handler runs,
  which then returns at `!dialog.open`, so the extra listeners do nothing observable. The browser
  row's `requestClose` spy cannot see them. Fine as is.

## Findings, by severity

No blocker, no major.

1. **Minor (tests, pre-existing):** M3 above. No row covers the open-`beforetoggle` clearing of
   `awaitingClose` in Dialog (the popover hook's equivalent is `toggle` / `reshow`). Suggest a
   jsdom row for #157 phase 3 or the safety net: dismiss + foreign `show()` in one task, then
   check that the hold is released / the next apply is not blocked.
2. **Nit:** dialog-popup.tsx `openDialog`, `const refused = flags.takeRefused() && !modal;`.
   The operand order is load-bearing for the clear (equivalent today, see M2, but a reorder by a
   later refactor would silently change it). A short comment, or
   `const wasRefused = flags.takeRefused(); const refused = wasRefused && !modal;`, would pin it.
3. **Nit (naming):** `PopupFlags` names one flag three ways (`markFact`, `factAdopted`,
   `takeRefused`). The doc comment ties them together, so it reads well enough; consider
   `takeRefusedFact` if it is touched again. The other two groups (`beginClose` / `endClose` /
   `awaitingClose`, `markLibraryClose` / `takeLibraryClose`) read well.
4. **Nit:** the overlay-show.ts header says the pieces are shared "word for word"; Dialog's
   `&& !modal` is the caller's, which the developer memo says, but the header could say so too.

## Interfaces

- `createPopupFlags()` returning closures over three booleans is the simplest thing that keeps
  each operation at its old call site. Readonly members, no React, no directive: good.
- `showWithFocus(element, { refused, autofocus, show })` reads well: callers keep what differs
  (Dialog's modal exception, the popover hook's quiet focus, `opening`, `source`). Its unit
  rows cover consumer `inert` / `autofocus` and the throw path.
- `listenDialogDismiss(dialog, { modal, lightDismiss }) => cleanup` is a clean DOM-only
  boundary; the new cleanup row kills a mutation the old suite missed.

## Second opinion on #6 (the developer's recommendation)

I agree, with two notes.

- **Share only the apply effect (`useApplyOpenState`, driver `isShown` / `show` / `hide`):**
  agreed. It is the one part with the same algorithm and the most timing history (#147, #148,
  #155, #156). Notes: (a) both are dependency-free `useLayoutEffect`s and Dialog's mount
  reconciliation must keep running before it, so the shared hook has to be called at the same
  position in each component, and that order should be written down at the call site; (b) keep
  `factAdopted()` and the `releaseIfIdle` / `contentProbe.forget()` tail inside the hook, and
  put the focus fallback into `hide` as proposed, so that the driver stays at three members.
  Leave mount reconciliation out unless it fits without a fourth member; folding in a
  `jsFreeSync` member for the popover only is not worth it.
- **Do not merge the `toggle` / `close` and `beforetoggle` handlers:** agreed. The shared lines
  are now one-line flag calls, and the order differences (echo before vs after focus return,
  foreign-open routing at `beforetoggle` vs `command`) are exactly what a driver would hide.
- **Dialog listeners to a callback ref as a separate step:** agreed, as its own commit with the
  full browser suite (WebKit included in CI), because it changes when listeners exist relative
  to the first commit (the `defaultOpen` `beforetoggle` gap) and the render count. It also has to
  keep the dismiss listeners keyed on `modal` / `lightDismiss` / `closedBy`, which a callback ref
  does not re-run on its own; that is the part to design before coding it.
