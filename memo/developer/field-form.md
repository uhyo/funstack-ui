# Developer memo: Field and Form (#54, 2026-10-18)

Design: `design/components/field-form.md` (accepted). Code: `packages/ui/src/field/`,
`packages/ui/src/form/`, `internal/{field-context,use-field-control,use-form-owner-event,validity,
focus-first-invalid,form-status-watcher}`. Docs page `/components/field`, playground
`field-form-demo.tsx`.

## Platform / tool findings

- **jsdom 30 does not throw on `:user-invalid`.** Its selector engine (@asamuzakjp/dom-selector)
  lists the pseudo-class as known-but-unsupported and answers `false`. So "fallback when
  `matches` throws" (design 2.2 / 14) would never engage. `supportsUserInvalid()` uses
  `CSS.supports("selector(:user-invalid)")` instead: false in jsdom, true in Chromium 156,
  Firefox 157 (and WebKit). The fallback ("`invalid` fired, still invalid, cleared by reset")
  cannot tell a submission attempt from `checkValidity()`, so in jsdom `checkValidity()` would
  cancel the bubble; that row is browser-only.
- jsdom: `new FormData(form, submitter)` works; `validationMessage` is always "Constraints not
  satisfied"; `requestSubmit()` fires `invalid` and blocks.
- **Browsers run a microtask checkpoint after each `invalid` listener** when the browser
  dispatches the events itself (a real click on a submit button). A collector that focuses in
  "one microtask per task" focuses the first Field before the second `invalid` even fires, then
  the second. The collector keeps its batch until a `setTimeout(0)` and queues a focus of the
  batch's first target on every add (re-focusing the same element is a no-op).
- **Firefox keeps the native validation bubble over the page**, and it swallows the next real
  click (a later browser test's radio click did nothing). Browser rows that let the bubble show
  (`reportValidity()`, a plain `<input required>`) type into the field afterwards to dismiss it.
- Firefox / Chromium: a required radio group's `:user-invalid` updates on all radios when one is
  checked (probed); no engine difference found for the rows here.
- The submit plugin combination (action attribute rendered + `onSubmit` `preventDefault()` +
  own transition) behaves as the architect read it in both engines: the action runs once,
  `useFormStatus` is pending with `data` in a child and a portal, no automatic reset. With a
  `useActionState` dispatch the Form's transition and the status stay pending until the queued
  action settles (entanglement), and a second queued submit keeps one pending period.
- jsdom + user-event: `user.type` while a `useActionState` submission is pending logs "A
  component suspended inside an `act` scope, but the `act` call was not awaited" (user-event's
  per-event sync `act` sees the pending transition suspend). The jsdom row uses `fireEvent.input`
  inside an async `act`; the browser row types for real and shows no fallback and no warning.
- Chromium AX through CDP from vitest browser mode: the test runs in an iframe, so
  `Accessibility.getFullAXTree` needs each frame's `frameId` (`Page.getFrameTree`).

## Implementation choices (design gaps, picked the sensible option)

1. **Settle generation per Field, in render.** Design 3.2/3.4 has the Form advance a generation
   in its settle effect. That lands one commit after the errors: a field the user had dismissed
   (or the "same error twice" case) would render its new error only after the Form's effect has
   already focused it, and the slot would not block yet. Instead each `Field.Root` reads
   `useFormStatus()` and, on its `true → false` edge, clears `dismissed` with the
   render-phase derived-state pattern, so the error is in the settle commit. Same observable
   rules (shown, dismissed by the next edit, re-armed by the next settle). The Form context is
   `{ errors, registerField, submittedData }`.
2. **Stale-value suppression in the Field's listeners.** While the form is pending and the Form
   ran the submission (intercepted), every refresh compares `formData.getAll(name)` with the
   FormData the Form sent (`submittedData()`; a `File` counts as unchanged). Reset on every
   `submit` event (a queued second submission sends the current values), not only on the
   pending edge, which a queued submit never crosses.
