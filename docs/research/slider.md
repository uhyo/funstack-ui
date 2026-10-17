# Slider: native range input, styling, vertical, multi-thumb, React

Date: 2026-10-17. GitHub issue #55 (wave 5). Engines probed: Chromium 156.0.8078.4 and Firefox
157.0 (Playwright 1.64.1); React / react-dom 19.3.1 in jsdom. WebKit cannot launch locally, so
WebKit rows come from BCD 8.1.6 (2026-10-15) and vendor sources. Current stable: Chrome 155,
Firefox 158, Safari 27. Probes: `memo/platform-researcher/probes/13-slider/`.

## Summary and verdict

**Adopt a native `<input type="range">` per thumb as the focusable, labelled, form-participating
element**, visually hidden inside a styleable `Thumb` element, with library JS only for pointer
geometry and visuals (Base UI 1.9 uses the same structure). The native input gives role `slider`,
value/min/max, `aria-valuetext`, orientation (from `writing-mode`), Arrow/Page/Home/End keys, RTL
mirroring, `FormData`, `disabled`, and `<label>` for free in every engine. **Not yet:**
`appearance: base` and the standard `::slider-thumb`/`::slider-track`/`::slider-fill` pseudo-elements
(no engine ships them), `<rangegroup>` (Chromium "Proposed" since 2026-09), and the
`step-up`/`step-down` commands.

Findings that change the API design:

1. **A controlled range must render the optimistic value.** With `value={state}` updated in a
   transition, React restores the DOM to the old value after every `input` event, so the thumb
   snaps back for the **whole drag** and stays there until the action settles. `value={optimistic}`
   follows the pointer (probe `react-range.mjs`). This is the same rule as checkable inputs
   (form-controls.md §2), and it is more visible here.
2. **React has no "commit" event for a range.** React's `onChange` fires on every native `input`.
   The native `change` (pointer release, each key press) produces no React `onChange` when the
   value did not change since the last `input`. A commit action needs a native `change` listener
   (or `pointerup` in the library's own pointer code). Recommend two action props:
   `valueChangeAction` (continuous) and `valueCommitAction` (on commit).
3. **`form.reset()` does nothing to a React-controlled value input.** React syncs the `value`
   attribute (`defaultValue`) to the current value on every update, so a reset restores the
   current value. This differs from checkboxes, where `defaultChecked` is the mount-time value. Slider
   (and every controlled text field) must implement reset itself (§6).
4. **Multi-thumb has no native element yet.** One hidden native input per thumb, with the
   neighbour's value as the native `min`/`max`, gives APG multi-thumb semantics (dynamic
   `valuemin`/`valuemax`) and native clamping with no ARIA overrides.

| Feature | Blink | WebKit | Gecko | Verdict |
| --- | --- | --- | --- | --- |
| `<input type=range>`: role `slider`, keys, form, `<label>`, `disabled`, `step` | ✓ | ✓ | ✓ | **adopt** |
| Vertical via `writing-mode` (+ `direction: rtl` for bottom-to-top) | 124 | 16.5 | 120 | **adopt** |
| `aria-valuetext` on native range (ARIA in HTML: allowed) | ✓ (serialised, source) | docs | docs | **adopt** |
| `list` + `<datalist>` | 20 | 12.1 | 110 | pass-through only (hidden input shows no ticks) |
| `accent-color` on range | 93 | 26.2 (partial 15.4–26.1) | 92 | consumer CSS (visible-native variant) |
| `::-webkit-slider-thumb` / `::-webkit-slider-runnable-track` | ✓ | 18 (BCD) | ✗ (bug 1950161) | consumer CSS only |
| `::-moz-range-thumb` / `-track` / `-progress` | ✗ | ✗ | 21/21/22 | consumer CSS only |
| `appearance: base` + `::slider-thumb`/`::slider-track`/`::slider-fill` (CSS Forms 1) | flag `AppearanceBase` experimental | ✗ | ✗ | **not yet** |
| `<rangegroup>` (Open UI enhanced range input) | Proposed (chromestatus 5199707839266816) | no signal | no signal | **not yet** |
| `command="step-up"` / `"step-down"` | Proposed (5077339740438528) | no signal | no signal | **not yet** |
| Pointer Events + `setPointerCapture` + `touch-action` | ✓ | 13 | ✓ | **adopt** (library pointer code) |

## 1. Native range behaviour (probed)

Identical in Chromium 156 and Firefox 157 unless noted:

