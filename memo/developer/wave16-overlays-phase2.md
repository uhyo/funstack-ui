# Wave 16 overlays, phase 2 (#104, tracker #100)

Branch `wave16/overlays`, rebased on master after #101 (744f522). Structural findings of
`memo/reviewer/refactor-audit-overlays.md` plus C12 of the controls audit. One commit per finding
(O10 split into several pure-move commits).

## Done

- O4 + O3: `internal/overlay-popup.tsx` `renderOverlayContent`; `usePopoverPopup` reads
  `keepMounted` and returns `renderContent(() => children)` (thunk: children only resolved when
  rendered); `initialFocus` / `keepMounted` optional. `wrapContent` still returned (the hooks test
  uses it).
- O7: `useAnchoredPlacement` in use-resolved-placement.ts (`dataAttributes`, `style(consumer)`).
- O6 + C12: `disabledButton(render, disabled, { handlesClick, focusable })` in render-element.ts
  returns `{ focusable, props: { disabled, aria-disabled? }, invoker }`. Close parts keep their
  own always-owned pending `aria-disabled` (key order preserved), Button keeps its variant
  (`disabled: undefined` vs `false` is visible to a function render). NumberField's copy left to
  #105 (their file).
- O5: `internal/use-overlay-close.ts` renders both Close parts (`ownProps` slot keeps Dialog's
  `value` key position).
- O1 (+ O18 cast): `useOverlayRoot<Details, Popup, CloseArgs>` with required `details` builder and
  `isShown`; `usePopoverRoot` is an overload wrapper with the default `{ reason }` builder: the
  overload demands `details` when `PopoverLikeDetails` is not assignable to `Details`, so no cast.
  Dialog context renamed `dialogRef`/`ids.dialog` -> `popupRef`/`ids.popup` (O19).
- O2: `useCloseHold` (afterClose, releaseIfIdle), `useInitialFocusTarget`, `resolveInitialFocus`,
  `returnFocusToTrigger(popup, trigger, canFocus?)`, `commandOf`, `useJsFreePropWarnings`. Dialog
  keeps its effect-based JS-free autofocus (audit: timing).
- O10: menu-outside.ts, pointStyle -> menu-point.ts, use-menu-keyboard.ts, menu-gestures.ts
  (+ pure `armClickSwallow(slot, ...)`), toast-queue.ts (+ pure `applyCommands`, unit tests in
  toast-queue.test.ts), toast-hotkey.ts, toast-timers.ts (pure, map in a ref),
  use-modal-portal-host.ts, combobox-keyboard.ts, use-option-registry.ts, use-combobox-form.ts.
- O19: combobox `transitionTypes("combobox", "select")`; Tooltip.Trigger `type` doc; trimmed
  useResolvedPlacement and gesture docs. Toast.Viewport's JSDoc was already 8 lines; left.

## Not done / notes

- menu-dom.ts / menu-hover.ts keep "use client": `__tests__/directives.test.ts` lists their built
  files as client modules; dropping it needs a test change.
- Tooltip "[Tooltip]" prefix, Menu group label context shape, Menu.Item closeStackLater,
  dispatch continuations: skipped (dev-text change / behaviour risk / low value).
- Lines (non-test packages/ui/src): 26918 before, 27072 after (+154): dedup commits -95, O10
  splits +271 (module headers, imports, hook interfaces), O19 -22.
- WebKit not installed locally; CI covers it.
