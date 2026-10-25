# NumberField

Status: **Accepted by the product owner** (2026-10-18, wave 6, GitHub issue #67; all fourteen
items of "For the product owner" accepted as written, see the end of this document; the
conventions changes are applied in 29a94c5, conventions resolved question 33, and the Field
amendment is in `design/components/field-form.md`, "Amendment: `validityElement`").
Implemented in c31588b (playground 0a2c701, docs bff9672); the review
(`memo/reviewer/number-field.md`, "acceptable with minor fixes") and its fixes (6742cb0,
36b48f4) are folded in on 2026-10-18, see "Review corrections (#67)" at the end; the wave 16
refactoring (#100, 2026-10-24) into sections 6 and 15 and the superseded-rejection rows. The code under
`packages/ui/src/number-field/` is the ground truth where this document is silent. Follows
`design/conventions.md` (accepted); where this document and the conventions disagree, the
conventions win.

Inputs: `docs/vision.md`, `design/conventions.md`, `docs/research/wave6.md` §2 (binding: a
visible `type="text"` input with `inputmode`, library parsing and formatting through
`Intl.NumberFormat`, a visually hidden native `<input type="number">` for `FormData`, reset and
constraint validation with its `validationMessage` mirrored onto the visible input, no
`role="spinbutton"`, `ariaNotify()` for steps, wheel off by default, `tabindex="-1"` buttons with
press-and-hold), the product owner's decisions on the research questions (recorded in the
decisions table), `docs/research/form-controls.md` (controlled native inputs, reset),
`docs/research/react-async-apis.md` (entanglement, the optimistic sync lane), the accepted
designs of Slider (the step / commit pair, `live`, the controlled-value-input reset), Combobox
(the urgent draft text, the hidden form input, `ariaNotify`, the built-in-string rule) and
Field (`useFieldControl`, the custom-validity slot, `useFieldValueChange`), the WAI-ARIA APG
Spinbutton pattern, prior art (Base UI 1.9 `NumberField`, React Aria 3.53 `NumberField`, Ark
UI `NumberInput`; Radix has none), two react-dom and jsdom probes recorded in
`memo/architect/number-field-notes.md`.

