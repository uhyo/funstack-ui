# TextField

Status: **proposed** (#181). Not implemented; nothing here binds until the user decides the
four questions at the end of this document. The prior-art research, what was not verified and
the amendments other documents need on acceptance are in `design/CHANGELOG.md`, entry "#181:
text-field.md, the design (proposed)". Follows `design/conventions.md`; where this document
and the conventions disagree, the conventions win.

Inputs: `docs/vision.md`, `design/conventions.md` (2.1, 2.3 to 2.7, 3.1 to 3.6, 4, 15),
`design/internal-hooks.md` 3.8, `design/components/number-field.md` (the draft-and-commit
model this component copies), `design/components/field-form.md` (4.3, 7, 12),
`design/components/otp-field.md` (one input that is both the surface and the form control),
prior art (Ark UI `Editable` and its Zag machine, Atlassian `InlineEdit`; React Aria, Base UI
and Radix ship no such component), HTML (`change`, `contenteditable="plaintext-only"`,
`field-sizing`), notes in `memo/architect/text-field-notes.md`.

A text field that **saves itself**. The user types freely; when they are done with the text
(they leave the field, or press Enter) the field asks for the new value through an action, shows
`data-pending` while the save runs, and goes back to the saved value if the save is refused.
Escape puts the saved text back. It is NumberField without the number: the same draft, the same
commit, the same pending and rollback, on one `<input>` or `<textarea>`.

It is **not** the library's text input. A text control with no commit action has no library
state and stays the native element or `Field.Control` (field-form.md 4.3).

## Decisions at a glance

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Shape | A single-element component, `TextField`, from `@funstack/ui/text-field`. Renders `<input type="text">`; `render={<textarea />}` for several lines. No Root, no Label, no Preview, no trigger parts (section 1). |
| 2 | State | `value` / `defaultValue` (`string`, `""` is empty) are the **saved** text. The text being edited is the **draft**: urgent, internal, never an action (NumberField decision 3). |
| 3 | Action | One: `valueCommitAction(next, details)`, once per edit, awaited in the component's transition (`useControllableAction`). No per-keystroke prop of any kind (section 2.1). |
| 4 | Commit | **Blur** and **Enter** (an `<input>`; in a `<textarea>` Enter is a new line and blur commits). A draft equal to the shown value commits nothing. Never while composing with an IME (section 4). |
| 5 | Revert | **Escape** with an edited draft puts the saved text back and consumes the key (conventions 15), so an enclosing dialog stays open; a second Escape is not the field's (section 4.3). |
| 6 | Rejected save | NumberField's rule, unchanged: the value is written when the action resolves, so a rejected or refused save shows the saved text again. A draft the user has opened meanwhile stays. Keeping the text after a failure is the consumer's choice, made in the action (section 5). |
| 7 | Exposure | `data-pending`, `data-disabled`, `data-invalid` (in a Field) on the element. `state.value` is the shown value (optimistic), `state.text` the shown text (the draft while one is open). No `data-dirty`, no `data-editing` (`:focus`). |
| 8 | Forms | One element: it carries `name`, the constraints and the text the form posts (OTPField's shape, no hidden input). Reset and text typed before hydration are `"platform"` commits. Inside a Field it registers like every FUNSTACK control and keeps its own `data-pending` (section 7). |
| 9 | Accessibility | A native `textbox`, always present, named by its label. No read view that turns into an input, no built-in string, no announcement of pending. What the user is told about a save or a failure is the consumer's element (section 8). |
| 10 | ViewTransition | No `transition` prop (NumberField 11). Types `fsui-text-field`, `fsui-text-field-commit`. |
| 11 | SSR | `"use client"`. The server HTML is the input with its value; before hydration typing works and is adopted at mount; nothing is saved without JavaScript (section 10). |

---

## 1. Anatomy

```tsx
import { TextField } from "@funstack/ui/text-field";

// A document title: saved on blur or Enter, back to the saved title if the save throws.
<TextField aria-label="Title" defaultValue={doc.title} valueCommitAction={renameDocument} />

// Notes, several lines, saved when the user leaves the field.
<TextField render={<textarea rows={4} />} aria-label="Notes" defaultValue={notes} valueCommitAction={saveNotes} />

// In a Field: the label, the description and validation are the Field's.
<Field.Root name="displayName" required>
  <Field.Label>Display name</Field.Label>
  <TextField defaultValue={user.displayName} valueCommitAction={saveDisplayName} maxLength={40} />
  <Field.Error />
</Field.Root>
```

Rendered HTML for the first example, idle and then while the save runs:

```html
<input type="text" aria-label="Title" value="Quarterly report">
<input type="text" aria-label="Title" value="Q3 report" data-pending="">
```

| Part | Element | Role | Renders from | Notes |
| --- | --- | --- | --- | --- |
| `TextField` | `input` (`textarea` through `render`) | `textbox` (native) | shown text, pending | Owns the value (`useControllableAction<string>`), the draft, the commit and revert keys, form reset and mount reconciliation, the Field registration. `value` (the shown text), `data-pending`, `data-disabled`, `data-invalid`. |

Why this shape:

- **A new component, not a prop of `Field.Control`.** Three rules decide it. (1) Conventions
  2.7: `Field.Control` is a Field part and its `data-pending` is the **form's** submission; a
  control keeps its own `data-pending` for its own action "so the two meanings never share an
  element". A commit action on `Field.Control` would put both on one input. (2) On
  `Field.Control`, `value` / `onChange` are the native pair, passed through: the current text,
  per keystroke. The commit model needs `value` to mean the saved text and the library to own
  `onChange`; one prop name would mean two things depending on whether a third prop is
  present. (3) `Field.Control` also renders a `<select>`, where a draft means nothing. Every
  other control with an action (Checkbox, Select, NumberField, OTPField) is its own component
  that is placed inside a Field; this one is too.
- **One element, no Root.** NumberField has a Root because it is a group: two buttons, two
  inputs, a label that names the group. Here there is one element, and the library's
  one-element controls are single components (Toggle, Checkbox, Switch, Button). A Root that
  renders a `div` around one input would exist for symmetry only. A wrapper that shows the
  pending state is the consumer's element and one selector: `.cell:has([data-pending])`.
- **No Label part.** The name comes from a `<label>`, `Field.Label` or `aria-label`, as for
  Checkbox and Switch.
- **No Preview, no Edit / Submit / Cancel parts** (Ark UI's `Editable`). The read view is the
  same input, styled: `field-sizing: content` makes it as wide as its text, and a border that
  appears on hover and focus makes it read as text until it is used (section 9). An input that
  is always in the document is always in the Tab order, is announced as an edit field with
  its name and value, and needs no focus move and no built-in string. Section 8 has the
  accessibility comparison; what a Preview part would add (rich or truncated read content) is
  section 13.
- **`render={<textarea />}`** is `Field.Control`'s spelling; textarea-only props (`rows`,
  `wrap`) and a ref typed for the textarea go on the `render` element.

Element constraints for `render`: an `<input>` whose `type` holds free text (`text`, `search`,
`tel`, `url`, `email`, `password`) or a `<textarea>`; anything else is a development warning
(`number`, `date` and the like have a value the browser sanitises, and NumberField exists).
Library-controlled attributes (`value`, `data-*`, and inside a Field `id`, `aria-invalid`,
the `aria-describedby` tokens) land on whichever element renders (owned keys, conventions 1.2).

---

## 2. States and lanes

| State | Owner | Kind | Lane | Library-owned or browser-owned |
| --- | --- | --- | --- | --- |
| `value` (committed, optimistic) | `useControllableAction<string>` with `valueCommitAction` as its action | the saved text | **transition** (optimistic through `useOptimistic`) | Library-owned; residual browser paths: text typed before hydration, form-state restoration (mount reconciliation), form reset. Uncontrolled state is written when a commit resolves. |
| `draft` | `useState<string \| null>` | the text the user is editing; `null` when the input shows the value | **urgent** (written in the `input` event) | Library-owned, internal: the text of a controlled text input, which React requires to be urgent (conventions 2.6). Not controllable, no action, no handler. Cleared by a commit, a revert and a reset. |
| `pending` | the component | a commit is in flight | | Including the Suspense wait of the render the commit caused. |
| focus, selection, composition, validity | DOM | | | Browser-owned. The component never moves focus and never touches the selection. Validity is read by a Field (section 7). |

```ts
const text = draft ?? optimistic;   // what the input shows; NumberField 2.2 without `live`
```

NumberField's `live` layer is not needed: it exists because a step with a synchronous action
settles between two ticks of a hold. Here the only dispatch is the commit, and `useOptimistic`
holds its value for as long as the commit is pending.

A controlled `value` that changes from outside while **no draft is open** shows at once. While
a draft is open the draft wins; the new value is visible after the next commit or revert
(NumberField 2.2). So a title another user renamed does not replace what this user is typing,
and Escape then shows the other user's title.

### 2.1 One action, and its name

The text of an input is a fact, not a request (vision, principle 3; conventions 2.6): a
keystroke cannot be held, and nothing the library does reports one. What the user asks for is
"keep this text", once, when they are done. That is the commit of conventions 2.1,
`<state>CommitAction`: once per gesture, awaited in the owner's transition, the state owner's
dispatch. The gesture here is one edit, from the first keystroke to the blur or the Enter.

- **`valueCommitAction` only.** NumberField has a second action, `valueChangeAction`, for the
  steps of a gesture (each tick of a held button). A text edit has no steps a consumer could
  act on other than keystrokes, so the step channel would be called exactly when the commit
  is, with the same arguments.
- **Not `valueChangeAction`.** The triple of conventions 3.1 would give that name. On a text
  input it reads as React's `onChange`, per keystroke, which is what field-form.md 4.3 rules
  out; and in the two components that have both names the save belongs in the commit action.
  A reader who knows Slider or NumberField finds the save under the same name here.
- **No `onValueChange`, no `inputValue` pair.** Nothing needs the draft outside the component
  (NumberField 13 keeps the same door closed). A consumer who needs every keystroke uses a
  controlled native input, which is not this component.

---

## 3. Props and types

```ts
export interface TextFieldValueChangeDetails extends ActionDetails {
  /** `"activate"`: the user committed an edit (blur, Enter). `"platform"`: a form reset, or text adopted at mount. */
  readonly reason: ChangeReason;
}

export interface TextFieldState {
  /** The shown value: the optimistic value (the committed one when nothing is in flight). */
  readonly value: string;
  /** The shown text: the draft while the user is editing, else `value`. */
  readonly text: string;
  readonly pending: boolean;
  readonly disabled: boolean;
  readonly readOnly: boolean;
  readonly required: boolean;
}

export interface TextFieldProps
  extends Omit<
    ComponentPropsWithRef<"input">,
    | "value" | "defaultValue" | "onChange" | "onKeyDown" | "onBlur"
    | "aria-invalid" | "className" | "style" | "children"
  > {
  /** The saved text, controlled. `undefined` is uncontrolled. */
  value?: string;
  /** Initial saved text in uncontrolled mode, and its form-reset target (latest). Default `""`. */
  defaultValue?: string;
  /** Once per edit (blur or Enter), and for a platform change. Commits uncontrolled state when it resolves. */
  valueCommitAction?: ChangeAction<string, TextFieldValueChangeDetails>;
  /** Native `name`; defaults to the Field's `name` inside a `Field.Root`. */
  name?: string;
  /** Native `disabled`; or the Field's. */
  disabled?: boolean;
  /** Native `readonly`: the text cannot be edited, nothing commits. */
  readOnly?: boolean;
  /** Native `required`; or the Field's. */
  required?: boolean;
  className?: StateValue<string | undefined, TextFieldState>;
  style?: StateValue<CSSProperties | undefined, TextFieldState>;
  /** Must render a text `<input>` or a `<textarea>`. */
  render?: RenderProp<ComponentPropsWithRef<"input">, TextFieldState>;
}
```

- **Value shape.** `string`; empty is `""`, not `null` (the DOM's own empty text, as in
  OTPField and Select; `undefined` stays "uncontrolled"). The text is committed as typed: no
  trimming, no normalisation. A parent that normalises does it in controlled mode by adopting
  the normalised text.
- **Owned keys.** `value` (the shown text), the three handlers in the `Omit`, `data-pending`,
  `data-disabled`; inside a Field also `id`, `name` / `disabled` / `required` (own or the
  Field's), `aria-invalid`, `aria-describedby` (token-merged), `data-invalid`. The handlers
  are omitted from the type because they are the library's prop-form handlers (conventions
  1.5, as on `NumberField.Input`); `onInput`, `onFocus`, `onKeyUp`, `onPaste`, the composition
  handlers and the rest pass through.
- **Pass-through.** Everything else the element takes: `type`, `placeholder`, `maxLength`,
  `minLength`, `pattern`, `autoComplete`, `inputMode`, `enterKeyHint`, `spellCheck`, `form`,
  `aria-label`, `aria-describedby`. The library sets no default for any of them. In
  particular **no `autocomplete="off"`**: unlike a number or a one-time code, this text may be
  a name or an address the browser should offer to fill.
- `transition` is not a prop. `id` passes through outside a Field and is owned inside one.
- `details.event` is the `focusout` or the Enter `keydown` for `"activate"`, the `reset` event
  for a reset, `undefined` for text adopted at mount.

Subpath `@funstack/ui/text-field`; the root entry re-exports `TextField` and the three types.

---

## 4. Editing

### 4.1 Typing

Every `input` event (typing, cut, paste, composition, autofill, a spelling correction) writes
the draft with the input's DOM value. Nothing is dispatched. The caret, the selection and the
undo history are the browser's.

### 4.2 The commit: blur and Enter

- **Blur** (`focusout`): the user left the field, by Tab, by a click elsewhere, or because the
  window lost focus. This is the trigger a `<textarea>` relies on.
- **Enter** (`keydown`) in an `<input>`, with or without modifiers, as in NumberField. It is
  **not** `preventDefault()`ed: inside a form the implicit submission follows and posts the
  same text (section 7). Outside a form Enter does nothing else, and focus stays in the field.
- **Enter in a `<textarea>`** is a new line and commits nothing.
- **Not during an IME composition**: an Enter that confirms a composition (`isComposing`, or
  `keyCode === 229`; `isComposingKey`, conventions 15 rule 1) is the IME's.

What a commit does:

1. No draft open: nothing.
2. `disabled` or `readOnly`: the draft is cleared, nothing is dispatched (NumberField 4.1).
3. The draft equals the shown value (the optimistic one, conventions 2.3 item 8: typing and
   deleting again, or re-typing the text of a save that is still pending): the draft is
   cleared, nothing is dispatched.
4. Otherwise the draft is cleared and the value is dispatched: `setOptimistic(next)`,
   `valueCommitAction(next, { reason: "activate" })` awaited, `data-pending` meanwhile. The
   input shows the same characters before and after (the draft, then the optimistic value), so
   the caret does not move.

The commit does not look at validity: text that fails `required` or `pattern` is committed like
any other, as NumberField commits a number outside `min` / `max` (number-field.md 5.6). The
constraint is reported by the platform and by a Field; an action that must not save such text
checks it (section 13 lists the alternative).

Nothing commits at unmount: a draft that is open when the field is removed (a popover that
closes, a navigation) is dropped. A commit needs a mounted owner for its transition.

### 4.3 Escape: back to the saved text

On the field's own `keydown`, when the key is an Escape request (`isEscapeRequest`, conventions
15 rules 1 and 2: not composing, not already prevented or consumed) **and a draft is open that
differs from the shown value**:

- the draft is cleared, so the input shows the saved (or pending) text again;
- the Escape is consumed (`consumeEscape`, rule 3): an enclosing layer stays open. A modal
  dialog's close watcher sees a cancelled `keydown`; the library's own layers read the mark.
  The next Escape finds no draft, is left alone, and closes the dialog.

The field acts in its own handler and not through `decideEscapeLast`: it handles a key on
itself and is the innermost by construction (rule 4, last paragraph, as the Combobox chip).
Consequence: a Tooltip that happens to be shown stays for that Escape and closes on the next.

Escape with no draft, or with a draft equal to the shown value, is not the field's: nothing is
cleared, nothing is consumed. Escape does not cancel a save that is in flight, does not blur
the field, and never dispatches. Focus stays where it is.

The revert is a write to a controlled input, so the browser's undo history for that field is
gone after it; the same holds for a rollback (section 5).

### 4.4 Platform paths

- **Text typed before hydration** (react-dom keeps the DOM text when hydrating and fires no
  event). At mount, when the input's text differs from the value: if the input is still
  focused the text becomes the draft, and the user's blur or Enter commits it; otherwise it is
  dispatched as one `"platform"` commit with `event: undefined` (NumberField 4.5, conventions
  3.5). A browser's form-state restoration after a reload takes the same path, so the action
  can be called at load with `reason: "platform"`, as a restored checkbox's is.
- **Form reset** (a reset button, `form.reset()`, React's reset after a form action): the
  draft is cleared and the reset target (the latest `defaultValue`; controlled: the mount-time
  value) is dispatched as a `"platform"` commit with the `reset` event, unless it equals what
  the user already intends (internal-hooks.md 3.8 rules 1, 5 and 6). The input is a controlled
  value input, so its `defaultValue` mirror is written in the `reset` event itself and the
  target is computed in JS, never read from the DOM. The callback runs through `useFormReset`,
  after the dispatch in both orders (`afterDispatch`, rule 5); a cancelled reset dispatches
  nothing (rule 7).

Both go through the hooks NumberField and Slider use (`useResetTarget`, `useFormReset` or
`useNativeGroupReconciliation`), with the one input as the element.

---

## 5. A save that fails

The contract is the conventions', with nothing added (2.4, 3.3):

- The uncontrolled value is written when `valueCommitAction` resolves, and only for the latest
  commit. A rejection writes nothing: the optimistic value reverts and the input shows the
  saved text again.
- A rejection reaches the Error Boundary above the field (the latest commit, while the field is
  mounted and visible); a superseded one goes to `reportError`.
- A controlled parent gets the rollback by not adopting: the input shows `value` again once the
  action has settled.
- **A draft opened meanwhile stays.** If the user is typing again when the save fails, the
  draft is on screen and is not touched (NumberField walkthrough 5); it commits at their next
  blur or Enter as its own edit.

Rolling a number back costs the user a few digits. Rolling text back can cost a paragraph, so
the docs state the choice next to the first example. The consumer makes it in the action:

```tsx
// Roll back: the field shows the saved text again; the message says why.
<TextField
  value={title}
  valueCommitAction={async (next) => {
    const result = await rename(id, next);
    if (result.ok) startTransition(() => setTitle(next));   // after an await: re-wrap (conventions 2.3 item 4)
    else toast({ type: "error", title: result.message });   // not adopted: the old title returns
  }}
/>

// Keep the text: adopt it, and say it is not saved. Nothing the user typed is lost.
<TextField
  value={notes}
  aria-describedby="notes-status"
  valueCommitAction={async (next) => {
    const result = await saveNotes(id, next);
    startTransition(() => { setNotes(next); setUnsaved(!result.ok); });
  }}
/>
<p id="notes-status" role="status">{unsaved ? "Not saved." : ""}</p>
{unsaved && <Button action={() => retry(notes)}>Try again</Button>}
```

In uncontrolled mode an action that catches its own failure resolves, so the new text is
committed (conventions 2.4): that is the "keep the text" outcome without a parent, and the
action is where the user is told. The component has no state for "edited but not saved" and no
retry of its own; section 13 lists what a library rule for it would need.

**Overlap.** Latest intent wins (conventions 2.5, single-valued): a second commit while the
first save runs replaces it, `data-pending` stays until both have settled, the uncontrolled
value is the later text whichever save finishes first. The library does not order the two
requests on the wire; a save that must not be overtaken aborts or sequences in the action.

**Awaiting is a choice** (conventions 2.3 item 5). An awaited save gives `data-pending` and the
rollback, and holds every other transition of the app until it settles. A field whose save
need not be waited for returns without awaiting (`(next) => { void save(next); }`): the value
commits at once and nothing is pending.

---

## 6. Async walkthroughs

1. **Typed, saved.** `defaultValue="Draft"`, the action resolves after 600 ms. The user types
   `Report` and presses Tab: `focusout` → the draft is cleared, `setOptimistic("Report")`,
   `data-pending`. The text does not change on screen. 600 ms later the value is `Report` and
   `data-pending` leaves.
2. **Typed, the save throws.** Same, the action rejects: the boundary above the field receives
   the error and replaces it. A consumer who wants the field to survive catches in the action
   (section 5).
3. **Typing while a save is pending.** `Report` is being saved; the user focuses the field and
   types `Report 2`: urgent, shown at once. Enter: a second commit supersedes the first. If
   the first save then rejects, the error goes to `reportError` and nothing changes on screen.
4. **A save fails mid-edit.** `Report` is being saved (an update-on-success parent); the user
   has typed `Report 2` when the save is refused: the value returns to `Draft`, the draft
   `Report 2` stays on screen, and Escape would now show `Draft`.
5. **Content that suspends.** The page heading renders from the same controlled `title` through
   a resource. The commit's transition re-renders it; it suspends; the old heading stays, the
   field keeps `data-pending` and shows the new text (optimistic), and both settle together
   (conventions 3.2: the field is a trigger part, the heading a content region).
6. **Escape in a dialog.** A rename dialog with the field focused and `Repor` typed. Escape:
   the saved name returns, the dialog stays. Escape again: the dialog closes.
7. **Enter in a form.** The field is in a `Form.Root` with its own `valueCommitAction`. Enter:
   the commit is dispatched in the `keydown`, then the implicit submission runs the form's
   action with the same text. Two channels: `data-pending` on the field for its save, on
   `Form.Submit` and the Field parts for the submission (field-form.md 7.3).
8. **Before hydration.** The server rendered `Draft`; the user types `Report` and tabs away
   before hydration: at mount, one `"platform"` commit with `event: undefined`. Had they still
   been in the field, `Report` would be the draft and their blur would commit it.
9. **Another user renames.** Controlled; the parent's `title` changes to `Plan` while this
   user's draft `Repor` is open: the draft stays. Escape shows `Plan`. A blur commits `Repor`
   over it, as it would in any last-write-wins editor; a parent that must detect the conflict
   compares in the action.

---

## 7. Forms and Field

The element is an ordinary text control, and the only one (OTPField 7, "Why not NumberField's
model" applies word for word: the text the user sees is the text the form posts).

- **`FormData`**: `name` → the text in the input, which is the draft while one is open. A form
  submitted by a button while the field is focused posts what the user sees.
- **Constraint validation**: the native attributes, on the one element.
- **Implicit submission**: Enter, native. The commit is dispatched first, in the same `keydown`.
- **Two channels** (conventions 2.7, field-form.md 7.3). The field's own action and the form's
  submission are independent, each with its own pending. A field with a `valueCommitAction`
  inside a submit form saves on its own and is also posted. "Submit when the user is done with
  this field" is `valueCommitAction={() => formRef.current?.requestSubmit()}`; such a form
  also works before hydration, where Enter submits it natively.
- **`autoReset`**: a `Form.Root` that resets after a successful submission resets this field
  too, and the reset target is offered through `valueCommitAction` with `reason: "platform"`,
  as for every control with an action. An action that saves checks `details.reason` if a reset
  must not be saved.

Inside a `Field.Root` the component calls `useFieldControl({ labelable: true, … })` and merges
the returned ref and attributes, which is `Field.Control`'s registration:

| Field contract | TextField |
| --- | --- |
| Registered element, validity element, focus target | the input or textarea |
| `labelable` | yes: `Field.Label` is `label[for]` |
| `name` / `required` / `disabled` | own, else the Field's |
| Owned inside a Field | `id`, `aria-describedby` (token-merged), `aria-invalid`, `data-invalid` |
| `data-pending` | its own action's only; never the form's (the Field parts carry that) |
| `validate`'s `value` | `formData.get(name)`: the text in the input, per keystroke |
| `useFieldValueChange` | `(text)`: the text changes with no event the Field hears on an Escape revert, a rollback and a controlled change from outside. `takeEdit` is not passed: a revert follows keystrokes the Field already heard as `input`, and a rollback or a controlled change is not the user's edit |

Timing. Typing is an `input` event the Field hears on the control before React does; the Field
writes its custom-validity slot there and its state after the dispatch (field-form.md 2.4), so a
keystroke that flips validity is not overwritten by the field's controlled `value`. The commit
itself changes no text in the DOM, so it needs no notification. A server error shown for the
field (`Form.Root errors`) is dismissed by the first keystroke, as for any text control.

---

## 8. Accessibility

| | |
| --- | --- |
| Role, name, value | The native `textbox` (`searchbox` for `type="search"`), named by `<label>`, `Field.Label` or `aria-label`; the value is the text. No `aria-roledescription`. |
| Keyboard | Tab reaches it. Enter commits (an `<input>`). Escape reverts an edited draft (4.3). Everything else is native text editing. A `<textarea>` commits when focus leaves it. |
| Pending | `data-pending` only. No `aria-busy`, no native `disabled`, no announcement (conventions 3.6): the field stays editable while a save runs. |
| Built-in strings | None (conventions 11). |

**Why there is no read view that turns into an input.** The preview-and-edit shape (Ark UI:
a focusable `span` with `aria-label="edit"` and no role, swapped for the input on focus, click
or double click; Atlassian: a read view the user activates) has costs an always-present input
does not have:

- the element under the user changes when they focus or activate it, so focus has to be moved
  into the input and back, and a screen reader hears two different things for one field;
- the read view needs a role and a name of its own, which means a built-in string ("Edit")
  or a required prop;
- "is this editable?" is answered by styling alone for a sighted user and by the role of the
  read view for everyone else, and the two can disagree.

An `<input>` answers all three with the platform: it is in the Tab order, it is announced as
an edit field with its label and value, and it is edited where it stands. The read-view look is
CSS (section 9). The docs say to keep a visible affordance when the border is removed: a hover
and focus style at least, since a field that looks exactly like text is not discoverable.

**Telling the user about a save.** The library says nothing by itself; the outcome is the
consumer's (conventions 3.6). The docs show the three cases:

- *Saved.* If the page shows a "Saved" mark, it is a status message: an element with
  `role="status"` (WCAG 4.1.3), or a toast. If nothing is shown, nothing is announced.
- *Failed, rolled back.* The text of the field changes while the user is somewhere else, so a
  message is required, not optional: a toast, or text in an element the field's
  `aria-describedby` names, with `role="alert"` when it appears.
- *Failed, text kept.* The "Not saved" text of section 5, `role="status"`, named by the
  field's `aria-describedby` so it is read again when the user returns to the field.

Inside a `Form.Root`, an error for the field's `name` in `errors` is the Field's and is read as
field-form.md 5.3 describes. A standalone field has no server-error channel in the Field (it has
no form whose settle would show one), which is why the examples above use their own element.

---

## 9. Pending, data attributes, CSS

| Attribute | Meaning |
| --- | --- |
| `data-pending` | A commit is in flight (including the Suspense wait of its render). |
| `data-disabled` | The `disabled` prop, or the Field's. `:disabled` also sees `<fieldset disabled>`. |
| `data-invalid` | From a Field (section 7); never outside one. |

Platform pseudo-classes next to them: `:focus` (being edited), `:read-only`,
`:placeholder-shown` (empty), `:user-invalid`.

```css
/* Reads as text until it is used; as wide as its content. */
.title { field-sizing: content; min-inline-size: 4ch; border: 1px solid transparent; font: inherit; }
.title:hover, .title:focus-visible { border-color: var(--border); }
.title:not(:focus) { text-overflow: ellipsis; }
.title[data-pending] { color: var(--muted); }
/* A spinner next to it: an input has no pseudo-elements, so the wrapper draws it. */
.cell:has(.title[data-pending])::after { content: ""; /* spinner */ }
```

---

## 10. Server rendering and before hydration

The file is `"use client"` (state, a transition, DOM listeners). A Server Component may render
it and pass a Server Function as `valueCommitAction` (conventions 2.2); it receives
`(next, details)` with `details.event` absent.

The server HTML is the element with its value. Before hydration the user can type; the text is
adopted at mount (4.4). **Nothing is saved without JavaScript**: progressive enhancement, not a
JS-free mode. The JS-free way to save one text is a form, which Enter submits natively:
`<form action={rename}><input name="title" defaultValue={title} /></form>`.

---

## 11. ViewTransition

No `transition` prop and no `<ViewTransition>` (conventions 5.1, the Select / Slider /
NumberField category): the text is urgent or optimistic, and nothing mounts from library state.
A commit adds the types `fsui-text-field` and `fsui-text-field-commit`, so a consumer's own
boundary around content the saved text drives (the heading of walkthrough 5) can key on them.
A rollback carries no types.

---

## 12. Suspense

- Content the saved value drives re-renders in the commit's transition; if it suspends, what is
  shown stays and the field keeps `data-pending` until it is ready (walkthrough 5).
- The field renders from optimistic state and its function props must not suspend (conventions
  3.2, as every trigger part).
- A field inside a boundary that hydrates late reconciles when it mounts (4.4).

---

## 13. Not in v1

Each of these is a question for a later issue, not a decision made against it.

- **A read view as its own part** (`Preview`, with Edit / Submit / Cancel triggers): for a read
  state that is not plain text (a link, formatted or clamped text). Needs a compound anatomy,
  an edit-mode state with its own action, focus management and three built-in strings.
- **Keeping a refused text as an open draft** (the field shows what the user typed, marked
  `data-dirty`, and Enter tries again). The library cannot tell a refusal from a parent that
  adopted a normalised text, so it would need an explicit signal the action gives; the
  conventions have none (an action's return value is never interpreted, 2.7).
- **Ctrl+Enter / Cmd+Enter to commit in a `<textarea>`** (Ark UI does this). Blur is the
  textarea's commit today.
- **A commit that waits for validity** (do not dispatch while the element is invalid). It
  would leave an edited, unfocused draft on screen, and NumberField would have to follow.
- **`commitOnBlur={false}`** (Atlassian's `keepEditViewOpenOnBlur`, for long text), **saving
  while the user types** (a debounced commit), **select all on focus** (`onFocus` is passed
  through).
- **`contenteditable`** as the element: it flows like text, but it is no form control (no
  `name`, no constraints, no `<label for>`).
- **Escape in NumberField.** NumberField 13 keeps "Escape reverting the draft" out of v1. If
  this component is accepted with section 4.3, NumberField should get the same rule so that
  the two drafts behave alike.

---

## 14. Test plan

An outline; the rows of `design/testing.md` 10.1 apply as for any state owner, "both" meaning
controlled and uncontrolled.

jsdom, the component's test file:

| Area | Rows |
| --- | --- |
| Roles and ARIA | Renders one `input[type=text]` with the value; `render={<textarea />}` renders a textarea; no attribute the consumer did not pass, outside a Field. |
| Draft | Typing shows at once and dispatches nothing; `state.text` follows the draft and `state.value` does not; a controlled `value` changed from outside shows when no draft is open and does not replace an open one. |
| Commit (both) | Blur and Enter each dispatch once with `(next, { reason: "activate" })` and the native event; Enter is not `defaultPrevented`; a draft equal to the shown value dispatches nothing and is cleared; no draft, nothing; `disabled` / `readOnly` clear and dispatch nothing; a textarea's Enter dispatches nothing and its blur does; an Enter with `isComposing`, and one with `keyCode` 229, dispatch nothing. |
| Escape | With an edited draft: the text returns, nothing is dispatched, the event is `defaultPrevented` and marked consumed; with no draft, with an equal draft, when already prevented, and while composing: untouched. Inside a non-modal Dialog: the first Escape reverts and the dialog stays, the second closes it. |
| Async action (both) | `data-pending` from the commit until the deferred resolves; the text does not change during it; the field is not disabled and typing during it opens a draft. |
| Rejection (both) | The boundary receives it; the optimistic text reverts; the uncontrolled value is unchanged. Caught inside: resolves and commits (uncontrolled). A controlled parent that does not adopt: the saved text returns. A draft opened before the settle is kept in each case. |
| Overlap, superseded rejection (both) | Two commits resolved out of order: the later text wins, `data-pending` until both settled; the older one's rejection goes to the stubbed `reportError` once, after and separately while the newer pends. |
| Suspending content (both) | Content keyed on the committed value suspends: the old content stays, no fallback, `data-pending` on, the field shows the new text. |
| Platform path (both) | Hydration with changed text, unfocused: one `"platform"` dispatch with `event === undefined`, once under StrictMode; focused: no dispatch, the text is the draft and a blur commits it. Reset through `form.reset()`, a reset button and React's reset after a form action: one dispatch with the `reset` event and the computed target; an open draft is cleared; a cancelled reset dispatches nothing; a controlled parent that refuses gets its value back in the input. |
| Inside a Field | The Field's `id`, `name`, `aria-describedby`, `aria-invalid`, `disabled` / `required`; `Field.Label`'s `for`; `data-invalid` on the element; its `data-pending` is its own and the Field parts' is the form's; an Escape revert and a rollback re-run `validate` (no event); a server error is dismissed by the first keystroke. |
| Form | `FormData` holds the text shown, draft included; Enter in a `Form.Root` dispatches the commit and then submits with the same text; `autoReset` after a successful submission dispatches a `"platform"` commit. |
| Function props, `render`, post-await rule, directive | As in testing.md 10.1. |
| Types | `valueCommitAction` is a `ChangeAction<string, TextFieldValueChangeDetails>` and joins the action-naming list; no `valueChangeAction`, no `onValueChange`, no `transition`; `onChange`, `onKeyDown` and `onBlur` are not accepted. |

Browser, three engines:

| Rows |
| --- |
| Real keys outside `act`, inside a Field with `validate` and with `required`: the keystroke that flips validity is kept (the #193 rows, for this controlled input), before and after a blur. |
| A real click on a reset button with a draft open and a save pending (the #185 order): the reset value shows and one `"platform"` commit is dispatched. |
| Escape with an edited draft in a **modal** Dialog and in an `auto` Popover: the layer stays open (the close watcher saw a cancelled key); the next Escape closes it. |
| Blur by a real Tab, by a click on a button (the commit is dispatched before the button's `click`), and by the window losing focus where the engine can be driven to it. |
| IME, Chromium through CDP: Enter that confirms a composition commits nothing; a blur during a composition ends with the composed text committed and no draft left on the unfocused field. This row decides an open point (the changelog entry, "Not verified"). |
| `startViewTransition` is not called by a commit or a rollback. |

---

## Decisions for the user

The recommendation is the first option of each.

1. **What is built, and under which name.**
   - **(a) A new single-element component, `TextField`.** It is the third of a family
     (NumberField, OTPField: a text input whose text the library manages), with NumberField's
     prop names. The page must say early that it is not a general input (#169 stands).
   - (b) The same component, named `Editable` (Ark UI's name). Cannot be mistaken for "the
     Input part", but the name promises a read view this design does not have.
   - (c) An opt-in on `Field.Control` (`valueCommitAction` as one more prop). No new export;
     against conventions 2.7 (the form's pending and the control's own on one element) and it
     gives `value` two meanings on one part (section 1).
2. **What a refused save does to the text.**
   - **(a) NumberField's rule: the saved text returns** (section 5), and the docs show the two
     recipes, "roll back" and "keep the text and say it is not saved", both written in the
     action. No new rule; a consumer who forgets the second recipe on a long text loses it.
   - (b) The library keeps the refused text on screen as an open draft with `data-dirty`, and
     Enter tries again. Kinder to long text; needs a new signal by which an action says
     "refused" (none exists), and NumberField would behave differently unless it follows.
3. **A read view.**
   - **(a) None in v1: always the input, the read look in CSS** (`field-sizing`, a border on
     hover and focus). One element, no focus moves, no built-in strings.
   - (b) Ark UI's anatomy: `Root`, `Preview`, `Input`, Edit / Submit / Cancel triggers, an
     `edit` state with its action. Covers a read state that is not plain text; three to five
     more parts, three built-in strings, and the accessibility costs listed in section 8.
4. **The action's name.**
   - **(a) `valueCommitAction` alone**, the name the save has in Slider and NumberField.
     Conventions 2.1 and 3.1 then say that a text control's only action is its commit.
   - (b) `valueChangeAction` alone, the triple of conventions 3.1 unchanged. Reads as
     per-keystroke on a text input.
   - (c) Both, as NumberField, called together with the same arguments. Uniform with
     NumberField; the second prop does nothing the first does not.

Smaller points the product owner can settle: Escape in NumberField for parity (section 13),
and whether Ctrl / Cmd+Enter in a textarea joins v1.
