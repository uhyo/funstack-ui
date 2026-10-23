import { CodeBlock } from "../components/CodeBlock.js";
import { Callout, Example } from "../components/Example.js";
import { PageHead } from "../components/PageHead.js";
import { PropsTable, Table } from "../components/Tables.js";
import { CheckboxForm } from "../examples/CheckboxForm.js";
import checkboxFormSource from "../examples/CheckboxForm.tsx?raw";
import { CheckboxSelectAll } from "../examples/CheckboxSelectAll.js";
import checkboxSelectAllSource from "../examples/CheckboxSelectAll.tsx?raw";
import checkboxCss from "../examples/checkbox.css?raw";

export function CheckboxPage() {
  return (
    <div className="learn-content">
      <PageHead
        title="Checkbox"
        description="A native <input type=checkbox> with an async checkedChangeAction, optimistic checked state, a controlled indeterminate state and native form participation."
      />
      <h2>Checkbox</h2>
      <p className="page-intro">
        A checkbox (WAI-ARIA Checkbox pattern, two-state and mixed). It renders a real{" "}
        <code>&lt;input type="checkbox"&gt;</code> and behaves like{" "}
        <a href="/components/switch">Switch</a>: optimistic <code>checked</code> in the DOM,{" "}
        <code>data-pending</code> while <code>checkedChangeAction</code> runs, native forms. It adds
        a controlled <code>indeterminate</code> state for "select all" parents.
      </p>

      <Example
        source={checkboxSelectAllSource}
        fileName="CheckboxSelectAll.tsx"
        css={checkboxCss}
        cssFileName="checkbox.css"
      >
        <CheckboxSelectAll />
      </Example>

      <h3>Anatomy</h3>
      <CodeBlock>{`import { Checkbox } from "@funstack/ui/checkbox";

<label>
  <Checkbox defaultChecked={task.done} checkedChangeAction={setDone} />
  Done
</label>`}</CodeBlock>
      <p>
        One plain component rendering one <code>&lt;input&gt;</code>. No Indicator part: draw the
        check and the dash on the input with <code>appearance: none</code> and <code>::before</code>{" "}
        (any SVG works through <code>mask-image</code>), use <code>accent-color</code> to recolour
        the native box, or hide the input with a clip and style a sibling through{" "}
        <code>label:has(:checked)</code>. The label is your own <code>&lt;label&gt;</code>.
      </p>

      <h3>Props</h3>
      <PropsTable
        rows={[
          {
            name: "checked",
            type: "boolean",
            description: "Controlled checked state. undefined means uncontrolled.",
          },
          {
            name: "defaultChecked",
            type: "boolean",
            default: "false",
            description:
              "Initial checked state in uncontrolled mode. Also what a form reset returns to: the latest value is mirrored into the input's `defaultChecked`.",
          },
          {
            name: "indeterminate",
            type: "boolean",
            default: "false",
            description: (
              <>
                Controlled-only mixed state, derived by the parent from other state. No{" "}
                <code>defaultIndeterminate</code>, no action. Rendered as the DOM property,{" "}
                <code>:indeterminate</code> and <code>data-indeterminate</code>, except while an
                action is pending. Does not change what the form submits.
              </>
            ),
          },
          {
            name: "checkedChangeAction",
            type: "ChangeAction<boolean, CheckboxCheckedChangeDetails>",
            description: (
              <>
                Called with the next checked state on every change, inside the Checkbox's
                transition. Sync, async or a Server Function; rejections reach the nearest Error
                Boundary. <code>details.reason</code>: <code>"activate"</code> (the native{" "}
                <code>click</code>) or <code>"platform"</code> (a form reset with the{" "}
                <code>reset</code> event, or a change found at hydration with no event).
              </>
            ),
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description: "Native `disabled`; never dispatches.",
          },
          {
            name: "value",
            type: "string",
            default: '"on"',
            description: "Submitted with the form when checked (platform default).",
          },
          {
            name: "transition",
            type: "ViewTransitionClass",
            default: "–",
            description:
              "Forwarded to the Checkbox's `<ViewTransition default>`; without it no boundary is rendered. Animates the commit that ends an action, not the check itself.",
          },
          {
            name: "className",
            type: "string | ((state: CheckboxState) => string | undefined)",
            description: "A class name, or a function of the state.",
          },
          {
            name: "style",
            type: "CSSProperties | ((state: CheckboxState) => CSSProperties | undefined)",
            description: "Inline style, or a function of the state.",
          },
          {
            name: "render",
            type: "ReactElement | ((props, state: CheckboxState) => ReactNode)",
            description:
              'Replace the default <input> or take over rendering. Must keep an `<input type="checkbox">`; a custom component must forward `ref` to it (the `indeterminate` property is set through the ref).',
          },
        ]}
      />
      <p>
        <code>CheckboxState</code> is <code>{"{ checked, indeterminate, pending, disabled }"}</code>
        , with <code>checked</code> optimistic and <code>indeterminate</code> already{" "}
        <code>indeterminate && !pending</code>. Other <code>&lt;input&gt;</code> props pass through,
        including <code>role</code>. The Checkbox owns <code>type</code>, <code>checked</code>,{" "}
        <code>defaultChecked</code>, <code>disabled</code> and <code>onChange</code>, and removes{" "}
        <code>aria-checked</code>.
      </p>

      <h3>Data attributes and pseudo-classes</h3>
      <Table
        head={["Attribute", "Pseudo-class", "Meaning"]}
        rows={[
          [
            "`data-checked`",
            "`:checked`",
            "Optimistic checked state. Identical, with one engine exception (below).",
          ],
          [
            "`data-indeterminate`",
            "`:indeterminate`",
            "Mixed state, suspended while pending. Only the attribute works before hydration; `:indeterminate` also matches radios in an empty group.",
          ],
          ["`data-pending`", "–", "`checkedChangeAction` is in flight."],
          [
            "`data-disabled`",
            "`:disabled`",
            "The `disabled` prop. Only `:disabled` also sees `<fieldset disabled>`.",
          ],
          ["–", "`:required`, `:user-invalid`, `:focus-visible`", "Platform only; no attribute."],
        ]}
      />
      <Callout kind="warning" title="Chromium and :checked while indeterminate">
        <p>
          Chromium does not match <code>:checked</code> on a box that is both checked and
          indeterminate (Firefox does). If a box can be <code>checked</code> and{" "}
          <code>indeterminate</code> at once, select on <code>[data-checked]</code>, as the example
          stylesheet does. The recommended "select all" representation is unchecked + mixed, which
          avoids the case.
        </p>
      </Callout>

      <h3>Indeterminate</h3>
      <p>
        Mixed is derived state: a "select all" parent computes it from its rows, which is why it is
        controlled-only and has no action. Clicking a mixed box dispatches <code>!checked</code>, so
        the usual unchecked + mixed box becomes checked (the APG's mixed to checked), exactly what
        the browser does to the DOM.
      </p>
      <ol>
        <li>
          Click the mixed "Select all": the browser checks the box and clears its{" "}
          <code>indeterminate</code> property. The Checkbox dispatches <code>true</code> and, while
          pending, renders <code>indeterminate && !pending</code>: the attribute, the property and{" "}
          <code>:indeterminate</code> all agree that the dash is gone.
        </li>
        <li>
          Resolve: the parent adopts the selection, so <code>checked</code> is <code>true</code> and{" "}
          <code>indeterminate</code> <code>false</code>.
        </li>
        <li>
          Reject (tick "Make the next save fail"): the optimistic value reverts and, since the
          parent still says mixed, the dash comes back on settle.
        </li>
      </ol>
      <p>
        In the example the parent box derives from the rows' <em>optimistic</em> selection (
        <code>useOptimistic</code>), so it never claims "all" while a row's uncheck is still saving.
        A <code>CheckboxGroup</code> that packages this pattern is being designed in{" "}
        <a href="https://github.com/uhyo/funstack-ui/issues/33">issue #33</a>.
      </p>
      <p>
        Before hydration the DOM property cannot be set, and <code>aria-checked="mixed"</code> is
        forbidden on native inputs, so a mixed box is announced as unchecked until hydration.{" "}
        <code>data-indeterminate</code> is in the server HTML, so CSS can draw the dash from the
        start.
      </p>

      <h3>Keyboard and ARIA</h3>
      <Table
        head={["Interaction", "Behaviour"]}
        rows={[
          ["Space", "Toggles; a mixed box becomes checked (native)."],
          ["Click, label click", "Toggles (native)."],
          ["Enter", "Does not toggle; may submit the form."],
          ["Tab", "Focusable unless disabled."],
        ]}
      />
      <ul>
        <li>
          Native role and state; the library adds no <code>role</code> and never sets{" "}
          <code>aria-checked</code>. The mixed state reaches assistive technology through the DOM
          property, after hydration.
        </li>
        <li>
          The checked state AT reads is the optimistic one, so the change is heard at once. Keep the
          label stable.
        </li>
        <li>
          <code>required</code> applies to one checkbox; there is no native "at least one of these"
          constraint.
        </li>
      </ul>

      <h3>Async behaviour</h3>
      <p>
        Exactly as <a href="/components/switch">Switch</a>: the DOM shows the optimistic value (a
        correctness requirement for native inputs), a rejection writes the old value back and
        reaches the Error Boundary, the latest of overlapping clicks wins, the box is never disabled
        while pending, and <code>details.event.preventDefault()</code> is not a veto (use controlled
        mode).
      </p>
      <CodeBlock>{`// Autosave with a Server Function, from a Server Component
<Checkbox
  defaultChecked={task.done}
  checkedChangeAction={setDone.bind(null, task.id)}
  aria-label={\`Done: \${task.title}\`}
/>`}</CodeBlock>

      <h3>Forms</h3>
      <Example
        source={checkboxFormSource}
        fileName="CheckboxForm.tsx"
        css={checkboxCss}
        cssFileName="checkbox.css"
      >
        <CheckboxForm />
      </Example>
      <p>
        Without change actions the boxes are native form controls: <code>name</code>,{" "}
        <code>value</code> and <code>required</code> pass through, <code>:user-invalid</code> marks
        the unchecked required box after a submit attempt, and a reset (the Reset button, or React's
        automatic reset after the action succeeds) restores <code>defaultChecked</code>.
      </p>
      <ul>
        <li>
          <strong>Form reset</strong> and <strong>clicks before hydration</strong> are the two
          platform paths. Both call <code>checkedChangeAction</code> with{" "}
          <code>reason: "platform"</code>; a controlled parent is offered the reset value and
          decides. Details on the <a href="/components/switch">Switch</a> page.
        </li>
        <li>
          <code>checkedChangeAction={"{serverFn}"}</code> and{" "}
          <code>&lt;form action={"{serverFn}"}&gt;</code> are independent channels. The Checkbox
          never reads <code>useFormStatus</code>. A mixed box still posts its value when checked.
        </li>
      </ul>

      <h3>Plain HTML</h3>
      <p>
        If a checkbox only posts with its form, a Server Component can render the native input
        itself, with no library code for it:
      </p>
      <CodeBlock>{`// A Server Component: no import from @funstack/ui.
<label>
  <input type="checkbox" name="terms" value="accepted" required />
  I accept the terms
</label>`}</CodeBlock>
      <p>
        Compared with <code>&lt;Checkbox&gt;</code>, it has no <code>checkedChangeAction</code>, so
        no transition, <code>data-pending</code> or rollback on rejection; no{" "}
        <code>data-checked</code> / <code>data-disabled</code> (use <code>:checked</code> and{" "}
        <code>:disabled</code>); no React state that tracks it (clicks before hydration and form
        resets live only in the DOM); and no <a href="/components/field">Field</a> integration. It
        cannot be mixed: <code>indeterminate</code> is a DOM property with no HTML attribute, so
        only script can set it.
      </p>
    </div>
  );
}
