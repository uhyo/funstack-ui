# Wave 6: ToggleGroup + Toolbar, NumberField, Progress + Meter

Date: 2026-10-18. GitHub issue #65 (wave 6; components #66, #67, #68). Engines probed: Chromium
156.0.8078.4 and Firefox 157.0 (Playwright 1.64.1). WebKit cannot launch locally, so WebKit rows
come from BCD 8.1.6 (2026-10-15), WebKit Bugzilla and standards positions. Current stable: Chrome
155 (155.0.8059.85, branch 8059), Firefox 158, Safari 27. Probes and their outputs:
`memo/platform-researcher/probes/15-wave6/`.

## Summary and verdicts

| Component | Recommendation | Verdict |
| --- | --- | --- |
| **ToggleGroup** | `role="group"` of `aria-pressed` Toggles in both single and multiple mode, JS roving tabindex (one Tab stop). A single choice that is a form value is a RadioGroup, not a ToggleGroup. | **adopt** (JS); `focusgroup` **behind experimental flag** |
| **Toolbar** | `role="toolbar"` + `aria-orientation`, JS roving tabindex that skips `disabled`, keeps `aria-disabled` items focusable, mirrors arrows in RTL, and leaves arrow keys to text-entry items. A ToggleGroup inside a Toolbar joins the Toolbar's roving sequence. | **adopt** (JS); `focusgroup="toolbar"` **behind experimental flag** |
| **NumberField** | Visible `<input type="text" inputmode=…>` (textbox, **no** `role="spinbutton"`), library parsing and formatting through `Intl.NumberFormat`, plus a visually hidden `<input type="number" name min max step>` after it for `FormData`, reset and constraint validation. Its `validationMessage` is mirrored onto the visible input with `setCustomValidity`. Step announcements through `ariaNotify()`. | **adopt**; native visible `<input type=number>` **not** recommended |
| **Progress / Meter** | `div role="progressbar"` / `div role="meter"` with ARIA values, `Track` / `Indicator` parts, and a CSS custom property for the fill. Native `<progress>` / `<meter>` are correct semantically but cannot carry styleable parts. | **adopt** ARIA roles; native elements **not** as the rendered element |

Findings that change the API design:

1. **A ToggleGroup nested in a Toolbar must not create its own focusgroup.** In Chromium a nested
   `focusgroup` opts out of the ancestor and becomes a separate segment, so the toolbar ends up
   with **three Tab stops** in the probe instead of one (APG Toolbar wants one). The JS path has the
   same choice to make: inside a Toolbar, a ToggleGroup must hand its items to the Toolbar's
   roving sequence.
2. **Chromium's `focusgroup` lets Tab move between items after a text input.** From an `<input>`
   inside `focusgroup="toolbar"`, the arrow keys stay in the input. Tab moves to the next toolbar
   item, not out of the toolbar, and Shift+Tab to the previous one. The JS path should do the same,
   or the two paths disagree.
3. **A native `<input type=number>` silently corrupts localised input.** With an `en-US` browser UI,
   Chromium turns a typed `1,5` into `15` and `1.234,5` into `1.2345`, with `badInput` false.
   Chromium localises from the **browser UI language** (`--lang`). Firefox localises from the
   element's **`lang`** and marks `1,5` as `badInput` under `lang="en"`. The page cannot make
   Chromium accept its locale's separator.
4. **`role="spinbutton"` is broken in VoiceOver.** On a text input, WebKit 221102 (NEW; confirmed
   on macOS 2026-03 and 2026-09) makes VoiceOver announce "50%" or "0" instead of the value.
   WebKit 314879 (2026-05, NEW) maps a native `<input type=number>` to `AXTextField`. React Aria
   3.53 and Base UI 1.9 both render a plain textbox for this reason.
5. **The hidden native number input is focused by the browser on an invalid submit unless the
   visible input is invalid too.** Mirroring `hidden.validationMessage` onto the visible input
   (visible first in tree order) moves the browser's focus and `:user-invalid` to the visible input
   in both engines, and keeps the browser-localised message.
6. **`<progress>` children are never rendered.** A native element cannot host an `Indicator` part.
   The fill is a vendor pseudo-element. It animates with a CSS `transition` in Chromium but not in
   Firefox, and indeterminate styling differs: with `appearance: none`, Chromium draws no bar and
   Firefox draws a full one.

## 1. ToggleGroup and Toolbar

