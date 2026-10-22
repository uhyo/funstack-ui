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