| Input | Result (min 0, max 100, value 50, step 1) |
| --- | --- |
| ArrowRight / ArrowUp | 51 |
| ArrowLeft / ArrowDown | 49 |
| PageUp / PageDown | 60 / 40 (10% of the range; with max 1000, step 10: 600 / 400) |
| Home / End | 0 / 100 |
| `dir="rtl"` | ArrowRight 49, ArrowLeft 51 (mirrored), Up/Down unchanged |
| Each key press | `input` then `change` |
| Click on the track | jumps to the pointer, `input` + `change` |
| Drag | `input` per move, `change` once on release |

This covers the APG Slider keyboard table (Right/Up increase, Left/Down decrease, Home/End,
Page Up/Down "by an amount larger than the step"). APG leaves Shift+Arrow unspecified; Base UI
binds it to the large step in JS.

**Vertical sliders** (`writing-mode: vertical-lr`):

| | Chromium 156 | Firefox 157 |
| --- | --- | --- |
| `direction: rtl` (min at the bottom, the usual "volume" slider) | Up 51, Down 49, **Right 51**, Left 49 | Up 51, Down 49, **Right 49**, Left 51 |
| `direction: ltr` (min at the top) | **Up 49, Down 51** (visual), Right 51 | Up 51, Down 49 (logical), Right 51 |
| Accessibility orientation | `vertical` (from `writing-mode`) | – |

Up increases a bottom-to-top slider in both engines, but **ArrowRight on a vertical slider
decreases in Firefox**, against APG ("Right Arrow: increase"). The library should handle
ArrowLeft/ArrowRight in JS for vertical sliders, or leave them native and document the Firefox
behaviour. Chromium **ignores `aria-orientation`** on a native range and takes orientation from
`writing-mode` (probe `orientation-ax.cjs`), so the hidden input must carry the vertical
writing mode itself.

**Value sanitisation** (both engines): values clamp to `[min, max]`, snap to `step` from `min`
(`33` with step 10 becomes `30`), non-numbers fall back to the default, and with `max` not on a
step the maximum reachable value is the last step below it (`min 0, max 5, step 2` caps at `4`).
A range input is never invalid (`validity.valid` is always true; `required` does not apply).

## 2. Styling

- **No standard pseudo-elements yet.** `CSS.supports("appearance", "base")` and
  `selector(::slider-thumb|::slider-track|::slider-fill)` are false in Chromium 156 and Firefox 157.
  Chromium's `AppearanceBase` flag is still `experimental` on main (chromestatus 5104958101913600,
  "Proposed", no other-vendor signal). The Open UI explainer (updated 2026-10-14) adds
  `::slider-segment(n)`, `::slider-tick`, `::slider-tick-label`, and CSSWG resolved on
  `::slider-fill-under`/`-over` (2026-02-19). This is moving and not shipped anywhere.
- **Vendor pseudo-elements.** Blink/WebKit use `::-webkit-slider-thumb` and
  `::-webkit-slider-runnable-track`; Gecko uses `::-moz-range-thumb`/`-track`/`-progress`.
  Firefox does not parse the `-webkit-` ones (bug 1950161, NEW). Because an unknown pseudo-element
  invalidates the whole selector list, consumers must write each rule twice. Only Gecko has a
  fill pseudo-element.
- **Consequence for a headless library:** styling the native control can be a documented recipe,
  not the component's anatomy. The anatomy needs real elements (Track, Range/Indicator, Thumb) whose
  geometry the library drives with a CSS custom property, for example `--slider-value: 0.42` (or
  per thumb). That property must come from the **optimistic** value.
- `<output>` for a value label has implicit role `status` (a polite live region). A label that
  updates on every drag step would chatter. Use a plain element; the slider already exposes its
  value.

## 3. Accessibility

