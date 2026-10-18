# Architect notes: Field and Form (#54, wave 5), 2026-10-18

Working notes behind `design/components/field-form.md`. Not a spec.

## Prior art read for this design

- Base UI `Field` / `Form`: `Field.Root` (`name`, `disabled`, `invalid`, `validate(value,
  formValues)`, `validationMode: "onBlur" | "onChange"`, `validationDebounceTime`), `Label`,
  `Control`, `Description`, `Error` (`match: keyof ValidityState | boolean`, `forceShow`),
  `Validity` (render prop). `Form` takes `errors` keyed by name and `onClearErrors`; focuses the
  first invalid field on submit. Data attributes: `data-invalid`, `data-valid`, `data-touched`,
  `data-dirty`, `data-filled`, `data-focused`.
- React Aria Components: `TextField isInvalid validationBehavior="native" | "aria"`, `FieldError`
  renders `validationErrors` (native `validationMessage` or custom), `Form validationErrors`
  keyed by name (server errors, shown at once, cleared when the field changes); native mode sets
  `setCustomValidity` for custom `validate` and shows on submit, then live.
- Radix `Form`: `Form.Root serverErrors onClearServerErrors`, `Form.Field name`, `Form.Label`,
  `Form.Control`, `Form.Message match="valueMissing" | (value, formData) => boolean`,
  `Form.ValidityState`, `Form.Submit`. Native constraint validation underneath.
- Ark UI `Field`: `Root (invalid, required, disabled, readOnly)`, `Label`, `Input` / `Textarea` /
  `Select`, `HelperText`, `ErrorText`, `RequiredIndicator`. `ErrorText` used `aria-errormessage`
  until #4150 (VoiceOver), then `aria-describedby`.

Borrowed: `errors` keyed by `name` on the Form (everyone), native validity as the source (Radix,
React Aria native mode), `Field.Error` mounted only while shown (Base UI), the first-invalid focus
(Base UI, React Aria), `Form.Submit` (Radix), `validate(value, formData)` (Base UI / Radix's
custom `match`). Rejected: `onClearErrors` (an `on*` prop; replaced by the settle-generation
rule), `validationMode` (the platform's `:user-invalid` heuristic is the one mode), `match`
elements (one `Field.Error` with function children), `data-touched` / `data-dirty` /
`data-focused` (pseudo-classes, conventions 4.2), `Field.Validity` (function props),
`aria-errormessage` (research verdict), async `validate` (v2).

## The react-dom 19.3.1 facts the Form relies on (read in `react-dom-client.development.js`)

- Submit plugin (`extractEvents$1`, "submit"): the React `onSubmit` handlers run first (Simple
  plugin), then the form-action listener. If `nativeEvent.defaultPrevented`: **no action call**;
  if `currentEventTransitionLane !== 0` (a transition lane was requested in this event) it calls
  `startHostTransition(formInst, pendingState, null, formData)` with `pendingState = { pending:
  true, data, method, action }`, so `useFormStatus` still reports pending with `data`, `method`
  and the form's `action`. Otherwise, with a function action, it `preventDefault()`s and calls
  `startHostTransition(..., action, formData)`, whose callback does `requestFormReset$1(formFiber)`
  then `action(formData)`: that is the automatic reset, and it only happens on React's own path.
- `startHostTransition` with `null` action passes `noop` to `startTransition(formFiber, queue,
  pendingState, NotPendingTransition, noop)`: the `NotPending` update is a transition-lane update
  requested in the same event; `requestTransitionLane` reuses `currentEventTransitionLane`, which
  our own `useTransition` start set, and `requestUpdateLane` returns the entangled action lane
  while an async action is pending, so the status stays pending until the Form's awaited action
  (or the `useActionState` action) settles. The research's probe F8b shows the same empirically
  for the `dispatch` case.
- `requestFormReset$1` logs "called outside a transition or action" when `ReactSharedInternals.T
  === null` and schedules the reset as a state update on the form fiber's second hook: it resets
  at that transition's commit. The Form uses a plain `form.reset()` from its settle effect
  instead, which fires the same `reset` event.
- `useTransition`'s `startTransition` dispatches the pending=true optimistically (SyncLane) and
  the finished state on a transition lane, so it always requests a transition lane in the event,
  which is what makes the host transition start on the intercepted path even when the action is
  a plain function with no state update before its first `await`.
- A function `formAction` on a button is rendered as a `formaction` attribute (the
  `javascript:throw` string on the client), so `submitter.hasAttribute("formaction")` detects a
  per-button action without reading fiber props.

Unverified in the exact combination (action attribute rendered + `onSubmit` `preventDefault()`
+ transition) and pinned by the first browser row of the test plan: the submit plugin's branch
order above makes it follow from the source, but the research only probed the no-`action` form.

## Why the display state is urgent

Worked through against the vision's "urgent only where React requires it":

1. The error text and the `aria-describedby` token must be in the DOM when the collector focuses
   the first invalid control (microtask after the `invalid` events). A transition commit lands
   after the microtask, and is held while any async action is pending anywhere (entanglement),
   including a submission in another form on the page. AT reads the description at focus time.
2. There is nothing to await, no optimistic value and no veto: `:user-invalid`, `validity` and
   `validationMessage` are browser-owned and already changed; the state is a mirror, like
   Combobox's active option and Slider's `live`.
3. Cost accepted: no `<ViewTransition>` on Field parts; `Field.Error` content must not suspend.

Alternative considered: `aria-invalid` and `data-invalid` by DOM writes from the event (the
7.4 pattern) with only `Field.Error`'s content in React state. Rejected: the error element's
mount is React's, so the state is needed anyway, and splitting one fact over two mechanisms
would let them disagree for a frame.

## Reset policy: the three options and why intercept

| Option | Values kept on error | `:user-invalid` kept | PE kept | Cost |
| --- | --- | --- | --- | --- |
| React's path + `defaultValue={state.values.x}` recipe | yes (new default applied before reset) | **no** (reset clears the flag) | yes | every form threads values through the action's result |
| React's path + cancel the `reset` event (`preventDefault()` on React's automatic reset) | yes | yes | yes | telling React's reset from a user's reset button is a timing heuristic |
| `onSubmit` + `preventDefault()` + own transition (chosen) | yes | yes | yes (action attribute still rendered) | per-button `formAction` stays on React's path; `useFormStatus().action` is still the form's |

