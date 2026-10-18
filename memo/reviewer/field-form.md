# Review: Field and Form (#54, wave 5), 2026-10-18

Scope: merge e172925 (implementation 9c08ed2..6801e28), against design/components/field-form.md
(accepted), design/conventions.md, docs/vision.md, memo/developer/field-form.md. Files:
packages/ui/src/field/*, form/*, internal/{field-context,use-field-control,use-form-owner-event,
use-form-reset,validity,focus-first-invalid,form-status-watcher}.ts(x), and the useFieldControl
call sites in checkbox, switch, radio-group, checkbox-group, select, combobox, plus
dialog/dialog-form.tsx (watcher moved).

**Verdict: acceptable with fixes.** The core is sound: the submit intercept (`preventDefault` plus
the Form's own transition, `action` still rendered unwrapped), `useFormStatus` through the Form's
host status, `autoReset` only on an error-free settle, the urgent validity mirror, the explicit
`aria-invalid`, the bubble cancel and first-invalid collector, and SSR / progressive enhancement
all work as designed. One High (Combobox selection is invisible to the Field, so a stale slot
blocks submission) must be fixed before the next release. Two Mediums are behaviour bugs or gaps
with real users in mind; the rest are small.

Verification: throwaway jsdom tests in the session scratchpad (outside the repo), run with a
scratch vitest config rooted at packages/ui. The existing jsdom suites for field, form, combobox,
radio-group, checkbox-group, select, switch, checkbox and dialog pass (817 tests).

---

## High

### H1. A Combobox selection fires no event the Field hears: stale `validate` and server errors block submission
`field-root.tsx:297-328` (the Field listens for `input` / `change` on the registered element),
`field-root.tsx:341-347` (and for `input` / `change` on the form owner);
`combobox-root.tsx:875-883` (React writes the hidden input's `value`, with no event);
`combobox-input.tsx:112-121`; developer choice 7.

When an option is picked (click, or ArrowDown + Enter), the Input's text and the hidden input's
value are written by React, and no `input` or `change` event fires. So the Field's slot (`validate`
reads `formData.get(name)`, which is the hidden input) and its dismissal of a server error are not
recomputed until some later event happens.

Verified scenarios (throwaway jsdom test):
1. `validate={(v) => v === "" ? "Pick a country" : null}`. The user types "Jap", ArrowDown, Enter
   (hidden = "jp"), then Enter again to submit. `validationMessage` is still "Pick a country", the
   `invalid` event blocks the submission (the action is never called), and the Field's own
   `refresh()` in that `invalid` handler then re-runs `validate` and clears it. Result: nothing is
   submitted and no error is shown, a silent failed submission. A second Enter works. Clicking
   Save happens to work, because the `focusout` refresh runs first.
2. `errors={{ country: "We do not ship there" }}`. With `openOnClick`, the user clicks the input
   and picks a different option without typing. The error stays visible, the slot still holds the
   server message, and Save is blocked (action calls: 0) even after a blur. The user cannot
   resubmit the corrected selection until they type into the input.

The same gap affects cross-field `validate` rules on any other Field that read the Combobox's
value, and the stale-value suppression for a selection changed while a submission is in flight.
Fix options: (a) `useFieldControl` returns a `notifyEdit()` that Combobox calls when it commits a
selection (the same as the Field's `onEdit`), and Form-owner refreshes run too; or (b) Combobox
dispatches a bubbling `change` on its hidden input when the committed value changes (closest to
the platform, and also lets non-Field form code see the change). Add a combobox.test row for both
scenarios.

---

## Medium

### M1. A suppressed (stale) server error comes back during the next submission's flight
`field-root.tsx:208-214` (the pending-edge derived state), `field-root.tsx:350-352` (`submit`
resets `suppressed`); developer choice 2.

Verified: submit "a@b.c"; while it is pending, type "x@y.z"; the result is
`{ errors: { email: "a@b.c is taken" } }`, which is correctly suppressed. Then submit again,
sending "x@y.z". While that second submission is pending, the Field shows "a@b.c is taken",
`aria-invalid="true"`, and `validationMessage` = "a@b.c is taken". `suppressed` is cleared on
`submit` and on the pending edge, `dismissed` was cleared at the previous settle, and the
`errors` prop still holds the old result, so `serverShown` becomes true for a value the server
never judged. A queued second click during that flight is blocked by the slot, and the collector
then moves focus. The same thing happens after walkthrough 7 (a reset while pending).

The design's generation rule did not have this problem: `suppressed` belonged to a generation and
stayed until the next settle. Fix: split the state. Keep `suppressed` frozen from one settle to
the next, and compute a separate "suppress at the next settle" flag during the flight, which is
reset on `submit` (for the queued case) and promoted to `suppressed` at the `true → false` edge.
Add a form.test row.

### M2. When focus is already on the field, an error is never announced
`focus-first-invalid.ts:49` (`if (active !== first) first.focus()`), `form-root.tsx:153` (the
settle effect's `focus()`), `field-error.tsx` (no live region, by design 4.2 and 5.1).

The design's announcement model is "focus moves to the control and reads its description". Two
common flows have no focus move:
- The user presses Enter in a text field to submit (implicit submission) and that field is the
  first invalid one. The bubble is cancelled, the error renders, and focus stays put.
- The server returns an error for the field the user pressed Enter in. `focus()` on the element
  that already has focus does nothing.

`aria-describedby` changing on the focused element is not announced by NVDA or VoiceOver, so the
user hears nothing. The native bubble that was cancelled was the platform's announcement. Suggest
(for the architect): when the target is already `document.activeElement`, announce the messages
through `ariaNotify` where available (the library already uses it in Combobox). The alternative is
a blur-and-refocus, which is noisier. Document the behaviour on the Field page either way.

### M3. Test gaps on the paths that differ from the plain case
- Progressive enhancement: `field.browser.test.tsx:317` server-renders a plain
  `<form action="/subscribe">`, not `Form.Root`, so the design 13.2 row ("renderToString the
  Subscribe form") is not covered. Verified by a throwaway test with a fake Server Function
  (`$$FORM_ACTION`): `Form.Root` emits `action="/__sf/…"`, the method, the encType and the
  `$ACTION_ID` hidden input; `errors` at render put `Field.Error`, `aria-invalid="true"` and the
  error id in the server HTML; hydration produces no recoverable errors. Add that as a test.
- `Dialog.Form render={<Form.Root errors />}` (walkthrough 11): untested (see "Composition"
  below; it works).
- No row for H1 (Combobox selection) or M1 (the second flight).
- Slider: no "inside a Field" row, because there is no integration yet (tracked in #60).

---

## Low

### L1. `aria-invalid` on CheckboxGroup's `<fieldset>` (role `group`) is deprecated
`use-field-control.ts:124-130` → `checkbox-group-root.tsx:497`. WAI-ARIA 1.2 made `aria-invalid`
widget-specific (supported on application, checkbox, combobox, gridcell, listbox, radiogroup,
slider, spinbutton, textbox, tree, and inherited by searchbox, switch and treegrid), deprecated on
all other roles (change log 2019-10-25 / 2020-05-07). Design 5.1 says it is "valid on group /
radiogroup", which holds for radiogroup only. Browsers still map it, so the impact is
validators and future AT. Options: keep it and correct the design text, or omit it for a `group`
and rely on `data-invalid` plus the description. Multi-thumb Slider (#60) will have the same
question.

### L2. A CheckboxGroup's focus target can be `CheckboxGroup.Parent`
`validity.ts:148-164`. `focusTargetOf` takes the first enabled `input` in `fieldset.elements`.
A "select all" Parent rendered first wins, although design 2.5 says "CheckboxGroup: the first
item". `validityElementOf` already skips unnamed members; `focusTargetOf` should too (or prefer
named members).

### L3. `Form.Root` ignores a `preventDefault()` from a render element's `onSubmit`
`form-root.tsx:119-131`. Merged handlers run the render element's first, and the conventions'
veto rule (an `onClick` `preventDefault()` cancels the change on Checkbox) suggests a cancelled
`submit` should not run the action. Add `if (event.defaultPrevented) return;`.

### L4. An inline `validate` re-runs `refresh` on every Field render
`field-root.tsx:282-284`. The layout effect is keyed on `validate`'s identity, so every render
(including both pending edges of every submission) builds a `FormData`, runs `validate` and
writes the slot. It is correct (and only re-renders on a change), but costs O(fields × form size)
per render in large forms. Design 2.1 accepts "a commit in which the prop changed"; consider
reading `validate` through `latest` and keying on nothing but the control and the server key.

### L5. Dangling error id without `Field.Error` (choice 5)
`use-field-control.ts:125`. This is harmless (an unresolved IDREF is ignored). The Field already
counts `Field.Error`s; gating on that count would need state rather than a ref, so it is not worth
it. Design 4.2's "nothing dangles" sentence should say "while valid".

### L6. Docs: the composition and its policy
`packages/docs/src/pages/FieldPage.tsx`: walkthrough 11 says `Dialog.Form` takes React's path
(an automatic reset after errors). Through `render={<Form.Root errors />}`, `Form.Root` receives
`action` and intercepts, so `autoReset` applies and React's reset does not. That is better, but
it is documented nowhere. Add a short section to the Field page (and a pointer on the Dialog page),
noting that the default `closeOnSettle` still closes on a result with errors (#59).

---

## Composition check: `Dialog.Form render={<Form.Root errors />}` (walkthrough 11)

Throwaway jsdom test: `<Dialog.Root defaultOpen>` → `<Dialog.Form render={<Form.Root
errors={state.errors} />} action={dispatch} closeOnSettle={false}>` with a Field and
`Form.Submit`, `useActionState` dispatch.
- Error result: the action ran once, the "Taken" error was shown, the email kept its value
  (no reset), focus went to the email control, and the dialog stayed open.
- Edit then success: the error was dismissed by the edit, the action ran a second time, and the
  value was cleared (`autoReset`).
- Default `closeOnSettle`: the dialog closed even with errors (as Dialog 8.1 documents; #59).

The refs merge (Dialog's submit-capture ref plus Form.Root's), both watchers see the edge, and
there is no double run. **Works.**

---

## Areas checked without findings

- **Submission and Async React.** `onSubmit` → `preventDefault()` → `startTransition(async () =>
  await action(formData))`. react-dom skips its own run and reset and still starts the host
  status, so `useFormStatus` (child and portal) and `Form.Submit` are pending (pinned in browser
  mode for both a dispatch and a plain function). A string action and a `formaction` submitter are
  left alone. A rejection reaches the boundary with nothing reset. A queued dispatch gives one
  pending period. `pending` = own `isPending` || the watcher. All interactive updates are
  transitions except the validity mirror, which is the documented urgent lane (conventions 2.6).
- **autoReset.** Resets only when the settle is intercepted and `errors` has no non-empty entry,
  read through `latest` at the settle commit.
- **ARIA wiring.** `label[for]` (removed for groups after registration, `aria-labelledby` on the
  fieldset), `aria-describedby` token-merged with the consumer's first, explicit `aria-invalid`,
  `Field.Error` absent while valid, no role or live region (but see M2).
- **No `aria-errormessage`.** I agree. `aria-describedby` is the one relation every screen reader
  reads; adding `errormessage` later changes no API and must stay additive and only while invalid.
- **SSR.** The server HTML matches the hydration render; a group's `for` is the only change.
- **useFieldControl at each call site.** Checkbox / Switch / Select: id, name, required, ARIA
  owned through `fieldInputProps`. RadioGroup / CheckboxGroup: `aria-labelledby` and the Field's
  `name` / `required` / `disabled`. Combobox: the Root takes the Field's control id for the Input,
  the hidden input's name and `disabled`, and the List's `aria-labelledby`; the Input registers.
  Field.Control: the element check plus owned keys. Own `data-pending` stays separate (Field.Control
  carries the form's). Slider: not integrated (#60).

---

## Developer choices (memo/developer/field-form.md 1–8)

1. **Re-arm in the Field's render on its `useFormStatus` edge** instead of a Form generation
   effect: **agree.** It puts the error in the settle commit, before the Form's focus, which is
   what 2.4 requires. Design 3.4 and 14 should be updated to describe it. See M1 for how it
   interacts with suppression.
2. **Suppression in the Field's listeners, compared with the submitted FormData:** **agree with
   the mechanism.** Clearing it on `submit` is too eager (M1).
3. **`autoReset` only when `errors` has no non-empty entry at all, suppressed ones included:**
   **agree.** The literal 3.2 item 4 would wipe the value the user just typed in walkthrough 5. The
   architect should reword 3.2 item 4.
4. **The hook returns no `data-pending`; only Field.Control carries the form's:** **agree.**
   Conventions 2.7 and design 7.3 win over the 7.1 comment, which should be corrected.
5. **Error id listed whenever invalid, even with no `Field.Error`:** **acceptable** (L5).
6. **CheckboxGroup: `Field.Root required` = "at least one":** **agree.**
7. **Combobox reads FieldContext in the Root; the Input registers:** **agree with the shape**, but
   the integration is incomplete. A selection is invisible to the Field (H1).
8. **Registration in the control's ref callback, returning a cleanup:** **agree.** There is no
   extra render, StrictMode is covered by a test, and identity changes on `required` / `disabled`
   re-register without re-attaching listeners (they are keyed on the element).
Also 9–11: fine. The false-positive dev warning for a suspended control (10) is acceptable for a
dev-only message.

## For a GitHub issue (this repo)
- H1 and M1 (bugs). M2 as an a11y design question for the architect (the `ariaNotify` fallback
  when focus does not move).
