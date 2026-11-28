import { CodeBlock } from "../components/CodeBlock.js";
import { Callout } from "../components/Callout.js";
import { Example } from "../components/Example.js";
import { BehaviourIndex, BehaviourSection } from "../components/Concept.js";
import { DocPage } from "../components/DocPage.js";
import { PartFacts, PropsTable, Table } from "../components/Tables.js";
import { FieldAddress } from "../examples/FieldAddress.js";
import { FieldControls } from "../examples/FieldControls.js";
import { FieldNewTask } from "../examples/FieldNewTask.js";
import { FieldSignUp } from "../examples/FieldSignUp.js";
import { functionProps, renderProp, stylingProps } from "./shared-props.js";

export function FieldPage() {
  return (
    <DocPage
      title="Field and Form"
      description="Labelled, described, validated form fields on top of native constraint validation and :user-invalid, and a Form that runs its action in a transition, routes server errors to fields and resets only on success."
    >
      <p className="page-intro">
        <code>Field</code> wires a label, a description and an error message to a form control;{" "}
        <code>Form</code> runs the form's action. There is no validation engine: the browser's own
        constraint validation (<code>required</code>, <code>type</code>, <code>pattern</code>,{" "}
        <code>minLength</code>, …) is the truth, the platform's <code>:user-invalid</code> heuristic
        decides when an error is shown, and the browser's localised message is the default text.
        What the library adds is the wiring the platform does not do (ids,{" "}
        <code>aria-describedby</code>, an explicit <code>aria-invalid</code>), a styleable error
        element instead of the native bubble, the first-invalid focus, and the asynchronous half:
        the submission runs in a transition with <code>data-pending</code>, server errors land on
        their fields and go away on the next edit, and the form is reset only when the action
        reported no errors.
      </p>

      <Example file="FieldSignUp.tsx" css="field.css">
        <FieldSignUp />
      </Example>

      <BehaviourIndex />

      <h3 id="anatomy">Anatomy</h3>
      <CodeBlock>{`import { Field } from "@funstack/ui/field";
import { Form } from "@funstack/ui/form";

<Form.Root action={formAction} errors={state.errors} error={state.error}>  {/* form */}
  <Form.Error />                                                   {/* div, only while error is set */}
  <Field.Root name="email" required>                               {/* div */}
    <Field.Label>Email</Field.Label>                               {/* label[for] */}
    <Field.Control type="email" autoComplete="email" />            {/* input */}
    <Field.Description>We never share it.</Field.Description>     {/* p[id] */}
    <Field.Error />                                                {/* div[id], only while invalid */}
  </Field.Root>
  <Field.Root name="newsletter">
    <Field.Label>Newsletter</Field.Label>
    <Checkbox />                                                   {/* any FUNSTACK form control */}
  </Field.Root>
  <Form.Submit>Create account</Form.Submit>                         {/* button[type=submit] */}
</Form.Root>`}</CodeBlock>
      <ul>
        <li>
          <strong>
            <code>Field.Root</code> is a <code>div</code>
          </strong>{" "}
          that owns the ids and the field's state. <code>name</code>, <code>required</code> and{" "}
          <code>disabled</code> go to the control unless it sets its own.
        </li>
        <li>
          <strong>
            <code>Field.Control</code> is a native <code>&lt;input&gt;</code>
          </strong>
          , or a <code>&lt;textarea&gt;</code> / <code>&lt;select&gt;</code> through{" "}
          <code>render</code>. Every other input prop passes through (<code>type</code>,{" "}
          <code>defaultValue</code>, a controlled <code>value</code> / <code>onChange</code>,{" "}
          <code>pattern</code>, …). Outside a <code>Field.Root</code> it is the plain control (
          <a href="#field-control-alone">on its own</a>). There is no Input, Textarea or Fieldset
          part: the native elements, with the <a href="#textarea">textarea</a> and{" "}
          <a href="#fieldset">fieldset</a> recipes below.
        </li>
        <li>
          <strong>Any FUNSTACK form control is a Field's control</strong> without a wrapper:
          Checkbox, Switch, RadioGroup, CheckboxGroup, Select, Combobox, MultiSelect, Slider and
          NumberField (see <a href="/components/slider#inside-a-field">Slider inside a Field</a> and{" "}
          <a href="/components/number-field#inside-a-field">NumberField inside a Field</a>). A group
          (RadioGroup, CheckboxGroup, a Slider with several thumbs) is named by{" "}
          <code>Field.Label</code> through <code>aria-labelledby</code> instead of <code>for</code>.
          A RadioGroup carries <code>aria-invalid</code> on its <code>radiogroup</code>; a
          CheckboxGroup and a Slider on every item, because ARIA 1.2 does not support it on a{" "}
          <code>group</code>.
        </li>
        <li>
          <strong>
            <code>Field.Error</code> is rendered only while an error is shown
          </strong>
          . Write it once, unconditionally; its text is the browser's message, a server error, or
          what your function <code>children</code> return. An error that appears on blur can shift
          the layout, so a click right after typing (the click's press is the blur) may miss a
          button that moved; reserve the error's space if that matters.
        </li>
        <li>
          <code>Field.Description</code> is always referenced by the control, rendered or not.
        </li>
        <li>
          <strong>
            <code>Form.Error</code> is rendered only while the form has a form-level error
          </strong>{" "}
          (<code>Form.Root error</code>): a failed submission that is not about one field. See{" "}
          <a href="#form-level-errors">Form-level errors</a>.
        </li>
      </ul>

      <h3 id="how-it-works">How it works</h3>
      <h4>When an error is shown</h4>
      <p>
        A field shows an error when its control matches <code>:user-invalid</code> or the Form has a
        server error for it:
      </p>
      <ul>
        <li>
          <strong>Not while the user is still typing for the first time.</strong>{" "}
          <code>:user-invalid</code> starts matching after the user changed the value and left the
          field, or after a submission attempt; it then updates live on every keystroke and stops
          after a form reset. There is no <code>validationMode</code>: this is the heuristic every
          native form already uses.
        </li>
        <li>
          <strong>A submission attempt</strong> with an invalid field: the Field cancels the
          browser's validation bubble (only when a <code>Field.Error</code> is mounted), renders the
          message, and the first invalid control in document order is focused. Its description,
          error included, is read at focus. When focus is already there (Enter pressed in that
          field), the message is announced with <code>ariaNotify()</code> instead, where the browser
          has it. A field without <code>Field.Error</code> keeps the browser's bubble; so does every
          field before hydration.
        </li>
        <li>
          <code>form.checkValidity()</code> shows nothing and <code>reportValidity()</code> shows
          the browser's bubble, as without the library.
        </li>
        <li>
          The display state is updated urgently from the DOM event, not in a transition: the error
          must be in the DOM when focus reaches the field. After an edit it is updated once the
          event has been dispatched, so your own <code>onChange</code> on a controlled control runs
          first; the browser's validity follows the new value at once. So no Field part takes a{" "}
          <code>transition</code> prop, <code>Field.Error</code> animates its entry with CSS{" "}
          <code>@starting-style</code>, and content rendered inside it must not suspend.
        </li>
      </ul>

      <h4>Custom rules: validate</h4>
      <CodeBlock>{`<Field.Root
  name="confirm"
  required
  validate={(value, formData) => (value === formData.get("password") ? null : "Passwords do not match.")}
>`}</CodeBlock>
      <p>
        <code>validate</code> is synchronous and receives the field's value (
        <code>formData.get(name)</code> as a string) and the whole form's <code>FormData</code>. Its
        message is written into the control with <code>setCustomValidity</code>, so it blocks
        submission, matches <code>:invalid</code> / <code>:user-invalid</code> and is shown like a
        native constraint. It runs at mount, on every <code>input</code> / <code>change</code>{" "}
        anywhere in the form and on a FUNSTACK control's value change (cross-field rules stay
        current), on blur, after a reset, on a submission attempt, and whenever the prop changes, so
        a rule that reads outside state (a list that loads, a value in React state) updates on
        render. An inline function is a new prop on every render and so re-runs each time; wrap it
        in <code>useCallback</code> to re-run it only when its inputs change. A field with{" "}
        <code>validate</code> is rendered from a client component (a function is not serialisable).
      </p>

      <h4 id="details-valid">
        Inline saves: <code>details.valid</code>
      </h4>
      <CodeBlock>{`<Field.Root name="title" required>
  <Field.Label>Title</Field.Label>
  <TextField
    defaultValue={task.title}
    valueCommitAction={async (next, details) => {
      if (!details.valid) return; // nothing saved; the error stays next to the text
      await saveTitle(next);
    }}
  />
  <Field.Error />
</Field.Root>`}</CodeBlock>
      <p>
        Every value action of a form control (Checkbox, Switch, RadioGroup, CheckboxGroup, Select,
        MultiSelect, Combobox, TextField, NumberField, Slider, and OTPField's{" "}
        <code>completeAction</code>) gets <code>details.valid</code>: the control would be valid
        holding the value the action is called with. It covers the control's native constraints (
        <code>required</code>, <code>pattern</code>, <code>minLength</code>, <code>min</code> /{" "}
        <code>max</code> / <code>step</code>, a group's &quot;at least one&quot;) and, inside a
        Field, the Field's <code>validate</code> for that value. It does not cover a server error
        (that is about a value already submitted, and the change is the edit that dismisses it).
      </p>
      <p>
        It is information, not a gate: the library dispatches an invalid value like any other, and
        the Field shows the error. An action that saves checks it. Uncontrolled, the early return
        keeps the invalid value in the control and saves nothing; a controlled parent that does not
        adopt the value rolls back instead. <code>valid</code> is an ordinary boolean field, so a
        Server Function passed directly receives it. Handlers (<code>onValueChange</code>,{" "}
        <code>onInputValueChange</code>) and the actions of components that are not form controls
        (Toggle, Tabs, menus) have none.
      </p>

      <h4>Submission and server errors</h4>
      <p>
        With a function <code>action</code> (a Server Function, a <code>useActionState</code>{" "}
        dispatch, or a client function), <code>Form.Root</code> renders it on the{" "}
        <code>&lt;form&gt;</code> unwrapped, so before hydration the form posts to the Server
        Function. After hydration it runs the action itself, inside its own transition:
      </p>
      <ul>
        <li>
          <code>data-pending</code> is on the form, on <code>Form.Submit</code> and on every{" "}
          <code>Field.Root</code> (and its parts) while the submission is in flight, including the
          Suspense wait of what the result re-renders. <code>useFormStatus()</code> works as usual
          in your own components, also through a portal.
        </li>
        <li>
          <code>errors</code> (keyed by field <code>name</code>, usually <code>state.errors</code>{" "}
          from <code>useActionState</code>) reach each field. A server error is shown at once,
          written into the control's custom validity (a resubmission of the same value is blocked,
          with the usual focus), and dismissed by the user's next edit. The next settled submission
          shows its errors again, even identical strings.
        </li>
        <li>
          <strong>A field error is a statement about that value.</strong> Because it blocks a
          resubmission of the unchanged value, it is right for &quot;this title is taken&quot; and
          wrong for &quot;the request failed&quot;: a transient failure, or anything the user cannot
          fix by editing that field, goes in <code>error</code> (
          <a href="#form-level-errors">Form-level errors</a>). An entry of <code>errors</code> whose
          key matches no Field is shown by nothing and focuses nothing, but still counts as an error
          for <code>autoReset</code> and a dialog's close (an error summary of your own can rely on
          that); it is not the form-level channel, and a misspelt field name ends up there silently.
        </li>
        <li>
          After a submission with errors, the first field with an error is focused (its message is
          announced with <code>ariaNotify()</code> when focus is already on it). Errors present at
          mount (a progressive-enhancement post-back, a Server Component prop) are shown without
          moving focus.
        </li>
        <li>
          An error about a value the user changed while the submission was in flight is not shown:
          it is about a value they already replaced.
        </li>
        <li>
          <strong>Reset only on success.</strong> React resets a form after every successful action,
          including one that returned field errors, which wipes what the user typed. The Form resets
          (<code>form.reset()</code>) only when the submission settles with no error: no entry in{" "}
          <code>errors</code> and an empty <code>error</code>; pass{" "}
          <code>autoReset={"{false}"}</code> to keep the values (a settings form).
        </li>
        <li>
          An action that throws reaches the nearest Error Boundary above <code>Form.Root</code>;
          nothing is reset. Return errors from the action to keep the form. The rejection of a
          submission a later one superseded, or of one that settles after the form unmounted or was
          hidden, goes to <code>reportError</code> instead, like every other action (see{" "}
          <a href="/concepts/action-props">Action props</a>).
        </li>
        <li>
          A second submit while one is pending is not dropped: a <code>useActionState</code>{" "}
          dispatch queues it. Block repeat clicks with CSS on <code>Form.Submit[data-pending]</code>{" "}
          if you need to; the button is never disabled.
        </li>
      </ul>
      <h5 id="form-level-errors">
        Form-level errors: <code>error</code> and <code>Form.Error</code>
      </h5>
      <CodeBlock>{`const [state, formAction] = useActionState(createTask, {});
// state: { errors?: { title?: string }, error?: string }

<Form.Root action={formAction} errors={state.errors} error={state.error}>
  <Form.Error className="form-error" />
  <Field.Root name="title" required>…</Field.Root>
  <Form.Submit>Create</Form.Submit>
</Form.Root>`}</CodeBlock>
      <p>
        A failure that is not about one field (&quot;the server is unavailable&quot;) is the{" "}
        <code>error</code> prop, with the type of one entry of <code>errors</code> (a string,
        several strings, or nothing). The two props are the two kinds of failure:
      </p>
      <Table
        head={["", "errors[name]", "error"]}
        rows={[
          ["Says", "this field's value is wrong", "the submission failed"],
          ["Shown by", "the `Field.Error` of the Field with that name", "`Form.Error`"],
          ["Custom validity", "written on the control while shown", "never"],
          [
            "Submitting the same values again",
            "blocked until the field is edited",
            "allowed: that is the retry",
          ],
          ["Dismissed by", "the field's next edit", "nothing; replaced by the next result"],
          ["At the settle", "the first such field is focused", "announced, no focus move"],
          ["`autoReset`, `Dialog.Form` close", "prevented", "prevented"],
        ]}
      />
      <ul>
        <li>
          <code>Form.Error</code> mirrors the prop: it renders its <code>&lt;div&gt;</code> exactly
          while <code>error</code> has a message, at mount (a post-back), after a settle, and while
          the next submission is in flight (with <code>data-pending</code>, to dim it).
        </li>
        <li>
          After a settle with an <code>error</code>, the Form speaks the messages through{" "}
          <code>ariaNotify()</code> on the form, once per settle, also when the text is the same as
          last time (a second failed retry is news). Only while a <code>Form.Error</code> is
          mounted: if you render the message yourself, you own its announcement. When a field error
          is announced in the same settle (focus was already on that field), the two are one
          announcement, the form-level text first. Nothing is announced at mount.
        </li>
        <li>
          Focus moves to the first errored field if there is one, else stays where it was (usually
          the submit button, where the retry is). No <code>role=&quot;alert&quot;</code> and no{" "}
          <code>aria-live</code>: a live region would read the message twice.
        </li>
        <li>
          Several <code>Form.Error</code> parts may be mounted (top and bottom of a long form); the
          announcement is still one. <code>error</code> is serialisable, so a Server Component may
          pass it, and the part is plain markup in the server HTML.
        </li>
        <li>
          An action that <strong>throws</strong> still reaches the Error Boundary.{" "}
          <code>error</code> is for a failure the action caught and returned.
        </li>
      </ul>
      <h5 id="dialog-form">
        In a Dialog: <code>Dialog.Form</code> rendered as <code>Form.Root</code>
      </h5>
      <Example file="FieldNewTask.tsx" css="field.css">
        <FieldNewTask />
      </Example>
      <CodeBlock>{`"use client";
async function createTask(_: State, formData: FormData): Promise<State> {
  try {
    const result = await api.createTask(formData);
    return result.ok ? {} : { errors: result.fieldErrors }; // "title": "Already exists"
  } catch {
    return { error: "Could not reach the server. Try again." }; // nothing to fix in a field
  }
}

function NewTaskForm() {
  // Inside the Popup: the state starts fresh at every open.
  const [state, formAction] = useActionState(createTask, {});
  return (
    <Dialog.Form action={formAction} render={<Form.Root errors={state.errors} error={state.error} />}>
      <Form.Error />
      <Field.Root name="title" required>
        <Field.Label>Title</Field.Label>
        <Field.Control />
        <Field.Error />
      </Field.Root>
      <Dialog.Close value="cancel">Cancel</Dialog.Close>
      <Form.Submit value="save">Create</Form.Submit>
    </Dialog.Form>
  );
}

<Dialog.Root defaultOpen={false}>
  <Dialog.Trigger>New task</Dialog.Trigger>
  <Dialog.Popup>
    <NewTaskForm />
  </Dialog.Popup>
</Dialog.Root>`}</CodeBlock>
      <p>
        <code>Dialog.Form</code> renders a plain React form, which takes React's path: the form is
        reset after every successful action, also one that returned field errors. Rendered as{" "}
        <code>Form.Root</code> (
        <code>render={"{<Form.Root errors={state.errors} error={state.error} />}"}</code>),{" "}
        <code>Form.Root</code> receives the <code>action</code> and runs it, so its policy applies:
        server errors are routed to the fields and focused, and the form is reset only when the
        result has no error (<code>autoReset</code>, which you can pass on the{" "}
        <code>Form.Root</code> element). <code>Dialog.Form</code>'s <code>closeOnSettle</code>{" "}
        follows the same rule: a result with a field error or a form-level <code>error</code> keeps
        the dialog open (the typed values stay; the first errored field is focused, or the
        form-level error is announced), a result with no error resets the form and closes the dialog
        with the <code>Form.Submit</code>'s <code>value</code> as <code>returnValue</code>. An
        action that throws keeps the dialog open and reaches the nearest Error Boundary. An error
        hidden because the user changed that value while the action ran still counts: the dialog
        stays open and the user submits the new value.
      </p>
      <Callout title="Keep useActionState inside the Popup">
        <p>
          The Popup's content is unmounted while the dialog is closed (library mode, without{" "}
          <code>keepMounted</code>), so a form component rendered inside it starts with a fresh
          action state, and no errors, at every open. With the hook in the component that renders{" "}
          <code>Dialog.Root</code>, the state outlives the close, and the next open shows the last
          submission's errors on an empty form (errors present at mount are shown). In JS-free mode
          (a <code>Dialog.Root</code> with none of <code>open</code>, <code>defaultOpen</code>,{" "}
          <code>openChangeAction</code>, <code>onOpenChange</code>) the content is always mounted:
          pass <code>defaultOpen={"{false}"}</code> to select library mode.
        </p>
      </Callout>
      <ul>
        <li>
          The reset runs before the close, so an exit animation shows the fields at their defaults.
          With the default content (unmounted on close) the next open starts fresh anyway: pass{" "}
          <code>autoReset={"{false}"}</code> on the <code>Form.Root</code> element if your exit is
          visible. With <code>keepMounted</code> keep the default, since the reset is what makes the
          next open clean.
        </li>
        <li>
          The composition needs a function <code>action</code>. Without one, <code>Form.Root</code>{" "}
          owns <code>method</code> and the form would navigate instead of closing the dialog (a
          development warning says so); render a plain <code>Dialog.Form</code> for a{" "}
          <code>method="dialog"</code> form.
        </li>
      </ul>

      <Callout title="A submitter with its own formAction">
        <p>
          A <code>Form.Submit formAction={"{fn}"}</code> (or any button with a{" "}
          <code>formAction</code>) takes that submission out of the Form's hands: React runs it and
          resets the form afterwards, as it always does. A string <code>action</code> is a plain
          navigating form.
        </p>
      </Callout>

      <h3 id="props">Props</h3>
      <h4>
        <code>Field.Root</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "name",
            type: "string",
            description:
              "The control's default `name`, the key in `Form.Root errors`, and the entry `validate` reads.",
          },
          {
            name: "required",
            type: "boolean",
            default: "false",
            description:
              "Makes the control natively `required` and marks every part `data-required`.",
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description:
              "Disables the control, marks every part `data-disabled`, and keeps the control out of the submission: a native control is natively disabled, and Combobox and MultiSelect disable their hidden inputs too.",
          },
          {
            name: "readOnly",
            type: "boolean",
            default: "false",
            description:
              "Makes the control read-only and marks every part `data-readonly`: the value is focusable and submitted, the user cannot change it, and it never blocks a submission (`validate` is not run and a server error stays out of the control's validity, though it is still shown). Every FUNSTACK form control takes it; `Field.Control` renders native `readonly`. See [Disabled or read-only](#disabled-or-read-only).",
          },
          {
            name: "validate",
            type: "(value: string, formData: FormData) => FieldErrorValue",
            description:
              'A synchronous custom rule, written with `setCustomValidity`. Return a message (or several) for an error, `null` / `undefined` / `""` for none.',
          },
          ...functionProps("FieldState"),
          renderProp("div", "FieldState"),
        ]}
      />
      <PartFacts
        state={
          "`FieldState`, shared by every Field part, is `{ invalid, messages, validity, disabled, required, readOnly, pending }`; `invalid`: an error is shown; `messages`: the shown messages (the browser's `validationMessage`, `validate`'s strings, or the server's), `[]` while valid; `validity`: a `FieldValidity` snapshot of the control's `ValidityState` (`valueMissing`, `typeMismatch`, `tooShort`, …, `customError`, `valid`); `disabled` / `required` / `readOnly`: the Field's or the control's own; `pending`: the enclosing form's submission is in flight."
        }
        owned={"`data-invalid`, `data-disabled`, `data-required`, `data-readonly`, `data-pending`."}
      />

      <h4>
        <code>Field.Label</code>, <code>Field.Description</code>
      </h4>
      <PropsTable
        rows={[
          ...functionProps("FieldState"),
          {
            name: "render",
            type: "ReactElement | ((props, state: FieldState) => ReactNode)",
            description:
              "Replace the default <label> (Label; it must stay a <label>) or <p> (Description) (element form), or take over rendering (function form).",
          },
        ]}
      />
      <PartFacts
        state={"the Field's."}
        owned={
          "Label: `id`, `htmlFor` (absent for a group control), `onClick` (for a button control the label activation is cancelled and the button focused; a `render` element's own handler runs first); Description: `id`; both also the Field's five `data-*` attributes."
        }
      />

      <h4>
        <code>Field.Control</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "id",
            type: "string",
            description:
              "Native `id`, outside a `Field.Root` only. Inside one the Field owns the id (so `Field.Label` can point at it) and this prop is ignored with a development warning.",
          },
          {
            name: "name",
            type: "string",
            default: "the Field's",
            description: "Native `name`.",
          },
          {
            name: "required, disabled, readOnly",
            type: "boolean",
            default: "the Field's",
            description:
              "Native; the Field's value also applies (either one is enough). `readOnly` locks text-like inputs and a `<textarea>` only: on a `<select>` or a checkbox it does nothing and logs a development warning (use `Select`, `Checkbox` and the other library controls).",
          },
          ...stylingProps("FieldState"),
          renderProp(
            "input",
            "FieldState",
            "It must render an <input>, <textarea> or <select>: `render={<textarea rows={3} />}`.",
          ),
          {
            name: "…",
            type: "native",
            description:
              "Every other `<input>` prop passes through; the Field's listeners are native, so your `onInput` / `onBlur` run independently.",
          },
        ]}
      />
      <PartFacts
        state={"the Field's."}
        owned={
          'Inside a Field: `id`, `name`, `required`, `disabled`, `readOnly`, `aria-invalid` (always `"true"` or `"false"`: it stops Chromium announcing a `typeMismatch` before it is shown, and exposes `valueMissing`, which it otherwise never does), `aria-describedby` (your tokens first, then the description, then the error while shown), and the Field\'s five `data-*` attributes.'
        }
        note={
          "Outside a `Field.Root` it is the plain native control: every prop passes through (`id` included), the library adds no attribute, and the function props receive a `FieldState` with the control's own `disabled` / `required` / `readOnly` and a constant valid, not-pending rest. The other Field parts still throw outside a Field. See [Field.Control on its own](#field-control-alone)."
        }
      />

      <h4>
        <code>Field.Error</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "children",
            type: "ReactNode | ((state: FieldState) => ReactNode)",
            default: 'messages.join(" ")',
            description:
              'Rendered only while `invalid`. A function for per-constraint wording: `({ validity, messages }) => validity.valueMissing ? "Enter your email" : messages.join(" ")`. Must not suspend.',
          },
          ...stylingProps("FieldState"),
          renderProp("div", "FieldState"),
        ]}
      />
      <PartFacts
        state={"the Field's."}
        owned={"`id` and the Field's five `data-*` attributes."}
        note={
          'No `role` and no live region: after a submission focus moves to the field and reads the error with the description (a live region would read it twice). Add `aria-live="polite"` yourself if you want blur-time errors announced. One per Field.'
        }
      />

      <h4>
        <code>Form.Root</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "action",
            type: "string | ((formData: FormData) => unknown)",
            description:
              "A Server Function, a `useActionState` dispatch or a client function, rendered unwrapped (progressive enhancement) and run by the Form in its own transition after hydration. A string is a navigating form.",
          },
          {
            name: "errors",
            type: "FormErrors",
            description:
              "`Record<string, string | readonly string[] | null | undefined>` keyed by field name. Shown on the matching Field, written into its control's validity (the same value cannot be resubmitted), dismissed by its next edit, re-armed by the next settled submission.",
          },
          {
            name: "error",
            type: "FieldErrorValue",
            description:
              "A form-level error: a failure that is not about one field (usually `state.error`). Shown by `Form.Error` and announced when a submission settles. Never written into a control's validity, so the same values can be submitted again. While it is not empty the form is not reset and a `Dialog.Form` stays open. See [Form-level errors](#form-level-errors).",
          },
          {
            name: "autoReset",
            type: "boolean",
            default: "true",
            description:
              "Reset the form when a submission the Form ran settles with no error: no non-empty entry in `errors` (one hidden because the user replaced the value still counts) and an empty `error`. `false`: never.",
          },
          {
            name: "method",
            type: "string",
            description: "Only with a string `action`.",
          },
          ...functionProps("FormRootState"),
          renderProp("form", "FormRootState"),
        ]}
      />
      <PartFacts
        state={"`FormRootState` is `{ pending }`."}
        owned={"`action`, `method` (except with a string `action`), `onSubmit`, `data-pending`."}
        note={
          "`noValidate` and `onReset` pass through. A `render` element's own `onSubmit` runs first; calling `preventDefault()` in it cancels the submission."
        }
      />

      <h4>
        <code>Form.Submit</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description:
              'Native `disabled`; owned, so a `render` element cannot re-enable it. Never set by the library while pending. Native also with a component `render` (assumed to render a submit button: only native `disabled` stops a submitter before hydration). With a host element of another tag (`render={<a />}`), `aria-disabled="true"` instead and the click is cancelled.',
          },
          ...functionProps("FormSubmitState"),
          renderProp("button", "FormSubmitState"),
        ]}
      />
      <PartFacts
        state={
          "`FormSubmitState` is `{ pending, disabled }`; `pending` is `useFormStatus().pending` of the enclosing form, so it works in any React form (`Dialog.Form`, a plain `<form action>`)."
        }
        owned={
          '`type` (`"submit"`, on a `<button>`), `disabled`, `aria-disabled` (a host element other than `<button>` / `<input>`), `onClick` (while disabled), `data-pending`, `data-disabled`. To tell submit buttons apart, read the submitter\'s `name` / `value` in the `FormData`.'
        }
        note={"`name`, `value` and `formAction` pass through."}
      />

      <h4>
        <code>Form.Error</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "children",
            type: "ReactNode | ((state: FormErrorState) => ReactNode)",
            default: 'messages.join(" ")',
            description:
              "Rendered only while `Form.Root error` has a message. A function gets the state. Must not suspend.",
          },
          ...stylingProps("FormErrorState"),
          renderProp("div", "FormErrorState"),
        ]}
      />
      <PartFacts
        state={
          "`FormErrorState` is `{ messages, pending }`; `messages`: `Form.Root error`, normalised (never empty while the part renders); `pending`: the enclosing form's submission is in flight."
        }
        owned={"`data-pending`."}
        note={
          "Throws outside a `Form.Root`. No `role` and no live region: while it is mounted the Form announces the messages with `ariaNotify()` at each settle. `id` is yours (nothing references the part)."
        }
      />

      <h3 id="data-attributes">Data attributes</h3>
      <Table
        head={["Attribute", "On", "Meaning"]}
        rows={[
          ["`data-invalid`", "every Field part", "An error is shown (`FieldState.invalid`)."],
          [
            "`data-required`",
            "every Field part",
            "`Field.Root required` or the control's own `required`.",
          ],
          ["`data-disabled`", "every Field part, Form.Submit", "Disabled by prop."],
          [
            "`data-readonly`",
            "every Field part",
            "`Field.Root readOnly` or the control's own `readOnly`.",
          ],
          [
            "`aria-disabled`",
            "Form.Submit",
            "`disabled` with a `render` element that cannot be natively disabled (`<a>`).",
          ],
          [
            "`data-pending`",
            "every Field part, Form.Root, Form.Submit, Form.Error",
            "The form's submission is in flight. A FUNSTACK control inside keeps its own `data-pending` for its own action.",
          ],
          [
            "`:user-invalid`, `:user-valid`",
            "the control",
            "The platform's; work before hydration. `data-invalid` adds server errors and the parts that are not the control.",
          ],
        ]}
      />

      <h3 id="keyboard-and-aria">Keyboard and ARIA</h3>
      <p>
        Nothing beyond the platform: Tab order is the DOM's, Enter in a text field submits, a click
        on the label focuses or activates the control. After a failed attempt, assistive technology
        hears the control, "invalid entry", the description and the error, in that order.{" "}
        <code>aria-errormessage</code> is not used: VoiceOver does not announce it, and{" "}
        <code>aria-describedby</code> works in every screen reader.
      </p>

      <BehaviourSection
        id="transition-types"
        summary={"None: no part adds transition types or takes a `transition` prop."}
      />

      <BehaviourSection
        id="optimistic-and-pending"
        summary={
          "A Form with a function `action` runs it in its own transition: `data-pending` is on the form, on `Form.Submit` and on every Field part while the submission is in flight. A Field's display state (whether its error shows) is updated urgently from the DOM event (after an edit, once the event has been dispatched), not in a transition."
        }
      />

      <BehaviourSection
        id="suspense"
        summary={
          "The submission's pending state includes the Suspense wait of what the result re-renders. Content inside `Field.Error` must not suspend."
        }
      />

      <BehaviourSection
        id="browser-owned-state"
        summary={
          "Validity is the browser's: native constraint validation, `:user-invalid` and the browser's validation message; `data-invalid` adds server errors."
        }
      />

      <BehaviourSection
        id="before-hydration"
        summary={
          "The browser validates and shows its bubble, and the form posts to the Server Function (React's progressive enhancement). A group control's label carries `for` until hydration."
        }
      >
        <h4>From a Server Component</h4>
        <CodeBlock>{`// app/subscribe.tsx: a Server Component, no client code of yours.
import { Field } from "@funstack/ui/field";
import { Form } from "@funstack/ui/form";
import { subscribe } from "./actions"; // "use server"

export function Subscribe() {
  return (
    <Form.Root action={subscribe}>
      <Field.Root name="email" required>
        <Field.Label>Email</Field.Label>
        <Field.Control type="email" autoComplete="email" />
        <Field.Error />
      </Field.Root>
      <Field.Root name="body" required>
        <Field.Label>Comment</Field.Label>
        <Field.Control render={<textarea rows={2} maxLength={2000} />} className="comment" />
        <Field.Error />
      </Field.Root>
      <Form.Submit>Subscribe</Form.Submit>
    </Form.Root>
  );
}`}</CodeBlock>
        <p>
          Every part may be rendered from a Server Component with serialisable props. Before
          hydration the browser validates and shows its bubble, and the form posts to the Server
          Function; the ids, <code>aria-describedby</code> and <code>aria-invalid="false"</code> are
          in the server HTML. A group control's label carries <code>for</code> until hydration
          replaces it with the group's <code>aria-labelledby</code>.
        </p>
      </BehaviourSection>

      <h3 id="styling">Styling</h3>
      <CodeBlock language="css">{`.field[data-invalid] .control            { border-color: var(--danger); }
.field:has(.control:user-valid) .control { border-color: var(--ok); }      /* no JS needed */
.field[data-disabled]                    { opacity: .5; }
.field[data-required] .label::after      { content: " *"; }
.error { color: var(--danger); opacity: 1; transition: opacity 150ms; @starting-style { opacity: 0; } }

/* The control grows with its content: no auto-resize hook. */
textarea.control { field-sizing: content; min-height: 3lh; max-height: 12lh; }
select.control   { field-sizing: content; }

form[data-pending]           { cursor: progress; }
.submit[data-pending]        { pointer-events: none; }   /* your "no double submit" */`}</CodeBlock>
      <p>
        <code>field-sizing: content</code> (Chrome 123, Safari 26.2, Firefox 152) makes a textarea
        or a text input size to its content. Tailwind:{" "}
        <code>data-invalid:border-red-500 data-pending:opacity-70 field-sizing-content</code>.
      </p>

      <h3 id="recipes">Recipes</h3>
      <h4>FUNSTACK controls in a Field</h4>
      <Example file="FieldControls.tsx" css="field.css">
        <FieldControls />
      </Example>
      <ul>
        <li>
          Inside a <code>Field.Root</code> the control's <code>id</code> belongs to the Field (so{" "}
          <code>Field.Label</code> can point at it); <code>name</code>, <code>required</code> and{" "}
          <code>disabled</code> default from the Field.
        </li>
        <li>
          The <a href="/concepts/action-props#form-channel">two channels</a> stay separate: a
          control's own action (the Switch above saves on its own) gives <em>it</em>{" "}
          <code>data-pending</code>; the form's submission gives the Field <code>data-pending</code>
          , never the control.
        </li>
        <li>
          Combobox: the <code>Combobox.Input</code> is the control, the hidden input takes the
          Field's <code>name</code>, and the listbox is named by <code>Field.Label</code> when no{" "}
          <code>Combobox.Label</code> is rendered. <code>validate</code> reads the selection (the
          hidden input), and picking an option counts as an edit: it re-runs <code>validate</code>{" "}
          and dismisses a server error, like typing.
        </li>
        <li>
          MultiSelect: the Trigger (a <code>{"<button>"}</code>) is the control;{" "}
          <code>Field.Label</code> focuses it instead of clicking it, as a label does for a{" "}
          <code>{"<select>"}</code>. Its validity is a hidden <code>{"<select>"}</code>'s, which
          shows no browser bubble, so <code>Field.Error</code> is where a <code>required</code>{" "}
          message appears (<a href="/components/multi-select#forms">MultiSelect forms</a>).
        </li>
        <li>
          NumberField: the visible text input is the control (labelled, described, focused), while
          its validity is the hidden <code>&lt;input type="number"&gt;</code>'s, so{" "}
          <code>Field.Error</code>'s function <code>children</code> can branch on{" "}
          <code>validity.stepMismatch</code>, <code>rangeUnderflow</code> or{" "}
          <code>rangeOverflow</code>:{" "}
          <code>
            {
              '{({ validity, messages }) => validity.stepMismatch ? "Enter a multiple of six." : messages.join(" ")}'
            }
          </code>
          . <code>validate</code> reads the committed number, never a half-typed draft.
        </li>
        <li>
          "Submit on change":{" "}
          <code>{"checkedChangeAction={() => formRef.current?.requestSubmit()}"}</code> goes through
          the Form like a click. Never call <code>form.submit()</code>, which skips validation and
          the Form.
        </li>
      </ul>

      <h4 id="fieldset">Fields in a fieldset</h4>
      <p>
        There is no Fieldset part: a set of Fields with a common caption is the native{" "}
        <code>&lt;fieldset&gt;</code>, which already names the group (<code>&lt;legend&gt;</code>),
        describes it (<code>aria-describedby</code>) and disables every native control inside it.
        Every FUNSTACK form control has a native element, so <code>&lt;fieldset disabled&gt;</code>{" "}
        reaches them all: they leave the <code>FormData</code>, skip validation and the Tab order,
        and the pointer surfaces (a Slider's Track, NumberField's buttons) ignore presses too.
      </p>
      <Example file="FieldAddress.tsx" css="field.css">
        <FieldAddress />
      </Example>
      <CodeBlock>{`<fieldset disabled={!canEdit} aria-describedby="address-hint">
  <legend>Shipping address</legend>
  <p id="address-hint">Used for this order only.</p>
  <Field.Root name="street"><Field.Label>Street</Field.Label><Field.Control required /><Field.Error /></Field.Root>
  <Field.Root name="city"><Field.Label>City</Field.Label><Field.Control required /><Field.Error /></Field.Root>
</fieldset>`}</CodeBlock>
      <ul>
        <li>
          An inherited <code>disabled</code> is the platform's: <code>data-disabled</code> and{" "}
          <code>state.disabled</code> stay the props'. Style it with the platform's selector, which
          covers both sources: <code>{".field:has(.control:disabled) { opacity: .5; }"}</code>.
        </li>
        <li>
          Errors stay per Field. A rule over several controls is one Field's <code>validate</code>{" "}
          (it receives the whole <code>FormData</code>); a message that belongs to no control is
          your own element, referenced from the fieldset's <code>aria-describedby</code>.
        </li>
        <li>
          <a href="/components/radio-group">RadioGroup</a> and{" "}
          <a href="/components/checkbox-group">CheckboxGroup</a> are fieldsets themselves (their{" "}
          <code>Label</code> is the <code>&lt;legend&gt;</code>): do not wrap one in another
          fieldset to caption it.
        </li>
        <li>
          Do not disable a fieldset while a submission is pending:{" "}
          <code>{"<fieldset disabled={pending}>"}</code> drops focus from the control the user is
          on. Mark pending with <code>form[data-pending]</code>.
        </li>
      </ul>

      <h4 id="disabled-or-read-only">Disabled or read-only</h4>
      <p>
        Both lock a value; they differ in everything else. A <strong>disabled</strong> control is
        not focusable and not submitted: the value does not count. A <strong>read-only</strong>{" "}
        control is focusable, readable (its text selectable, its radios and chips still reachable
        with the arrows) and submitted, and the user cannot change it. Neither dispatches for user
        interaction, both are barred from validation, and both follow a form reset.
      </p>
      <ul>
        <li>
          <code>readOnly</code> is on every form value control (TextField, NumberField, OTPField,
          Checkbox, Switch, RadioGroup, CheckboxGroup, Select, Combobox, MultiSelect, Slider) and on{" "}
          <code>Field.Root</code>, which hands it to its control as it hands <code>disabled</code>.
          It is the owner's prop: a single radio or box that cannot be picked is{" "}
          <code>disabled</code>.
        </li>
        <li>
          Where HTML has no read-only (a checkbox, a <code>&lt;select&gt;</code>, a range), the
          control refuses the change itself and marks it with <code>aria-readonly</code>: a click is
          cancelled, a Select disables its other options, a Slider cancels its keys, a Combobox or
          MultiSelect does not open its popup.
        </li>
        <li>
          Style it with <code>[data-readonly]</code>, on every control and every Field part.{" "}
          <code>:read-only</code> matches every element that is not editable (a checkbox, a{" "}
          <code>div</code>), so it tells nothing outside a text input.
        </li>
        <li>
          A read-only control never blocks a submission: its native <code>required</code> is not
          rendered, and <code>validate</code> or a server error do not enter its validity. A server
          error for it is still shown.
        </li>
        <li>
          <code>disabled</code> wins when both are set. A <code>&lt;fieldset&gt;</code> has no{" "}
          <code>readonly</code>: lock a group of Fields with <code>readOnly</code> on each.
        </li>
      </ul>

      <h4 id="textarea">A textarea that grows</h4>
      <p>
        A textarea is <code>{"Field.Control render={<textarea />}"}</code>; textarea-only props (
        <code>rows</code>, <code>wrap</code>) go on the render element. It grows with its content
        through CSS, so there is no <code>autoSize</code> prop (the notes in the example above):
      </p>
      <CodeBlock>{`<Field.Root name="notes">
  <Field.Label>Delivery notes</Field.Label>
  <Field.Control render={<textarea rows={1} maxLength={500} />} className="control grow" />
</Field.Root>`}</CodeBlock>
      <CodeBlock language="css">{`.grow { field-sizing: content; min-block-size: 2lh; max-block-size: 8lh; resize: none; }`}</CodeBlock>

      <h4 id="field-control-alone">Field.Control on its own</h4>
      <p>
        Outside a <code>Field.Root</code>, <code>Field.Control</code> renders the plain native
        control: <code>id</code>, <code>name</code>, <code>disabled</code> and <code>required</code>{" "}
        pass through, and nothing is added. For a direct call site write the native element (
        <code>{'<input type="search" aria-label="Search">'}</code>); the standalone form is for your
        own styled input built on <code>Field.Control</code>, which then works in a form field and
        in a search box or a table cell alike:
      </p>
      <CodeBlock>{`function TextInput(props: FieldControlProps) {
  return <Field.Control {...props} className={(s) => (s.invalid ? "input invalid" : "input")} />;
}

<Field.Root name="email" required>
  <Field.Label>Email</Field.Label>
  <TextInput type="email" />                     {/* wired to the Field */}
</Field.Root>

<label htmlFor="q">Search</label>
<TextInput id="q" type="search" />               {/* the plain <input>, state never invalid */}`}</CodeBlock>
      <p>
        Outside a Field the function props receive a <code>FieldState</code> whose{" "}
        <code>disabled</code> and <code>required</code> are the control's own props (as inside a
        Field), so <code>{"className={(s) => s.disabled ? …}"}</code> works in both places;{" "}
        <code>invalid</code>, <code>validity</code> and <code>pending</code> are constant (valid,
        not pending: there is no validation without a Field), and no <code>data-*</code> attribute
        is rendered. Select a plain control's validity with <code>:user-invalid</code>. A search box
        has no Field to wire; let the query leave the urgent lane with <code>useDeferredValue</code>
        , or use a <a href="/components/combobox">Combobox</a> when the result is a list of options.
        The text of an input is a fact, not a request, so there is no <code>valueChangeAction</code>{" "}
        on a text control.
      </p>
    </DocPage>
  );
}
