# Architect notes: NumberField (#67, wave 6), 2026-10-18

Working notes behind `design/components/number-field.md`. Not a spec.

## Prior art read for this design

- Base UI 1.9 `NumberField`: Root (`value: number | null`, `defaultValue`, `onValueChange(value,
  eventDetails)` with reasons `input-change` / `input-clear` / `input-blur` / `input-paste` /
  `keyboard` / `increment-press` / `decrement-press` / `wheel` / `scrub` / `none`,
  `onValueCommitted` later than `onValueChange` on blur / pointer release and at the same time
  for keyboard and wheel, `min` / `max` / `step: number | 'any'` (1), `smallStep` (0.1),
  `largeStep` (10), `allowOutOfRange` (false: clamps), `snapOnStep` (false), `allowWheelScrub`
  (false), `format: Intl.NumberFormatOptions`, `locale`, `disabled` / `readOnly` / `required`,
  `name`, `form`, `inputRef`), Group, Input (`aria-roledescription` default `'Number field'`),
  Increment, Decrement, ScrubArea, ScrubAreaCursor. Alt = smallStep, Shift = largeStep.
- React Aria 3.53 `NumberField`: `value` / `defaultValue` / `onChange(number)` on commit (blur,
  Enter, each step), `minValue` / `maxValue` / `step`, `formatOptions`, `isWheelDisabled`
  (wheel on by default while focused), clamps and snaps on commit, reverts unparsable text,
  `inputmode` `text` on iPhone when negatives are allowed, buttons `aria-label` "Increase" /
  "Decrease" combined with the field label through `aria-labelledby`, a localised
  `aria-roledescription="number field"`, the `@react-aria/live-announcer` for step
  announcements, `role="group"` around input and buttons, press-and-hold 400 / 60 ms (600 ms on
  touch).
- Ark UI `NumberInput`: Root, Label, Input, Control, IncrementTrigger, DecrementTrigger,
  Scrubber, `HiddenInput`? (no: Ark renders one input), `formatOptions`, `locale`,
  `allowMouseWheel`, `clampValueOnBlur`, `spinOnPress`.

Borrowed: two actions (Base UI), the hidden native number input (Base UI), press-and-hold
timing (both), buttons `tabindex="-1"` (both), `Intl.NumberFormatOptions` as the format prop
(both), the group (React Aria), unparsable text reverting (React Aria), announcements (React
Aria), the "no spinbutton" textbox (both). Rejected: per-keystroke parsed `onValueChange` (Base
UI), clamping on commit (both), `aria-roledescription` (both), the scrub area (Base UI, Ark),
`smallStep` (Base UI), the iPhone sniff (React Aria), stripping every group separator (both).

## Probes (2026-10-18)

### jsdom constraint validation on `type=number`

