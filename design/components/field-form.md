# Field and Form

Status: **accepted**, implemented. History (conventions feedback, the notes for the product
owner, review corrections, the `validityElement` amendment as written, implementation notes,
the test plan): `design/CHANGELOG.md`, parts "field-form.md". The code under
`packages/ui/src/field/`, `packages/ui/src/form/` and the `internal/` helpers it names is the
ground truth where this document is silent. Follows `design/conventions.md`; where this
document and the conventions disagree, the conventions win.

Inputs: `docs/vision.md`, `design/conventions.md`, `docs/research/field-form.md` (binding: native
constraint validation as the source of validity, `:user-invalid` as the show-timing signal,
`aria-describedby` for description and error with an explicit `aria-invalid`, the native bubble
suppressed and the first invalid control focused by the library, React's automatic form reset
after every successful action including one that returns field errors, `setCustomValidity`
persisting until cleared, `useFormStatus` from portals, the verified reset workarounds),
`docs/research/form-controls.md` §2 and §5 (the reset path, the two channels),
`docs/research/react-async-apis.md` (entanglement), the accepted Dialog design (8.1: `Dialog.Form`
keeps the action unwrapped and observes the form channel through a `useFormStatus` watcher), the
accepted Combobox and Slider designs (`Label` registration, the urgent lane, `useFormReset`), the
WAI-ARIA APG "Form" patterns and ARIA in HTML, prior art (Base UI Field / Form, React Aria
TextField / FieldError / Form, Radix Form, Ark UI Field), the react-dom 19.3.1 submit plugin
source (read for this design, see `memo/architect/field-notes.md`), and the probes in
`memo/platform-researcher/probes/14-field-form/`.

Field and Form are where React's own async form model (`<form action>`, `useActionState`,
`useFormStatus`) meets the platform's own validation model (`required`, `pattern`,
`setCustomValidity`, `:user-invalid`, `validationMessage`). The library adds no validation
engine, no schema and no touched/dirty bookkeeping: **the DOM's validity is the truth**, the
platform's interaction heuristic decides when an error is shown, the browser's localised message is
the default text, and the form posts to a Server Function before hydration. What the library adds
is the wiring the platform does not do (`aria-describedby`, an explicit `aria-invalid`, the ids),
a styleable error element instead of the native bubble, the first-invalid focus the bubble's
suppression loses, and the Async React half: a submission runs in a transition with `data-pending`
on the form and its submit button, a field-level error returned from the action lands on its field
and is cleared by the next edit, and React's automatic form reset happens **only when the action
reported no errors**, so a failed submission never wipes what the user typed.

