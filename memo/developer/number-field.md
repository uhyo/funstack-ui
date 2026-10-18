# NumberField (#67) — developer notes

Implementation of design/components/number-field.md (accepted 2026-10-18) and the Field
`validityElement` amendment (field-form.md, "Amendment: validityElement").

## Files

- `packages/ui/src/number-field/`: context, root, label, input (visible + hidden), increment
  (holds the shared button hook `useStepButtonElement`), decrement, `use-step-button.ts` (the hold),
  `number-field-format.ts` and `number-field-arithmetic.ts` (directive-free), tests
  (`number-field-format.test.ts`, `number-field.test.tsx`, `number-field.types.test.tsx`,
  `number-field.browser.test.tsx`).
- `internal/decimal.ts` (`decimalsOf`, `roundTo`; slider-arithmetic re-exports `decimalsOf`),
  `internal/announce.ts` ("use client": `ariaNotify`, else one module-level `role=status` region,
  cleared after 1 s).
- Field: `FieldControlRegistration.validityElement`, `useFieldControl({ validityElement })`,
  `field-root.tsx` reads validity / writes the slot on it, mirrors onto the registered element
  when they differ, keeps `:user-invalid` on the registered element.

## Deviations from the design (for the architect)

1. **End goes to the largest grid point ≤ `max`**, not `max` itself (design 4.2 says `max`). With
   an unreachable `max` (`0..5` by `2`) End would otherwise create a `stepMismatch` value from a
   key, which no other stepping path can; `boundValue("max")` matches the clamp of 5.5 step 3.
   Home is `min` as designed.
