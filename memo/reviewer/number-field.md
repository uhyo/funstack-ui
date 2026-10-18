# Review: NumberField (#67, wave 6), 2026-10-18

Scope: c31588b (library and the Field `validityElement` change), 0a2c701 (playground), bff9672
(docs), 6c22210 (developer memo), 5fe8ae6 (test fix), against design/components/number-field.md
(accepted, with its acceptance note), design/conventions.md (with the #67 amendments in 29a94c5),
the `validityElement` amendment in design/components/field-form.md, docs/vision.md and
memo/developer/number-field.md.

**Verdict: acceptable with minor fixes.** The implementation follows the design closely: the
two-input shape, the step / commit pair with the rollback and the `"dismiss"` step, the urgent
draft and `live`, `stepValue` with the spec's snap and clamp, no clamping of typed values, the
strict-grouping parser, the validity mirror, the Field contract change, form reset, mount
reconciliation, the announcements and the docs all match. The Field change is a few lines and
leaves every existing control unchanged (`surface === el` for all of them). There is one
must-fix: hydration overwrites text the user is still typing (M1, a check-order bug, a few
lines to fix). Four should-fix items are small keyboard or button cases. The rest are nits or
follow-ups.

Verification:
- jsdom: number-field, field, form and slider pass, 357 tests, types included. Over 8 runs,
  `form.test.tsx` "a plain Dialog.Form still closes on a settle whose result has errors"
  failed 3 times. That flake was already known and is unrelated (wave6/form-flake).
- Browser: NumberField passes locally on Chromium and Firefox (13 rows each; the CDP row is
  Chromium-only). WebKit does not launch on this machine. CI run 39110394841 on 5fe8ae6 is
  green, including the WebKit job.
- `tsc --noEmit` is clean for packages/ui.
- Throwaway jsdom probes (deleted afterwards) confirmed M1, S1, S2, S3 and N1. A probe of
  server `en-US` with client `de-DE` showed that react-dom itself re-syncs a hydrated input
  the user has not edited (no dispatch; the value attribute and the text become `1.234`).
  Mount reconciliation therefore only sees text the user has changed (or restored text).

---

## Must-fix

### M1. Hydration overwrites partial text the user is still typing
`packages/ui/src/number-field/number-field-root.tsx:599-618` (`readCurrent`).

The unparsable / same-value branch runs before the focus check. If the user is still in the
field with a partial draft such as `12,`, `-` or `1.`, `visible.value` is reset to the
formatted value under their caret. Probe: server value `1`, the user typed `12,` and kept
focus → after hydration the text is `"1"` and focus is still in the input. Design 4.5 (and
walkthrough 12.6) says a focused input's differing text is **adopted as the draft** and the
blur commits it. A parse failure is resolved at that blur, by the ordinary revert rule.
Fix: test `activeElement === visible` first (adopt as the draft whenever the text differs),
then the parse. Add a jsdom row "focused, unparsable text at hydration stays as the draft".

## Should-fix

### S1. An Enter that confirms an IME composition in Safari commits the draft
`number-field-root.tsx:471`. Only `event.isComposing` is checked. WebKit fires
`compositionend` before the confirming `keydown`, so that keydown has `isComposing === false`
and `keyCode === 229`. Combobox already guards both (`combobox-root.tsx:748`, with a
`keyCode: 229` test at `combobox.test.tsx:913`). Probe: a draft `１２`, then
`keyDown(Enter, keyCode 229)` → one commit. Add `|| event.keyCode === 229` and the matching
jsdom row.

### S2. Shift+Home / Shift+End no longer select text when a bound is set
`number-field-root.tsx:491-500`. Home / End are handled whatever the modifiers (only Alt /
Ctrl / Meta bail out at 476). Shift+Home is the ordinary "select to start" gesture in a text
field. With `min` set it now jumps to `min` and is prevented (probe: `defaultValue 5, min 0`,
Shift+Home → prevented, text `0`). Design 4.2 lists plain Home / End only. Fix: leave
Home / End alone when `shiftKey`. Shift+Arrow stays `largeStep` as designed.

### S3. The buttons are disabled from the shown value even while a draft is open
`number-field-increment.tsx:183`. `isAtBound(state.value, …)` ignores the draft, yet a press
steps from the parsed draft (4.3 step 3). Probe: `defaultValue 99, max 99`, the user types
`50` → `+` stays `disabled`, so the press the design describes cannot happen. The reverse
case (enabled, but a no-op from the draft) is harmless. Fix: when a draft is open and parses,
compute the bound from it. Alternatively, do not apply the bound rule while a draft is open
(the step itself is already a no-op at the bound).

### S4. Browser rows left unwritten: track them in an issue
Of the rows the developer listed:
- **Touch hold** (Chromium): `cdp()` reaches `Input.dispatchTouchEvent`, so a touch press with
  a hold can be driven; "no keyboard" can be approximated by "the input did not receive
  focus".
- **IME** (Chromium): `Input.imeSetComposition` / `Input.insertText` through CDP, or Combobox's
  browser pattern (`combobox.browser.test.tsx:617`).
- **"Not focusable" console error**: CDP `Log.enable` + `Log.entryAdded` can observe it in
  Chromium. The substitute ("the hidden input never received focus") is a good proxy, so this
  one is a nit.
- **Firefox reload restoration**: largely moot. The visible input carries
  `autocomplete="off"`, which stops Firefox restoring it, so only the hidden input can be
  restored (see N2). Record this in the design instead of writing the row.

The `startViewTransition` row also skips the "rejected commit" case of 14.2. None of these
blocks the merge. Record them in a GitHub issue in this repo so they are not lost.

## Nits

### N1. Stepping does not round to the format's digits
`stepValue` rounds to the decimals of `step` / `min`, not to `formatter.round`. With
`step={0.001}` in a EUR field, ArrowUp from 1 shows `€1.00` but posts `1.001` (probe). That
breaks the "what the user sees is what the form posts" rule of 5.4 for a step that is finer
than the format. It is a misconfiguration, but cheap to catch: a dev warning when
`decimalsOf(step) > fractionDigits`, or apply `formatter.round` in `step()`.

### N2. The hidden input should carry `autocomplete="off"` too
`number-field-input.tsx:308-323`. Form-state restoration (Firefox reload, history navigation
in both engines) can restore the hidden number input but not the visible one
(`autocomplete="off"`). Before hydration the form would then post a value the text does not
show. After hydration the Input's layout effect overwrites the restored value, so the
mismatch exists only before hydration (or without JS).

### N3. Affixes are replaced by a space anywhere in the text
`number-field-format.ts:241`. In a locale that groups with spaces, an affix in the middle
becomes a group separator: `1€234` parses as `1234` under `fr-FR` (by reading of the code;
design 5.3 step 2 does say "remove every occurrence"). Stripping affixes at the edges only, as
literals already are, keeps every row of the matrix and closes the gap. This is the one place
where the deviation 5 leniency reaches the number core.

### N4. Fallback live region
`internal/announce.ts:447-479`. The region is created and written in the same task, and some
screen readers skip the first change of a freshly inserted live region. React Aria inserts it
first and writes on a later tick. Also, a message equal to the current text within the 1 s
window (no DOM mutation) is not spoken again. This only matters in engines without
`ariaNotify`.

### N5. Type and docs details
- `NumberFieldInputProps` omits `onCompositionStart` / `onCompositionEnd`
  (`number-field-input.tsx:103-104`), but the library attaches neither handler (it uses
  `isComposing`). Let them pass through, since the docs say "the rest pass through".
- The `NumberFieldValueChangeDetails.reason` JSDoc (`number-field-root.tsx:49-51`) says
  `details.event` is "the … tick … of a button". It is `undefined` for ticks and for a commit
  ended by reaching the bound (deviation 6). Say so in the JSDoc and in the docs page's
  details paragraph.

---

## The developer's deviations

| # | Deviation | Judgement |
| --- | --- | --- |
| 1 | End → the largest grid point ≤ `max` | **Accept.** It agrees with the button's bound rule and the 5.5 clamp, and no key can create a `stepMismatch`. The docs page states it. The architect should amend 4.2. |
| 2 | Rule 4 skipped for an empty value | **Accept.** The spec's own `stepDown()` would leave an empty field with `min 3` unchanged. The design's explicit rows (from the native UI behaviour) need the skip. Amend 5.5 to say so. |
| 3 | Re-sync by writing `visible.value` directly | **Accept.** react-dom's value tracker follows the setter, and the probe shows react-dom already re-syncs untouched inputs, so this only handles dirty text. The ordering bug next to it is M1. |
| 4 | No hidden-input registry; refs through context | **Accept.** Same behaviour, fewer parts. The late-mount path (`onInputMounted`) is covered. |
| 5 | Lenient affixes, currency / unit names, apostrophes, U+066B ↔ `.`, bidi stripping | **Accept**, with N3. Everything else stays at the affix level; strict grouping of the number core is intact and tested. |
| 6 | `event` undefined on hold ticks | **Accept** (no DOM event exists); document it (N5). |
| 7 | Ctrl / Meta + key not handled | **Accept** (Cmd+Arrow / Ctrl+Home are caret moves). See S2 for Shift. |
| 8 | `deltaY === 0` ignored | **Accept.** A horizontal scroll is not prevented and scrolls normally. |
| 9 | Consumer `aria-labelledby` drops the default `aria-label` | **Accept.** It matches 8.4 ("replaces"), and accname would let `aria-labelledby` win anyway. |
| 10 | A commit while disabled / readOnly clears the draft | **Accept.** No dispatch from an inert field, and the text returns to the value. |
| 11 | Percent test row adjusted | **Accept.** The design's `0.5 → 0.005` row contradicts its own 5.4 rounding with the percent default of 0 fraction digits. Correct the 14.1 row. |

## The developer's other reports

- **Browser rows unwritten**: see S4.
- **Combobox not migrated to `announce.ts`**: acceptable. Design 8.3 / 15 leaves it as an
  implementation choice. Migrating would give Combobox (and `focus-first-invalid.ts`) the
  fallback region. Worth a small follow-up issue.
- **Field layout shift ("click Save right after typing")**: this is a property of every Field
  control with an unreserved `Field.Error`, not of NumberField, and the browser test works
  around it correctly. A docs note on the Field page (reserve the error's space, or render
  `Field.Error` with `forceMount`-style placeholder styling) would help. It is not a
  NumberField fix.
- **Firefox's bubble swallowing the next click**: this points to a real UX difference, not
  only a test hazard. The visible input's validity changes at commit, not per keystroke, so
  the Firefox bubble and `:user-invalid` styling (in every engine) stay while the user types a
  fix, until blur or Enter. That follows from the accepted design (validity tracks the
  committed value; `validate` never sees a draft). Record it for the architect as a known
  difference from a native number input; no change now.
- **Enter submits only with a submit button**: this is correct platform behaviour. The hidden
  `type=number` is a second field that blocks implicit submission, so a form with only a
  NumberField has two such fields. The docs say "inside a form with a submit button".
  Accept.

## Checklist notes (no finding)

- **Accessibility**: no `spinbutton` role or `aria-value*` (CDP row confirms a `textbox` named
  "Quantity" and a `group` named "Quantity"). The buttons are named "Increase" / "Decrease",
  with `tabindex=-1` and `aria-controls`. The hidden input is `aria-hidden` and `tabindex=-1`,
  its `invalid` is always cancelled, and the browser rows show it never receives focus. Every
  keyboard row is covered by real keys in the browser (Arrow, Page, Shift+Arrow, Home / End
  with and without bounds). Announcements happen once per key, wheel, click activation and
  hold release, never per tick or for typed text. The fallback region is tested.
- **Slider semantics**: the step transition runs only with a `valueChangeAction`. `stepHeld`
  and `live` hold the text between ticks. The commit goes through `useControllableAction`.
  The uncontrolled rollback runs `"dismiss"` for the latest commit only, after
  `await undefined`. The three-mode `describe.each` covers the rollback, the superseded
  rejection and suspending content.
- **Typed values**: not clamped and not snapped. The hidden input reports `rangeOverflow` /
  `stepMismatch`, and the mirror carries the browser's message.
- **Field integration**: `validityElement` resolves lazily. The slot is written on the hidden
  input and mirrored. `:user-invalid` is read on the visible input, and the focus target is
  the visible input. The real submit inside a Field passes on all three engines in CI.
  Existing controls get `surface === el`, so their behaviour is unchanged, and their suites
  pass.
- **Forms / reset**: `FormData` posts `String(value)`, `""` when empty, nothing when disabled.
  The hidden `defaultValue` attribute is the reset target. `onResetEvent` writes the visible
  `defaultValue`. Reset, a reset button, a cancelled reset and React's automatic reset are all
  tested.
- **Docs**: the props tables match the declarations (Root, Input, both buttons, Label, and the
  state shapes). The examples are correct: the update-on-success rollback, localised button
  labels next to `locale`, and the Field example with `validity.stepMismatch`.
