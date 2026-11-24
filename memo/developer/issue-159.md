# #159: a remount during a close leaves awaitingClose set

Branch `fix/159-remount-mid-close` from master 92fe01d. Not merged. Commits: 46c01fd (fix),
then the review follow-up (memo/reviewer/review-159.md, findings 1-4).

## Bug

Element remount between a close's `beforetoggle` and its `close` / `toggle` event (a change of
`transition` swaps the ViewTransition wrapper): the old element's event reaches no listener.
Stuck: `awaitingClose` (committed-open popup never shown again; held close never released) and
the library echo (Dialog: the next dismissal is taken for the library's own close, not reported).

Popover: same bug, reproduced in jsdom (tests failed before the fix). Popover's stuck echo is
harmless in practice: every `toggle` consumes it, the open's included (mutation "drop the echo
reset" survives the Popover rows for that reason; it kills the Dialog controlled row).

## Fix

`PopupFlags.attach(element, replayLostFact)` (internal/overlay-show.ts), called in both callback
refs' attach (dialog-popup `libraryRef`, use-popover-popup `setElement`). Different element than
the last one during a close:
- library close (echo set): clear `awaitingClose` and the echo at once (nothing to report);
- fact (review finding 1): keep the wait set, `setTimeout(0)` replay of the lost event's handler
  on the old element (Dialog `handleClose(lost, undefined)`, Popover `endClose` +
  `handleHidden(lost, undefined, false, false)`). At most one replay queued (`replaying`); the
  callers skip it once the Popup unmounted (a `mounted` ref set by a passive effect). Not
  `popupRef.current === null` (second review, finding A): a Suspense hide detaches the ref while
  the Popup stays mounted, and skipping there left the wait set for good. A hidden Popup gets the
  replay and reports the fact (the dismissal happened before the hide); the reveal follows
  committed state. The replay is a timer task, not the event's task (finding B): it can run later
  and an input task can come first. Reported details: intent's
  `event` / `reason` if recorded, else `"dismiss"` and `event: undefined` (documented gap);
  Dialog's `returnValue` is the old element's.
- same element: no-op.

The first version (46c01fd) cleared the wait for facts too, so a lost dismissal was undone: the
popup re-showed and `onOpenChange(false)` never came. Fixed by the replay.

Timing (review finding 2, corrected): refs attach in the **layout** phase (only the detach is in
the mutation phase). Layout work runs children first and the popup element is the Popup's
descendant, so the attach runs before the Popup's `useApplyOpenState` layout effect of the same
commit. The apply effect must stay in an ancestor of the popup element.

Why not the listener effect's cleanup (the issue's suggestion):
- Dialog's listener effect is passive and keyed on `dialog` state. Remount commit A: ref sets the
  new element + `setDialog`, layout apply runs (flag still set). Commit B (dialog state): layout
  apply, then the passive cleanup. Nothing re-applies after it.
- A ref detach cannot tell a remount from a re-attach of the same element (inline consumer ref:
  new merged ref every render), and ending the wait there would re-open the race the flag guards.
  Pinned by the "same element re-attached (an inline ref)" rows (killed by dropping the guard).

No double report: the old element's event, if it ever fired, reaches no listener (Popover's
removed at detach; Dialog's `onClose` returns when `event.target !== popupRef.current`).

Not handled (residual, rare): a stale close intent in the Root when the lost close was a library
close. `clearLater` drops it a task later when the new element is shown.

## M3 (#157 review): Dialog's `else flags.endClose()` at an open `beforetoggle`

Removed. HTML "close the dialog" queues the `close` event unconditionally once past the
`beforetoggle` (steps 1/3 return only if `open` is already gone), at the same element. The flag is
read only while the dialog is closed (apply's show branch, `releaseIfIdle` with `!shown`); closing
again goes through a closing `beforetoggle`, except removal (now `attach`) and removing `open` by
hand. Removing `open` outside `beforetoggle` still leaves the queued `close` to come. A
`beforetoggle(closed)` listener that removes `open` is different (review finding 3): step 3
returns, no `close` is ever queued, and the flag stays set, with or without the branch (the branch
only helped if a foreign `show()` followed). That is unsupported author code (HTML warns against
removing `open`), so the branch stays removed. With the fix, dropping the branch kills no test in
the full jsdom suite. Popover never had such a branch.

Rows: the two remount + foreign `show()` rows moved into the #159 block. "a native open between a
close and its close event" now holds a no-remount row: `close()` + `show()` in one task; the
`close` event arrives, is reported, and the Trigger opens again. With the replay, the remount +
foreign `show()` dismissal row ends the same way (reported, closed).

## Tests

dialog.test.tsx "a remount during a close (#159)": foreign show + dismissal (reported), library
close + foreign show (hold released), inline-ref re-attach (no re-open), dismissal (reported a
task later with `returnValue`, no `event`, stays closed, re-opens), refused dismissal (reported,
new element re-opens), unmount before replay (nothing reported), controlled close (hold released,
re-open, next dismissal reported), Suspense hide before the replay (reported while hidden, closed
after the reveal, Trigger opens it). popover.test.tsx: the same set minus the foreign-show rows.
menu.test.tsx and combobox.test.tsx: one dismissal row each (review nit 4). overlay-show.test.ts:
two attach rows (library close; fact replay, one per lost close).

Mutations checked: no replay (old behaviour) kills 5 Dialog/Popover rows plus Menu and Combobox;
no unmount guard kills the Dialog unmount row.
