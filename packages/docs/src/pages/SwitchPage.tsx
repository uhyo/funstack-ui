import { CodeBlock } from "../components/CodeBlock.js";
import { Callout, Example } from "../components/Example.js";
import { PageHead } from "../components/PageHead.js";
import { PropsTable, Table } from "../components/Tables.js";
import { SwitchForm } from "../examples/SwitchForm.js";
import switchFormSource from "../examples/SwitchForm.tsx?raw";
import { SwitchSettings } from "../examples/SwitchSettings.js";
import switchSettingsSource from "../examples/SwitchSettings.tsx?raw";
import switchCss from "../examples/switch.css?raw";

export function SwitchPage() {
  return (
    <div className="learn-content">
      <PageHead
        title="Switch"
        description="An on/off switch rendered as a native <input type=checkbox role=switch>: optimistic checked state, data-pending while checkedChangeAction runs, native form participation."
      />
      <h2>Switch</h2>
      <p className="page-intro">
        An on/off switch (WAI-ARIA Switch pattern, HTML checkbox variant). It is a real{" "}
        <code>&lt;input type="checkbox" role="switch"&gt;</code>: the DOM <code>checked</code> is
        the optimistic state, the input carries <code>data-pending</code> while{" "}
        <code>checkedChangeAction</code> runs, and it takes part in forms like any checkbox.
      </p>

      <Example
        source={switchSettingsSource}
        fileName="SwitchSettings.tsx"
        css={switchCss}
        cssFileName="switch.css"
      >
        <SwitchSettings />
      </Example>

      <h3>Anatomy</h3>
      <CodeBlock>{`import { Switch } from "@funstack/ui/switch";

<label>
  <Switch checkedChangeAction={saveNotifications} />
  Email notifications
</label>`}</CodeBlock>
      <p>
        One plain component, no parts. It renders a single void element, so there is no Thumb: the
        input is the track and <code>::before</code> the thumb (<code>appearance: none</code>), or
        hide the input with a clip and style a sibling through <code>label:has(:checked)</code>.
        There is no Label part either: your <code>&lt;label&gt;</code> (wrapping, or{" "}
        <code>htmlFor</code> with an <code>id</code>) names it and forwards clicks, before hydration
        too.
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
            name: "checkedChangeAction",
            type: "ChangeAction<boolean, SwitchCheckedChangeDetails>",
            description: (
              <>
                Called with the next checked state on every change, inside the Switch's transition.
                Sync, async or a Server Function; rejections reach the nearest Error Boundary.{" "}
                <code>details.reason</code> is <code>"activate"</code> for the user (
                <code>event</code> is the native <code>click</code>, for Space and label clicks too)
                or <code>"platform"</code> for a form reset (<code>event</code> is the{" "}
                <code>reset</code> event) or a change found at hydration (<code>event</code> is{" "}
                <code>undefined</code>).
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
            default: '"none"',
            description:
              "Forwarded to the Switch's `<ViewTransition default>`. Animates the commit that ends an action, not the flip; animate the flip with CSS on `:checked`.",
          },
          {
            name: "className",
            type: "string | ((state: SwitchState) => string | undefined)",
            description: "A class name, or a function of the state.",
          },
          {
            name: "style",
            type: "CSSProperties | ((state: SwitchState) => CSSProperties | undefined)",
            description: "Inline style, or a function of the state.",
          },
          {
            name: "render",
            type: "ReactElement | ((props, state: SwitchState) => ReactNode)",
            description:
              'Replace the default <input> or take over rendering. Must keep an `<input type="checkbox">` (development warning otherwise); the function form may render siblings next to it.',
          },
        ]}
      />
      <p>
        <code>SwitchState</code> is <code>{"{ checked, pending, disabled }"}</code>, with{" "}
        <code>checked</code> optimistic. Every other <code>&lt;input&gt;</code> prop passes through
        (<code>name</code>, <code>required</code>, <code>form</code>, <code>id</code>,{" "}
        <code>autoFocus</code>, ...). The Switch owns <code>type</code>, <code>role</code>,{" "}
        <code>checked</code>, <code>defaultChecked</code>, <code>disabled</code> and{" "}
        <code>onChange</code>, and removes <code>aria-checked</code>. A <code>render</code>{" "}
        element's own <code>onChange</code> or <code>onClick</code> runs first.
      </p>

      <h3>Data attributes and pseudo-classes</h3>
      <Table
        head={["Attribute", "Pseudo-class", "Meaning"]}
        rows={[
          [
            "`data-checked`",
            "`:checked`",
            "Optimistic checked state. Identical, because the DOM holds the optimistic value.",
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
      <p>
        Data attributes are still emitted so that a wrapper can use them; on a wrapper,{" "}
        <code>:has(:checked)</code> works without JavaScript.
      </p>

      <h3>Keyboard and ARIA</h3>
      <Table
        head={["Interaction", "Behaviour"]}
        rows={[
          ["Space", "Toggles (native)."],
          ["Click, tap, label click", "Toggles (native)."],
          ["Enter", "Does not toggle (native); may submit the form."],
          ["Tab", "Focusable unless disabled."],
        ]}
      />
      <ul>
        <li>
          The library installs no key handler. Every activation reaches it as a native{" "}
          <code>click</code>.
        </li>
        <li>
          <code>role="switch"</code> on a checkbox input is allowed by ARIA in HTML.{" "}
          <code>aria-checked</code> is never set (it is forbidden on native inputs): the native
          checked state is the ARIA state, and since it is the optimistic value, assistive
          technology hears the flip at once.
        </li>
        <li>Keep the label stable: the state is already conveyed.</li>
        <li>
          The input is not disabled while pending. A second click reverses the first; the latest
          wins.
        </li>
      </ul>

      <h3>Async walkthrough</h3>
      <ol>
        <li>
          Click: the browser flips the input; the Switch dispatches{" "}
          <code>checkedChangeAction(next, {'{ reason: "activate" }'})</code> in its transition;{" "}
          <code>data-checked</code> and <code>data-pending</code> update in the same frame.
        </li>
        <li>
          Resolve: uncontrolled, the value is committed; controlled, the parent's{" "}
          <code>checked</code> decides. <code>data-pending</code> goes.
        </li>
        <li>
          Reject: the optimistic value reverts, React writes the old <code>checked</code> back to
          the input, and the error reaches the nearest Error Boundary (the "Beta features" row
          above).
        </li>
      </ol>
      <Callout title="Why the DOM shows the optimistic value">
        <p>
          This is a correctness requirement, not a style choice. After every event react-dom
          restores a controlled input to its current props. Only the synchronous optimistic state
          has rendered by then, so an input driven by committed (transition) state would snap back
          right after the click and stay wrong until the action finished.
        </p>
      </Callout>
      <Callout kind="warning" title="preventDefault() is not a veto">
        <p>
          Calling <code>details.event.preventDefault()</code> inside the action makes the browser
          undo the click after React has rendered it, so the input disagrees with{" "}
          <code>data-checked</code> while the action is pending (development warning). To veto, use
          controlled mode and do not adopt the value.
        </p>
      </Callout>

      <h3>Forms</h3>
      <Example
        source={switchFormSource}
        fileName="SwitchForm.tsx"
        css={switchCss}
        cssFileName="switch.css"
      >
        <SwitchForm />
      </Example>
      <p>
        A Switch with a <code>name</code> posts <code>name=value</code> when checked, exactly like a
        checkbox. No change action is needed for that.
      </p>

      <h3>The platform paths</h3>
      <p>
        The library owns <code>checked</code>, but the browser can still change it on its own. Both
        cases reach <code>checkedChangeAction</code> with <code>reason: "platform"</code>:
      </p>
      <ul>
        <li>
          <strong>Form reset:</strong> a reset button, <code>form.reset()</code>, or React's
          automatic reset after a successful <code>&lt;form action&gt;</code>. Uncontrolled, the
          reset target is the latest <code>defaultChecked</code> (so a form re-rendered with saved
          data resets to it, as in the example). Controlled, the browser resets to the mount-time
          value and the change is offered to the parent, which adopts it or not; the input then
          follows the parent.
        </li>
        <li>
          <strong>Clicks before hydration</strong> (and Firefox restoring form state on reload): the
          server-rendered input works natively; on hydration the Switch finds the DOM differs from
          its state and dispatches once, with no event.
        </li>
      </ul>

      <h3>Server Functions and forms</h3>
      <p>
        Two independent channels. A Server Component can use either, or both on the same Switch:
      </p>
      <CodeBlock>{`// Autosave on change: a per-switch action with data-pending.
<Switch defaultChecked={user.notifications} checkedChangeAction={setNotifications} />

// Native submission: posted with the form, pending is the form's.
<form action={saveSettings}>
  <Switch name="notifications" defaultChecked={user.notifications} />
  <SubmitButton />
</form>`}</CodeBlock>
      <Table
        head={["", "checkedChangeAction={serverFn}", "<form action={serverFn}> + name"]}
        rows={[
          ["Runs", "on every change, in the Switch's transition", "on submit, in the form's"],
          [
            "Pending",
            "`data-pending` on the Switch",
            "`useFormStatus()` in the form; the Switch shows nothing",
          ],
          ["Receives", "`(next, details)`, `details.event` undefined", "`FormData`"],
          ["Rollback", "optimistic value reverts on rejection", "n/a"],
        ]}
      />
      <p>
        The Switch never reads <code>useFormStatus</code>: that would mark every control pending
        during a submit. To dim controls while a form submits, style <code>form:has(...)</code> or
        read <code>useFormStatus</code> in your own <code>className</code> function. "Submit on
        change" is <code>checkedChangeAction={"{() => formRef.current?.requestSubmit()}"}</code>.
      </p>
      <p>
        A Switch with no action and no <code>checked</code> is a working native input before
        hydration and with JavaScript off.
      </p>
    </div>
  );
}
