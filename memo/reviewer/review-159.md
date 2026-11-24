# Review: fix/159-remount-mid-close (46c01fd on 92fe01d), issue #159

Verdict: **mergeable after minor fixes.** The fixes are doc and comment wording. One behaviour
gap should be written down or filed as a follow-up. The code is correct as written. It merges
cleanly: master moved only in memo/product-owner/status.md.

## Runs

- jsdom: dialog, popover, menu, combobox and internal/overlay-show: 11 files, 1207 passed.
- Browser (`FUNSTACK_BROWSERS=chromium,firefox`), dialog/popover/menu/combobox: 10 files,
  562 passed, 16 skipped. WebKit not run.
- tsc, lint (only the menu-submenu-trigger warning that was already there), format:check: green.
  The CHANGELOG diff only adds lines (0 lines removed).

## Mutations (scratch worktree, reverted, removed)

| Mutation | Killed by |
| --- | --- |
| Drop `flags.attach` in dialog-popup.tsx | 4 Dialog #159 rows |
| Drop the same-element guard in `attach` | Dialog and Popover "same element re-attached (an inline ref)" rows, plus the overlay-show unit row |
| Drop `flags.attach` in use-popover-popup.ts | 2 Popover #159 rows (Menu/Combobox have no rows of their own) |
| Drop only the `libraryClose = false` reset | Dialog "a controlled close ..." row (and the unit row) |

The tests fail without the fix and pin the same-element rule.

## Findings, by severity

### Minor 1: a dismissal lost to a remount is undone silently, and no design text says so

dialog-popup.tsx:205 / overlay-show.ts:86-91 together with use-apply-open-state.ts:67. A *fact*
close (Escape, light dismiss, script `close()` / `hidePopover()`) whose element remounts before
its `close` / `toggle` event has its event dropped (`onClose` gates on
`event.target !== popupRef.current`). `attach` clears `awaitingClose`. Committed is still `true`,
so the apply effect of the remount commit shows the new element: the popup the user just
dismissed comes back, takes initial focus again, and `onOpenChange(false)` is never called. The
tests pin this on purpose (dialog.test.tsx "a dismissal: the remounted dialog opens ...",
popover.test.tsx "a dismissal: the remounted popup opens ..."). It is clearly better than being
stuck. But dialog.md 2.5, popover.md 2.5 and the CHANGELOG only say the wait "ends". Fix: state
the outcome in both 2.5 sections ("a fact lost to a remount is not reported; the popup is shown
again"). Optionally file a follow-up issue: `attach` could treat `awaitingClose && !libraryClose`
as a lost fact and report it (`markFact` + `notifyClosed`), which would also need a refusal path.
The window is very narrow (a `transition` change committing inside the one task between
`beforetoggle` and the event), so documenting it is enough for now.

Library closes are fine. A library close (echo set) whose element remounts has nothing to report.
`attach` drops the echo, and the remount commit's apply sees committed `false` and a hidden new
element, so `releaseIfIdle` releases the hold. No `onOpenChange` is emitted or swallowed wrongly.
The old element's late event cannot hit the new state. Dialog's old listener is still attached
until the passive cleanup, but `onClose` / `onBeforeToggle` return early because `popupRef` points
at the new element. Popover's listeners are removed at the ref detach.

### Minor 2: "mutation phase" is wrong. Refs attach in the layout phase. The conclusion still holds.

design/CHANGELOG.md (new entry, "in the mutation phase"), memo/developer/issue-159.md ("i.e.
mutation phase"), overlay-show.ts:46-47 ("before the commit's layout effects"). In React 19.3.1,
`safelyAttachRef` runs in `commitLayoutEffectOnFiber` (react-dom-client.development.js ~15117 /
15179). Only the detach runs in the mutation phase. The ordering is still right: layout work is
children-first, and the `<dialog>` / popover element is a descendant of the Popup component, so
its ref attaches before the Popup's `useApplyOpenState` layout effect in the same commit. That is
what the tests observe. Reword it as "in the layout phase, before the Popup's own layout effects
(the element is its descendant)". Otherwise a later refactor might move the apply effect to an
ancestor-sibling and believe it is still safe.

Same element re-attaching through an inline ref: detach (mutation) and attach (layout) happen in
the same commit, synchronously, so no `close` / `toggle` task can run between them. `attach` is a
no-op, and the wait survives up to its event. StrictMode's double ref invocation behaves the
same. Correct. An A -> B -> A sequence clears on each change, which is correct as well.

### Low 3: the unreachability argument holds, with one exception (removing `open` by hand inside `beforetoggle`)

The HTML "close the dialog" steps: (1) return if there is no `open`; (2) fire `beforetoggle`
(closed, not cancelable); (3) return if there is no `open`; then queue the toggle task, remove
`open`, ..., and queue the `close` event at the subject. `requestClose()`, `closedby`, Escape and
light dismiss all go through "request close", which fires `cancel` *before* `beforetoggle`. A
cancelled close never reaches `beforetoggle`. So once the library's listener has seen a closing
`beforetoggle` and step 3 passes, the `close` event is queued at the same element. A re-entrant
`close()` from a `beforetoggle` listener makes the outer call return at step 3, but the nested one
queues the `close`. Fine.

The one path that is not covered: some `beforetoggle(closed)` listener (for example a consumer's
`onBeforeToggle`; React attaches it directly on the element, before the library's passive
listener) calls `removeAttribute("open")`. Step 3 returns, so no `close` event is ever queued, but
the library's listener still ran `beginClose`. The flag stays set. The removed `else endClose()`
cleared it only if a foreign `show()` followed; with or without the branch the library path stays
stuck. The memo's "removing `open` by hand (unsupported, and even then the queued `close` still
comes)" is true outside `beforetoggle` and false inside it. This is unsupported author code (HTML
warns against removing `open`), so the branch need not come back. Correct the memo sentence, or
mention it in dialog.md 2.5.

### Nit 4: Menu and Combobox have no #159 rows

They share `usePopoverPopup`, and mutation 3 is killed by the Popover rows, so the shared code is
covered. A one-row smoke test per component would only guard against a future fork of the hook.
Optional.

### Checked, no finding

- Dialog's listener-effect cleanup is a worse place for the fix, as the developer argues: the
  passive cleanup runs after the remount commits' layout effects.
- Only the developer's code comments in dialog-popup.tsx:202-204 / 371-372 describe the change
  (ordering wording: see Minor 2). The design 2.5 text is accurate apart from Minor 1. The
  CHANGELOG entry is accurate apart from Minor 2 and only adds lines.
- `refusedFact` is correctly left alone by `attach`; the unit row pins it.
- No public API change, so no docs-site props-table update is needed.
- I probed a Suspense re-hide (same element, detach and attach in separate commits) during a
  close in a scratch jsdom test. Not stuck: the close was adopted. No finding.