A number field is a text field that holds a number: the user types in their locale's notation,
steps with the keys or two buttons, and the form posts a machine number. The platform's own
`<input type="number">` cannot be the visible control (research §2.1: it cannot format, it
localises by the browser UI language in Chromium and by `lang` in Firefox, both silently, its
caret API throws, and it is a text field to VoiceOver anyway), so the library renders **two
inputs**: a visible `type="text"` input that is the user's surface, and right after it a visually
hidden native `type="number"` input that is the form's: `name`, `min` / `max` / `step` /
`required`, `FormData`, reset and the browser's localised constraint messages. The library adds
the Async React half: the typed text is **urgent** (the vision's opt-out, as in Combobox), a
**step is a transition**, a **gesture is a dispatch** (typed text is committed on blur or Enter,
a press-and-hold once at release, each key press on its own) with `data-pending` and a rollback
if the save fails, and the value under a held button is urgent, as the thumb under a pointer is
in Slider.

## Decisions at a glance

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Anatomy | `NumberField.Root` (`div[role=group]`, owns state), `NumberField.Label` (`label[for]`), `NumberField.Input` (the visible `input[type=text]` **plus** the hidden native `input[type=number]` right after it), `NumberField.Increment` / `NumberField.Decrement` (`button[type=button][tabindex=-1]`). No `Group`, `ScrubArea`, `Clear`, `Value` or `HiddenInput` parts (section 1). |
| 2 | Two actions (Slider's pair) | `valueChangeAction(next, details)` on every **step** (each key press, each tick of a hold, each wheel event, and the parse of typed text at commit) and `valueCommitAction(next, details)` once per **gesture** (a typed text's blur or Enter, a hold's release, each key press, each wheel event, a platform reset). Both are `ChangeAction<number \| null, NumberFieldValueChangeDetails>`: awaited in the Root's transitions, `data-pending` while in flight, errors to the boundary. The save belongs in `valueCommitAction` (2.1). |
| 3 | Lanes | The **draft text** is urgent, internal library state (`useState`, written from the `input` event; no `inputValue` pair, no `onInputValueChange` handler (`UrgentChangeHandler`, #96)): a controlled text input cannot follow a transition. The **value under a held button** (`live`) is urgent too (Slider 2.2, the same `held` derivation). Steps are transitions (`useActionTrigger`); the gesture's commit is the state owner's dispatch (`useControllableAction`: optimistic, latest wins). |
| 4 | When typed text becomes a value | On **blur**, on **Enter**, and before a step (a button press or a key with an open draft parses it first). Never per keystroke: a partial text (`-`, `1,`) is not a number. Unparsable text reverts to the committed value's text at commit, with no dispatch (React Aria's rule; 4.1). |
| 5 | Uncontrolled commit | Uncontrolled state is written when the **commit** action resolves (Slider 2.3): a rejected save rolls the text and the hidden input back to the value before the gesture, and a `valueChangeAction` consumer hears one `"dismiss"` step. |
| 6 | Value shape | `value: number \| null` (`null` is empty; `undefined` is uncontrolled). Typed values are **neither clamped nor snapped** (the platform's rule for `type=number`): `min` / `max` / `step` are native constraints on the hidden input (`rangeUnderflow`, `rangeOverflow`, `stepMismatch`, the browser's message). **Stepping** clamps and snaps with the spec's `stepUp()` semantics (5.5). Every value the field commits or steps to is rounded to the format's `maximumFractionDigits`, so the text, the value and `FormData` agree (5.4; review N1 extended it to stepped values). |
| 7 | Numbers | `format: Intl.NumberFormatOptions` (`decimal`, `percent`, `currency`, `unit`), `locale` (default: the runtime's locale, with a dev warning when the document's `lang` disagrees and no `locale` was given). Parsing is library code driven by `formatToParts`: the locale's decimal, group, sign, percent, currency, unit and literal symbols and its digits; full-width digits accepted; **strict grouping** (a group separator must sit before the decimal separator and be followed by a whole group, so `1,5` under `en` is unparsable, not `15`); accounting parentheses and U+2212 as minus; percent scales by 100. Affixes (currency, unit, percent, literals) are stripped **at the edges only**, in every display the formatter has (`EUR`, `€`, `euros`, `km`, `kilometers`), case-insensitively; the number core stays strict (section 5.3). |
| 8 | Keyboard | ArrowUp / ArrowDown `± step`; PageUp / PageDown and Shift+Arrow `± largeStep` (default `10 × step`); Home / End to `min` / the **largest on-grid value `≤ max`**, **only when that bound is set** and only without Shift (Shift+Home / Shift+End stay text selection); Ctrl / Meta / Alt combinations are the browser's; Enter commits (and lets the form's implicit submission post the committed value, which needs a submit button in the form, 4.1); every other key is native text editing. Each key press is a one-step gesture (step + commit), auto-repeat included (4.2). |
| 9 | Buttons | `tabindex="-1"` (the input is the only Tab stop, APG), `aria-controls` → the input, built-in `aria-label` `"Increase"` / `"Decrease"` (static strings, overridden by the ordinary `aria-label` / `aria-labelledby` pass-through, Toast's rule), natively `disabled` when the next step from the **step base** (the parsed draft while one is open, else the shown value) would change nothing (at the bound, `readOnly`, `disabled`). **Press-and-hold**: one step on `pointerdown`, repeat after 400 ms then every 60 ms, commit at release; the press is `preventDefault()`ed so focus stays where it is and touch opens no keyboard; a `click` with no pointer gesture (assistive technology) steps once. `details.event` is `undefined` for the repeats of a hold and for a hold its bound ended (4.3). |
| 10 | Wheel | **Off by default**; `stepOnWheel` enables it **only while the input is focused**, through a native non-passive `wheel` listener (React's `onWheel` is passive and cannot stop the page scroll). Each wheel event with a vertical delta is a one-step gesture; `deltaY === 0` (a horizontal scroll) is ignored and not prevented (4.4). |
| 11 | Hidden native input | `<input type="number">` right after the visible input, `aria-hidden="true" tabindex="-1" autocomplete="off"`, visually hidden; carries `name`, `form`, `min`, `max`, `step`, `required`, `disabled`, `readOnly` and the canonical value (`String(number)`, `""` for empty). **Uncontrolled**: its `defaultValue` prop is the reset target (uncontrolled: the latest `defaultValue`; controlled: the mount-time value), which react-dom keeps in the `value` attribute, so the platform's own reset applies to it; the library writes its `.value` synchronously at every step and re-applies the shown value after every commit. The library always cancels its `invalid` event, so the browser never reports on an `aria-hidden` element (section 6). |
| 12 | The validity mirror | After every write to the hidden input, `visible.setCustomValidity(hidden.validationMessage)`: the visible input is invalid exactly when the hidden one is, with the browser-localised message, so `invalid`, the native bubble, the browser's focus move and `:user-invalid` all land on the visible input in every engine (research finding 5). Inside a Field the Field writes its slot (`validate`, server errors) on the **hidden** input and mirrors the same way (section 7). |
| 13 | No `role="spinbutton"` | Accepted deviation from APG (product owner, research finding 4: VoiceOver announces "50%" or "0" for a text spinbutton, WebKit 221102 / 250380). The visible input is a plain `textbox`; stepped values are announced with `ariaNotify()` (no fallback region since #113 A1, 8.3). **No `aria-roledescription`** (8.2): it would replace the role name a user relies on to know they can type, and it would be the library's third built-in string for a gain the announcements already give. |
| 14 | Forms | `name` / `form` on Root (the hidden input posts the number, never the text). Reset: the hidden input resets natively; the visible input's `defaultValue` mirror is written in the `reset` event (`useFormReset`'s `onResetEvent`); the JS-computed target is dispatched as one `"platform"` step + commit in the microtask. Mount reconciliation adopts the text of a still-focused input as the draft **first**, then parses text typed before hydration (4.5; review M1). Both inputs are `autocomplete="off"`, so the browser's form-state restoration never produces a hidden value the text does not show (6.1). |
| 15 | Exposure | `data-pending` on Root, Input and the button the latest step or commit came from; `data-disabled` on every part; `data-invalid` (from a Field) on Root and Input. No `data-readonly` (`:read-only`), no `data-holding` (`:active` on the held button), no `data-editing`. `state.value` is the shown value (`live` while held, else optimistic), `state.text` the shown text. |
| 16 | ViewTransition | **No `transition` prop on any part** (Select / Slider precedent): every change is urgent or optimistic. Types `fsui-number-field`, `fsui-number-field-change` (step), `fsui-number-field-commit` (gesture) for consumers' own boundaries. |
| 17 | SSR | Every part file is `"use client"`; the parser / formatter and the arithmetic are directive-free modules. The server HTML carries the formatted text and the hidden input with its value and constraints; before hydration typing works (adopted at mount), a submission posts the default value, the buttons are inert. |
| 18 | Not in v1 | `inputValue` triple, `smallStep` / Alt+Arrow, `step="any"`, a scrub area, `compact` notation, `maximumSignificantDigits` rounding, Escape reverting the draft, an iPhone `inputmode="text"` switch for negatives, a built-in "not a number" message (section 13). |

---

## 1. Anatomy

```tsx
import { NumberField } from "@funstack/ui/number-field";

// A cart line: typed or stepped, saved once per gesture, rolled back on failure.
<NumberField.Root name="quantity" defaultValue={1} min={1} max={99} valueCommitAction={saveQuantity}>
  <NumberField.Label>Quantity</NumberField.Label>
  <NumberField.Decrement className="step">−</NumberField.Decrement>
  <NumberField.Input className="input" />
  <NumberField.Increment className="step">+</NumberField.Increment>
</NumberField.Root>

// A price in euros for a German page, previewed per step in a transition, saved per gesture.
<NumberField.Root
  value={price}
  min={0} step={0.5}
  locale="de-DE"
  format={{ style: "currency", currency: "EUR" }}
  valueChangeAction={(next) => { setPrice(next); }}     // sync prefix: a transition update
  valueCommitAction={(next) => savePrice(next)}        // once per gesture
>
  <NumberField.Label>Price</NumberField.Label>
  <NumberField.Input />
  <NumberField.Increment aria-label="Erhöhen">+</NumberField.Increment>
  <NumberField.Decrement aria-label="Verringern">−</NumberField.Decrement>
</NumberField.Root>
```

Rendered HTML for the first example (ids from one `useId` in Root; the hidden input's inline style
abbreviated):

```html
<div role="group" aria-labelledby="_r_1_-label">
  <label id="_r_1_-label" for="_r_1_-input">Quantity</label>
  <button type="button" tabindex="-1" aria-label="Decrease" aria-controls="_r_1_-input" class="step" disabled>−</button>
  <input type="text" id="_r_1_-input" class="input" inputmode="numeric" autocomplete="off" autocorrect="off" spellcheck="false" value="1">
  <input type="number" name="quantity" min="1" max="99" step="1" value="1" aria-hidden="true" tabindex="-1"
         style="position: absolute; width: 1px; height: 1px; margin: -1px; opacity: 0; overflow: hidden; clip-path: inset(50%); pointer-events: none">
  <button type="button" tabindex="-1" aria-label="Increase" aria-controls="_r_1_-input" class="step">+</button>
</div>
```

| Part | Element | Role | Renders from | Notes |
| --- | --- | --- | --- | --- |
| `Root` | `div` | `group` | shown value, pending | Owns `useId`, the commit hook, the step transition, the draft text, `live`, the hold, the Label registry, the formatter and parser, form reset and mount reconciliation (through the Input's registration of the hidden input). `aria-labelledby` → the `Label` id while one is mounted, else a Field's label id, token-merged with the consumer's. `data-pending`, `data-disabled`, `data-invalid` (Field). |
| `Label` | `label` | | | `for` → the visible input's id; registers its id with the Root from a layout effect (Combobox's Label), so the group is named by it. |
| `Input` | `input[type=text]` **followed by** `input[type=number]` | `textbox` (the visible); the hidden one is `aria-hidden` | shown text, pending | The visible input: `id`, `value` (the shown text: the draft while editing, else the formatted value), `inputmode` (`decimal` when fractions are allowed, else `numeric`; a consumer's `inputMode` replaces it), `autocomplete="off"`, `autocorrect="off"`, `spellcheck="false"`, `disabled`, `readonly`, the Field's `aria-describedby` / `aria-invalid`, the library's `onChange`, `onKeyDown`, `onBlur` (composition is judged from the keydown's `isComposing` / `keyCode 229`, so the composition handlers pass through), a native non-passive `wheel` listener when `stepOnWheel`. The hidden input: `name`, `form`, `min`, `max`, `step`, `required`, `disabled`, `readonly`, `defaultValue` (the reset target), `autocomplete="off"`, `aria-hidden="true"`, `tabindex="-1"`, the hidden-input style, a native `invalid` listener that cancels. `ref` → the visible input; `hiddenInputRef` → the hidden one. `data-pending`, `data-disabled`, `data-invalid`. |
| `Increment`, `Decrement` | `button` | `button` | shown value, pending | `type="button"`, `tabindex="-1"`, `aria-controls` → the input id, `aria-label` (`"Increase"` / `"Decrease"` unless the consumer passes one), `disabled` when the prop, the Root, `readOnly` or the bound says so (`state.disabled`), the library's `onPointerDown`, `onClick`, `onContextMenu`; the hold's `pointerup` / `pointercancel` / `lostpointercapture` listeners are attached during a hold. `data-pending` when the latest step or commit came from this button, `data-disabled`. |

Why this shape:

- **Two inputs, one part.** The research's verdict puts the form value, the constraints and the
  reset on a native number input and the user's typing on a text input. Conventions 1.1 says a
  part renders at most one element, with Slider's exception for a control that is a visually
  hidden *child* of its styled element. An input is a void element, so the control cannot be a
  child; it is a **sibling rendered right after the visible input by the same part**. A separate
  `NumberField.HiddenInput` part (Ark UI's shape) was rejected for Slider's reason: a field
  without it would silently post nothing and validate nothing. The Root could render the hidden
  input instead (Combobox's Root renders one when `name` is given), but the Input part owns both
  refs that the Field contract and the validity mirror need (section 7), and a Root that renders
  a `div` *and* an input is two elements as well. The exception is proposal 2.
- **`Root` is a `div[role=group]`** named by the Label (research §2.2, React Aria): the two
  `tabindex="-1"` buttons are reached by a screen reader's browse mode, and the group tells the
  user what "Increase" increases ("Quantity, group: Decrease, button; Quantity, edit text, 1;
  Increase, button"). The buttons therefore carry the short built-in name only, not
  "Increase Quantity" (React Aria concatenates with `aria-labelledby`; Base UI uses the short
  name). Cost: the label is read twice when the group is entered (the group's name and the
  input's); accepted, as React Aria does.
- **`Label` is a part** so a standalone field has `label[for]` and a name for the group from
  one element; inside a Field, `Field.Label` plays the role (section 7) and `NumberField.Label`
  stays usable.
- **No `Group` part** (Base UI nests `Group` in `Root`): the Root is the group. **No
  `ScrubArea`** (Base UI's drag-to-change label): a pointer gesture on the label that changes a
  form value is undiscoverable and has no keyboard equivalent; section 13. **No `Clear`**: an
  empty draft commits `null`. **No `Value` part**: the value is the input's text; a consumer
  who wants it elsewhere reads `state.text` from the Root's `children` function.
- **No `<ViewTransition>` anywhere** (section 11).

Element constraints for `render`: the visible `Input` must stay an `<input>` whose `type` is
`text` (or `search` / `tel`, which keep a caret API and free-form text; `number` is a dev
warning: it would re-introduce the native parser the design exists to avoid); the hidden input
is always the library's; `Label` must stay a `<label>`; the buttons any element (`type="button"`
is emitted for a `<button>` only); `Root` any element. Library-controlled attributes (`role`,
`aria-labelledby` tokens, ids, `aria-controls`, `tabindex` on the buttons, `disabled`, `value`,
`data-*`) land on whichever element renders (owned keys, conventions 1.2). `inputMode`,
`autoComplete`, `autoCorrect`, `spellCheck` on the Input and `aria-label` on the buttons are
**defaults**, replaced by the consumer's own prop.

---

## 2. States and lanes

| State | Owner | Kind | Lane | Library-owned or browser-owned |
| --- | --- | --- | --- | --- |
| `value` (committed, optimistic) | Root, `useControllableAction<number \| null>` with `valueCommitAction` as its action | the number the field holds | **transition** (optimistic through `useOptimistic`) | Library-owned; residual browser paths: text typed before hydration and Firefox restoration (mount reconciliation), form reset. Uncontrolled state is written when a gesture's commit resolves (2.3). |
| `draft` | Root, `useState<string \| null>` | the text the user is editing, `null` when the input shows the formatted value | **urgent** (written in the `input` event) | Library-owned, internal: the text of a controlled text input, which React requires to be urgent (conventions 2.6). Not controllable, no action: it is not a number until it is parsed. Cleared by every commit, every step, a reset and a rollback. |
| `live` | Root, `useState<number \| null>` plus a ref | the value the current gesture has reached | **urgent** | Library-owned, internal (Slider 2.2): the value under a held button or the value a key press produced, before anything has committed. Shown while `held`. |
| step transition | Root, `useActionTrigger` | `valueChangeAction` in flight | transition | One `run` per step; the latest run's rejection goes to React, older ones are surfaced (conventions 3.4). |
| `hold` | Root, `useState<"increment" \| "decrement" \| null>` | a button is held (pointer captured, timers running) | urgent | Internal; not exposed (`:active` on the button is the platform's). |
| `stepHeld` | Root, `useState<boolean>` | a step was taken and its gesture's commit has not been dispatched yet | urgent | Slider's flag: keeps `live` on screen between a step and its commit when no step transition runs. |
| `pendingSource` | Root, `useState<"input" \| "increment" \| "decrement" \| null>` | where the latest step or commit came from | urgent | `data-pending` on that button while the Root is pending; the Input always carries the Root's pending. |
| `pending` | Root | step or commit transition in flight | | `stepPending \|\| commitPending`, including the Suspense wait of a step's render. |
| focus, selection, composition | DOM | | | Browser-owned. The library never moves focus (a button press keeps it where it is) and never touches the selection. |
| validity of the hidden input | DOM | | | Browser-owned; mirrored onto the visible input by the library after each write (section 6), and read by a Field (section 7). |

### 2.1 Why two actions, and what each is for

Slider's reasoning applies without change (slider.md 2.1): a press-and-hold produces a step
every 60 ms and only the last one is worth saving; a per-step network call would start dozens of
entangled actions (conventions 2.3 item 5), and a controlled "update on success" parent would
snap the text back between ticks. So:

| | `valueChangeAction` | `valueCommitAction` |
| --- | --- | --- |
| Called | on every step: the parse of typed text at commit, each key press, each tick of a hold, each wheel event, each platform change, the `"dismiss"` revert | once per gesture: the typed text's blur or Enter, a hold's release, each key press, each wheel event, each platform change |
| Lane | transition, through the Root's step transition (`useActionTrigger`) | transition, through the Root's commit dispatch (`useControllableAction`) |
| Awaited, pending | yes; `data-pending` while any step is in flight | yes; `data-pending` while the commit is in flight |
| Optimistic | none of its own (the input shows `live`, 2.2) | `setOptimistic(next)`: the text and the hidden input keep the gesture's value through the save and revert on rejection |
| Uncontrolled state | **not written** | written when it resolves (latest wins) |
| Meant for | adopting the value in a controlled parent (`setPrice(next)` in the sync prefix), a live total, cheap synchronous work | saving: a Server Function, a fetch, `requestSubmit()` |

A typed value fires **both**, with the same `next` and the same event (`focusout` or the Enter
`keydown`): the step channel sees every value the field ever shows, the commit channel sees
every value worth saving. A key press is a one-step gesture and fires both as well. Only a hold
separates them: ticks are steps, the release is the commit.

Why not one action dispatched per gesture, with the hold previewing internally? It would be
smaller (one prop), and the hold is the only continuous interaction here. Rejected for three
reasons: Slider already taught the pair and the conventions name it (2.1, "commit of a
continuous state"), so a second spelling for the same idea costs more than the prop; a
controlled parent that shows a live total (`qty × price`) during a hold needs the step channel;
and adding the pair later would change what `valueChangeAction` means. Product-owner item 1.

Why not a per-keystroke parsed value (Base UI's `input-change` reason)? `-`, `1,` and `1.` are
not numbers, `12` on the way to `123` is the wrong number, and a controlled parent adopting
per keystroke would format the text under the user's caret. The draft stays text until the
user is done; a consumer who wants the raw text reads nothing (section 13 keeps an `inputValue`
triple out of v1). Product-owner item 2.

### 2.2 What the input shows: the draft, then `live`, then optimistic

Two layers, both urgent, over the optimistic value:

```ts
const held = hold !== null || stepHeld || stepPending || commitPending;
const shown: number | null = held && liveSet ? live : optimistic;       // the value (Slider 2.2)
const text = draft ?? format(shown);                                     // the text
```

- **`draft`** is set from every `input` event (typing, cut, paste, IME composition, autofill)
  to the input's DOM value and the input renders it as its controlled `value`; the consumer's
  parent is not involved (no action), so the keystroke commits at once and React's end-of-event
  restore writes back the text the user just typed. `draft` is cleared (`null`) by a commit,
  a step, a reset and a rollback, after which the input shows `format(shown)`.
- **`live`** is Slider's: `useOptimistic` holds a value only while a transition is pending, and
  a step with a synchronous (or absent) `valueChangeAction` settles in a microtask, so between
  two ticks of a hold the text would re-format to the committed value. The Root keeps the
  gesture's value in the urgent lane and shows it while a hold is open, a step waits for its
  commit (`stepHeld`), or any step or commit is in flight. A step runs the step transition only
  when a `valueChangeAction` exists (Slider M2); `stepHeld` holds `live` otherwise.
- The hidden input's `.value` is written synchronously at every step (section 6) and re-applied
  to `shown` after every commit, so the DOM value the form would post, the text and the
  accessibility tree agree in every phase; a rollback re-applies the committed value in the
  commit that ends the rejected action.
- A controlled `value` that changes from outside while **no draft is open** shows at once
  (`optimistic` follows `committed`). While a draft is open the draft wins; the new value is
  visible after the next commit (which may replace it with the user's number, as the user is
  editing). Documented on the component page; React Aria behaves the same.

This is **not** the urgent lane of conventions 2.6 (an `on<State>Change: UrgentChangeHandler` prop, #96): no consumer-facing
action is urgent and a controlled `value` still gates committed state. The draft is the fourth
urgent library state the conventions list (Combobox's text and active option, Slider's `live`,
Field's mirror), used where React requires it.

### 2.3 Uncontrolled state is committed per gesture

`useControllableAction`'s action is `valueCommitAction`, so the uncontrolled write happens when
the gesture's commit resolves (Slider 2.3). Consequences, documented on the component page:

- A rejected `valueCommitAction` (a failed save) rolls the text and the hidden input back to the
  value before the gesture in uncontrolled mode; a controlled parent gets the same by adopting
  on success only. As in Slider, the rejection reaches the boundary above the Root, which
  replaces it; the visible rollback (the text re-formatting) happens with an update-on-success
  parent whose commit action catches its own failure, or a non-adopting parent.
- `valueChangeAction` resolving changes no library state; it is the preview channel.
- Overlapping gestures (a key press while a save is pending, typing and committing again)
  follow latest intent.

### 2.4 Step, commit, and the `"dismiss"` revert

The Root has two internal entry points, Slider's, with the draft folded in:

```ts
function step(next: number | null, source: Source, reason: ChangeReason, event: Event | undefined): boolean {
  if (next !== null) next = formatter.round(next);                  // 5.4 for stepped values too (review N1)
  if (next === shownRef.current) return false;                      // no-op against what is shown
  liveRef.current = next; shownRef.current = next;
  setLive(next); setDraft(null);                                     // urgent
  setPendingSource(source);
  syncHidden(next);                                                  // the hidden input, synchronously (section 6)
  if (reason !== "dismiss") setStepHeld(true);
  if (valueChangeAction === undefined) return true;
  runStep(() => {
    addTransitionType("fsui-number-field"); addTransitionType("fsui-number-field-change");
    return valueChangeAction(next, createActionDetails(event, { reason, source }));
  });
  return true;
}

function commit(source: Source, reason: ChangeReason, event: Event | undefined): void {
  setStepHeld(false);
  const next = liveRef.current;
  if (!liveSet.current || next === gestureStart.current) return;    // nothing changed since the gesture began
  gestureStart.current = next;
  setPendingSource(source);
  dispatch(next, createActionDetails(event, { reason, source }));    // useControllableAction
}
```

Typed text (`commitDraft(event)`): parse the draft (5.3); unparsable → `setDraft(null)` and
return (the input re-formats the committed value; nothing is dispatched); otherwise
`gestureStart = shown`, `step(parsed, "input", "activate", event)`, `commit("input", …)`. A key
press: `gestureStart = base`, `step`, `commit`. A hold: `gestureStart = base` at the press, a
`step` per tick, `commit` at release. The wrapped commit action is Combobox's / Slider's: on a
rejection in uncontrolled mode, for the latest commit only, `await undefined` (leave the
transition, conventions 2.6) then `step(committed, null, "dismiss", undefined)`, then rethrow.
`details.source` is `null` for `"platform"` and `"dismiss"` dispatches. `details.event` is the
DOM event of the gesture where one exists: the `focusout` or Enter `keydown` of a typed value,
the `keydown` of a key, the `wheel` event, the `pointerdown` of a press and the `pointerup` /
`pointercancel` / `lostpointercapture` / window `blur` of a release; it is **`undefined` for the
repeats of a held button** (a timer has no event) and for the commit of a hold its bound ended
(deviation 6).

The Root also derives `stepBase` (the parsed draft while one is open, else `shown`): it is what
a button press and the buttons' `disabled` state step from (4.3; review S3). A draft that
cannot be parsed makes `stepBase` the shown value.

---

## 3. Props and types

Shared types from `packages/ui/src/internal/types.ts` (conventions 2.2, 9.4).

### 3.1 `NumberField.Root`

```ts
export interface NumberFieldValueChangeDetails extends ActionDetails {
  readonly reason: ChangeReason;                       // "activate" | "platform" | "dismiss"
  /** What produced the value: typed text, a button, a key, the wheel; `null` for "platform" and "dismiss". */
  readonly source: "input" | "increment" | "decrement" | "keyboard" | "wheel" | null;
}

/** The state every NumberField part's function props receive (one object, Field's precedent). */
export interface NumberFieldState {
  /** The shown value: the gesture's value while one is open or in flight, else the optimistic value; `null` when empty. */
  readonly value: number | null;
  /** The shown text: the draft while the user is editing, else `value` formatted. */
  readonly text: string;
  readonly pending: boolean;
  readonly disabled: boolean;
  readonly readOnly: boolean;
  readonly required: boolean;
}

export interface NumberFieldRootProps
  extends Omit<ComponentPropsWithRef<"div">, "defaultValue" | "className" | "style" | "children"> {
  value?: number | null;
  /** Initial value in uncontrolled mode, and its form-reset target (latest). Default `null` (empty). */
  defaultValue?: number | null;
  /** Every step (2.1). Keep it cheap: adopt the value, start a deferred render. */
  valueChangeAction?: ChangeAction<number | null, NumberFieldValueChangeDetails>;
  /** Once per gesture (2.1): where the save goes. Commits uncontrolled state when it resolves. */
  valueCommitAction?: ChangeAction<number | null, NumberFieldValueChangeDetails>;
  /** Native `min` / `max` / `step` on the hidden input (constraints) and the bounds and grid of stepping. `step` default `1`, or `0.01` when `format.style` is `"percent"`. */
  min?: number;
  max?: number;
  step?: number;
  /** PageUp / PageDown and Shift+Arrow. Default `10 × step`. */
  largeStep?: number;
  /** `Intl.NumberFormatOptions` for the text: `style` `"decimal"` (default), `"percent"`, `"currency"` (with `currency`), `"unit"` (with `unit`); fraction digits, grouping, sign display. `notation: "compact"` is a dev warning (unparsable). */
  format?: Intl.NumberFormatOptions;
  /** BCP 47 tag(s). Default: the runtime's locale (`Intl.NumberFormat().resolvedOptions().locale`). Pass the page's `lang`; a dev warning fires when `document.documentElement.lang` disagrees and this prop is absent (5.1). */
  locale?: string | readonly string[];
  /** Step with the mouse wheel while the input is focused. Default `false` (4.4). */
  stepOnWheel?: boolean;
  /** Native `name` / `form` on the hidden input; defaults to the Field's `name` inside a `Field.Root`. */
  name?: string;
  form?: string;
  /** Disables both inputs and the buttons; inherited by every part. */
  disabled?: boolean;
  /** Native `readonly` on both inputs; no stepping (buttons disabled, keys and wheel inert). */
  readOnly?: boolean;
  /** Native `required` on the hidden input (empty is `valueMissing`); or the Field's. */
  required?: boolean;
  /** What `ariaNotify()` says after a step (8.3). Default: `(_, state) => state.text`. Return `null` to announce nothing. */
  announce?: (value: number | null, state: NumberFieldState) => string | null;
  className?: StateValue<string | undefined, NumberFieldState>;
  style?: StateValue<CSSProperties | undefined, NumberFieldState>;
  children?: StateValue<ReactNode, NumberFieldState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, NumberFieldState>;
}
```

Owned keys: `role`, `aria-labelledby` (token-merged: the consumer's tokens, then
`NumberField.Label`'s id, then a Field's label id), `data-pending`, `data-disabled`,
`data-invalid`. `id` on the Root is the `div`'s and passes through; the input's id is the Root's
`useId` or, inside a Field, the Field's control id. `transition` is not a prop. A `value` that is
not a finite number (`NaN`, `Infinity`) warns in development and is treated as `null`; a
`defaultValue` off the step grid is rendered as given (`stepMismatch` on the hidden input, the
platform's answer) with no warning; `min > max` warns.

### 3.2 `NumberField.Input`

```ts
export interface NumberFieldInputProps
  extends Omit<
    ComponentPropsWithRef<"input">,
    | "value" | "defaultValue" | "type" | "onChange" | "onKeyDown" | "onBlur"
    | "disabled" | "readOnly" | "required" | "name" | "form" | "min" | "max" | "step" | "pattern"
    | "aria-invalid" | "className" | "style" | "children"
  > {
  /** The hidden native `<input type="number">` rendered after the visible input. */
  hiddenInputRef?: Ref<HTMLInputElement>;
  className?: StateValue<string | undefined, NumberFieldState>;
  style?: StateValue<CSSProperties | undefined, NumberFieldState>;
  /** Must render an `<input>` of type `text`, `search` or `tel`; the hidden input is rendered after it regardless. */
  render?: RenderProp<ComponentPropsWithRef<"input">, NumberFieldState>;
}
```

A void element: no `children`. Owned keys on the visible input: `id`, `type` (the render
element's `text` / `search` / `tel`, else `"text"`), `value` (the shown text), `disabled`,
`readOnly`, the handlers in the `Omit`, `aria-invalid` and `aria-describedby` (Field,
token-merged), `data-pending`, `data-disabled`, `data-invalid`. Defaults the consumer's prop
replaces: `inputMode`, `autoComplete="off"`, `autoCorrect="off"`, `spellCheck={false}`,
`enterKeyHint` (none). `name`, `form`, `min`, `max`, `step`, `required` and `pattern` are omitted
because constraints live on the hidden input (a native constraint on the visible input would
make it invalid for a reason the mirror does not carry); `placeholder`, `aria-label`,
`aria-describedby`, `onFocus`, `onPaste`, `onCompositionStart` / `onCompositionEnd` (the
library installs neither: it reads `isComposing` and `keyCode` on the keydown), `onWheel`
(passive; the library's wheel listener is native) and the rest pass through. `ref` → the
visible input. A `name` on a `render` element warns (it would post the text).

### 3.3 `NumberField.Increment`, `NumberField.Decrement`

```ts
export interface NumberFieldButtonState {
  readonly pending: boolean;      // the latest step or commit came from this button and is in flight
  readonly disabled: boolean;     // the prop, the Root's `disabled` or `readOnly`, or the next step would change nothing
}

export interface NumberFieldIncrementProps
  extends Omit<
    ComponentPropsWithRef<"button">,
    "type" | "tabIndex" | "disabled" | "onPointerDown" | "onClick" | "onContextMenu" | "aria-controls" | "className" | "style" | "children"
  > {
  disabled?: boolean;
  className?: StateValue<string | undefined, NumberFieldButtonState>;
  style?: StateValue<CSSProperties | undefined, NumberFieldButtonState>;
  children?: StateValue<ReactNode, NumberFieldButtonState>;
  render?: RenderProp<ComponentPropsWithRef<"button">, NumberFieldButtonState>;
}
export type NumberFieldDecrementProps = NumberFieldIncrementProps;
```

Owned keys: `type="button"` (on a `<button>`), `tabIndex={-1}`, `aria-controls`, `disabled`,
the three handlers, `data-pending`, `data-disabled`. `aria-label` is a default (`"Increase"` /
`"Decrease"`, section 8.4) that the consumer's `aria-label` replaces; with a consumer
`aria-labelledby` the default is **omitted** (deviation 9), so the referenced element is the
whole name. `state.disabled` is computed from the step base (the parsed draft while one is
open), so a field showing `99` with `max 99` whose user has typed `50` has an enabled `+`.

### 3.4 `NumberField.Label`

```ts
export interface NumberFieldLabelProps
  extends Omit<ComponentPropsWithRef<"label">, "htmlFor" | "id" | "className" | "style" | "children"> {
  className?: StateValue<string | undefined, NumberFieldState>;
  style?: StateValue<CSSProperties | undefined, NumberFieldState>;
  children?: StateValue<ReactNode, NumberFieldState>;
  /** Must render a `<label>`. */
  render?: RenderProp<ComponentPropsWithRef<"label">, NumberFieldState>;
}
```

Owned keys: `id`, `htmlFor` (the input id), `data-pending`, `data-disabled`.

### 3.5 Namespace

```ts
// src/number-field/index.ts (no directive)
import "../internal/platform-attributes.js";
export const NumberField = { Root, Label, Input, Increment, Decrement } as const;
export type { NumberFieldRootProps, NumberFieldState, NumberFieldValueChangeDetails, NumberFieldInputProps,
  NumberFieldIncrementProps, NumberFieldDecrementProps, NumberFieldButtonState, NumberFieldLabelProps };
```

Subpath `@funstack/ui/number-field`; the root entry re-exports the namespace.

---

## 4. Gestures: typing, keys, buttons, wheel, platform

### 4.1 Typing and the commit

- Every `input` event writes the draft (2.2). Nothing is parsed, nothing is dispatched; the
  caret and the selection are the browser's.
- **Blur** (`focusout`) and **Enter** (`keydown`, not during an IME composition: judged by
  `event.isComposing` **or `keyCode === 229`**, because WebKit fires `compositionend` before the
  confirming keydown, which then has `isComposing === false`; Combobox's guard, review S1)
  commit the draft: parse (5.3) → step + commit with that event and `source: "input"`. Enter is
  **not** `preventDefault()`ed: inside a form the implicit submission follows, and the sync
  render of the step has already written the hidden input, so the form posts the committed
  value (Combobox's "Enter submits with the new value" row). **Implicit submission needs a
  submit button in the form**: the hidden `type="number"` input is a second field that blocks
  the platform's "single text field" rule, so a form whose only control is a NumberField and
  that has no submit button does not submit on Enter (the docs say "inside a form with a submit
  button"). Outside a form Enter does nothing else.
- While `disabled` or `readOnly` a commit only clears the draft (nothing is dispatched from an
  inert field; the text returns to the value; deviation 10).
- An **unparsable** draft (`abc`, `1,5` under `en`, `1.2.3`) reverts: the draft is cleared and
  the input shows the committed value's text again; no dispatch, no error. React Aria's rule.
  The alternative, keeping the text and flagging it, needs a built-in message (the hidden input
  cannot be made `badInput` by script: an invalid string sets it to `""`) and is section 13.
  Product-owner item 4.
- An **empty** draft commits `null` (if the value was not already `null`). With `required` the
  hidden input is `valueMissing`.
- A draft that parses to the **same** value commits nothing and re-formats (typing `1.0` in a
  field holding `1` shows `1` again after blur).
- Typed values are **not** clamped to `min` / `max` and **not** snapped to `step` (5.6): the
  hidden input's constraints report them and the browser's localised message says so.
- The rounding of 5.4 applies before the comparison with the shown value and before the
  dispatch.

### 4.2 Keyboard

On the visible input (`keydown`; each row is a one-step gesture: `step` then `commit` with the
`keydown` event and `source: "keyboard"`, `event.preventDefault()`ed so the caret does not move):

| Key | Effect |
| --- | --- |
| ArrowUp / ArrowDown | `± step` from the base (the parsed draft if one is open, else the shown value; empty counts as `0`, 5.5), snapped and clamped with `stepUp()` semantics. |
| Shift+ArrowUp / Shift+ArrowDown, PageUp / PageDown | `± largeStep`. |
| Home / End | `min` / the **largest on-grid value `≤ max`** (`boundValue`: with `0..5` by `2`, End is `4`, so no key can create a `stepMismatch`; deviation 1), **only when that bound is set** and **only without Shift**; otherwise the key is not handled: it moves the caret, and Shift+Home / Shift+End select text (review S2). |
| Enter | Commits the draft (4.1). Not prevented. |
| Alt / Ctrl / Meta + any key, Escape, Tab, everything else | Not handled (Cmd+Arrow and Ctrl+Home are caret moves on their platforms; deviation 7). Tab leaves the field and the `focusout` commits. Escape is left to the platform (a Dialog closes); reverting the draft on Escape is section 13. |

Auto-repeat: each repeated `keydown` is its own one-step gesture, as a held key on a native
range is (Slider 4.2). `readOnly` and `disabled` handle nothing. Keys are **never** handled on
the buttons (they are not focusable).

### 4.3 The buttons and press-and-hold

`pointerdown` on an enabled button (main button, `isPrimary`):

1. `event.preventDefault()`: a mouse press does not move focus off the input (or anything
   else), a touch press opens no keyboard and starts no selection. The library never calls
   `focus()` (research §2.2: the button is a control for the field, not a field).
2. `setPointerCapture(pointerId)`; `hold = "increment" | "decrement"`.
3. The base is the Root's `stepBase` (2.4): the parsed draft if one is open (unparsable → the
   shown value, draft cleared), else the shown value; `gestureStart = base`.
4. One `step` now (`source` the button, `event` the `pointerdown`). Then a 400 ms timer, then a
   step every 60 ms (Base UI 1.9 and React Aria 3.53; the touch variant's 600 ms is not
   adopted). The repeats carry **`details.event === undefined`**: a timer has no DOM event
   (deviation 6).
5. `pointerup`, `pointercancel`, `lostpointercapture` (on the button) and `blur` on `window`
   stop the timers, set `hold = null` and `commit` with that event. A step that would change
   nothing (the bound reached) ends the hold the same way, before the button is re-rendered
   `disabled` (a disabled element may not deliver the release); that commit's `event` is the
   tick's, `undefined`.
6. `contextmenu` on the button is prevented while a hold is open (a touch long-press).

A `click` with **no** pointer gesture before it (assistive-technology activation, `detail === 0`
and no `pointerdown` seen for this activation) is a one-step gesture: step + commit. A `click`
that follows the gesture is ignored (the hold already stepped). `disabled` at the bound uses
the exact rule "the next step **from the step base** would change nothing"
(`isAtBound(stepBase, ±1)`), which also covers an unreachable `max` (`0..5` by `2` stops at
`4`) and an empty value (always steppable); computing it from the shown value alone would
disable `+` on a field showing `max` whose user has typed a smaller draft, the press the step
base exists for (review S3). While a save is pending the buttons stay enabled (conventions
3.6).

### 4.4 Wheel

`stepOnWheel` (default `false`; the engines disagree about the native control, research §2.1,
and Base UI defaults off) adds a **native, non-passive** `wheel` listener to the visible input
(React's `onWheel` is passive) that, **only while the input is focused** (`document.activeElement`),
`preventDefault()`s and runs a one-step gesture per event: `deltaY < 0` increments, `> 0`
decrements, `deltaMode` and magnitude ignored (one step per event, Base UI); `deltaY === 0` (a
horizontal scroll) is ignored and not prevented (deviation 8). Unfocused, the page scrolls. A consumer's `onWheel` prop passes through and runs independently. A flick is
several gestures; with a slow `valueCommitAction` that means several entangled commits, which
the prop's docs say; the alternative (commit when the wheel idles) adds a timer for an opt-in
feature and is not designed. Product-owner item 9.

### 4.5 Platform paths

| Path | What happens | Dispatch |
| --- | --- | --- |
| Form reset (`form.reset()`, `<button type=reset>`, React's automatic reset) | In the `reset` event: the visible input's `defaultValue` attribute is written to `format(resetTarget)` (`onResetEvent`); the hidden input resets natively to its `defaultValue` attribute (the same target, kept there by react-dom). In the microtask: draft cleared, `step(resetTarget, null, "platform", resetEvent)` + `commit`, against the base of conventions 3.8 rule 1. A cancelled `reset` dispatches nothing. | one step + commit, `reason: "platform"`, `source: null` |
| Mount reconciliation | Layout effect at mount: the visible input's DOM text is compared with `format(initial)`. Equal: nothing. Different and the input **is focused** (the user is still typing, even a partial `12,` or `-`): adopted as the draft **before any parse**, no dispatch, never overwritten under the caret; the blur commits it or reverts it by the ordinary rule (review M1: the parse ran first and reset a focused partial draft to the formatted value). Otherwise, parsable to another value (typed before hydration): `"platform"` step + commit with `event: undefined`. Unparsable, or parsable to the same value: no dispatch; the library writes `visible.value = format(initial)` directly (deviation 3: a Root state bump does not re-render the Input through the memoised context, and react-dom's value tracker follows the setter). The reviewer's probe showed that react-dom itself re-syncs a hydrated input the user has **not** edited (server `en-US`, client `de-DE`: the attribute and the text become the client's with no dispatch), so this branch only ever sees text the user changed. The hidden input is `autocomplete="off"` (6.1), so no restored hidden value exists; the visible text is the source. | at most one |
| Controlled `value` changed by the parent | Shown when no draft is open; `useFieldValueChange` tells a Field (section 7). | none |

### 4.6 No-op and overlap rules

- A step to the shown value dispatches nothing; a commit whose value equals the gesture's start
  dispatches nothing (a hold that returns to its start value, `+` then `−`, fired steps and no
  commit).
- Typing while a commit is pending is urgent and unaffected; the next commit supersedes the
  pending one (latest intent, conventions 2.5). A step while a commit is pending shows `live`
  at once and its commit supersedes too.
- A hold while a step transition from a slow `valueChangeAction` is pending: ticks keep
  dispatching steps (each its own run); the input follows `live`; `data-pending` stays on.
- Two commits resolved out of order: the latest dispatched wins the uncontrolled write; the
  older one's rejection is surfaced to the boundary (conventions 2.4).

---

## 5. Numbers: locale, formatting, parsing, rounding, stepping

All of this is a directive-free module (`number-field-format.ts`, `number-field-arithmetic.ts`),
unit-tested on its own against a locale matrix.

### 5.1 Locale

`locale` is a prop. Its default is **the runtime's locale**
(`new Intl.NumberFormat().resolvedOptions().locale`), on the server and on the client. The
research suggested falling back to the nearest `lang`; rejected because the server cannot read
the DOM, so a `lang`-derived default would differ between the server and the client render and
the hydrated text would be wrong until a re-render (4.5 recovers, with a visible flash). What
the library does instead: a **dev warning** when `document.documentElement.lang` is non-empty,
its language subtag differs from the resolved locale's, and no `locale` prop was given ("the
page is `lang="de"` but NumberField formats as `en-US`; pass `locale`"). `navigator.language`
is never read (research: it is what makes Chromium's native input disagree with the page).
Product-owner item 7.

### 5.2 Formatting

`text = value === null ? "" : new Intl.NumberFormat(locale, format).format(value)`; formatters
are cached per `(locale, format)` in a module-level map (construction is expensive). The
supported `format` shapes: `style` `decimal` (default), `percent`, `currency` (+ `currency`,
`currencyDisplay`, `currencySign: "accounting"`), `unit` (+ `unit`, `unitDisplay`);
`useGrouping`, `minimumFractionDigits` / `maximumFractionDigits`, `minimumIntegerDigits`,
`signDisplay`, `numberingSystem`. `notation: "compact"` / `"engineering"` / `"scientific"` and
`maximumSignificantDigits` are accepted by the type (it is `Intl.NumberFormatOptions`) but warn
in development: the first cannot be parsed back, the second makes the rounding of 5.4
impossible to state (the value may then differ from the text).

### 5.3 Parsing

ECMA-402 has no parser (research), so the library derives the locale's symbols from
`formatToParts` once per `(locale, format)`: `decimal`, `group`, `minusSign`, `plusSign`,
`percentSign`, `currency`, `unit` and `literal` strings (from formatting `-1234567.891` and its
positive form), and the numbering system's ten digits (from formatting `0`…`9`). Parse, in
order:

1. `trim()`, then NFKC normalisation of the input (full-width digits and `％` become ASCII;
   NBSP and narrow NBSP are treated as the space they stand for), lower-casing, and the removal
   of bidi controls (U+061C, LRM, RLM, the isolates: `ar` puts them around signs); the symbols
   are normalised the same way.
2. Strip the `currency`, `unit`, `percentSign` and `literal` strings **at the edges only**
   (longest first; again inside the sign and the accounting parentheses of step 3). An affix in
   the middle of the number is garbage, never a group separator: `1€234` under `fr-FR` is
   unparsable (review N3; the first draft said "every occurrence", which turned the replaced
   affix into a space, a group separator in a space-grouping locale). The affix set covers
   every display the formatter has for the currency (`symbol`, `narrowSymbol`, `code`, `name`
   with its plural forms: `€`, `EUR`, `euro`, `euros`) and the unit (`short`, `long`,
   `narrow`: `km`, `kilometer`, `kilometers`), compared case-insensitively (deviation 5).
3. Sign: a leading or trailing ASCII `-`, U+2212 `−` or the locale's `minusSign`; accounting
   parentheses `(…)`; a `+` / `plusSign` is accepted and ignored. A sign with nothing else is
   unparsable.
4. Map the locale's digits and ASCII digits to `0`…`9`. Any remaining character that is not a
   digit, the decimal separator or a group separator makes the text **unparsable**. Two
   leniencies at this level (deviation 5): any apostrophe (`'`, `’`, `ʼ`) is a group separator
   where the locale groups with one (`de-CH`: keyboards differ), and ASCII `.` is accepted as
   the decimal separator where the locale's is U+066B (`ar`).
5. **Strict grouping**: group separators (the locale's, and any whitespace where the locale
   groups with a space) are accepted only **before** the decimal separator and only in the
   locale's own grouping (groups of three; the Indian two-digit groups where the locale
   formats `1234567` that way). A separator in any other position makes the text unparsable:
   `1,5` under `en` is not `15`, `1.5` under `de` is not `15`. React Aria and Base UI strip every
   group separator; the research calls Chromium's identical behaviour corruption, and a field
   that silently makes 1.5 into 15 is a worse outcome than a reverted draft. Product-owner
   item 5.
6. Nothing left → `null`. Otherwise `Number(integer + "." + fraction)`; `percent` style
   divides by `100`.
7. Round (5.4).

Test matrix (14.1): `en-US`, `de-DE`, `fr-FR` (U+202F grouping, `,` decimal), `de-CH` (`'`
grouping), `ar-EG` (Arabic-Indic digits, `٫` decimal, `٬` group), `ja-JP` (full-width input),
`en-IN` (two-digit groups), `hi-IN` with `numberingSystem: "deva"`; styles `currency` (`EUR`,
`JPY` with zero fraction digits, accounting), `percent`, `unit` (`kilometer`,
`unitDisplay: "long"`); signs `-`, `−`, `(1)`.

### 5.4 Rounding

Every value the field takes, **typed or stepped**, is rounded to the format's resolved
`maximumFractionDigits` (`resolvedOptions()`; `2` for most currencies, `0` for `JPY` and for
`percent` by default, `3` for `decimal`), applied to the number the text shows (for `percent`,
to the percentage, so the value gets two more digits: with the percent default a typed `0.5`
commits `0.01`, and `0.005` only with `maximumFractionDigits: 1`; deviation 11). So a typed
`1.999` in a `EUR` field commits `2`, posts `2` and shows `2,00 €`, and an ArrowUp with
`step={0.001}` in that field steps by what the text can show rather than posting `1.001` under a
`€1.00` (review N1: `step()` rounds through `formatter.round` as `commitDraft` does): **what the
user sees is what the form posts**. A consumer who wants more precision in the value than in the
text sets `maximumFractionDigits` higher (the text then shows it). With
`maximumSignificantDigits` set no rounding is applied (5.2 warns). Decimal arithmetic uses
`toFixed`, not binary rounding, through the shared `internal/decimal.ts` (moved from
`slider-arithmetic.ts`: `decimalsOf`, `roundTo`). Product-owner item 6.

### 5.5 Stepping

`stepValue(current: number | null, n: number, { min, max, step })`, the spec's `stepUp(n)` /
`stepDown(n)` algorithm (HTML "stepUp" steps 1 to 10), not the native UI stepping (which does
not snap, research §2.1):

1. `value = current ?? 0`; `before = value`.
2. Step base: `min` when given, else `0` (the spec's default step base; the hidden input's own
   base is its `value` attribute when `min` is absent, which is the reset target, so `stepMismatch`
   without `min` is evaluated against that attribute by the platform; the component page says
   "give `min` when the grid matters"). Off the grid (`1.5`, step `1`): snap to the nearest grid
   point **in the stepping direction** (`2` up, `1` down) and count that as one step; on the
   grid: `value + n × step`.
3. Clamp: above `max` → the largest grid point `≤ max` (an unreachable `max` stays unreachable:
   `0..5` by `2` tops at `4`); below `min` → `min`.
4. If the result moved against the direction (clamping below `before` on a step up), keep
   `before` (no change: the button's "next step would change nothing" rule). **An empty field
   skips this rule** (deviation 2): it has no direction to keep, and the platform's own rows
   need the skip (empty + ArrowDown with `min 3` moves *up* from the implicit `0` to `3`).
5. Round to `max(decimalsOf(step), decimalsOf(min))` places; the Root then rounds the result to
   the format (5.4).

Empty + ArrowUp with `min 3` → `3`; empty + ArrowDown with `min 3` → `3`; empty + ArrowDown
with no `min` → `-1` (the platform's rows in research §2.1). `largeStep` is `n = largeStep / step`
steps when that is a whole number, else `± largeStep` snapped to the grid toward the start
(never past `largeStep`, at least one step; `stepBy`). Home is `min`; End is the largest grid
point `≤ max` (`boundValue`), the same clamp as step 3, so an unreachable `max` is never
produced by a key (deviation 1).

### 5.6 Typed values: no clamp, no snap

A native `<input type="number" min="1" step="1">` accepts a typed `0` or `1.5` and reports
`rangeUnderflow` / `stepMismatch`; it does not rewrite the user's number. The library does the
same: the hidden input holds the typed value, the browser's message says what is wrong
("Value must be greater than or equal to 1."), the form does not submit until it is fixed, and
inside a Field the message shows (section 7). Base UI (`allowOutOfRange: false`) and React Aria
clamp on commit and Base UI snaps with `snapOnStep`; both hide the constraint from the user by
changing their number. Platform first; a consumer who wants clamping does it in
`valueChangeAction` with controlled mode. Product-owner item 3.

---

## 6. The two inputs

### 6.1 The hidden native number input

Rendered by `NumberField.Input` right after the visible input: `<input type="number" name
form min max step required disabled readOnly defaultValue autoComplete="off" aria-hidden="true"
tabIndex={-1} style={hiddenStyle} />`. Visually hidden, not `display: none`, because that is the
shape the research probed (`number-hidden-validity.mjs`); `pointer-events: none`. It is
`aria-hidden` and unfocusable: assistive technology sees one field. `autocomplete="off"`
(review N2): the visible input already has it, so the browser's form-state restoration (a
Firefox reload, history navigation in every engine) could restore the hidden input but not the
text; before hydration the form would then post a value the user does not see. With both off,
nothing is restored and the two inputs agree before and after hydration; the "Firefox
restoration" browser row is therefore moot (14.2).

The Root owns both refs (`visibleRef`, `hiddenRef`, passed through context) and the Input merges
them into its two elements; there is no registry (deviation 4). An Input that mounts after the
Root reconciled (a Suspense boundary) reports through `onItemMounted` from its first layout
effect, the late-mount path of `useNativeGroupReconciliation`.

**Uncontrolled, ref-written** (proposal 4): the input renders `defaultValue` = the reset target
(uncontrolled mode: the latest `defaultValue ?? ""`; controlled mode: the mount-time value),
which react-dom keeps in the `value` attribute and updates when the prop changes (probe: for
an input with no `value` prop react-dom's `updateInput` writes `defaultValue` only). The library
writes `.value` itself: synchronously in `step()` (`syncHidden(next)`: `String(next)`, `""` for
`null`) so the implicit submission on Enter and a submit click after a blur post the new value,
and in a layout effect after every commit that re-applies `shown` (a rollback, a controlled
change, a reset). A controlled `value` prop on the hidden input was rejected: react-dom then
rewrites its `value` attribute to the current value on every update, so the platform reset has
no target and the library must mirror the attribute in the `reset` event (Slider's rule, 3.8
rule 6), and `value` plus `defaultValue` together is a React warning. With the uncontrolled
shape the platform's reset is the platform's.

Dev check on the ref: the element is an `<input type="number">`.

### 6.2 The validity mirror

`syncHidden(value)` writes the hidden input's `.value` when it differs and then mirrors:
`const message = hidden.validationMessage; if (message !== lastMirror) {
visible.setCustomValidity(message); lastMirror = message; }`. One function for both writers,
called synchronously from `step()` (same task) and in the Input's layout effect after every commit (so a changed `min` / `max` /
`step` / `required` prop is reflected), and in the Field's slot write (section 7). The visible
input is then invalid exactly when the hidden one is, with the hidden one's localised message
(custom message first, then the native one: the platform's own precedence in
`validationMessage`), so:

- a bare NumberField in a form gets the platform's report UI on the **visible** input: the
  bubble, the focus move, `:user-invalid` after a submission attempt or a change-then-blur
  (the visible input is what the user changed);
- inside a Field, the Field's `:user-invalid` read, its `invalid` cancellation and its focus
  target all work on the visible input unchanged;
- `visible.validity` is `customError` only; the real flags are on the hidden input, which is
  why a Field reads them there (7.1).

The visible input must carry no native constraint of its own (`required`, `pattern`, `min` are
omitted from its props, 3.2): the mirror is its only source of invalidity.

**Known difference from a native number input: validity follows the committed value, not the
draft.** The mirror changes when the hidden input changes, which is at a commit (blur, Enter, a
step), never per keystroke (4.1: a draft is not a number, and `validate` never sees one). So
while the user types a fix into an invalid field, the visible input stays invalid until the
blur or Enter: `:user-invalid` styling persists in every engine, and in Firefox the validation
bubble, which stays over the page until the control becomes valid and swallows the next click
meanwhile, persists too (the bare-form browser row commits a valid value at the end to dismiss
it). A native `<input type="number">` re-validates per keystroke. This follows from the accepted
commit model and is recorded, not changed; see the open question at the end. Inside a Field the
bubble never appears (the Field cancels `invalid`) and `Field.Error` re-evaluates at the commit.

### 6.3 The hidden input's `invalid` event

A submission attempt fires `invalid` on every invalid control in tree order, and the browser
reports on the first **unhandled** one. The library attaches a native `invalid` listener to the
hidden input that **always** `preventDefault()`s: the hidden input is never the one the browser
focuses or draws a bubble for (research finding 5 shows what happens otherwise), and since the
visible input is invalid in the same cases, the report lands there (bare) or the Field handles
it (section 7). A `form.checkValidity()` still returns `false` and still fires `invalid` on
both; the listener does not change that. Chromium's "an invalid form control is not focusable"
console error is never logged, because the browser never tries to focus the hidden input.

### 6.4 Reset and mount reconciliation

Through `useNativeGroupReconciliation` with `element` = the hidden input (registered with the
Root by the Input from a layout effect, Slider's registry shape): `readCurrent()` reads the
visible input's text at mount (4.5, parsed) and the hidden input's value on a reset, `readDefault()`
returns the JS reset target, `base()` is `shownRef.current`, `equals` is `Object.is` on numbers
(`null` included), `onPlatformChange(next, event)` → `step(next, null, "platform", event)` then
`commit(null, "platform", event)`, and `onResetEvent` writes the visible input's `defaultValue`
to `format(resetTarget)` (react-dom rewrites a controlled text input's attribute after every
keystroke, conventions 3.8 rule 6). The reset target is dispatched from JS, never read from the
DOM in the microtask (a render in between would re-apply the shown value, Slider 9.2). The
hidden input's own `defaultValue` attribute is react-dom's business (6.1), so no mirror is
written for it.

---

## 7. Inside a Field

The one addition to the Field contract this needs (`validityElement`, conventions feedback 6)
is applied: conventions 3.8 and `design/components/field-form.md` "Amendment:
`validityElement`" (29a94c5); everything else is the Field's existing machinery. Every other
control registers no `validityElement` and is unchanged (the Field computes `surface === el`
for them).

```tsx
<Field.Root name="quantity" validate={(v) => (Number(v) % 6 === 0 ? null : "Sold in packs of six.")}>
  <Field.Label>Quantity</Field.Label>                        {/* label[for] → the visible input */}
  <NumberField.Root min={6} max={120} step={6} defaultValue={6}>
    <NumberField.Decrement>−</NumberField.Decrement>
    <NumberField.Input />
    <NumberField.Increment>+</NumberField.Increment>
  </NumberField.Root>
  <Field.Description>Packs of six, up to 120.</Field.Description>
  <Field.Error>{({ validity, messages }) => validity.stepMismatch ? "Enter a multiple of six." : messages.join(" ")}</Field.Error>
</Field.Root>
```

Rendered (idle):

```html
<div>                                                                     <!-- Field.Root -->
  <label id="_f_-label" for="_f_-control">Quantity</label>
  <div role="group" aria-labelledby="_f_-label">                           <!-- NumberField.Root; data-invalid while shown -->
    <button type="button" tabindex="-1" aria-label="Decrease" aria-controls="_f_-control" disabled>−</button>
    <input type="text" id="_f_-control" inputmode="numeric" value="6" aria-describedby="_f_-description" aria-invalid="false">
    <input type="number" name="quantity" min="6" max="120" step="6" value="6" aria-hidden="true" tabindex="-1" style="…">
    <button type="button" tabindex="-1" aria-label="Increase" aria-controls="_f_-control">+</button>
  </div>
  <p id="_f_-description">Packs of six, up to 120.</p>
</div>
```

### 7.1 The registration: two elements

`NumberField.Input` calls

```ts
useFieldControl({
  labelable: true, name, disabled, required, id, component: "NumberField.Input",
  validityElement: () => hiddenRef.current,            // conventions 3.8 (#67)
});
```

and merges the returned ref into the **visible** input's ref. The registration therefore
carries `element` = the visible input (what the Field labels through `for`, listens to with
its capture `input` / `change` / `focusout` / `invalid` listeners, reads `:user-invalid` from and
focuses) and `validityElement` = the hidden input (where the Field reads `validity` and
`validationMessage` and writes its custom-validity slot). The function form resolves lazily:
the hidden input's ref is attached after the visible input's in the same commit, and the
Field reads validity only from events and effects after mount (Field 9.4.3 already re-resolves
on every read).

What the Field does with it (the only Field-side changes):

| Field operation | Today | With `validityElement` |
| --- | --- | --- |
| `validity` snapshot, `messages` | `validityElementOf(element)` | the `validityElement` (the hidden input): `rangeUnderflow`, `rangeOverflow`, `stepMismatch`, `valueMissing`, `customError` are real, so `Field.Error`'s function `children` can branch on them (the example above) |
| `:user-invalid` | `validityElementOf(element).matches(":user-invalid")` | **`element`** (the visible input): the user-interacted flag is set by typing there and by a submission attempt; the mirror makes it invalid whenever the hidden one is |
| `setCustomValidity(custom)` | on the validity element | on the `validityElement`, **followed by the mirror** `element.setCustomValidity(validityElement.validationMessage)`, so the Field's own `:user-invalid` read in the same handler sees the new state. One line in the Field's slot write; identical to the library's mirror (6.2), so the two writers never disagree (both write the derived value) |
| `invalid` listener, bubble cancellation, focus target | `element` | unchanged: the visible input fires `invalid` (it is invalid by the mirror), the Field cancels it when a `Field.Error` is mounted, and focuses the visible input; the hidden input's `invalid` is cancelled by the library regardless (6.3) |
| `name`, `required`, `disabled` | returned, spread on the control | returned; the part puts `name` and `required` on the **hidden** input, `disabled` on both and the buttons |
| `id`, `aria-describedby`, `aria-invalid`, `data-invalid` | `attributes` | on the visible input (owned; `aria-describedby` token-merged); `data-invalid` also on the Root (through context) |
| `aria-labelledby` | groups only | the Root reads `FieldContext.ids.label` directly for its own `aria-labelledby` (Combobox's Root reads the context directly too) |

The Field's slot holds `validate`'s result or a shown server error, as for any control; typing
in the visible input is an `input` event the Field hears, so a server error is dismissed at
the first keystroke and `validate` re-runs per keystroke on `formData.get(name)` (the **hidden**
input's value, the last committed number, not the draft: `validate` sees numbers only, and a
half-typed draft is not re-validated until it commits). `validate`'s `value` is `String(number)`
(`""` when empty), so `Number(v)` is safe.

### 7.2 Changes the Field cannot hear: `useFieldValueChange`

A step writes the hidden input's `.value` through the ref with no `input` / `change` event, and
the visible input's text changes through React. The Root therefore calls

```ts
useFieldValueChange(optimistic, () => lastReason.current === "activate");
```

keyed on the optimistic value (one notification per gesture commit in uncontrolled mode, per
adopted step with an adopt-steps parent, and on a rollback), with `edit = true` for an
`"activate"` commit (a step or a typed commit dismisses a shown server error as an `input`
event would) and `false` for `"platform"` and `"dismiss"` (Slider 9.4.4). A typed commit also
fired native `input` events, so the Field refresh is idempotent (the mirror compares before it
sets state). Cross-field rules follow through `Form.Root`'s `refreshFields`.

### 7.3 Walkthroughs

1. **`stepMismatch` on submit.** The user types `7` and clicks Save: `focusout` commits `7`
   (`syncHidden(7)`, mirror: the visible input gets "Please enter a valid value. The two
   nearest valid values are 6 and 12."); the Field's `focusout` read finds `:user-invalid` on
   the visible input and `validity.stepMismatch` on the hidden one, shows "Enter a multiple of
   six." The click's submission attempt fires `invalid` on the visible (the Field cancels it,
   focuses the visible input) and on the hidden (the library cancels it). The user presses `+`:
   the hold's first step snaps `7` to `12` (5.5), release commits; the Field is notified with
   `edit = true`, re-reads: valid; the error unmounts.
2. **Server error, then a step.** `errors={{ quantity: "Only 24 left." }}` at mount: the Field
   writes the slot on the hidden input and mirrors; the visible input is `aria-invalid="true"`,
   `data-invalid` on the Root and the Input. The user presses `−`: the commit notifies with
   `edit = true`; the Field dismisses the error, clears the slot (mirror `""`), the next submit
   goes through.
3. **`required` from the Field, empty draft.** `Field.Root required`: `required` lands on the
   hidden input. The user clears the text and tabs away: `null` commits (`syncHidden(null)`,
   `valueMissing`, mirror "Please fill in this field."); `:user-invalid` on the visible input;
   `Field.Error` shows the browser's message (or the consumer's `valueMissing` branch).
4. **Form reset.** The hidden input resets natively, the Field re-reads in its microtask
   (`:user-invalid` cleared by the reset), the Root's `"platform"` commit notifies with
   `edit = false`; the mirror is rewritten by the re-apply effect.

### 7.4 Tests (jsdom, `number-field.test.tsx`, "Inside a Field")

| Row | Proves |
| --- | --- |
| Wiring | Inside `Field.Root name="quantity" disabled required`: the visible input's `id` is the Field's control id and `Field.Label`'s `for` equals it; `name` and `required` on the hidden input and not on the visible; `disabled` on both inputs and the buttons; `aria-describedby` = the Input's own tokens + the description id; `aria-invalid="false"` on the visible input only; the Root's `aria-labelledby` = the Field label id (+ `NumberField.Label`'s id when one is mounted, + consumer tokens first). |
| Flags from the hidden input | A typed `7` with `step={6}` and a blur: `Field.Error`'s function `children` sees `validity.stepMismatch` true and `messages[0]` equal to the hidden input's `validationMessage`; the visible input's `validationMessage` equals it (mirror) and `validity.customError` is true. |
| Slot on the hidden input | `validate` returning a message: `hidden.validity.customError` true, `hidden.validationMessage` the message, the visible input mirrors it; `validate` runs on `formData.get(name)` (the hidden value, a `String(number)`), not on the draft. |
| Submit attempt | `requestSubmit()` with an invalid value: `invalid` fires on both inputs; the hidden one is `defaultPrevented` (always); the visible one is `defaultPrevented` when a `Field.Error` is mounted; the visible input is focused (fallback mode); without a `Field.Error` the visible event is not cancelled. |
| Server error and a step | `Form.Root errors={{ quantity: "…" }}`: shown; a `+` press-and-release dismisses it (one notification with `edit = true`); a `"platform"` reset notifies with `edit = false` and a shown server error stays. |
| Two channels | A `valueCommitAction` in flight: `data-pending` on the Root, the Input and the button; the Field's `data-pending` follows the form's submission only. |
| `Field.Root required` | The hidden input is `required`; an empty commit is `valueMissing` on it, mirrored; `data-required` on the Field parts. |

Browser (`number-field.browser.test.tsx`, three engines): with `step={6}`, a real `Form.Submit`
click after typing `7` fires `invalid` on the visible input, the Field cancels the bubble and
focuses it, the visible input matches `:user-invalid`, no bubble appears for the hidden input
and the console logs no "not focusable" error (Chromium); a real `+` click clears the error and
the next click submits with `quantity=12` in `FormData`.

---

## 8. Accessibility

### 8.1 ARIA summary

| Element | Attributes |
| --- | --- |
| Root `div` | `role="group"`, `aria-labelledby` (Label / Field label / consumer tokens) |
| Label | `for` → the visible input |
| Visible input | `type="text"`, `id`, `inputmode`, `aria-describedby` / `aria-invalid` (Field), `readonly`, `disabled`; **no `role`**, no `aria-valuenow` / `-min` / `-max` / `-valuetext`, no `aria-roledescription` (8.2) |
| Hidden input | `aria-hidden="true"`, `tabindex="-1"` |
| Buttons | `type="button"`, `tabindex="-1"`, `aria-label` `"Increase"` / `"Decrease"`, `aria-controls` → the visible input, `disabled` at the bound |

What a screen reader hears: entering the group "Quantity, group"; on the input "Quantity, edit
text, 1" (with a description "Packs of six, up to 120." inside a Field); after ArrowUp, the
announcement "2" (8.3); browsing to a button "Increase, button" (the group gives the context);
an error "Quantity, edit text, 7, invalid entry, Enter a multiple of six." (`aria-invalid` plus
`aria-describedby` → `Field.Error`).

### 8.2 No `role="spinbutton"`, no `aria-roledescription`

The APG Spinbutton pattern asks for `role="spinbutton"` with `aria-valuenow` and friends. The
product owner accepted the research's deviation: on a text input, VoiceOver announces "50%" or
"0" instead of the value (WebKit 221102, confirmed 2026-03 and 2026-09) and its swipe gestures
rewrite the text (250380); React Aria and Base UI both render a plain textbox. The component
page documents the deviation and what replaces it: the formatted text (the role's "value"), the
`inputmode` keyboard, and the step announcements. Windows screen readers lose the words "spin
button"; the Increase / Decrease buttons in the group and the Arrow announcements tell the
user the same thing.

`aria-roledescription` (Base UI: `"Number field"`; React Aria: localised `"number field"`) is
**not added**. A role description **replaces** the role name in every screen reader that
honours it (NVDA, JAWS, VoiceOver), so the user no longer hears "edit text", the cue that the
field takes typing; ARIA 1.2 asks authors to use it only where the role itself is clear, and
"number field" does not say "editable" to someone who has never met one. It would also be a
third built-in string needing the function-prop override of conventions 11 for a localisation
the consumer would then have to supply everywhere. A consumer who wants it passes
`aria-roledescription` through `NumberField.Input` (pass-through). This follows the product
owner's lean; item 8 records it.

### 8.3 Announcing steps: `ariaNotify()`

A text input whose value changes under the user's hands (ArrowUp, a button) is not reliably
announced: the screen reader read the old value at focus and heard no typing. After every
discrete step (a key press, a wheel event, a click activation) and at the **release** of a hold
(not per tick: the user hears the final value, as React Aria's announcer coalesces), the Root
calls `announce(value, state)` (default `state.text`, so "2", "€ 1,50", "50%") and speaks it:

`visible.ariaNotify(message)` (Chrome 141, Firefox 150, Safari 27: every supported engine,
adopted without a flag for Combobox, conventions 8), through `internal/announce.ts`. An engine
without it announces nothing.

**No fallback region (#113 A1, 2026-10-24).** The first version kept, at the product owner's
request, a module-level visually hidden `div[role=status]` appended to `document.body` for
engines without `ariaNotify` (cleared, written 100 ms later, cleared after a second; review N4).
It never ran in a supported browser (docs/vision.md: latest stable of each engine, no
fallbacks), and in `document.body` it was inert under a modal dialog, so it was dropped.
Known gap (BCD): ChromeOS exposes `ariaNotify` but never speaks it; the feature-detected
fallback would not have run there either.

`null` from `announce` announces nothing. Combobox kept its own `ariaNotify` call and
`focus-first-invalid.ts` its own `announce` at first; #129 moved them (and Toast) onto
`announce.ts`, now directive-free with one `announce(target: Element | Document, message,
priority?)` plus `canAnnounce(target)` (the optional follow-up of issue #77; not a design change).

### 8.4 The two built-in strings

`"Increase"` and `"Decrease"` are the buttons' default `aria-label`s: a button whose only
content is a glyph (`+`, `−`, an icon) has no name otherwise, which is the accessibility gap
conventions 11 allows a built-in string for. They are **static** (no state to depend on), so
the override is the ordinary `aria-label` / `aria-labelledby` pass-through, Toast's
region-name rule, not a function prop; the docs show `aria-label="Erhöhen"` next to the
`locale="de-DE"` example. A consumer `aria-labelledby` makes the library omit the default
`aria-label` altogether (deviation 9; accessible-name computation would let `aria-labelledby`
win anyway, and omitting it keeps the DOM honest). A button with real text content (`<Increment>Add one</Increment>`)
still gets the default label, which overrides its content for assistive technology; the
documented way to let the content name the button is to pass the same text as `aria-label`
(the default is replaced, never removed: `aria-label=""` would leave the button nameless and is
a dev warning). Product-owner item 8.

### 8.5 `inputmode` and the keyboard

`inputmode="decimal"` when fractions are allowed (`step` has decimals, or the format's
`maximumFractionDigits > 0`, or `format.style` is `"percent"`), else `"numeric"`. The iPhone's
`decimal` and `numeric` pads have no minus key (WebKit 193825); React Aria switches to `text`
there when negatives are allowed. The library does **not** sniff the user agent (a hydration
mismatch or a post-mount re-render for one key): the limitation is documented, and a consumer
who needs negatives on iPhone passes `inputMode="text"` (a default, 3.2). Section 13.

---

## 9. Pending, data attributes, CSS

### 9.1 Attributes

| Attribute | Root | Label | Input (visible) | Increment / Decrement | Meaning |
| --- | --- | --- | --- | --- | --- |
| `data-pending` | yes | yes | yes | the button the latest step or commit came from | A step or commit is in flight (including the Suspense wait of a step's render). |
| `data-disabled` | yes | yes | yes | yes (prop, inherited, `readOnly`, or at the bound) | Also native `disabled` on both inputs and the buttons; `:disabled` sees `<fieldset disabled>` too. |
| `data-invalid` | yes | | yes | | From a Field (section 7); never outside one. |

Platform pseudo-classes documented next to them: `:read-only`, `:disabled`, `:user-invalid` and
`:placeholder-shown` (empty) on the visible input, `:active` on a held button, `:focus-within`
on the Root.

### 9.2 CSS

```css
.number-field { display: inline-grid; grid-template-columns: auto 1fr auto; align-items: stretch; }
.number-field .input { min-width: 6ch; text-align: end; font-variant-numeric: tabular-nums; }
.number-field .step { inline-size: 2.25rem; }
.number-field .step:disabled { opacity: .4; }
.number-field .input[data-pending] { background-image: var(--spinner); background-position: left 6px center; background-repeat: no-repeat; }
.number-field .step[data-pending] { cursor: progress; }
.number-field .input:user-invalid { border-color: var(--danger); }
.number-field[data-invalid] .step { border-color: var(--danger); }
.number-field:has(.input:focus-visible) { outline: 2px solid var(--accent); }
```

Hide the browser's default number spinner: not needed (the visible input is `type="text"`).
RTL: the grid follows `direction`; the buttons' order is the consumer's markup order, so an RTL
page places `Decrement` first in source if it wants it at the inline start.

---

## 10. Server rendering and before hydration

Every part file is `"use client"` (context, hooks, DOM listeners); `number-field-format.ts`
and `number-field-arithmetic.ts` have no directive. A Server Component may render every part
and pass Server Functions to both actions. The server HTML contains the group, the label, the
visible input with the formatted initial value (formatted with the server's `locale` or runtime
locale: pass `locale`, 5.1), the hidden input with the value and constraints, the buttons.
Before hydration: typing works and is adopted at mount (4.5); the buttons do nothing (no
`command`, nothing to invoke); a form submitted before hydration posts the **default** value
(the typed text lives in a nameless input), the same rule as Combobox. Progressive enhancement,
not a JS-free mode. The plain `<input type="number">` from a Server Component remains the JS-free
number field, with the research's caveats (#19 resolved 2026-10-23, user decision, option A of `docs/research/zero-js-variants.md` 5: no directive-free variant; a recipe on the docs page, conventions 7.3).

---

## 11. ViewTransition

No part has a `transition` prop and none renders `<ViewTransition>` (conventions 5.1, the
Select / Slider category): the text is urgent (draft) or follows `live` / optimistic state, the
hidden input is ref-written, and nothing mounts from library state. The dispatches add
`fsui-number-field` plus `fsui-number-field-change` (step) / `fsui-number-field-commit`
(gesture) so a consumer's own boundary around dependent content (a total that re-renders in the
step transition) can key a type map on them. A rollback carries no types.

---

## 12. Async walkthroughs

1. **Typed, saved, failed.** `defaultValue={1}`, `valueCommitAction` rejects after 800 ms. The
   user types `5`, presses Tab: `focusout` → parse `5` → `step(5)` (text `5`, hidden `5`,
   `valueChangeAction(5)` if given) → `commit`: `setOptimistic(5)`, `data-pending` on Root and
   Input, `source: "input"`. The user keeps tabbing; 800 ms later the rejection: the catcher
   above the Root receives it; the field is **unmounted** with the boundary (Slider 2.3). Same
   with an update-on-success parent that catches inside its action: `data-pending` leaves, the
   text re-formats to `1`, the hidden input re-applies `1`, `valueChangeAction(1, { reason:
   "dismiss" })` is **not** dispatched (controlled). Uncontrolled with the failure caught
   inside the action: the action resolves, so `5` commits (conventions 2.4; the docs repeat
   it).
2. **A hold with a live total.** Controlled adopt-steps parent: `valueChangeAction={(n) =>
   { setQty(n); }}`, the total `qty × price` rendered from a resource that suspends per `qty`.
   Press `+` and hold: `hold = "increment"`, step `2` (text `2`, hidden `2`, a step transition
   with `setQty(2)` in its sync prefix), `data-pending` on Root, Input and the `+` button;
   after 400 ms a tick every 60 ms: `live` moves (`3`, `4`, …), each a step run; the total
   keeps showing the last ready value under `data-pending` (content keyed on committed state;
   the step renders are transitions, so a suspending total never shows a fallback). Release at
   `7`: `commit(7)`, `valueCommitAction(7)` saves; `live` stays shown through `held` until the
   save and the last step render settle; then `optimistic === committed === 7`.
3. **Typing while a save is pending.** Commit `5` (slow save pending). The user focuses the
   field and types `6`: urgent, the draft shows at once. Blur: `step(6)` + `commit(6)`
   supersedes; the first save's result is ignored for the uncontrolled write (its rejection
   would be surfaced). `data-pending` stays on until the latest settles.
4. **Enter in a `Form.Root`.** Type `12`, press Enter: `keydown` → `step(12)` + `commit(12)` (the
   sync render writes the hidden input before the key's default action) → the implicit
   submission runs the Form's action with `quantity=12`; the commit action (if any) and the
   form's submission are two pending channels: `data-pending` on the Input (its own) and on
   `Form.Submit` (the form's).
5. **Rejected commit mid-edit.** A save for `5` is pending; the user is typing `7` (draft open)
   when the save rejects (update-on-success parent, caught inside): the optimistic value
   reverts to `1` and the hidden input re-applies `1`; the draft `7` stays on screen (2.2) and
   commits at blur as its own gesture.
6. **Pre-hydration typing.** The server rendered `1`; the user types `3` and tabs away before
   hydration; at mount the text `3` differs from `1`, parses to `3`: one `"platform"` step +
   commit with `event: undefined`, `source: null`; the hidden input is written to `3`. Had the
   user still been in the field, even with a partial `12,`, the text would have been adopted
   as the draft (before any parse, review M1) and committed, or reverted, at their blur.

---

## 13. Not in v1

- **An `inputValue` pair with its urgent handler** (`inputValue` / `defaultInputValue` /
  `onInputValueChange: UrgentChangeHandler`, #96) exposing the draft, Combobox's shape. Nothing needs the raw text today;
  adding it later is additive (the draft already exists internally).
- **`smallStep` and Alt+Arrow** (Base UI), **`step="any"`** (keys would need their own step),
  a **scrub area** (Base UI's drag-on-label), **Escape reverting the draft**, a **`Clear`**
  part.
- **`notation: "compact"` parsing** ("1.2K"), **`maximumSignificantDigits` rounding**, **Indian
  grouping beyond `en-IN` / `hi-IN`** test coverage, **`ar` sign placement variants**.
- **A built-in "not a number" message** for unparsable text (the text reverts instead, 4.1).
- **iPhone `inputmode="text"` for negatives** (8.5): the consumer passes `inputMode`.
- **Per-tick announcements** during a hold (the release is announced).
- **A `BubbleInput`** synthetic `input` / `change` on the hidden input for non-Field form
  code (Slider 13): a step is invisible to a `<form onChange>` listener; typed commits are not
  (the visible input's native events).
- **Wheel commit coalescing** (4.4).
- **Validity that follows the draft** (6.2, the open question at the end).
- **The browser rows of #77** (touch hold, IME, the CDP console check, the rejected-commit
  `startViewTransition` case); the migration of Combobox and `focus-first-invalid.ts` onto
  `internal/announce.ts` is done (#129).
- **Formatting the draft while typing** (live grouping): a formatter under the caret is what
  the draft design avoids.

---

## 14. Test plan

`packages/ui/src/number-field/number-field-format.test.ts` (pure), `number-field.test.tsx`
(jsdom) and `number-field.browser.test.tsx` (Chromium, Firefox, WebKit). "both" =
`describe.each` over uncontrolled and the two controlled wrappers (adopt steps; update on
commit success). jsdom has full ICU (`Intl.NumberFormat` for every locale in 5.3, probed) and
native constraint validation for `type="number"` (`rangeUnderflow` / `rangeOverflow` /
`stepMismatch` / `valueMissing` / `customError`, `validationMessage` "Constraints not
satisfied", probed), which keeps the validity rows in jsdom; it has no `:user-invalid` (Field's
fallback), no `ariaNotify` (a stub covers the `ariaNotify` branch; without it nothing is
announced), no layout; `setPointerCapture` is polyfilled by `vitest.setup.ts` if absent; the
hold uses fake timers; the wheel row dispatches a `WheelEvent` on the input.

### 14.1 jsdom

| Area | Tests |
| --- | --- |
| Parser and formatter (pure) | The 5.3 matrix: round trips `format(parse(format(n))) === format(n)` for each locale and style; strict grouping (`1,5` `en` → unparsable; `1,234` → `1234`; `1.5` `de` → unparsable; `1.234,5` `de` → `1234.5`; `1 234,5` `fr` with U+202F and with a plain space; `1'234.5` / `1’234.5` `de-CH`; `12,34,567` `en-IN`); digits (`١٢٣` → `123`, `١٢.٥` with an ASCII `.` under `ar`, full-width `１２` → `12`, `२` with `deva`); bidi controls stripped; signs (`-1`, `−1`, `(1)` accounting, trailing minus where the locale formats it, `+1`); percent (`50` and `50%` → `0.5`; `0.5` → `0.005` **with `maximumFractionDigits: 1`**, and `0.01` with the percent default of `0`, per 5.4); affixes at the edges in every display (`€ 1,50`, `1,50 €`, `EUR 1.50`, `eur 1.50`, `1.50 euros`, `1.50 euro`; `12 km`, `12 kilometers`) and **unparsable in the middle** (`1€234` `fr-FR`); rounding to the resolved fraction digits (`1.999` `EUR` → `2`; `JPY` → integers; percent to two more digits); empty / whitespace → `null`; garbage → unparsable; `compact` warns. Stepping (5.5): the platform rows (`1.5` up → `2`, down → `1`; empty with `min 3` up / down → `3`; empty no `min` down → `-1`; at `max` clamps; `0..5` by `2` tops at `4`, End gives `4` and `+` from `4` changes nothing; `0.1` steps round; `largeStep` whole and fractional multiples); a step finer than the format (`step 0.001` in `EUR`) is rounded to the format by the Root. |
| Roles and ARIA | The section 1 HTML: Root `role="group"` with `aria-labelledby` = Label id (+ consumer tokens first); Label `for` = visible input id; visible input `type="text"`, no `role`, no `aria-value*`, no `aria-roledescription`, `inputmode` `numeric` / `decimal` by the 8.5 rule and replaced by a consumer `inputMode`; hidden input after it with `type="number"`, `name`, `min` / `max` / `step` / `required`, `aria-hidden`, `tabindex="-1"`, no `name` on the visible; buttons `type="button"`, `tabindex="-1"`, `aria-controls`, default `aria-label`s and a consumer override; `render={<input type="number" />}` warns; dev warnings for `NaN`, `min > max`, `lang` disagreement (`document.documentElement.lang = "de"` with no `locale`), `aria-label=""` on a button. |
| Typing (both) | `user.type("42")`: the draft per keystroke (DOM value), no dispatch, no `data-pending`; Tab → `valueChangeAction(42, { reason: "activate", source: "input" })` and `valueCommitAction(42, …)` once each with the `focusout` event; Enter → the same with the `keydown`, not `defaultPrevented`; unparsable text reverts the DOM value with no dispatch; empty → `null`; `1.0` in a field holding `1` → no dispatch, re-formatted; a value out of range or off grid dispatches as typed and the hidden input reports `rangeOverflow` / `stepMismatch`; `readOnly` typing is impossible (native) and `disabled` dispatches nothing (a draft "committed" while inert is cleared); Enter with `isComposing` **or `keyCode: 229`** does nothing. |
| Keyboard (both) | Each 4.2 row: ArrowUp / Down, Shift+Arrow, PageUp / Down, Home / End with and without bounds (prevented only when handled; End lands on the largest grid point `≤ max`), from a draft (the draft is parsed first), from empty; each a step + commit with the `keydown` and `source: "keyboard"`; auto-repeat (`repeat: true`) dispatches per event; **Shift+Home / Shift+End with bounds set are not handled and not prevented**; Ctrl / Meta + Arrow not handled; keys on a button do nothing. |
| Hold | Fake timers: `pointerdown` on `+` is `defaultPrevented`, captures, steps once (`event` the `pointerdown`), no commit; at 400 ms a second step, then every 60 ms, each with `event: undefined`; `pointerup` commits once with the final value (`source: "increment"`, the `pointerup` event); `pointercancel`, `lostpointercapture` and window `blur` each end the hold and commit; a hold reaching `max` ends itself and commits with `event: undefined`; `+` then `−` back to the start commits nothing; a second pointer is ignored; `contextmenu` during the hold is prevented; a `click` with `detail: 0` and no preceding `pointerdown` steps and commits once; a `click` after a hold is ignored; `disabled` / `readOnly` / at-bound buttons do nothing and carry `disabled` + `data-disabled`; **the bound follows the draft**: `defaultValue 99, max 99`, type `50` → `+` is enabled and a press steps to `51`; `data-pending` lands on the button whose gesture is pending and not on the other. |
| Wheel | With `stepOnWheel`: a `wheel` with `deltaY: -1` on the focused input steps up, `+1` down, each `defaultPrevented`, each a step + commit with `source: "wheel"`; `deltaY: 0` does nothing and is not prevented; unfocused: nothing and not prevented; without the prop: nothing; the listener is non-passive (`addEventListener` spied with `{ passive: false }`). |
| Hidden input and the mirror | After every path (typed commit, key, hold, reset, rollback, controlled change) `hidden.value === String(shown)` (`""` for `null`) synchronously in the event and after the commit; the visible input's `validationMessage` equals the hidden one's and `validity.customError` tracks it; valid → `""`; a changed `max` prop re-mirrors; the hidden input's `defaultValue` attribute equals the reset target (latest `defaultValue` uncontrolled; mount-time controlled) and it carries `autocomplete="off"`; `invalid` dispatched on the hidden input is `defaultPrevented`, on the visible not (bare); `hiddenInputRef` reaches it. |
| Steps and commits (both) | A step runs inside a transition (a parent `useTransition` probe never reports it urgently; `data-pending` is the only sign); without a `valueChangeAction` a step starts no transition and `stepHeld` holds the text until the commit; a `"dismiss"` step after a rejected commit (uncontrolled) is outside the transition (the `await undefined` yield). |
| Async commit (both) | Deferred `valueCommitAction`: `data-pending` on Root, Input and the source button; the text, the hidden value and `state.value` hold the gesture value; uncontrolled committed state unchanged (a `children` probe) until resolve; then committed. |
| Rejection (both) | The catcher above Root receives it and the field is gone; uncontrolled: `valueChangeAction(prev, { reason: "dismiss", source: null, event: undefined })` once; controlled: no `"dismiss"`; a retry boundary remounts with `defaultValue` / the adopted value; caught-inside commits; **mounted rollback** (update-on-success parent catching inside): `data-pending` leaves, the text and the hidden input return to the parent's value; a draft open at the rollback stays open and commits later. |
| No snap | Between two ticks of a hold with a synchronous `valueChangeAction` (settled), the text still shows the last tick; an adopt-steps parent whose content suspends: after release the text shows the gesture value until the content resolves, never the pre-gesture value; a non-adopting controlled parent: follows during the hold, returns to `value` after release once. |
| Overlap, superseded rejection (both) | Two commits with a slow action (a key press, then typing + blur): `data-pending` stays, the latest wins; the older's rejection reaches the catcher after and while the newer is pending. Cross-channel: a superseded commit rejection while a step pends, and a superseded step rejection while a commit pends, each reach the catcher promptly (conventions 2.4). |
| Suspending content (both) | A controlled adopt-steps parent's content keyed on the value suspends on a step: old content stays, no fallback above, `data-pending`; then new content (`await act(async …)`). |
| Platform path (both) | Mount reconciliation: `renderToString`, set the visible input's value to `"3"` before `hydrateRoot` → one `"platform"` step + commit (`source: null`, `event: undefined`), hidden written to `3`, StrictMode still one; the input focused at hydration → adopted as the draft, no dispatch, **also when the text is unparsable (`"12,"` stays under the caret, review M1)**; a value formatted by another locale (`"1.234,5"` under `en`) → no dispatch and the text re-synced to `"1,234.5"`. Form reset: `form.reset()`, `<button type=reset>`, automatic reset after `<form action>` → the visible `defaultValue` attribute equals `format(target)` at the `reset` event, the hidden resets natively, one step + commit with the `reset` event, a cancelled reset dispatches nothing, a refusing controlled parent is re-synced; a draft open at reset is cleared. |
| Forms | `FormData` has `name` = `String(value)`, absent when `disabled`, `""` when `null`; `form` attribute honoured; Enter's implicit submission (a `submit` listener) sees the committed value in `FormData`; the text is never posted. |
| Inside a Field | The 7.4 table. |
| Announcements | `ariaNotify` stubbed on `Element.prototype`: called on the visible input once per key press, wheel event, click activation and hold release (not per tick), with `state.text` or the consumer's `announce` string, never when it returns `null`, never for a typed commit; stub removed: the step still happens and no live region is inserted (#113 A1). |
| Function props / `render` | Every part's documented state (`NumberFieldState` on Root / Label / Input, `NumberFieldButtonState` on the buttons with `disabled` true at the bound); `render={<input type="search" />}` keeps the handlers and the hidden sibling; button `render={<a />}` gets no `type`; `className` / `style` merge; `aria-label` on a button replaces the default and `aria-labelledby` removes it; `onCompositionStart` / `onCompositionEnd` on the Input pass through and fire. |
| Post-await rule | A controlled parent updating after its own `await` inside `startTransition` in `valueCommitAction`. |
| Directive | Every file under `src/number-field/` except `index.ts`, `number-field-format.ts` and `number-field-arithmetic.ts` begins with `"use client"`. |
| Types | `value` / `defaultValue` accept `number \| null`; `transition`, `inputValue`, `aria-valuenow`, `required` / `min` on `Input` are not props (type test); `NumberFieldValueChangeDetails.source` union; `hiddenInputRef` typed `Ref<HTMLInputElement>`. |

### 14.2 Browser mode (`number-field.browser.test.tsx`)

| Row | Assertion | Engine branches |
| --- | --- | --- |
| Real keys and typing | Real ArrowUp / ArrowDown / PageUp / PageDown / Home / End on the focused input change the text per 4.2 and leave the caret where it was for unhandled keys (Home / End without bounds move the caret); typing `1,5` under `locale="de-DE"` then Tab commits `1.5` (`hidden.value === "1.5"`), under `en-US` reverts. | none |
| Native report, bare | In a `<form>` with no Field: type `0` with `min={1}`, click submit: the browser focuses the **visible** input (`document.activeElement`), `:user-invalid` matches it, the hidden input never received focus (the proxy for "no 'not focusable' console error", which page JS cannot observe; the CDP `Log` check is #77); the submission did not happen. The row ends by committing a valid value, because Firefox's bubble stays over the page and swallows the next click until the control is valid (6.2). | none; the message text differs per engine and is asserted non-empty |
| Inside a Field | The section 7 browser row. | none |
| Enter submits with the new value | A `Form.Root` with an action spy: type `12`, Enter: the action runs once with `quantity=12`. | all three; document any engine where the sync flush lands after submission (Combobox's row passed on all three) |
| Wheel | With `stepOnWheel` and the input focused, a real wheel over it changes the value and the page does not scroll; unfocused, the page scrolls and the value stays; without the prop the page scrolls either way. | none |
| Real hold | A real pointer press on `+` held for a measured duration: the value advanced by `1 + ceil((held − 400) / 60)` ± 1 ticks (the row measures the press duration rather than assuming it, 5fe8ae6), one commit at release; focus never left the input (`document.activeElement` before and after); no text selection; `:focus-visible` is false on the button. **Not written**: touch emulation (a press opens no keyboard and no context menu); vitest's `userEvent` has no touch hold, CDP `Input.dispatchTouchEvent` can drive it (#77). | touch row `browserName === "chromium"`, when written |
| Announcements | `ariaNotify` spied on the input: one call per key press with the formatted text; one per hold release. | `supportsAriaNotify`; otherwise: the step happens, no live region |
| Accessibility tree (Chromium) | CDP: the input is a `textbox` named "Quantity" with no `valuenow`; the Root a `group` named "Quantity"; the buttons named "Increase" / "Decrease"; the hidden input absent from the tree. | `browserName === "chromium"`; others assert attributes |
| Pre-hydration typing | `renderToString` into an `iframe srcdoc`, type with the real keyboard before `hydrateRoot`: the text survives hydration; blurred before hydration → one `"platform"` step + commit; still focused → adopted as the draft, committed at blur. | WebKit may use the keyboard fallback (Combobox L4 rule) |
| Firefox restoration | **Moot, not written**: both inputs are `autocomplete="off"` (6.1), so Firefox restores neither across a reload; Slider's equivalent row mostly logs "not restored" for `srcdoc` frames anyway. Recorded here instead of a row (review S4). | — |
| IME | **Not written** (#77): composition through CDP `Input.imeSetComposition` / `Input.insertText`, or Combobox's browser pattern: the draft follows the composition; Enter during composition does not commit; `compositionend` then Enter commits; a WebKit-style confirming Enter with `keyCode 229` commits nothing. jsdom covers the `isComposing` and `keyCode 229` guards. | Chromium, when written |
| No `startViewTransition` | Spy before a key press, a hold, a typed commit: zero calls (no boundary exists). The rejected-commit case is not written (#77). | none |

Firefox runs the browser files serially (`fileParallelism: false`, #62); the hold row would
otherwise receive another file's pointer input.

Two test hazards the Field rows work around, recorded because they are properties of the
platform and of every Field control rather than of NumberField: a click on Save right after
typing blurs the input on `mousedown`, the Field shows the error (`:user-invalid` after change +
blur) before `mouseup`, and with no reserved space the button moves away from the pointer so no
click happens (the rows tab out first; the Field docs page now says to reserve the error's
space); and Firefox's validation bubble swallows the next click (6.2). The "parent
`useTransition` probe" row of the design is approximated: the step's awaited action keeps
`data-pending`, and the suspending-content rows prove the step renders in a transition.

---

## 15. Implementation notes

```
packages/ui/src/number-field/
  index.ts                        # no directive; namespace + types; imports platform-attributes
  number-field-context.ts         # "use client": NumberFieldContext (state, bounds, stepBase, pendingSource, ids, visibleRef / hiddenRef, step()/commit()/beginHold()/commitDraft(), syncHidden, onItemMounted, field slice)
  number-field-root.tsx           # "use client": useSupersededRejection (one capture for both channels), useControllableAction (commit), useActionTrigger (steps), draft / live / hold / stepHeld / pendingSource, stepBase, formatter + parser (memoised), useFieldValueChange, reconciliation + reset (through hiddenRef), announcements, warnings
  number-field-label.tsx          # "use client": registers its id; for=
  number-field-input.tsx          # "use client": visible input (controlled text, handlers, wheel listener) + hidden input (uncontrolled, ref-written, invalid listener, autocomplete=off), syncHidden after every commit, useFieldControl with validityElement, onItemMounted
  number-field-increment.tsx      # "use client": `useStepButtonElement("increment", ...)`
  number-field-decrement.tsx      # "use client"
  use-step-button.ts              # "use client": the hold (timers, capture, release listeners), the click-without-pointer rule; `useStepButtonElement`, the element both buttons render (`disabledButton`, the owned `aria-label`, `data-*`), and the button prop types
  use-number-field-dev-warnings.ts # "use client": the Root's development warnings
  number-field-format.ts          # no directive: createNumberFormatter(locale, options) → { locale, format, parse, round, fractionDigits, allowsFractions, percent, warning }; the cache
  number-field-arithmetic.ts      # no directive: stepValue, stepBy, boundValue, isAtBound, keyStep (the key-to-step mapping of 4.2); unit-tested in number-field-arithmetic.test.ts
  number-field-format.test.ts, number-field.test.tsx, number-field.browser.test.tsx, number-field.types.test.tsx
packages/ui/src/internal/
  decimal.ts                      # no directive: decimalsOf / gridDecimals / roundTo, shared with Slider
  use-superseded-rejection.ts     # conventions 2.4: called once in the Root, passed as `captureSuperseded` to both hooks
  announce.ts                     # directive-free (#129): announce(target, message, priority?) and canAnnounce(target): ariaNotify only (the fallback live region was dropped, #113 A1); shared with Combobox, focus-first-invalid and Toast
  field-context.ts                # FieldControlRegistration gains `validityElement?: () => ValidatableElement | null`
  use-field-control.ts            # the option, passed through to registerControl
  ../field/field-root.tsx         # reads validity / writes the slot on the validity element, `:user-invalid` on the element, mirrors after the slot write
```

- **Root.** `useControllableAction<number | null, NumberFieldValueChangeDetails>({ controlled:
  value, defaultValue: defaultValue ?? null, action: wrappedCommit, transitionTypes: () =>
  ["fsui-number-field", "fsui-number-field-commit"], warn: { component: "NumberField", prop:
  "value" } })`; `useActionTrigger({ ignoreWhilePending: false, captureSuperseded })` for steps, with
  `captureSuperseded = useSupersededRejection()` called once **before both hooks** and passed to
  `useControllableAction` too (conventions 2.4: a superseded commit's rejection while a step
  pends, or a step's while a commit pends, reaches the boundary without waiting for the other
  channel); `draft`, `live` (+ `liveSet` ref), `hold`,
  `stepHeld`, `pendingSource` as `useState`; `shownRef`, `liveRef`, `committedRef`,
  `gestureStart`, `commitId`, `lastReason` refs; `formatter = useMemo(() =>
  createNumberFormatter(locale, format), [locale, formatKey])` with `formatKey` a stable
  serialisation of `format`; the context value memoised on `shown`, `text`, `pending`,
  `pendingSource`, `hold`, bounds, flags and the stable functions (#48).
- **Input.** Visible: `value={text}`, `onChange` → `setDraft(e.target.value)`, `onKeyDown` →
  4.2 and Enter (`e.nativeEvent.isComposing` guard), `onBlur` → `commitDraft(e.nativeEvent)`;
  a layout effect adds the non-passive `wheel` listener when `stepOnWheel`. Hidden:
  `defaultValue={resetTarget}` (`String` or `""`), a layout effect with no deps that calls
  `syncHidden(shown)` (writes `.value` when different, then mirrors the validity message); a native `invalid`
  listener that `preventDefault()`s; registration with the Root (`registerHidden(el)` from the
  ref callback, returning the cleanup); `useFieldControl({ …, validityElement: () =>
  hiddenRef.current })` with `field.ref` merged into the visible input's ref; the inline
  `hiddenStyle` constant. `syncHidden` lives on the context so `step()` and the Input's effect share one writer.
- **Buttons.** `useStepButton(direction)`: `onPointerDown` (primary button, not disabled) →
  `preventDefault()`, `setPointerCapture`, `beginHold(direction, event)`; the hold's end
  listeners on the element (`pointerup`, `pointercancel`, `lostpointercapture`) and `blur` on
  `window`, attached at the press and detached at the end; `onClick` → if no pointerdown was
  recorded for this activation, `stepOnce(direction, event)` (step + commit); `onContextMenu`
  → `preventDefault()` while holding; `disabled = prop || ctx.disabled || ctx.readOnly ||
  isAtBound(direction)`, rendered through `disabledButton(render, disabled)` (conventions 1.2:
  native `disabled` on a host button, `aria-disabled` on a link or component render).
- **Reconciliation and reset** through `useNativeGroupReconciliation` as 6.4, `element` the
  registered hidden input; `onResetEvent` writes the visible input's `defaultValue`.
- **Announcements**: the Root calls `announceStep()` in `commit()` for `"activate"` commits
  whose `source` is not `"input"`; `announce.ts` as 8.3.
- **Dev warnings**: both / mode switch (hook), `NaN` / `Infinity` value, `min > max`, `lang`
  disagreement, `compact` / significant digits, `render` of the wrong type, a Thumb-style
  "part outside a Root" throw, `aria-label=""` on a button, a `name` on the Input (omitted from
  the type; a `render` element's `name` is a warning: it would post the text).
- **Field side**: `field-root.tsx`'s `validityElementOf(el)` becomes `registration.validityElement?.()
  ?? validityElementOf(el)` for reads and the slot write; the `:user-invalid` read stays on
  `validityElementOf(el)` (the registered element when it is a control); after
  `setCustomValidity` on a distinct validity element, `el.setCustomValidity(validityEl.validationMessage)`.
  Combobox, Slider and the native controls pass no `validityElement`, so nothing changes for them.
- **Docs site and example app.** Playground: a cart quantity with `+` / `−`, a fake 800 ms save
  and a failure toggle (rollback visible with an update-on-success parent), a euro price under
  `locale="de-DE"` with a locale switcher (`en-US`, `de-DE`, `fr-FR`, `ar-EG`), a percent field,
  a `Form.Root` with `min` / `max` / `step` errors and a server error. Docs page
  `packages/docs/src/pages/NumberFieldPage.tsx` at `/components/number-field` (nav entry after
  Slider in `navigation.ts` and the route in `App.tsx`), examples `NumberFieldQuantity.tsx`,
  `NumberFieldFormats.tsx`, `NumberFieldField.tsx` and `number-field.css` in `src/examples/`,
  with: the two-action table (Slider's, first concept), "typed text is committed on blur and
  Enter, never per keystroke", the parsing rules (strict grouping, percent, the locale
  warning and "pass `locale`"), the no-clamp rule with the hidden input's constraints, the
  keyboard table, the hold timing, the `stepOnWheel` note, the accessibility section (no
  spinbutton, why; the announcements; the two built-in labels and their override), the props
  tables for the five parts (hand-written from the declarations), the CSS recipe of 9.2, and
  the error section's sentences from Slider. `FieldPage.tsx`'s "FUNSTACK controls" list gains
  NumberField with the `validity.stepMismatch` example; `RoadmapPage.tsx` gains the entry.

---

## Review corrections (#67, 2026-10-18)

From `memo/reviewer/number-field.md` (review of c31588b..5fe8ae6, verdict "acceptable with
minor fixes") and the developer's notes in `memo/developer/number-field.md` ("Deviations" and
"Review fixes"); the fixes are in 6742cb0 (code and tests) and 36b48f4 (docs). Each item is
folded into the sections named; this table is the audit trail. The architect agrees with every
deviation the reviewer accepted; none is corrected here.

| Item | Correction | Section |
| --- | --- | --- |
| M1 | **Hydration overwrote a focused partial draft.** `readCurrent` parsed before it checked focus, so a user still typing `12,` or `-` at hydration had the text reset under the caret. Now the focus check comes first: a focused input's differing text is adopted as the draft whatever it parses to, and the blur resolves it. jsdom row added. | 4.5, 12.6, 14.1 |
| S1 | **A WebKit composition-confirming Enter committed the draft**: `compositionend` fires before that keydown, which has `isComposing === false` and `keyCode === 229`. Both are now checked (Combobox's guard). | 4.1, 14.1 |
| S2 | **Shift+Home / Shift+End jumped to the bound** instead of selecting text. Left to the browser when `shiftKey`; Shift+Arrow stays `largeStep`. | Decisions 8, 4.2, 14.1 |
| S3 | **The buttons' `disabled` ignored an open draft** while a press steps from it: `defaultValue 99, max 99`, type `50` → `+` stayed disabled. The Root derives `stepBase` (the parsed draft, else the shown value) and the buttons' bound follows it. | Decisions 9, 2.4, 3.3, 4.3, 14.1 |
| S4 | **Browser rows not written** (touch hold, IME, the Chromium "not focusable" console check through CDP `Log`, the rejected-commit `startViewTransition` case) are tracked in **#77**; the Firefox restoration row is moot (`autocomplete="off"` on both inputs) and is recorded in 6.1 and 14.2 instead. | 6.1, 14.2 |
| N1 | **Stepping did not round to the format**: `step 0.001` in a `EUR` field showed `€1.00` and posted `1.001`. `step()` rounds through `formatter.round`, so 5.4 holds for stepped values too. | Decisions 6, 2.4, 5.4, 5.5, 14.1 |
| N2 | **The hidden input lacked `autocomplete="off"`**: form-state restoration could restore it but not the visible text, posting an unseen value before hydration. Added; the restoration row is moot. | Decisions 11, 14; 6.1, 14.2 |
| N3 | **Affixes were replaced anywhere in the text**, so `1€234` under `fr-FR` became `1234` (the replacement space is a group separator there). Affixes and literals are stripped at the edges only (and inside the sign and parentheses); in the middle the text is unparsable. | Decisions 7, 5.3, 14.1 |
| N4 | **The fallback region was written in the task it was inserted** and a repeated text was not a change. It is cleared, written 100 ms later and cleared after a second. Superseded by #113 A1: the fallback region was dropped. | 8.3, 14.1, 15 |
| N5 | `onCompositionStart` / `onCompositionEnd` pass through `NumberField.Input` (the library installs neither); the details JSDoc and the docs say `event` is `undefined` on hold repeats and at a bound-ended hold. | 1, 2.4, 3.2, 14.1 |
| Deviations 1 to 11 | Accepted by the reviewer and folded: (1) End → the largest grid point `≤ max`; (2) an empty value skips the against-direction rule; (3) the hydration re-sync writes `visible.value` directly; (4) no hidden-input registry, refs through context with `onItemMounted`; (5) the parser's affix-level leniencies and bidi stripping; (6) `event` undefined on hold ticks; (7) Ctrl / Meta combinations not handled; (8) `deltaY === 0` ignored; (9) a consumer `aria-labelledby` omits the default `aria-label`; (10) a commit while `disabled` / `readOnly` clears the draft; (11) the percent test row needs `maximumFractionDigits: 1` for `0.5 → 0.005`. | 4.1, 4.2, 4.3, 4.4, 4.5, 5.3, 5.4, 5.5, 6.1, 8.4, 14.1 |
| Reports | **Firefox's bubble and `:user-invalid` persist while the user types a fix** (validity follows the committed value): recorded as a known difference in 6.2 with an open question below, no change now. **Implicit submission needs a submit button** (the hidden number input is a second field): correct platform behaviour, documented in 4.1 and on the docs page. **The Field layout shift under a click** is a property of every Field control; the Field docs page notes it, the rows tab out first. **Combobox and `focus-first-invalid.ts` keep their own announcements**; migrating them onto `announce.ts` is the optional part of #77 (done at #129). | 4.1, 6.2, 8.3, 14.2 |

## Open question (resolved)

- **Should validity follow the draft while the user types a fix?** Today the visible input's
  validity changes at commit (6.2), so an invalid field stays `:user-invalid` (and, in Firefox,
  keeps its bubble) until blur or Enter, where a native number input re-validates per
  keystroke. Making the mirror follow the draft would mean parsing per keystroke and writing
  the hidden input's value (or a parallel custom message) on every `input` event: the
  per-keystroke parse the commit model deliberately avoids (2.1), with `validate` then seeing
  drafts too. The architect's view: leave it; the `:user-invalid` styling is the consumer's and
  the Firefox bubble appears only for a bare form outside a Field. Worth a product-owner
  decision only if user feedback names it.

  **Resolved (product owner and user, 2026-10-18): leave it.** Validity keeps following the committed
  value. Revisit only if user feedback asks for it.

## Conventions feedback (applied to `design/conventions.md` 2026-10-18, 29a94c5)

All twelve items below are applied (conventions resolved question 33; the Field amendment is
in `design/components/field-form.md`); the list is kept as the record of what changed and why.

1. **1.1 part vocabulary.** Add `Increment` / `Decrement`: "`button[type=button][tabindex=-1]`
   that steps a numeric value, with press-and-hold (NumberField); `aria-controls` → the field's
   input; natively `disabled` when the next step would change nothing." Widen `Input` with "the
   visible text field of a NumberField (`input[type=text][inputmode]`, the owner surface for
   `data-pending`, with the urgent draft text), which renders the hidden native number input
   right after it"; `Label` with "for NumberField it renders `label[for]` naming the visible
   input and its id names the Root group"; `Root` with "NumberField's is a `div[role=group]`".
2. **1.1 one element per part: a second exception.** "A part whose user surface is itself a
   native input and whose form control must be a different element renders the control as a
   **visually hidden sibling immediately after it** (`NumberField.Input`): `ref` goes to the
   visible input, a documented `hiddenInputRef` to the control, and the props the control
   needs (`name`, `form`, `min`, `max`, `step`, `required`) are listed as forwarded to it."
3. **2.6 / 3.2 urgent states.** Add "the draft text of a NumberField: internal, written from
   the `input` event, with no `UrgentChangeAction` and no triple (the text is not a value until
   it is parsed at commit)"; and reuse Slider's `live` rule for "the value under a held button".
4. **3.5 residual paths / 3.8 rule 6.** Add "text typed into the visible input before
   hydration (NumberField) is parsed and dispatched as a `"platform"` step + commit at mount,
   or adopted as the draft when the input is still focused"; and the hidden-input shape: "a
   library-owned native input that is **not the user's surface** may be **uncontrolled**, with
   `defaultValue` as the reset target (react-dom keeps it in the `value` attribute and updates
   it when the prop changes) and its `.value` written through the ref at every change and
   re-applied after every commit (NumberField's hidden number input); the platform's own reset
   then applies to it and it needs no `onResetEvent` mirror. A controlled `value` would make
   react-dom rewrite the attribute on every update."
5. **3.6 the custom-validity slot.** Add: "A control whose **user surface** and **validity
   element** differ (NumberField: the visible text input and the hidden number input) keeps the
   Field's slot on the validity element, and both the Field (after each slot write) and the
   control (after each value write) mirror `validityElement.validationMessage` into the
   surface's own slot (`setCustomValidity`), so the surface is invalid exactly when the control
   is, with the platform's message, and the platform's report UI, `:user-invalid` and the
   Field's focus land on the surface. The surface carries no native constraint of its own."
6. **3.8 `useFieldControl` / `FieldControlRegistration`.** Add `validityElement?: () =>
   ValidatableElement | null`: "where `validity`, `validationMessage` and the slot are read and
   written when that is not the registered element; `:user-invalid`, the listeners and the
   focus target stay on the registered element; the Field mirrors after writing the slot
   (3.6)". Add the NumberField rows to the `useFieldControl` and `useFieldValueChange` tables
   (the Input registers the visible input, `labelable: true`, with the hidden input as the
   validity element; `useFieldValueChange(optimistic, edit = "activate")`).
7. **4.1 vocabulary.** `pending` gains "`NumberField.Increment` / `Decrement`: the button the
   latest step or commit came from"; `disabled` gains "a NumberField button at its bound". No
   new attribute.
8. **5.1 / 5.3.** NumberField joins Select and Slider as a component with no `transition` prop;
   types `fsui-number-field`, `fsui-number-field-change` (step), `fsui-number-field-commit`
   (gesture).
9. **8 (`ariaNotify`).** Record the second user and the fallback: "`internal/announce.ts`
   speaks through `ariaNotify()` where it exists and otherwise through one module-level
   `role="status"` live region in `document.body` (NumberField's step announcements); a
   component announcing through it renders no live region of its own." (Superseded by #113 A1:
   no fallback region; conventions 8 now says `ariaNotify()` only.)
10. **10.1 test rows.** The "Inside a Field" row lists NumberField; the "Continuous control" row
    applies to the hold; the "Platform path" row gains "for a control with a hidden native
    input, every path leaves the hidden value equal to the shown value".
11. **11 built-in strings.** NumberField adds two **static** strings, `"Increase"` and
    `"Decrease"` (the buttons' default `aria-label`s), overridden through the ordinary
    `aria-label` / `aria-labelledby` pass-through, Toast's region-name rule; the announced
    value is the formatted text (not a library string), overridable through `announce(value,
    state)`; **no `aria-roledescription`** and no string for it.
12. **7.1.** `number-field-format.ts`, `number-field-arithmetic.ts` and `internal/decimal.ts`
    are directive-free modules (the arithmetic precedent of Slider).

---

## For the product owner

Genuine product decisions, with recommendations; none blocks implementation except item 10,
which needs the conventions owner.

1. **Two actions with Slider's semantics** (decisions 2 to 5, section 2): `valueChangeAction`
   per step, `valueCommitAction` per gesture committing uncontrolled state, a typed value
   firing both. Alternative: one `valueChangeAction` per gesture with the hold previewed
   internally (one prop fewer; no step channel for a live total; a later pair would change the
   prop's meaning). **Recommendation: as designed.**
2. **Typed text is committed on blur and Enter, never per keystroke, and the draft is
   internal** (decision 4, 2.1, no `inputValue` triple). Alternative: Base UI's per-keystroke
   parsed value. **Recommendation: as designed**; the triple can be added later without a
   breaking change.
3. **Typed values are neither clamped nor snapped** (5.6): `min` / `max` / `step` are native
   constraints with the browser's message; stepping clamps and snaps. Alternative: clamp (and
   snap) on commit as Base UI and React Aria do. **Recommendation: platform.**
4. **Unparsable text reverts silently at commit** (4.1), React Aria's rule. Alternative: keep
   the text and show a built-in "Enter a number" message (a third built-in string; the hidden
   input cannot be made `badInput`). **Recommendation: revert in v1**, revisit if the docs
   feedback asks.
5. **Strict grouping in the parser** (5.3): `1,5` under `en` is unparsable, not `15`.
   Alternative: strip every group separator (React Aria, Base UI, Chromium's native input).
   **Recommendation: strict**; a reverted draft beats a silently wrong order of magnitude.
6. **Rounding to the format's `maximumFractionDigits` on commit** (5.4): what the user sees is
   what the form posts. Alternative: keep full precision in the value and let the text differ.
   **Recommendation: round.**
7. **`locale` defaults to the runtime locale with a dev warning when the document's `lang`
   disagrees** (5.1); no `lang` auto-detection (it cannot run on the server). Alternative:
   detect `document.documentElement.lang` through `useSyncExternalStore` with a post-hydration
   re-render (a flash on every server-rendered page that does not pass `locale`).
   **Recommendation: as designed.**
8. **No `aria-roledescription`; `role="group"` on the Root; buttons named `"Increase"` /
   `"Decrease"` as static built-in strings overridden by `aria-label`** (8.2, 8.4). Alternative
   for the name: React Aria's "Increase Quantity" through `aria-labelledby`. **Recommendation:
   as designed** (the group gives the context once; the product owner's lean on the role
   description is confirmed by the role-name argument).
9. **Wheel: `stepOnWheel`, off by default, each event a one-step gesture** (4.4), and **the hold
   timing 400 / 60 ms with no focus move** (4.3). **Recommendation: as designed.**
10. **The Field contract gains `validityElement`** with the Field-side mirror (proposals 5 and
    6, section 7). This is the one item that touches another component's accepted design and
    needs the conventions owner's acceptance; without it NumberField inside a Field cannot show
    `stepMismatch` / `rangeOverflow` (the Field would read the visible input's `customError`
    only) and the Field's slot write would erase the mirror. **Recommendation: accept**; the
    change is one optional registration field and one line in the Field's slot write, and no
    existing control is affected.
11. **The hidden number input is uncontrolled with `defaultValue` as the reset target**
    (6.1, proposal 4), a new shape next to the controlled-value-input mirror of Slider and
    Combobox. Alternative: controlled + `onResetEvent` mirror. **Recommendation: uncontrolled**;
    the platform resets it, react-dom keeps the attribute, and no `value` + `defaultValue`
    warning.
12. **The announcement fallback is a module-level live region** (8.3, `internal/announce.ts`)
    for engines without `ariaNotify`. Alternative: no fallback (Combobox's current rule).
    **Recommendation: the region**, since the product owner asked for a fallback; Combobox may
    migrate to the helper as an implementation choice. (Superseded by #113 A1: the region was
    dropped under the no-fallbacks policy, 8.3.)
13. **In v1**: `largeStep` with PageUp / PageDown and Shift+Arrow, `format` of style `decimal`,
    `percent` (default `step` `0.01`), `currency`, `unit`; **not in v1**: `smallStep`,
    `step="any"`, a scrub area, Escape reverting, iPhone `inputmode="text"`, `compact` parsing
    (section 13). **Recommendation: as listed.**
14. **Conventions proposals 1 to 12** to be applied by the conventions owner on acceptance.

**Accepted by the product owner (2026-10-18):** recommendations 1-14 are accepted as written.
- Item 3, platform constraints instead of clamping typed values: accepted. Typed values stay as typed, and the browser's validity message reports them.
- Item 5, strict grouping in the parser: accepted.
- Item 10, the `validityElement` addition to the Field contract: accepted. The conventions owner (design-toolbar) applies it together with proposals 1-12.
