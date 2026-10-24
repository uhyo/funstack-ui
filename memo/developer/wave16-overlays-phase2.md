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

## Review fixes (memo/reviewer/wave16-overlays-review.md)

- B1/L6: one `useOverlayRoot` (file `internal/use-overlay-root.ts`), required `details`;
  `popoverDetails` exported and passed by Popover, Menu and Combobox (Menu did not pass its own,
  contrary to the review's note). Types: OverlayMode, OverlayCloseIntent, OverlayDetails;
  `PopoverRootValue` stays as the alias for the popover-like hooks.
- B2: combobox-keyboard.ts folded back; keyDown / move byte-identical to the pre-split code.
- L1 `alwaysFocusable`, no `focusable` result; L2 `wrapContent` gone from PopoverPopupHook (the
  hooks test uses `renderContent`); L3 call-site comment; L4 orphan comment removed.
- O19: menu-dom.ts / menu-hover.ts directive-free; directives.test lists them and the new pure
  overlay modules as directive-free.
- M1: Dialog records close intents only in JS-free mode, where nothing reports them, so its
  stale-clear row probes `DialogContext` directly; Popover's row is behavioural. Mutations
  (Dialog isShown removed / false; clear disabled) fail.
- M2: Toggle + Popover.Trigger rows; a component render stands in for the function form (a
  function render is a host button for these parts, so never in the focusable branch). Both
  review mutations fail two rows each.
- L5: JS-free Toolbar reset (toolbar.test), outside initialFocus, command case (popover.test).
- Not amended: commit 70ab307 says the portal host is "called where [it was]"; that holds for
  its layout effects, but its `useSyncExternalStore` (the modal container) now runs after three
  `useEffect`s, so its passive subscription follows theirs. Harmless (uSES re-checks the
  snapshot on subscribe).
