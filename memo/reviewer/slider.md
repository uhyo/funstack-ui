# Review: Slider (#54, wave 5), 2026-10-18

Scope: merge 6cef8e7 (implementation ff7f164..fb37b8d), against design/components/slider.md
(accepted), design/conventions.md, docs/vision.md, design/components/field-form.md (Field
readiness only), memo/developer/slider.md. Files: packages/ui/src/slider/*,
internal/use-native-group-reconciliation.ts.

**Verdict: acceptable with fixes.** The state model (urgent `live`, step transition, commit
dispatch, `held` derivation), the platform-first input, reset / reconciliation and the test
breadth are good. One High (WebKit RTL keys, CI red on master) must be fixed before the next
release; the Mediums are small, contained changes.

Verification: throwaway probes in the session scratchpad (outside the repo), run with
a scratch vitest config rooted at packages/ui. Chromium 156 and Firefox 157 locally; WebKit does
not launch on this machine (missing host libs), so WebKit facts come from CI (coordinator) and
WebKit's source (`RangeInputType::handleKeydownEvent`).

---

## High

### H1. WebKit does not mirror ArrowLeft / ArrowRight under RTL; the Slider's track is mirrored
`slider-root.tsx:485-519` (`inputKeyDown` returns for every horizontal slider at :495);
`slider.browser.test.tsx:127-139` (CI on 6cef8e7: WebKit, expected '51', received '49');
design 7 table and decision 7 ("RTL mirrored by the browser").

- Facts. Native range probe (plain `<input type=range>` in a `dir=rtl` container): Chromium and
  Firefox give ArrowRight 49 / ArrowLeft 51 (mirrored). WebKit's `handleKeydownEvent` maps Left
  to −step and Right to +step with no direction check (CI result matches). Its `isVertical` is
  true only for `appearance: slider-vertical`, not for `writing-mode`, so for our vertical input
  WebKit does Up +, Down −, Left −, Right +: already APG-correct, and the library's vertical JS
  normalisation covers Left / Right anyway. Vertical is fine in all three engines.
- User-visible failure. Safari, Hebrew / Arabic page, horizontal slider: `min` is drawn on the
  right (pointer math and logical insets mirror, `slider-root.tsx:541`, design 6.2), so
  ArrowRight increases the value and the thumb moves **left**, opposite to the key, while the
  same page in Chrome / Firefox moves it right. A keyboard user cannot predict direction; it also
  contradicts the documented keyboard table. Not a WCAG failure by itself, but a real
  accessibility defect for RTL keyboard users, and master CI is red.
- Recommendation: **normalise, do not document as degraded.** No synthetic events and no UA
  sniffing are needed: extend the existing keydown path. In `inputKeyDown`, for a horizontal
  slider, read `getComputedStyle(input).direction` at the keydown; when it is `rtl`,
  `preventDefault()` ArrowLeft / ArrowRight and dispatch step + commit with ArrowLeft = +step,
  ArrowRight = −step through the same code the vertical branch uses (`gestureStart`,
  `clampToNeighbours`, `commitGesture`). Chromium and Firefox then produce exactly what they did
  natively (so no behaviour change there), WebKit is fixed, and the browser row passes unchanged
  in all engines; add `details.event?.type === "keydown"` for the RTL row as for vertical. LTR
  stays fully native. Cost (accepted precedent of the vertical row): those two keys report the
  `keydown` and fire no native `input` / `change`, so a `<form onChange>` does not see them; note
  it beside the vertical sentence. Update design decision 7 / section 7 ("RTL: JS, WebKit does
  not mirror natively") and memo/developer/cross-engine.md.

## Medium

### M1. Two thumbs stacked at `max` cannot be dragged apart with the pointer
`slider-thumb.tsx:227-229` (Thumb `onPointerDown` always captures its own `index`),
`slider-root.tsx:569`, `slider-arithmetic.ts:79-92`.
Scenario: `defaultValue={[100, 100]}`, `max=100`, `minStepsBetweenThumbs=0`. Thumb 1 is later in
the DOM, so it is on top; the user presses it and drags left. Thumb 1's bounds are
`[values[0], max] = [100, 100]`: it cannot move, nothing steps, nothing commits. Verified in a
jsdom probe (values stay `["100","100"]`, 0 commits). The same happens for any two thumbs at
equal values where the top one has no room toward the pointer (e.g. `[30, 30]` pressed and moved
left). The Track's tie rule (`nearestThumb`) exists for exactly this case but a press on a Thumb
never reaches it. Fix: when the pressed thumb shares its value with a neighbour, defer the choice
to the first move (pick the thumb that can move toward the pointer, Radix / Base UI behaviour), or
route a Thumb press through `nearestThumb` with the tie rule when values coincide. Add a jsdom row.
Keyboard is unaffected (Tab reaches thumb 0).

### M2. `data-pending` flickers on every pointer move, even with no actions
`slider-root.tsx:324-327` (`runStep` on every step), `use-action-trigger.ts` (always an async
transition). Probe: uncontrolled slider with **no** `valueChangeAction` and **no**
`valueCommitAction`, pointerdown + three moves + up: Root `data-pending` toggled `P-P-P-P-P-`.
Each step is a pending urgent render plus a transition render (two commits per pointermove,
~120/s while dragging), and a consumer's `[data-pending]` spinner on the Thumb (design 6.2's own
recipe, `.thumb[data-pending]::after`) blinks throughout a drag although nothing is in flight.
Design walkthrough 1 says "step transition resolves at once", which is true but still visible.
Fix: do not start a step transition when `valueChangeAction` is absent (there is nothing to run
and no consumer update to keep interruptible). With a sync `valueChangeAction` the flicker is
inherent to transitions; document it next to the spinner recipe, or style the spinner on
`[data-pending]:not([data-dragging])`.

### M3. Firefox drag row "pointer > a drag follows the pointer and commits once at release": a test-environment flaw, not a library race
`slider.browser.test.tsx:232-277`, `packages/ui/vitest.config.ts:105`.

- Reproduction. 6/6 isolated passes of the row, 25/25 and 40/40 passes of a diagnostic copy
  under heavy CPU load alone: load is not the trigger. Two loaded full browser runs: the row
  failed both times, `expected '100' to be '75'` at :267, **without** the "drag ended at" warning,
  so the last pointer event the document saw *was* at the target. Diagnostic copy run next to a
  second test file in the same Firefox that only clicks / hovers its own buttons
  (`--maxWorkers=4`): **34 of 40 drags failed** (value 100, or 1); in Chromium 0 of 40. With
  `fileParallelism: false` on the Firefox instance: 0 of 40.
- What happens (event log from the probe, our document, capture listeners):
  `pointerdown@70 (thumb)`, `gotpointercapture`, `pointermove@382`, `pointerdown@382 (DIV)`,
  `pointerup@382`, `lostpointercapture`, then our own `pointermove@180`, `pointerup@180` on the
  track. The 382 events are the other page's Playwright mouse input delivered into our document
  (headless Firefox shares one mouse / capture state between pages of the browser; Gecko keys
  pointer capture by pointer id, and the mouse is id 0 in every tab). The foreign move lands on
  our captured thumb (x beyond the track → 100), the foreign `pointerup` ends our gesture and
  commits 100, and our real move to 150 arrives after the gesture is over. The library did the
  right thing with the events it was given; a native range would too.
- Why the developer's fb37b8d change does not help: it compares with the last recorded
  `clientX`, which is our own `pointerup` at the target; the foreign events come before it. Its
  "warn and accept" branch (:262-264) also turns a genuine regression into a console line.
- Deterministic fix: give Firefox its own page: in `vitest.config.ts:105`, instance options
  `{ browser: "firefox", fileParallelism: false }` (vitest 5 reads `fileParallelism` per
  instance; verified with the scratch config). Then restore the strict assertion
  (`input().value === "75"`, thumb centre at left+150, commit 75) and drop the recording. If the
  serial Firefox job is too slow, the alternative is a separate project for real-pointer rows
  (all components) with `fileParallelism: false`; the same loaded runs also failed Firefox rows
  in RadioGroup (real click before hydration, reset), Popover (Escape, Close), Combobox and
  Dialog, which fits the same cause and should be rechecked after the change. Record the finding
  in memo/developer/cross-engine.md.

### M4. Field-readiness blockers for #60 (note only)
- **Pointer gestures fire no native `input` / `change`** (decision 4.1 / PO item 8,
  `slider-root.tsx:556-566`). Field design 3.4 / 7.1 dismisses a server error and re-runs
  `validate` on the control's native `input` / `change` (capture listeners on the registered
  element and the form owner). Scenario: `Form.Root errors={{ volume: "Too loud" }}`, the user
  drags the slider to a new value: the error stays shown, `setCustomValidity` stays set, the next
  submit is blocked by the stale custom error. Keyboard works (native events). #60 must either
  add the bubbling `input` / `change` (design 13's `BubbleInput` follow-up) or have Slider call a
  Field hook directly at step / commit. This is the decision to make before #60, not after.
- **The thumb input `id` is library-owned** (`slider-thumb.tsx:187`, `ctx.thumbId(index)`), and
  the labelable-vs-group choice depends on the value count known in the Root while the
  labelable element is in the Thumb. `useFieldControl` must be called where the count is known
  (Root) and its `id` / `aria-describedby` / `aria-invalid` routed to the first Thumb's input
  through context (one thumb) or onto the Root (several). Not a blocker, but the hook's
  "spread into the owner part's libraryProps" contract does not fit a two-part control as written.
- `aria-describedby` on the input is a plain forwarded prop (`slider-thumb.tsx:198`); the Field's
  tokens need the token-merge path there.

## Low

### L1. Rejection rows do not assert a rollback
`slider.test.tsx:707-736` ("reaches the boundary and rolls the thumb back") asserts the boundary
and the `"dismiss"` step but never the value; :738-759 ("rolls the DOM value back when ... caught
inside the Root's parent") asserts only the error text. Both titles promise a rollback the test
does not check (it cannot: the slider unmounts with the boundary, see deviation 4). Rename them
and, for "both" modes, add an observable rollback: an `ErrorCatcher` whose fallback remounts the
Slider, or a commit action that rejects while the `valueChangeAction` probe records the
`"dismiss"` value, plus `useOptimistic` revert via a controlled update-on-success parent where the
slider stays mounted.

### L2. `Slider.Value` / `Slider.Label` state is typed `number` on an array slider
`slider-value.tsx:15`, `slider-label.tsx:11`. The generics default to `number` and are not
connected to the Root's `T`, so inside `<Slider.Root defaultValue={[20, 80]}>` a
`<Slider.Value>{({ value }) => value.toFixed(0)}</Slider.Value>` type-checks and throws at
runtime (`value` is an array). Either type `value` as `SliderValue` in the parts' default state,
or document "pass `<Slider.Value<readonly number[]>>`" and prefer `values` in examples.

### L3. Release position is not used
`slider-root.tsx:581-587`: `onEnd` commits the last `pointermove`'s value and ignores the
`pointerup` coordinates. If an engine coalesces the final move into the `pointerup`, the commit
lags the pointer by that distance. Cheap hardening: `moveTo(thumb, valueAt(up.clientX, …))` on
`pointerup` before `commitGesture` (not on `pointercancel` / `lostpointercapture`).

### L4. The act() finding is a test-harness misuse, not a React bug
Plain React 19.3.1 repro (two `useTransition`s, parent `setValue` suspends a `use()` sibling,
then `startTransition(async () => setOptimistic(v))`): with `act(() => step(70))` **not awaited**
the second transition stays pending forever (DOM keeps the old data, `isPending` true), exactly
as the developer reports, and React logs "A component suspended inside an `act` scope, but the
`act` call was not awaited". With `await act(async () => step(70))` and the same later scopes,
everything completes. React documents sync `act` + suspension as unsupported, so **do not report
upstream**. The `withoutAct` workaround in `slider.test.tsx:821` can be replaced by awaited `act`
around the pointer events (the `pointer()` helper at :90-108 uses sync `act`). Keep the memo
sentence but correct its conclusion.

### L5. Design text to amend (architect)
Decision 7 / section 7 RTL row (after H1); 14.1 "Directive" row (arithmetic has none, see
deviation 3); walkthrough 2 "the thumb slides back" (unobservable with a boundary above the Root;
it is a remount, see deviation 4); `focus({ focusVisible: false })` (`slider-root.tsx:607`) needs
a WebKit check (the developer listed it; WebKit CI should confirm `:focus-visible` is false after
a pointer press).

---

## Developer deviations (memo/developer/slider.md)

1. **`SliderLabelProps` generic.** Accept. It is needed for an honest `SliderRootState<T>`;
   see L2 for the default.
2. **`aria-value*` / `aria-orientation` omitted from Root and Thumb props.** Accept. Matches
   design 8 ("never authored") and the type row; a `render` element on Root can still add them to
   the group `div`, which is harmless.
3. **`slider-arithmetic.ts` without a directive.** Accept; design 15 is right and 14.1 should be
   amended. `directives.test.ts` already lists it as directive-free.
4. **Rollback-animation row via a non-adopting controlled parent.** Accept; it exercises the same
   CSS path. The point it raises is real: uncontrolled rollback after a rejected save is never
   visible, because the boundary that receives the error is above the Root. The design should say
   so (L5), and the docs should not promise a slide-back in uncontrolled mode.
5. **Superseded rejection reaches the boundary only after the newer commit settles (adopt
   parent).** Accept as React behaviour (entangled transition update held until the async action
   scope settles); the test pins it per mode. Worth one sentence in the docs' error section.
6. **The act() finding and the `withoutAct` workaround.** The observation is correct; the cause
   is the non-awaited `act` (L4). Replace the workaround when convenient; nothing to file.

Implementation notes in the memo (gesture start rules, `setLive(shown)` at gesture start,
sanitised reconciliation equality, overloaded Root) are sound; the `setLive(shown)` fix is covered
by "a press on the current value...".

## Checklist summary

- Async React: steps are transitions, commit is the `useControllableAction` dispatch with
  optimistic + latest-wins, uncontrolled write on commit resolve, `"dismiss"` step after the yield,
  superseded rejections surfaced; `live` is urgent and only library-internal. Suspending content
  in an adopting parent keeps old UI with `data-pending` (tested). No ViewTransition by design.
  Issue: M2.
- APG / AT: native `input[type=range]` per thumb, neighbour-limited native `min` / `max`
  (CDP-verified in Chromium), `aria-valuetext`, `group` + `aria-labelledby` for several thumbs,
  `label[for]` for one, dev warnings for unnamed thumbs / groups, no `aria-value*`. Issues: H1, M1.
  Firefox / WebKit orientation exposure of the writing-mode vertical input is still unverified
  (design 8 screen-reader pass outstanding).
- API: matches the design and conventions (action props, `data-*` vocabulary, `inputRef`,
  owned keys, transition types `fsui-slider*`). L2.
- Tests: broad jsdom coverage of the three modes, overlap, reset, reconciliation, StrictMode;
  browser rows for keys, vertical, pointer, AX tree, pre-hydration. M3, L1, L4.
