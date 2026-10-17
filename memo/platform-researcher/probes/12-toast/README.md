# Toast probes (2026-10-17, wave 5)

Run with `node <probe>.mjs` from this directory. Chromium 156.0.8078.4 and Firefox 157.0
(Playwright 1.64.1). WebKit still cannot launch locally (missing host libraries).

- `toast-platform.mjs` - `popover="manual"` region: no focus move and no auto-popover close on
  show, Escape ignores manual popovers, clicks in the region light-dismiss an open auto popover,
  modal dialog above the region (hit testing, `focus()`, real clicks, Chromium AX tree), re-show
  to raise the region above the dialog (still inert), a manual popover inside the dialog subtree,
  feature detection (`ariaNotify`, `interestfor`, `scrollsnapchange`, element-scoped VT).
- `reshow-focus.mjs` - synchronous `hidePopover(); showPopover()` keeps focus inside the region
  and does not close an open auto popover.
- `toast-lanes.mjs` - jsdom + React 19.3.1: a queue `setState` called inside `startTransition`
  while an unrelated async action is pending is held until that action settles; outside a
  transition, from a microtask, or after `await` it commits immediately.
