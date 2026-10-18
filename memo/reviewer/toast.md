# Review: Toast (#54), 2026-10-18

Scope: 3266e4e..fa6e481 (merged at 03404ef). Checked against design/components/toast.md (accepted,
with the PO amendment that a server-side `toast()` is a no-op and never buffered),
design/conventions.md, docs/vision.md, memo/developer/toast.md. CI on 03404ef is green on all three
engines, WebKit included.

Verdict: **acceptable with fixes.** One High bug (command order in a batch) must be fixed before
release; the Mediums should be fixed or recorded as issues. The architecture is sound: the
microtask dispatch really does escape transitions, the server path is safe, and timers and
subscriptions are cleaned up.

Items marked "verified" were reproduced with a scratch jsdom test that is not in the repo.

## High

**H1. `dismiss()` in a batch runs after every add in that batch, which breaks "order is
preserved".** `toast-viewport.tsx:404-459` (`apply`). Dismissals are collected during the loop and
applied after it. For `dismiss()` (all), the ids come from the final `next` (line 455-457), so
the set includes toasts added later in the same tick.
- Scenario (verified): an action calls `toast.dismiss(); toast({ title: "Saved", closeAction })`.
  The new toast never shows, and its `closeAction` runs with `reason: "dismiss"`. With the
  Gmail-style undo window (design 9.3) that means `deleteForReal` runs at once.
- Same bug with an explicit id: `toast.dismiss("sync"); toast({ id: "sync", ... })` in one tick.
  The add merges into the still-open entry, and then the dismissal closes it.
- Fix: apply each dismiss in sequence. Mark entries ending inside the loop and resolve
  `undefined` against the current `next`. Keep the side effects (focus move, closeAction
  scheduling) after the loop, but only for the ids that were closed at that point.
- Test to add: "dismiss() then toast() in one tick shows the new toast", plus the explicit-id
  variant.

## Medium

