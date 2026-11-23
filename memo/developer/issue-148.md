# Issue #148: `openChangeAction` / `onOpenChange` (developer memo)

Design: `design/components/overlay-open-change.md` (accepted 0c3a3c0). Branch
`feat/148-on-open-change`.

## Step 1: the four probes of design section 11 (2026-11-24)

Probe source: `memo/developer/probes-148/issue148.browser.test.tsx.txt` (a throwaway vitest
browser file; it was run from `packages/ui/src/__probes__/` and removed). Chromium and Firefox
ran locally; WebKit ran in CI on a throwaway branch (`probe/148-webkit`, workflow_dispatch run
45215480609, job "browser (webkit)" green; branch deleted afterwards). React 19.3.1. The probes
ran with `IS_REACT_ACT_ENVIRONMENT = false` and a plain `createRoot`, so React's own scheduling
was observed, not `act`'s.

### Probe 1: updates from a native `toggle` / `close` listener batch into one sync commit

Setup: a parent with `useState(open = true)`, a child that owns `useState(epoch)` and a native
listener (`addEventListener`) on a `popover="auto"` `<div>` (`toggle`, `newState: "closed"`) or a
modal `<dialog>` (`close`). The listener calls `setEpoch(e + 1)` (library-internal urgent write)
and then the parent's `setOpen(false)` (the consumer's `onOpenChange={setOpen}`), then queues a
microtask that reads the DOM. Causes: real Escape (Playwright keyboard) on the popover, script
`hidePopover()` from a timer, real Escape on the dialog. Each with and without an unrelated async
transition pending elsewhere in the app (a `useTransition` whose action never settles).

Result, identical in Chromium, Firefox and WebKit, all 6 cases:

- `window.event.type` in the listener is `toggle` / `close` (React reads the priority from it;
  both are in react-dom's discrete list: `getEventPriority`, `toggle`, `beforetoggle`, `close`,
  `cancel` -> DiscreteEventPriority).