## Decisions at a glance

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Anatomy | `Field.Root` (`div`), `Field.Label` (`label[for]`), `Field.Control` (a native `input`, or `textarea` / `select` through `render`), `Field.Description` (`p[id]`), `Field.Error` (`div[id]`, rendered only while an error is shown). `Form.Root` (`form`), `Form.Submit` (`button[type=submit]` with `data-pending`). Any FUNSTACK form control (Checkbox, Switch, RadioGroup, CheckboxGroup, Select, Combobox, Slider) placed inside a `Field.Root` is the field's control (section 7), no wrapper part needed. |
| 2 | Validity source | Native constraints (`required`, `type`, `pattern`, `min`/`max`, `minLength`, …) plus **one custom-validity slot** the Field owns: `validate(value, formData)` (sync, re-run on every `input` / `change` in the form and after a FUNSTACK control's value change that fired no event, 7.1) and the server error for the field, both written with `setCustomValidity`. Cleared on the control's next edit. No JS schema, no `validationMode`. |
| 3 | When an error is shown | `invalid = userInvalid \|\| serverShown`. `userInvalid` is read from the DOM (`control.matches(":user-invalid")`) on `input`, `change`, `focusout`, `invalid` and after `reset`: the platform's heuristic (changed-then-blurred, or a submission attempt; live afterwards; cleared by a reset). `serverShown` is the field's entry in `Form.Root errors` until the user edits the control, re-armed by the next settled submission (each Field re-arms itself on its own `useFormStatus` edge, in the settle commit, 3.4). |
| 4 | The display state is urgent | `invalid`, `messages` and `validity` are a **mirror of a browser-owned fact**, written with plain `useState` from the DOM event (the urgent lane of conventions 2.6, like virtual focus): the DOM already holds the truth, and the error must be in the DOM when focus moves to the field. No `transition` prop on any Field or Form part; `Field.Error` animates with CSS. |
| 5 | ARIA | `Field.Label` is `<label for>` (for a group control it renders no `for` and the group gets `aria-labelledby`). The control carries `aria-describedby` = consumer tokens + the description id + the error id while invalid, and an **explicit** `aria-invalid="true" \| "false"` (for a CheckboxGroup, on every Item: ARIA 1.2 does not support it on `group`, 5.1). `aria-errormessage` is **not rendered in v1** (VoiceOver ignores it, NVDA would read the error twice); if it is ever added it is only ever in addition to `aria-describedby`. No live region on the error: focus moving to the control reads it, and when focus is already there the message is spoken through `ariaNotify()` (2.5, 3.5). |
| 6 | The bubble | After hydration a Field cancels the control's `invalid` event **when a `Field.Error` is mounted and the control matches `:user-invalid`** (a submission attempt), renders the message instead, and focuses the first such control in document order (module-level collector, works in any form). A `checkValidity()` or `reportValidity()` call, and a Field without `Field.Error`, keep the platform's behaviour. Before hydration the bubble is the fallback. |
| 7 | Submission | `Form.Root` renders `<form action={action}>` **unwrapped** (progressive enhancement: the server HTML posts to the Server Function) and, after hydration, intercepts `submit`: `preventDefault()` and `await action(formData)` inside the Form's own `useTransition`. react-dom then skips its own action run (and its automatic reset) and still starts the form's pending status, so `useFormStatus` and `Form.Submit` work unchanged. A submitter with its own `formaction` and a string `action` are left to React / the browser. |
| 8 | Reset policy | `autoReset` (default `true`): the form is reset when a submission the Form ran **settles with no errors** (`errors` has no non-empty entry at the settle commit, hidden stale ones included). A submission that returns field errors leaves every value, `:user-invalid` and custom validity in place. `false`: never; the consumer resets. |
| 9 | Server errors | `Form.Root errors` (keyed by field `name`, from `useActionState`'s result or anything else) reach each Field through context. Shown at once, `setCustomValidity`'d, cleared by the field's next edit; the Form focuses the first errored field after the settle. An error for a field whose value changed while the submission was in flight is not shown (it was about a value the user already replaced), and stays hidden until the next settle, also while the next submission is in flight (3.4). |
| 10 | Pending | `Form.Root` and `Form.Submit`: `data-pending` while the submission's transition is pending (`useFormStatus`). `Field.Root`: `data-pending` from `useFormStatus().pending` of the enclosing form, the one deliberate exception to "a part never folds the form channel into its own `pending`", because a Field has no action of its own. Controls inside keep their own `data-pending` for their own actions. |
| 11 | Repeat submits | Not dropped while pending: a `useActionState` dispatch queues them in order (React's own semantics; conventions 2.5 names forms as the ordered-actions case); a plain action runs concurrently. Consumers block with CSS on `Form.Submit[data-pending]`. |
| 12 | Directives | Every part file is `"use client"` (context, `useId`, `useFormStatus`). Server Components may render all parts with serialisable props: `Form.Root action={serverFn} errors={…}`, `Field.Root name required`; `validate` is a function and needs a client component. |

---

## 1. Anatomy

```tsx
import { Field } from "@funstack/ui/field";
import { Form } from "@funstack/ui/form";

<Form.Root action={formAction} errors={state.errors}>              {/* form */}
  <Field.Root name="email">                                        {/* div */}
    <Field.Label>Email</Field.Label>                               {/* label[for] */}
    <Field.Control type="email" required autoComplete="email" />  {/* input */}
    <Field.Description>We never share it.</Field.Description>     {/* p[id] */}
    <Field.Error />                                                {/* div[id], only while invalid */}
  </Field.Root>
  <Field.Root name="newsletter">
    <Field.Label>Newsletter</Field.Label>
    <Checkbox />                                                   {/* any FUNSTACK control, section 7 */}
  </Field.Root>
  <Form.Submit>Create account</Form.Submit>                         {/* button[type=submit] */}
</Form.Root>
```

Rendered HTML (idle, no error; ids come from one `useId` in `Field.Root`):

```html
<form action="…">                                                 <!-- the Server Function's endpoint on the server -->
  <div data-required="">
    <label id="_r_1_-label" for="_r_1_-control">Email</label>
    <input id="_r_1_-control" name="email" type="email" required autocomplete="email"
           aria-describedby="_r_1_-description" aria-invalid="false">
    <p id="_r_1_-description">We never share it.</p>
  </div>
  <div>
    <label id="_r_2_-label" for="_r_2_-control">Newsletter</label>
    <input id="_r_2_-control" name="newsletter" type="checkbox" aria-describedby="_r_2_-description" aria-invalid="false">
  </div>
  <button type="submit">Create account</button>
</form>
```

After a submission attempt with the email empty (the Field cancelled the bubble, rendered the
message, and focused the control):

```html
<div data-required="" data-invalid="">
  <label id="_r_1_-label" for="_r_1_-control" data-invalid="">Email</label>
  <input id="_r_1_-control" name="email" type="email" required
         aria-describedby="_r_1_-description _r_1_-error" aria-invalid="true" data-invalid="">
  <p id="_r_1_-description">We never share it.</p>
  <div id="_r_1_-error" data-invalid="">Please fill out this field.</div>   <!-- the browser's localised message -->
</div>
```

| Part | Element | Role (native) | Library state rendered | Notes |
| --- | --- | --- | --- | --- |
| `Field.Root` | `div` | | `data-invalid`, `data-disabled`, `data-required`, `data-pending` (form channel) | Owns `useId`, `name`, `disabled`, `required`, `validate`, the validity mirror, the control registration and the listeners. `children(state)` receives `FieldState`. |
| `Field.Label` | `label` | | same four attributes | `id`; `for` → the control id while the registered control is labelable (default); a group control (a `<fieldset>` Root) removes it and names itself with `aria-labelledby` → this id. |
| `Field.Control` | `input` (`textarea` / `select` through `render`) | the element's | `data-invalid`, `data-disabled`, `data-required`, `data-pending` | `id`, `name` (the Field's unless given), `disabled` / `required` (own or the Field's), `aria-describedby` (token-merged), `aria-invalid`. The native constraint attributes are ordinary pass-through. Must stay a native form control. |
| `Field.Description` | `p` | | same four attributes | `id` = `${id}-description`; always referenced by the control's `aria-describedby` (a dangling reference is skipped, the Dialog rule), so no registration. |
| `Field.Error` | `div` | | same four attributes | `id` = `${id}-error`; renders **nothing** while `invalid` is false. Default content: the messages (`validationMessage` for a native or custom constraint, the server's text for a server error). Its mount registers "an error element exists" so the Field knows it may cancel the bubble. |
| `Form.Root` | `form` | form | `data-pending` | Owns the submission intercept, `errors`, the submitted `FormData` (for the stale-value rule), the first-error focus, the cross-field refresh and the reset policy. `children(state)` receives `{ pending }`. |
| `Form.Submit` | `button` | button | `data-pending`, `data-disabled` | `type="submit"`; `useFormStatus().pending` of the enclosing form. `name` / `value` pass through (the submitter's value reaches the action's `FormData`). |

Why these parts:

- **`Field.Root` is a `div`, not a `<fieldset>`.** A fieldset carries the `group` role and legend
  naming, which belong to the group controls (RadioGroup, CheckboxGroup) and not to a text field,
  and its layout quirks are well known. `disabled` and `required` propagate through context to
  the control instead of through fieldset inheritance.
- **`Field.Control` exists** for the plain native control, which is the common case and the
  JS-free one. It does nothing a FUNSTACK control does not also do inside a Field: it calls the
  same internal hook (section 7). `render={<textarea />}` and `render={<select />}` keep it a
  native control; the hook warns in development for any other element. It works inside a Field
  or alone: outside a `Field.Root` it is the plain control with nothing added (4.3).
- **`Field.Error` is library-mounted** (rendered only while an error is shown) so that the
  consumer writes it once, unconditionally, and the accessible description is exactly the visible
  text. One `Field.Error` per Field (a second is a dev warning): messages are a list, so a single
  element with function `children` covers the per-constraint wording that Radix and Base UI spell
  with several `match` elements.
- **`Field.Description` is always wired**, mounted or not, like `Dialog.Description`: a
  deterministic id and no registration keep the server HTML exact.
- **`Form.Root` is a part** because the three things React's form channel does not do (keep the
  user's input after a failed validation, route field errors to fields, focus the first error)
  need the `submit` event, the `FormData` and the settle edge of one form, and because
  `data-pending` on the form is the library's vocabulary for "an action is in flight".
- **`Form.Submit` is a part** so that the pending vocabulary is uniform: `data-pending` and
  `state.pending` on the button the user pressed, as on every trigger in the library, without
  each consumer writing the `useFormStatus` component by hand. `Dialog.Form`'s docs can point to
  it.
- **No `Form.Field`** (Radix) and **no `Field.Validity`** (Base UI): Field is its own namespace
  so it works in any form (a plain `<form>`, `Dialog.Form`, a form the consumer owns), and
  function `children` on `Field.Error` / `Field.Root` give the validity state without a part.

Element constraints for `render`: `Field.Control` must render an `<input>`, `<textarea>` or
`<select>`; `Field.Label` a `<label>`; `Form.Root` a `<form>`; `Form.Submit` a `<button>` (a
`render={<input type="submit" />}` is also a submitter and works). The library warns in
development when the mounted element is wrong.

---

## 2. Validity: one source of truth

### 2.1 Three kinds of constraint, one `ValidityState`

| Constraint | Where it lives | Example | Message |
| --- | --- | --- | --- |
| Native | the control's attributes, rendered by the consumer (and, for `required`, by `Field.Root required`) | `required`, `type="email"`, `pattern`, `minLength`, `min` / `max` / `step` | the browser's, localised (`validationMessage`) |
| Custom | `Field.Root validate(value, formData)`; sync; written into the control with `setCustomValidity` | "Passwords do not match" | the string(s) `validate` returned |
| Server | `Form.Root errors[name]` (from `useActionState`'s result, a loader, anything); written with `setCustomValidity` while shown | "This email is already registered" | the string(s) in `errors[name]` |

All three end up in the control's `validity`: the native flags, and `customError` for the other
two. That is why the Field has no `invalid` prop and no validity of its own: the DOM's
`ValidityState` is read into a plain snapshot, `FieldValidity`, and that snapshot is the
`validity` every function prop receives.

**The custom-validity slot is owned by the Field.** `setCustomValidity` holds one string, and
the Field writes it after every event it observes:

```
customMessage = serverShown ? serverMessages.join("\n")
              : (validate?.(value, formData) normalised) ?? ""
control.setCustomValidity(customMessage)
```

A server error wins while it is shown (the user has not edited the field since it arrived);
afterwards `validate` decides. A control inside a Field must not call `setCustomValidity` itself
(CheckboxGroup's "at least one" stays the attribute-based constraint of conventions 3.6, which is
a native constraint and unaffected).

`validate` runs: once at mount (layout effect), on every `input` and `change` that bubbles to the
**form owner** (so a cross-field rule such as "confirm equals password" is re-evaluated when the
other field changes), after a commit in which a FUNSTACK control inside **any** Field of the
`Form.Root` changed its value without an event (a Combobox selection, a CheckboxGroup Parent
checking its Items, a controlled change, a rolled-back optimistic value; the control's
`useFieldValueChange` tells its Field, and the Field asks the Form to refresh the others, 7.1),
on blur and on a submission attempt (the mirror's reads recompute the slot too), after a `reset`
(`useFormReset`, when the values are the reset values), and after a commit in which the `validate`
prop changed (by identity: keep it stable with `useCallback` or a module-level function, see the
note under 4.1). `value` is `formData.get(name)` when it is a string, else `""`; `formData` is
`new FormData(form)` (or an empty `FormData` for a field with no form owner). `validate` is
**sync in v1**; an async or debounced validator is a v2 question (section 12).

**`setCustomValidity` is cleared on the control's next edit**, which is the research's finding
2: a custom message persists until cleared and would block the next submission even after the
user fixed the value. "Cleared" means recomputed: the server message is dropped (the field was
edited, 3.4), and `validate` runs again on the new value. An edit is an `input` or `change`
event on the control, or a FUNSTACK control's `notifyChange(true)` for a change the user made
with no event (a Combobox pick, 7.1).

### 2.2 When an error is shown

```
userInvalid = control.matches(":user-invalid")      // read on: input, change, focusout, invalid, after reset
serverShown = serverMessages.length > 0 && !dismissed && !suppressed   // section 3.4
invalid     = userInvalid || serverShown
```

`:user-invalid` is the platform's heuristic and the library does not re-implement it: it starts
matching after the user changed the value and left the field, or after a submission attempt
(including one whose `invalid` event was cancelled, verified in both engines), then updates live
on every keystroke, and stops matching after a form reset. A `typeMismatch` while the user is
still typing their first email address is therefore not shown; an empty `required` field is not
shown as an error until the user tries to submit or leaves it. `Field.Root` offers no
`validationMode`: Base UI's `onBlur` / `onChange` modes are this heuristic made configurable, and
the platform's single answer is the one every native form on the web already uses.

The read happens in the Field's own listeners on the registered control (capture, so the events
of a group's members are seen on the group's `<fieldset>`): `input`, `change`, `focusout`,
`invalid`; plus `reset` on the form owner through `useFormReset` (a reset clears the
user-validity flag, so the Field re-reads after the reset algorithm, when the DOM holds the
reset values: conventions 3.8 rule 5, also after a click on a reset button). The `invalid` listener is the one that fires for a submission attempt: it
fires once per invalid control, synchronously, before `submit` would (which never comes).
After an `input` or `change` (the control's own, or another field's on the form owner) the
mirror is read once the event's dispatch is over (2.4).

Where `:user-invalid` is not supported by the environment (jsdom), the Field falls back to
"`invalid` fired for this control and it is still invalid" (cleared by reset), which is identical
to the platform's answer for the submission-attempt case and misses only the changed-then-blurred
case. The fallback engages where `CSS.supports("selector(:user-invalid)")` is false (jsdom 30's
selector engine knows the name and silently answers `false` to `matches()`, so "when `matches`
throws" would never have engaged; developer finding); it is a test aid, not a browser path
(section 13).

### 2.3 `aria-invalid`, explicit

The research's finding 3: Chromium exposes a native `customError` or `typeMismatch` as `invalid`
to assistive technology at once (too early) and never exposes `valueMissing` (too late).
`aria-invalid` overrides the native state in both directions, so the control renders
`aria-invalid={invalid ? "true" : "false"}`, always explicit. `"false"` is the ARIA default and
harmless; it is what stops Chromium announcing "invalid entry" while the user is still typing
their email.

### 2.4 The display state is urgent

`invalid`, `messages` and `validity` are a **mirror of browser-owned state** (`:user-invalid`,
`validity`, `validationMessage` are the DOM's, changed by the browser before the library hears of
them). They are written with plain `useState` from the DOM event, never inside `startTransition`,
for two reasons that are specific, as the vision's urgent opt-out requires:

1. **Focus must find the error.** When a submission attempt fails, the Field cancels the bubble
   and focuses the first invalid control in a microtask (2.5). Assistive technology reads the
   control's description at focus time; the `Field.Error` text and the `aria-describedby` token
   must already be in the DOM. A transition commit would land later, and later still while any
   async action is pending anywhere (conventions 2.3 item 5), including the submission the user
   just made in another form.
2. **Nothing is awaited and nothing can roll back.** There is no action, no optimistic value and
   no consumer veto on "the field is invalid": the DOM already says so. This is the same category
   as Combobox's active option and Slider's `live` value (conventions 3.2: "it is focus, which is
   immediate and browser-owned everywhere else").

**Edits: the slot in the listener, the state after the dispatch.** On an `input` or `change`
(the control's own, or another field's on the form owner) the Field writes the custom-validity
slot in its listener, so the platform's validity follows the new value at once (an Enter in the
next task submits against it), and writes no React state there. The state (the mirror, a
dismissal of the server error, the stale-value flag of 3.4) is written through `afterDispatch`
(internal-hooks.md 3.8 rule 5), which recomputes the slot first: a controlled parent that did
not adopt the value has had React restore the old one by then. The reason is the order of
listeners: the Field's listener is on the control and React's on the root, so it runs first,
and Chromium runs a microtask checkpoint after each listener of an `input` or `change` the user
caused (Firefox only after the whole dispatch). A state write in the Field's listener committed in that checkpoint, before React had
seen the event, and the commit wrote a controlled control's previous `value` back over the
keystroke (#193: a Combobox's text, a controlled `Field.Control`, a `Select`, OTPField). It is
still urgent, not a transition: the deferred writes are committed synchronously (`flushSync`; the
dispatch is over, so nothing can be clobbered any more), in a task after the event where the
engine is still dispatching at the first microtask checkpoint (Chromium), else in that
microtask (a script dispatch, Firefox's `input`). Without `flushSync` a write made outside any
event would get React's default lane and could let a frame paint the previous error state.
`invalid`, `focusout` and the reset keep their timing: no user edit is in flight in them. Until
the edit's state write, the edit already counts for the slot: a refresh in between (a blur, a
submission attempt) leaves a server message the user edited away out of it.

Consequences: Field parts have **no `transition` prop** (an urgent commit never starts a view
transition, conventions 5.1, third category), `Field.Error` animates its appearance with CSS
`@starting-style` and has no exit animation in v1, and content rendered inside `Field.Error` or
through a Field part's `children` function **must not suspend** (an urgent render that suspends
shows the nearest fallback; the same rule as every trigger part).

The server-error half arrives through the Form's settle, which is a transition commit (the action
state's result and `useFormStatus`'s `NotPending` land together); the Field renders `serverShown`
from props and context in that same commit, then the Form's effect focuses the first errored field
(3.5). The order "error in the DOM, then focus" holds on both paths.

### 2.5 The bubble, cancelled; the focus, restored

The native validation bubble is not styleable, disappears on its own, and shows one field at a
time; the research's verdict is to avoid it as the error UI. After hydration the Field listens to
`invalid` on its control and, **when both hold**:

- a `Field.Error` is mounted in this Field (it registered from its layout effect), so the message
  will be visible somewhere; and
- the control matches `:user-invalid` at that moment, which is true for a submission attempt
  (the submit algorithm sets user validity before validating) and false for a bare
  `form.checkValidity()` (no UI expected) or `reportValidity()` (the platform's UI is expected),

it calls `event.preventDefault()` (no bubble), updates the mirror (the error renders), and hands
the control to the module-level **first-invalid collector**: every Field that cancelled an
`invalid` during the current task adds its focus target; a microtask later the collector focuses
the first one in document order and clears. Cancelling `invalid` also cancels the browser's own
focus move (finding 4), which is why the library does it; focusing in a microtask makes "first in
document order" independent of the browser's dispatch order and of how many forms are on the page.
The collector skips the focus when something inside the same form already received focus during
the attempt (a plain `<input required>` with no Field keeps the native behaviour, bubble and
focus, and the library does not fight it).

The focus target is the control; for a group (`<fieldset>`) it is the first enabled **named**
member (RadioGroup: the checked radio if any, else the first; CheckboxGroup: the first Item, never
a `CheckboxGroup.Parent`, which has no `name`; the validity element is resolved the same way). It
is focused with `focus()`, which scrolls it into view.

**When focus is already on the first invalid control**, `focus()` moves nothing and nothing is
read: this is the implicit submission (Enter in a text field that is itself the first invalid
one), where the cancelled bubble was the platform's announcement. The collector then speaks the
Field's messages through `element.ariaNotify()` (feature-checked; every supported engine has it,
research survey; nothing elsewhere), once per attempt, and never after a focus move in the same
batch. A blur-and-refocus was the alternative; it is noisier and moves the caret. Product-owner
decision (review M2).

A Field with no `Field.Error` mounted leaves the event alone: the platform shows its bubble and
focuses the control, as before. Before hydration no listener exists, so the bubble is the
fallback on the server-rendered page (section 8).

---

## 3. Submission: `Form.Root`

### 3.1 Two paths, one markup

```tsx
// In a client component
const [state, formAction] = useActionState(signUp, { errors: {} });   // signUp: "use server"

<Form.Root action={formAction} errors={state.errors}>…</Form.Root>
```

`Form.Root` renders `<form action={action}>` with the function **unwrapped**, exactly as
`Dialog.Form` does, so React's server renderer emits the Server Function's endpoint (and the
`useActionState` permalink and hidden fields) and a submission before hydration posts to the
server. After hydration the Form installs its own `onSubmit`:

```ts
// inside FormRoot (prop-form handler; `onSubmit` is omitted from the props type, conventions 1.5)
onSubmit={(event) => {
  if (typeof action !== "function") return;                       // a navigating form: the browser's
  const submitter = event.nativeEvent.submitter;
  if (submitter?.hasAttribute("formaction")) return;              // a per-button action: React's own path
  event.preventDefault();                                         // react-dom now skips its action run and its reset
  const formData = new FormData(event.currentTarget, submitter);
  submission.current = { formData, intercepted: true };
  startOwnTransition(async () => {                                // the Form's useTransition
    await action(formData);                                       // a Server Function, a useActionState dispatch, or a client function
  });
}}
```

What react-dom does with that (its submit plugin, read for this design): because the native event
is `defaultPrevented` it does **not** call `action` and does **not** schedule the automatic
reset; because a transition lane was requested in the same event (the Form's own
`startTransition` always does), it starts the form's **host transition with no action**, so
`useFormStatus()` reports `pending: true` with `data`, `method` and `action` for every reader in
the form (`Form.Submit`, `Field.Root`, a consumer's own component, also through a portal), and its
`NotPending` update is entangled with the Form's async transition, so it lands when the action
settles. The research verified this shape without an `action` prop on the form (probe F8b); the
only addition here is that the `action` attribute is also rendered, which the plugin only reads
when the event was not cancelled. The first browser test row of section 13 pins the combination.

`useActionState`'s dispatch returns nothing and queues the action; a plain Server Function or
client function is awaited directly. The Form never reads a return value: a result reaches the
Fields only as the `errors` prop (3.3). Interactive constraint validation runs before `submit`
fires, so an invalid form never reaches the handler on either path.

| | Intercepted (function `action`, ordinary submitter) | React's path (submitter with `formaction`) | Browser (string or no `action`) |
| --- | --- | --- | --- |
| Who runs the action | the Form, inside its `useTransition` | react-dom's host transition | navigation |
| `useFormStatus` | pending with `data`, `method`, `action` | pending | n/a |
| Automatic reset | **never**; the Form resets on a settle with no errors (`autoReset`) | after every successful action (React) | n/a |
| Errors thrown by the action | the Form's transition rejects: nearest Error Boundary above `Form.Root` | the host transition rejects: same boundary | n/a |
| `errors` and the settle edge (re-arm, focus) | yes | yes (the watcher and every Field see the edge) | n/a |
| A `render` element's own `onSubmit` calling `preventDefault()` | cancels the submission (the Form runs nothing; React's plugin skips a prevented submit too) | same | the browser's |

### 3.2 Pending and the settle

`Form.Root`'s `pending` is `isPending` of its own transition **or** the form's status seen by a
`FormStatusWatcher` child (the Dialog.Form component, reused), so it is true on both paths and
covers the Suspense wait of whatever the result re-renders. `data-pending` goes on the form and
`state.pending` into `children(state)`. The settle is the status's `true → false` edge. It is
seen twice, on purpose:

1. **By every `Field.Root`, in the settle render.** Each Field reads `useFormStatus()` itself
   and, on its `true → false` edge (the render-phase derived-state pattern), re-arms: `dismissed`
   is cleared and the flight's "suppress at the next settle" flag is promoted to `suppressed`
   (3.4). The action's result (`errors`) and the status's `NotPending` land in the **same
   commit**, so the next errors are in the DOM, slot written, when the Form's effect runs. A Form
   effect advancing a counter one commit later (the first draft's "settle generation") would have
   focused a field whose new error was not rendered yet and whose slot did not block yet
   (developer choice 1, agreed by the review).
2. **By the Form, in its settle effect** (the `FormStatusWatcher` child, the Dialog.Form
   component reused, as Dialog 8.1), in this order:
   1. if any registered Field **shows** a server error at this commit (`serverShown`, which
      already excludes dismissed and hidden stale ones): **focus** the first such Field's target
      in document order (3.5), or announce when focus is already there;
   2. otherwise, if `autoReset`, the submission was intercepted, and `errors` (the prop at this
      commit, read through `latest`) has **no non-empty entry at all**, hidden stale entries
      included: `form.reset()`. A result that flags only a value the user replaced during the
      flight (walkthrough 5) therefore resets nothing: the user's new value stays and is
      submitted next (developer choice 3; the first draft's "no non-empty, non-suppressed entry"
      would have wiped it).

`form.reset()` from the effect, not `requestFormReset`: the latter must run inside a transition
and resets at that transition's commit, which here would be a second commit for the same result;
the plain call fires the same `reset` event every native-input component and every Field already
listens to (conventions 3.8), in the same task as the settle commit. A reset after success is
what React does by default and what a "create" form expects; a "save settings" form whose values
should persist passes `autoReset={false}`, and a settings form whose defaults come from the
server gets the new defaults applied before the reset anyway (React's `defaultValue` rule).

### 3.3 `errors`

```ts
export type FieldErrorValue = string | readonly string[] | null | undefined;
export type FormErrors = Readonly<Record<string, FieldErrorValue>>;
```

Keyed by field **`name`**; `""`, `[]`, `null` and `undefined` mean no error. The object usually
is the action state's own (`state.errors`), but it can be anything: a loader result, a prop from a
Server Component (serialisable), or a constant for a story. A form-level message (not about one
field) is the consumer's own markup; the library reserves no key for it.

The Form never interprets a return value, so a result reaches the Fields only through this prop:
"use `useActionState` and pass `state.errors`" is the documented pattern, and it is the one React
itself documents for field errors. An action that **throws** does not produce `errors`: the
transition rejects, the boundary handles it, no settle effect runs and nothing is reset.

### 3.4 Server errors on a Field: shown, dismissed, re-armed, suppressed

A `Field.Root` inside a `Form.Root` reads `{ errors, submittedData }` from the Form context and
keeps three flags of its own. For its `name`:

- `serverMessages` = `errors[name]` normalised to `readonly string[]`.
- `dismissed` = the user edited the control (`input` or `change` on it, or a FUNSTACK control's
  `notifyChange(true)`) **since the last settle**: set by the edit, cleared by the Field on its
  own `useFormStatus` `true → false` edge (3.2), so a settle re-arms every field at once with no
  reset bookkeeping, and the next submission's errors are shown even when they are the same
  strings (the research's "clearing a server error on next input", with a precise re-show rule).
  It is kept as the count of settles the Field had committed when the edit happened (dismissed
  while it equals the current count), not as a flag: an edit's state write lands after its
  event's dispatch (2.4), and when that event started a submission (OTPField's
  `submitOnComplete`, an Enter) the write, or React's rebase of it over the settle's
  render-phase update, would otherwise hide the answer to the very submission it preceded.
- **Two hide flags for a stale value** (review M1). `suppressNext` is written during a flight:
  every refresh while the form is pending and the Form ran the submission compares
  `formData.getAll(name)` with `submittedData().getAll(name)` (string entries element-wise; a
  `File` counts as unchanged) and records whether the value differs from what was sent. It is
  reset to `false` on every `submit` event (a queued second submission sends the current values,
  and never crosses a pending edge) and at the `false → true` edge. At the `true → false` edge it
  is **promoted** to `suppressed`, which then stays **fixed until the next settle**. The split is
  what keeps a hidden stale error hidden while the next submission is in flight: `errors` still
  holds the old result during that flight, `dismissed` was cleared at the settle, and a single
  flag cleared on `submit` re-showed "a@b.c is taken" for a value the server never judged, blocked
  a queued second click through the slot and moved focus (the review's reproduction). The first
  draft's per-generation set had the same frozen-until-settle property; the two flags keep it in
  the per-Field model.
- `suppressed`: the user changed the value while the submission was in flight, so the error is
  about a value they already replaced; showing it would also block the resubmission of the new
  value through `setCustomValidity` until they edited the field again.
- `serverShown` = `serverMessages.length > 0 && !dismissed && !suppressed`.

While `serverShown`, the Field writes the messages into the custom-validity slot (2.1), so the
control matches `:invalid` and `:user-invalid`, `validity.customError` is true, and a resubmission
with the unchanged value is blocked by the browser (the `invalid` event then runs the usual
cancel-and-focus path, 2.5: "fix this first"). On the user's next `input` the slot is recomputed
without the server message and the error disappears; `validate` or a native constraint may of
course keep the field invalid for their own reasons.

Errors present at mount (initial action state, a server-rendered page after a progressive
enhancement post-back, a Server Component prop) are shown: nothing was dismissed, nothing is
suppressed. The Form does not focus on mount (3.5). A Field **outside** any `Form.Root` has no
server-error channel (`validate` and native constraints only).

Why the settle edge and not the `errors` object's identity: the identity changes on every render
for an inline object (`errors={{ email: state.emailError }}`), which would re-show a dismissed
error on every keystroke of a controlled form. The cost of the edge rule is that an `errors`
change that did **not** come from a submission through this Form (a consumer updating the object
from elsewhere after the user dismissed the error) is not re-shown until the next settle;
documented, and rare.

### 3.5 Focusing the first errored field

After a settle with errors (3.2) the Form focuses the first Field, in document order, that shows a
server error (`serverShown` at this commit). Fields register `{ getFocusTarget, showsServerError,
serverMessages, refresh }` with the Form from a layout effect (the Form sorts by
`compareDocumentPosition` at settle time, so the registration order does not matter). The focus
target is the control, or for a group its first enabled named member (2.5). The effect runs after
the commit that rendered the errors, so the control's description already lists the error (2.4).

When the target **already has focus** (the user pressed Enter in that very field and the server
rejected it), `focus()` does nothing and a changed `aria-describedby` on the focused element is
not announced by NVDA or VoiceOver. The Form then speaks the Field's server messages through
`target.ariaNotify()` instead (the same fallback as the collector's, 2.5; review M2,
product-owner decision). Nothing is announced when focus moved: the description is read at focus.

No focus on mount, even with initial errors: focusing on page load is the kind of focus move
assistive-technology users complain about, and a progressive-enhancement post-back lands on a
fresh page where the consumer decides (an error summary with `tabIndex={-1}` and `autoFocus`, or
nothing). No focus when the errors have no matching Field (a form-level message): the consumer
renders that message and decides.

### 3.6 Repeat submissions, resets in flight, errors thrown

- **A second submit while pending is not dropped.** A `useActionState` dispatch queues it after
  the first (React's action queue; conventions 2.5 names forms as the component class that uses
  it); a plain function runs concurrently and the consumer orders or guards it. The Form's
  `pending` stays true until the last settles; one settle per status edge, which for
  queued actions is one edge for the whole run (the status does not flicker between queued
  actions). The queued submit's `submit` event resets every Field's `suppressNext` (3.4), since it
  sends the values of that moment. Consumers who want to block the button do it with CSS on `Form.Submit[data-pending]`
  (conventions 3.6: never natively disabled while pending).
- **A user reset while pending** (`<button type="reset">`): the values go back to their defaults
  and `:user-invalid` clears; every control listening to `reset` dispatches its platform change.
  When the result arrives, its errors are about values that changed → hidden (`suppressNext`
  promoted at the settle, 3.4), which is the right answer for a form the user just emptied, and
  they stay hidden through the next flight.
- **The action throws** (a network failure, a thrown redirect): the Form's transition rejects
  and the error reaches the nearest Error Boundary above `Form.Root`. Nothing is reset, no
  settle effect runs, `pending` ends with the boundary's commit. A boundary inside the page
  shell replaces the form; a consumer who wants the form to survive catches inside the action and
  returns errors, which is what `useActionState` is for. This is the **latest** submission's
  rejection while the Form is mounted and visible; a superseded submission's (a plain function
  action run twice), or one that settles after the Form unmounted or was hidden, goes to
  `reportError` (`reportDropped` / `useConnected`, conventions 2.4).
- **The action redirects** (a framework `redirect()` throws a special error): same as above from
  the Form's point of view; the framework's boundary handles it.
- **Children suspend after the settle** (the result re-renders a suspending list): the settle
  commit waits, `pending` stays true, the errors appear together with the content (Suspense-native
  order, as Dialog 8.1).

---

## 4. Props and types

Shared types come from `packages/ui/src/internal/types.ts`. Every Field part's function props
(`className`, `style`, `children`, `render`) receive the same `FieldState` (one state object for
the whole Field, see conventions feedback 10).

### 4.1 `Field.Root`

```ts
/** A plain, serialisable snapshot of the control's `ValidityState` (all `false` and `valid: true` on the server and before the first read). */
export interface FieldValidity {
  readonly valueMissing: boolean;
  readonly typeMismatch: boolean;
  readonly patternMismatch: boolean;
  readonly tooLong: boolean;
  readonly tooShort: boolean;
  readonly rangeUnderflow: boolean;
  readonly rangeOverflow: boolean;
  readonly stepMismatch: boolean;
  readonly badInput: boolean;
  readonly customError: boolean;
  readonly valid: boolean;
}

export interface FieldState {
  /** An error is shown: the control matches `:user-invalid`, or a server error for this field is shown. */
  readonly invalid: boolean;
  /** The messages shown: `[validationMessage]` for a native or custom constraint, the server's strings for a server error; `[]` while valid. */
  readonly messages: readonly string[];
  readonly validity: FieldValidity;
  readonly disabled: boolean;
  readonly required: boolean;
  /** The enclosing form's submission is in flight (`useFormStatus().pending`); `false` outside a form. */
  readonly pending: boolean;
}

export type FieldValidate = (value: string, formData: FormData) => FieldErrorValue;

export interface FieldRootProps
  extends Omit<ComponentPropsWithRef<"div">, "className" | "style" | "children"> {
  /** Form field name: the control's default `name`, the key in `Form.Root errors`, and the entry `validate` reads. */
  name?: string;
  /** Disables the control (native `disabled`) and marks every part `data-disabled`. */
  disabled?: boolean;
  /** Makes the control `required` (native) and marks every part `data-required`. */
  required?: boolean;
  /**
   * A custom constraint, written into the control with `setCustomValidity`. Sync. Receives the
   * field's submitted value (`formData.get(name)` as a string, `""` when absent) and the whole
   * form's `FormData`, so a cross-field rule can read the other field. Runs at mount, on every
   * `input` / `change` in the form (and a FUNSTACK control's value change), on blur, after a
   * reset, on a submission attempt, and when this prop changes (by identity: keep it stable with
   * `useCallback` or a module-level function). Return a string or strings for an error,
   * `null` / `undefined` / `""` for none. Shown when the platform's `:user-invalid` heuristic
   * says so, like a native constraint. Not serialisable: a Field with `validate` is rendered
   * from a client component.
   */
  validate?: FieldValidate;
  className?: StateValue<string | undefined, FieldState>;
  style?: StateValue<CSSProperties | undefined, FieldState>;
  children?: StateValue<ReactNode, FieldState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, FieldState>;
}
```

Owned keys: `data-invalid`, `data-disabled`, `data-required`, `data-pending`. `Field.Root` has no
`id` of its own; the ids live on the parts. Nesting a `Field.Root` inside another is a dev
warning (the inner control would register with the inner Field only).

**`validate` and the prop's identity** (review L4, product-owner decision). A new `validate`
function **takes effect at the commit in which the prop changed**, as 2.1 says: the slot effect
is keyed on the function's identity. The review pointed out the cost: an inline function changes
identity on every render of the Field, including both pending edges of every submission, and
each run builds a `FormData` of the whole form (O(fields × form size) per render in a large
form). The fix commit ae4640d read `validate` through a latest-ref instead, so a new function was
used only from the next read (an edit, blur, reset or attempt): cheaper, but a rule that closes
over outside state (`validate={(v) => v === other ? null : "…"}`) then stayed stale until the
user touched the form, and the docs had to say "derive the rule from its arguments". The product
owner chose the 2.1 semantics: a changed prop is a changed constraint and must be visible at once,
as a changed `pattern` would be; the cost is the consumer's to avoid with `useCallback`, which the
prop doc and the docs page recommend. The latest-ref read was **reverted in d94c22f**: the slot
effect is keyed on `validate`'s identity again, the JSDoc says "in every commit in which this
prop changed identity" with the `useCallback` advice, and the docs page and the `field.test.tsx`
row match.

### 4.2 `Field.Label`, `Field.Description`, `Field.Error`

```ts
export interface FieldLabelProps
  extends Omit<ComponentPropsWithRef<"label">, "htmlFor" | "id" | "className" | "style" | "children"> {
  className?: StateValue<string | undefined, FieldState>;
  style?: StateValue<CSSProperties | undefined, FieldState>;
  children?: StateValue<ReactNode, FieldState>;
  /** Must render a `<label>`. */
  render?: RenderProp<ComponentPropsWithRef<"label">, FieldState>;
}

export interface FieldDescriptionProps
  extends Omit<ComponentPropsWithRef<"p">, "id" | "className" | "style" | "children"> { /* same three + render */ }

export interface FieldErrorProps
  extends Omit<ComponentPropsWithRef<"div">, "id" | "className" | "style" | "children"> {
  className?: StateValue<string | undefined, FieldState>;
  style?: StateValue<CSSProperties | undefined, FieldState>;
  /**
   * Rendered only while `state.invalid`. Default: `state.messages` joined by a space. A function
   * gets the state: `({ validity, messages }) => validity.valueMissing ? "Enter your email" : messages.join(" ")`.
   * Must not suspend (urgent render, section 2.4).
   */
  children?: StateValue<ReactNode, FieldState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, FieldState>;
}
```

Owned keys: `Label`: `id`, `htmlFor` (present while the registered control is labelable, which is
the default before any control registers; removed when a group control registers), `onClick`
(composed with the consumer's), the four `data-*`. **A `<button>` control** (MultiSelect's
Trigger, `design/components/multi-select.md` B.8): a `<label for>` would forward its click to
the button and activate it, so the Label's click is cancelled and the button is focused instead
(unless it is disabled), as a label focuses a `<select>` without opening it. Every other control
keeps the platform's label activation. `Description`: `id`, the four `data-*`. `Error`: `id`, the four `data-*`. None of them
takes `role`-changing props from the library: `Field.Error` has no `role="alert"` and no
`aria-live` (research §2: the focus move reads the description; a live region would read it twice
and has broken `aria-describedby` in older VoiceOver), and a consumer who wants an announcement for
a blur-time error adds `aria-live="polite"` through pass-through, accepting the double read after
a submission.

`Field.Error` registers its presence with the Field from a layout effect (2.5) and unregisters on
unmount. It renders `null` while `invalid` is false: no element, no id in the DOM, and the
control's `aria-describedby` does not list the error id either, so nothing dangles **while
valid**. While invalid the error id is listed whether or not a `Field.Error` is mounted (the
count of mounted errors is a ref, not state, and gating the token on it would cost a render for
nothing); without one the reference dangles, which the platform ignores, as it does for an
unmounted `Field.Description` (developer choice 5, accepted by the review as L5).

### 4.3 `Field.Control`

```ts
export interface FieldControlProps
  extends Omit<ComponentPropsWithRef<"input">, "aria-invalid" | "className" | "style"> {
  /** Native `id`, outside a Field only; inside a Field the Field's (owned). */
  id?: string;
  /** Native `name`; defaults to the Field's `name`. */
  name?: string;
  /** Native `disabled`; the Field's `disabled` also disables the control. Owned. */
  disabled?: boolean;
  /** Native `required`; the Field's `required` also requires the control. Owned. */
  required?: boolean;
  className?: StateValue<string | undefined, FieldState>;
  style?: StateValue<CSSProperties | undefined, FieldState>;
  /** Must render an `<input>`, `<textarea>` or `<select>`: `render={<textarea rows={3} />}`. */
  render?: RenderProp<ComponentPropsWithRef<"input">, FieldState>;
}
```

No `children` prop (`<input>` is void; a `render={<select />}` carries its options on the render
element, as `Select.Root`'s do). Owned keys inside a Field: `id`, `name`, `disabled`, `required`,
`aria-invalid`, `aria-describedby` (token-merged with the consumer's, the consumer's tokens
first), `data-invalid`, `data-disabled`, `data-required`, `data-pending`. Everything else is
pass-through: `type`, `defaultValue`, `value` / `onChange` for a controlled input, `pattern`,
`minLength`, `autoComplete`, `inputMode`, `placeholder`, `onBlur`, … The library's own listeners
are native (`addEventListener` through the ref, section 14), so no `on*` prop is omitted and the
consumer's `onInput` / `onBlur` run independently.

**There is no `Input` and no `Textarea` part** (#169). A text control has no library state
outside a Field: its text is the browser's, typing is free, and the request is the form's
submission, which `Form.Root` already runs. So:

- **Outside a Field the control is the native element**: `<input aria-label="Search">`,
  `<textarea>`. A part there would render the same element and add nothing (the rule conventions
  7.3 applies to the directive-free form controls).
- **A textarea is `Field.Control render={<textarea />}`**; textarea-only props (`rows`, `wrap`)
  and a `ref` typed for the textarea go on the `render` element. It grows with its content
  through `field-sizing: content` in the consumer's CSS (6.2), which is why there is no
  `autoSize` prop.
- **No `valueChangeAction` on text.** The text of an input is a fact, not a request (vision,
  principle 3; conventions 2.6): it cannot be held, and rolling it back on a rejection would
  delete what the user typed. A controlled input is the native `value` / `onChange`, passed
  through. What the text drives (a search, a filter) leaves the urgent lane in the consumer's
  code (`useDeferredValue`, or Combobox when the result is a list of options).
- **No commit action in this part.** "Save this text when the user is done with it" (blur or
  Enter, `data-pending` on the input, a rule for a rejected save) is a component of its own
  with NumberField's draft-and-commit model, not a prop of `Field.Control`: `TextField`
  (`design/components/text-field.md`).

**`Field.Control` outside a `Field.Root`** (#169) renders the plain control instead of
throwing. Every FUNSTACK form control works both inside and outside a Field (`useFieldControl`
returns nothing to merge outside, 7.1), and a consumer's own styled input built on
`Field.Control` must work for a search box or a table cell without a wrapping `Field.Root`.
Outside a Field the library adds nothing: no `aria-invalid`, `aria-describedby` or `data-*`;
`id`, `name`, `disabled` and `required` are ordinary pass-through (a `render` element's own win,
as for any pass-through prop); the function props receive a `FieldState` whose `disabled` and
`required` are the control's own props (as inside a Field, where they are "own or the Field's",
and as a standalone Checkbox or Switch reports its own), while `invalid` (`false`), `messages`
(empty), `validity` (valid) and `pending` (`false`) are constant: there is no validation without
a Field. Still no `data-*` attribute outside a Field; a `render` element's own `disabled` is not
seen by the state, as inside a Field. `id` is in the props type; inside a Field it stays
owned (ignored with the existing development warning). The other Field parts keep throwing: a
Label, Description or Error outside a Field is a mistake, a control is not. The docs keep
recommending the native element for a direct call site.

### 4.4 `Form.Root`

```ts
export interface FormRootState {
  /** A submission is in flight: the Form's own transition, or the form's status (`useFormStatus`), including the Suspense wait of the result. */
  readonly pending: boolean;
}

export interface FormRootProps
  extends Omit<ComponentPropsWithRef<"form">, "onSubmit" | "method" | "action" | "className" | "style" | "children"> {
  /**
   * React form action (`(formData) => unknown`: a Server Function, a `useActionState` dispatch,
   * or a client function), rendered on the form unwrapped so React's progressive enhancement is
   * kept, and run by the Form inside its own transition after hydration (no automatic reset; see
   * `autoReset`). A string is a navigating form. A submitter with its own `formAction` is left to
   * React (automatic reset applies to it).
   */
  action?: string | ((formData: FormData) => unknown);
  /**
   * Field errors keyed by field `name` (usually `state.errors` from `useActionState`). Each
   * `Field.Root` with that name shows its entry, writes it into the control's custom validity,
   * and clears it on the user's next edit; the next settled submission shows the new entries.
   * Errors present at mount are shown without moving focus.
   */
  errors?: FormErrors;
  /**
   * Reset the form (`form.reset()`) when a submission the Form ran settles with no non-empty
   * entry in `errors` at all (an error hidden because the user replaced the value during the
   * flight still counts). Default `true`. A submission that reports errors never resets, so the
   * user's input, `:user-invalid` and custom validity stay. `false`: never reset.
   */
  autoReset?: boolean;
  /** Only with a string `action`. Owned otherwise (React's own with a function action). */
  method?: ComponentPropsWithRef<"form">["method"];
  className?: StateValue<string | undefined, FormRootState>;
  style?: StateValue<CSSProperties | undefined, FormRootState>;
  children?: StateValue<ReactNode, FormRootState>;
  /** Must render a `<form>`. */
  render?: RenderProp<ComponentPropsWithRef<"form">, FormRootState>;
}
```

Owned keys: `action`, `method` (except with a string action), `onSubmit`, `data-pending`.
`noValidate` passes through (the consumer opts out of interactive validation; the action then
runs with invalid data and the Fields show nothing until a server error arrives). `onReset`
passes through (React 19.3 fires it for every reset, the Form's included). A `render` element's
own `onSubmit` is merged and runs first; if it calls `preventDefault()` the Form runs nothing
(the conventions' veto rule, as a `preventDefault()` in `onClick` cancels a Checkbox's change;
review L3). React's own action plugin skips a prevented submit as well, so neither path runs the
action.

### 4.5 `Form.Submit`

```ts
export interface FormSubmitState {
  /** The enclosing form's submission is in flight (`useFormStatus().pending`). */
  readonly pending: boolean;
  readonly disabled: boolean;
}

export interface FormSubmitProps
  extends Omit<ComponentPropsWithRef<"button">, "type" | "className" | "style" | "children"> {
  /** Native `disabled`; owned. Never set by the library (conventions 3.6). */
  disabled?: boolean;
  className?: StateValue<string | undefined, FormSubmitState>;
  style?: StateValue<CSSProperties | undefined, FormSubmitState>;
  children?: StateValue<ReactNode, FormSubmitState>;
  render?: RenderProp<ComponentPropsWithRef<"button">, FormSubmitState>;
}
```

Owned keys: `type` (`"submit"`, when the rendered element is a `<button>`), `disabled`,
`aria-disabled`, `onClick` (while disabled), `data-pending`, `data-disabled`. `disabled` is native
on a submitter: no `render`, a host `<button>` or `<input>`, or a component (assumed to render a
`<button>`, `rendersButton`; only native `disabled` stops a submitter before hydration). A host
element of another tag (`<a>`) gets `aria-disabled="true"` and a cancelled click instead
(conventions 1.2). `name`, `value`, `formAction`, `formNoValidate` pass through;
`formAction` as a function takes the submission out of the Form's hands (3.1). `Form.Submit` may
be used in any React-rendered form (`Dialog.Form`, a plain `<form action>`): `useFormStatus`
reads the nearest form, Form.Root or not.

### 4.6 Namespaces

```ts
// src/field/index.ts
export const Field = { Root: FieldRoot, Label: FieldLabel, Control: FieldControl, Description: FieldDescription, Error: FieldError } as const;
export type { FieldRootProps, FieldState, FieldValidity, FieldValidate, FieldLabelProps, FieldControlProps, FieldDescriptionProps, FieldErrorProps } from …;

// src/form/index.ts
export const Form = { Root: FormRoot, Submit: FormSubmit } as const;
export type { FormRootProps, FormRootState, FormErrors, FieldErrorValue, FormSubmitProps, FormSubmitState } from …;
```

Subpaths `@funstack/ui/field` and `@funstack/ui/form`; both re-exported from the root entry.

---

## 5. Accessibility

### 5.1 ARIA wiring

| Element | Attributes |
| --- | --- |
| `Field.Label` | `id`; `for` → the control id (labelable control); none for a group control, which renders `aria-labelledby` → this id |
| the control (`Field.Control` or a FUNSTACK control's labelable element) | `id`; `aria-describedby` = consumer tokens + `${id}-description` + (`invalid` ? `${id}-error`); `aria-invalid="true" \| "false"`; `required` / `disabled` native |
| a group control (`RadioGroup.Root`, `CheckboxGroup.Root`, multi-thumb `Slider.Root`) | `aria-labelledby` → the Label id (token-merged); `aria-describedby` as above on the group element (a global property, read when focus enters the group); `required` / `disabled` through the group's own props |
| `aria-invalid` for a group | **RadioGroup**: on the `radiogroup` fieldset (a supported role). **CheckboxGroup**: on every Item (`checkbox`), not on the fieldset: WAI-ARIA 1.2 made `aria-invalid` widget-specific and deprecated it on `group` (review L1; the first draft's "valid on `group` / `radiogroup`" held for `radiogroup` only). The Items need it explicitly anyway: the slot's `customError` sits on the first Item, which Chromium would otherwise expose as invalid too early (2.3). The fieldset keeps `data-invalid` and `aria-describedby`. The multi-thumb Slider (#60) is a `group` and gets the same treatment (each thumb's `slider` input). |
| `Field.Description` | `id` |
| `Field.Error` | `id`; no role, no live region |
| `Form.Root` | nothing beyond the form; `aria-busy` is the consumer's through pass-through |
| `Form.Submit` | nothing beyond `type="submit"` |

Why `aria-describedby` for the error and not `aria-errormessage`: the research probed Chromium's
`errormessage` relation and found VoiceOver on macOS still not announcing it (Ark UI #4150, 2026,
fixed by switching to `describedby`), NVDA supporting it, and a11ysupport.io listing it as
unsupported in Safari. `aria-describedby` with the description and the error concatenated
("Use 8+ chars. Too short.") works in every screen reader. **If `aria-errormessage` is added
later it will be in addition to `aria-describedby`, never instead**, and rendered only while
`aria-invalid="true"` as ARIA requires; it is left out of v1 because with both attributes NVDA
reads the error twice, and the single attribute is the one that works everywhere today. Revisit
when VoiceOver supports it (for the product owner, question 4).

Why an explicit `aria-invalid="false"`: 2.3.

Why no live region: 2.5 and 4.2. The error is reached by focus after a submission attempt and by
the next focus for a blur-time error. The one case focus cannot reach, the control that already
has focus (Enter pressed in it), is covered by `ariaNotify()` on that control (2.5, 3.5): one
announcement, from the element the user is on, with no second read when focus moves. An error
summary that is focused after a failed submission is a consumer pattern (section 11.6).

### 5.2 Keyboard

Nothing the platform does not do: Tab order is the DOM's; Enter in a text control submits
(implicit submission, which dispatches a synthetic click on the default button, so a `Form.Submit`
gets `data-pending` the same way); Space / Enter on `Form.Submit`; a click on `Field.Label`
focuses (or activates) the labelable control. The library installs no key handler.

### 5.3 What assistive technology hears, in order

1. Submission attempt, empty required email: focus lands on the email control; announced as
   "Email, edit text, invalid entry, required, We never share it. Please fill out this field."
   (the description includes the error because the `aria-describedby` token and the text were in
   the DOM before the focus move, 2.4).
2. The user types a valid address and submits; the server says the email is taken: focus lands
   on the control again with "This email is already registered" in its description (3.5).
3. The user edits: the error disappears, `aria-invalid` goes back to `"false"`, nothing is
   announced (a correction is not an event).
4. The user presses Enter in the email field itself and the server rejects it, or the field is
   empty and the attempt fails on it: focus is already there, so the message is spoken through
   `ariaNotify()` ("This email is already registered" / "Please fill out this field."), once; the
   description is unchanged for the next focus.

---

## 6. Pending, data attributes, CSS

### 6.1 Attributes

| Attribute | On | Meaning |
| --- | --- | --- |
| `data-invalid` | every Field part | an error is shown (`FieldState.invalid`) |
| `data-disabled` | every Field part, `Form.Submit` | disabled by prop (Field or control) |
| `data-required` | every Field part | `Field.Root required` or the control's own `required` (the control reports its own through the registration) |
| `data-pending` | every Field part, `Form.Root`, `Form.Submit` | the form's submission is in flight |

Platform pseudo-classes next to them (conventions 4.2): `:user-invalid` / `:user-valid` on the
control and `:has(:user-invalid)` on the Root cover the native half of `data-invalid` with no JS
and before hydration; `data-invalid` is needed for server errors and for the parts that are not
ancestors of the control. `:required`, `:disabled`, `:placeholder-shown`, `:autofill` are the
control's. `form:has([data-pending])` is the same as `form[data-pending]`.

### 6.2 CSS, including `field-sizing`

The library ships no CSS. The recipe the docs show:

```css
.field[data-invalid] .control            { border-color: var(--danger); }
.field:has(.control:user-valid) .control { border-color: var(--ok); }      /* no JS needed */
.field[data-disabled]                    { opacity: .5; }
.field[data-required] .label::after      { content: " *"; }
.error                                   { color: var(--danger); }
.error { opacity: 1; transition: opacity 150ms; @starting-style { opacity: 0; } }   /* enter only (2.4) */

/* The control grows with its content: no JS auto-resize for textareas. */
.control                                  { field-sizing: content; }
textarea.control                          { min-height: 3lh; max-height: 12lh; }
select.control                            { field-sizing: content; }                 /* width follows the selected option */

form[data-pending]                        { cursor: progress; }
form[data-pending] .field                 { opacity: .7; }
.submit[data-pending]                     { pointer-events: none; }                   /* the consumer's "no double submit" */
.submit[data-pending]::after              { content: ""; /* spinner */ }
```

`field-sizing: content` (Chrome 123, Safari 26.2, Firefox 152; research table) makes a
`<textarea>` and a text `<input>` size to their content, which replaces every "auto-growing
textarea" hook; it is consumer CSS and the library has nothing to add, which is the point. The
docs show it on the `Field.Control render={<textarea />}` example (11.2).

Tailwind: `data-invalid:border-red-500 data-pending:opacity-70 field-sizing-content`.

---

## 7. Existing controls in a Field

### 7.1 The contract: `useFieldControl`

One internal hook, called by `Field.Control` and by the owner part of every FUNSTACK form
control. Outside a Field it returns nothing to merge; inside, it returns the owned attributes and
registers the element:

```ts
// packages/ui/src/internal/form/use-field-control.ts  ("use client")
export function useFieldControl(options: {
  /** `<label for>` can target the element (input, select, textarea, the Combobox Input, a single Slider thumb's input). Groups pass `false`. */
  labelable: boolean;
  /** The control's own props, so "own or the Field's" can be computed. */
  name?: string;
  disabled?: boolean;
  required?: boolean;
  /** The consumer's own `id`: ignored inside a Field (the Field owns it), with a warning. */
  id?: string;
  /** Dev warning tag. */
  component: string;
}): {
  readonly inField: boolean;
  /** Merge into the part's library ref: registers the element with the Field (the input/select/textarea, or a group's `<fieldset>`). `undefined` outside a Field. */
  readonly ref: RefCallback<HTMLElement> | undefined;
  readonly id: string | undefined;                 // labelable inside a Field: the Field's control id; else the consumer's
  readonly name: string | undefined;               // own ?? the Field's
  readonly disabled: boolean;                      // own || the Field's
  readonly required: boolean;                      // own || the Field's
  /** Owned attributes, empty outside a Field: `id` (labelable), `aria-labelledby` (groups: the Label id), `aria-describedby` (description + error while invalid; token-merged by the part), `aria-invalid` ("true" | "false"), `data-invalid`. */
  readonly attributes: FieldControlAttributes;
  readonly state: FieldState | undefined;
};

/** Tells the Field, after the commit, that the control's value changed with no `input` / `change` event the Field could hear. Nothing at mount. */
export function useFieldValueChange(value: unknown, takeEdit?: () => boolean): void;
```

What the hook does inside a Field: **registers the element from the returned ref callback**
(not a layout effect: no extra render, and the callback returns the cleanup, so `mergeRefs`
never calls it with `null`; StrictMode re-runs it and a change of `required` / `disabled`
re-registers without re-attaching listeners, which are keyed on the element; developer choice
8) with `{ element, labelable, required, disabled }`, so `Field.Label` can drop `for` for a group
(4.2) and the Field knows where to listen and what to focus. The **Field** attaches its native
listeners to the registered element (`input`, `change`, `focusout`, `invalid`, all capture) and
`input` / `change` / `submit` / `reset` on the form owner, and resolves the **validity element**
(the element itself when it is a form control, else the first `willValidate` member of a
`<fieldset>`'s `elements` that has a `name`, else the first control inside), which is where
`validity`, `validationMessage`, `:user-invalid` and `setCustomValidity` are read and written.
Two registrations in one Field warn in development (the first wins).

**Amendment (#67, NumberField).** The registration may carry `validityElement?: () =>
ValidatableElement | null`. When given, `validity`, `validationMessage` and the custom-validity
slot are read and written on that element instead of the resolved validity element, while
`:user-invalid`, the capture listeners and the focus target stay on the registered element;
after writing its slot the Field mirrors `validityElement.validationMessage` into the
registered element's `setCustomValidity`, so its own `:user-invalid` read in the same handler
sees the new state. Controls that register no `validityElement` are unchanged. See the
`design/components/number-field.md` 7.1 and conventions 3.6 / 3.8.

**Amendment (#165, MultiSelect).** A registered element that cannot validate itself (its
resolved validity element is `null`: a `<button>`) and whose `validityElement` lies outside it
(MultiSelect's hidden validity `<select>`, a sibling of the Trigger) gets the Field's `invalid`
listener on the `validityElement` too, since the event fires there and does not bubble.
`:user-invalid` is then read on the `validityElement` (there is no surface to read it on) and no
message is mirrored. The focus target of a `<button>` control is the button itself
(`focusTargetOf`). NumberField's surface validates itself, so nothing changes for it.

The hook returns **no `data-pending`**: a control inside a Field keeps its own `data-pending`
for its own action and nothing else (conventions 2.7 and 7.3; `Field.Control`, which is a Field
part, carries the form's). The first draft's signature comment said the part merges the form
channel's pending with its own ("either"), contradicting 7.3 and the test row; the developer
followed 7.3 (choice 4) and the review agreed.

The part merges `attributes` into its **owned** layer, so a `render` element cannot re-introduce
another `id` or `aria-invalid` (conventions 1.2), and `aria-describedby` through the token-merge
path so the consumer's own tokens survive. A control's `id` prop is therefore **owned by the
Field while inside one** (a consumer `id` on a Checkbox inside a Field is a dev warning and
ignored): `Field.Label`'s `for` must point at it.

**`useFieldValueChange` and `notifyChange`** (review H1). A Combobox pick writes the Input's text
and the hidden input's value through React, with **no** `input` or `change` event; the same
holds for a CheckboxGroup Parent checking its Items, a controlled value changed from outside, and
an optimistic value rolled back by a rejected action. The Field's listeners never fire, so
`validate` (which reads the hidden input) and a shown server error went stale: the review showed
Enter right after a pick blocked on the old "Pick a country", with the Field's own `invalid`
handler then clearing it (a silent failed submission), and a server error for a selection the
user had replaced blocking Save until they typed. The fix is a second hook every owner part
calls: `useFieldValueChange(value, takeEdit?)` is a layout effect with no deps that compares
`value` with the last committed one and, when it changed, calls the Field context's
`notifyChange(edit)`; `edit` is `takeEdit?.() ?? false`. The Field then refreshes (with the
dismissal of a shown server error when `edit`, exactly as an `input` event would) and asks the
Form to refresh its **other** Fields through `FormContext.refreshFields(source)`, so cross-field
rules follow. **Cross-field refresh for such a change works only inside a `Form.Root`**: the
DOM-event path reaches the other Fields through the form owner, but a change no event carried
has no owner to bubble to, so a Field in a plain `<form>` is refreshed only by its own control.
Which controls pass what:

| Control | `value` compared | `takeEdit` |
| --- | --- | --- |
| `Combobox.Root` | the optimistic selection | `true` for a change its own `dispatchValue` caused (a ref set when the dispatched value differs from the optimistic one), so a pick dismisses a server error like typing; `false` for a controlled change from outside |
| `CheckboxGroup.Root` | the sorted optimistic set plus the derived "at least one" `required` | nothing (the Items' own `change` already dismisses); covers a Parent click and the attribute flip |
| `Checkbox`, `Switch`, `RadioGroup.Root`, `Select.Root` | the optimistic value | nothing (their native `input` / `change` already dismiss); covers a controlled change from outside and a rollback |
| `MultiSelect.Root` | the optimistic selection | `true` for a change its own pick dispatched, `false` for a controlled change, a reset or a rollback |
| `Slider.Root` (#60, proposed: slider.md 9.4) | the optimistic values joined (`optimisticValues.join("\u0000")`): one notification per gesture commit (uncontrolled), per adopted step (a controlled adopt-steps parent), and on a rollback | `true` when the latest commit's `reason` was `"activate"` (a pointer gesture, a key press, a JS-normalised vertical / RTL arrow), which are the gestures that fire no native `input` / `change`; `false` for `"platform"` and a rollback |
| `TextField` | the shown text (the draft while one is open, else the optimistic value) | nothing: a revert follows keystrokes the Field heard, a rollback and a controlled change are not the user's edit |
| `Field.Control` | nothing | a native control's value changes only through events the Field hears |

The alternative was a synthetic bubbling `change` on the Combobox's hidden input (closest to the
platform, and visible to non-Field form code). Rejected for the library's own wiring: a
synthetic event would reach the consumer's `onChange` on the form and every `useFormOwnerEvent`
subscriber as if the user had typed, and the Combobox already has a dispatch the library owns;
the hook is the same post-commit layout effect every native-input component already runs. The
hook is also what Slider needs (#60): a pointer gesture fires no native `input` / `change`.

### 7.2 Per component

| Component | Registers | `labelable` | `Field.Label` names it through | Validity element | Also inside a Field |
| --- | --- | --- | --- | --- | --- |
| `Field.Control` | the input / textarea / select | yes | `for` | itself | |
| `Checkbox`, `Switch` | the `<input>` | yes | `for` | itself | `name` / `required` / `disabled` default from the Field. `indeterminate` unaffected. `useFieldValueChange(optimistic)`. |
| `RadioGroup.Root` | the `<fieldset>` | no | `aria-labelledby` on the fieldset; `RadioGroup.Label` (legend) is for standalone use | the first enabled radio (`:user-invalid` matches every radio of a required empty group, so one suffices; `setCustomValidity` on the first blocks the group) | `name` default from the Field (else the Root's `useId`); `required` / `disabled` on the Root. `aria-invalid` on the fieldset (`radiogroup`). Focus target: the checked radio, else the first enabled. `useFieldValueChange(optimistic)`. |
| `CheckboxGroup.Root` | the `<fieldset>` | no | `aria-labelledby` | the first enabled **named** item (never the Parent) | the dynamic "at least one" `required` of its design is untouched (an attribute, not the slot); `Field.Root required` is that `required` (choice 6). `aria-invalid` on every Item, not the fieldset (5.1, L1). Focus target: the first Item, never a `CheckboxGroup.Parent` (L2). `useFieldValueChange` keyed on the sorted set + the derived `required`. |
| `Select.Root` | the `<select>` | yes | `for` | itself | `name` / `required` / `disabled` default from the Field. Nothing changes for `<selectedcontent>`. `useFieldValueChange(optimistic)`. |
| `Combobox` | `Combobox.Input` registers the input (labelable); the Root reads `FieldContext` directly for the hidden input's `name` and `disabled`, the Input's id, and the List's `aria-labelledby` when no `Combobox.Label` is mounted (choice 7) | yes | `for` on the Input | the Input (`required` lands there) | `Combobox.Root name` defaults from the Field (hidden input). `validate`'s `value` is `formData.get(name)`, the hidden input: the **selection**, not the typed text. A pick is an edit: `useFieldValueChange(selection, takeEdit)` re-runs `validate` and dismisses a server error at once (H1). `Combobox.Label` stays for use outside a Field. |
| `Slider` (#60, **proposed**: the design is slider.md 9.4, pending product-owner acceptance) | `Slider.Root` calls the hook (the thumb count is known there) with `labelable: count === 1`; the returned ref registers the only Thumb's `<input type="range">` (through context) or, with several thumbs, the Root's group `div` | per shape | `for` (the Root makes `thumbId(0)` the Field's control id) / `aria-labelledby` on the Root, token-merged with `Slider.Label`'s id | the first Thumb's input in DOM order (a range has no native constraints; the slot carries `validate` and server errors; `:user-invalid` matches it after a submit attempt) | `name` / `disabled` default from the Field (a Thumb's own `name` still wins; `errors` and `validate` key on the Field's name). `required` is not applicable (a range always has a value; `Field.Root required` warns). `aria-invalid` on every Thumb input (never on the group `div`, 5.1); `aria-describedby`: the input (one thumb) or the Root (several). `useFieldValueChange` keyed on the optimistic values, `edit = true` for `"activate"` commits (pointer and normalised keys fire no native event). `Slider.Label` stays for use outside a Field. |
| `MultiSelect` | `MultiSelect.Trigger` registers the button (labelable) with the validity element as `validityElement` while `required` is set; the Root reads `FieldContext` for `name`, `disabled`, `required`, the Trigger's id and the List's `aria-labelledby` | yes | `for` on the Trigger; the Label's click focuses it (4.2) | the hidden one-option `<select>` (with `required`), else none | `validate`'s `value` is the first value (`formData.get(name)`); a rule over the selection reads `formData.getAll(name)`. The browser's bubble is never shown (multi-select.md B.10), so `Field.Error` is where the `required` message appears. `useFieldValueChange(selection, takeEdit)`. |
| `OTPField` (#171) | `OTPField.Input` registers the one `<input>` (labelable), as `Field.Control` does; the Root reads `FieldContext` for `name`, `disabled`, `required` and `data-invalid` | yes | `for` on the Input | the Input itself (`required`, the derived `pattern`) | No hidden input and no validity mirror: the text shown is the value posted (`design/components/otp-field.md` 7). `useFieldValueChange(value, takeEdit)`: `takeEdit` is `true` for the library's write-back and a WebOTP fill, `false` for a controlled change, a reset and text adopted at hydration. |
| `TextField` (#181) | its one `<input>` or `<textarea>` (labelable), as `Field.Control` does | yes | `for` | itself | `name` / `required` / `disabled` default from the Field. The text shown is the value posted, the draft included, and `validate` sees it per keystroke (`design/components/text-field.md` 7). Its `data-pending` is its own `valueCommitAction`'s. `useFieldValueChange(text)` with no `takeEdit`: an Escape revert, a rollback and a controlled change move the text with no event. |
| `Toggle`, `Menu`, `Tabs`, … | nothing | | | | not form controls; a Field around them is a dev warning (no registration). |

Landing Field therefore touches each of these parts with one hook call and the owned-layer merge
(section 14), and the Switch / Checkbox / RadioGroup / Select / Combobox / Slider test files gain
one "inside a Field" row each (section 13).

### 7.3 The two channels stay separate

A `Checkbox checkedChangeAction={saveSetting}` inside a Field inside a `Form.Root`: the
Checkbox's `data-pending` is its own action; the Field's and the Form's `data-pending` are the
form's submission; the two never mix (conventions 2.7), and while either is pending the other's
transition is entangled with it (conventions 2.3 item 5), as everywhere. "Submit on change" is
`checkedChangeAction={() => formRef.current?.requestSubmit()}`, which runs through the Form's
intercept like a click (`requestSubmit()` fires `submit`; `submit()` never does and must not be
used, research §1).

### 7.4 Fields in a native `<fieldset>`

**There is no `Fieldset` part** (#169). A set of Fields with a common caption is the native
element, which already does the three jobs a part would have:

```tsx
<fieldset disabled={!canEdit} aria-describedby="address-hint">
  <legend>Shipping address</legend>
  <p id="address-hint">Used for this order only.</p>
  <Field.Root name="street"><Field.Label>Street</Field.Label><Field.Control required /><Field.Error /></Field.Root>
  <Field.Root name="city"><Field.Label>City</Field.Label><Field.Control required /><Field.Error /></Field.Root>
</fieldset>
```

- **Naming and description.** `<legend>` names the `group`; `aria-describedby` describes it.
  Screen readers read both when focus enters the group, before the control's own label.
- **`disabled`.** `<fieldset disabled>` disables every native control inside it, which is
  every FUNSTACK form control's own element (`Field.Control`, Checkbox, Switch, the radios, the
  `<select>`, a Thumb's range input, NumberField's two inputs, the Combobox Input, MultiSelect's
  Trigger, any `Button`). The platform then excludes them from the `FormData`, bars them from
  constraint validation (a `validate` result on one does not block the submission) and skips
  them in the Tab order.
- **Errors stay per Field.** There is no group-level validity: a rule over several controls is
  one Field's `validate`, which receives the whole `FormData` (4.1), and a server error is keyed
  by one field's `name` (3.3). A message that belongs to no control is the consumer's element,
  referenced from the fieldset's `aria-describedby`.

What the library's state does **not** see: `disabled` inherited from a fieldset is a platform
fact, so `data-disabled` and `state.disabled` stay the props' (conventions 3.6, as RadioGroup
and CheckboxGroup already document for their Items). Style inheritance with the platform's
selector, which covers both sources:

```css
.field:has(.control:disabled) { opacity: .5; }   /* Field.Root disabled, or an ancestor fieldset */
```

Rules that follow:

- **A group control is its own fieldset.** `RadioGroup.Root` and `CheckboxGroup.Root` render
  the `<fieldset>` and their `Label` the `<legend>`; do not wrap one in another fieldset to
  caption it. Nesting is for a real outer group (an address fieldset that contains a RadioGroup).
- **`Field.Root` is not a fieldset** and does not become one (section 1).
- **Do not disable a fieldset while a submission is pending.** `<fieldset disabled={pending}>`
  drops focus from the control the user is on (conventions 3.6); mark pending with
  `form[data-pending]` (6.2).
- **A part's pointer surface honours inherited `disabled`** (#180, conventions 3.6). Where a
  part handles a pointer itself (`Slider.Track`, a Thumb's styled `span`, NumberField's
  Increment / Decrement), the handler also bails when the part's native control matches
  `:disabled`, read at the press. Reproduced in Chromium and Firefox before the fix: a drag
  inside `<fieldset disabled>` moved the Slider and dispatched, and a press on a
  fieldset-disabled Increment stepped, because both engines still dispatch `pointerdown` to a
  natively disabled `<button>` (only `click` is withheld).

---

## 8. Server rendering, progressive enhancement, before hydration

Every part is a client module and every part may be rendered from a Server Component with
serialisable props. The common progressive-enhancement form needs no client component of the
consumer's at all:

```tsx
// app/subscribe.tsx: a Server Component.
import { Field } from "@funstack/ui/field";
import { Form } from "@funstack/ui/form";
import { subscribe } from "./actions"; // "use server"; (formData) => Promise<void>; throws or redirects on failure

export function Subscribe() {
  return (
    <Form.Root action={subscribe}>
      <Field.Root name="email" required>
        <Field.Label>Email</Field.Label>
        <Field.Control type="email" autoComplete="email" />
        <Field.Error />
      </Field.Root>
      <Form.Submit>Subscribe</Form.Submit>
    </Form.Root>
  );
}
```

| | Before hydration | After hydration |
| --- | --- | --- |
| Constraint validation | native: `required` and `type="email"` block the submit; the **bubble** shows; the browser focuses the control | the Field cancels the bubble and renders `Field.Error`; the collector focuses |
| Submission | the browser posts to the Server Function's endpoint (React's progressive enhancement: the `action` URL and hidden fields are in the server HTML); full page response | the Form runs the action in a transition; `data-pending` |
| `aria-describedby`, `aria-invalid="false"`, ids | in the server HTML | unchanged |
| Server errors | with `useActionState(…, initial, permalink)` the post-back page renders the result state on the server: `Field.Error` with the messages, `aria-describedby` listing the error id, `aria-invalid="true"`, `data-invalid` | shown, dismissible, re-armed (3.4) |
| `Field.Label` for a group control | `for` is in the server HTML pointing at the group's id (the default is "labelable"); a validator flags it until hydration removes it; browsers ignore a `for` that does not target a labelable element | removed; `aria-labelledby` on the group |
| `data-pending` | never (no status without React) | `useFormStatus` |
| `validate` | not run (no JS); the server validates | runs |

What the server HTML never contains: `:user-invalid`-derived state (nothing is user-invalid on
load), the custom-validity slot (a DOM property), and a focus move for initial errors (3.5).
Firefox's form-state restoration of typed text across a reload lands in the DOM before
hydration; the Field reads validity at mount, so a restored value that violates a constraint is
not shown as an error until the user interacts (the user-validity flag is not restored), which
matches a plain form.

---

## 9. ViewTransition

No Field or Form part takes `transition`. The Field's state is an urgent mirror (2.4): its commits
never start a view transition, so a boundary would animate nothing and would still pay the page
cross-fade whenever a Field mounted inside another component's transition commit (conventions
5.1, the Toast category). `Form.Root`'s own commits (pending, the settle) change nothing the form
element itself displays; what the result changes is the consumer's content, which is theirs to
wrap. `Field.Error` enters with `@starting-style` (6.2) and leaves instantly in v1 (an
exit-animated error through `useExitAnimation` is a possible v2 if a demo wants it).

---

## 10. Async walkthroughs

1. **Native failure.** The user clicks `Form.Submit` with the email empty. The browser validates:
   `invalid` fires on the email control; the Field (with a `Field.Error` mounted) reads
   `:user-invalid` = true, cancels the event, sets `invalid` (urgent), registers the control with
   the collector. No `submit`. Microtask: the collector focuses the control. The error text is in
   the DOM, the description lists it, the screen reader reads both. `pending` never turned on.
2. **Server error round trip.** The user types `a@b.c` and submits. `submit` → the Form
   intercepts, `pending` on (the form, the Submit, the Field); the Field's `false → true` edge
   clears `suppressNext`. The action (a `useActionState` dispatch) returns `{ errors: { email:
   "Already registered" } }`. The settle commit renders the new `errors` prop and `NotPending`
   together; the Field sees its `true → false` edge in that render (`dismissed` cleared,
   `suppressNext` = `false` promoted to `suppressed`), computes `serverShown`, renders the error,
   writes the slot. The Form's effect, after the commit: the email Field shows a server error →
   focuses the email control (it was on the Submit button). No reset.
3. **Dismiss and resubmit.** The user types one more character: `input` → the Field sets
   `dismissed`, recomputes the slot without the server message (`validate` absent, native
   constraints pass), `userInvalid` = false (`:user-invalid` tracks live, the value is valid),
   `invalid` false, the error unmounts, `aria-invalid="false"`. Submit again → the server accepts
   → the settle with empty errors → the Field re-arms (nothing to show) → the Form's effect:
   no Field shows an error, `errors` has no entry → `autoReset`: `form.reset()`; the controls
   dispatch their platform changes; the Field re-reads in the reset microtask: all clear.
4. **Same error twice.** As 2, then the user edits and submits the same bad value again: the
   settle render clears `dismissed`, so `serverShown` is true again even though the strings are
   identical, and the slot blocks the next click until an edit.
5. **Edited during the flight.** As 2, but while the action is pending the user changes the email
   to `x@y.z`: the `input` refresh compares `x@y.z` with the submitted `a@b.c` → `suppressNext`
   = `true`. The settle render promotes it: `suppressed` → not shown, no slot write; the Form's
   effect finds no Field showing an error, but `errors` has a non-empty entry, so **no reset**
   either (the user's new value stays); the user submits the new value unobstructed. Had the
   server also flagged `name`, unchanged, that one is shown and focused.
5b. **The next flight after 5** (review M1). The user submits `x@y.z`. The `submit` event and the
   `false → true` edge reset `suppressNext`; `suppressed` stays `true`, so although `errors`
   still holds `{ email: "a@b.c is taken" }` and `dismissed` is clear, the stale error is **not**
   shown during the flight, the slot is empty and a queued second click is not blocked. At the
   settle the new result replaces `errors`, `suppressNext` (`false`, the value was not changed
   this time) becomes `suppressed`, and whatever the server said about `x@y.z` is shown.
6. **Double click.** Two submits before the first settles, `action` a `useActionState` dispatch:
   the second is queued by React and runs after the first with the FormData it captured; the
   watcher stays pending through both; one settle; the last result's errors show. With a plain
   async function both run concurrently and the consumer's function decides what that means.
7. **Reset button while pending.** Values go to their defaults; every FUNSTACK control and every
   Field re-reads (`:user-invalid` false) and records `suppressNext` for every value the reset
   changed. The result's errors for those fields are hidden at the settle, and stay hidden through
   the next flight (5b).
8. **The action throws.** `pending` stays on until the boundary above `Form.Root` commits; no
   settle effect, no reset, no focus. The form unmounts with the boundary's subtree, or stays with
   its values if the boundary is inside and the consumer renders the form again.
9. **Content suspends after the settle.** The action's result makes a `<Suspense>`-wrapped list
   below the form re-render with new data: the settle commit waits for it, `data-pending` stays,
   then errors, content and the focus move land together.
10. **Progressive-enhancement post-back.** No JS: the browser posts, the server runs the action,
    the page re-renders with `useActionState`'s result as its initial state. `Field.Error` is in
    the HTML with its id in `aria-describedby`; nothing is focused (3.5); the user edits →
    hydration has happened by then, so the error dismisses as in 3.
11. **A Field in a `Dialog.Form`.** A plain `<Dialog.Form action={dispatch}>` is React's path: the
    automatic reset runs after a result with errors (the Dialog design documents it). The Fields
    still validate, suppress the bubble, focus the first invalid control, and show
    `data-pending`; server errors need a `Form.Root`, which composes as
    `<Dialog.Form render={<Form.Root errors={state.errors} />} action={dispatch}>`.
    Through `render`, `Form.Root` **receives the `action` as a prop and intercepts** the submit,
    so it is `Form.Root`'s policy that applies, not React's: the action runs once (the Form's
    call), the errors are routed to the Fields and the first is focused, the typed value is
    kept, and the form is reset only on a settle with no errors (`autoReset`, passable on the
    `Form.Root` element). The two refs merge (Dialog's submit-capture ref and Form.Root's), both
    watchers see the host transition's edge, and there is no double run (verified by the review
    and pinned by a jsdom row). `Dialog.Form`'s `closeOnSettle` is **error-aware** in this
    composition (#59, Dialog 8.1 and "Dialog.Form and Form.Root (#59)"): a child among the
    form's children reads the `FormContext`, and the settle close is requested only when
    `hasAnyError(errors)` is false at the settle commit, the `autoReset` predicate, so a result
    with errors keeps the dialog open (the Form focuses the first errored field) and a clean
    settle resets and then closes the dialog through the Root. No `errors` / `autoReset` on
    `Dialog.Form`: the composition is the one shape. A plain `Dialog.Form` without a `Form.Root`
    still closes on every settle that does not throw. The docs' Field page has this
    composition; the Dialog page points to it.
12. **A Combobox pick, then Enter** (review H1). A country Field with `validate={(v) => v === ""
    ? "Pick a country" : null}`: the user types "Jap", ArrowDown, Enter. The Combobox dispatches
    the selection; React writes the hidden input; no event. Its `useFieldValueChange` fires in
    the commit's layout effect with `edit = true`: the Field refreshes, `validate("jp", …)`
    returns `null`, the slot is cleared, a shown server error for the old selection is dismissed,
    and the Form refreshes the other Fields. Enter again submits at once. Without the hook, the
    slot still said "Pick a country", the `invalid` event blocked the submit, and the Field's own
    refresh in that handler then cleared it: nothing sent and nothing shown.
13. **Enter in the invalid field** (review M2). The email field is empty and focused; the user
    presses Enter. Implicit submission → `invalid` on the email control → cancelled, rendered,
    collected. The microtask finds the first target already active: no focus move, so
    `email.ariaNotify("Please fill out this field.")` once. The same when the user presses Enter
    in a valid field and the server rejects that field: the Form's settle effect announces instead
    of focusing.

---

## 11. Call-site examples

### 11.1 Sign-up with `useActionState`, server field errors, reset on success

```tsx
"use client";
import { useActionState } from "react";
import { Field } from "@funstack/ui/field";
import { Form } from "@funstack/ui/form";
import { signUp } from "./actions";   // "use server": (prev, formData) => Promise<{ errors?: Record<string, string> }>

export function SignUp() {
  const [state, formAction] = useActionState(signUp, {});
  return (
    <Form.Root action={formAction} errors={state.errors} className="stack">
      <Field.Root name="email" required>
        <Field.Label>Email</Field.Label>
        <Field.Control type="email" autoComplete="email" />
        <Field.Description>We never share it.</Field.Description>
        <Field.Error />
      </Field.Root>
      <Field.Root name="password" required>
        <Field.Label>Password</Field.Label>
        <Field.Control type="password" minLength={8} autoComplete="new-password" />
        <Field.Error>
          {({ validity, messages }) => (validity.tooShort ? "Use at least 8 characters." : messages.join(" "))}
        </Field.Error>
      </Field.Root>
      <Field.Root
        name="confirm"
        required
        validate={(value, formData) => (value === formData.get("password") ? null : "Passwords do not match.")}
      >
        <Field.Label>Confirm password</Field.Label>
        <Field.Control type="password" autoComplete="new-password" />
        <Field.Error />
      </Field.Root>
      <Form.Submit className="btn">{({ pending }) => (pending ? "Creating…" : "Create account")}</Form.Submit>
    </Form.Root>
  );
}
```

The "passwords do not match" rule re-runs when either field changes (the Field listens on the
form owner) and is shown when the confirm field matches `:user-invalid`: after the user leaves it
or tries to submit. A server-side "already registered" lands on the email field, is focused, and
goes away on the next keystroke. A successful sign-up resets the form (then the action usually
redirects).

### 11.2 A textarea that grows, from a Server Component

```tsx
// Server Component; `postComment` is a Server Function that redirects on success.
<Form.Root action={postComment}>
  <Field.Root name="body" required>
    <Field.Label>Comment</Field.Label>
    <Field.Control render={<textarea rows={2} maxLength={2000} />} className="comment" />
    <Field.Error />
  </Field.Root>
  <Form.Submit>Post</Form.Submit>
</Form.Root>
```

```css
.comment { field-sizing: content; min-height: 2lh; max-height: 10lh; }
```

### 11.3 FUNSTACK controls as the field's control

```tsx
<Field.Root name="plan" required>
  <Field.Label>Plan</Field.Label>                      {/* no `for`; the group is aria-labelledby it */}
  <RadioGroup.Root defaultValue={null}>
    <label><RadioGroup.Item value="free" /> Free</label>
    <label><RadioGroup.Item value="pro" /> Pro</label>
  </RadioGroup.Root>
  <Field.Description>You can change this later.</Field.Description>
  <Field.Error />                                      {/* "Please select one of these options." after a submit attempt */}
</Field.Root>

<Field.Root name="country">
  <Field.Label>Country</Field.Label>
  <Combobox.Root>
    <Combobox.Input required />                        {/* id, aria-describedby, aria-invalid from the Field */}
    <Combobox.Popup><Combobox.List>…</Combobox.List></Combobox.Popup>
  </Combobox.Root>
  <Field.Error />
</Field.Root>

<Field.Root name="terms">
  <Field.Label>I accept the terms</Field.Label>
  <Checkbox required />
  <Field.Error />
</Field.Root>
```

### 11.4 Autosave control inside a submit form (two channels)

```tsx
<Form.Root action={saveProfile} errors={state.errors}>
  <Field.Root name="name" required>
    <Field.Label>Name</Field.Label>
    <Field.Control defaultValue={profile.name} />
    <Field.Error />
  </Field.Root>
  <Field.Root name="notifications">
    <Field.Label>Email notifications</Field.Label>
    <Switch defaultChecked={profile.notifications} checkedChangeAction={setNotifications} />  {/* saves on its own; its own data-pending */}
  </Field.Root>
  <Form.Submit>Save</Form.Submit>
</Form.Root>
```

### 11.5 Keeping values after success

```tsx
<Form.Root action={formAction} errors={state.errors} autoReset={false}>…</Form.Root>
```

### 11.6 An error summary (consumer pattern)

```tsx
const summaryRef = useRef<HTMLDivElement>(null);
const errorList = Object.entries(state.errors ?? {}).filter(([, v]) => v);
useEffect(() => { if (errorList.length) summaryRef.current?.focus(); }, [state]);   // the consumer's focus policy; the Form's own focus goes to the first field

<Form.Root action={formAction} errors={state.errors}>
  {errorList.length > 0 && (
    <div ref={summaryRef} tabIndex={-1} role="group" aria-labelledby="sum">
      <h2 id="sum">Please fix {errorList.length} problems</h2>
      <ul>{errorList.map(([name, v]) => <li key={name}><a href={`#${idFor(name)}`}>{v}</a></li>)}</ul>
    </div>
  )}
  …
</Form.Root>
```

(Two focus moves compete here; the consumer who wants the summary focused passes an `errors`
object whose names have no Field, or focuses in a later effect. The docs show the field-first
default and mention the summary as the alternative.)

### 11.7 Tailwind and `render`

```tsx
<Field.Root name="handle" className="group grid gap-1" validate={noSpaces}>
  <Field.Label className="text-sm group-data-invalid:text-red-600">Handle</Field.Label>
  <Field.Control className="rounded border px-2 py-1 data-invalid:border-red-500 field-sizing-content" />
  <Field.Error className="text-sm text-red-600" />
</Field.Root>
<Form.Submit render={<MyButton variant="primary" />} className="data-pending:opacity-60">Save</Form.Submit>
```

### 11.8 A search box (no Field)

```tsx
// No label element, no description, no validation: nothing for a Field to wire. The native
// element is the control; the query leaves the urgent lane through useDeferredValue.
const [query, setQuery] = useState("");
const deferredQuery = useDeferredValue(query);

<input type="search" aria-label="Search issues" value={query} onChange={(e) => setQuery(e.target.value)} />
<Suspense fallback={<Spinner />}>
  <Results query={deferredQuery} />            {/* stale results stay while the new ones load */}
</Suspense>
```

---

## 12. Not in v1

- A `Fieldset` / `Legend` part (7.4) and `Input` / `Textarea` parts (4.3): the native elements.
- A commit action on `Field.Control` (save on blur or Enter): that is `TextField`, a component
  of its own (`design/components/text-field.md`).
- Async or debounced `validate` (Base UI's `validationDebounceTime`): a v2 question once a demo
  needs a uniqueness check before submit; the sync slot and the server channel cover it today.
- `Field.Root invalid` / `error` overrides (Base UI's `invalid`, React Aria's `isInvalid` +
  `errorMessage`): `validate` and `Form.Root errors` are the two channels; a third would need a
  display rule of its own.
- `aria-errormessage` (5.1).
- A `Form.Root data-invalid` ("any field shows an error"): `form:has([data-invalid])` is CSS.
- A `Form.Reset` part, a `Field.RequiredIndicator` part (Ark): `data-required` and CSS.
- Exit animation for `Field.Error`.
- An error summary part.
- Dropping repeat submissions while pending (3.6).
- Localisation of the browser's messages: the function form of `Field.Error children` is the
  override, per `ValidityState` key; the library adds no English string (conventions 11: the
  default text is the browser's own, which is already localised).

---

## 13. Test plan

Moved to `design/CHANGELOG.md` (part "field-form.md"). Not part of the contract: the code and the tests are the reference.

## 14. Implementation notes

Moved to `design/CHANGELOG.md` (part "field-form.md"). Not part of the contract: the code and the tests are the reference.
