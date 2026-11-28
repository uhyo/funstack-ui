# Dogfood run 1: API issues #207 to #210

Analysis for a user decision. Design only; no library code was changed. Source: 
`memo/product-owner/dogfood-1-friction.md` (F4, F6, F7, F8, F9, F11, F17), the dogfood app, and
the code and design docs at `f33b8f66` (0.1.0-alpha.29).

Guiding constraint: one standard across similar components, no one-off APIs.

## Summary

| Issue | Kind | Recommendation | Breaking |
| --- | --- | --- | --- |
| #207 failed save without a boundary | API gap, plus wrong docs (Toast) | `onActionError` on every part that runs an action; fix the Toast and AlertDialog boundary advice | No (additive) |
| #208 form-level errors | API gap, plus docs gap | `Form.Root error` + `Form.Error` part; document "a field error blocks the same value" | No (additive) |
| #209 `MultiSelect.Value placeholder` | API footgun, plus wrong docs (Anatomy, skill) | `placeholder` wins while empty, also with `children` | Marginal |
| #210 commit of invalid text | API gap, plus docs gap | `details.valid` on the actions of form controls; keep "the commit does not look at validity" | No (additive) |

#207 and #210 interact: see "How the four fit together" at the end.

## #207 Failed save without an Error Boundary (F6, F8, F11)

### What the code does

- Conventions 2.4: a rejection reaches the nearest Error Boundary **above the part that owns the
  transition**; superseded and owner-gone rejections go to `reportError`. "There is no
  `errorAction` prop in v0." A consumer who wants inline UI catches inside the action, and a
  caught error **resolves**, which the library treats as success.
- So "handled failure" has three different idioms today, depending on the component:
  1. **State owners** (Checkbox, Switch, TextField, Slider, ...): must be controlled, and the
     action resolves without the parent adopting. Uncontrolled cannot do it: a caught error
     commits the new value (2.4, last paragraph).
  2. **Pure triggers that close their container** (`Toast.Action`, `Menu.Item`): a caught error
     closes the container. The way out is `closeOnActivate={false}` and closing by hand on
     success.
  3. **`AlertDialog.Action`**: a boundary inside the Popup, or a controlled `open` that the
     parent keeps.
- The dogfood app converted every row and every settings control to `useState` + controlled +
  `startTransition(() => set(next))` after the await (`TaskRow.tsx`, `SettingsPage.tsx`). It
  works, but it is the opposite of what the library advertises (uncontrolled with free rollback).

Verdict: an **API gap**. The library has a rollback and no way to use it without a boundary.

### The Toast "above the Viewport" claim

The **docs are wrong, the behaviour is right**.

- `Toast.Action` owns its transition (`usePureTrigger` in `toast-action.tsx`), so by conventions
  2.4 the rejection reaches the nearest boundary above **the Action part**. "Above the Viewport"
  is only where it ends up when nothing nearer exists.
- The wording is in `design/components/toast.md` (decision row 5, sections 3.2, 14 walkthrough 4,
  15.3), in the `toast-action.tsx` doc comment, and in `ToastPage.tsx` ("Undo and onClose" and
  its Callout). Section 15.3's own code puts the boundary **inside** the Viewport's children,
  around the list, which contradicts the prose.
- Both placements the docs name are bad: around the Viewport removes the region; around the list
  replaces every toast with one fallback.
- The "rethrow after `toast.update`" recipe defeats itself with either placement: the boundary's
  fallback replaces the toast whose title was just updated to "Could not undo".
- Correct advice with today's API: a boundary **inside `Toast.Root`, around `Toast.Action`
  only** (the updated Title stays visible, the fallback replaces the button), or one per toast
  (the dogfood workaround). AlertDialog has the same shape (F11): the boundary goes around the
  Action or an error slot, never around the row that holds Cancel.

These doc fixes are needed whichever option is chosen.

### Options

**A. Docs only.** A recipe "Handling a failed save without an Error Boundary" on the Action
props page, linked from the skill, covering the three idioms above; fix the Toast and AlertDialog
texts.