- One commit with both updates: layout-effect log `["epoch=1", "open=false"]`, nothing else.
- The commit has happened by the time a microtask queued after the two `setState` calls runs
  (sync lane, flushed in React's microtask): the DOM read gives `open=false`.
- The unrelated pending async action does not delay it (no entanglement for the sync lane).

Matches design 2.3 / 2.4 (one urgent commit; "an unrelated async action ... does not delay").

### Probe 2: the `useOptimistic` passthrough re-base drops a stale patch

Setup: `useOptimistic({ value: committed, epoch }, reducer)` where the reducer ignores a patch
whose `epoch` is older than the passthrough's. A transition dispatches a patch `{ next: true,
epoch: 0 }` and awaits a promise that stays pending (optimistic `true`, pending). Then a native
`toggle` listener (discrete) bumps `epoch` (urgent) and writes committed `false`.

Result, all three engines:

- with the epoch bump: the one commit after the fact renders `committed=false opt=false
  pending=true`; the stale patch is dropped in that same commit;
- control without the bump: `committed=false opt=true pending=true` (the stale patch survives,
  the bug the epoch prevents);
- when the old action later resolves: no further render of the optimistic value (nothing to
  revert to).

`pending` stays `true` until the superseded action settles, as design 2.5 states ("one honest
leftover").

### Probe 3: a re-open inside a running CSS exit

Setup: `popover="auto"` with `transition: opacity 400ms linear, display 400ms allow-discrete,
overlay 400ms allow-discrete`, `:not(:popover-open) { opacity: 0 }`, `@starting-style`. Shown,
settled at opacity 1, then a real Escape; the `toggle` (closed) listener calls `showPopover()`
either in the same task (what the library does: the commit after the fact re-applies
`open={true}` in that task) or 150 ms later (a re-open that waited for a request in flight).
Sampled every animation frame for 900 ms.

- **Chromium**: same-task re-open: the exit transitions had been created (3 animations before
  the re-open) but no frame had rendered them; `showPopover()` cancels them, opacity stays 1.00
  throughout, no flash. 150 ms re-open: exit had reached opacity 0.62; after `showPopover()` the
  opacity goes 0.62 -> 0.71 -> 0.83 -> 0.96 -> 1.00 (reversed from the current value, about
  half the duration), one animation, then none. Ends `:popover-open`, display block, opacity 1.
- **Firefox**: no CSS exit (the popup is `display: none` at the `toggle`, no animations; known:
  `memo/developer/cross-engine.md`, "Chromium additionally asserts it found exit animations").
  The re-open runs the normal `@starting-style` enter 0 -> 1 in 400 ms. Clean.
- **WebKit** (CI): same as Firefox: no exit animation at the `toggle` (display none, 0
  animations), the re-open runs the enter (1 animation). Ends shown, opacity 1. Clean.

So "the browser reverses it" holds where a CSS exit exists (Chromium); elsewhere there is no exit
to reverse and the popup visibly disappears and fades back in. No stuck or half-hidden state in
any engine. Not a contradiction of the design (2.4: "with a CSS exit in flight the browser
reverses it").

### Probe 4: a Server Function called outside a transition

Not runnable as a browser probe (needs an RSC framework). Read instead:

- React's client reference (`react-server-dom-webpack/client`, 19.3.1, the copy vendored by
  `@vitejs/plugin-rsc` 0.5.38 in this repo): `createServerReference(id, callServer)` returns
  `function action() { return callServer(id, args) }`. No transition check, no warning; the
  call is a plain `callServer` call whatever the caller's lane.
- Next.js (`packages/next/src/client/sequential-call-server.ts`, canary): `callServer` wraps its
  own `dispatchAppRouterAction` in `startTransition` unconditionally.
- React Router RSC (`lib/rsc/browser.tsx`, `createCallServer`): wraps its payload handling and
  the action rerender in `React.startTransition`; no check of the caller's lane, no warning.
- `@vitejs/plugin-rsc` starter (`setServerCallback`): `setPayload` is
  `(v) => React.startTransition(() => setPayload_(v))`; no warning.
- FUNSTACK Static (`@funstack/static`, the docs site): static output, no `callServer` at runtime.

So a Server Function passed to `onOpenChange` (called from the `toggle` / `close` listener, not
awaited) is accepted by every surveyed framework without a warning; the framework starts its own
transition for the re-render it causes. The returned promise is the library's to route
(`callUrgentHandler` -> `reportError` on rejection). Matches design 2.10.

**Conclusion: no probe contradicts the design.** Implementation proceeds.

## Step 2: implementation (2026-11-24)

Commits on `feat/148-on-open-change`: 676a5fd (library + tests), ac68dd0 (design docs),
ea2f351 / ada8796 (docs site, examples, skill), 2b243c5 (playground), then test comment
clean-up. CI (workflow_dispatch) on 676a5fd: ci, Chromium, Firefox, WebKit all green.

Where things live:

- `internal/call-urgent-handler.ts`: the on* rule (sync, try/catch -> reportError, a thenable's
  rejection -> reportError). Directive-free: repeats `reportDropped`'s two-line fallback instead
  of importing the client module.
- `useControllableAction.adoptFact(next)` + `epoch`. **Deviation from the design sketch**: the
  sketch put the epoch in an object passthrough (`useOptimistic({ value, epoch })`). That broke
  `use-popover-hooks.test.tsx` "whileShown is reinstalled when an inline ref re-runs": Maximum
  update depth. With an inline ref the Popup re-attaches its ref every render, the attach /
  detach write `shown` (false then true), and React normally bails out of the resulting render
  because no state changed; with the object passthrough the bailout no longer happens (the
  optimistic hook's state is an object, and the re-render re-attaches the ref, and so on). The
  epoch now lives in the optimistic reducer's closure (`patch.epoch < epoch ? prev : ...`):
  React re-applies pending optimistic updates on every render with that render's reducer, so the
  urgent `setEpoch` drops stale patches in the fact's commit all the same (jsdom row "close then
  open requested while shown, then a dismissal" pins it). Recorded in conventions 3.4.
- `useOverlayRoot`: `onOpenChange` option, mode detection, W1, `notifyClosed` = onDispatch +
  adoptFact(false) + callUrgentHandler; `epoch` and `hiddenBeforeToggle()` in the value (the
  latter from a `shownNow` ref next to the `shown` state).
- `usePopoverPopup`: `libraryHide` marker set before the apply effect's `hidePopover()`,
  consumed by **every** `toggle` (a coalesced hide+show must not leave it set).
- `use-popover-trigger.ts` / `combobox-trigger.tsx`: #115 path via `hiddenBeforeToggle()`.
- `dialog-popup.tsx`: `dismissedWhilePending` removed; every non-echo `close` is a fact.
- Toast: `callCloseHandlers` replaces `scheduleCloseActions` (no microtask, no transition).

Test notes:

- A row with a never-settling async transition poisons every later row in the same jsdom
  worker (`isolate: false`): React's entangled action lane is module-wide. The "unrelated
  action pending" row settles its promise before it ends.
- Firefox coalesces the hide and the re-show of a refused Escape into one `toggle` whose
  `newState` a later listener sees as "open": the Menu browser row only checks that a toggle
  arrived and that the menu is open again.
- The Menu sibling-item press row: a press on a sibling item closes an open submenu either by
  light dismiss (a fact) or by the hover close (a request with `"dismiss"`), engine and timing
  dependent; the row records both channels and checks the last is a `"dismiss"` close.

Not done / left:

- WebKit for the docs-only commits was not re-run separately (CI dispatched on the final head).
