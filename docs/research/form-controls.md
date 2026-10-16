# Native form controls for Switch, Checkbox and RadioGroup

Date: 2026-10-16. GitHub issue: "Research: native form controls for Switch, Checkbox, Radio".
Engines probed: Chromium 156.0.8078.4 and Firefox 157.0 (Playwright 1.64.1); jsdom 30.1.3;
React / react-dom 19.3.1. WebKit could not be launched locally (host libraries missing), so WebKit
rows come from documentation and are marked as such. Probes and raw output live in
`memo/platform-researcher/probes/04-*` to `08-*`.

## Summary and verdict

**Adopt native inputs for all three components.** Checkbox renders `<input type="checkbox">`,
Switch renders `<input type="checkbox" role="switch">`, RadioGroup renders same-`name`
`<input type="radio">` inside `<fieldset role="radiogroup">`. The `<button role=… aria-checked>` +
hidden-input pattern (Radix, Base UI) is **rejected**: it re-implements form participation,
validation, reset, label activation, radio roving focus and RTL arrow mirroring, all of which the
platform gives for free in every engine.

The model that makes native inputs work under "transition by default":

- **Render `checked={optimistic}`** (a controlled native input). This is not optional. React
  restores a controlled input's DOM `checked` to its current props at the end of the event, after
  flushing sync work. `useOptimistic` renders at sync priority, so the restore writes the
  *optimistic* value and the DOM stays in sync. A controlled input driven only by a transition is
  visibly broken: the box snaps back and stays unchecked until the transition commits (verified in
  jsdom, Chromium and Firefox).
- **`checked` is library-owned, with residual browser paths** (conventions 3.5): pre-hydration
  clicks and Firefox form-state restoration (mount reconciliation), and **form reset**, including
  React's own automatic reset after a successful `<form action>`. Reset is new and needs a
  listener; without it the DOM and library state desync (verified on 19.3.1).
- **`indeterminate` is a DOM property only.** React 19.3.1 has no prop for it, SSR cannot emit it,
  `aria-checked` is forbidden on native inputs (and Chromium ignores it), and the browser clears
  it on every click. The library sets it from a ref/layout effect and re-applies it when the
  transition settles.

| Feature | Blink | WebKit | Gecko | Verdict |
| --- | --- | --- | --- | --- |
| `<input type=checkbox>` / `type=radio`: form data, `required`, reset, labels, `:checked` | all | all | all | **adopt** |
| Same-`name` radios: roving tab stop, arrow keys select + wrap, RTL mirroring | ✓ (156, probed) | ✓ (docs; macOS Safari needs Option+Tab or the keyboard-navigation setting to Tab to any control, button or input) | ✓ (157, probed) | **adopt** |
| `role="switch"` on `<input type=checkbox>` (ARIA in HTML: allowed) | ✓ exposed as `switch` (probed) | ✓ | ✓ | **adopt** |
| `<fieldset role="radiogroup">` + `<legend>` (ARIA in HTML: allowed) | ✓ `radiogroup` named by legend (probed) | ✓ | ✓ | **adopt** |
| `HTMLInputElement.indeterminate` / `:indeterminate` | ✓ | ✓ | ✓ | **adopt** (via ref) |
| `:user-invalid` / `:user-valid` | 119 | 16.5 | 88 | **adopt** |
| `accent-color` on checkbox/radio | 93 | 26.2 (partial 15.4–26.1) | 92 | **adopt** (consumer CSS) |
| `appearance: none` + `::before`/`::after` on the input | ✓ (probed) | ✓ (docs, long-standing) | ✓ (probed) | **adopt** (documented styling recipe) |
| `<input type=checkbox switch>` | Proposed (chromestatus, Intent to Prototype 2026-07) | 17.4 | No signal | **not yet** |
| `appearance: base` / `::checkmark` for checkbox/radio (CSS Forms 1) | ✗ (`CSS.supports('appearance','base')` false) | ✗ | ✗ | **not yet** |
| `<button role=checkbox\|switch\|radio aria-checked>` + hidden input | – | – | – | **rejected** |