- Pro: no API change.
- Con: three idioms stay, and uncontrolled state owners still cannot do it. Every optimistic
  control in an app with toasts becomes controlled. The inconsistency is the thing the user's
  principle objects to.

**B. `onActionError` on every part that runs an action (recommended).**

```tsx
<Checkbox
  defaultChecked={task.done}
  checkedChangeAction={(next) => setTaskDone(task.id, next)}
  onActionError={(error) => toast({ title: "Could not update the task", type: "error" })}
/>

<AlertDialog.Action action={deleteTask} onActionError={(e) => setError(e)}>Delete</AlertDialog.Action>

<Toast.Action onActionError={() => toast.update(t.id, { title: "Could not undo" })} />
```

- One rule, written in conventions 2.4: a part that has `onActionError` delivers **every**
  rejection of its own actions to it, once, and nothing reaches the boundary. Without the prop,
  today's behaviour.
- What a rejection does to the component does not change: optimistic state reverts, uncontrolled
  state is not written, a trigger's container is not closed, the toast or dialog stays.
- It is a fact handler (conventions row 11): synchronous, outside the transition, not awaited;
  its own throw goes to `reportError`.
- "Every rejection" includes the superseded and the owner-gone ones, which today only reach
  `reportError`. That closes two silent failures: in a CheckboxGroup, "check A fails, check B
  succeeds" rolls A back with no message; an Undo that fails after its toast was closed is
  invisible.
- Works with a Server Function passed directly to the action prop (no wrapper to catch in).
- Name: `onError` is taken by the DOM event prop, hence `onActionError`.
- Pro: uncontrolled stays uncontrolled; one idiom for state owners, triggers, `Form.Root` and
  `Dialog.Form`; small core (the three hooks of 2.4 plus `Form.Root` already catch and route).
- Con: a new prop on every action-owning part (props tables, types, tests). Amends "no
  `errorAction` in v0". Parts with two actions (Slider, NumberField) need to say which action
  failed (a second argument `{ action: "valueChange" | "valueCommit" }`, to be designed).
- Not proposed now: an app-wide provider for a default handler. It would be one line for the
  dogfood app, but it is a second mechanism; decide after the prop exists.

**C. Error state on parts (`state.error`, `data-error`).**

- Pro: no handler; the message can be rendered from the state function.
- Con: the library would hold the consumer's error object and need a clearing rule (next
  dispatch? next success? focus?). It must still be opt-in, otherwise boundaries stop working,
  so it needs a prop anyway. It does not help the toast case (the consumer needs a callback to
  call `toast()`), which is the case that was asked for. Applies awkwardly to parts that are
  gone when the error arrives.

Rejected without detail: a thrown sentinel (`throw refuse()`) that the library swallows. It does
not cross the Server Function boundary and is invisible in the props table.

**Recommendation: B, with the doc fixes of A.** If the user prefers no new API before beta, A is
the fallback and the recipe must show all three idioms.

## #208 Form-level server errors (F7, F9)

### What the code does

- `Form.Root errors` is keyed by field `name`. A `Field.Root` with that name shows the entry and
  writes it into the control's custom validity until the user edits. That blocks a resubmission
  of the same value in the browser, by design (field-form.md 3.4): right for "title taken",
  wrong for "network hiccup".
- A key that matches no Field (`form-root.tsx`, `dialog-form.tsx`, both through `hasAnyError`):
  - no Field shows it, so nothing is focused and nothing is announced;
  - `autoReset` does not reset (any non-empty entry counts);
  - `Dialog.Form` stays open (same predicate);
  - nothing is rendered, and there is no dev warning.
- This is intended: field-form.md 2 says "A form-level message is the consumer's own markup; the
  library reserves no key for it", and 3.5 says there is no focus for it. But the docs site says
  none of this, so the dogfood agent's `errors._form` was a correct guess.

Verdict: the transient-error block is **by design but undocumented** (docs gap); the form-level
channel is an **API gap** (it exists only as an unnamed side effect, with no announcement).

### Options

**A. Docs only.** Document "a key with no Field is a form-level message; render it yourself in a
`role="alert"` element", and add a warning: a field error is a statement about that value and
blocks submitting it again; never put a transient error on a field.

