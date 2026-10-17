# Developer memo: Popover (#40), 2026-10-17

Implemented `design/components/popover.md` (commit 9f4d928, accepted by the PO with all 8 open
questions as recommended). Branch `worktree-agent-a53037cd5ed289a71`.

## Shape

- `src/internal/use-popover-root.ts`: `usePopoverRoot({ component, part, open, defaultOpen,
  openChangeAction, details? })` returns `PopoverRootValue` (mode, ids, committed / optimistic /
  pending, `intended()`, `requestOpen` / `requestClose` / `notifyClosed`, `latestInFlight`,
  `triggerRef`, `popupRef`, close intents). Menu passes `component: "menu"` and its own `details`.
- `src/internal/use-popover-trigger.ts`: `usePopoverTrigger(ctx, { part, disabled, render })` ->
  `{ state, libraryProps, ref }`. Menu spreads its `aria-haspopup` / `onKeyDown` on top.
- `src/internal/use-popover-popup.ts`: `usePopoverPopup(ctx, { part, initialFocus, keepMounted,
  transition, onBeforeToggle?, onToggle? })` -> `{ setElement, visible, focusWasInside }`. Mount
  reconciliation, apply effect, native `beforetoggle` / `toggle` / `command` listeners, focus
  fallback (6.1 and 6.2), JS-free `aria-expanded` DOM write, dev warnings.
- `src/internal/use-exit-animation.ts`: the `held` flag (`holdUntil`, `release`,
  `holdDuringRender`, `waiting`) and `exitAnimations(element)`. Dialog's `exiting` could move here.
- `src/internal/anchor-position.ts`: `positionArea`, `POSITION_TRY_FALLBACKS`, `AnchorSide` /
  `AnchorAlign`; Tooltip imports it (behaviour unchanged, its tests untouched and green).
- Parts in `src/popover/`; `PopoverPopupContext` (in popover-context.ts) carries the Popup's state
  to Title / Description (outside a Popup they fall back to `{ open: committed, side: "bottom",
  align: "center" }`). The design listed `side` / `align` on the Root context instead.

## Menu extension points (design/components/menu.md 14, accepted after the Popover design)

Added after merging master: `usePopoverRoot({ mode: "library", onDispatch(next, details) })` and
`usePopoverPopup({ resolveInitialFocus(popup) })` (the open cause is Menu's own ref; the hook
just calls the resolver right before `showPopover()`). Tested in
`src/internal/use-popover-hooks.test.tsx`. Not done, left to #41: `onKeyDown` / `onFocusOut` /
`role` options on `usePopoverPopup` (Menu can attach them on its element), extra-handler merging
in `usePopoverTrigger`, `use-action-trigger.ts` (Close's own transition with superseded-rejection
surfacing, shared with Dialog.Close), `use-delayed-pair.ts`, and the shim's "hiding a popover
hides its nested popovers".

## Things the design did not spell out (decided in code)

1. **`intended()` reads a ref of the last committed optimistic value**, not the render closure.
   A Close action's continuation runs after an `await` with the closure of the click's render;
   with the closure it could dispatch a second `false` after a dismissal had already settled.
2. **Held content for dismissals.** The render-time derivation (committed true -> false, no
   `transition`) also fires for a dismissal's notification commit, which happens after the
   `toggle` listener already ran. The apply layout effect therefore releases a hold when the
   popup is hidden, no `toggle` is pending (`awaitingClose`) and no animation wait runs. One
   extra invisible commit per dismissal without exit animation. `toggle(closed)` releases
   immediately (in a transition) when there are no animations; an echo with `transition` set
   reads no animations at all (design 4.4).
3. **6.1 focus fallback implemented up front** (`ensureDialogFocus`): after the library's
   `showPopover()` on a `<dialog>`, if focus is not inside, focus the `initialFocus` target, else
   the first tabbable descendant, else the popup with `tabindex="-1"`. No-op in Chromium and
   Firefox (the platform already moved focus). Reason: WebKit cannot launch on this machine, so the
   "first WebKit CI run" check could not be done here; with the fallback the library rows assert
   the same in all engines, and a raw-platform browser row logs what WebKit itself does.
4. `defaultOpen` (true) renders the content and `aria-expanded="true"` / `data-open` in the
   server HTML, like Dialog (committed state); only the showing waits for hydration.
5. Mount reconciliation runs once (`[]` deps, `useEffectEvent`); the Trigger's callback ref also
   syncs `aria-expanded` in JS-free mode, for a Trigger that mounts after the Popup.
6. The no-name warning only fires for `role` dialog / alertdialog / menu (a `<div>` card with
   `role="group"` needs no name), once per instance.

## Test infrastructure

- `src/__tests__/invoker-shim.ts`: shared Invoker Commands click emulation (`registerCommandHandler`,
  `dispatchCommand`, `installInvokerShim`); the dialog shim and the popover shim register their
  commands. `dialog-shim.ts` re-exports `dispatchCommand`, so Dialog tests are unchanged.