## 1. Element choice

### Native input vs. button with a role

| | `<input type=checkbox\|radio>` | `<button role=… aria-checked>` |
| --- | --- | --- |
| Form participation | `name`/`value` in `FormData` (value defaults to `"on"`, unchecked omitted), `form=` attribute, `required` + `validity.valueMissing`, `:user-invalid`, reset to default | None; needs a hidden `<input>` kept in sync, and its validity does not show on the visible control |
| Labels | `<label for>`/wrapping label names it and forwards clicks | Same (buttons are labelable and receive the forwarded click) |
| Keyboard | Space toggles (Enter does not, probed). Radios: arrows select, wrap, mirror in RTL, single tab stop | All JS (roving tabindex, RTL detection) |
| Pre-hydration | Works; state is in the DOM | Dead until hydration |
| Children / indicator inside | Impossible (void element) | Possible |
| ARIA | Native role and state; `aria-checked` forbidden | Must maintain `aria-checked` |

The only real cost of the native element is that it has no children, which affects anatomy
(section 7), not feasibility. `appearance: none` plus `::before` on the input itself renders in
Chromium and Firefox (probe 08) and has long worked in Safari, and `accent-color` covers the
"just recolour it" case.

### `<input type=checkbox switch>`

Still WebKit-only. WHATWG HTML PR #9546 is **open** (last pushed 2026-10-09, `agenda+` since
2026-09-26, needs an HTML-AAM counterpart). Chromium has a chromestatus entry
(5178587742339072) created 2026-07-17 in "Proposed" with an Intent to Prototype and no milestone;
Firefox shows "No signal". `'switch' in HTMLInputElement.prototype` is `false` in Chromium 156
and Firefox 157 (probed), and Chromium exposes `<input type=checkbox switch>` as a plain
`checkbox` (probe 06). The attribute only changes default rendering, which a headless library
replaces anyway, and `role="switch"` already gives the semantics everywhere. **Not yet.**
Revisit when Chromium ships; it can then be added as a pass-through or a non-breaking default.
Note from MDN: `:indeterminate` never matches a switch, so Switch must not offer `indeterminate`.

### `role="switch"` on a checkbox input

ARIA in HTML allows `switch` (also `menuitemcheckbox`, `option`, and `button` with
`aria-pressed`) on `input type=checkbox` and says the native `checked` replaces `aria-checked`.
APG's Switch pattern includes an "HTML checkbox input" example. Chromium exposes it as `switch`
with `checked: true/false` (probe 06). Screen-reader wording varies: VoiceOver says "on/off";
some NVDA/ChromeVox versions still say "checked/not checked". This is acceptable and is the same
for the button variant.

## 2. Controlled native inputs under transition-by-default

### Platform event order (verified: jsdom, Chromium 156, Firefox 157)

```
no preventDefault:   click(checked=true) > input(true) > change(true) > after dispatch(true)
preventDefault():    click(checked=true) > after dispatch(false)       // no input, no change
```

`checked` flips **before** `click` listeners run. If `click` is canceled, the browser restores
`checked` (and `indeterminate`) **after** dispatch and fires **neither `input` nor `change`**.
The task premise that `change` still fires after `preventDefault` is wrong in all three test
environments.

React's `onChange` on a checkbox or radio is driven by the native **`click`** event
(`getTargetInstForClickEvent`). So `details.event` is a `click` `PointerEvent`, also for keyboard
Space and for radio arrow-key selection (probed: arrows fire `click` → `onChange` in both engines).

### What React does with a controlled `checked`

At the end of every event batch, react-dom runs `flushSyncWork()` and then
`restoreStateOfTarget()`, which writes the fiber's current `checked` prop back to the DOM (for
radios, to every same-`name` radio in the same form). Consequences:

