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

---

# Follow-up review: 21bf43e (on 46c01fd), findings 1-4

Verdict: **mergeable after one small fix (Minor A).** Findings 1-4 are addressed. The refactor
keeps the old listener behaviour. The new replay has one stuck path, which 46c01fd did not have.

## Merge with master (5225cce)

Scratch merge: one conflict, in design/CHANGELOG.md. It is append-append: the branch's two #159
entries and master's "#157: conventions.md, second slimming pass" entry go at the same end of the
file. Keep both. dialog.md and popover.md merge cleanly. Conventions 3.9.x (3.9.4 and 3.9.5 are
cited) stays in conventions.md, and `check-design-refs` passes on the merged tree ("all 1083
section citations resolve"). The branch's CHANGELOG diff against 46c01fd is 28 added, 0 removed.

## Runs (merged tree)

- jsdom, dialog/popover/menu/combobox/internal/overlay-show: 11 files, 1214 passed.
- Browser, `FUNSTACK_BROWSERS=chromium,firefox`, dialog/popover/menu/combobox: 10 files, 562
  passed, 16 skipped. WebKit not run.
- tsc for packages/ui, lint (only the warnings that were already there), and format:check are green.

## Mutations (scratch worktree, reverted, removed)

| Mutation | Killed by |
| --- | --- |
| Drop `if (replaying) return` (allow a second replay) | only the overlay-show unit row |
| Dialog replay guard `popupRef.current !== null` -> `true` | Dialog "unmounts before the replay" row |
| Clear `awaitingClose` when the replay is queued | 6 rows (Dialog 3, Popover 2, unit 1) |
| Drop `flags.endClose()` in `replayLostHide` | 2 Popover #159 rows |

## Probes (scratch jsdom, Popover)

- Two remounts before the replay (A -> B -> C): one report, the popup stays closed, and the
  Trigger opens it again. Correct. No component row pins this; the unit row does.
- A Trigger click between the remount and the replay: `openChangeAction(false)` runs (committed is
  still `true`, so the Trigger toggles closed), then the fact is reported. The popup stays
  closed. This matches the no-remount baseline exactly (a click between `hidePopover()` and its
  `toggle`): same report, same action call. The click is swallowed, but this is the same
  window that already existed. The window is wider, though: a timer task instead of the
  DOM-manipulation task (4 ms clamp, background-tab throttling). Acceptable.
- Suspense hides the Popup in the window: see Minor A.

## Findings, by severity

### Minor A: a Suspense hide before the replay leaves the popup stuck and the fact unreported (regression from 46c01fd)

dialog-popup.tsx (the `flags.attach` callback in `libraryRef`, `if (popupRef.current !== null)`)
and use-popover-popup.ts (the same check in `setElement`). `popupRef.current === null` is used to
mean "the Popup unmounted". But a Suspense boundary above the Popup that shows its fallback
detaches the element's ref too, and the Popup stays mounted. Probe: hide, remount
(`transition`), then a sync update suspends an ancestor boundary, all before the timer runs. The
replay is skipped, so `awaitingClose` stays `true`. On reveal the same element re-attaches
(`attach` is a no-op), and the apply sees committed `true`, hidden, and awaiting, so it never
shows the popup. Trigger clicks do not help. `onOpenChange` is never called. Only another
remount gets it out (it queues a replay with the wrong `lost` element). At 46c01fd the same probe
re-showed the popup (the documented silent undo). The window is very narrow, but a stuck popup is
the #159 bug. Fix: tell "unmounted" from "ref detached". Options: a flag set by a passive effect's
cleanup (Suspense hiding does not run passive cleanups), or replay whatever the ref state and
let the unmount case be a no-op another way. At minimum, call `flags.endClose()` when the replay
is skipped. Add a row for each component.

### Low B: the docs say the replay runs "where the lost event would have run"

overlay-show.ts JSDoc, dialog.md 2.5 ("a task later, where its `close` event would have run"),
popover.md 2.5, and the CHANGELOG entry. The replay is a `setTimeout(0)`, a different task source
from the DOM-manipulation task the event used. It can run later, and an input task can run before
it (see the Trigger-click probe). Say "a task later (a timer)" and drop "where it would have
run", or state the ordering caveat. The CHANGELOG can only take an added line, so fix this in a
later entry or in the design text.

### Nit C: what the replay cannot know

- Popover: `replayLostHide` passes `lostInterest = false`. This matches what `takeLostInterest`
  would return after the detach's `interest.reset()`. A lost-interest hide that remounts would
  still get the focus-return fallback if `focusWasInside` were set. That cannot happen in
  practice (interest is lost only once focus has left), so this is fine. A one-line comment would
  help.
- Dialog: the focus-return fallback checks `element.contains(activeElement)` on the detached old
  dialog. That is always false after the removal, so an "opener gone, focus left inside" case
  ends on `<body>`. The platform's own restoration already ran synchronously inside `close()`,
  so only that already-degraded case is affected. No action.

### Checked, no finding

- No double report. Popover's listeners on the old element are removed at detach. Dialog's
  `onClose` / `onBeforeToggle` drop events whose target is not `popupRef.current`. The tests count
  exactly one `onOpenChange`. A second remount queues no second replay (unit row, plus probe).
- Controlled refusal: the replay calls `markFact` and `notifyClosed`, so the parent's
  `open={true}` gets the refused fact's re-open (Dialog and Popover rows). Uncontrolled: stays
  closed, with no `show` / `showPopover` call (spied).
- Unmount before the replay: nothing is reported (rows on both, killed by mutation 2).
- Refactor fidelity. Dialog `handleClose` is the old `onClose` body, verbatim, after the target
  guard. Popover `handleHidden` is the old `!isPopoverOpen` block, verbatim, still at the same
  point in `onToggle` (after `setShown` / `syncOpen`, before the `whileShown` start/stop).
  `replayLostHide` adds `endClose`, and the detach already did `setShown(false)`,
  `stopListeningWhileShown` and the interest reset. The echo is false, because only facts
  replay. `latestHandleClose` / `handlers.current` give the replay the latest render's closures.
- `details.event` is the intent's event, otherwise `undefined` (asserted). Dialog's `returnValue`
  is the old element's ("esc" asserted).
- Wording: "layout phase, children first ... must stay in an ancestor" is now in overlay-show.ts,
  both 2.5 sections, the CHANGELOG correction entry and the developer memo. Finding 3 is
  corrected in the memo. Menu and Combobox rows have been added.