- popover-shim additions (design 13.1): opening `beforetoggle` cancelable and honoured (a close's
  is not), `popoverSource(el)`, `show-popover` / `hide-popover` / `toggle-popover` invokers. Plus
  one not in the design: jsdom's UA sheet hides a `<dialog>` without `open` and jsdom refuses
  focus under `display: none`, so the shim marks shown popovers (`data-popover-shim-open`) and a
  `dialog[data-popover-shim-open] { display: block !important }` rule shows them (jsdom's UA
  `display: none` beats normal author rules regardless of specificity).
- `browser-user.ts` gained `tab` and `hover`.
- jsdom held-content tests read the DOM inside a `hidePopover` spy (the close commit), because the
  `toggle` task can run before an async `act` returns: asserting after the act was flaky.
- Browser ViewTransition rows click in-page outside `act` (as transition-boundary does). A Root
  "inserted by a transition" must be the top of the inserted subtree: wrapped in a new `<div>`
  it is shielded and starts no view transition.

## Results

- jsdom: `popover.test.tsx` 120 tests, `anchor-position.test.ts` 13, `use-popover-hooks.test.tsx` 3.
- Browser (`popover.browser.test.tsx`): 27 rows per engine, Chromium 156 and Firefox 157 green
  (3 consecutive runs, no act warnings). WebKit: not runnable locally (missing libgtk-4 etc.).
- Full gate after merging master: 1424 passed, 3 skipped (pre-existing).
- Docs live examples smoke-tested with Playwright against `vite preview` in Chromium and Firefox:
  JS-free open focuses the autofocus input, library open after the fetch, Archive closes with one
  `startViewTransition` call, no console errors.

## Watch on the first WebKit CI run

- The raw `<dialog popover>` focus probe logs `[webkit] ... move focus inside: <bool>`.
- Nested rows use `side={null}` on WebKit (302008); the nested flip row is skipped there.
- ViewTransition old-snapshot row runs on WebKit too (unprobed).
- `ToggleEvent.source` for a foreign invoker (Safari 26.5+; Playwright WebKit is trunk).
- Tab from a `<div>` popup's Trigger into the popup (DOM-adjacent, should pass).

## Review fixes (memo/reviewer/popover.md), 2026-10-17

Commits 35e57e1 (ui), a55c86c (docs), 2225079 (example).

- **H1** `usePopoverPopup` returns `wrapContent(children)`: an internal `ContentFocusProbe` whose
  layout-effect cleanup records `popup.contains(activeElement)` (React runs a deleted
  component's layout cleanups before detaching host nodes). `beforetoggle(closed)` ORs it into
  `focusWasInside`; the apply effect calls the shared `returnFocus` right after `hidePopover()`.
  Cleared on open and when content unmounts while the popup stays open. Menu must render
  `visible && wrapContent(items)` (or wrap inside its Activity) to get this for `requestClose`.
  Failing-without-fix verified: jsdom 6 rows, browser 4 rows (keepMounted rows pass either way,
  Activity does not remove the focused node).
- **M1** `useExitAnimation` releases with plain `setHeld(false)`. Browser row counts
  `startViewTransition` (fails without the fix in Chromium; Firefox animates no exit).
- **L1** `ensureDialogFocus` / `firstTabbable` removed. popover-shim runs the popover focusing
  steps in `showPopover()` (dialog: autofocus, first sequentially focusable, else the dialog,
  which jsdom only focuses with a borrowed `tabindex`). Shim display rule widened to every shown
  popover: jsdom's UA sheet hides `[popover]:not(:popover-open)` and its `:popover-open` never
  matches, so a `<div popover>` was `display: none` even when open (the old "Trigger inside a
  hidden popover" jsdom row was vacuous because of that; it now asserts the `blur()` call, since
  jsdom ignores `blur()` under `display: none`).
- **L2** `committedOptimistic` written in `useInsertionEffect`.
- **L3** Root value gains `openGeneration()` / `nextOpenGeneration()`: bumped by `send(true)` and
  by the Popup's `beforetoggle(open)` (all modes). Close records it at click, drops the close if
  it changed. jsdom note: the re-open click is entangled with the Close's pending async
  transition and commits with it.
- **L5** listeners attach in the callback ref; they call a `handlers` ref published in an
  insertion effect (calling `useEffectEvent` functions from a ref callback is a rules-of-hooks
  error). The JS-free `autofocus` write moved into the callback ref too; `popup` state is gone.
- Gate: typecheck, lint (clean, L4 warning gone), format:check, build,
  `FUNSTACK_BROWSERS=chromium,firefox pnpm test:run` 1443 passed / 3 skipped.

Design corrections for the architect (not edited by me): 4.4 "held -> false in a transition"
is now a normal update; 6.1 fallback paragraph is obsolete (WebKit verified); 6.2 rule 1 needs
"or focus was inside the content when the close commit unmounted it"; 14.2 hook result is
`{ setElement, visible, wrapContent }`; 14.1 Root value gains `openGeneration` /
`nextOpenGeneration`; 3.4 Close: stale close after dismiss + re-open is dropped; 2.5 / 3.1
`defaultOpen` wording (content and Trigger state are in the server HTML); 13.1 shim now runs
focusing steps.
