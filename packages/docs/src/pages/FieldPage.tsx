import { CodeBlock } from "../components/CodeBlock.js";
import { Callout, Example } from "../components/Example.js";
import { BehaviourIndex, BehaviourSection } from "../components/Concept.js";
import { DocPage } from "../components/DocPage.js";
import { PartFacts, PropsTable, Table } from "../components/Tables.js";
import { FieldControls } from "../examples/FieldControls.js";
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

<Form.Root action={formAction} errors={state.errors}>              {/* form */}
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
          <code>pattern</code>, …).
        </li>
        <li>
          <strong>Any FUNSTACK form control is a Field's control</strong> without a wrapper:
          Checkbox, Switch, RadioGroup, CheckboxGroup, Select, Combobox, Slider and NumberField (see{" "}
          <a href="/components/slider#inside-a-field">Slider inside a Field</a> and{" "}
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
          The display state is updated synchronously from the DOM event, not in a transition: the
          error must be in the DOM when focus reaches the field. So no Field part takes a{" "}
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
          (<code>form.reset()</code>) only when the submission settles with no error in{" "}
          <code>errors</code>; pass <code>autoReset={"{false}"}</code> to keep the values (a
          settings form).
        </li>
        <li>
          An action that throws reaches the nearest Error Boundary above <code>Form.Root</code>;
          nothing is reset. Return errors from the action to keep the form.
        </li>
        <li>
          A second submit while one is pending is not dropped: a <code>useActionState</code>{" "}
          dispatch queues it. Block repeat clicks with CSS on <code>Form.Submit[data-pending]</code>{" "}
          if you need to; the button is never disabled.
        </li>
      </ul>
      <h5 id="dialog-form">
        In a Dialog: <code>Dialog.Form</code> rendered as <code>Form.Root</code>
      </h5>
      <CodeBlock>{`const [state, dispatch] = useActionState(saveProfile, {});

<Dialog.Popup>
  <Dialog.Title>Edit profile</Dialog.Title>
  <Dialog.Form action={dispatch} render={<Form.Root errors={state.errors} />}>
    <Field.Root name="email">
      <Field.Label>Email</Field.Label>
      <Field.Control type="email" required />
      <Field.Error />
    </Field.Root>
    <Dialog.Close value="cancel">Cancel</Dialog.Close>
    <Form.Submit value="save">Save</Form.Submit>
  </Dialog.Form>
</Dialog.Popup>`}</CodeBlock>
      <p>
        <code>Dialog.Form</code> renders a plain React form, which takes React's path: the form is
        reset after every successful action, also one that returned field errors. Rendered as{" "}
        <code>Form.Root</code> (<code>render={"{<Form.Root errors={state.errors} />}"}</code>),{" "}
        <code>Form.Root</code> receives the <code>action</code> and runs it, so its policy applies:
        server errors are routed to the fields and focused, and the form is reset only when the
        result has no error (<code>autoReset</code>, which you can pass on the{" "}
        <code>Form.Root</code> element). <code>Dialog.Form</code>'s <code>closeOnSettle</code>{" "}
        follows the same rule: a result with a field error keeps the dialog open (the typed values
        stay and the first errored field is focused), a result with no error resets the form and
        closes the dialog with the <code>Form.Submit</code>'s <code>value</code> as{" "}
        <code>returnValue</code>. An action that throws keeps the dialog open and reaches the
        nearest Error Boundary. An error hidden because the user changed that value while the action
        ran still counts: the dialog stays open and the user submits the new value.
      </p>
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
            description: "Natively disables the control and marks every part `data-disabled`.",
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
          "`FieldState`, shared by every Field part, is `{ invalid, messages, validity, disabled, required, pending }`; `invalid`: an error is shown; `messages`: the shown messages (the browser's `validationMessage`, `validate`'s strings, or the server's), `[]` while valid; `validity`: a `FieldValidity` snapshot of the control's `ValidityState` (`valueMissing`, `typeMismatch`, `tooShort`, …, `customError`, `valid`); `disabled` / `required`: the Field's or the control's own; `pending`: the enclosing form's submission is in flight."
        }
        owned={"`data-invalid`, `data-disabled`, `data-required`, `data-pending`."}
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
            description: "Replace the default <label> (must stay a <label>) or <p>.",
          },
        ]}
      />
      <PartFacts
        state={"the Field's."}
        owned={
          "Label: `id`, `htmlFor` (absent for a group control); Description: `id`; both also the Field's four `data-*` attributes."
        }
      />

      <h4>
        <code>Field.Control</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "name",
            type: "string",
            default: "the Field's",
            description: "Native `name`.",
          },
          {
            name: "required, disabled",
            type: "boolean",
            default: "the Field's",
            description: "Native; the Field's value also applies (either one is enough).",
          },
          ...stylingProps("FieldState"),
          {
            name: "render",
            type: "ReactElement | ((props, state: FieldState) => ReactNode)",
            description:
              "Must render an <input>, <textarea> or <select>: `render={<textarea rows={3} />}`.",
          },
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
          '`id`, `name`, `required`, `disabled`, `aria-invalid` (always `"true"` or `"false"`: it stops Chromium announcing a `typeMismatch` before it is shown, and exposes `valueMissing`, which it otherwise never does), `aria-describedby` (your tokens first, then the description, then the error while shown), and the Field\'s four `data-*` attributes.'
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
        owned={"`id` and the Field's four `data-*` attributes."}
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
              "`Record<string, string | readonly string[] | null | undefined>` keyed by field name. Shown on the matching Field, dismissed by its next edit, re-armed by the next settled submission.",
          },
          {
            name: "autoReset",
            type: "boolean",
            default: "true",
            description:
              "Reset the form when a submission the Form ran settles with no non-empty entry in `errors`. `false`: never.",
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
              "Native `disabled`. Never set by the library while pending. Always native `disabled`, also with a component `render`: a submitter has no handler to honour `aria-disabled`.",
          },
          ...functionProps("FormSubmitState"),
          renderProp("button", "FormSubmitState"),
        ]}
      />
      <PartFacts
        state={
          "`FormSubmitState` is `{ pending, disabled }`; `pending` is `useFormStatus().pending` of the enclosing form, so it works in any React form (`Dialog.Form`, a plain `<form action>`)."
        }
        owned={'`type` (`"submit"`, on a `<button>`), `disabled`, `data-pending`, `data-disabled`.'}
        note={"`name`, `value` and `formAction` pass through."}
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
            "`data-pending`",
            "every Field part, Form.Root, Form.Submit",
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
          "A Form with a function `action` runs it in its own transition: `data-pending` is on the form, on `Form.Submit` and on every Field part while the submission is in flight. A Field's display state (whether its error shows) is updated synchronously from the DOM event, not in a transition."
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
    </DocPage>
  );
}
