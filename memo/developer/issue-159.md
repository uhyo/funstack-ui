# #159: a remount during a close leaves awaitingClose set

Branch `fix/159-remount-mid-close` from master 92fe01d. Not merged.

## Bug

Element remount between a close's `beforetoggle` and its `close` / `toggle` event (a change of
`transition` swaps the ViewTransition wrapper): the old element's event reaches no listener.
Stuck: `awaitingClose` (committed-open popup never shown again; held close never released) and
the library echo (Dialog: the next dismissal is taken for the library's own close, not reported).

Popover: same bug, reproduced in jsdom (tests failed before the fix). Popover's stuck echo is
harmless in practice: every `toggle` consumes it, the open's included (mutation "drop the echo
reset" survives the Popover rows for that reason; it kills the Dialog controlled row).

## Fix

`PopupFlags.attach(element)` (internal/overlay-show.ts): a different element than the last one
clears `awaitingClose` and the echo; the same one is a no-op. Called in both callback refs'
attach (dialog-popup `libraryRef`, use-popover-popup `setElement`), i.e. mutation phase, before
the remount commit's layout apply.

Why not the listener effect's cleanup (the issue's suggestion):
- Dialog's listener effect is passive and keyed on `dialog` state. Remount commit A: ref sets the
  new element + `setDialog`, layout apply runs (flag still set). Commit B (dialog state): layout
  apply, then the passive cleanup. Nothing re-applies after it.
- A ref detach cannot tell a remount from a re-attach of the same element (inline consumer ref:
  new merged ref every render), and ending the wait there would re-open the race the flag guards.
  Pinned by the "same element re-attached (an inline ref)" rows (killed by dropping the guard).

Not handled (residual, rare): a stale close intent in the Root (Popover: a `popovertarget` /
`commandfor` close whose `toggle` was lost). `clearLater` drops it a task later when the new
element is shown; only a remount mid-close plus a hidden new element keeps it.

## M3 (#157 review): Dialog's `else flags.endClose()` at an open `beforetoggle`

Removed. HTML "close the dialog" queues the `close` event unconditionally once past the
`beforetoggle` (steps 1/3 return only if `open` is already gone), at the same element. The flag is
read only while the dialog is closed (apply's show branch, `releaseIfIdle` with `!shown`); closing
again goes through a closing `beforetoggle`, except removal (now `attach`) and removing `open` by
hand (unsupported, and even then the queued `close` still comes). With the fix, dropping the branch
kills no test in the full jsdom suite. Popover never had such a branch.

Rows: the two remount + foreign `show()` rows moved into the #159 block (they now pin `attach`).
"a native open between a close and its close event" now holds a no-remount row: `close()` +
`show()` in one task; the `close` event arrives, is reported, and the Trigger opens again.

## Tests

New: dialog.test.tsx "a remount during a close (#159)" (5 rows), popover.test.tsx "Popover: a
remount during a hide (#159)" (3 rows), overlay-show.test.ts attach row.

Runs: typecheck, lint (3 pre-existing warnings), format:check, build green; test:jsdom 81 files /
3915 tests; `FUNSTACK_BROWSERS=chromium,firefox` dialog, popover, menu, combobox browser files:
10 files, 562 passed, 16 skipped. WebKit not run.