`memo/architect/probes` has none for this; the one-off script lived in the scratchpad. jsdom
30 (the repo's version) answers for a `<input type=number min=1 max=10 step=1 required>`:
`value="12"` → `rangeOverflow`; `"1.5"` → `stepMismatch`; `""` → `valueMissing`; `"abc"` → the
value becomes `""` and `valueMissing` (never `badInput`, as in browsers for a script-set
value); `setCustomValidity("custom")` → `customError` with `validationMessage` `"custom"`;
native messages are the constant `"Constraints not satisfied"`. `FormData` posts the value.
`form.checkValidity()` fires `invalid` on each invalid control in tree order. `stepUp` exists.
So the hidden-input rows and the Field flag rows stay in jsdom; only the message text and
`:user-invalid` are browser rows.

`Intl.NumberFormat` in Node has full ICU: `de-DE` currency parts are `minusSign integer group
integer decimal fraction literal currency`, `ar-EG` gives Arabic-Indic digits with `٫` / `٬`,
`fr-FR` groups with U+202F, `de-CH` with `'`; `percent` resolves `maximumFractionDigits` `0`,
`JPY` `0`.

### react-dom 19.3.1 input rules (read from `react-dom-client.development.js`)

- `initInput` (mount): `isHydrating || value === element.value || (element.value = value)`:
  during hydration the DOM value of a text input is kept (the typed-before-hydration path);
  `element.defaultValue = value` is written even then.
- `updateInput` (every update): with a `value` prop, `setDefaultValue(element, value)` (a
  controlled input's `value` attribute always equals the current value: the conventions' rule
  for controlled value inputs); with no `value` prop and a `defaultValue` prop,
  `setDefaultValue(element, defaultValue)` only when changed. That is the basis for the
  **uncontrolled hidden number input**: its `value` attribute is the reset target and the
  platform's reset restores it; the library writes `.value` through the ref.

## The commit model, worked through

The product owner left "when the value is committed" and the triple semantics to the design.
Options weighed:

1. Per-keystroke parse (Base UI): rejected, partial text is not a number and a controlled
   parent formatting under the caret is the classic broken number field.
2. One action per gesture (typed commit, key, hold release) with the hold previewed
   internally: smaller API. Rejected mainly for consistency: Slider already established the
   step / commit pair and the conventions name it; a controlled "live total" during a hold
   needs the step channel; and adding the pair later would change `valueChangeAction`'s meaning.
3. Slider's pair: chosen. A typed value fires both with the same event; a key press is a
   one-step gesture; a hold is steps + one commit; wheel events are one-step gestures.

The draft text is internal and urgent (Combobox's lane without the triple). `live` + `held` +
`stepHeld` are Slider's, reused unchanged.

## The Field problem, worked through

Two inputs: the visible one is what the user interacts with (`:user-invalid`, focus, the
browser's report), the hidden one has the real `ValidityState` and the localised messages.
The research's mirror (`visible.setCustomValidity(hidden.validationMessage)`) makes the visible
input invalid whenever the hidden one is. But the Field **owns the custom-validity slot** of its
control and writes `setCustomValidity(validate / server / "")` on it: registered on the
visible input, its write would erase the mirror (a `""` write makes the visible input valid
while the hidden one is `rangeOverflow`, so the browser would then report on the aria-hidden
input), and its `validity` snapshot would show `customError` only.

Options:

- (a) Register the visible input only and have the Field hand its custom message to the control
  (`applyCustomValidity` callback) so the control composes. Still needs the flags from the
  hidden input for `Field.Error`'s `validity`, so a validity-element pointer is needed anyway.
- (b) Register the hidden input: the Field would listen, focus and read `:user-invalid` there.
  Wrong element for all three.
- (c) Registration gains `validityElement?: () => ValidatableElement | null`: the Field reads
  `validity` / `validationMessage` and writes the slot there, keeps `:user-invalid`, listeners
  and focus on the registered element, and mirrors after its slot write (one line). Chosen.
  Lazy function because the hidden input's ref attaches after the visible input's in the same
  commit, and the Field already re-resolves on every read.

The hidden input's `invalid` must always be cancelled by the library (never the Field): with
the Field cancelling the visible one's only, the hidden one would be the first *unhandled*
invalid control and the browser would try to focus it.

Order of listeners for a blur: the Field's capture `focusout` listener on the input fires before
React's bubble-phase `onBlur` at the root, so the Field reads *before* the commit. Harmless: the
commit's sync render + layout effects then run `useFieldValueChange` → `notifyChange`, and the
Field re-reads after the hidden input was written. Also the visible input's native `change`
fires after `blur` for typed text and the Field hears it.

## Smaller decisions

- Step base without `min`: the spec's default is `0` for `stepUp()`, but a number input's own
  base is its `value` **attribute** when `min` is absent, which for the hidden input is the
  reset target. Library stepping uses `min ?? 0`; the platform's `stepMismatch` uses the
  attribute. Documented ("give `min` when the grid matters") rather than fought.
- Percent default step `0.01` (React Aria) rather than `1`: a 100% step is never what a
  percent field wants.
- Buttons do not focus the input (research), unlike React Aria. Consequence: a typed draft is
  parsed as the hold's base at the press.
- Hold ending at the bound: the button becomes natively `disabled` when the next step is a
  no-op; a disabled element may not deliver `pointerup`, so the library ends the hold itself
  when a step changes nothing.
- `locale` default: runtime locale on both sides, a dev warning on `lang` disagreement. The
  `lang` fallback would differ between server and client.
- `aria-roledescription`: none. A role description replaces the role name in NVDA / JAWS /
  VoiceOver, hiding "edit text".
- Announcement fallback: a module-level live region (React Aria's announcer shape), because the
  product owner asked for a fallback and no part should render a live region.
- The hidden input is visually hidden (the probed shape), not `display: none`; both validate,
  but the probe covered one.

## Open for the implementation

- Verify in all three engines that a `setCustomValidity` mirror set from a `focusout` handler is
  visible to `:user-invalid` in the same task (the Field's read happens after the commit's
  layout effects, so it should be).
- The parser's Indian grouping detection (format `1234567` and read group lengths) and the
  `ar-EG` sign placement (`؜-` with ALM U+061C in some ICU versions: strip the ALM in NFKC? It
  is not changed by NFKC; strip explicitly).
- Whether `hidden` (the attribute) could replace the visually hidden style; not probed, so the
  design keeps the probed shape.
