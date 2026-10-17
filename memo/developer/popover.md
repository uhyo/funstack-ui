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

- jsdom: `popover.test.tsx` 120 tests, `anchor-position.test.ts` 13.
- Browser (`popover.browser.test.tsx`): 27 rows per engine, Chromium 156 and Firefox 157 green
  (3 consecutive runs, no act warnings). WebKit: not runnable locally (missing libgtk-4 etc.).
- Full gate: 1397 passed, 3 skipped (pre-existing).
- Docs live examples smoke-tested with Playwright against `vite preview` in Chromium and Firefox:
  JS-free open focuses the autofocus input, library open after the fetch, Archive closes with one
  `startViewTransition` call, no console errors.

## Watch on the first WebKit CI run

- The raw `<dialog popover>` focus probe logs `[webkit] ... move focus inside: <bool>`.
- Nested rows use `side={null}` on WebKit (302008); the nested flip row is skipped there.
- ViewTransition old-snapshot row runs on WebKit too (unprobed).
- `ToggleEvent.source` for a foreign invoker (Safari 26.5+; Playwright WebKit is trunk).
- Tab from a `<div>` popup's Trigger into the popup (DOM-adjacent, should pass).
