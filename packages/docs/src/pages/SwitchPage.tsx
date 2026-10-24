import { CodeBlock } from "../components/CodeBlock.js";
import { Example } from "../components/Example.js";
import { BehaviourIndex, BehaviourSection } from "../components/Concept.js";
import { PageHead } from "../components/PageHead.js";
import { stylingProps } from "./shared-props.js";
import { PartFacts, PropsTable, Table } from "../components/Tables.js";
import { SwitchForm } from "../examples/SwitchForm.js";
import { SwitchSettings } from "../examples/SwitchSettings.js";

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

      <Example file="SwitchSettings.tsx" css="switch.css">
        <SwitchSettings />
      </Example>

      <BehaviourIndex />

      <h3 id="anatomy">Anatomy</h3>
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

      <h3 id="props">Props</h3>
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
            default: "–",
            description:
              "Forwarded to the Switch's `<ViewTransition default>`; without it no boundary is rendered. Animates the commit that ends an action, not the flip; animate the flip with CSS on `:checked`.",
          },
          ...stylingProps("SwitchState"),
          {
            name: "render",
            type: "ReactElement | ((props, state: SwitchState) => ReactNode)",
            description:
              'Replace the default <input> or take over rendering. Must keep an `<input type="checkbox">` (development warning otherwise); the function form may render siblings next to it.',
          },
        ]}
      />
      <PartFacts
        state={"`SwitchState` is `{ checked, pending, disabled }`; `checked` is optimistic."}
        owned={
          "`type`, `role`, `checked`, `defaultChecked`, `disabled`, `data-checked`, `data-pending`, `data-disabled`; `aria-checked` is removed; `onChange` is merged (a `render` element's own handler runs first). Inside a `Field.Root` also `id`, `name`, `required`, `aria-invalid`, `aria-describedby` and `data-invalid`."
        }
        note={
          "Every other `<input>` prop passes through (`name`, `required`, `form`, `id`, `autoFocus`, ...). A `render` element's own `onChange` or `onClick` runs first."
        }
      />

      <h3 id="data-attributes">Data attributes</h3>
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

      <h3 id="keyboard-and-aria">Keyboard and ARIA</h3>
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

      <BehaviourSection
        id="transition-types"
        summary={"`fsui-switch` plus `fsui-switch-on` or `fsui-switch-off`."}
      />

      <BehaviourSection
        id="optimistic-and-pending"
        summary={
          "The native input renders the optimistic state, so `:checked` and `data-checked` change at the click and assistive technology hears it at once. `data-pending` is on the Switch while `checkedChangeAction` is in flight. `transition` animates the commit that ends the action, not the flip."
        }
      >
        <h4>Walkthrough</h4>
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
        <p>
          The input shows the optimistic value because react-dom restores a controlled input after
          every event (<a href="/concepts/browser-owned-state#native-inputs">Native inputs</a>). So{" "}
          <code>details.event.preventDefault()</code> is not a veto: it makes the browser undo the
          click after React has rendered it, and the input disagrees with <code>data-checked</code>{" "}
          while the action is pending (development warning). To veto, use controlled mode and do not{" "}
          <a href="/concepts/action-props#adopt">adopt</a> the value.
        </p>
      </BehaviourSection>

      <BehaviourSection
        id="suspense"
        summary={"No content region; nothing the Switch renders suspends."}
      />

      <BehaviourSection
        id="browser-owned-state"
        summary={
          'A native `<input>`: the browser flips it before any JavaScript runs. A form reset and clicks before hydration reach `checkedChangeAction` with `reason: "platform"`.'
        }
      >
        <h4 id="the-platform-paths">
          The <a href="/concepts/browser-owned-state#platform-path">platform paths</a>
        </h4>
        <p>
          The library owns <code>checked</code>, but the browser can still change it on its own.
          Both cases reach <code>checkedChangeAction</code> with <code>reason: "platform"</code>:
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
            <strong>Clicks before hydration</strong> (and Firefox restoring form state on reload):
            the server-rendered input works natively; on hydration the Switch finds the DOM differs
            from its state and dispatches once, with no event.
          </li>
        </ul>
      </BehaviourSection>

      <BehaviourSection
        id="before-hydration"
        summary={
          'A native checkbox: clicking, Space, labels, `required` and form submission work. On hydration a changed value is reconciled with one `checkedChangeAction` call (`reason: "platform"`).'
        }
      >
        <h4>Plain HTML</h4>
        <p>
          If a switch only posts with its form, a Server Component can render the native input
          itself, with no library code for it:
        </p>
        <CodeBlock>{`// A Server Component: no import from @funstack/ui.
<label>
  <input type="checkbox" role="switch" name="notifications" defaultChecked={user.notifications} />
  Email notifications
</label>`}</CodeBlock>
        <p>
          <code>role="switch"</code> gives switch semantics in every engine. To draw it as a switch,
          set <code>appearance: none</code> and style it on <code>:checked</code>,{" "}
          <code>:disabled</code> and <code>:focus-visible</code>. The HTML <code>switch</code>{" "}
          attribute only changes the look: it draws a native switch in Safari 17.4+ and nowhere else
          (not in Chrome or Firefox, and not yet in the HTML standard). If you add it, write{" "}
          <code>switch=""</code>: react-dom drops <code>true</code> for an attribute it does not
          know, and <code>@types/react</code> does not type it.
        </p>
        <p>
          Compared with <code>&lt;Switch&gt;</code>, the plain input has no{" "}
          <code>checkedChangeAction</code>, so no transition, <code>data-pending</code> or rollback
          on rejection; no <code>data-checked</code> / <code>data-disabled</code>; no React state
          that tracks it (clicks before hydration and form resets live only in the DOM); and no{" "}
          <a href="/components/field">Field</a> integration (the Field's id, label, description,
          invalid and required state must be wired by hand).
        </p>
      </BehaviourSection>

      <h3 id="forms">Forms</h3>
      <Example file="SwitchForm.tsx" css="switch.css">
        <SwitchForm />
      </Example>
      <p>
        A Switch with a <code>name</code> posts <code>name=value</code> when checked, exactly like a
        checkbox. No change action is needed for that.
      </p>

      <h4>Server Functions and forms</h4>
      <p>
        The Switch's own action and the{" "}
        <a href="/concepts/action-props#form-channel">form channel</a> are independent. A Server
        Component can use either, or both on the same Switch:
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
        "Submit on change" is{" "}
        <code>checkedChangeAction={"{() => formRef.current?.requestSubmit()}"}</code>.
      </p>
      <p>
        A Switch with no action and no <code>checked</code> is a working native input before
        hydration and with JavaScript off.
      </p>
    </div>
  );
}