- Pro: no API change; already works.
- Con: the channel is a convention. A typo in a field name silently becomes a "form-level"
  error that nobody renders. The consumer owns the announcement, where a Field error gets it
  from the library.

**B. `error` prop on `Form.Root` and a `Form.Error` part (recommended).**

```tsx
const [state, dispatch] = useActionState(createTask, {});

<Dialog.Form action={dispatch} render={<Form.Root errors={state.errors} error={state.error} />}>
  <Form.Error className="form-error" />
  <Field.Root name="title" required>…</Field.Root>
  <Form.Submit>Create</Form.Submit>
</Dialog.Form>
```

- `error?: FieldErrorValue` (same type as one entry of `errors`). `Form.Error` mirrors
  `Field.Error`: a `<div>`, rendered only while there is a message, default children the
  messages, function children get them.
- A non-empty `error` counts as an error for `autoReset` and for `Dialog.Form`'s close, exactly
  as an `errors` entry does.
- It never touches custom validity, so pressing Save again retries.
- At a settle where no Field takes focus, the Form announces it (the helper it already uses for
  a Field error whose control has focus). No focus move.
- Pro: a typed, documented channel with the same shape as the field one; accessibility handled
  by the library; unmatched keys in `errors` keep working (the error-summary recipe uses them).
- Con: one prop and one part. An action state now has two error fields (`errors` and `error`).

**C. A reserved key in `errors` (`""` or `_form`), rendered by `Form.Error`.**

- Pro: one prop; a server action returns one object.
- Con: a magic key inside a namespace of the user's own field names (`_form` can collide; `""`
  cannot but is obscure). The server code must know a library key.

**Recommendation: B, plus the docs warning from A.** Additive, no breaking change.

### F9 (stale errors when the dialog reopens)

Docs gap, no library fix: the errors live in the consumer's `useActionState`, which the library
cannot reset, and "errors present at mount are shown" is correct for a post-back. Rewrite the
`field#dialog-form` recipe so that the form and its `useActionState` are a component rendered
inside `Dialog.Popup` (its content unmounts while closed), and name the trap next to it.

## #209 `MultiSelect.Value placeholder` with function children (F4)

### What the code does

