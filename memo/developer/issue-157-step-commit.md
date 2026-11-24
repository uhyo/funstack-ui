# #157 candidate 3: one step/commit core for Slider and NumberField

Branch `refactor/157-step-commit` (not merged). Internal refactor, no behaviour change.

## Result

- New `packages/ui/src/internal/use-step-commit.ts` (`useStepCommit<T, V, S, F>`): owns `live`
  (boxed), `stepHeld`, `pendingSource`, `liveRef`, `gestureStart`, `commitSeq`, `lastReason`,
  the commit channel (`useControllableAction` with the wrapped commit action and the `"dismiss"`
  revert) and the step channel (`useActionTrigger`, no re-entry guard), `shown` / `shownRef` /
  `pending`.
- API: `step(next, source, reason, event)`, `commit(source, reason, event)`, `openGesture()`,
  `captureGesture()` (open + `setLive(shown)`), `markGestureStart(start)` (Slider's native `input`:
  open unless open, reached value untouched), `takeEdit()` (for `useFieldValueChange`).
- Options for what differs: `toShown` / `fromShown` (Slider arrays, NumberField identity),
  `equals` (`equalValues` / `Object.is`), `details(reason, source)` (`thumb` / `source` key),
  `captured` (`gestureThumb !== null` / `hold !== null`), `normalize` (NumberField rounding
  before the no-op test), `onStep` (NumberField: clear draft, write hidden input), `onCommit`
  (NumberField: announce on an `"activate"` commit from a button / key / wheel).
- Lines: slider-root 872 -> 784, number-field-root 782 -> 709, core 271 (about half of it doc
  comments).

## Safety-net tests added first (d00345d)

- Slider "several inputs before one change are one gesture from the value shown before the
  first" (3 modes): fails when `inputStep` overwrites `gestureStart` on every input.
- NumberField "a press whose first tick steps nothing shows the current value, not an earlier
  gesture's": fails when `beginHold` drops `setLive(shown)`.

## Differences between the two copies

Intentional, kept as options: shape, equality, rounding, draft/hidden-input per step,
announcement per commit, details key, capture flag; Slider's lazy gesture start on native
`input` (slider.md 2.2) as `markGestureStart`.

Code-level only, unified (no observable change):

1. Slider's commit tested `liveRef.current === null`; NumberField could not (null is a value).
   Unreachable in both (a gesture start always comes with a reached value). Kept on the box.
2. Slider called `action?.()` after an `action === undefined` early return. Dropped the `?.`.
3. NumberField created `useActionTrigger` before `useControllableAction`, Slider after. The core
   uses Slider's order. The two hooks' effects are independent (useConnected, dev warnings).
4. NumberField's commit returned a boolean nobody read; Slider's returned void. Core: boolean.
5. NumberField's rollback tested the raw `valueProp`, Slider `value`; NumberField's `value` is
   `sanitize(valueProp)`, which keeps `undefined`. Same.
6. pendingThumb reaches Slider.Thumb raw (the Thumb masks with `ctx.pending`); NumberField masks
   in the Root (`pending ? pendingSource : null`). Same result; left as it was.

No behavioural difference that looked accidental was found.

Design drift noticed (not changed):

- slider.md 2.4 and number-field.md 2.4 pseudocode: the commit writes
  `gestureStart.current = next` after dispatching; the code clears `gestureStart` to `null` at
  the start of every commit. Same for the trailing `change`; the code's version is what makes a
  later native `input` open a fresh gesture.
- number-field.md 2.2/2.4 speak of `live: useState<number | null>` plus `liveSet`; the code boxes.
- slider.md 2 table: `gesture: useState<{ thumb } | null>`; the code has `gestureThumb: number | null`.

## Checks run

typecheck, lint, format:check, test:jsdom (3778 + 14), build: green. Browser tests
`src/slider src/number-field` on Chromium + Firefox: 57 passed, 5 skipped (pre-existing engine
skips: CDP-only rows on Firefox, the Firefox-only restoration row on Chromium).