| Wiring | DOM right after click | While action pending | Settled | Verdict |
| --- | --- | --- | --- | --- |
| `checked={state}`, state set in a transition, sync action | old (reverted) | – | new after next render | flicker |
| same, async action | old | **old** | new | **broken** |
| `checked={optimistic}` (`useOptimistic`, set in the transition's sync prefix) | **new** | new, `data-pending` | new | **correct** |
| same, action rejects / swallowed error | new | new | old (optimistic reverts, DOM follows) | correct rollback |
| radios, transition only | old selection | old | new | broken |
| radios, `checked={optimistic === value}` | new | new | new | correct |

Same result in jsdom, Chromium 156 and Firefox 157. This works because `setOptimistic` is
`SyncLane` and is flushed by `flushSyncWork()` *before* the restore, so the restore writes the
optimistic value. It is the existing rule of conventions 3.2 ("trigger parts render optimistic
state"). For native inputs it is a correctness requirement, not just a visual one.

### `preventDefault()` is not a veto (conventions 2.3 item 3)

With `checked={optimistic}`, calling `details.event.preventDefault()` in the action's sync prefix
gives this sequence:

1. React restores the DOM to the optimistic (new) value.
2. The browser's canceled-activation step then restores the old value.
3. The DOM shows old while `optimistic` (and `data-checked`) say new, for as long as the action is
   pending.
4. The action still runs and still commits; the DOM resyncs only when committed changes.

Verified in all three environments. A microtask fix does not work for real user clicks, because
microtasks run after React's listener returns, which is before the canceled-activation step.
Recommendation: for checkable inputs, document `preventDefault()` as unsupported. Emit a dev
warning when `details.event.defaultPrevented` is true after the sync prefix. A veto is done with
controlled mode.

### Hydration and pre-hydration interaction

react-dom 19.3.1 `initInput` keeps the DOM's `checked` when hydrating
(`element.checked = isHydrating ? element.checked : !!checked`) and fires no `onChange`. A user
who clicks before hydration, or Firefox's form-state restoration (MDN: Firefox "persists the
dynamic checked state … across page loads"), leaves DOM ≠ React state with no warning (probe 04
§8). Fix: the same **mount reconciliation** as Accordion. A layout effect at mount compares
`el.checked` with the initial value and dispatches with `reason: "platform"` and
`event: undefined`. RadioGroup does one dispatch for the group.

### Form reset (new residual browser path)

`form.reset()` restores every input to its `defaultChecked`. React sets `defaultChecked` once at
mount to the initial `checked`, so the reset target is the mount-time value. That is the right
"default" for uncontrolled mode. Neither an external reset nor React's own automatic reset after a
successful `<form action>` (`requestFormReset`, which calls `form.reset()` during commit) re-syncs a
controlled input. Measured on 19.3.1 (probe 07):

```
form action succeeds → DOM checked=false, React state=true   (desync)
with a 'reset' listener on input.form that re-reads the DOM in a microtask → in sync
```

Recommendation: each native-input component listens to `reset` on `input.form` through its ref.
After the reset task (`queueMicrotask` is enough, because `reset` fires before the values change
and the reset runs synchronously), it dispatches the new DOM value with `reason: "platform"` and
`event` set to the `reset` event. Uncontrolled mode then commits the default. Controlled mode lets
the parent follow, or re-applies committed state when the action settles (Accordion rule).

## 3. RadioGroup

Probed in Chromium 156 and Firefox 157, with identical results:

- **Single tab stop.** Tab enters on the checked radio, the next Tab leaves the group, and
  Shift+Tab returns to the checked radio.
- **Arrow keys.** Down and Right check the next radio, Up and Left check the previous one, and
  focus wraps from last to first. Each step fires `click`, so React's `onChange` runs and the
  library dispatches once per arrow press. That is fine under latest-intent-wins (conventions 2.5).
- **RTL.** In a `dir="rtl"` container, ArrowRight goes to the *previous* radio and ArrowLeft to
  the next. The mirroring is native, with no JS.
- **This matches APG Radio Group.** That pattern also checks on arrow press, wraps, and focuses the
  checked radio first. APG notes that native radios may focus the last radio on Shift+Tab when none
  is checked, which is allowed.
- **Group semantics.** A bare `<fieldset>` + `<legend>` is exposed as `group`, but APG asks for
  `radiogroup`. `<fieldset role="radiogroup">` is allowed by ARIA in HTML, and Chromium exposes it
  as `radiogroup` named by the legend (probed). `<fieldset disabled>` disables every radio in it.
- **`required`.** One `required` radio makes the whole group required. Every radio in the group
  then matches `:invalid`, and after a submit attempt they match `:user-invalid`.
- **Early "invalid" in the accessibility tree.** Chromium marks unchecked required checkboxes and
  radios `invalid: true` before any user interaction. That is a platform behaviour, noted for AT
  testing.
- **No selection.** When nothing is checked, every radio in the group matches `:indeterminate`
  (both engines).
- **`name` is mandatory and must be unique.** The browser groups by `name` + form owner, and
  React's radio restore queries `input[name=…][type=radio]` across the whole root, throwing if a
  non-React radio shares the name. RadioGroup generates the name with `useId()` unless the consumer
  passes `name`.
- **No `focusgroup` needed.** Native radios already do what `focusgroup` would add.

## 4. Mixed state and CheckboxGroup

- **React has no `indeterminate` prop** (19.3.1). On the client, `indeterminate={true}` logs
  "Received `true` for a non-boolean attribute" and sets nothing. On the server it renders
  nothing. The library sets `el.indeterminate` in a ref callback or layout effect.
- **SSR and pre-hydration.** The server HTML cannot carry the mixed state: there is no attribute,
  and `aria-checked` is forbidden on `input type=checkbox` by ARIA in HTML. Chromium also *ignores*
  `aria-checked="mixed"` on a native input (probe 06), so the Primer-style declarative
  `aria-checked` does not help. Until hydration the box looks unchecked and is announced as such.
  Mitigations: emit `data-indeterminate=""` from render so CSS can show the dash before
  hydration, and document the short AT gap.
- **The browser clears `indeterminate` on every click** (probed: `checked` becomes true,
  `indeterminate` becomes false). A canceled click restores both. So the browser does the
  optimistic flip of the mixed state by itself. The library must re-apply the `indeterminate` prop
  after the transition settles, in a layout effect keyed on `[indeterminate, pending]` as in
  Accordion 2.3, so that a rejected action shows "mixed" again.
- **No effect on form data.** `indeterminate` does not change what is submitted. A checked +
  indeterminate box still posts `on` (probed).
- **API shape.** Keep `checked: boolean` as the controllable triple, plus a separate
  **controlled-only `indeterminate?: boolean`** (Base UI's shape, and the platform's). Mixed is
  derived from other state by the parent, so it has no `default`/`ChangeAction`. Clicking a mixed
  box dispatches `checked: true` (the platform rule: indeterminate + unchecked → checked). Do not
  merge mixed into `checked: boolean | "mixed"`, because that would put a non-boolean into a
  value the platform keeps boolean. Switch has no `indeterminate`.
- **CheckboxGroup.** The group is `<fieldset>` + `<legend>`, which gives role `group` (APG).
  Checkboxes share `name`, and `FormData.getAll(name)` gives the values. A Root owning
  `value: string[]` with `valueChangeAction` mirrors Accordion's multi-item reducer.
  - A "select all" parent Checkbox computes `checked`/`indeterminate` from the group's
    **optimistic** set, which makes it a trigger that renders optimistic state.
  - APG's optional "restore the previous partial selection on the third click" belongs to the
    group's reducer, not to the platform.
  - There is no native "at least one checked" constraint. `required` on each box means each one is
    required. Group-level `required` needs `setCustomValidity` on one member; record it as a
    design question.

## 5. Server Functions and forms

- **Two independent channels.** A control inside `<form action={serverFn}>` with no change action
  is just an uncontrolled native input: it posts `name=value` with the form, and React's
  form-level transition and `useFormStatus().pending` cover submission. A `checkedChangeAction`
  is per-control and runs in the control's own transition, giving per-control `data-pending`.
  `useFormStatus` does not see it.
- **Support both, with no special coupling.**
  - The control must not read `useFormStatus` into its own `pending`, because that would mark
    every checkbox pending during a submit. A consumer who wants that styles
    `form:has(...)` or reads `useFormStatus` in their own `className` function.
  - "Autosave on change" is `checkedChangeAction={saveSetting}`, which can be a Server Function
    passed directly (conventions 2.2).
  - "Submit the form on change" is `checkedChangeAction={() => formRef.current?.requestSubmit()}`.
- **Entanglement caveat (conventions 2.3 item 5).** While a form action is pending, a control's
  transition is entangled with it, and the reverse also holds.
- **Reset after a successful form action** is section 2's reset path. Without the reset listener,
  every controlled-native-input component desyncs after the first successful form action.
- **Toggle stays form-less** (`type="button"`). Switch and Checkbox get form participation for
  free, so pass `name`, `value`, `required` and `form` through as native props.

## 6. Styling hooks

With `checked={optimistic}` the DOM state **is** the optimistic state, so the native
pseudo-classes on the input are exactly equivalent to the data attributes:

| State | Pseudo-class (on the input) | Data attribute | Notes |
| --- | --- | --- | --- |
| checked (optimistic) | `:checked` | `data-checked` | Equivalent, except in the `preventDefault` misuse above |
| mixed | `:indeterminate` | `data-indeterminate` | Only the attribute works before hydration. `:indeterminate` also matches radios in an empty group. |
| disabled | `:disabled` (also inherited from `<fieldset disabled>`) | `data-disabled` | Only the pseudo-class sees fieldset inheritance. |
| pending | – | `data-pending` | Library-only |
| focus | `:focus-visible` | – | Conventions 4.2. Wrapper parts use `:has(:focus-visible)`. |
| validity | `:user-invalid`, `:required` | – | Platform only; no attribute needed |

Recommendation: emit the `data-*` attributes on every part as the conventions require, because
sibling or wrapper parts such as an indicator or label cannot use `:checked` on themselves. Then
document the pseudo-class next to each one (conventions 4.2). `:has(:checked)` on a wrapper is
Baseline and is the zero-JS alternative.

## 7. Recommended element and state model per component

| | Switch | Checkbox | RadioGroup |
| --- | --- | --- | --- |
| Interactive element | `<input type="checkbox" role="switch">` | `<input type="checkbox">` | `<input type="radio" name={id}>` per `RadioGroup.Item` |
| Group container | – (several switches: `<fieldset>` + `<legend>`, consumer markup) | `CheckboxGroup.Root` = `<fieldset>`; legend part | `RadioGroup.Root` = `<fieldset role="radiogroup">` + `RadioGroup.Label` = `<legend>` |
| State triple | `checked` / `defaultChecked` / `checkedChangeAction` | same, plus controlled-only `indeterminate` | `value: string \| null` / `defaultValue` / `valueChangeAction` (on Root) |
| Rendered DOM state | `checked={optimistic}` | `checked={optimistic}`; `el.indeterminate` set from a ref, re-applied when settled | `checked={optimistic === item.value}` |
| Ownership | library-owned via a controlled native input | same | same |
| Residual browser paths (`reason: "platform"`) | mount reconciliation; form `reset` | same; the browser clears `indeterminate` on click | same, once per group |
| Native props passed through | `name`, `value`, `required`, `form`, `autoFocus` | same | `name` (default `useId()`), `required`, `form` on Root |
| Keyboard | native Space | native Space | native arrows, wrap, RTL, single tab stop |
| `disabled` | native `disabled` (allowed by APG) | native | native on item or on the fieldset (Root) |

Anatomy consequence: the input cannot contain an indicator. Two shapes fit the conventions, and
choosing between them is the designer's call:

1. **The input is the visible control.** The consumer styles it with `appearance: none` plus
   `::before`/`::after` and `:checked`. This is the simplest shape and is JS-free in its static
   form.
2. **The input is visually hidden inside a `<label>` Root, with a sibling `Indicator` part.** The
   indicator receives `data-checked`, `data-indeterminate` and `data-pending`. Focus rings move to
   the Root through `:has(:focus-visible)`. Do not use `display: none` or `hidden` on the input,
   because that removes it from focus and the accessibility tree. Use a visually-hidden clip and
   keep the hit area on the label.

Both keep the native input as the one focusable, labelled, form-participating element. In both,
`render` keeps the input. Replacing the element would lose every behaviour listed above.

## 8. Changes this implies for the conventions

1. **3.2: say why native checkable inputs need optimistic state.** A native checkable input
   *must* receive the optimistic value as its controlled `checked`. React restores controlled
   inputs after the event, and only sync-lane (optimistic) state survives that restore.
2. **3.5: add a residual browser path.** Add **form reset** (`reset` on the form owner, including
   React's automatic reset after `<form action>` and `requestFormReset`) next to pre-hydration
   clicks. Note that Firefox's form-state restoration on reload arrives through the same mount
   reconciliation. The `reason` vocabulary in 2.2 does not change: these are `"platform"`.
3. **2.3 item 3: limit `preventDefault()`.** Add that `details.event.preventDefault()` is not a
   veto and, on checkable inputs, desyncs the DOM while the action is pending. Mark it
   unsupported there and add a dev warning.
4. **4.1: add the new state names.** Add `checked` (Switch, Checkbox) and `indeterminate`
   (Checkbox) to the state table, with `data-indeterminate`. Radio items reuse `checked`, which
   is the platform word, rather than `selected`. That is a vocabulary decision for the
   architect.
5. **4.2: document pseudo-class equivalents.** Document `:checked`, `:indeterminate`,
   `:user-invalid` and `:disabled` (including fieldset inheritance) as equivalents.
6. **1.2 `render`: state the element-type rule.** For these components the rendered element must
   stay an `<input>` of the same type. State this as a per-component restriction.
7. **7.3: record a possible static variant.** A static, action-less Checkbox, Switch or RadioGroup
   could be directive-free, because the native input already works without JS. Record it as a
   candidate for issue #19.

## References

- WHATWG HTML PR #9546 (switch attribute, open): https://github.com/whatwg/html/pull/9546
- chromestatus `<input type="checkbox" switch>` (Proposed, created 2026-07-17): https://chromestatus.com/feature/5178587742339072
- MDN `<input type="checkbox">` (switch, indeterminate, Firefox persistence, form data): https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/checkbox
- ARIA in HTML (allowed roles for checkbox, radio and fieldset; `aria-checked` prohibited): https://www.w3.org/TR/html-aria/
- APG Switch: https://www.w3.org/WAI/ARIA/apg/patterns/switch/
- APG Checkbox (dual and tri-state): https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/
- APG Radio Group: https://www.w3.org/WAI/ARIA/apg/patterns/radio/
- Switch announcements across screen readers: https://www.useragentman.com/enable/switch.php
- MDN `appearance` (`base` unsupported in every engine): https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/appearance
- CSS Form Control Styling Level 1: https://www.w3.org/TR/css-forms-1
- caniuse `accent-color`: https://caniuse.com/mdn-css_properties_accent-color
- React automatic form reset of controlled fields: https://github.com/facebook/react/issues/30580
- react-dom 19.3.1 source (`batchedUpdates$1` → `flushSyncWork` → `restoreStateOfTarget`; `initInput` hydration; `recursivelyResetForms`): `packages/ui/node_modules/react-dom/cjs/react-dom-client.development.js`
- Probes: `memo/platform-researcher/probes/04-controlled-checkbox-transition.mjs`, `05-browser/`, `06-chromium-ax-tree.cjs`, `07-form-action-reset.mjs`, `08-indeterminate-and-pseudo.cjs`