2. **Stepping from empty skips rule 4** ("keep `before` when the result moved against the
   direction"). The design's own rows need it: empty + ArrowDown with `min 3` is `3`, which moves
   up from the implicit `0`. Rule 4 applies to non-empty values only.
3. **Mount reconciliation re-sync writes `visible.value` directly** instead of re-rendering the
   Input. A Root state bump does not re-render the Input (the memoised context does not change),
   and a direct write of the library-owned controlled input is what react-dom would have done
   (its value tracker follows the setter).
4. **No hidden-input registry**: the Root owns `visibleRef` / `hiddenRef` (passed through context)
   and the Input merges them into its two elements; the late-mount path is `onInputMounted` from
   the Input's first layout effect. Same behaviour as the registry shape, fewer moving parts.
5. **Parser leniencies beyond 5.3** (all affix-level; the number core stays strict):
   currency strings in every display (`symbol`, `narrowSymbol`, `code`, `name`, plural forms) and
   unit strings in every display (`short`, `long`, `narrow`) are removed, so `EUR 1.50`,
   `1.50 euros` and `12 km` in a long-unit field parse (the 14.1 rows ask for these); affixes
   compare case-insensitively; any apostrophe (`'`, `’`, `ʼ`) is a group separator where the locale
   groups with one (de-CH); ASCII `.` is accepted as the decimal separator where the locale's is
   U+066B (Arabic). Bidi controls (U+061C, LRM, RLM, isolates) are stripped before parsing.
6. **Hold ticks carry `details.event === undefined`** (the timer has no DOM event). The press
   carries `pointerdown`, the release `pointerup` / `pointercancel` / `lostpointercapture` / the
   window `blur`. When the bound ends a hold, the commit's event is the tick's (`undefined`).
7. **Ctrl / Meta + key are not handled** (design 4.2 lists only Alt). Cmd+Arrow moves the caret on
   macOS and should not step.
8. A wheel event with `deltaY === 0` (a horizontal scroll) is ignored.
9. The button's default `aria-label` is not emitted when the consumer passes `aria-labelledby`
   (8.4 says either replaces the default; implemented by omitting it).
10. A draft "committed" while `disabled` / `readOnly` is just cleared.
11. The percent test row "`0.5` → `0.005`" holds only with `maximumFractionDigits ≥ 1`: with the
    percent default (0 fraction digits) 5.4's rounding makes it `0.01`. The test uses
    `{ style: "percent", maximumFractionDigits: 1 }`.

## Test-plan rows not covered (browser)

- Touch emulation (no keyboard, no context menu): vitest's `userEvent` has no touch press with a
  hold; not written.
- IME composition through Playwright: not written (jsdom covers `isComposing` Enter).
- Firefox restoration across a reload: not written (Slider's row exists and mostly logs "not
  restored" for srcdoc frames).
- "No 'not focusable' console error" (Chromium): a browser console message, not observable from
  page JS; the row asserts instead that the hidden input never receives focus.
- The "parent `useTransition` probe" row is approximated: the step's awaited action keeps
  `data-pending`, and the suspending-content rows prove the step renders in a transition.

## Findings

- **Field layout shift**: inside a Field, a click on Save right after typing blurs the input on
  mousedown; the Field shows the error (`:user-invalid` after change + blur) before mouseup and,
  with no reserved space, the button moves away from the pointer, so no click happens. Same as
  any Field control; the browser test tabs out first.
- **Firefox's validation bubble** stays over the page and swallows the next click until the
  control becomes valid. Typing does not make a NumberField valid (the visible input mirrors the
  hidden one, which changes at commit), so the bare-form browser row commits a valid value at the
  end to dismiss it (the Field tests type into the control instead).
- **Implicit submission** (Enter) needs a submit button: the hidden `type=number` input is a
  second field that blocks implicit submission, so a form whose only field is a NumberField and
  that has no submit button does not submit on Enter. The docs say "inside a form with a submit
  button".
- The full local gate saw one flake in `form/form.test.tsx` ("a plain Dialog.Form still closes
  on a settle whose result has errors"), unrelated (no Field / NumberField involved); passes
  when rerun.

## Review fixes (memo/reviewer/number-field.md, branch wave6/number-field-fixes)

All eleven deviations above were accepted. Fixed, each with a test:

- M1: `readCurrent` checks focus first, so a focused input's text at hydration (even
  unparsable, `12,`) is adopted as the draft and never overwritten under the caret; the blur
  resolves it. jsdom row "focused, unparsable text at hydration stays as the draft".
- S1: `keyCode === 229` counts as composing (WebKit's composition-confirming Enter).
- S2: Shift+Home / Shift+End are left to the browser (text selection).
- S3: the buttons' bound state is computed from the parsed draft while one is open
  (`stepBase` on the context), since a press steps from it.
- N1: `step()` rounds with `formatter.round` (5.4 for stepped values too), so a step finer than
  the format posts what the text shows.
- N2: the hidden input has `autocomplete="off"` (no form-state restoration the text hides).
- N3: affixes (currency, unit, percent) and literals are stripped at the edges only (also inside
  the sign and the parentheses); in the middle they make the text unparsable (`1€234` under
  `fr-FR` was `1234`).
- N4: the fallback region is cleared and the message written `ANNOUNCE_WRITE_DELAY` (100 ms)
  later, so a freshly inserted region's first message and a repeat of the same text are both a
  fresh change.
- N5: `onCompositionStart` / `onCompositionEnd` pass through `NumberField.Input`; the details
  JSDoc and the docs say `event` is `undefined` on hold repeats and at a bound-ended hold.
- The Field docs page says an error shown on blur can shift the layout under a click.
- S4 (unwritten browser rows) is #77, not part of this branch.

## #77: the remaining browser rows (wave 7)

Written in `number-field.browser.test.tsx`, Chromium through CDP:
- Touch hold: `Input.dispatchTouchEvent` start / end 700 ms apart at the button's centre in
  top-level page coordinates (`pagePoint` adds each frame's offset; the test runs in an iframe,
  which sits at 0,0 with scale 1 in headless runs today). Asserts `pointerType` touch, the tick
  count against the press duration the page measured, one commit, the input never focused (the
  stand-in for "no virtual keyboard") and every `contextmenu` during the hold cancelled (headless
  Chromium raised none in 700 ms).
- IME: `Input.imeSetComposition` puts `１２` in the draft, the confirming Enter is a keydown with
  `windowsVirtualKeyCode: 229` followed by `Input.insertText`; no commit until a plain Enter,
  which commits 12. Firefox / WebKit assert that both composing keydown shapes (`isComposing`,
  `keyCode 229`) are ignored.
- "Not focusable": `Log.enable` + `Log.entryAdded`; a NumberField submission with an invalid
  hidden input logs nothing, a positive control (`display: none` required input) logs, and its
  message bounds the wait (the channel is ordered).
- `startViewTransition` stays uncalled through a rejected commit (rollback step and boundary).

All rows wait for the events they cause (`nextEvent`) instead of fixed delays (#71).

Moving Combobox and `focus-first-invalid.ts` onto `internal/announce.ts` was **not** done (see
the #77 closing comment): `focus-first-invalid.ts` is directive-free and may not import the
"use client" `announce.ts`, and the fallback region (and its delayed write) would add an
announcement in engines without `ariaNotify` where both are silent today.

## Not done (implementation choices left open)

- Combobox keeps its own `ariaNotify` call and `focus-first-invalid.ts` its own `announce`; moving
  them onto `internal/announce.ts` would add the fallback region to them (design 8.3 / 15 calls it
  an implementation choice).
