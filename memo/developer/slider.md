# Developer memo: Slider (#54, wave 5), 2026-10-18

Files: `packages/ui/src/slider/*`, widened `internal/use-native-group-reconciliation.ts`
(`element: RefObject<FormAssociatedElement | null>`, `onResetEvent` pass-through to
`useFormReset`). Example `packages/example/src/slider-demo.tsx`; docs `pages/SliderPage.tsx`,
`examples/SliderVolume.tsx`, `examples/SliderPrice.tsx`, `examples/slider.css`.

## Implementation notes

- `shown = held && live !== null ? live : toArray(optimistic)`, `held = gesture || stepPending ||
  commitPending`, as design 2.2. `stepTo` writes `liveRef` / `shownRef` synchronously so a
  commit in the same event reads them.
- Commit rule: `gestureStart` is `null` when no gesture is open; the commit no-ops without one.
  Keyboard sets it only when the `input` step actually dispatched; pointer and the vertical key
  path set `gestureStart = liveRef = shown` at the start. This avoids a stale `live` from an
  earlier gesture being committed by a trailing `change` or a press-and-release on the value.
- Gesture start also `setLive(shown)`: a capture alone makes `held` true, and a press exactly on
  the current value steps nothing, so without it the thumb jumped to the previous gesture's
  value (found while reviewing; jsdom row "a press on the current value...").
- Reconciliation `equals` sanitises both sides against the shown neighbour bounds (`sanitize`
  in `slider-arithmetic.ts`): browsers sanitise an off-grid consumer value in the DOM, jsdom
  does not; neither is a platform change.
- `Slider.Root` is exported as an overloaded const (`SliderRootProps<number>` /
  `<readonly number[]>` / `<SliderValue>`) so an array literal infers `readonly number[]` (a
  plain generic infers mutable `number[]`).
- `Slider.Value`'s implementation function is `SliderValuePart` (name clash with the
  `SliderValue` type); displayName is `SliderValue`.

## Deviations from the design (report)

- `SliderLabelProps` is generic (`<T extends SliderValue = number>`) like `SliderValueProps`;
  the design's non-generic `SliderRootState` would type an array slider's state as `number`.
- `aria-valuemin/max/now/valuetext/orientation` are omitted from Root and Thumb props (design
  14.1 type row says `aria-valuenow` is not a prop). JSX does not type-check hyphenated names,
  so the type test asserts on the props types.
- `slider-arithmetic.ts` has no directive (design 15), although 14.1's "Directive" row says every
  file except `index.ts` is a client file. Followed 15.
- Rollback animation browser row: a rejected save throws to the boundary above the Root, which
  unmounts the slider, so the slide-back is not observable there. The row instead uses a
  controlled parent that does not adopt (the same visual move) and asserts exactly one
  `transitionstart` of `--slider-value`, at release, none during the drag. Design walkthrough 2
  ("the thumb slides back") holds only for a boundary that keeps the slider mounted (none
  exists by construction); worth a sentence in the design.
- Superseded commit rejection with an **adopting** controlled parent (`setValue` in the step
  action): the boundary receives it only after the newer commit settles. React holds the
  parent's entangled transition update until every async action of the scope settles, and the
  error-retry render reads it. Uncontrolled and update-on-success reach the boundary at once.

## React test-environment finding (act)

Under `act()` (React 19.3.1, jsdom), a transition that suspended (step: parent `setValue(70)`
renders a suspending child) followed, in a later `act`, by a second async transition
(`startTransition(async () => { setOptimistic(v); })`) never completes after the suspended data
resolves: both `isPending` stay true forever. **Cause (reviewer, L4): the sync `act(() => ...)`
around the suspending update.** React logs "A component suspended inside an `act` scope, but the
`act` call was not awaited" and documents sync `act` + suspension as unsupported. With
`await act(async () => ...)` everything completes. Not a React bug; nothing to report. The
"no snap / suspended content" row now uses awaited `act` around raw `dispatchEvent`
(`withoutAct` removed). Rule: any interaction that may suspend goes in `await act(async ...)`.

## Engines

Local: Chromium 156 and Firefox 157, slider browser rows green. WebKit does not launch on this
machine (no host deps). CI must confirm on WebKit:
- native range keys: PageUp/PageDown = 10 % of the range, Home/End, RTL mirroring of Left/Right
  on a horizontal range (WebKit's radio arrows do not mirror; ranges unknown);
- vertical `writing-mode: vertical-lr; direction: rtl`: Up increases;
- real pointer press and `dragAndDrop` with pointer capture; `:focus-visible` false after
  `focus({ focusVisible: false })` from a pointer press;
- the pre-hydration iframe row (keyboard fallback is in place for WebKit);
- `@property` + `transitionstart` on a custom property.
Firefox form-state restoration across a srcdoc iframe reload happened locally (no warning).

## Review fixes (2026-10-18, memo/reviewer/slider.md)

- H1: horizontal + computed `direction: rtl` on the input -> ArrowLeft / ArrowRight handled from
  `keydown` (prevented, Left = +step), same path as vertical. Read at each keydown from
  `event.currentTarget` (no instanceof: the pre-hydration row uses an iframe realm).
- M1: a Thumb press whose value is shared with neighbours (stacked) uses the tie rule: the
  pointer above the value -> the last of the stack, below -> the first; exactly on the value ->
  undecided (the pressed thumb shows `data-dragging` and focus) until the first move off the
  value, which picks and moves focus / `data-dragging` to the chosen thumb. Track presses
  unchanged (`nearestThumb`).
- M2: `stepTo` starts no step transition when there is no `valueChangeAction`: nothing pending
  during a drag. With an action each step is a real transition, so a sync action still blinks
  `data-pending` per move; documented, the docs / example CSS style the spinner on
  `[data-pending]:not([data-dragging])`. Pitfall found by the Firefox Home / End row: without
  the step transition nothing held `live` between a key's native `input` and `change`, so
  react-dom restored the controlled input to the old value after `input` and Firefox then fired
  no `change` (Chromium does). New `stepHeld` state: set by every non-`"dismiss"` step, cleared
  by `commitGesture`; part of `held`. jsdom row "a key's input holds the value until its change".
- L1: rejection rows renamed; the boundary row asserts the slider is gone; a retry-boundary row
  (per mode) asserts what the remount shows; a mounted rollback row (update-on-success parent,
  save failure caught in the action) asserts the thumb returns to 40.
- L2: `Slider.Value` / `Slider.Label` generics default to `SliderValue`, not `number`.
- L3: `pointerup` steps to the release position before the commit (a step with
  `event.type === "pointerup"` when it differs from the last move); cancel / lost capture keep
  the last move.
- M3 (#62): Firefox instance `fileParallelism: false`; drag row strict again. See
  cross-engine.md.
- Seen once (one full gate run, 70 files, other agents active): Chromium "a roll back animates
  the registered property" got two `transitionstart`s instead of one. Not reproduced: 4/4
  isolated, 12/12 under 4 parallel runs + CPU load, 4 more full runs green. jsdom row "release
  returns once, no bounce" pins that the shown value does not go 80 -> 20 -> 80 at release with
  no actions. Tried releasing `stepHeld` in a transition instead of urgently: it entangles with
  the pending async commit and delays the superseded-rejection boundary render; reverted. Watch
  CI for a recurrence.