The `reset`-event cancel was tempting (it keeps React's action run) but a user's reset click
during a pending action is indistinguishable from React's automatic reset except by when it
arrives, and the settle effect already needs the intercept's knowledge of the submitted FormData
for the stale-value suppression.

## Server errors: identity vs. generation

The first draft showed a server error whenever the `errors` object identity changed. Inline
objects (`errors={{ email: state.emailError }}`) change identity on every render, so a controlled
form would re-show a dismissed error on every keystroke. The settle generation (a counter advanced
by the Form's `useFormStatus` edge) is robust against that and makes "reset while pending" and
"same error twice" come out right. Cost: an `errors` change from outside a submission through this
Form is not re-shown after a dismissal until the next settle.

## `Field.Label` for groups

Options for naming a `<fieldset>` Root from `Field.Label`:

1. `for` → the fieldset id: invalid target, validators complain, browsers ignore. Static.
2. Registration: the group registers `labelable: false` from its layout effect; the Label drops
   `for` and the group renders `aria-labelledby`. The server HTML carries `for` until hydration
   (the default must be "labelable" so a plain input is correct before hydration). Chosen.
3. Groups use their own legend `Label` inside a Field; `Field.Label` warns. Honest to the
   platform, but two call-site shapes.

Base UI does (2) in substance (its label switches element for non-labelable controls). The
validator nit of (2) is only the SSR HTML of a group Field, before hydration.

## `checkValidity()` vs. a submission attempt

`invalid` fires for `checkValidity()`, `reportValidity()` and the submit algorithm alike. The
submit algorithm sets user validity **before** interactive validation (spec; the research's
`user-invalid-canceled.mjs` confirms `:user-invalid` matches after a cancelled `invalid`), so
`el.matches(":user-invalid")` inside the `invalid` handler is true for a submission attempt and
false for a bare `checkValidity()` or `reportValidity()`. That is the gate for cancelling the
bubble and collecting for focus; it keeps `reportValidity()` meaning "show the platform UI".

## Things for the developer to check first

- Does jsdom 30's selector engine throw on `:user-invalid` (fallback engages) or return `false`
  silently (fallback never engages; the display rows move to browser mode)?
- `new FormData(form, submitter)` in jsdom 30 (used by the intercept).
- `useFormStatus` from a `Field.Root` rendered in a portal inside the form: React tree, works
  (research F4).
- The `Dialog.Form render={<Form.Root />}` composition: `Dialog.Form`'s owned `action` reaches
  `Form.Root` as a prop; the Popup's document `submit` listener ignores a form with a function
  action; the watcher's edge arrives from the host transition.
