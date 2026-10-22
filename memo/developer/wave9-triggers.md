# Wave 9: re-entry for every pure trigger (#81), disabled on non-button renders (#83)

Design: design/components/button.md sections 16 and 17 (2240658). Branch `wave9/triggers`.

## #81

- `useActionTrigger(options = {})`: `ignoreWhilePending` defaults to `true`; positional
  `openGeneration` form removed. Slider / NumberField `runStep` pass `ignoreWhilePending: false`
  with the "a step is not a re-entry" comment. Button calls `useActionTrigger()`.
- Dialog.Close / Popover.Close: the click was already always `preventDefault()`ed in their handler,
  so the ignored run only needs `run` to skip; `aria-disabled: pending ? true : undefined` (owned).
- Menu.Item: `activate(event)` gets the native click; `if (!run(...)) event.preventDefault()`.
  Enter / Space go through `element.click()` (keydown already cancelled), so the click carries the
  cancel. `aria-disabled: disabled || pending`. `isDisabledItem` keys on `data-disabled`.
- Toast.Action: `if (!started) event.preventDefault()`; owned `aria-disabled` while pending.
- New unit files: `internal/use-action-trigger.test.tsx` (H1, superseded-rejection rows under
  `false`, openGeneration), `menu/menu-dom.test.ts` (M6 + edgeItem).
- Mutation check: flipping the hook default to `false` and the steps to `true` fails 24 rows
  (all D/P/M/T re-entry rows, H1, H2 in both files).

### Deviations / findings

1. **M3 "Home / End skip a disabled first item"**: they never did. In-menu Home / End go to
   `items[0]` / `items.at(-1)` regardless of disabled (APG: disabled items are focusable); only
   `edgeItem` (the open focus, and the Trigger's ArrowDown / ArrowUp while already open) uses
   `isDisabledItem`. M3 tests arrows / Home / End / typeahead land on a pending item; the "open
   treats a pending item as enabled" half is a `menu-dom.test.ts` unit row on `edgeItem`, because a
   re-open dispatched while an item's action pends is entangled with it and commits only after it
   settles (the pending state is gone by the time `resolveInitialFocus` runs).
2. D3 ("Close without `action` clicked twice while the Root's close is pending"): asserted as one
   `openChangeAction(false)` (2 calls total incl. the open), one `close()`, no `aria-disabled`.
3. D4 / P3 / M4: the single-run rejection row also resets the boundary (key bump) and checks the
   next activation runs (a fresh hook instance; the in-flight decrement on reject is not
   observable through a boundary because the boundary unmounts the part).
4. T2: two rows (two clicks in one task -> one dispatch, rejection reaches the boundary, the toast
   is not ending; and the `closeOnSettle={false}` variant), replacing the two superseded rows.

## #83

- `focusable = !isHostButton(render) && installClick` per part; in that branch `disabled:
  undefined` (owned absent) and `aria-disabled` owned. Outside it `aria-disabled` stays
  pass-through (not owned), so a host-button Toggle / Trigger keeps a consumer's own
  `aria-disabled` as before; only the Close parts own it always (pending, #81).
- `usePopoverTrigger` (Popover.Trigger, Menu.Trigger, Menu.SubmenuTrigger): `ariaDisabled =
  disabledAs === "aria" || (isLibrary && !isHostButton(render))`. Menu is always library mode,
  so Menu.Trigger is always in the branch for link / component renders. Its click handler already
  `preventDefault()`s first.
- Dialog.Trigger: `installClick = isLibrary || !modal`; the JS-free non-modal disabled branch now
  `preventDefault()`s. Close parts: the click is already always cancelled.
- Toggle, ToggleGroup.Item, Combobox.Trigger / Clear: `if (disabled) { preventDefault; return }`.
- NumberField step buttons: `useStepButton`'s `onClick` `preventDefault()`s when disabled, before
  the pointer-gesture early return (a pointer click on a disabled link render would otherwise
  navigate: `pointerdown` returns early on disabled, so the click arrives with `detail > 0`).
- Form.Submit unchanged; regression row + jsdoc + docs sentence.
- Mutation check: `isHostButton` forced to `true` fails 26 rows (every new aria-disabled row).

### Deviations / findings

1. Not a deviation, a scope note: `aria-disabled` is owned only in the focusable branch (design
   17.2 only specifies that branch). Recorded so a reviewer does not expect it removed from a
   host button's pass-through.
2. Dialog.Trigger in JS-free non-modal mode keeps `data-disabled` absent (it is library-mode only
   today); the design says `data-disabled` is unchanged, so it stays absent there.

## Review fixes (memo/reviewer/wave9.md, a29e3ad), branch wave9/fixes

- M1: in the aria-disabled branch a disabled part also owns `commandfor` / `command` as absent
  (use-popover-trigger `noInvoker = ariaDisabled && disabled`, which also covers a disabled
  SubmenuTrigger; Dialog.Trigger `invoker = modal && !(focusable && disabled)`; Close parts
  `noInvoker = focusable && disabled`). I missed that without native `disabled` a component render
  is a live invoker before hydration. Rows per part + renderToString row for Menu.Trigger + an
  "enabled keeps its command" row.
- M2 / L1: MenuPage, Menu.Item `disabled` jsdoc and `isDisabledItem` jsdoc corrected: only the
  open focus (`edgeItem`) skips disabled items.
- L2: pointer click (`detail: 1`) assertion. L3: step-button `pointerdown` is cancelled before the
  disabled return (focus stays in the input); row per disabled cause. Mutation-checked.
- Fold 091d100 W8: `data-disabled` in every mode in which the part renders `disabled` /
  `aria-disabled`: JS-free Dialog.Trigger (modal and non-modal) and Popover.Trigger now emit it
  (`dataAttr(disabled)`). The old popover row "data-disabled is library mode only" was rewritten;
  Dialog / Popover data-attribute tables say "Trigger, Close ... (both modes)". W2 wording used
  for the Menu.Item and menu-dom jsdocs.
