import { CodeBlock } from "../components/CodeBlock.js";
import { Callout, Example } from "../components/Example.js";
import { PageHead } from "../components/PageHead.js";
import { PropsTable, Table } from "../components/Tables.js";
import { RadioGroupForm } from "../examples/RadioGroupForm.js";
import radioGroupFormSource from "../examples/RadioGroupForm.tsx?raw";
import { RadioGroupRtl } from "../examples/RadioGroupRtl.js";
import radioGroupRtlSource from "../examples/RadioGroupRtl.tsx?raw";
import { RadioGroupTheme } from "../examples/RadioGroupTheme.js";
import radioGroupThemeSource from "../examples/RadioGroupTheme.tsx?raw";
import radioGroupCss from "../examples/radio-group.css?raw";
import { functionProps, renderProp } from "./shared-props.js";

export function RadioGroupPage() {
  return (
    <div className="learn-content">
      <PageHead
        title="RadioGroup"
        description="A radio group of native <input type=radio> in a <fieldset>: native keyboard and forms, an async valueChangeAction, optimistic checked state and data-pending."
      />
      <h2>RadioGroup</h2>
      <p className="page-intro">
        A radio group (WAI-ARIA Radio Group pattern, native radio variant): a{" "}
        <code>&lt;fieldset&gt;</code> of real <code>&lt;input type="radio"&gt;</code> elements. The
        platform supplies the single tab stop, arrow keys (wrapping and RTL-mirrored outside
        Safari), forms and validation. The library adds one thing: the checked value is changed
        through <code>valueChangeAction</code> in a transition, with optimistic feedback and{" "}
        <code>data-pending</code>.
      </p>

      <Example
        source={radioGroupThemeSource}
        fileName="RadioGroupTheme.tsx"
        css={radioGroupCss}
        cssFileName="radio-group.css"
      >
        <RadioGroupTheme />
      </Example>

      <h3>Anatomy</h3>
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

      <h3>Props</h3>
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
      <p>
        <code>RadioGroupRootState</code>: <code>{"{ value, pending, disabled }"}</code>, with{" "}
        <code>value</code> optimistic. The Root owns <code>role</code>. Other fieldset props pass
        through (<code>aria-label</code> for a group without a Label, for example).
      </p>

      <h4>
        <code>RadioGroup.Label</code>
      </h4>
      <PropsTable
        rows={[
          ...functionProps("RadioGroupRootState", "Content, or a function of the Root's state."),
          renderProp("legend", "RadioGroupRootState"),
        ]}
      />

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
            default: "–",
            description:
              "Forwarded to the Item's `<ViewTransition default>`; without it no boundary is rendered. Fires only on the commit that settles an action or rolls it back, never on the check itself.",
          },
          {
            name: "className",
            type: "string | ((state: RadioGroupItemState) => string | undefined)",
            description: "A class name, or a function of the Item's state.",
          },
          {
            name: "style",
            type: "CSSProperties | ((state: RadioGroupItemState) => CSSProperties | undefined)",
            description: "Inline style, or a function of the Item's state.",
          },
          {
            name: "render",
            type: "ReactElement | ((props, state: RadioGroupItemState) => ReactNode)",
            description:
              'Replace the default <input>. Must keep an `<input>`; the library sets `type="radio"`.',
          },
        ]}
      />
      <p>
        <code>RadioGroupItemState</code>: <code>{"{ value, checked, pending, disabled }"}</code>.{" "}
        <code>checked</code> is optimistic, <code>pending</code> is true on the radio the user is
        waiting on, and <code>disabled</code> includes <code>Root disabled</code>. The Item owns{" "}
        <code>type</code>, <code>name</code>, <code>value</code>, <code>checked</code>,{" "}
        <code>defaultChecked</code>, <code>disabled</code>, <code>form</code>, <code>required</code>{" "}
        and <code>onChange</code>; <code>id</code> and other input props pass through.
      </p>

      <h3>Data attributes and pseudo-classes</h3>
      <Table
        head={["Attribute", "On", "Pseudo-class", "Meaning"]}
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

      <h3>Keyboard and ARIA</h3>
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
      <Example
        source={radioGroupRtlSource}
        fileName="RadioGroupRtl.tsx"
        css={radioGroupCss}
        cssFileName="radio-group.css"
      >
        <RadioGroupRtl />
      </Example>

      <h3>Async walkthrough</h3>
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
          Arrow keys pressed quickly dispatch once per press; only the latest dispatch commits. For
          a preference that needs no wait, do not return the promise (
          <code>{"(next) => { void save(next); }"}</code>), or leave the value to the form submit.
        </li>
      </ol>
      <Callout title="Why the DOM shows the optimistic value">
        <p>
          After every event react-dom restores controlled radios to their props. Only the
          synchronous optimistic state has rendered by then, so radios driven by committed state
          would snap back right after the click. Rendering the optimistic value is a correctness
          requirement for native inputs. <code>details.event.preventDefault()</code> is therefore
          not a veto; a controlled parent vetoes by not adopting the value.
        </p>
      </Callout>

      <h3>Forms</h3>
      <Example
        source={radioGroupFormSource}
        fileName="RadioGroupForm.tsx"
        css={radioGroupCss}
        cssFileName="radio-group.css"
      >
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

      <h3>Server Functions and forms</h3>
      <CodeBlock>{`// Autosave: a per-group action with data-pending, passed directly from a Server Component.
<RadioGroup.Root defaultValue={user.plan} valueChangeAction={setPlan}>...</RadioGroup.Root>

// Native submission: no action on the group; pending is the form's.
<form action={placeOrder}>
  <RadioGroup.Root name="size" required>...</RadioGroup.Root>
  <SubmitButton />
</form>`}</CodeBlock>
      <p>
        The two channels are independent and may be combined. The group never reads{" "}
        <code>useFormStatus</code>. An action-less group is a working native radio group before
        hydration and with JavaScript off.
      </p>

      <h3>Plain HTML</h3>
      <p>
        If a group only posts with its form, a Server Component can render the same native markup
        itself, with no library code for it:
      </p>
      <CodeBlock>{`// A Server Component: no import from @funstack/ui.
<fieldset role="radiogroup">
  <legend>Size</legend>
  <label>
    <input type="radio" name="size" value="s" defaultChecked={order.size === "s"} required /> Small
  </label>
  <label>
    <input type="radio" name="size" value="m" defaultChecked={order.size === "m"} /> Medium
  </label>
</fieldset>`}</CodeBlock>
      <p>
        The browser still provides the single tab stop, the arrow keys, <code>required</code> and
        submission. Compared with <code>RadioGroup</code>, every radio needs the shared{" "}
        <code>name</code> written out, and there is no <code>valueChangeAction</code>, so no
        transition, <code>data-pending</code> or rollback on rejection; no <code>data-checked</code>{" "}
        / <code>data-disabled</code> (use <code>:checked</code> and <code>:disabled</code>); no
        reconciliation of clicks before hydration or of a form reset with your state; and no{" "}
        <a href="/components/field">Field</a> integration.
      </p>
    </div>
  );
}
