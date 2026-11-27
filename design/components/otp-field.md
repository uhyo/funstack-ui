# OTPField

Status: **decided and implemented** (#171, part of #162). The decisions, the implementation
amendments, the probe results and the device checks still owed are in the 2026-11-26 #171
entries of `design/CHANGELOG.md`. Follows `design/conventions.md`; where this document and the
conventions disagree, the conventions win. **Provisional until the device checks are done**: the
Input's inline style list (section 6) and the composition rule (section 4.1). The Root's
`dir="ltr"` default (section 4.4, #172) is decided and implemented; its three-engine probe is
the 2026-11-27 #188 entry of `design/CHANGELOG.md`.

Inputs: `docs/vision.md`, `design/conventions.md` (1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 2.6, 3.6, 4.1,
5, 8, 11), `design/components/field-form.md` (4.3: text is a fact; 7.1: `useFieldControl`,
`useFieldValueChange`), `design/components/number-field.md` (the draft text, mount
reconciliation, the two-input exception this design does **not** need), HTML
(`autocomplete="one-time-code"`, `inputmode`, `pattern`, implicit submission), the WebOTP API
(`OTPCredential`), browser-compat-data 8.1.11 of 2026-11-26 (Chrome 158, Firefox 161, Safari
27.2), prior art (input-otp, which shadcn/ui uses; Base UI 1.9 `OTPField`; Radix
`unstable_OneTimePasswordField`; Ark UI `PinInput`; React Aria, Headless UI and Ariakit have
none), notes in `memo/architect/avatar-scrollarea-otp-notes.md`.

A field for a short code the user received elsewhere: an SMS or email verification code, an
authenticator's six digits, a PIN. It looks like a row of boxes and is **one text input**. The
browser owns the text, as it does for every text input: typing, paste, autofill from an SMS and
a password manager all arrive as edits of that input. The library adds the row of boxes, the
filter that keeps the text a code, and the Async React half: **the moment the code is complete
is a request**, `completeAction`, run in a transition with `data-pending`.

## Decisions at a glance

| # | Topic | Decision |
| --- | --- | --- |
| 1 | One input | `OTPField.Input` is a single `<input type="text" autocomplete="one-time-code">` that covers the whole field with transparent text. The boxes are `OTPField.Slot` spans drawn from the input's text, `aria-hidden`. Not N inputs (section 2). |
| 2 | Anatomy | `OTPField.Root` (`div`, owns state), `OTPField.Input` (`input`), `OTPField.Slot` (`span`, explicit `index`). No `Label` part: a `<label for>`, `Field.Label` or `aria-label` names the one input. No hidden input. |
| 3 | The text is a fact | `value` / `defaultValue` / `onValueChange` (`UrgentChangeHandler`): the urgent lane of conventions 2.6, as Combobox's `inputValue`. No `valueChangeAction`: a keystroke cannot be held or rolled back. |
| 4 | Completion is a request | `completeAction(value, details)` runs in the Root's transition each time an edit leaves the value complete: awaited, `data-pending` on Root and Input, a rejection goes to the Error Boundary. Nothing is rolled back (the code stays typed), and the field is never disabled while pending. |
| 5 | The filter | Every `input` event is normalised: characters outside `charset` are dropped (so a pasted `123 456` or `123-456` is `123456`), the text is cut to `length`, and typing over a filled position **replaces** it. The browser performs the edit; the library rewrites the result. No `maxlength` (it would cut a paste before the filter sees it). |
| 6 | Forms | The input is the form control: `name`, `form`, `required` and a derived `pattern` on the one element, so `FormData`, reset and constraint validation are native. `submitOnComplete` calls `form.requestSubmit()` on completion. |
| 7 | In a Field | The Input registers itself through `useFieldControl` exactly as `Field.Control` does: labelable, its own validity element. **Not a NumberField-like two-input model**: the visible text is the form value (section 7). |
| 8 | Autofill | `autocomplete="one-time-code"` and `inputmode` are all iOS, Android keyboards and password managers need, because there is one real input. WebOTP (`navigator.credentials.get({ otp })`) is opt-in behind `experimental_webOTP`: Firefox has no implementation. |
| 9 | Exposure | Root and Input: `data-complete`, `data-pending`, `data-disabled`, `data-invalid` (Field). Slot: `data-index`, `data-filled`, `data-active` (the caret or the selection is here, while focused). |
| 10 | ViewTransition | No `transition` prop. The completion's transition carries the types `fsui-otp-field` and `fsui-otp-field-complete` for a consumer's own boundary (the next screen). |
| 11 | SSR | Every part file is `"use client"`; the filter is a directive-free module. The server HTML is the input and the slots with the default value. Before hydration typing works and is adopted at mount; the typed characters are not visible until then (section 9). |
| 12 | Not in v1 | A mask, a custom character rule, a normaliser prop, per-slot placeholders as a prop, room for a password manager's badge (section 12). |
| 13 | Direction | `OTPField.Root` renders `dir="ltr"` unless the consumer passes `dir`: a code is read left to right in every locale, so the boxes, the text and the caret keys stay left to right inside an RTL page (section 4.4, conventions 14.1). |

---

## 1. Anatomy

```tsx
import { OTPField } from "@funstack/ui/otp-field";
import { Separator } from "@funstack/ui/separator";

<label htmlFor="code">Verification code</label>
<OTPField.Root length={6} completeAction={verifyCode} className="otp">
  <OTPField.Input id="code" className="otp-input" />
  <OTPField.Slot index={0} className="otp-slot" />
  <OTPField.Slot index={1} className="otp-slot" />
  <OTPField.Slot index={2} className="otp-slot" />
  <Separator decorative orientation="vertical" />
  <OTPField.Slot index={3} className="otp-slot" />
  <OTPField.Slot index={4} className="otp-slot" />
  <OTPField.Slot index={5} className="otp-slot" />
</OTPField.Root>
```

Rendered HTML after the user typed `12` (focused; the Input's inline style abbreviated):

```html
<label for="code">Verification code</label>
<div class="otp" dir="ltr" style="position: relative">
  <input id="code" class="otp-input" type="text" value="12"
         autocomplete="one-time-code" inputmode="numeric" pattern="[0-9]{6}"
         autocapitalize="off" autocorrect="off" spellcheck="false"
         style="position: absolute; inset: 0; …; color: transparent; caret-color: transparent">
  <span class="otp-slot" aria-hidden="true" data-index="0" data-filled>1</span>
  <span class="otp-slot" aria-hidden="true" data-index="1" data-filled>2</span>
  <span class="otp-slot" aria-hidden="true" data-index="2" data-active></span>
  <hr role="none" data-orientation="vertical">
  <span class="otp-slot" aria-hidden="true" data-index="3"></span>
  <span class="otp-slot" aria-hidden="true" data-index="4"></span>
  <span class="otp-slot" aria-hidden="true" data-index="5"></span>
</div>
```

| Part | Element | Role | Renders from | Notes |
| --- | --- | --- | --- | --- |
| `Root` | `div` | none | value, pending | Owns the text state, the completion transition, the slot registry and the Field registration. Inline `position: relative`: it is the box the Input covers. `dir="ltr"` unless the consumer passes `dir` (4.4). `data-complete`, `data-pending`, `data-disabled`, `data-invalid`. |
| `Input` | `input[type=text]` | `textbox` | value, pending | The only focusable and the only thing assistive technology sees. Covers the Root (inline style, section 6). `value`, `autocomplete="one-time-code"`, `inputmode`, `pattern`, `name`, `form`, `required`, `disabled`, `readonly` from the Root; the Field's attributes. Same data attributes as the Root. |
| `Slot` | `span` | none, `aria-hidden="true"` | value, selection | One character position. Default children: the character at `index`, or nothing. `data-index`, `data-filled`, `data-active`. Not focusable and never the pointer's target: the Input lies over it. |

Why this shape:

- **The Root is the box**, not a wrapper around label, box and message. A field has one
  control, so nothing needs a `group`; the label and the description are the Field's, or the
  consumer's own elements, and sit outside. A `Label` part would exist only to carry `for`
  (NumberField's and Combobox's also name a group or a popup, which is why they are parts).
- **Slots are explicit**, with an `index`, as `Slider.Thumb` is. The consumer decides the
  grouping (three, a line, three) with ordinary elements between them, which a `count`-driven
  renderer could not offer without a separator prop. A missing or repeated index among the
  mounted Slots is a development warning.
- **A Slot is `aria-hidden`.** The input already says everything ("Verification code, edit
  text, 1 2"). Exposed slots would read the code a second time, character by character.

## 2. One input, not N

| | One input, drawn slots (this design; input-otp) | N inputs (Base UI, Radix, Ark UI) |
| --- | --- | --- |
| Screen reader | one labelled text field | N text fields; every one needs its own name ("Character 2 of 6", a built-in string the library would have to ship and localise) |
| SMS and password-manager autofill | the platform's, unchanged: one field receives the whole code | the first input receives the code; the library must spread it |
| Paste | native, then the filter | intercepted and spread |
| Backspace, arrows, Home / End, select all | native text editing | reimplemented as focus moves between inputs |
| Form value, `required`, `pattern`, reset | the input's own | a hidden input that mirrors the N visible ones |
| Inside a Field | `Field.Control`'s contract | NumberField's two-element contract |
| Before hydration, without JavaScript | a working text input | N inputs with no logic: one character each, by hand |
| Cost | the text is transparent, so the caret and the selection are drawn by the Slots; pointer position is mapped to a slot by the library | none of that |

Principle 5 of the vision decides it: one input is the platform's control doing the platform's
job, and the library's part is presentation. The cost in the last row is real and is the
subject of sections 4 and 6.

A third shape was weighed: a **visible** input whose own text is spread over the boxes with
`letter-spacing` and tabular digits, with the boxes drawn behind it. It needs no drawn caret
at all. Rejected: the pitch must be uniform (no gap between groups of three), letters need a
monospaced font, and a user stylesheet that overrides `letter-spacing` (WCAG 1.4.12) moves
every character out of its box.

## 3. Props and types

```ts
export type OTPFieldCharset = "numeric" | "alphanumeric" | "alphabetic";

export interface OTPFieldValueChangeDetails extends ActionDetails {
  /** `"activate"`: the user edited the text. `"platform"`: a form reset, text adopted at hydration, a WebOTP fill. */
  readonly reason: ChangeReason;
}
export interface OTPFieldCompleteDetails extends ActionDetails {
  /** `"activate"`: an edit (typing, paste, keyboard autofill). `"platform"`: a WebOTP fill (`event` is `undefined`). */
  readonly reason: ChangeReason;
}

export interface OTPFieldState {
  /** The text shown, already filtered: at most `length` characters of `charset`. */
  readonly value: string;
  readonly length: number;
  /** `value.length === length`. */
  readonly complete: boolean;
  /** A `completeAction` is in flight. */
  readonly pending: boolean;
  readonly disabled: boolean;
  readonly readOnly: boolean;
  /** Inside a `Field.Root`: an error is shown for the field. `false` outside. */
  readonly invalid: boolean;
}

export interface OTPFieldSlotState extends OTPFieldState {
  readonly index: number;
  /** The character at `index`, or `null`. */
  readonly char: string | null;
  readonly filled: boolean;
  /** The input is focused and the caret, or part of the selection, is at this position. */
  readonly active: boolean;
}

export interface OTPFieldRootProps
  extends Omit<ComponentPropsWithRef<"div">, "className" | "style" | "children" | "defaultValue"> {
  /** The number of characters in a complete code. */
  length: number;
  /**
   * Which characters a code may contain; also picks `inputmode` and `pattern`.
   *
   * @defaultValue `"numeric"`
   */
  charset?: OTPFieldCharset;
  value?: string;
  defaultValue?: string;
  /** The text changed. A fact: called synchronously, outside any transition, not awaited. */
  onValueChange?: UrgentChangeHandler<string, OTPFieldValueChangeDetails>;
  /** An edit left the code complete. A request: run in the Root's transition and awaited. */
  completeAction?: Action<[value: string, details: OTPFieldCompleteDetails]>;
  /**
   * Submit the Input's form (`requestSubmit()`) when an edit leaves the code complete.
   *
   * @defaultValue `false`
   */
  submitOnComplete?: boolean;
  name?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  /**
   * The native attribute, with a library default: a code is read left to right in every
   * locale. Pass `"rtl"` for a code that is not (section 4.4).
   *
   * @defaultValue `"ltr"`
   */
  dir?: ComponentPropsWithRef<"div">["dir"];
  /** Ask the browser for the code of an origin-bound SMS (WebOTP). Section 8. */
  experimental_webOTP?: boolean;
  className?: StateValue<string | undefined, OTPFieldState>;
  style?: StateValue<CSSProperties | undefined, OTPFieldState>;
  children?: StateValue<ReactNode, OTPFieldState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, OTPFieldState>;
}

export interface OTPFieldInputProps
  extends Omit<
    ComponentPropsWithRef<"input">,
    | "type" | "value" | "defaultValue" | "maxLength" | "minLength" | "pattern"
    | "name" | "form" | "required" | "disabled" | "readOnly" | "onChange"
    | "className" | "style" | "children"
  > {
  className?: StateValue<string | undefined, OTPFieldState>;
  style?: StateValue<CSSProperties | undefined, OTPFieldState>;
  render?: RenderProp<ComponentPropsWithRef<"input">, OTPFieldState>;
}

export interface OTPFieldSlotProps
  extends Omit<ComponentPropsWithRef<"span">, "className" | "style" | "children"> {
  /** Which character position this slot shows, from `0`. */
  index: number;
  className?: StateValue<string | undefined, OTPFieldSlotState>;
  style?: StateValue<CSSProperties | undefined, OTPFieldSlotState>;
  /** Default: the character. A function draws a placeholder, a dot, a caret element. */
  children?: StateValue<ReactNode, OTPFieldSlotState>;
  render?: RenderProp<ComponentPropsWithRef<"span">, OTPFieldSlotState>;
}

export const OTPField: {
  Root: (props: OTPFieldRootProps) => ReactNode;
  Input: (props: OTPFieldInputProps) => ReactNode;
  Slot: (props: OTPFieldSlotProps) => ReactNode;
};
```

What the Input renders by default, per `charset` (a consumer's `inputMode`, `autoComplete`,
`autoCapitalize` or `enterKeyHint` on the Input replaces the default; `autoComplete="off"` is
the spelling for a PIN that is not a one-time code):

| `charset` | Kept characters | `inputmode` | `pattern` (for `length={6}`) |
| --- | --- | --- | --- |
| `"numeric"` | ASCII digits; full-width digits are converted | `numeric` | `[0-9]{6}` |
| `"alphanumeric"` | ASCII letters and digits | `text` | `[A-Za-z0-9]{6}` |
| `"alphabetic"` | ASCII letters | `text` | `[A-Za-z]{6}` |

Always: `type="text"` (a number input drops leading zeros and has no selection API),
`autocomplete="one-time-code"`, `autocapitalize="off"`, `autocorrect="off"`,
`spellcheck="false"`. Case is kept as typed; the server compares as it sees fit.

Where the props live: the constraints and the form wiring are on the **Root** (it owns the
state the Slots read, and the Field registration), everything that is about the element (`id`,
`aria-label`, `aria-describedby`, `autoFocus`, `title`, `ref`) is on the **Input**.

Owned keys (conventions 1.2). Root: `data-*` above; `position` in `style` unless the consumer
sets it. Input: `type`, `value`, `pattern`, `name`, `form`, `required`, `disabled`, `readOnly`,
the library's `onChange` (omitted from the props type, conventions 1.5) and its native
listeners (`beforeinput`, `compositionstart` / `compositionend`, `selectionchange`, `select`,
`focus`, `keyup`, `blur`, `click`, through `addEventListener`, so the consumer's `on*` props
for those events pass through and run independently), the inline style of section 6, the
Field's attributes, `data-*`. Slot: `aria-hidden`, `pointer-events: none` in `style` (section 6), `data-index`, `data-filled`, `data-active`
(the Root's `data-pending`, `data-complete`, `data-invalid` style the Slots from above:
`.otp[data-pending] .otp-slot`).

### 3.1 `completeAction`, and why it is named so

Conventions 2.1 has three action names: `<state>ChangeAction`, bare `action` for a pure
trigger, `<state>CommitAction` for the end of a gesture on a continuous control. Completion is
a pure trigger: nothing changes that could be rolled back, the user's code is already in the
input. The three candidate names:

- **`completeAction`** (decided). The vision's own form, "`action` or `fooAction`
  (`clickAction`)": the action named after the event that triggers it. It reads correctly at
  the call site and leaves `action` free of doubt on a part that lives inside forms.
- `action`. The existing name for a pure trigger, but `<OTPField.Root action={verify}>` reads
  as a form's `action`, and it could not be told from one in a `render={<form />}`.
- `valueCommitAction`. The existing name for "once per gesture", but a Slider and a
  NumberField commit **every** gesture's value, partial or not, and their commit decides the
  uncontrolled state. This one fires only for a complete code and decides nothing.

The name has its row in conventions 2.1: a pure trigger that carries a value, named after its
event, `<event>Action`, `(value, details)`.

The contract is conventions 2.3 with these particulars:

- **When.** After each `input` event (and each WebOTP fill) that leaves `value.length ===
  length` **and** either changed the value or inserted at least one character the filter kept:
  an edit that replaces one character of a complete code (with the same character too) and a
  paste of the same code again (the way to retry) run it; a character the filter drops (a
  letter typed into a complete numeric code) does not. Not at mount, not for text adopted at
  hydration, not for a controlled `value` the parent changed, not for a reset, not while
  `disabled` or `readOnly`. Without a `completeAction` nothing is run (no empty transition).
- **Sync prefix.** Runs during the `input` event dispatch, in the transition; a `setState`
  there is a transition update.
- **Pending.** `data-pending` on Root and Input until every run has settled and its render has
  committed. The input stays enabled and editable (conventions 2.3 item 9, 3.6).
- **Overlap.** A second completion while the first is pending is a different code, so it
  always runs: there is no `whilePending` prop, because `"ignore"` would drop what the user
  typed. Runs are concurrent; an action that must not act on a stale code compares it with
  the current one after its `await`.
- **Errors.** A rejection reaches the nearest Error Boundary (conventions 2.4). A wrong code is
  not an error: the action resolves and the consumer shows the message.
- **`submitOnComplete`** calls `requestSubmit()` on the Input's form right after dispatching
  `completeAction` (which it does not await), in the same event. Inside a Field it first asks
  the Field to re-validate (`notifyChange(true)`): the Field's own `input` listener ran
  `validate` on the browser's text before the filter's write-back, and the commit that
  re-validates comes after the event. While a composition is open the submission is held and
  made at `compositionend` (the IME has not committed the text; a cancelled composition then
  submits nothing). Constraint validation runs as for any submission; the submission is the form's channel (conventions 2.7), with
  `Form.Root`'s pending, errors and reset. Nothing happens without a form or before hydration.

### 3.2 `value`, `defaultValue`, `onValueChange`

The gate of conventions 2.1 for a new `on*` handler: *who performs the change, and why can the
library not hold it?* The browser performs it (a keystroke, a paste, an autofill, in a text
input), and React requires a controlled text input to follow it synchronously. It is the same
fact as Combobox's `onInputValueChange`. The state is called `value` because it is the field's
only state and its form value.

- Uncontrolled: the Root's `useState`, initial `defaultValue` (filtered).
- Controlled: `value` follows the DOM and does not gate it (conventions 2.6). A controlled
  `value` that the filter would change is a development warning and is rendered filtered.
- `onValueChange(next, details)` is called for every change of the filtered text: an edit
  (`"activate"`), and a reset, hydration adoption or WebOTP fill (`"platform"`). It is called
  **before** `completeAction` for the same edit.
- Clearing after a wrong code is the controlled form: `setCode("")` in the action. After an
  `await` that is an urgent update, which is what a text input needs.

## 4. Editing

The browser edits the input; the library reads the result in the `input` event and, where the
filtered result differs from what the browser left, writes it back (text and caret). Nothing is
`preventDefault()`ed, so the Field, the form and the browser's autofill all see ordinary input
events.

### 4.1 The filter

The Input records `{ text, selectionStart, selectionEnd }` in `beforeinput`. In `input`, with
`dom` the input's text and `caret` its `selectionStart`:

1. **Inserted run.** For an insertion (`inputType` starting with `insert`), `run` is what the
   browser put between the text before the selection and the text after it: `dom` must start
   with `before[0, start)` and end with `before[end, …)`, and `run` is what lies between
   (independent of where the engine left the caret). Filtered by `charset` to `kept`. When
   `dom` does not have that shape, rule 6 applies.
2. **A full code replaces everything.** `kept.length >= length`: `next = kept.slice(0,
   length)`. Pasting a code into a half-typed field does not append to the half.
3. **A selected range is replaced** (the browser already did it): `next = before[0, start) +
   kept + before[end, …)`.
3a. **An insertion the filter drops entirely** (`kept` is empty: a letter in a numeric field,
   over a caret or a selection) leaves the text as it was before the edit and restores the
   selection: "no feedback beyond the text not changing" (4.2).
4. **A collapsed caret overtypes**: `next = before[0, start) + kept + before[start +
   kept.length, …)`. Typing on a filled position replaces it and moves on, which is what a row
   of boxes suggests; at the end of the text it appends.
5. **A complete code with the caret at its end** treats the last position as the caret's:
   typing replaces the last character.
6. **A deletion, and an `input` with no `beforeinput` before it** (autofill in some engines):
   `next = filter(dom)`.
7. `next` is cut to `length`. The caret goes to `min(start + kept.length, length)`; for rule 6
   it keeps its place among the characters the filter kept before it.

The write-back happens in the `input` event, before React's re-render: the library assigns
`input.value` and calls `setSelectionRange()` only where the result differs from what the
browser left, then sets its state; the re-render finds the DOM already equal and writes
nothing, so the caret stays where the library put it (verified in three engines).

The filter is a pure function of `(before, dom, caret, inputType, charset, length)` in a
directive-free module with its own unit tests.

**Composition.** While composing (between `compositionstart` and `compositionend`, or an
`input` with `isComposing`), the library does not write to the input (it would end the
composition): the Input renders the raw text it holds, not the value. The value is still
derived from each `input` event (`filter(dom)`), so the Slots follow and completion can fire;
the write-back happens at `compositionend` (reported with that event). Overtyping is
not applied to composed text. Numeric keyboards do not compose; Android keyboards do for
`"alphanumeric"`, which is why the rule is "derive always, write when allowed".

**No `maxlength`.** The attribute would truncate a pasted `123 456` to `123 45` before the
filter runs, and block the last keystroke that rule 5 turns into a replacement. The length is
enforced by the filter, and without script by `pattern`.

**Undo.** A programmatic write clears the browser's undo history for the input. Accepted, as
in NumberField.

### 4.2 Keys

All native text editing; the library handles no `keydown`.

| Key | Effect |
| --- | --- |
| a character of `charset` | inserted or overtyped (4.1); others are dropped, with no feedback beyond the text not changing |
| Backspace, Delete | native: the character before / after the caret, the rest closes up |
| ArrowLeft, ArrowRight, Home, End (with Shift: selection) | native caret movement; one character is one slot |
| Ctrl / Cmd + A, C, X, V, Z | native |
| Enter | native implicit submission of the form |
| Tab | one Tab stop |

### 4.3 The caret, the selection and the pointer

The text is transparent, so the Slots show where the caret is. The Root tracks the Input's
`selectionStart` / `selectionEnd` (the input's `selectionchange` event: Chrome 127, Firefox
92, Safari 18; also read on `focus`, `select`, `keyup` and after the library's own writes, which
covers an engine that batches `selectionchange` late) and its focus, as urgent state.

- Not focused: no Slot is `active`.
- Collapsed caret at `p`: the Slot `min(p, length - 1)` is `active`. It is the position the
  next character goes to (rules 4 and 5).
- A range: every Slot in it is `active`.

A consumer draws a caret in an `active` empty Slot and a ring around an `active` filled one
(section 6).

**Pointer.** The Input covers the Root, so a click focuses it and long-press, the paste
callout and a password manager's menu are the browser's own. The native caret position under
a click is meaningless for transparent text, so after a `click` the library sets the caret to
the Slot under the pointer (from the registered Slot elements' boxes: the one containing the
point, else the nearest), clamped to `value.length`. Clicking a filled box and typing replaces
it. A second click of a double click (`detail > 1`) and a click that leaves a selected range
(a drag) keep the browser's selection.

### 4.4 Direction

**The Root renders `dir="ltr"` when the consumer passes no `dir`** (conventions 14.1, rule 8).

A one-time code is a left-to-right string in every locale: an SMS in Arabic or Hebrew shows
`123456` in that order, and the user copies it box by box from the left. Without the attribute
an RTL page changes the field in two ways (probed in three engines, #188):

- **The boxes mirror, in every engine.** The Slots are consumer markup in DOM order, so an RTL
  container lays Slot 0 at the right and the code reads right to left.
- **The caret keys differ by engine.** The Input inherits `direction: rtl` and holds a
  left-to-right run of digits or Latin letters. Chromium moves the caret logically: ArrowLeft
  goes to the higher index, which is the box to the left in the mirrored row, so keys and
  boxes agree. Firefox moves it visually inside the run: ArrowLeft goes to the lower index,
  the box to the **right**. WebKit does the same inside the run and jumps at its edges
  (ArrowLeft at index 0 goes to the end of the text). Home and End are logical everywhere.

So without the attribute the code is drawn backwards everywhere, and in two engines the arrow
keys move against the boxes. With it, the three engines behave alike.

With the attribute, inside the Root:

- Slot 0 is the leftmost box in any page, with the consumer's flex or grid layout unchanged.
- The Input's text, caret keys and selection are left to right (4.2), matching the boxes, in
  every engine: ArrowLeft goes to the lower index, ArrowRight to the higher, Home to 0 and End
  to the end of the text.
- Logical properties in the consumer's CSS for the Root and the Slots resolve as LTR.
- Elements a consumer puts between the Slots (a separator) are laid out left to right too.

Outside the Root nothing changes: the label, the description and the error message are the
Field's or the consumer's elements (section 1) and follow the page.

The default is an attribute on the library's own element, not a JS read and not a library
prop: `dir` is the native attribute, and a consumer's value replaces the default
(`<OTPField.Root dir="rtl">` for a code that really is right to left, with the per-engine keys
above; there is no attribute
value that means "inherit", so following an RTL container is spelled `"rtl"`). The default is
applied when the prop is `undefined`. It is in the server HTML, so it holds before hydration.
The library handles no key and reads no direction for this component.

The pointer mapping of 4.3 uses the Slots' boxes and does not depend on direction.

## 5. Accessibility

| Element | Role | Name | Described by | Other |
| --- | --- | --- | --- | --- |
| `Input` | `textbox` | `<label for>`, `Field.Label`, or the consumer's `aria-label` / `aria-labelledby` | the consumer's `aria-describedby`; the Field's description and error | `aria-invalid` from a Field |
| `Slot` | none | | | `aria-hidden="true"` |

- One field, one name, one value. A screen reader reads typed characters as in any text
  field. The library ships **no built-in string** (conventions 11): there is no per-character
  label to invent.
- An unnamed Input is a development warning (no associated label, `aria-label` or
  `aria-labelledby` at mount).
- The expected length belongs in the visible label or description ("the 6-digit code we sent
  to …"); `pattern` alone tells a screen-reader user nothing until it fails. A `title` on the
  Input is appended to the browser's `patternMismatch` message.
- Focus indicator: the Input's own outline surrounds the whole field by default. A design
  that moves it to the active Slot must keep one visible (`:has(:focus-visible)`).
- `submitOnComplete` changes context on input (WCAG 3.2.2): tell the user before the field
  that the code is submitted when complete, and keep a submit button for the path without
  script and for a user who wants to check the code first.
- `completeAction` that navigates is the same change of context and needs the same notice.
- Forced colours: the Input sets `forced-color-adjust: none` so its text stays transparent;
  the Slots are ordinary text and follow the system colours.
- Pending is visual (`data-pending`). What the verification answers (an error next to the
  field, a new page) is the consumer's content and is announced as such: a Field error
  through `aria-describedby` and the Form's focus move, a status message through the
  consumer's own `role="status"` or `ariaNotify()`.

## 6. Styling

The library ships no CSS. It sets three inline styles, all functional and owned (the precedent
is the visually hidden inputs of Slider and NumberField):

- Root: `position: relative`.
- Slot: `pointer-events: none`. A Slot that forms a stacking context (`opacity` below 1, as a
  pending style dims it, `position`, `transform`, an animation of those) paints over the
  Input in tree order and would take the click; with `pointer-events: none` the Input stays
  the target whatever the consumer's CSS, and no stacking context is created. Not a
  `z-index` on the Input, which would lift it over the page's later positioned content.
- Input: `position: absolute; inset: 0; inline-size: 100%; block-size: 100%; margin: 0;
  padding: 0; border: 0; background: transparent; color: transparent; caret-color:
  transparent; forced-color-adjust: none`. The outline is left alone. The exact list is
  settled by the device probes (the changelog entry): iOS has no `::selection`, so hiding the
  selection highlight there needs its own answer.

```css
.otp { display: inline-flex; gap: .5rem; }
.otp-input { border-radius: .5rem; font-size: 1rem; }          /* 16px or more: no zoom on focus in iOS */
.otp-input::selection { background: transparent; }
.otp-slot { display: grid; place-items: center; inline-size: 2.5rem; block-size: 3rem;
            border: 1px solid var(--line); border-radius: .5rem; font: 600 1.25rem / 1 var(--mono); }
.otp-slot[data-active] { border-color: var(--accent); }
.otp-slot[data-active]:not([data-filled])::after {             /* the drawn caret */
  content: ""; inline-size: 1px; block-size: 1.25em; background: currentColor;
  animation: otp-caret 1s steps(1) infinite;
}
@keyframes otp-caret { 50% { opacity: 0; } }
.otp[data-pending] .otp-slot { opacity: .6; }
.otp[data-invalid] .otp-slot { border-color: var(--danger); }
.otp-slot:not([data-filled])::before { content: "·"; color: var(--muted); }   /* placeholder */
@media (prefers-reduced-motion: reduce) { .otp-slot::after { animation: none; } }
```

Without JavaScript the Slots never fill, so a page that must work without it shows the plain
input instead (the inline styles need `!important` to undo):

```css
@media (scripting: none) {
  .otp-slot { display: none; }
  .otp-input { position: static !important; color: inherit !important; caret-color: auto !important;
               border: 1px solid var(--line) !important; padding: .5rem !important; }
}
```

## 7. Forms and Field

The Input is an ordinary text control:

- **`FormData`**: `name` → the text. A partial code posts as typed; `pattern` is what blocks
  the submission.
- **Constraint validation**: `required` (`valueMissing`) and `pattern` (`patternMismatch` for
  a partial code or a character the filter never saw, before hydration). `minlength` is not
  used: `tooShort` applies only to a value last changed by the user, and the library's
  write-back is a script change.
- **Reset**: the browser resets the input to its default; the Root follows through
  `useFormReset` and reports `onValueChange` with `"platform"`. No completion. The value
  adopted is the **computed** reset target (the latest `defaultValue`, or the mount-time
  `value` when controlled, filtered), not the input's text: after a click on a reset button
  `useFormReset`'s microtask runs before the browser's reset algorithm (there is a microtask
  checkpoint after each `reset` listener), when the input still holds the old text.
- **Implicit submission**: Enter, native.

Inside a `Field.Root` the Input calls `useFieldControl({ labelable: true, … })` and merges
the returned ref and attributes, which is `Field.Control`'s registration; the Root resolves
"own or the Field's" `name` / `disabled` / `required` itself (`resolveFieldDefaults`) and reads
the Field's `invalid` for its `data-invalid`, as NumberField's Root does:

| Field contract | OTPField |
| --- | --- |
| Registered element | the Input |
| `labelable` | yes: `Field.Label` is `label[for]` |
| Validity element | the Input itself: `validity`, `validationMessage`, `:user-invalid`, the custom-validity slot (`validate`, server errors) |
| `name` / `required` / `disabled` | the Root's own, else the Field's |
| Owned inside a Field | `id`, `aria-describedby` (token-merged), `aria-invalid`, `data-invalid` |
| `useFieldValueChange` | `(value, takeEdit)`: the library's write-back and a WebOTP fill change the value with no event the Field heard after the change. `takeEdit` is `true` for those, `false` for a controlled change and a reset |
| Focus target | the Input |

**Why not NumberField's model.** NumberField has two inputs because what the user reads
(`1.234,50 €`) is not what the form posts (`1234.5`), so the form control, the constraints and
the reset target must be a second, hidden element, with a validity mirror between the two.
Here the text the user typed is the value the form posts, character for character. One input
carries both, no mirror exists, and the two-element exceptions of conventions 1.1 are not
used. What OTPField takes from NumberField is smaller: the text is urgent library state
written from the `input` event, and text typed before hydration is adopted at mount.

```tsx
<Form.Root action={verifyAction} errors={state.errors}>
  <Field.Root name="code" required>
    <Field.Label>Verification code</Field.Label>
    <OTPField.Root length={6} submitOnComplete className="otp">
      <OTPField.Input className="otp-input" title="6 digits" />
      {SLOTS.map((i) => <OTPField.Slot key={i} index={i} className="otp-slot" />)}
    </OTPField.Root>
    <Field.Description>Enter the 6-digit code we sent you. It is submitted when complete.</Field.Description>
    <Field.Error />
  </Field.Root>
  <Form.Submit>Verify</Form.Submit>
</Form.Root>
```

Here the request is the form's: `Form.Submit` and the Field parts show `data-pending`, a wrong
code comes back in `errors` and is shown by `Field.Error` with focus on the Input, and a
success resets the form. `completeAction` is for a field with no form around it:

```tsx
const [code, setCode] = useState("");
const [message, setMessage] = useState<string>();

<OTPField.Root
  length={6}
  value={code}
  onValueChange={(next) => { setCode(next); setMessage(undefined); }}
  completeAction={async (entered) => {
    const result = await verifyCode(entered);
    if (result.ok) { startTransition(() => router.navigate("/welcome")); return; }
    setMessage(result.message);
    setCode("");
  }}
>
  <OTPField.Input aria-label="Verification code" aria-describedby="code-message" />
  …
</OTPField.Root>
<p id="code-message" role="status">{message}</p>
```

## 8. Autofill

**`autocomplete="one-time-code"`** is rendered by default and is what the platforms key on:
iOS and macOS Safari offer the code of a just-received message above the keyboard or in the
field's menu, Android keyboards offer the code they read from a message, and password managers
that hold a TOTP secret fill it. Each arrives as an `input` event on the one input and goes
through the filter; a complete code runs `completeAction`. Nothing here is library code, which
is the point of decision 1.

**WebOTP** is the API form of the same thing for SMS: the page asks for the code of a message
that names its origin (`@example.com #123456` as the last line), the browser asks the user,
and a promise resolves with the code.

| | Chrome | Firefox | Safari |
| --- | --- | --- | --- |
| `navigator.credentials.get({ otp })` (browser-compat-data 8.1.11) | 84 (Android), 93 (desktop) | no | 27 |

Not in all three engines, so it is behind `experimental_webOTP` on the Root (conventions 8),
off by default. With the flag on and `"OTPCredential" in window`:

- The Input's mount effect calls `navigator.credentials.get({ otp: { transport: ["sms"] },
  signal })`, once for the life of the Input (keyed on the flag, not on renders). The request
  is aborted at unmount, when the Input's form is submitted, and when the user completes the
  code by hand; after any completion no new request starts and a late code is ignored.
- A resolved credential's `code` goes through the filter. If it yields exactly `length`
  characters it becomes the value (`onValueChange` with `"platform"`, `details.event`
  `undefined`), then completion runs as for an edit (`completeAction` with `"platform"`,
  `submitOnComplete`). Anything else is ignored.
- A rejection (the user declined, no message, an abort) is ignored: it is the normal outcome.
- In an engine without the API the flag does nothing, and the keyboard's own suggestion is
  still there.

## 9. Server rendering and before hydration

- The server renders the Root, the Input with `value` = the default and the Slots with their
  characters. `experimental_webOTP` changes no markup.
- **Before hydration** the input accepts text, paste and autofill natively. The text is
  transparent and the Slots are static, so the user does not see what they type until
  hydration. This window is the cost of decision 1 with inline styles in the server HTML; the
  alternative (styles applied after mount) shows a plain input shifting into boxes on every
  load. A submission in that window posts the text, validated by `pattern`.
- **At mount** (the Input's first layout effect, so an Input that mounts late is covered) the
  Root reads the input's text (typed, autofilled or restored by the browser before hydration),
  filters it, writes the filtered text back when they differ, and adopts it as the value, with
  `onValueChange` (`"platform"`, `details.event` `undefined`) if it differs from the default. **It does not run `completeAction`**: a code the browser
  restored on reload is indistinguishable from one just typed, and verifying a stale code at
  page load is the worse mistake. The user submits with Enter or the button.
- Without JavaScript: the `scripting: none` recipe of section 6.

## 10. Server/client boundary

Every part file is `"use client"` (state, context, effects). The filter and the `charset`
table are directive-free modules. From a Server Component: `length`, `charset`, `name`,
`defaultValue`, `required`, `submitOnComplete` are serialisable, and `completeAction` may be a
Server Function, which receives `(value, details)` with `details.event` absent (conventions
2.2).

## 11. ViewTransition

No `transition` prop on any part: the text and the selection are urgent, and the Slots change
with them. The completion's transition adds the types `fsui-otp-field` and
`fsui-otp-field-complete`, so a consumer's own boundary can animate what the action leads to:

```css
::view-transition-old(.step):active-view-transition-type(fsui-otp-field-complete) { animation: slide-out-left .2s; }
```

A character appearing in a Slot animates in CSS (`.otp-slot[data-filled] { animation: pop
.1s }`).

## 12. Not in v1

- **A mask** (dots instead of characters). `children={({ filled }) => filled ? "•" : null}`
  on the Slot hides the characters from the screen; a `type="password"` input (which changes
  what a screen reader echoes, and which password managers treat differently) is a decision
  of its own.
- **A custom character rule or a normaliser** (upper-casing, a code alphabet without `0` and
  `O`). `charset` covers the codes in common use; a function prop would also have to produce
  the `pattern`.
- **A `placeholder` prop.** CSS on an empty Slot, or its function `children`.
- **Room for a password manager's badge** (input-otp widens the input by 40px behind a clip
  path after detecting known extensions). Extension detection is outside what the library
  should guess at; the badge overlaps the last Slot, as it does in any narrow input.
- **`valueChangeAction`.** Not ever: field-form 4.3.
- **A `Label` part, a hidden input, N inputs.** Sections 1 and 2.