- `multi-select-value.tsx`: `children ?? (empty ? placeholder : labels joined)`. With `children`
  given, `placeholder` is never read. The doc comment says so ("Rendered by the default
  content").
- The docs' Anatomy and the skill both show `placeholder` together with a function that does not
  handle the empty case, which is the broken combination. The live examples repeat the
  placeholder text inside the function.
- `Select.Value` does **not** share the issue: it is `<selectedcontent>`, has no `children` and
  no `placeholder` (the placeholder is an `Option` with `value=""`). No other part has a
  `placeholder` prop of this kind (Combobox's is the native input attribute).

Verdict: an **API footgun** plus **wrong docs**.

### Options

**A. `placeholder` wins while empty (recommended).** While the selection is empty and
`placeholder` is given, the part renders it, with or without `children`. `children` is used for
the non-empty summary, and also for the empty case when no `placeholder` was passed.

- Pro: the combination everyone writes works; matches Radix and Base UI; the function no longer
  needs an empty branch.
- Con: a consumer who passes both and renders something else for empty inside the function now
  gets the placeholder. That combination did nothing useful before, so in practice not breaking.

**B. Pass `placeholder` in the state.** Does not remove the footgun; the function still has to
branch.

**C. Dev warning when both are given.** Forbids the natural call site instead of making it work.

**Recommendation: A.** Fix the Anatomy and the skill line either way.

## #210 A `required` TextField commits invalid text (F17)

### What the code does

- text-field.md 5: "The commit does not look at validity", as NumberField commits a number
  outside `min` / `max` (number-field.md 5.6). "A commit that waits for validity" is listed as
  rejected in section 13: it would leave an edited, unfocused draft on screen, and NumberField
  would have to follow.
- The same question exists for every form control, not only the commit-style ones:

| Control | Can the action receive an invalid value? |
| --- | --- |
| TextField | Yes: `required`, `pattern`, `minLength`, a Field's `validate` |
| NumberField | Yes: out of range, off the step grid, `null` with `required`. (Unparsable text is never dispatched: it reverts.) |
| OTPField `completeAction` | Only through a Field's `validate`: it runs for a complete code only |
| Slider | No (a range is always valid) |
| Checkbox, Switch, RadioGroup, CheckboxGroup, Select, MultiSelect, Combobox | Yes: unchecking or clearing a `required` control runs the change action |

- The value model behind the current rule is sound: the control holds what the user entered, and
  validity is a separate fact shown by the Field and enforced at form submission. In a form with
  a submit button nothing is wrong. The problem is only the inline-save use, where the action
  **is** the submission and is not told.

Verdict: **by design**, with an **API gap** (the action cannot see validity) and a **docs gap**
(one bullet on the page, nothing in the skill).

### Options

**A. Docs and skill only.** One sentence in the skill, and a visible section on the TextField
and NumberField pages.

- Pro: nothing changes.
- Con: the action has to re-implement the constraint that the Field already knows
  (`next.trim() === ""`), and a `validate` or `pattern` check has to be duplicated by hand.

**B. `details.valid` on the actions of form controls (recommended).**

```tsx
<Field.Root name="displayName" required>
  <TextField
    defaultValue={user.name}
    valueCommitAction={async (next, details) => {
      if (!details.valid) return; // the text stays, the Field shows why, nothing is saved
      await saveName(next);
    }}
  />
  <Field.Error />
</Field.Root>
```

- `valid: boolean`: the control's constraint validation for the value being requested (native
  constraints, the NumberField mirror, a Field's `validate`). Serialisable, so it reaches a
  Server Function too.
- One rule in conventions 2.2: **every value action of a control that takes part in constraint
  validation carries `details.valid`** (the controls of the table above; Slider always `true`).
  Not only TextField: a per-component flag would be the one-off the user wants to avoid.
- An early `return` in uncontrolled mode keeps the invalid text in the control with the Field's
  error next to it, which is the "keep the draft" behaviour without a new state. A controlled
  parent that does not adopt rolls back instead.
- Pro: additive; keeps the value model; the same field everywhere.
- Con: still opt-in, so an action that forgets the check saves invalid data (the type and the
  docs are the only reminders). Implementation cost is per control: validity must be computed
  for the **next** value before the dispatch (the Field writes its `validate` result after the
  dispatch today, field-form.md 2.4). The developer should confirm feasibility for the
  non-native controls (NumberField, MultiSelect, Combobox) before the user commits to all of
  them; a first step limited to TextField, NumberField and OTPField is acceptable if the rule is
  written as library-wide from the start.

**C. Do not dispatch while invalid.** Enter or blur with an invalid draft runs no action.

- Pro: safe by default; what the dogfood agent expected.
- Con: needs an answer for blur. Reverting loses the user's text (and "rewrites the user's
  number", which NumberField 5.6 refuses); keeping it needs a new "unfocused draft" state
  (`data-dirty`) in TextField and NumberField. It cannot extend to Checkbox or Select (a
  `required` checkbox must still be uncheckable), so commit-style controls would follow a
  different rule from the rest. Breaking for anyone who relies on the commit today.

**Recommendation: B, plus the skill sentence from A.**

## How the four fit together

- #207 B and #210 B give one story for inline saves, in uncontrolled mode:
  - invalid: `if (!details.valid) return;` (nothing saved, the Field explains);
  - the server refuses or fails: the action rejects, the control rolls back, `onActionError`
    shows the message.
- #208 B gives forms the matching pair: `errors` for "this value is wrong" (blocks the same
  value), `error` for "the submission failed" (does not block).
- None of the recommendations is breaking, apart from the marginal case in #209 A.

## To escalate to the user

1. #207: a new library-wide prop (`onActionError`) against docs only. This amends a v0 rule
   ("no `errorAction`") and touches every action-owning part.
2. #208: `error` + `Form.Error` against a reserved key against docs only.
3. #210: `details.valid` on all form-control actions against skipping invalid commits against
   docs only. Scope (all form controls or the three commit-style ones first) is part of the
   decision.
4. #209 needs no escalation unless the user objects to `placeholder` taking precedence.