**M1. The exit hold waits for every finite animation in the subtree, including the documented
progress bar.** `toast-root.tsx:174-189`, `exitAnimations` (subtree, finite).
- Scenario (from the example's own CSS, `packages/example/src/toast-demo.css:99-113`): the
  progress bar has `animation: toast-progress 5s` and is paused under `[data-paused]`. The user
  clicks Close 1 s after the toast appeared. The pointer is over the region, so the region is
  paused and the progress animation is paused with it. The toast stays mounted as `data-ending`
  (inert, invisible) until the pointer leaves plus the remaining ~4 s. The region stays in the top
  layer and `data-empty` stays off for that whole time.
- Design 15.6 recommends exactly this progress bar.
- Fix: only hold for animations that the ending change started. Snapshot `getAnimations()`
  before `data-ending` applies, or keep transitions and animations whose `startTime` is null or
  at or after the ending commit. Otherwise document that progress animations must leave the
  subtree when `[data-ending]` is set.

**M2. The portal move remounts the whole region subtree, so a running Undo loses its pending
state.** `toast-viewport.tsx:753`.
- Switching between `content` and `createPortal(content, container)` changes the element type,
  so every Root, Action and `useActionTrigger` remounts. The design accepted the DOM remount; it
  did not consider the React state.
- Scenario: the Undo action opens a library modal Dialog (for example "Confirm undo?") and
  awaits it, and the toast has `duration: 8000` (the 9.3 pattern).
  1. The region moves into the dialog and the Action remounts.
  2. Its layout-effect cleanup calls `setActionPending(token, false)`. `data-pending` disappears
     and the toast's timer resumes while the Undo is still in flight.
  3. The timer elapses, the toast closes with `"timeout"`, and `closeAction` runs `deleteForReal`
     during the undo.
- The same remount also leaves `pauses.hover` stuck (see L3).
- Possible fixes: give both branches the same element type, for example always portal, with a
  stable inline host element as the container when no modal is open. Or keep action-pending
  ownership in the Viewport keyed by toast id, not in the Action instance.

**M3. A consumer `<Suspense>` inside the Root (the design's recommended skeleton) silences the
announcement for good.** `toast-root.tsx:159-171`.
- With the consumer boundary the guard never mounts. The Root's layout effect runs at the first
  commit and reads `titleRef` as null, so it records `""` in `lastAnnounced`. The reveal is a
  retry inside the boundary and does not re-run the Root's effect.
- Scenario (verified): `title: <Avatar/>` inside `<Suspense fallback={<Skeleton/>}>`.
  `ariaNotify` is never called. The timer also starts while the content is still a skeleton.
- Fix: have Title and Description report "committed with text" (from their ref or a layout
  effect) and trigger the announcement then. Or do not record empty text in `lastAnnounced`
  (lines 486-488), so a later re-render can still announce. Add a test row; the current row at
  toast.test.tsx:1228 asserts only the fallback.

**M4. `toast.promise`: if a `success` or `error` function throws, the pending toast is stuck
forever.** `toast.ts:275-296`.
- `resolveOptions(success, value)` throws inside `then` before anything is dispatched.
- Scenario: `success: (r) => ({ title: r.name })` with `r` undefined. The returned promise
  rejects with a TypeError, but the toast keeps `data-pending`, never gets a timer, and stays
  until something dismisses it.
- Fix: wrap the resolution in try/catch and dismiss the toast (or settle it with `error`), then
  rethrow.

## Low

- **L1. Restored toasts are announced again on every Viewport remount** (verified:
  `ariaNotify("Archived")` twice). `restore` (viewport:494) starts with an empty `lastAnnounced`.
  A route-level Viewport (design 14.11) repeats a persistent "Archived, Undo" on each navigation.
  Carry `lastAnnounced` text in `RetainedToast`, or mark restored entries as announced.
- **L2. A `manager` prop change mixes the two queues.** The effect at viewport:554-568
  unsubscribes m1, which retains its entries, but the entries stay in the state. When it
  subscribes to m2, `restore` is ignored because the state is not empty (line 495). So m2's
  retained toasts are lost, and m1's toasts are now driven by m2's `dismiss`. Reset the entries
  when the manager changes, or key the internals by manager.
- **L3. Hover pause can stick after a remount.** A remount (portal move) or a region removed
  under the pointer delivers no `pointerleave`. The per-commit check at viewport:631-637
  recovers the focus pause only, so `data-paused` and every timer stay paused until the pointer
  enters and leaves the new region. Clear `hover` on a container change, or check
  `region.matches(":hover")` in the same effect.
- **L4. The hotkey does not reject extra modifiers.** `matchesHotkey` (viewport:111) accepts
  Ctrl+F8, Alt+F8 and Shift+F8 as F8. Radix has the same behaviour. Consider requiring the
  modifiers that are not listed to be false.
- **L5. A queued toast that is dismissed is rendered once as an ending Root.** `partition` puts
  every ending entry in the visible list, so `dismiss()` with toasts beyond `limit` mounts them
  with `data-ending` just to drop them. They can flash with slot-collapse CSS. Drop never-shown
  entries directly.
- **L6. The `blurred` pause is not initialised at mount** (viewport:576). The Viewport sets
  `hidden` from `visibilityState`, but a Viewport mounted while the window has no focus
  (`!document.hasFocus()`) runs its timers until the first blur and focus pair.
- **L7. Re-adding an ending id with the same text is not announced.** `toast({ id })` on an
  ending entry reuses the keyed Root, and `lastAnnounced` was never cleared because `drop` did
  not run, so the same text is skipped. Delete `lastAnnounced` for the id in the
  "ending entry replaced" branch (viewport:424).
- **L8. A rejected second Viewport briefly renders a second named region** before its effect
  sets `rejected`, and on the server always does. It also installs document listeners. This
  falls under the dev-warning case, so it is cosmetic.

## Checked and fine

- **Urgent queue.** The microtask flush runs outside any `startTransition` scope. The Lanes tests
  cover the sync prefix, a consumer `startTransition` and a plain call. The Action's `then`
  (close on settle) runs after an `await`, so it is urgent as well.
- **Server.** `onServer()` is checked first in every method and nothing is pushed to `buffer`.
  The only module-level state that survives is the id counter and the warn-once flag, and
  neither carries user data. The modal registry is written only from layout effects. Matches
  the PO amendment.
- **Leaks.** Timers are cleared on unmount and by `syncTimers` when a toast becomes ending.
  `roots` and `suspended` are cleaned by ref and guard cleanups, and `lastAnnounced` on drop.
  Registry entries are removed on close and on unmount. A manager without a Viewport keeps
  `retained` and `buffer` by design (14.11). They are bounded by the consumer's own calls.
- **Roles.** `dialog` / `alertdialog`, `tabindex=0`, labelled-by and described-by; the region is
  named and drops the parenthesis when the hotkey is disabled.
- **Focus.** Focus moves to the next toast, else the previous one, else the remembered element,
  else blur, and it moves before the toast is marked ending. Escape inside a modal dialog does
  not close the dialog (Dialog skips manual popovers).
- **Promise semantics.** The returned promise mirrors the input; a rejection resolves to
  `undefined` when `error` was given; settling replaces the options rather than merging them.
- **Action rejection** reaches the boundary, and superseded rejections are surfaced, through
  `useActionTrigger`.
- **closeAction** runs in a microtask and then in the Viewport's transition.
- **Suspense guard** (without a consumer boundary): no announcement and no timer until the
  reveal.
- **Exit drop.** It is idempotent and guarded with `cancelled`.

## Test quality

The test suite is broad: all rows of 16.1 are present. Gaps:
- No test for H1 (order of dismiss and add in one tick).
- No test for M3 (announcement with a consumer Suspense boundary).
- No test that a remount keeps action pending (M2).
- No test that restore does not re-announce (L1).

Every timer test uses fake timers, so there is no timing flakiness in jsdom.

## Flake: "animates the enter; holds the closed toast with data-ending until its animations settle"

The cause is in the test; the library has no race here. In `toast.browser.test.tsx:292-297`:
1. The click goes through Playwright (an RPC round trip).
2. Close commits `data-ending`, and the Root's layout effect starts the 120 ms exit transition.
   `Promise.allSettled(...).then(drop)` then runs on its own clock.
3. The test only reads the state after `user.click` resolves.

Under full-suite load that round trip, plus the `act` flush, can take more than 120 ms. When it
does, the transition has already finished: `root(id)` throws because the toast was dropped, or
`getAnimations()` is empty.

The library code itself is deterministic. The animations are captured synchronously in the same
layout effect that applies `data-ending`, after a style flush, and the drop is gated on them. No
re-render in between cancels the hold, because the effect's dependencies are `[ending, id]`.

Fix: give the exit a long duration in this test only, for example
`.toast[data-ending] { transition-duration: 5s }`. Assert the held state, then `finish()` the
captured animations (or wait on them) and assert the drop. The assertions no longer race a
wall clock that way.

## Should be filed as GitHub issues in this repo (not external)

- H1, M1, M2, M3, M4 if they are not fixed right away.
