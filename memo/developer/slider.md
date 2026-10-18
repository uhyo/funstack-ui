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
resolves: both `isPending` stay true forever. On the real scheduler (no `act`) it completes. Plain
React repro: two `useTransition`s in one component, the first `setValue` on the parent with a
`use()`-suspending sibling, `act(() => step(70)); await act(async () => {}); act(() =>
commit(70)); await act(async () => resolve("70"))` -> parent stays 40. The jsdom "no snap /
suspended content" row therefore runs that part with `IS_REACT_ACT_ENVIRONMENT = false` and raw
`dispatchEvent` (Testing Library's fireEvent wraps in act). Candidate for an upstream report (a
human task); not filed.

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