- **Name:** `<label for>` or `aria-labelledby` on the native input. With several thumbs each input
  needs its own name ("Minimum price", "Maximum price"), and the group gets
  `role="group"` + `aria-labelledby` (Open UI's `<rangegroup>` also maps to `group`).
- **`aria-valuetext`** is allowed on `input type=range` (ARIA in HTML: "any other aria-* attributes
  applicable to the slider role"). Chromium serialises it for any element
  (`ax_object.cc`, `StringAttribute::kAriaValueText`); CDP's `valuetext` property does not show it,
  so the probe could not confirm platform exposure. Screen-reader support was not measured here.
  Offer a `getAriaValueText(value, index)` prop and set the attribute from the optimistic value.
- **Do not put `aria-valuemin`/`aria-valuemax`/`aria-valuenow` on the native input.** ARIA in HTML
  says authors SHOULD NOT use the min/max ones, and Chromium lets them **override** the native
  values (`aria-valuemax="10" aria-valuenow="3"` on a 0–100 range at 50 was exposed as 3 of 10).
  Express bounds through the native `min`/`max`, which Chromium exposes as `valuemin`/`valuemax`.
- **Visually hidden, not `display: none`:** the input must stay focusable and in the AX tree. Base
  UI sizes the hidden input to the thumb (`width/height: 100%`) so VoiceOver's focus outline matches.
- **Focus ring:** the thumb shows focus with `:has(:focus-visible)`.

## 4. Pointer interaction

Two workable structures, both verified in Chromium and Firefox (`overlay-dual.mjs`):

1. **Hidden input per thumb + library pointer code (recommended).** `pointerdown` on the track
   or thumb, `setPointerCapture`, value from the pointer position along the track's inline or block
   axis (respecting `direction` and `writing-mode`), `touch-action: none` (or `pan-y` for horizontal)
   on the track. The library writes the value to the native input, focuses it, and dispatches.
   Track click moves the nearest thumb. This is what Base UI and Radix do.
2. **Native input as the hit surface.** An `opacity: 0` range over custom visuals still takes
   pointer input and focus (click at 80% gave 82 in both engines). Two overlaid ranges with
   `pointer-events: none` on the input and `auto` on its thumb pseudo-element give a working
   dual-thumb slider with zero pointer JS. The catch: the native thumb size, set only through vendor
   pseudo-elements, decides the value-to-position mapping, so it must match the custom thumb.
   That needs a stylesheet, which a headless library does not ship. Also, the track between the
   thumbs ignores clicks, and the native `min`/`max` cannot be dynamic (it would change the track
   mapping).

Structure 1 keeps everything stylable and gives dynamic bounds. Structure 2 is a good
**static variant** (issue #19): a lone native `<input type=range>` is a complete zero-JS slider
for forms and can render from a Server Component.

## 5. Multi-thumb

- **APG Slider (Multi-Thumb):** each thumb is a `slider` in the tab order, and a thumb's
  `aria-valuemin`/`aria-valuemax` reflect its neighbours, so a thumb cannot pass another.
- **With hidden native inputs** set the lower input's native `max` to the upper value and the upper
  input's native `min` to the lower value (plus `minStepsBetweenThumbs × step`). Then native Home/End,
  Page keys and clamping respect the neighbour, and the AX tree exposes the dynamic bounds (dynamic
  `min="40"` appeared as `valuemin: 40`, `orientation-ax.cjs`). Caveat: the step base is `min`, so
  neighbour values must already be on the step grid (they are, because every thumb shares `step`
  and the original `min`).
- **Form data:** one name per thumb (`price-min`, `price-max`), or one shared `name` read with
  `FormData.getAll()`; the `<rangegroup>` explainer submits per-input pairs the same way.
- **`<rangegroup>`** (Open UI, Chromium Intent to Prototype, 2026-09-17) will be this structure in
  native form: a `group` with `<legend>`, child `<input type=range>`s, shared track, native keyboard
  and form participation. The explainer still has open issues (pointer model #1460, overlapping
  thumbs #1184, vertical #1525). Design the anatomy so a future `<rangegroup>` can replace the
  hidden inputs without an API change: Root (group, label), Track, Range (fill between thumbs),
  Thumb (one per value, each with its own label).

## 6. React 19.3 interaction

- **Optimistic value is mandatory** (finding 1). Probe: transition-only DOM stayed at 50 through
  a 60/65/70/75 drag; with `useOptimistic` it read 60 then 75 while the actions were pending; both
  settled at 75. The CSS `--slider-value` and `aria-valuetext` follow the same optimistic value.
- **One action per `input` event** is many concurrent transitions during a drag. That is correct
  under latest-intent-wins (conventions 2.5), but every pending async action also entangles every
  other transition in the app (react-async-apis.md §2). Recommend: `valueChangeAction` updates
  library state and is meant for cheap work; `valueCommitAction` runs once per gesture or key
  press for saving. Document that the server save belongs in the commit action.
- **Commit detection:** pointer gestures are the library's own (`pointerup`/`lostpointercapture`).
  Keyboard commits arrive as native `change`, which React does not surface (finding 2). Add a native
  listener on the input via a ref.
- **Hydration:** `initInput` keeps the DOM `value` while hydrating
  (`isHydrating || value === element.value || (element.value = value)`), so a pre-hydration key
  press or Firefox form-state restoration leaves DOM ≠ state. Use the same mount reconciliation as
  Checkbox (`reason: "platform"`).
- **Form reset** (finding 3, `react-range-reset.mjs`): controlled input at 70, `form.reset()` → still
  70; uncontrolled `defaultValue={20}` → 20. React's automatic reset after a successful
  `<form action>` is therefore a no-op too. The Slider listens for `reset` on `input.form` and
  dispatches its own default (`defaultValue` in uncontrolled mode; in controlled mode the parent
  decides) with `reason: "platform"`. **This applies to every controlled value input**
  (text fields in Field/Form as well); form-controls.md's reset rule assumed `defaultChecked`
  semantics, which do not hold for `value`.
- **No `<ViewTransition>`:** value changes are continuous. Animate the thumb with CSS
  transitions on `--slider-value` (register it with `@property` so it interpolates), disabled
  while dragging (`data-dragging`).

## 7. Recommendation for the architect

1. **Anatomy:** `Slider.Root` (`role="group"` when there are several thumbs; label part),
   `Slider.Track`, `Slider.Range`, `Slider.Thumb` (a `<span>`/`<div>` containing a visually hidden
   `<input type="range">`), optional `Slider.Value` (not `<output>`).
2. **State:** `value: number | number[]` / `defaultValue` / `valueChangeAction`, plus
   `valueCommitAction`. Render `value={optimistic}` on every input. Expose `data-dragging`,
   `data-pending`, `data-orientation`, `data-disabled`, and `--slider-value` (0–1) per thumb plus
   range start/end on Root.
3. **Native props on each input:** `name`, `form`, `min`, `max`, `step`, `disabled`, `aria-valuetext`
   (from `getAriaValueText`), dynamic neighbour `min`/`max` for multi-thumb. Never `aria-valuemin`,
   `aria-valuemax`, `aria-valuenow`.
4. **Orientation:** `orientation="vertical"` sets `writing-mode: vertical-lr; direction: rtl` on the
   hidden input (inline style), so AX orientation and Up/Down keys are native. Normalise
   ArrowLeft/ArrowRight in JS for vertical (Firefox decreases on Right).
5. **Keyboard:** native for horizontal (including RTL). Optional Shift+Arrow large step is a JS
   addition.
6. **Pointer:** library code with pointer capture; track click moves the nearest thumb; thumbs never
   cross.
7. **Residual browser paths:** mount reconciliation and form reset, as for Checkbox, with reset
   dispatching the default explicitly.
8. **Static variant candidate:** a plain `<input type=range>` (Server Component) for JS-free forms.
9. **Revisit** when `AppearanceBase` ships in Chromium and when `<rangegroup>` reaches an Intent to
   Ship; both could replace parts of the anatomy without changing the state API.

## References

- BCD 8.1.6: `html.elements.input.type_range` (incl. `vertical_orientation`, `list`, `tick_marks`),
  `css.selectors.-webkit-slider-thumb`, `css.selectors.-moz-range-thumb`, `css.properties.appearance`,
  `css.properties.accent-color`: https://unpkg.com/@mdn/browser-compat-data@latest/data.json
- Chromium runtime flags (`AppearanceBase` experimental):
  https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/platform/runtime_enabled_features.json5
- Chromium `ax_object.cc` (`kAriaValueText` serialisation):
  https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/modules/accessibility/ax_object.cc
- chromestatus: `<rangegroup>` https://chromestatus.com/feature/5199707839266816 ; Base Appearance Form
  Controls https://chromestatus.com/feature/5104958101913600 ; step-up/step-down commands
  https://chromestatus.com/feature/5077339740438528 ; vertical form controls
  https://chromestatus.com/feature/5082460523331584
- Open UI enhanced range input explainer (updated 2026-10-14): https://open-ui.org/components/enhanced-range-input.explainer/
- CSS Form Control Styling Level 1: https://drafts.csswg.org/css-forms-1/
- Firefox bug 1950161 (no `-webkit-` range pseudo-elements): https://bugzilla.mozilla.org/show_bug.cgi?id=1950161
- MDN vertical form controls: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_writing_modes/Vertical_controls
- ARIA in HTML (`input type=range`): https://www.w3.org/TR/html-aria/
- APG Slider: https://www.w3.org/WAI/ARIA/apg/patterns/slider/ ; Slider (Multi-Thumb):
  https://www.w3.org/WAI/ARIA/apg/patterns/slider-multithumb/
- Base UI 1.9.0 `slider/thumb/SliderThumb.mjs` (hidden native range per thumb):
  https://unpkg.com/@base-ui/react@1.9.0/slider/thumb/SliderThumb.mjs
- react-dom 19.3.1 `initInput` / `updateInput` (value attribute syncing):
  `packages/ui/node_modules/react-dom/cjs/react-dom-client.development.js`
- FUNSTACK research: form-controls.md (optimistic controlled inputs, reset, mount reconciliation),
  react-async-apis.md §2 (entanglement)
- Probes: `memo/platform-researcher/probes/13-slider/`