3. **`autoReset` resets only when `errors` has no non-empty entry at all**, suppressed ones
   included. 3.2 item 4 literally says "no non-empty, non-suppressed entry", which would reset
   the form in walkthrough 5 and wipe the value the user just typed; the prop doc ("settles with
   no non-empty entry in `errors`") and walkthrough 5 ("submits the new value unobstructed")
   agree with this reading.
4. **FUNSTACK controls inside a Field keep their own `data-pending` only.** 7.1's hook signature
   comment says the part merges the form channel's pending ("either"); 7.3, the 13.1 test row and
   conventions 2.7 say the channels never mix. Followed 7.3: the hook returns no `data-pending`;
   `Field.Control` (a Field part) does carry the form's.
5. `aria-describedby` lists the error id whenever the field is invalid, also with no
   `Field.Error` mounted (a dangling reference, accepted like the Description's).
6. CheckboxGroup: `Field.Root required` is the group's "at least one" `required`.
7. Combobox: the Root reads `FieldContext` directly (hidden input `name`, `disabled`, the
   Input's id = the Field's control id, the List's `aria-labelledby` → `Field.Label` when no
   `Combobox.Label` is mounted); `Combobox.Input` registers through `useFieldControl`.
   `validate`'s `value` is `formData.get(name)`, i.e. the hidden input (the selection).
8. Registration happens in the control's ref callback (no extra render); a ref callback must
   return a cleanup or `mergeRefs` calls it with `null`.
9. `useFormReset` now builds on `useFormOwnerEvent`; `onReset` is read through `useLatest` in
   the microtask (oxlint's rules-of-hooks rejects calling `useEffectEvent` functions from a
   closure handed to another hook).
10. Dev warning "no form control registered" fires from the Root's mount effect: a control
    inside a Suspense boundary that is still suspended at mount would warn falsely.
11. Docs: 11.2 (textarea from a Server Component posting to a Server Function) is a code block,
    not a live Server Component example: the static docs site has no Server Functions. The live
    textarea (`field-sizing`) is in the client example.

## Open / follow-ups

- Slider integration (`useFieldControl` with `labelable: values.length === 1`): Slider was not
  on master; follow-up.
- `Dialog.Form render={<Form.Root errors />}` composition (walkthrough 11) is not tested.
- WebKit not run locally (host libraries); browser rows avoid engine-specific assumptions except
  the CDP row (`describe.runIf(chromium)`, a test-tool limit). Watch the first WebKit CI run:
  the collector focus after a real click, `:user-invalid` after `userEvent.clear`, the
  `field-sizing` row (Safari 26.2+ supports it), the bubble-dismiss typing.

## Review fixes (memo/reviewer/field-form.md, 2026-10-18)

- **H1, `notifyChange`.** `FieldContextValue.notifyChange(edit)` plus `useFieldValueChange(value,
  takeEdit?)` (use-field-control.ts): a layout effect that tells the Field after any commit in
  which the control's optimistic value changed (not at mount). The Field refreshes (with dismiss
  when `edit`) and asks the Form to refresh its other Fields (`FormContext.refreshFields`; a plain
  `<form>` without `Form.Root` gets no cross-field refresh for a change no DOM event carried).
  Combobox passes `edit = true` for changes its own `dispatchValue` caused (a ref set when the
  dispatched value differs from the optimistic one). Checkbox, Switch, RadioGroup, Select pass
  nothing (their native `input` / `change` already dismiss); for them it covers controlled
  changes from outside (tested with a controlled Checkbox) and rollbacks. CheckboxGroup keys it
  on the sorted optimistic set plus the derived `required`.
- **CheckboxGroup Parent / derived `required` was not a reproducible gap in jsdom:** user-event
  wraps each dispatched event in `act`, so React has flushed the click's optimistic render before
  `input` / `change` fire. In browsers React handles a checkbox's change in `click`, which also
  precedes `input` / `change`. The notify is kept as the defensive path.
- **M1.** `suppressed` is frozen between settles; `suppressNext` is written by `refresh` during
  the flight, reset on `submit` and at the `false → true` edge, promoted at `true → false`.
- **M2.** `announce(el, message)` in focus-first-invalid.ts (`el.ariaNotify`, feature-checked).
  The collector batch records `moved` / `announced` so later microtasks of the same batch neither
  announce after a focus move nor announce twice. Form settle: announces the Field's server
  messages when the target is already `activeElement`.
- **L1.** CheckboxGroup: `aria-invalid` moved from the fieldset to every Item (owned there inside
  a Field); the fieldset keeps `data-invalid` / `aria-describedby`. Items need it explicitly
  anyway: the slot's `customError` on the first item would otherwise be exposed as invalid by
  Chromium too early (design 2.3). RadioGroup keeps it on `radiogroup` (supported).
- **L4.** `validate` read through `latest`; the slot effect is keyed on control / server state
  only. Behaviour change: a new `validate` function takes effect at the next read (edit anywhere
  in the form, blur, reset, attempt), not at the render. Design 2.1 / the prop doc said "when the
  prop changes"; docs and JSDoc updated, field.test row adjusted. Architect should confirm.
- L3: `defaultPrevented` → `submission.current = null` and return (React's own action plugin
  also skips a prevented submit).
