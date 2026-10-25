import { CodeBlock } from "../components/CodeBlock.js";
import { Example } from "../components/Example.js";
import { BehaviourIndex, BehaviourSection } from "../components/Concept.js";
import { DocPage } from "../components/DocPage.js";
import { PartFacts, PropsTable, Table } from "../components/Tables.js";
import { RadioGroupForm } from "../examples/RadioGroupForm.js";
import { RadioGroupRtl } from "../examples/RadioGroupRtl.js";
import { RadioGroupTheme } from "../examples/RadioGroupTheme.js";
import { functionProps, renderProp, stylingProps } from "./shared-props.js";

export function RadioGroupPage() {
  return (
    <DocPage
      title="RadioGroup"
      description="A radio group of native <input type=radio> in a <fieldset>: native keyboard and forms, an async valueChangeAction, optimistic checked state and data-pending."
    >
      <p className="page-intro">
        A radio group (WAI-ARIA Radio Group pattern, native radio variant): a{" "}
        <code>&lt;fieldset&gt;</code> of real <code>&lt;input type="radio"&gt;</code> elements. The
        platform supplies the single tab stop, arrow keys (wrapping and RTL-mirrored outside
        Safari), forms and validation. The library adds one thing: the checked value is changed
        through <code>valueChangeAction</code> in a transition, with optimistic feedback and{" "}
        <code>data-pending</code>.
      </p>

      <Example file="RadioGroupTheme.tsx" css="radio-group.css">
        <RadioGroupTheme />
      </Example>

      <BehaviourIndex />

      <h3 id="anatomy">Anatomy</h3>
      <CodeBlock>{`import { RadioGroup } from "@funstack/ui/radio-group";

<RadioGroup.Root name="plan" defaultValue="free" valueChangeAction={savePlan}> {/* fieldset */}
  <RadioGroup.Label>Plan</RadioGroup.Label>          {/* legend: optional, first child */}
  <label>
    <RadioGroup.Item value="free" /> Free              {/* input type=radio */}
  </label>
  <label>
    <RadioGroup.Item value="pro" /> Pro
  </label>
</RadioGroup.Root>`}</CodeBlock>
      <ul>
        <li>
          <strong>
            Root is a <code>&lt;fieldset role="radiogroup"&gt;</code>
          </strong>
          : the legend names it, <code>disabled</code> reaches every radio natively, and it finds
          the form for resets. A <code>render</code> element must stay a{" "}
          <code>&lt;fieldset&gt;</code>.
        </li>
        <li>
          <strong>
            Label is the <code>&lt;legend&gt;</code>
          </strong>{" "}
          and must be the Root's first child. Its function children receive the Root's state, so a
          group-level pending indicator goes there.
        </li>
        <li>
          <strong>Item is the radio itself</strong>, a void element. There is no Indicator part:
          style the input with <code>appearance: none</code> and <code>::before</code>, or use{" "}
          <code>accent-color</code>. Each Item's text label is your own <code>&lt;label&gt;</code>.
        </li>
      </ul>

      <h3 id="props">Props</h3>
      <h4>
        <code>RadioGroup.Root</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "value",
            type: "string | null",
            description:
              "Controlled checked value; `null` checks nothing. undefined means uncontrolled.",
          },
          {
            name: "defaultValue",
            type: "string | null",
            default: "null",
            description:
              "Initial value in uncontrolled mode. Also what a form reset returns to: the latest value is mirrored into the radios' `defaultChecked`. An unchecked group is the HTML default, so leaving both out is fine.",
          },
          {
            name: "valueChangeAction",
            type: "ChangeAction<string | null, RadioGroupValueChangeDetails>",
            description: (
              <>
                Runs in the Root's transition whenever the checked radio changes; sync, async or a
                Server Function. Rejections reach the nearest Error Boundary and roll the selection
                back. <code>next</code> is a string for every user interaction; it is{" "}
                <code>null</code> only with <code>reason: "platform"</code>, when a form reset
                empties the group. Every arrow key press dispatches; the latest wins.
              </>
            ),
          },
          {
            name: "name",
            type: "string",
            default: "useId()",
            description:
              "The `name` shared by every radio: the form data key. Pass a real name inside a form you submit. Must be unique within the form.",
          },
          {
            name: "required",
            type: "boolean",
            default: "false",
            description:
              "Marks every radio `required`, which makes the group required; one checked radio satisfies it.",
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description:
              "Renders `<fieldset disabled>`: every radio is disabled, unfocusable and skipped by the arrow keys.",
          },
          {
            name: "form",
            type: "string",
            description: "The `form` attribute, applied to the fieldset and to every radio.",
          },
          ...functionProps(
            "RadioGroupRootState",
            "The Label and Items. The function form receives the optimistic value; must not suspend.",
          ),
          renderProp("fieldset", "RadioGroupRootState"),
        ]}
      />
      <PartFacts
        state={"`RadioGroupRootState` is `{ value, pending, disabled }`; `value` is optimistic."}
        owned={
          '`role` (`"radiogroup"`), `aria-required`, `disabled`, `form`, `data-pending`, `data-disabled`. Inside a `Field.Root` also `aria-labelledby`, `aria-describedby`, `aria-invalid` and `data-invalid`.'
        }
        note={
          "Other fieldset props pass through (`aria-label` for a group without a Label, for example)."
        }
      />

      <h4>
        <code>RadioGroup.Label</code>
      </h4>
      <PropsTable
        rows={[
          ...functionProps("RadioGroupRootState", "Content, or a function of the Root's state."),
          renderProp("legend", "RadioGroupRootState"),
        ]}
      />
      <PartFacts state={"the Root's."} owned={"none."} />

      <h4>
        <code>RadioGroup.Item</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "value",
            type: "string",
            description:
              "Required. The value this radio checks, unique within the Root; submitted as the form value.",
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description: "Native `disabled`: unfocusable, skipped by the arrow keys.",
          },
          {
            name: "transition",
            type: "ViewTransitionClass",
            description:
              "Forwarded to the Item's `<ViewTransition default>`; without it no boundary is rendered. Fires only on the commit that settles an action or rolls it back, never on the check itself.",
          },
          ...stylingProps("RadioGroupItemState"),
          {
            name: "render",
            type: "ReactElement | ((props, state: RadioGroupItemState) => ReactNode)",
            description:
              'Replace the default <input>. Must keep an `<input>`; the library sets `type="radio"`.',
          },
        ]}
      />
      <PartFacts
        state={
          "`RadioGroupItemState` is `{ value, checked, pending, disabled }`; `checked` is optimistic, `pending` is true on the radio the user is waiting on, and `disabled` includes `Root disabled`."
        }
        owned={
          "`type`, `name`, `value`, `checked`, `defaultChecked` (never rendered), `disabled`, `form`, `required`, `data-checked`, `data-pending`, `data-disabled`; `onChange` is merged (a `render` element's own handler runs first)."
        }
        note={"`id` and other input props pass through."}
      />

      <h3 id="data-attributes">Data attributes</h3>
      <Table
        head={["Hook", "On", "Pseudo-class", "Meaning"]}
        rows={[
          ["`data-pending`", "Root", "–", "`valueChangeAction` is in flight."],
          [
            "`data-pending`",
            "Item",
            "–",
            "The radio the in-flight dispatch is checking (the optimistic one).",
          ],
          [
            "`data-checked`",
            "Item",
            "`:checked`",
            "Optimistic checked state. Identical, because the DOM holds the optimistic value.",
          ],
          [
            "`data-disabled`",
            "Root, Item",
            "`:disabled`",
            "Disabled by prop; on an Item, by its own prop or `Root disabled`.",
          ],
          [
            "–",
            "Item",
            "`:required`, `:user-invalid`, `:focus-visible`",
            "Platform only; no attribute.",
          ],
          [
            "–",
            "Item",
            "`:indeterminate`",
            "Every radio of a group with nothing checked (platform).",
          ],
        ]}
      />
      <CodeBlock language="css">{`.radio:checked::before { scale: 1; }   /* flips on click, reverts on rejection */
.radio[data-pending] { animation: pulse 1s infinite alternate; }
.option:has(.radio:checked) { font-weight: 600; }
.group[data-pending] { cursor: progress; }`}</CodeBlock>

      <h3 id="keyboard-and-aria">Keyboard and ARIA</h3>
      <p>Everything here is the browser's; the library installs no key handler.</p>
      <Table
        head={["Key", "Behaviour", "Dispatches"]}
        rows={[
          [
            "Tab / Shift+Tab",
            "Enters the group on the checked radio (the first, with nothing checked) and leaves it on the next press.",
            "no",
          ],
          ["Space", "Checks the focused radio.", "yes"],
          [
            "ArrowDown / ArrowRight",
            'Focuses and checks the next enabled radio, wrapping (not in Safari). Mirrored under `dir="rtl"` (not in Safari).',
            "yes, once per press",
          ],
          [
            "ArrowUp / ArrowLeft",
            "Previous enabled radio, wrapping (not in Safari). Mirrored under RTL (not in Safari).",
            "yes, once per press",
          ],
          ["Enter", "Submits the form (implicit submission).", "no"],
        ]}
      />
      <ul>
        <li>
          No Home/End (not in the APG Radio Group pattern) and no <code>orientation</code> prop:
          native radios honour all four arrows whatever the layout.
        </li>
        <li>
          Safari (WebKit) neither wraps at the ends of the group nor mirrors ArrowLeft / ArrowRight
          under RTL: Right and Down always go to the next radio in document order, Left and Up to
          the previous one, and a press past the end does nothing (and dispatches nothing). This is
          the platform's behaviour; the library deliberately adds no key handler to change it.
        </li>
        <li>
          The checked state assistive technology reads is the optimistic one, so a new choice is
          announced at once. A rollback is silent; add an <code>aria-live</code> region if a slow
          action may fail.
        </li>
        <li>
          The library never moves focus, not even on rollback: focus stays on the radio the user
          reached, and the checked radio is the group's tab stop again.
        </li>
        <li>
          No <code>aria-checked</code> (forbidden on native inputs) and no <code>tabindex</code>{" "}
          (the browser does the roving).
        </li>
      </ul>
      <Example file="RadioGroupRtl.tsx" css="radio-group.css">
        <RadioGroupRtl />
      </Example>

      <BehaviourSection
        id="transition-types"
        summary={"`fsui-radio-group` (no kind: every change checks one radio)."}
      />

      <BehaviourSection
        id="optimistic-and-pending"
        summary={
          "The checked radio is the optimistic value, rendered into the native inputs. `data-pending` is on the Root while `valueChangeAction` is in flight, and on the Item being checked. An Item's `transition` animates the commit that settles an action or rolls it back, not the check."
        }
      >
        <h4>Walkthrough</h4>
        <ol>
          <li>
            Click Dark (or arrow to it): the browser checks it and unchecks the old radio; the group
            dispatches <code>valueChangeAction("dark", {'{ reason: "activate" }'})</code> in the
            Root's transition. The Root and the Dark radio get <code>data-pending</code>.
          </li>
          <li>Resolve: the value is committed (uncontrolled) and the attributes go.</li>
          <li>
            Reject: the optimistic value reverts, React writes <code>checked</code> back to the old
            radio, and the error reaches the nearest Error Boundary.
          </li>
          <li>
            Arrow keys pressed quickly dispatch once per press; only the latest dispatch commits.
            For a preference that needs no wait, do not return the promise (
            <code>{"(next) => { void save(next); }"}</code>), or leave the value to the form submit.
          </li>
        </ol>
        <p>
          The radios show the optimistic value because react-dom restores controlled inputs after
          every event (<a href="/concepts/browser-owned-state#native-inputs">Native inputs</a>), so{" "}
          <code>details.event.preventDefault()</code> is not a veto; a controlled parent vetoes by
          not adopting the value.
        </p>
      </BehaviourSection>

      <BehaviourSection
        id="suspense"
        summary={"No content region; nothing the RadioGroup renders suspends."}
      />

      <BehaviourSection
        id="browser-owned-state"
        summary={
          'Native radios: the browser checks one before any JavaScript runs. A form reset and clicks before hydration are dispatched with `reason: "platform"`, once per group.'
        }
      />

      <BehaviourSection
        id="before-hydration"
        summary={
          'Native radios: clicking, Space, arrow keys between radios, labels, `required` and form submission work. On hydration a changed value is reconciled with one `valueChangeAction` call (`reason: "platform"`).'
        }
      >
        <h4>Plain HTML</h4>
        <p>
          If a group only posts with its form, a Server Component can render the same native markup
          itself, with no library code for it:
        </p>
        <CodeBlock>{`// A Server Component: no import from @funstack/ui.
<fieldset role="radiogroup" aria-required="true">
  <legend>Size</legend>
  <label>
    <input type="radio" name="size" value="s" defaultChecked={order.size === "s"} required /> Small
  </label>
  <label>
    <input type="radio" name="size" value="m" defaultChecked={order.size === "m"} required /> Medium
  </label>
</fieldset>`}</CodeBlock>
        <p>
          The browser still provides the single tab stop, the arrow keys, <code>required</code> and
          submission. For a required group, do what the Root does: put <code>required</code> on
          every radio and <code>aria-required="true"</code> on the fieldset, so the radiogroup
          itself is announced as required. Compared with <code>RadioGroup</code>, every radio needs
          the shared <code>name</code> written out, and there is no <code>valueChangeAction</code>,
          so no transition, <code>data-pending</code> or rollback on rejection; no{" "}
          <code>data-checked</code> / <code>data-disabled</code> (use <code>:checked</code> and{" "}
          <code>:disabled</code>); no React state that tracks it (clicks before hydration and form
          resets live only in the DOM); and no <a href="/components/field">Field</a> integration.
        </p>
      </BehaviourSection>

      <h3 id="forms">Forms</h3>
      <Example file="RadioGroupForm.tsx" css="radio-group.css">
        <RadioGroupForm />
      </Example>
      <ul>
        <li>
          With a real <code>name</code> the group posts the checked value; <code>required</code>{" "}
          blocks the submit until a radio is checked and every radio matches{" "}
          <code>:user-invalid</code> after the attempt.
        </li>
        <li>
          <strong>Form reset</strong> (the Reset button, <code>form.reset()</code>, or React's
          automatic reset after the action succeeds) is one dispatch for the whole group, with{" "}
          <code>reason: "platform"</code> and the <code>reset</code> event. Uncontrolled, the target
          is the latest <code>defaultValue</code> (here the ordered size). Controlled, the
          mount-time value is offered to the parent, which adopts it or not. A disabled group is
          reset too, since the form's author reset it.
        </li>
        <li>
          <strong>Clicks before hydration</strong> (and Firefox restoring form state on reload) work
          natively; on hydration the Root finds the checked radio differs from its state and
          dispatches once, with no event. Items that hydrate later, inside a Suspense boundary,
          trigger one more check.
        </li>
      </ul>

      <h4>Server Functions and forms</h4>
      <CodeBlock>{`// Autosave: a per-group action with data-pending, passed directly from a Server Component.
<RadioGroup.Root defaultValue={user.plan} valueChangeAction={setPlan}>...</RadioGroup.Root>

// Native submission: no action on the group; pending is the form's.
<form action={placeOrder}>
  <RadioGroup.Root name="size" required>...</RadioGroup.Root>
  <SubmitButton />
</form>`}</CodeBlock>
      <p>
        The <a href="/concepts/action-props#form-channel">two channels</a> are independent and may
        be combined. An action-less group is a working native radio group before hydration and with
        JavaScript off.
      </p>
    </DocPage>
  );
}
