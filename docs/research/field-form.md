# Field and Form: constraint validation, error semantics, React 19.3 form actions

Date: 2026-10-17. GitHub issue #55 (wave 5). Engines probed: Chromium 156.0.8078.4 and Firefox
157.0 (Playwright 1.64.1); React / react-dom 19.3.1 in vitest browser mode (real clicks). WebKit
cannot launch locally, so WebKit rows come from BCD 8.1.6 (2026-10-15) and vendor sources.
Current stable: Chrome 155, Firefox 158, Safari 27. Probes:
`memo/platform-researcher/probes/14-field-form/`.

## Summary and verdict

**Adopt native constraint validation as the source of validity** (`required`, `type`, `pattern`,
`min`/`max`, `minlength`, `setCustomValidity()`), `:user-invalid`/`:user-valid` as the
"when to show an error" signal, `requestSubmit()`, `aria-describedby` for both description and
error, and an **explicit `aria-invalid`** owned by the library. Keep `<form action>` and
`useActionState`/`useFormStatus` as the submission model. **Avoid** the native validation bubble
as the error UI (cancel `invalid`, render messages, focus the first invalid field) and
`aria-errormessage` as the only error link (VoiceOver on macOS still ignores it).

Findings that change the API design:

1. **React resets the form after every successful action, including when `useActionState` returns
   field errors.** The user's uncontrolled input is cleared and `:user-invalid` is cleared with it
   (`form.reset()` resets the user-validity flag). So a server error must not depend on the DOM
   value or on `:user-invalid`. Workarounds, all verified: return the submitted values from the
   action and render `defaultValue={state.values.x}` (the new default is applied before the reset),
   or submit through `onSubmit` + `preventDefault()` + `startTransition(() => dispatch(formData))`,
   which skips the reset and still drives `useFormStatus`. Opting out is still an open React issue
   (#29034, 105 comments; PR #36334 `autoReset`, open).
2. **`setCustomValidity()` persists until cleared.** A server error applied with it keeps the field
   invalid after the user edits it, and the browser blocks the next submit (verified both engines).
   The library must clear custom validity on the field's next `input`.
3. **Native invalidity reaches the accessibility tree inconsistently.** Chromium exposes
   `customError` and `typeMismatch` as `invalid` immediately (before any interaction), but never
   exposes `valueMissing` as `invalid`, even after `:user-invalid` starts matching. `aria-invalid`
   overrides the native state in both directions. The library should set `aria-invalid` from its
   own "error is shown" state, explicitly `true` or `false`.
4. **Canceling `invalid` also cancels the browser's focus move.** When the Field suppresses the
   bubble, the Form must focus the first invalid control itself.

| Feature | Blink | WebKit | Gecko | Verdict |
| --- | --- | --- | --- | --- |
| Constraint validation API (`validity`, `checkValidity`, `reportValidity`, `setCustomValidity`, `invalid` event) | ✓ | ✓ | ✓ | **adopt** |
| `:user-invalid` / `:user-valid` | 119 | 16.5 | 88 | **adopt** |
| `HTMLFormElement.requestSubmit()` | 76 | 16 | 75 | **adopt** |
| `SubmitEvent.submitter`, `new FormData(form, submitter)` | 81 / 112 | 15.4 / 16.4 | 75 / 111 | **adopt** (React 19.3 uses both) |
| `field-sizing: content` | 123 | 26.2 | 152 | **adopt** (consumer CSS) |
| `ariaDescribedByElements` / `ariaErrorMessageElements` (element reflection) | 135 | 16.4 | 136 | not needed (ids work; no shadow DOM) |
| `aria-describedby` for errors | ✓ | ✓ | ✓ | **adopt** |
| `aria-errormessage` | exposed as a relation (probed) | VoiceOver macOS: not announced (Ark UI #4150, 2026-10-01) | NVDA: supported (a11ysupport.io) | **not as the only link** |
| `ElementInternals.setValidity` (form-associated custom elements) | 77 | 16.4 | 98 | not needed |
| Native validation bubble as error UI | ✓ | ✓ | ✓ | **avoid** (not styleable, transient) |

## 1. Constraint validation and React form actions (probed)

Results are the same in both engines unless noted.

| Scenario | Result |
| --- | --- |
| `<form action={fn}>`, empty `required` field, click submit | `invalid` fires, **action not called**, focus moves to the field, `:user-invalid` matches |
| Same, `invalid` canceled with `preventDefault()` | no bubble, action not called, **focus stays where it was**, `:user-invalid` still matches (spec sets user validity before validating) |
| `noValidate` | action runs with the invalid data |
| `form.requestSubmit()` | validates like a click (`invalid`, focus, no action), then runs the action when valid |
| `form.checkValidity()` | fires `invalid` events too (spec), so an `invalid` listener must not assume a submit |
| `form.submit()` | skips validation and the `submit` event, so React never sees it. React sets the form's `action` attribute to `javascript:throw new Error('A React form was unexpectedly submitted…')`. Never call it |
| `setCustomValidity("…")`, user edits the field | still `customError`, next submit blocked |
| `form.reset()` | clears `:user-invalid` (user validity back to false) |

**`useFormStatus`** reports `pending` and `data` for the enclosing form, also from a component
rendered through `createPortal` (it follows the React tree). It also works when the form has no
`action` prop: react-dom's submit plugin starts a "host transition" for the form when `onSubmit`
calls `preventDefault()` and starts a transition in the same event (probe F8b, react-dom source
`startHostTransition(..., null, formData)`). That path does **not** reset the form.

**React 19.3.0 form changes** (CHANGELOG): `onReset` now fires for the automatic reset (#35176);
`submit` events include `submitter` (#35590); `FormData` is built with the `submitter` parameter
(#29028); form status reset fixed when component state updates (#34075).

### The automatic reset (finding 1)

| Pattern | After the action returns `{ error }` |
| --- | --- |
| uncontrolled input, `<form action={dispatch}>` | value **cleared**, `:user-invalid` false, error message still rendered from state |
| `defaultValue={state.values.q}` | value kept (the reset uses the new default) |
| controlled input (`value={v}`) | value kept: React keeps the `value` attribute equal to the current value, so the reset does nothing (slider.md finding 3) |
| `onSubmit` + `preventDefault()` + `startTransition(() => dispatch(fd))` | value kept, no reset, `useFormStatus` still pending during the action |

The reset after a *successful* save is usually what users want ("clear the form"); after a
validation failure it is not. Since the action cannot opt out, the library has two choices:
document the `defaultValue={state.values…}` pattern, or offer a
Form part that submits through `onSubmit` + `startTransition`, so the reset is opt-in through
`requestFormReset()`. Both keep native validation, because the browser only fires `submit` after
validation passes.

The automatic reset also matters for every controlled FUNSTACK input (Checkbox, Switch, Slider,
Select, Combobox): for checkables it desyncs the DOM (form-controls.md §2); for value inputs it is
a no-op. Both need the explicit `reset` handling already recommended.

## 2. Accessibility of errors

### Linking the message

- **`aria-describedby`** on the control, listing the description and (when shown) the error ids.
  Chromium computes the description as their concatenation (probed: "Use 8+ chars. Too short.").
  This works in every screen reader.
- **`aria-errormessage`** is exposed by Chromium as an `errormessage` relation (probed), and NVDA
  supports it, but VoiceOver on macOS still does not announce it (Ark UI issue #4150, opened
  2026-10-01, fixed by switching Ark/Chakra to `aria-describedby`; a11ysupport.io lists macOS
  VoiceOver + Safari as unsupported). Using both attributes risks double reading. **Recommend
  `aria-describedby` only**, and re-check `aria-errormessage` when VoiceOver supports it.
- **No live region on the error element.** Errors appear after a submit attempt, and the Form
  moves focus to the first invalid field, which reads its description. A live error would be read
  twice (and in older VoiceOver testing it broke the `aria-describedby` association). For
  errors that appear on blur, the next focus of the field reads it. An optional error summary
  (focused after submit) is a consumer pattern.

### `aria-invalid` (finding 3)

Chromium AX probe (`field-ax.cjs`):

| Field | `:user-invalid` | AX `invalid` |
| --- | --- | --- |
| `required`, empty, untouched | no | false |
| `required`, typed then cleared and blurred | **yes** | **false** |
| `setCustomValidity("…")`, untouched | no | **true** |
| `type=email value="nope"`, untouched | no | **true** |
| `type=email value="nope" aria-invalid="false"` | no | false |
| `required`, empty, `aria-invalid="true"` | no | true |

So native validity announces too early (custom and type errors while the user is still typing)
and too late (missing values never). The Field should render `aria-invalid={errorShown}` on its
control, always as an explicit boolean. ARIA in HTML lets host-language state take priority, but
Chromium honours the explicit attribute both ways (probed). Checkbox/radio early-invalid
(form-controls.md §3) is covered by the same rule.

### Message text

`validationMessage` is localised by the browser ("Please fill out this field.") and exists for
every native constraint. Use it as the default text of `Field.Error`, and let consumers override
per `ValidityState` key (`valueMissing`, `typeMismatch`, `tooShort`, `customError`, …).

## 3. When to show an error

`:user-invalid` encodes the platform's interaction heuristic: it matches after the user changed
the value and left the field, or after a submit attempt (also when `invalid` was canceled, both
engines), and it is cleared by a reset. Recommendation: the Field derives `data-user-invalid` (and
`errorShown`) by reading `control.matches(":user-invalid")` on `input`, `change`, `blur`,
`invalid` and `reset`, instead of re-implementing touched/dirty bookkeeping. Server errors are a
second source: they are shown from action state until the user edits the field, independent of
`:user-invalid` (which the automatic reset clears).

Styling: `:user-invalid` works directly on the control, and `:has(:user-invalid)` on the Field
root (Baseline, Chrome 105, Firefox 121, Safari 15.4). Data attributes are still needed for
server errors and for parts that are not ancestors of the control.

## 4. Progressive enhancement and Server Functions

- A Field built on native attributes validates **before hydration**: `required`, `type`, `pattern`
  and the bubble all work without JS, and `<form action={serverFunction}>` posts natively. That
  is a reason to keep validity in the DOM rather than in a JS schema.
- After hydration the library cancels `invalid` to suppress the bubble; before hydration the
  bubble is the fallback. This is acceptable degradation.
- `useActionState(action, initial, permalink)` gives the post-submit state before hydration too;
  server-returned errors render on the server into `Field.Error`.

## 5. Recommendation for the architect

1. **Anatomy:** `Field.Root` (div; `data-invalid`, `data-user-invalid`, `data-disabled`,
   `data-pending` from `useFormStatus`), `Field.Label` (`<label htmlFor>`), `Field.Control` (or any
   FUNSTACK input inside the Field, which picks up `id`, `aria-describedby`, `aria-invalid` from
   context), `Field.Description`, `Field.Error` (rendered only when shown; text from
   `validationMessage` or a per-`ValidityState` map).
2. **Validity source:** native constraints plus `setCustomValidity` for custom and server errors.
   Clear custom validity on the control's next `input`.
3. **`aria-invalid`:** explicit `true`/`false` from `errorShown`. `aria-describedby` lists
   description + error. No `aria-errormessage`, no live region on the error.
4. **Show timing:** derived from `:user-invalid` (events above) or a server error for the current
   value.
5. **Form part (optional):** a `Form` that cancels `invalid` events (no bubble), focuses the first
   invalid control after a failed submit or a server error, maps `state.errors` from the action to
   fields by `name`, and offers a reset policy. Recommend the default policy "reset only on success"
   implemented with `onSubmit` + `startTransition(dispatch)` + `requestFormReset()` when the result
   has no errors. The alternative is a documented `defaultValue={state.values…}` recipe on a plain
   `<form action>`.
6. **Submission:** document `requestSubmit()` (never `submit()`) for programmatic submits, for
   example "submit on change" from an action prop (form-controls.md §5).
7. **Pending:** `useFormStatus().pending` for submit buttons and `Field.Root` `data-pending`;
   per-control actions keep their own `data-pending` (form-controls.md §5).
8. **Reset:** each controlled FUNSTACK input keeps its `reset` listener; React 19.3's `onReset` on
   the form now also fires for the automatic reset.

## Issues worth reporting (human task)

- React #29034 / PR #36334: an opt-out for the automatic form reset (already filed; add the
  "validation error returned from `useActionState`" use case if it is missing).

## References

- BCD 8.1.6: `css.selectors.user-invalid`, `api.HTMLFormElement.requestSubmit`,
  `api.SubmitEvent.submitter`, `api.FormData.FormData.submitter`, `css.properties.field-sizing`,
  `api.Element.ariaDescribedByElements`, `api.ElementInternals.setValidity`, `css.selectors.has`:
  https://unpkg.com/@mdn/browser-compat-data@latest/data.json
- HTML spec, form submission algorithm (user validity set before interactive validation):
  https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#form-submission-algorithm
- HTML spec, constraint validation: https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#constraints
- ARIA in HTML: https://www.w3.org/TR/html-aria/
- Ark UI issue #4150 (`aria-errormessage` not announced by VoiceOver on macOS Tahoe, 2026-10-01):
  https://github.com/chakra-ui/ark/issues/4150
- a11ysupport.io `aria-errormessage`: https://a11ysupport.io/tech/aria/aria-errormessage_attribute
- Adrian Roselli, "Exposing Field Errors" (2023): http://adrianroselli.com/2023/04/exposing-field-errors.html
- David MacDonald, aria-describedby / aria-errormessage / aria-live tests (2020):
  https://davidmacd.com/blog/test-aria-describedby-errormessage-aria-live.html
- React CHANGELOG 19.3.0 (form items #35176, #35590, #29028, #34075):
  https://github.com/react/react/blob/main/CHANGELOG.md
- React #29034 (opt out of automatic form reset, open): https://github.com/react/react/issues/29034 ;
  PR #36334 (`autoReset`, open): https://github.com/react/react/pull/36334
- react-dom 19.3.1 submit plugin (`startHostTransition` for `onSubmit` + transition) and
  `updateInput` (value attribute syncing): `packages/ui/node_modules/react-dom/cjs/react-dom-client.development.js`
- FUNSTACK research: form-controls.md (reset, early invalid, Server Functions), slider.md (controlled
  value reset), select-combobox.md
- Probes: `memo/platform-researcher/probes/14-field-form/`
