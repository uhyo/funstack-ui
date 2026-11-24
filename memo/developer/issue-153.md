# Issue #153: explicit whole-value dispatch, Accordion `exclusive` fixed at mount

Branch `tidy/153`. Follow-up of the #145/#150 fold (075019c, issue-145-150.md).

## 1. `whole` dispatch option

- `useControllableAction().dispatch(next, details, options?)`; `DispatchOptions = { whole? }`
  (exported type from `internal/use-controllable-action.ts`, internal only; not in any public
  details type). With `whole`, `next` bypasses `reducer` in the optimistic reducer (patch carries
  `whole`) and in the uncontrolled burst replay (`BurstEntry.whole`). No-op without a reducer.
- `useNativeGroupReconciliation`'s `onPlatformChange(next, event, path)`; `path: NativeGroupPath`
  = `"mount" | "reset"`. Other callers (RadioGroup, Slider, Select, NumberField, checkable input)
  ignore the third arg, unchanged.
- CheckboxGroup: `dispatchPatch(..., reset)`; reset = `path === "reset"`; dispatches
  `{ whole: reset }`, `latestIsReset` set from the same flag. Reducer is now plain `applyPatch`.
- Accordion: mount reconciliation dispatches with `whole: true` (`dispatchChange(..., true)`);
  reducer is plain `reduce(..., false)`. A find-in-page reveal (event set) stays a per-item patch.

## 2. Accordion `exclusive`

- `const [exclusive] = useState(exclusiveProp)` + `useDevWarning` with ToggleGroup's wording.
  Everything (reducer, action value shape, context, static `name`) uses the mounted value.
- Docs page props table: "Fixed at mount: a later change is ignored (development warning)."
- Design: accordion.md 4.1 (reducer sketch, mount reconciliation paragraph, exclusive
  paragraph), section 2 mode note, 11 Mode guard row, 12 dev warnings; checkbox-group.md 5.x
  reducer sketch and the "load-bearing contract" paragraph replaced.

## Tests

- use-controllable-action.test.tsx: whole dispatch replaces in optimistic + replay; a superseded
  whole dispatch that rejects leaves no trace.
- use-native-group-reconciliation.test.tsx: `path` is "mount" (Root mount, late member) / "reset".
- accordion.test.tsx: pre-hydration close of a + open of b (uncontrolled) commits `{b}` (fails
  with `whole: false`: verified); `exclusive` change warns and keeps multiple mode.
- CheckboxGroup's existing #150/#151 reset tests fail with `whole: false` (verified), so they
  cover the new flag.
