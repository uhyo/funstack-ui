# Field and Form

Status: **accepted** (2026-10-18, wave 5, GitHub issue #54; research issue #55; all eleven
product-owner items accepted as recommended, see "Accepted by the product owner" at the end).
The review of the implementation (`memo/reviewer/field-form.md`, merge e172925) and its fixes
(ae4640d library and tests, 30a4bb2 docs) are folded in on 2026-10-18, see "Review corrections
(#54)" at the end. The code under `packages/ui/src/field/`, `packages/ui/src/form/` and the
`internal/` helpers it names is the ground truth where this document is silent.
Follows `design/conventions.md` (accepted); where this document and the conventions disagree,
the conventions win. The conventions changes listed under "Conventions feedback (proposed)"
were **applied** to `design/conventions.md` on 2026-10-18 (resolved question 30); the 3.8 hook
rows were corrected with the review fold (`useFieldValueChange`, no `data-pending` from the hook).
Amended 2026-10-18 with the NumberField design (#67): the registration's optional
`validityElement` and the Field-side mirror, see 7.1 and "Amendment: `validityElement`" at the end.

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
  native control; the hook warns in development for any other element.
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
(microtask, when the values are the reset values), and after a commit in which the `validate`
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
userInvalid = control.matches(":user-invalid")      // read on: input, change, focusout, invalid, reset (microtask)
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
user-validity flag, so the Field re-reads in the microtask after the reset, when the DOM holds
the reset values). The `invalid` listener is the one that fires for a submission attempt: it
fires once per invalid control, synchronously, before `submit` would (which never comes).

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
  returns errors, which is what `useActionState` is for.
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
the default before any control registers; removed when a group control registers), the four
`data-*`. `Description`: `id`, the four `data-*`. `Error`: `id`, the four `data-*`. None of them
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
  extends Omit<ComponentPropsWithRef<"input">, "id" | "aria-invalid" | "className" | "style"> {
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
element, as `Select.Root`'s do). Owned keys: `id`, `name`, `disabled`, `required`,
`aria-invalid`, `aria-describedby` (token-merged with the consumer's, the consumer's tokens
first), `data-invalid`, `data-disabled`, `data-required`, `data-pending`. Everything else is
pass-through: `type`, `defaultValue`, `value` / `onChange` for a controlled input, `pattern`,
`minLength`, `autoComplete`, `inputMode`, `placeholder`, `onBlur`, … The library's own listeners
are native (`addEventListener` through the ref, section 14), so no `on*` prop is omitted and the
consumer's `onInput` / `onBlur` run independently.

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
`data-pending`, `data-disabled`. `name`, `value`, `formAction`, `formNoValidate` pass through;
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
// packages/ui/src/internal/use-field-control.ts  ("use client")
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
amendment section at the end, `design/components/number-field.md` 7.1 and conventions 3.6 / 3.8.

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
| `Slider.Root` (#60, proposed: slider.md 9.4) | the optimistic values joined (`optimisticValues.join("\u0000")`): one notification per gesture commit (uncontrolled), per adopted step (a controlled adopt-steps parent), and on a rollback | `true` when the latest commit's `reason` was `"activate"` (a pointer gesture, a key press, a JS-normalised vertical / RTL arrow), which are the gestures that fire no native `input` / `change`; `false` for `"platform"` and a rollback |
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

---

## 12. Not in v1

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

Most rows are jsdom; `:user-invalid` timing, the real submit plugin behaviour and `field-sizing`
need a browser. jsdom notes: jsdom 30 implements constraint validation, `invalid` events,
`requestSubmit()` and `form.reset()`; whether its selector engine accepts `:user-invalid` decides
whether the fallback of 2.2 engages (the developer records which; rows marked "display" move to
browser mode if jsdom silently returns `false` instead of throwing).

### 13.1 jsdom (`field.test.tsx`, `form.test.tsx`)

| Area | What the test proves |
| --- | --- |
| Roles and ARIA | The section 1 HTML: Label `id` / `for` = control `id`; control `aria-describedby` = consumer tokens + description id, + error id only while invalid; `aria-invalid="false"` idle, `"true"` invalid; `Field.Error` absent from the DOM while valid; no `role` / `aria-live` on the error; a group control (RadioGroup inside a Field): Label without `for` after mount, `aria-labelledby` on the fieldset, `aria-describedby` / `aria-invalid` on the fieldset; `Field.Control render={<textarea />}` and `<select />` keep the wiring; a second `Field.Error`, a nested `Field.Root`, a consumer `id` on a control inside a Field, a non-control element each warn once. |
| Native validation (display) | `requestSubmit()` with an empty `required` control: the action is not called, `invalid` was cancelled (no bubble: `reportValidity` not relied on), `Field.Error` renders `validationMessage`, `data-invalid` on every part, focus on the control (the collector), the first of two invalid Fields in document order focused; with no `Field.Error` mounted the event is not cancelled; `checkValidity()` cancels nothing and focuses nothing (fallback mode: the `:user-invalid` term is what gates it in browsers, row 13.2). |
| `validate` | Runs at mount, on `input` on the field, on `input` on another field (cross-field), after `reset`, when the prop changes; its string lands in `validity.customError` / `validationMessage`; `null` clears it; a `Field.Error` function child receives `validity` and `messages`. |
| Server errors | `Form.Root errors={{ email: "Taken" }}` at mount: shown, `setCustomValidity` applied, no focus; after a settled submission with errors: shown and the first errored Field focused; `input` dismisses (error gone, custom validity `""`, `aria-invalid="false"`); the next settle re-shows identical strings; an error for a value changed during the flight is suppressed; an error whose name has no Field focuses nothing; a Field outside `Form.Root` ignores nothing (no channel). |
| Submission (intercept) | With a function `action`: `submit` is `defaultPrevented`, the action is called once with a `FormData` that includes the submitter's `name` / `value`, `Form.Root` and `Form.Submit` and `Field.Root` carry `data-pending` while a deferred action is unresolved (the watcher through `useFormStatus`), gone after; `useActionState`'s dispatch as `action` works end to end; a string `action` is not intercepted; a submitter with `formAction` is not intercepted. |
| Reset policy | After a settle with no errors and `autoReset` default: `form.reset()` happened (values back to defaults, a `reset` event seen by a Checkbox inside, which dispatches `"platform"`); with errors: nothing reset, the typed value is still there; `autoReset={false}`: never. |
| Rejection | The action rejects: an `ErrorCatcher` above `Form.Root` catches; no reset; no focus; `Field` state unchanged. |
| Overlap | Two submits with a deferred `useActionState` action: both run in order, one settle, the last errors shown. |
| Suspending content | The result re-renders a suspending sibling: `data-pending` stays until it resolves; the error and the content appear in the same commit (no fallback from a boundary above). |
| Function props and `render` | Every part's `className` / `style` / `children` / `render` receive `FieldState` (or `FormRootState`, `FormSubmitState`) and the attributes agree; `render` keeps the handlers and the ref. |
| Controls inside a Field | One row in each of `switch.test.tsx`, `checkbox.test.tsx`, `radio-group.test.tsx`, `checkbox-group.test.tsx`, `select.test.tsx`, `combobox.test.tsx`, `slider.test.tsx`: inside a `Field.Root`, the part gets the Field's `id` (or `aria-labelledby`), `name`, `aria-describedby`, `aria-invalid`, and `disabled` / `required` from the Field; its own `data-pending` is unaffected by the form's. |
| Platform path | `form.reset()` and a `<button type="reset">` clear a shown native error (fallback mode) and recompute the slot; the automatic reset after a successful submission through React's path (a submitter with `formAction`) is observed by the Field like any reset. |
| Directive | Every part file of `field/` and `form/` starts with `"use client"`. |
| Value change with no event (H1) | `combobox.test.tsx`: a selection re-runs `validate` at once (Enter right after picking submits); picking another option dismisses a server error so the corrected value can be saved. `checkbox-group.test.tsx`: the focus target is the first Item, not the Parent, and a Parent click re-reads `validate` after the commit; checking a later Item clears the "at least one" error in the same commit. `field.test.tsx`: `validate` re-runs when a FUNSTACK control's value changes with no DOM event (a Checkbox controlled from outside). |
| Stale error across flights (M1) | `form.test.tsx`: a hidden stale error stays hidden while the next submission is in flight (no message, `aria-invalid="false"`, empty slot); an error for the value sent in the next flight is shown at that settle. |
| Announcement (M2) | `form.test.tsx`: a server error for the focused field (Enter in it) is announced on the control through a stubbed `ariaNotify`; focus moving to the errored field announces nothing extra; a failed attempt from the focused, first invalid field announces its message; nothing where `ariaNotify` is missing. |
| Veto (L3) | `form.test.tsx`: a `render` element's `onSubmit` calling `preventDefault()` cancels the submission (the action is not called, nothing pending). |
| `Dialog.Form` as `Form.Root` (walkthrough 11) | `form.test.tsx`: `<Dialog.Form render={<Form.Root errors />} action={dispatch}>`: errors shown and focused, the value not reset, the dialog stays open; a clean settle resets and closes the dialog (`reason: "activate"`, the submitter's `value`); a hidden stale error neither closes, resets nor focuses; `closeOnSettle={false}` never closes; the reverse orientation is detected the same way; the composition without a function `action` warns (#59). |
| N/A rows | Sync / async action, optimistic, controlled parity, post-await, superseded rejection, urgent action: no action props and no `x` / `defaultX` triple on any Field or Form part (the form's `action` is React's channel, and the display state has no consumer-facing urgent action), listed at the top of each test file. |

### 13.2 Browser mode (`field.browser.test.tsx`, `form.browser.test.tsx`, Chromium, Firefox, WebKit)

| Row | Proves |
| --- | --- |
| Submit plugin | With `action` rendered **and** the Form's `onSubmit`: a click on `Form.Submit` calls the action exactly once (the Form's call, not react-dom's), `useFormStatus().pending` is true in a child and in a portal during a deferred action with `data` set, and no automatic reset follows a result with errors (the typed value stays, `:user-invalid` stays); with `autoReset` and no errors, the value is cleared. The same with `useActionState`'s dispatch. Pins 3.1. |
| `:user-invalid` timing | Typing into a `required` field and clearing it shows no error until blur; blur shows it; typing again updates live; a submission attempt shows it without blur; `form.reset()` hides it; a `checkValidity()` call shows nothing and cancels nothing; `reportValidity()` shows the platform bubble (not cancelled, `:user-invalid` false). |
| Bubble and focus | After a failed submission attempt no bubble is visible (no `reportValidity` UI; asserted by the cancelled event and by focus staying where the collector put it), focus is on the first invalid control in document order across two Fields; with a plain `<input required>` before the Fields the browser's own focus wins and the collector does not move it. |
| Accessibility tree (Chromium, CDP) | `aria-invalid="false"` keeps a `typeMismatch` control not `invalid`; `"true"` makes a `valueMissing` control `invalid`; the description is "description + error" while invalid. |
| Group | A required RadioGroup inside a Field: after a submission attempt the Field is invalid, the message is the browser's radio message, focus lands on the first radio. |
| `field-sizing` | A `textarea` with `field-sizing: content` grows with its content (height increases after typing a second line) in engines that support it (`CSS.supports("field-sizing: content")`); the row asserts the documented degraded behaviour elsewhere. |
| Progressive enhancement | `renderToString` the Subscribe form **as `Form.Root`** with a fake Server Function (`$$FORM_ACTION`): the server HTML has the action's endpoint, method, encType and `$ACTION_ID` hidden input, `aria-describedby`, `aria-invalid="false"`, the `for`; with `errors` at render, `Field.Error`, `aria-invalid="true"` and the error id are in the server HTML; hydrate; no recoverable errors and nothing changes in the markup except a group Field's `for` being removed. (The first implementation rendered a plain `<form action="/subscribe">` here, review M3.) |
| Firefox / WebKit parity | The whole display row runs in all three; where `:user-invalid` heuristics differ (Firefox updating live after the first blur is the same as Chromium today) the test asserts the common subset. |

---

## 14. Implementation notes

```
src/field/
  index.ts
  field-root.tsx          "use client": useId, the mirror state, the Form context read, the registration, listeners
  use-server-error-visibility.ts  "use client": the server-error flags of 3.4 (dismissed / suppressed / suppressNext and the form-pending edges) as one hook
  field-label.tsx         "use client"
  field-control.tsx       "use client": useFieldControl + useRender
  field-description.tsx   "use client"
  field-error.tsx         "use client": registers presence; renders null while valid
  field.test.tsx, field.browser.test.tsx
src/form/
  index.ts
  form-root.tsx           "use client": intercept, watcher, settle, errors context, focus, reset
  form-submit.tsx         "use client": useFormStatus
  form.test.tsx, form.browser.test.tsx
src/internal/
  field-context.ts        "use client": fieldDataAttributes(state) (the four data-* every Field part renders), FieldContext ({ ids, name, disabled, required, state, labelable, registerControl, registerError, notifyChange }), FormContext ({ errors, registerField, submittedData, refreshFields }), FormFieldRegistration ({ getFocusTarget, showsServerError, serverMessages, refresh })
  use-field-control.ts    "use client": section 7.1: useFieldControl, useFieldValueChange, fieldInputProps, resolveFieldDefaults (the one "own or the Field's" rule)
  use-merged-refs.ts      "use client": useMergedRefs, the memoised ref merge every owner part uses for `field.ref`
  use-form-owner-event.ts "use client": useFormReset generalised to any event type on the form owner (stable subscription, rule 3.8.4); useFormReset becomes a thin wrapper, no behaviour change
  use-form-reset.ts       "use client": now built on useFormOwnerEvent
  form-status-watcher.tsx "use client": moved from dialog/dialog-form.tsx; imported by Dialog.Form and Form.Root
  validity.ts             directive-free: snapshotValidity(el), normaliseErrorValue(v), hasAnyError(errors), supportsUserInvalid(), validityElementOf(el), focusTargetOf(el) (sortByDocumentOrder is internal/dom-order.ts)
  focus-first-invalid.ts  directive-free: the module-level collector (collectInvalid(el, message); announces through internal/announce.ts since #129)
```

- **The mirror state** lives in `Field.Root` as one `useState<{ userInvalid, validity, message, attempted }>` written by a single `refresh(reason)` function the listeners and effects call; it reads the validity element, computes the slot (2.1) **before** reading (`setCustomValidity` changes `validity`), and writes the state only when something changed (so a `focusout` with nothing new causes no render). The derived `invalid` / `messages` / `validity` of `FieldState` are computed in render from the mirror plus the Form context (`serverShown`) and props.
- **Listeners** are native, attached by `Field.Root`'s layout effect (keyed on the registered element) with `capture: true` (`input`, `change`, `focusout`, `invalid`) and torn down with it. `invalid`: `attempt = supportsUserInvalid() ? target.matches(":user-invalid") : true; if (attempt && errorCount > 0) { event.preventDefault(); messages = refresh(); collectInvalid(focusTargetOf(element), messages.join(" ")) } else refresh()`. `input` / `change`: `setDismissed(true); refresh({ dismiss: true })`. `focusout`: `refresh()`. The form owner's `input` / `change` (for `validate`, skipping events from the Field's own control), `submit` (`setSuppressNext(false)`) and `reset` (microtask, unless `defaultPrevented`: `refresh({ reset: true })`) go through `useFormOwnerEvent`.
- **`supportsUserInvalid()`**: `CSS.supports("selector(:user-invalid)")`, decided once per module; where false (jsdom) the read is `attempted && !el.validity.valid`, `attempted` set in the `invalid` listener and cleared by `reset`. (The draft's "`matches` throws" test never engages in jsdom 30, 2.2.)
- **The slot**: inside `refresh()`, `el.setCustomValidity(showServer ? serverMessages.join("\n") : custom.join("\n"))` where `custom` is `validate?.(value, formData)` normalised and `showServer` is `serverShown && !options.dismiss`, written **before** the validity read; a slot moved to another element (a group's first member changed) clears the old one, and the Root's unmount clears it. The slot effect is a layout effect keyed on the control, `serverShown`, the server key and (per the L4 decision, 4.1) `validate`'s identity. For a `<fieldset>` control, `el` is the first named validatable member; `validity` and `validationMessage` are read from the same element.
- **The three flags** (3.4): `dismissed`, `suppressed`, `suppressNext` are `useState`s in `useServerErrorVisibility` (`src/field/use-server-error-visibility.ts`), called by `Field.Root`; the edges are detected with `previousFormPending` state compared in render (`false → true`: clear `suppressNext`; `true → false`: clear `dismissed`, `suppressed = suppressNext`, clear `suppressNext`). `refresh()` writes `suppressNext` while `formPending` and `form.submittedData()` is non-null.
- **`notifyChange(edit)`** (7.1): `if (edit) setDismissed(true); refresh(edit ? { dismiss: true } : {}); form?.refreshFields(ownRegistration)`.
- **`Field.Label` `for`**: `labelable` comes from the registration state (`useState` in Root written by the control's ref callback); its initial value is `true` so the server HTML and the hydration render carry `for` (8).
- **`Form.Root`**: `useTransition` for the intercepted run; the `FormStatusWatcher` from `dialog-form.tsx` moved to `internal/form-status-watcher.tsx` and imported by both; `submission` ref `{ formData, intercepted }` written in `onSubmit` (and, for React's path, in a native capture `submit` listener so the watcher's edge still finds `intercepted: false`; cleared when a `render` element's `onSubmit` prevented the event, L3); the settle effect does 3.2 in order: first Field with `showsServerError()` in document order → `focus()`, or `announce(target, serverMessages().join(" "))` when the target is `document.activeElement`; else `autoReset && intercepted && !hasAnyError(errors)` → `form.reset()`. `errors` and `autoReset` are read through `latest` in the settle effect. The context value is `{ errors, registerField, submittedData, refreshFields }`, memoised; `refreshFields(source)` calls `refresh()` on every registration but `source`.
- **The collector** (`focus-first-invalid.ts`): one batch per task (cleared by `setTimeout(0)`, because the browser runs a microtask checkpoint after each `invalid` listener when it dispatches them itself, so the first microtask runs before the second event fires), and a new batch when an element the batch already collected fires `invalid` again (one validation fires it once per element, so that is the next attempt, even before the timer: two attempts in one task, or a jsdom test that does not yield to timers; #120); every add queues a microtask that focuses the batch's first target in document order (re-focusing is a no-op); the batch records `moved` and `announced` so that when the first target is already active it is announced once and never after a focus move. `announce(el, message)` (`internal/announce.ts` since #129; the collector's own copy is gone) calls `el.ariaNotify(message)` when it is a function and the message is non-empty.
- **`Form.Submit`**: `useFormStatus()` + `useRender`; `type: rendersButton(render) ? "submit" : undefined`.
- **Existing controls**: each owner part adds `const field = useFieldControl({ labelable, name, disabled, required, id, component })`, merges `field.ref` into its library ref (`useMergedRefs`), spreads `field.attributes` into its `libraryProps` (owned) except `aria-describedby`, which goes through the token-merge path (`fieldInputProps(field)` does the spread plus `name` / `required` for a labelable native input); the part's effective `name` / `disabled` / `required` become `field.name` / `field.disabled` / `field.required` (the hook already applied "own or the Field's"); and calls `useFieldValueChange` with its optimistic value (7.1 table). RadioGroup's generated `name` falls back to the Field's before `useId`. CheckboxGroup strips `aria-invalid` from `field.attributes` for the fieldset and hands it to the Items through context. Combobox's Root reads `FieldContext` directly (7.2). Slider: #60.
- **Dev warnings** (once per element): wrong element for a part; two controls in one Field; two `Field.Error`s; nested `Field.Root`; a consumer `id` on a control inside a Field; a `Field.Root` whose `name` differs from its control's own `name`; a Field with `validate` and no `name`.
- **Docs site**: pages for Field and Form with the 11.1 example as a live client example and 11.2 as a Server Component example; props tables from the declarations; the CSS recipe of 6.2 including `field-sizing`.

---

## Conventions feedback (proposed)

Applied to `design/conventions.md` on 2026-10-18 (resolved question 30); kept here as the record of
what changed:

1. **1.1 part vocabulary.** Add `Control` ("the native form control a Field labels and
   describes: `input`, or `textarea` / `select` through `render`"), `Description` ("describes
   the owner through `aria-describedby`: `p[id]` (Field), `p[id]` (Dialog)"; Dialog's part is
   not in the table today), `Error` ("the message for a Field's current constraint violation;
   `div[id]`, rendered only while shown, referenced through `aria-describedby`"), `Submit` ("a
   form's submit button with the form channel's `data-pending`"). Widen `Label` with "`label[for]`
   naming a Field's control, or `label[id]` a group control is `aria-labelledby`", and `Root`
   with "a Form's `<form>`".
2. **1.2 element rules.** `Field.Control` must stay a native form control (`input`, `textarea`,
   `select`); `Field.Label` a `<label>`; `Form.Root` a `<form>`; `Form.Submit` a submitter.
   Inside a `Field.Root`, a control's `id` is owned by the Field.
3. **2.6 urgent lane.** A fourth urgent state: **a mirror of a browser-owned validity fact**
   (`:user-invalid`, `validity`, `validationMessage`), written with `useState` from the DOM event
   by `Field.Root`, because the DOM already holds it and the error must be in the DOM when focus
   moves to the field (2.4). No consumer-facing urgent action; no `transition` prop.
4. **2.7 form channel.** Three amendments: (a) a part that **has no action of its own** may
   expose the form channel's pending as its `pending` (`Field.Root`, `Form.Root`,
   `Form.Submit`), which is the exception the "never fold `useFormStatus`" rule needs; controls
   keep theirs separate. (b) `Form.Root` runs a function `action` itself after hydration
   (`onSubmit` `preventDefault()` + its own transition) while rendering it unwrapped on the
   element, so progressive enhancement and `useFormStatus` are kept and React's automatic reset is
   replaced by `autoReset` (settle with no errors). (c) Field errors returned from an action reach
   fields through `Form.Root errors`, keyed by `name`; the library never interprets an action's
   return value.
5. **3.5 residual paths.** Add: a form `reset` clears `:user-invalid` but not custom validity;
   `Field.Root` re-reads and recomputes its slot in the reset microtask. Add "the settle of a form
   submission" (`useFormStatus` edge) as a library-observed form-channel event that `Form.Root`
   acts on (Dialog's watcher generalised).
6. **3.6 computed native validity attributes.** Replace "never written through the DOM
   (`setCustomValidity`) in v0" with: the custom-validity slot of a control inside a `Field.Root`
   is **owned by the Field** (`validate` and the server error); a control never calls
   `setCustomValidity` itself; attribute-based constraints (CheckboxGroup's `required`) are
   unaffected.
7. **3.8 shared hooks.** Add `useFieldControl` (section 7.1) as the hook every form control's
   owner part calls, and `useFormOwnerEvent` as the generalisation `useFormReset` is built on.
8. **4.1 vocabulary.** Add `invalid` (every Field part: an error is shown) and `required` (every
   Field part). `pending` gains "`Field.Root`, `Form.Root`, `Form.Submit`: the enclosing form's
   submission (form channel)". 4.2: `:user-invalid` / `:user-valid` now have a documented
   attribute counterpart for the server-error half (`data-invalid`), the native half stays
   pseudo-class-only before hydration.
9. **5.1.** Field and Form join the no-`transition` parts (urgent mirror; CSS `@starting-style`).
10. **9.4 public types.** A component whose parts all share one state object may export a single
    `<Component>State` (`FieldState`) instead of one alias per part.
11. **7.1 directive layout.** A context shared by several component folders lives in
    `internal/` (`internal/field-context.ts`), imported by the component folders; the one-way
    rule (directive-free files never import directive files) is unchanged.
12. **10.1 test rows.** Add "**Form channel**: for a part that exposes `useFormStatus` as
    `pending`, the attribute appears during a deferred action and disappears after; a control
    inside keeps its own" and "**Inside a Field**: for every form control, the Field's wiring
    lands on the right element". Add "**Validity display**: a submission attempt shows the
    message, cancels the bubble and focuses the first invalid control; a reset clears it"
    (browser mode for the `:user-invalid` half).
13. **11 built-in strings.** Note that `Field.Error`'s default text is the browser's localised
    `validationMessage`, which is a platform string, not a library one; the override is the
    function form of `children`.

---

## For the product owner

Genuine product decisions, with recommendations; none blocks implementation.

1. **`Form.Root` runs the action itself on the client** (3.1): `onSubmit` `preventDefault()` +
   its own transition, with `action` still rendered unwrapped for progressive enhancement, so
   React's automatic reset is replaced by `autoReset` (reset on a settle with no errors).
   Alternative: keep React's path and document the `defaultValue={state.values.x}` recipe (the
   research's other verified workaround), which keeps values but not `:user-invalid` or custom
   validity, and puts a bookkeeping burden on every form. **Recommendation: as designed**; the
   react-dom source confirms the mechanism and the first browser row pins it. Cost: a submitter
   with its own `formAction` stays on React's path (documented).
2. **`autoReset` defaults to `true`** (reset on success). Alternative: `false` (never reset,
   explicit opt-in). **Recommendation: `true`**: it is React's own default minus the broken case,
   and a create-form is the common case; settings forms pass `false`.
3. **`Field.Root` exposes the form's pending as `data-pending`** (decision 10), an exception to
   conventions 2.7. Alternative: no `pending` on Field at all (`form[data-pending] .field` in
   CSS). **Recommendation: expose it**; a Field has no other `pending` to confuse it with, the
   research recommends it, and the cost is one `useFormStatus` per Field.
4. **No `aria-errormessage` in v1** (5.1), `aria-describedby` only. Alternative: render both
   (NVDA reads the error twice today; VoiceOver ignores the second). **Recommendation: omit**,
   re-check when VoiceOver supports it; adding it later changes no API.
5. **Server errors go into `setCustomValidity`** (3.4), so a resubmission of the unchanged value
   is blocked by the browser and `:user-invalid` styling covers them. Alternative: display-only
   server errors (no slot write; a resubmit always goes to the server). **Recommendation: as
   designed**, with the "changed during the flight" suppression so the slot never blocks a value
   the user already corrected.
6. **The stale-value suppression itself** (3.4, walkthrough 5): an error about a value the
   user replaced while the submission was in flight is not shown. Alternative: show every
   returned error (React Aria's behaviour). **Recommendation: suppress**; it also makes "reset
   while pending" come out right.
7. **Repeat submissions are not dropped** (3.6). Alternative: drop a submit while one is pending.
   **Recommendation: as designed** (React's queue is the ordering mechanism conventions 2.5
   names for forms; CSS blocks the button).
8. **Validity display is urgent, no `transition` on Field or Form parts** (2.4, 9).
   **Recommendation: as designed.**
9. **`Dialog.Form` and `Form.Root`**: today they compose through `render` (walkthrough 11) and
   `Dialog.Form` keeps React's path and its `closeOnSettle` rule. Follow-up: should `Dialog.Form`
   gain `errors` / `autoReset` and close only on a settle with no errors (one part, same policy)?
   **Recommendation: a follow-up issue after Field lands**, not part of this design.
   Resolved by #59 (dialog.md "Dialog.Form and Form.Root (#59)", implemented in 32611fd): no new
   props; the composition stays and `closeOnSettle` is error-aware when the form is a `Form.Root`.
10. **`Field.Label` for group controls**: a `<label>` with no `for`, the group `aria-labelledby`
    it, registration-based (the server HTML carries a `for` until hydration removes it, 8).
    Alternative: inside a Field, groups use their own legend `Label` and `Field.Label` warns.
    **Recommendation: as designed**, one call-site shape for every control; the validator nit is
    documented.
11. **`validate(value, formData)`, sync, re-run on every input in the form** (2.1). Alternative:
    no `validate` in v1 (native attributes and server errors only). **Recommendation: include
    it**; cross-field rules are the first thing every form needs and `setCustomValidity` is the
    platform's own slot for them.
12. **Conventions feedback 1 to 13** to apply on acceptance by whoever holds `conventions.md`.

## Accepted by the product owner

2026-10-18. All eleven recommendations in "For the product owner" are accepted as recommended (items 1–11), and the conventions feedback 1–13 is to be applied to `design/conventions.md` by the architect. Item 9 (Dialog.Form `errors`/`autoReset`) becomes a follow-up issue after Field lands (#59). Slider integration through `useFieldControl` is done once Slider is on master (it is being implemented in parallel); if Field lands first, it is a follow-up (#60). Items 1 (intercepting submission) and 4 (no `aria-errormessage`) are reported to the user as the most visible decisions and may be revisited.

---

## Review corrections (#54, 2026-10-18)

From `memo/reviewer/field-form.md` (review of merge e172925, implementation 9c08ed2..6801e28;
verdict "acceptable with fixes") and the developer's notes in `memo/developer/field-form.md`
("Implementation choices" 1–11 and "Review fixes"); code and tests in ae4640d, docs in 30a4bb2.
M2 and L4 were decided by the product owner. Each item is folded into the sections named; this
table is the audit trail. The architect agrees with every developer choice the review agreed
with; L4's fix is reverted by product-owner decision, the rest stand.

| Item | Correction | Section |
| --- | --- | --- |
| Choice 1 | **Each Field re-arms itself on its own `useFormStatus` `true → false` edge, in the settle render**, instead of the Form advancing a generation counter from its settle effect: the result's errors and `NotPending` land in one commit, so a re-shown error (dismissed, or the same strings twice) is in the DOM with its slot written before the Form's effect focuses it. The generation would have been one commit late. The Form context is `{ errors, registerField, submittedData, refreshFields }`; no generation. Review: agree. | Decisions 3, 3.2, 3.4, 10.2–10.4, 14 |
| Choice 2, M1 | Stale-value suppression is computed in the Field's own refresh during the flight (comparing `formData.getAll(name)` with the Form's `submittedData()`), not by the Form at settle time. Review: agree with the mechanism, but clearing one flag on `submit` was too eager: during the next flight `errors` still held the old result, `dismissed` was clear, so "a@b.c is taken" came back for a value the server never judged, blocked a queued click and moved focus. **Two flags**: `suppressNext` (written during the flight, reset on `submit` and at the `false → true` edge) is promoted to `suppressed` at `true → false`, and `suppressed` stays fixed until the next settle. | Decisions 9, 3.4, 3.6, 10.5, 10.5b, 10.7, 13.1, 14 |
| Choice 3 | **`autoReset` resets only when `errors` has no non-empty entry at all**, hidden stale ones included. 3.2 item 4 said "no non-empty, non-suppressed entry", which would have reset the form in walkthrough 5 and wiped the value the user had just typed; the prop doc and walkthrough 5 already read the other way. Reworded. Review: agree. | Decisions 8, 3.2, 4.4, 10.5 |
| Choice 4 | **`useFieldControl` returns no `data-pending`**; only `Field.Control` (a Field part) carries the form's. The 7.1 signature comment ("the part merges it with its own, either") contradicted 7.3, the 13.1 row and conventions 2.7; corrected. Review: agree. Conventions 3.8 row corrected too. | 7.1, 14; conventions 3.8 |
| Choice 5, L5 | The error id is in `aria-describedby` **whenever the field is invalid**, also with no `Field.Error` mounted (a dangling IDREF is ignored, like an unmounted Description's; gating on the error count would need state for nothing). 4.2's "nothing dangles" now says "while valid". Review: acceptable. | 4.2, 5.1 |
| Choice 6 | CheckboxGroup: `Field.Root required` is the group's "at least one" `required` (an attribute, not the slot). Review: agree. | 7.2 |
| Choice 7, H1 | Combobox reads `FieldContext` in the Root (hidden input `name` / `disabled`, the Input's id, the List's `aria-labelledby`); the Input registers; `validate` reads the selection. Review: agree with the shape, but **a pick fired no event the Field heard**: `validate` and a server error stayed stale, Enter after a pick was a silent failed submission, and a corrected selection could not be saved. Fixed with `useFieldValueChange(value, takeEdit?)` (a no-deps layout effect comparing the committed value) calling the Field's `notifyChange(edit)`: the Field refreshes (dismissing a server error when `edit`) and the Form refreshes its other Fields (`refreshFields`). Combobox passes `edit = true` for its own dispatches; CheckboxGroup keys on the sorted set plus the derived `required`; Checkbox, Switch, RadioGroup and Select pass their optimistic value (controlled changes, rollbacks). Cross-field refresh for such a change works only inside `Form.Root`. The synthetic-`change` alternative was rejected (7.1). | Decisions 2, 2.1, 7.1, 7.2, 10.12, 13.1, 14; conventions 3.8 |
| Choice 8 | Registration from the control's **ref callback** (returning the cleanup), not a layout effect: no extra render; StrictMode covered by a test; `required` / `disabled` changes re-register without re-attaching listeners (keyed on the element). The listeners are attached by `Field.Root`, not by the hook. Review: agree. | 7.1, 14 |
| M2 | **When the focus target already has focus, the message is spoken through `ariaNotify()`** (feature-checked; every supported engine has it): the collector, when the first invalid control is the active element (implicit submission with Enter), and the Form's settle effect, when the first errored Field's target is active (Enter in that field, server rejects it). A changed `aria-describedby` on the focused element is not announced by NVDA or VoiceOver, and the cancelled bubble was the platform's announcement. One announcement per batch, never after a focus move. Blur-and-refocus rejected (noisier, moves the caret). Product-owner decision. | Decisions 5, 2.5, 3.5, 5.1, 5.3, 10.13, 13.1, 14 |
| M3 | Test gaps closed: the progressive-enhancement browser row renders `Form.Root` with a fake Server Function (endpoint, method, encType, `$ACTION_ID`, errors in the server HTML, clean hydration); `Dialog.Form render={<Form.Root errors />}` rows; H1 and M1 rows. Slider's "inside a Field" row waits for #60. | 13.1, 13.2 |
| L1 | **CheckboxGroup puts `aria-invalid` on every Item, not on the fieldset**: ARIA 1.2 made `aria-invalid` widget-specific and deprecated it on `group`; 5.1's "valid on `group` / `radiogroup`" held for `radiogroup` only. The Items needed it explicitly anyway (the slot's `customError` on the first Item would be exposed too early by Chromium, 2.3). RadioGroup keeps it on the `radiogroup`; the multi-thumb Slider (#60) follows CheckboxGroup. | Decisions 5, 5.1, 7.2, 14 |
| L2 | A group's focus target **skips unnamed members** (a `CheckboxGroup.Parent` rendered first no longer wins), as `validityElementOf` already did. 2.5's "CheckboxGroup: the first item" is now literally true. | 2.5, 3.5, 7.2 |
| L3 | `Form.Root` honours a `render` element's `onSubmit` that calls `preventDefault()` (merged handlers run the consumer's first): the Form runs nothing and clears its submission record; React's own plugin skips a prevented submit too. | 3.1, 4.4, 13.1, 14 |
| L4 | The review proposed reading `validate` through a latest-ref and keying the slot effect on nothing but the control and the server state, because an inline `validate` re-ran (building a `FormData`) on every render; ae4640d did that, which changed 2.1's semantics ("a new function takes effect at the next read"). **Product-owner decision: 2.1 stands.** A changed `validate` prop takes effect at the commit in which it changed (identity-keyed re-run); the cost is avoided by the consumer with `useCallback`, which the prop doc recommends. The latest-ref read was reverted in d94c22f (code, JSDoc, docs page, test row). | 2.1, 4.1, 14 |
| L6 | Docs: the Field page has a "`Dialog.Form` rendered as `Form.Root`" section (the Form's policy applies: errors routed, values kept, reset only on success; `closeOnSettle={false}` still needed, #59) and the Dialog page points to it; the page also states the `aria-invalid` placement for groups, the `ariaNotify` fallback, and that a Combobox pick counts as an edit (30a4bb2). | 10.11 |
| Walkthrough 11 | Composition check: through `render`, `Form.Root` receives the `action` and intercepts, so **`Form.Root`'s `autoReset` applies and React's automatic reset does not**; refs merge, both watchers see the edge, no double run; the default `closeOnSettle` closes with errors (#59). The walkthrough said "React's path"; corrected. | 10.11, 13.1 |
| 2.2 | Developer finding, not a review item: jsdom 30 answers `false` to `matches(":user-invalid")` instead of throwing, so the fallback is gated on `CSS.supports("selector(:user-invalid)")`. | 2.2, 14 |

---

## Amendment: `validityElement` (#67, 2026-10-18)

Accepted with the NumberField design (`design/components/number-field.md` 7.1, product-owner
item 10; conventions 3.6 and 3.8). NumberField's user surface is a visible `input[type=text]`
and its form control is a visually hidden `input[type=number]` right after it, so the element
the Field labels, listens to and focuses is not the element whose `ValidityState` is real.
`FieldControlRegistration` gains one optional field and `Field.Root` one line:

| Field operation | Before | With `validityElement` |
| --- | --- | --- |
| `validity` snapshot, `messages` | `validityElementOf(element)` | `registration.validityElement?.() ?? validityElementOf(element)`: `rangeUnderflow`, `rangeOverflow`, `stepMismatch`, `valueMissing`, `customError` are the hidden input's, so `Field.Error`'s function `children` can branch on them |
| `:user-invalid` | `validityElementOf(element).matches(":user-invalid")` | unchanged: the registered element (the visible input), where typing and a submission attempt set the user-interacted flag; the control's own mirror makes it invalid whenever the hidden one is |
| `setCustomValidity(custom)` (the slot, 2.1) | on the validity element | on the `validityElement`, **followed by** `element.setCustomValidity(validityElement.validationMessage)` when the two differ, so the `:user-invalid` read in the same `refresh` sees the new state; identical to the control's own mirror, so the two writers never disagree |
| `invalid` listener, bubble cancellation, focus target (2.5, 3.5) | `element` | unchanged |
| `name`, `required`, `disabled` returned by `useFieldControl` | spread on the control | unchanged; the part decides which element carries them (NumberField: `name` and `required` on the hidden input, `disabled` on both and the buttons) |

Combobox, Slider and the native controls register no `validityElement`, so nothing changes for
them; the "Inside a Field" test row gains NumberField (conventions 10.1).
