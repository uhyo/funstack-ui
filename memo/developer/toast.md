# Developer memo: Toast (#54, wave 5), 2026-10-18

Implemented from `design/components/toast.md` (accepted) and the conventions amendments.

## Files

- `packages/ui/src/toast/toast.ts` (no directive): `createToastManager`, default `toast`, the
  command channel (`toastManagerInternals`, a WeakMap, not exported from index). Commands are
  batched per tick and flushed from one `queueMicrotask`; buffered on the client when no Viewport
  is subscribed; on the server every method is a no-op with one dev warning (never buffered).
- `toast-viewport.tsx`: the queue (`useState` + an authoritative `entriesRef` written together,
  so dispatchers compose a burst and keep side effects out of updaters), timers, pause sources,
  hotkey, focus return, popover apply / re-raise, announcements, `closeAction`, portal.
- `toast-root.tsx`, `-title`, `-description`, `-action`, `-close`, `toast-context.ts`.
- `internal/modal-registry.ts` (no directive) + `internal/use-modal-registration.ts` ("use
  client"); Dialog.Popup gets one hook call (`useModalRegistration(dialog)`) + one import.
- `ChangeReason` gained `"timeout"` (`internal/types.ts`).

## Decisions taken while implementing (not spelled out in the design)

- **Manager retains the queue across Viewport unmount** (design 14 item 11): on unsubscribe the
  manager asks the listener for its non-ending entries and hands them to the next subscriber
  (`restore`, before draining the buffer). Pending promise toasts keep `pending`.
- **`closeAction` is dispatched from a microtask** after the close commit, inside the Viewport's
  `useTransition` (`startTransition(async () => await closeAction(details))`). The design's 16.1
  row asks that it is not called synchronously inside the dismissal click; `startTransition`
  would call it synchronously, hence the microtask.
- **Exit**: `exitAnimations(root)` in a layout effect on `ending`, then `Promise.allSettled` and
  `viewport.drop(id)`. Not `useExitAnimation`: the hold lives in the Viewport's queue, and
  `holdUntil` + `held` would need a re-render to observe the release (a `true` -> `false` pair
  batched into one render would never drop). An ending entry without a registered Root is
  dropped by the Viewport's layout effect.
- **Announcements**: the Root announces in a **layout** effect (so visible toasts announce before
  the Viewport's effect announces queued ones: dispatch order). Queued toasts (no DOM) announce
  from the plain-text `title` / `description` (strings, numbers, arrays of them); when they
  later render, the DOM text is compared with the last announced text and skipped if equal.
- **Promise settle replaces** the options (keeps the id): the pending options' `description` or
  `action` must not leak into the success toast. `toast.update` merges (`undefined` removes).
- **`toast()` with an explicit id of an ending toast**: the ending entry is removed and a new one
  appended.
- **Title / Description function props** resolve against `ToastRootState` (the design names no
  `ToastTitleState`); documented on the docs page.
- **Viewport inside a Dialog warning** checks `use(DialogContext)`, not `closest("dialog")`: the
  latter cannot tell "rendered inside" from "portalled into".
- **Window blur/focus**: the listener ignores events whose target is a Node (in jsdom
  `document.defaultView !== window` identity-wise, so `target === view` failed).
- **Focus pause recovery**: a region remount (portal move) fires no `focusout`; the per-commit
  layout effect clears the focus pause if focus is no longer inside.
- **Registration hook**: `useModalRegistration` reads `:modal` after `beforetoggle` (a microtask
  later), and on `toggle` / `close`, instead of pushing right after `showModal()` inside Dialog's
  own code: keeps the Dialog edit to one call and counts every way of opening.

## Tests

- jsdom `toast.test.tsx`: 75 tests (all 16.1 rows). Note `getByRole("region", { name })` fails
  for the hidden region (dom-accessibility-api returns "" for hidden nodes); asserted by
  `aria-label` plus `getByRole("region", { hidden: true })`.
- browser `toast.browser.test.tsx`: 10 rows x engines; Chromium + Firefox green 3x locally.
  WebKit could not launch locally (host libraries), CI must confirm, especially:
  - re-raise: `root(first).getAnimations()` empty right after `hidePopover(); showPopover()`
    (design 4.2; fallback is `elementFromPoint` re-raise only when covered);
  - modal row: the region inside the `<dialog>` is hit-testable and focusable;
  - `ariaNotify` presence (`supportsAriaNotify` branch);
  - F8 via `userEvent.keyboard("{F8}")`.
- The final "data-paused gone" assertion in the browser focus row was dropped: Playwright's
  pointer can rest over the region from an earlier row and keep the hover pause.

## Observed in the example app

A Menu opened while an unrelated async action is pending does not open until that action
settles (transition held), so a toast.promise from that menu is necessarily later. Not a Toast
issue; it is the premise of the urgent queue.

## Review fixes (memo/reviewer/toast.md), 2026-10-18

- **H1, dismissals in order.** `apply` marks entries ending inside the loop: `dismiss()` closes
  what is open at that point of the batch, `dismiss(id)` likewise; an add after it is untouched.
  Side effects after the loop: `moveFocusOut` and the exit baselines only for ids that actually
  leave (a `dismiss(id); toast({ id })` pair keeps its keyed Root), `closeAction` for every
  dismissed entry (the replaced one included, `reason: "dismiss"`). The "ending entry replaced"
  branch clears the id's timer (fresh duration), `lastAnnounced` (L7) and exit baseline.
- **M1, exit hold.** Rule: wait only for animations that were not running just before the toast
  was marked ending. The Viewport snapshots `root.getAnimations({ subtree: true })` (a style
  flush) in `close` / `apply` before `write`; the Root's exit effect takes the snapshot
  (`exitBaseline`, kept until drop or replacement so a StrictMode effect re-run sees it too) and filters `exitAnimations(element)` by it. Why a snapshot and not
  `startTime` / `pending`: a progress bar paused under `[data-paused]` has `startTime === null`
  exactly like a just-created animation, so the timeline cannot tell them apart; identity can.
  A transition the ending style retargets is a new `CSSTransition` object, so it is waited for.
  Cost: one `getAnimations` per close, in the closing handler.
- **M2, no remount on the modal move.** `createPortal` remounts when its container changes
  (`updatePortal` compares `containerInfo`), so "same element type" alone does not help. The
  region now always portals into a library-created `host` (`div`, `display: contents`) that the
  library moves with `append`: into the topmost modal, or back into an inline anchor
  (`<div style="display: contents">`, rendered where the Viewport is). React never sees the move.
  Hydration: `useSyncExternalStore(…, () => true, () => false)` renders the region inline for
  the hydration render (matches the server HTML), then switches to the portal; the queue is
  empty then (subscription is a passive effect), so that one remount loses nothing. The move
  effect is declared before the region effect, which re-shows the popover the DOM move hid.
  Test note: the jsdom popover shim keeps a popover open across a synchronous `append`; one row
  stubs `append` to hide like a browser.
- **M3, consumer `<Suspense>` inside the Root.** Title and Description call
  `root.contentCommitted()` from a `[]` layout effect (mount, and re-show after a boundary hid
  them). After the Root's first announcement effect has run, this queues one microtask that
  re-runs the announcement (so a Title and Description revealed together announce one text).
  Timer: **not** fixed. Nothing committed tells the library that a consumer boundary shows its
  fallback: the Title inside it never mounts, which looks the same as a toast without a Title.
  Detecting it needs a render-phase flag ("Title rendered but not committed"), which a discarded
  render can leave set and freeze the toast forever. A clean option for the architect: a
  `fallback` prop on `Toast.Root` rendered by the library's own guard boundary (the guard then
  knows), replacing the consumer's own `<Suspense>`.
- **M4, throwing `success` / `error`.** `settle` wraps `resolveOptions`: on a throw it
  dismisses the toast and rethrows, so the returned promise rejects with what was thrown. Not the
  `error` toast: the operation's outcome is known and an error message would misreport a
  fulfilment; the bug reaches the awaiting action's boundary.
- **L1.** `RetainedToast.announced` carries the last announced text; `restore` seeds
  `lastAnnounced`, so a remounted Viewport does not repeat it.
- **L4.** `matchesHotkey` requires every unlisted modifier to be up.
- **L7.** See H1 (replaced branch clears `lastAnnounced`).
- **L8 (partial).** `rejected` starts from `internals.isTaken(listener)` (read in render), so a
  Viewport added while another holds the manager renders nothing from its first render; the
  lifecycle and hotkey effects install no listeners while rejected. Two Viewports mounted in the
  same commit still render the second region once (neither has subscribed yet), and the server
  always renders it.
- Not done: L2 (manager prop change), L3 (hover pause stuck when the region leaves under the
  pointer; the modal move no longer remounts, but the DOM move still delivers no
  `pointerleave`), L5 (queued toast dismissed renders once as ending), L6 (`blurred` initial
  state: `document.hasFocus()` is false in an unfocused iframe (Storybook, sandboxes, vitest
  browser mode) and in jsdom until something is focused, so seeding it would pause every timer
  there until a click; the blur event is the reliable signal).
- Flake: the browser exit row now uses a 5 s exit, asserts the held state, `finish()`es the
  captured animations and asserts the drop. A new browser row covers M1 with a paused 5 s
  progress bar.
