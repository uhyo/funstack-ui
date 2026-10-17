# Stable shared hooks and memoised contexts (#48)

## What changed

- `internal/use-latest.ts`: `useLatest(value)` = ref written in `useInsertionEffect` (last
  committed render's value; current in every layout effect of the same commit, child ones too).
  Same pattern `usePopoverRoot` already used for `committedOptimistic`.
- `useControllableAction`: `dispatch`, `adopt`, `latestInFlight` (and internal `settle`) are
  `useCallback`s with stable deps; `dispatch` reads `committed`, `isControlled`, `action`,
  `transitionTypes` from `useLatest` **once at the call** (so the post-`await` write still uses the
  mode of the UI the user acted on). Return value `useMemo`'d on
  `committed/optimistic/pending` + the stable functions.
- `usePopoverRoot`: `details` / `onDispatch` through `useLatest`; `intended`, `send`,
  `requestOpen/Close`, `notifyClosed` stable; `ids` memoised; return value memoised.
- Context values memoised: Dialog, Tabs, RadioGroup, Select, Select.Group, Accordion (was
  deliberately unmemoised because `dispatch` was unstable), Menu.RadioGroup, Menu.Group/RadioGroup
  `{ labelId }`. MenuRoot's existing memo and Menu.Popup's `listContext` memo now hit.
- Accordion: `rootPending` computed directly instead of `state.pending` (the compiler lint flagged
  the memo as unpreservable because `state` is passed on to `useRender`).

## Semantics note

A function obtained in an earlier render now uses the props of the **last committed render**
rather than those of its own render. In practice no difference: handlers and effects always came
from the latest commit anyway. Dialog's `intended` still closes over render-time `optimistic`
(kept as before; it is a dep of its `useCallback`).

## Not memoised (not cheap)

- Combobox root context: many per-render functions (`accept`, `clear`, `typed`, `keyDown`, ...)
  closing over render state. Would need a larger refactor.
- CheckboxGroup root context: `renderedValue` is a new array per render, `toggle`/`apply`/
  `sortByDocument`/`onItemMounted` are per-render closures.
- Popover.Popup's `PopoverPopupContext` value is the render-function state object.

## Tests

- `use-controllable-action.test.tsx` "referential stability": same object across re-renders with
  inline options; functions survive state changes; a stable `dispatch` uses the latest action,
  transition types and committed value.
- `use-popover-hooks.test.tsx`: `usePopoverRoot` value stable; `requestOpen` reaches the latest
  `onDispatch`.
- `context-stability.test.tsx`: parts (counted through a `className` function) do not re-render
  when the owner re-renders the Root with a new inline action. `Profiler` does **not** work for
  this: with lazy context propagation, a bailed-out Profiler fiber never gets `Update`, so
  `onRender` misses consumers re-rendered by context. Verified the tests fail against the old hook
  (6 of 7; Select's context never contained `dispatch`).