### 1.1 APG and prior art

- **APG Toolbar.** The container has `role="toolbar"`, is labelled, and carries
  `aria-orientation="vertical"` when vertical. There is one Tab stop. Left/Right move between
  controls (Down/Up when vertical), wrapping is optional, and Home/End are optional. Re-entry may
  restore the last focused control. "Use toolbar … only if the group contains 3 or more controls."
  Controls that need the toolbar's arrow pair should be avoided; if unavoidable, use one and put it
  **last** (a textbox, for example).
- **APG Toolbar example.** Bold/Italic/Underline are `aria-pressed` buttons. Text alignment is a
  nested `radiogroup` whose **Up/Down** move within the group and **do not check**, while
  Left/Right move through the toolbar. Space/Enter check. Cut/Copy/Paste use `aria-disabled` and
  stay focusable "to ensure screen reader users are aware of their presence". The example also has
  a menu button, a `spinbutton` and a checkbox.
- **APG has no toggle-group pattern.** Libraries disagree:

| Library | Single | Multiple | Roving |
| --- | --- | --- | --- |
| Radix ToggleGroup 1.2.1 | `radiogroup` + `role="radio"` `aria-checked` | `toolbar` + `aria-pressed` | yes, loop on |
| Base UI 1.9 ToggleGroup | `group` + `aria-pressed` | `group` + `aria-pressed` | yes, `loopFocus` on |
| React Aria 3.53 ToggleButtonGroup | `radiogroup` + `radio` | `toolbar` (`group` when inside a toolbar) | arrow keys move focus. Not roving: Tab is intercepted to leave the group |
| Base UI 1.9 Toolbar | `toolbar` + `aria-orientation`, disabled items optionally focusable | | yes |

### 1.2 Group semantics: recommend `aria-pressed` in a `group` for both modes

- **Arrows move focus, they don't select.** In a toolbar, arrow keys must move focus without
  changing the selection (APG example). A `role="radio"` whose arrow keys do not check breaks
  the radio contract every screen-reader user knows from native radios and the APG Radio Group,
  where arrows check.
- **Single mode usually allows "none".** Pressing the pressed item clears it (`string | null`,
  toggle.md §10), and a checked radio cannot be unchecked.
- **Toggle stays unchanged.** `ToggleGroup.Item` reuses Toggle's `<button aria-pressed>`, as the
  toggle design expects. Chromium exposes it as `button`, `pressed: "false"/"true"` (probed).
- **Form choices have a better home.** An exclusive choice that is a form value is better served by
  RadioGroup (native radios, arrows check, `name`, `required`; form-controls.md §3), styled as a
  segmented control.
- **Risk.** Screen readers will not say "1 of 3" or convey mutual exclusivity. Mitigate with a
  group label. If the PO wants radio semantics for exclusive mode, the honest version is
  "exclusive and not deselectable" with arrows that check, which is exactly RadioGroup.

`aria-orientation` is not supported on `role="group"`, so a standalone ToggleGroup exposes
orientation as `data-orientation` only. Inside a Toolbar the Toolbar carries `aria-orientation`.

### 1.3 `focusgroup`: still Chromium-only

| | Blink | WebKit | Gecko |
| --- | --- | --- | --- |
| `focusgroup` (scoped, incl. `toolbar`, `tablist`, `radiogroup`, `menu`, `menubar`, `listbox`) | flag `Focusgroup` **stable** since 150 (M155 branch and main) | no implementation; standards-positions #171 position "None"; no Bugzilla entry | standards-positions #1348 **positive**; meta bug 2070976 NEW, unassigned (last change 2026-10-06) |
| `FocusgroupV2` (grid) | `experimental` | – | – |
| Spec | WHATWG PR #11723 **open** (updated 2026-10-13); BCD has no entry | | |

Detection is `"focusGroup" in HTMLElement.prototype` (camelCase, issue #43; popover-menu.md
Corrections). Probe `toolbar-focusgroup.mjs` / `toolbar-input-tab.mjs`, Chromium 156:

| Behaviour | Chromium `focusgroup="toolbar"` |
| --- | --- |
| Container role | `toolbar` inferred on a role-less `div`, `aria-orientation` defaults to horizontal; an explicit `role` wins (no inference) |
| Tab stops | one from outside; `item.tabIndex` still reads `0`, so the library must not write `tabindex="-1"` on the native path (as Tabs does) |
| Arrows | Right/Left only (`inline` default); `toolbar block` takes Down/Up only |
| RTL | ArrowLeft moves forward under `dir="rtl"` (native) |
| Wrap | off by default for `toolbar`; `wrap` token enables it |
| Home / End | first / last item |
| `disabled` button | skipped |
| `aria-disabled="true"` button | focusable, stays in the sequence (matches the APG example) |
| Memory | Tab re-enters on the last focused item; `nomemory` + `focusgroupstart` enters on the marked item |
| Text input / number input item | arrows go to the caret (or spin), never leave the input; **Tab / Shift+Tab move to the next / previous toolbar item**, not out of the toolbar |
| Nested `focusgroup="radiogroup"` | separate segment and **extra Tab stops** (toolbar had 3 in the probe) |
| `keydown` `preventDefault()` on an item | suppresses the move (a Menu trigger's own ArrowDown wins) |
| Firefox 157 | attribute inert; `focusGroup` absent |

The native path still lacks: "first non-disabled item on first entry, else last focused" (it has
memory, so this mostly holds), and any knowledge of ToggleGroup selection. Verdict: **behind an
experimental flag** (`experimental_focusgroup`, as on Tabs and Menu.Popup), JS everywhere else.

### 1.4 Keyboard model to implement in JS

- **Roving tabindex, real focus.** Real focus (not `aria-activedescendant`) is needed because items
  are buttons, menu triggers and inputs, and a Menu anchors to its real-focused trigger
  (popover-menu.md).
- **Items** are the focusable descendants that belong to this Toolbar, not to a nested Toolbar or
  a popover. Skip native `disabled`. Keep `aria-disabled`. Recompute from the DOM on keydown, as
  Tabs does.
- **Orientation and RTL.** Use `orientation` and `getComputedStyle(toolbar).direction`, as
  `tabs-list.tsx` `resolveKey` does. Home/End always apply. Default wrap: decide in design (APG
  optional; Base UI and Radix loop; native `toolbar` does not).
- **Key conflicts.** Do not handle arrow keys or Home/End whose target edits text or owns
  arrows: `input` (except button-like types), `textarea`, `select`, `[contenteditable]`, and
  `role` `spinbutton` / `slider` / `combobox` / `textbox`. That is the focusgroup "key conflict"
  rule and APG's "JavaScript does not interfere with … text editing". To match the native path,
  Tab / Shift+Tab from such an item go to the next / previous toolbar item while one exists. APG
  still advises one such control, placed last; the docs should say so.
- **Respect `defaultPrevented`.** An item that handled the key itself wins.
- **Menu triggers.** `Menu.Trigger` opens on ArrowDown/ArrowUp (`menu-trigger.tsx`). In a
  horizontal Toolbar that is fine. In a **vertical** Toolbar it steals the navigation keys, so the
  design must decide whether a trigger inside a vertical Toolbar gives up arrow opening (APG makes
  arrow opening optional).
- **NumberField in a Toolbar** (the APG example has a spinbutton) is a conflict item: Left/Right
  move its caret. Treat it as the "last item" case.
- **ToggleGroup inside Toolbar.** The group renders `role="group"`, labelled, with no roving of its
  own, and its items join the Toolbar sequence. This is React Aria's `isInToolbar` approach. The
  group detects the Toolbar through context, not DOM, so it also works under SSR.
- **ToggleGroup standalone.** Roving tabindex. The Tab stop is the pressed item, else the first
  enabled item, like radios. Focus never changes the pressed state.
- **Transitions.** Pressing dispatches `valueChangeAction` in a transition with optimistic value,
  as Toggle does. Focus movement is not state, so nothing to transition.

### 1.5 Risks

- The `focusgroup` attribute and token grammar can still change before WHATWG #11723 lands.
- Divergence between the native and JS paths (Tab out of a text input, memory, wrap defaults)
  needs a browser test that runs both paths in Chromium. Branch on `focusGroup`.
- `aria-pressed` single-select gives weaker "exclusive choice" semantics than radios (1.2).

## 2. NumberField

### 2.1 Native `<input type="number">` per engine (probe `number-platform.mjs`)

| Behaviour | Chromium 156 | Firefox 157 |
| --- | --- | --- |
| ArrowUp / ArrowDown | ±step; events `beforeinput`, `input`, **`change` immediately** | same (`inputType` `insertReplacementText`) |
| PageUp / PageDown / Home / End | nothing | nothing |
| Shift+Arrow | ±step (no large step) | same |
| Off-grid value (1.5, step 1) + ArrowUp | **2.5** (UI stepping does not snap) | 2.5 |
| `stepUp()` from 1.5, step 1 | 2 (snaps, per spec) | 2 |
| Empty + ArrowUp / Down (min 3) | 3 / 3 | 3 / 3 |
| Empty + ArrowUp / Down (no min) | 1 / −1 | 1 / −1 |
| ArrowUp at max | clamps | clamps |
| **Wheel over the focused input** | **changes the value** (`input`, no `change`), page does not scroll | **ignores it**, page scrolls |
| Wheel over an unfocused input / elsewhere | page scrolls | page scrolls |
| Typing letters | rejected at input time (value `""`, **not** `badInput`) | accepted, `badInput: true` |
| `1,5` with `en` | **`15`, valid** | `badInput` |
| `1,5` with `de` | `1.5` only with the browser UI in German (`--lang=de-DE`); page `lang` and `navigator.language` override have no effect | `1.5` when the element's `lang` is `de`, regardless of UI locale |
| `1.234,5` | `1.2345` in every UI locale tried | `badInput` |
| Full-width `１２` | 12 (`NumberInputFullWidthChars` stable) | 12 |
| Arabic-Indic `٣` | rejected | 3 |
| Display of 1234.5 | `1234,5` under German UI; never grouped | (follows `lang`) |
| `setSelectionRange()` / `selectionStart` | **throws `InvalidStateError`** / `null` | same |
| Validation messages | "Value must be less than or equal to 10." | "Please select a value that is no more than 10." |
| AX (Chromium) | `spinbutton`; with no `min`/`max` it exposes **`valuemin 0`, `valuemax 0`** | – |
| Spinner styling | `::-webkit-inner-spin-button` | no pseudo-element; `appearance: textfield` hides it |
| WebKit (BCD, Bugzilla) | allows letters (value `""`); **VoiceOver: `AXTextField`, no adjustable trait** (314879) | |

Verdict on the native visible input: **not recommended.** It cannot format (no grouping,
currency, percent or units). Its localisation follows the browser UI in Chromium and `lang` in
Firefox, and both fail silently. Wheel behaviour diverges. Caret control throws. The spinner cannot
be styled in Gecko, and it is a text field to VoiceOver anyway.

### 2.2 Recommended structure

```text
NumberField.Root      div role="group" (label target for the buttons' context), data-* states
  NumberField.Input   <input type="text" inputmode autocomplete="off" autocorrect="off" spellcheck="false">
  NumberField.Decrement / .Increment   <button type="button" tabindex="-1" aria-controls aria-label>
  (owned)             <input type="number" name min max step value aria-hidden tabindex="-1">, visually hidden, after the visible input
```

- **No `role="spinbutton"` on the visible input.** APG asks for it, and in Chromium the AX tree
  is right (`spinbutton`, `valuenow` from `aria-valuenow`; probed). But VoiceOver announces
  "50%" or "0" for it (WebKit 221102, still NEW, re-confirmed in 2026), and its swipe gestures
  corrupt the text value (WebKit 250380, NEW). Even the native number input is `AXTextField` in
  Safari (314879). A plain textbox reads its formatted text correctly everywhere. React Aria
  3.53 removes the role and adds a localised `aria-roledescription="number field"`; Base UI 1.9
  uses `aria-roledescription="Number field"`. Recommend the textbox, and leave
  `aria-roledescription` as a design decision: it needs localisation, and it hides "edit text" in
  some screen readers. **Open question for the PO**, because it deviates from APG.
- **Announce stepped values with `ariaNotify()`.** A textbox whose value changes through
  Up/Down or the buttons is not reliably announced. Use `input.ariaNotify(formatted)` (adopted
  in toast.md: Chrome 141, Safari 27, Firefox 150). React Aria does the same with its live
  announcer.
- **`inputmode`** (Chrome 66, Firefox 95, Safari 12.1). Use `decimal` when fractions are
  allowed, else `numeric`. The iPhone `decimal` and `numeric` pads have **no minus key** (WebKit
  193825, NEW since 2019; React Aria switches to `inputmode="text"` on iPhone when negatives are
  allowed). Recommend `text` on iPhone when `min` is unset or below 0, as React Aria does, or
  document the limitation. `enterkeyhint` is a pass-through.
- **Parsing and formatting** are library code: ECMA-402 has no parse API (ecma402#1 "Parsing
  APIs" closed 2020; no proposal in tc39/proposals as of 2026-10). Derive the locale's symbols
  from `Intl.NumberFormat#formatToParts` (Baseline 64/58/13): decimal, group, minus,
  percent/currency/unit literals and the digits of the numbering system. Strip group and literal
  symbols, map digits to ASCII, accept full-width digits, and reject anything else. Parse on
  commit, not per keystroke. Format with the same options after commit. `formatRange` and
  string-decimal input (`format("1.10")`) are Baseline (106/116/15.4). The locale comes from a
  `locale` prop, falling back to the nearest `lang`. Do not use `navigator.language`, which is what
  makes Chromium's native input disagree with the page.
- **Keyboard.**
  - Up/Down: ±`step`. PageUp/PageDown: ±`largeStep` (APG optional; React Aria handles them, Base
    UI 1.9 leaves them to the browser). Shift+Up/Down: ±`largeStep` and Alt+Up/Down: ±`smallStep`
    (Base UI).
  - Home/End go to min/max **only when that bound is set**, else they stay caret keys (APG; Base
    UI does the same).
  - Every other key is native text editing (APG "IMPORTANT").
  - Snap to the step grid relative to `min` (spec `stepUp` semantics, not native UI stepping).
    Clamp. Reuse decimal-safe arithmetic like `slider/slider-arithmetic.ts` (`snap`,
    `decimalsOf`).
- **Wheel: off by default, opt-in prop.** Engines disagree (2.1). Base UI's `allowWheelScrub`
  defaults to `false`; React Aria enables it while focused. When enabled, only while the input is
  focused, and through a native **non-passive** `wheel` listener, because React's `onWheel` is
  passive and cannot stop the page scroll.
- **Increment/Decrement buttons.**
  - `tabindex="-1"` (the input is the only Tab stop, APG). `aria-controls` points at the input.
    Localised `aria-label` ("Increase"/"Decrease", combined with the field label as React Aria
    does).
  - Disabled at the bound.
  - **Press-and-hold** on `pointerdown`: one step now, repeat after 400 ms, then every 60 ms (Base
    UI 1.9 and React Aria 3.53 both use 400/60; React Aria waits 600 ms for touch). Stop on
    `pointerup`, `pointercancel`, `lostpointercapture` and blur.
  - `preventDefault` on `pointerdown` so a mouse press keeps focus where it is and touch does not
    open the keyboard. Suppress `contextmenu` on long-press.
- **Hidden native number input** (Base UI's shape).
  - It carries `name`, `min`, `max`, `step`, `required` and the canonical value
    (`String(number)`, `""` when empty). That gives `FormData` the machine value, not the
    formatted text.
  - It gives native `ValidityState` (`rangeUnderflow`, `rangeOverflow`, `stepMismatch`,
    `valueMissing`) and browser-localised messages.
  - Reset restores its `defaultValue` (probed). The library listens for `reset` (`use-form-reset.ts`)
    and re-formats.
  - **It must not be the invalid control the user sees:** unmirrored, both engines focus the
    `aria-hidden` input on an invalid submit (probe `number-hidden-validity.mjs`).
  - **Mirror** `hidden.validationMessage` onto the visible input with `setCustomValidity`. Then
    `invalid`, browser focus and `:user-invalid` all land on the visible input in both engines,
    which Field's show timing (field-form.md §3) needs. Field should read the `ValidityState`
    flags from the hidden input and interaction state from the visible one. That is a contract
    detail for the Field integration (`internal/use-field-control.ts`).
- **React.**
  - The draft text is **urgent** local state, the vision's urgent opt-out, as for Combobox's
    query (select-combobox.md): a controlled text input updated in a transition snaps back.
  - The number value is committed on blur, on Enter and on each step, through
    `valueChangeAction` in a transition with `useOptimistic`. A `valueCommitAction` mirrors
    Slider (once per gesture: hold release, blur).
  - Controlled inputs make `form.reset()` a no-op (slider.md finding 3), so reset is
    library-handled, as in Slider.

### 2.3 Support table

| Feature | Blink | WebKit | Gecko | Verdict |
| --- | --- | --- | --- | --- |
| `inputmode`, `enterkeyhint` | 66 / 77 | 12.1 / 13.1 | 95 / 94 | **adopt** |
| `Intl.NumberFormat` `formatToParts` / `formatRange` / string decimals | 64 / 106 / 106 | 13 / 15.4 / 15.4 | 58 / 116 / 116 | **adopt** |
| Constraint validation on `type=number` (`min`/`max`/`step`, messages) | ✓ | ✓ | ✓ | **adopt** (hidden input) |
| `Element.ariaNotify()` | 141 | 27 | 150 | **adopt** |
| `role="spinbutton"` on a text input | AX correct | VoiceOver broken (221102, 250380) | (not probed) | **avoid** |
| Native `<input type=number>` as the visible control | localises by UI language; wheel steps | `AXTextField` (314879) | localises by `lang` | **not recommended** |
| `appearance: textfield` / `::-webkit-inner-spin-button` | ✓ / ✓ | ✓ / ✓ | ✓ / – | not needed |
| ECMA-402 number parsing | – | – | – | **not available** (library parser) |

### 2.4 Risks

- Writing a parser is real work: currencies, percent scaling (does typing `50` mean 0.5?),
  units, numbering systems, signs (`−` U+2212, accounting parentheses). Scope v0 to decimal,
  percent and currency, with a test matrix over locales (`en`, `de`, `fr` NBSP grouping, `ar`
  digits, `ja` full-width).
- Dropping `spinbutton` deviates from APG and should be documented. Windows screen readers lose
  "spin button"; the step announcements partly make up for it.
- Two inputs (visible and hidden) must stay in sync across hydration, reset and React's automatic
  form reset (field-form.md finding 1).

## 3. Progress and Meter

### 3.1 Native elements (probe `progress-meter.mjs`)

**Semantics.**

- **`<progress>`** maps to `progressbar` with `valuemin` 0, `valuemax` = `max` and `valuenow` =
  `value` (HTML-AAM). It is indeterminate without a `value` attribute: `:indeterminate`,
  `position` −1, no `valuenow` in Chromium's AX tree. Removing the attribute makes it indeterminate
  again.
- **`<meter>`** maps to the ARIA `meter` role in every platform API (HTML-AAM "Use WAI-ARIA
  mapping"; Core-AAM: IA2 `IA2_ROLE_LEVEL_BAR`, UIA ProgressBar "meter", ATK `ROLE_LEVEL_BAR`, AX
  `AXLevelIndicator`/`AXMeter`). Chromium 156 exposes `meter` for the element and for
  `div role="meter"` alike (probed).
- **Both are labelable:** `<label for>` works (`labels.length` 1).
- **ARIA in HTML** allows `aria-valuetext` on both, and says not to set `aria-valuemax` on
  `<progress>` or `aria-valuemin`/`aria-valuemax` on `<meter>`.
- **Values clamp:** progress 150/100 gives 100, meter 2 (max 1) gives 1.

**Styling** (red fill on a blue track, sampled from screenshots):

| | Chromium 156 | Firefox 157 | WebKit (BCD) |
| --- | --- | --- | --- |
| Progress fill / track | `::-webkit-progress-value` / `::-webkit-progress-bar` | `::-moz-progress-bar` / element background | `::-webkit-progress-*` (7) |
| Meter fill / track | `::-webkit-meter-optimum-value`, `-suboptimum-value`, `-even-less-good-value` / `::-webkit-meter-bar` | `::-moz-meter-bar` with `:-moz-meter-optimum`/`-sub-optimum`/`-sub-sub-optimum` (supported; not in BCD) / element background | `::-webkit-meter-*` (5.1) |
| `appearance: none` + pseudo-elements | works | works | – |
| RTL and `writing-mode: vertical-lr; direction: rtl` | fill mirrors / grows bottom-up | same | – |
| Indeterminate with `appearance: none` | **no fill drawn** | **full-width fill** | – |
| `transition` on the fill's size | **animates** | **jumps** | – |
| Child elements (fallback content) | **not rendered** (0×0) | not rendered | not rendered (spec) |
| `appearance: base` / CSS Forms `::fill`-style parts | flag `AppearanceBase` experimental | – | – |

### 3.2 Recommendation: ARIA roles on divs, with parts

Native `<progress>`/`<meter>` would be ideal if a headless library only had to expose
semantics. But Progress and Meter are almost entirely about appearance, and the native elements
cannot take children. The fill exists only as two vendor pseudo-element families, so a
`Progress.Indicator` part is impossible. Firefox cannot transition the fill, and indeterminate
rendering differs between engines. Per HTML-AAM the native elements map through the **same ARIA
roles** a div gets, so the div loses no platform semantics.

- **`Progress.Root`** is `div role="progressbar"` with `aria-valuemin`, `aria-valuemax` and
  `aria-valuenow`. Indeterminate: **omit `aria-valuenow`** (Chromium then exposes no value;
  probed), and set `data-indeterminate`.
- **`aria-valuetext`** holds the formatted value (`Intl.NumberFormat`, percent by default) or the
  consumer's `getValueText`. Screen readers otherwise compute their own percent, which is wrong
  for non-percent scales.
- **Parts.** `Progress.Track` and `Progress.Indicator` are plain divs. `Progress.Label` is wired by
  `aria-labelledby`. `Progress.Value` holds the visible formatted text and is `aria-hidden` when
  `aria-valuetext` already says the same.
- **`Meter.Root`** is `div role="meter"` with all three values, `aria-valuetext`, and the HTML
  `low`/`high`/`optimum` region algorithm reimplemented as a pure function, exposed as
  `data-region="optimum" | "suboptimum" | "even-less-good"`.
- **Fill.** An inline CSS custom property on Root and Indicator, `--progress-value` / `--meter-value`
  as a percentage, like Slider's `--slider-value`. Consumer CSS can use
  `inline-size: var(--progress-value)` or `scale`. It is server-renderable, so Progress and Meter
  can be Server Components (no state, no actions), as the JS-free Accordion is.
- **Typed `attr()`** could replace the inline property (`attr(aria-valuenow type(<number>))`), but
  it is Chrome 133 / Firefox 155 / Safari TP only. **Not yet.**
- **Animated values.** Use a CSS `transition` on the Indicator. The inline property changes on
  every render, so it works in every engine, unlike the native fill. Registering
  `@property --progress-value { syntax: "<percentage>"; inherits: true; initial-value: 0% }`
  (Baseline 85/128/16.4) lets the variable itself transition. Indeterminate is a consumer
  `@keyframes` on `[data-indeterminate]`; the docs should gate it on
  `prefers-reduced-motion`.
- **No `<ViewTransition>`.** Progress values update often and urgently (upload events). A view
  transition per update would freeze the page at the cadence of the updates
  (view-transition-mount-cost.md). This is the same conclusion as Toast.
- **Labelling.** `aria-labelledby` to `Progress.Label`, or the consumer's `aria-label`. Field
  integration is not needed: progress is not a form control. If the PO wants Field labelling,
  `useFieldControl` with `labelable: false` already supports `aria-labelledby` groups.
- **Busy region (docs only).** APG suggests `aria-busy="true"` and `aria-describedby` pointing at
  the progressbar on the region being loaded. That belongs to the consumer.

| Feature | Blink | WebKit | Gecko | Verdict |
| --- | --- | --- | --- | --- |
| `role="progressbar"` / `role="meter"` (ARIA 1.2) | ✓ / ✓ (probed) | ✓ / ✓ (Core-AAM) | ✓ / ✓ | **adopt** |
| `aria-valuetext` on both | ✓ | ✓ | ✓ | **adopt** |
| `<progress>` / `<meter>` as the rendered element | ✓ | ✓ | ✓ | **not as the styled element** (no parts) |
| `::-webkit-progress-*` / `::-moz-progress-bar` / meter pseudo-elements | ✓ | ✓ | ✓ (moz) | consumer CSS only if a consumer renders native |
| `@property` | 85 | 16.4 | 128 | **adopt** (docs recipe) |
| CSS `progress()` | 138 | 26 | 155 | available; not needed (the library computes the percentage) |
| Typed `attr()` | 133 | TP | 155 | **not yet** |
| `appearance: base` for progress/meter | flag | – | – | **not yet** |

### 3.3 Risks

- **Meter AT support is old and uneven.** The only detailed screen-reader tests (Scott O'Hara,
  2018) found JAWS ignoring named meters and NVDA/VoiceOver reading only the name. That applies
  equally to native `<meter>`, since the mapping is the same. Always set `aria-valuetext`, and
  re-test with current NVDA, JAWS and VoiceOver before calling Meter stable.
- Issue #68 asks for native elements "where viable". This research says the native element is
  not viable as the styled element. A product decision is needed if the PO wants a native variant
  anyway, for example an unstyled `<progress>` rendered via `render` for consumers who style the
  vendor pseudo-elements.

## Open questions for the product owner

1. **ToggleGroup exclusive mode:** confirm `aria-pressed` + `group` for both modes, with RadioGroup
   as the answer for form choices. Or require radio semantics, which implies not deselectable and
   arrows that select.
2. **NumberField role:** confirm the textbox without `role="spinbutton"` (deviates from APG because
   of WebKit/VoiceOver bugs), and whether to add a localised `aria-roledescription`.
3. **Toolbar wrap default** and **Menu.Trigger arrow-opening inside a vertical Toolbar.**
4. **Progress/Meter:** confirm ARIA divs over native elements despite issue #68's wording.

## Issues worth reporting (human task)

- **Chromium:** a native `<input type=number>` with no `min`/`max` exposes `valuemin 0` /
  `valuemax 0` in the AX tree, a meaningless range.
- **Chromium:** in an `en-US` UI, `1,5` typed into `<input type=number>` silently becomes `15`
  instead of `badInput`; Firefox flags it. A possible interop issue on locale source (UI
  language vs `lang`).
- **Firefox:** no CSS transition on `::-moz-progress-bar` size changes, where Chromium animates
  `::-webkit-progress-value`.

## References

- WAI-ARIA APG: Toolbar pattern https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/ and example
  https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/examples/toolbar/; Spinbutton pattern
  https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/
- ARIA in HTML (progress, meter, input type=number/text, button, fieldset rows):
  https://www.w3.org/TR/html-aria/
- HTML-AAM (`meter`, `progress`, `input type=number`): https://w3c.github.io/html-aam/; Core-AAM
  role mappings (meter, progressbar, spinbutton): https://w3c.github.io/core-aam/
- Open UI scoped focusgroup explainer: https://open-ui.org/components/scoped-focusgroup.explainer/
- WHATWG HTML PR #11723 (focusgroup): https://github.com/whatwg/html/pull/11723
- Chromium `runtime_enabled_features.json5`, branch 8059 (M155) and main (`Focusgroup`,
  `FocusgroupV2`, `AppearanceBase`, `NumberInputFullWidthChars`):
  https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/platform/runtime_enabled_features.json5
- chromiumdash stable 155.0.8059.85:
  https://chromiumdash.appspot.com/fetch_releases?channel=Stable&platform=Windows&num=1
- WebKit standards-positions #171 (focusgroup):
  https://github.com/WebKit/standards-positions/issues/171; Mozilla standards-positions #1348:
  https://mozilla.github.io/standards-positions/
- Mozilla bug 2070976 (focusgroup meta): https://bugzilla.mozilla.org/show_bug.cgi?id=2070976
- WebKit bugs: 314879 (number input not spinbutton) https://bugs.webkit.org/show_bug.cgi?id=314879,
  221102 (spinbutton announced as percent/0) https://bugs.webkit.org/show_bug.cgi?id=221102,
  250380 (VoiceOver swipe changes text spinbutton) https://bugs.webkit.org/show_bug.cgi?id=250380,
  231698 (VO+arrows on ARIA spinbutton) https://bugs.webkit.org/show_bug.cgi?id=231698, 193825
  (no minus on `inputmode=decimal`) https://bugs.webkit.org/show_bug.cgi?id=193825
- ECMA-402 issue #1 "Parsing APIs" (closed): https://github.com/tc39/ecma402/issues/1;
  tc39/proposals: https://github.com/tc39/proposals
- MDN browser-compat-data 8.1.6 (2026-10-15): https://github.com/mdn/browser-compat-data
- Library sources: Radix `@radix-ui/react-toggle-group` 1.2.1, Base UI `@base-ui/react` 1.9.0
  (`toggle-group`, `toolbar`, `number-field`), React Aria `react-aria` 3.53.1
  (`useToggleButtonGroup`, `useToolbar`, `useNumberField`, `useSpinButton`), via https://unpkg.com/
- Scott O'Hara on `<meter>` screen-reader support (2018), summarised in "Reading the meter":
  https://htmhell.dev/adventcalendar/2022/5; Enable meter notes:
  https://www.useragentman.com/enable/meter.php
- Probes and outputs: `memo/platform-researcher/probes/15-wave6/`
