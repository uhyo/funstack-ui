import { CodeBlock } from "../components/CodeBlock.js";
import { Callout, Example } from "../components/Example.js";
import { PageHead } from "../components/PageHead.js";
import { PropsTable, Table } from "../components/Tables.js";
import { CheckboxGroupForm } from "../examples/CheckboxGroupForm.js";
import checkboxGroupFormSource from "../examples/CheckboxGroupForm.tsx?raw";
import { CheckboxGroupToppings } from "../examples/CheckboxGroupToppings.js";
import checkboxGroupToppingsSource from "../examples/CheckboxGroupToppings.tsx?raw";
import checkboxGroupCss from "../examples/checkbox-group.css?raw";
import { functionProps, renderProp } from "./shared-props.js";

const transitionRow = (part: string) => ({
  name: "transition",
  type: "ViewTransitionClass",
  default: "–",
  description: `Forwarded to the ${part}'s \`<ViewTransition default>\`; without it no boundary is rendered. Fires only on the commit that settles an action or rolls it back, never on the click itself. Keep it static.`,
});

export function CheckboxGroupPage() {
  return (
    <div className="learn-content">
      <PageHead
        title="CheckboxGroup"
        description="A group of native <input type=checkbox> in a <fieldset> with a set value, a mixed-state select-all Parent, group-level required, an async valueChangeAction and data-pending."
      />
      <h2>CheckboxGroup</h2>
      <p className="page-intro">
        A group of checkboxes sharing one value, a set of strings: a <code>&lt;fieldset&gt;</code>{" "}
        of real <code>&lt;input type="checkbox"&gt;</code> elements with a shared <code>name</code>.
        The platform supplies the keyboard, labels, forms and validation. The library adds the
        set-valued state changed through <code>valueChangeAction</code> in a transition (optimistic,
        with <code>data-pending</code>), a mixed-state <strong>Parent</strong> box that checks or
        unchecks a subset (the WAI-ARIA "select all"), and an "at least one" <code>required</code>.
      </p>

      <Example
        source={checkboxGroupToppingsSource}
        fileName="CheckboxGroupToppings.tsx"
        css={checkboxGroupCss}
        cssFileName="checkbox-group.css"
      >
        <CheckboxGroupToppings />
      </Example>

      <h3>Anatomy</h3>
      <CodeBlock>{`import { CheckboxGroup } from "@funstack/ui/checkbox-group";

<CheckboxGroup.Root name="toppings" defaultValue={["cheese"]} valueChangeAction={saveToppings}> {/* fieldset */}
  <CheckboxGroup.Label>Toppings</CheckboxGroup.Label>   {/* legend: optional, first child */}
  <label>
    <CheckboxGroup.Parent values={["cheese", "ham"]} /> All toppings  {/* mixed-state box */}
  </label>
  <label>
    <CheckboxGroup.Item value="cheese" /> Cheese          {/* input type=checkbox */}
  </label>
  <label>
    <CheckboxGroup.Item value="ham" /> Ham
  </label>
</CheckboxGroup.Root>`}</CodeBlock>
      <ul>
        <li>
          <strong>
            Root is a <code>&lt;fieldset&gt;</code>
          </strong>{" "}
          with its native role <code>group</code>: the legend names it, <code>disabled</code>{" "}
          reaches every box natively, and it finds the form for resets. A <code>render</code>{" "}
          element must stay a <code>&lt;fieldset&gt;</code>.
        </li>
        <li>
          <strong>
            Label is the <code>&lt;legend&gt;</code>
          </strong>{" "}
          and must be the Root's first child. Its function children receive the Root's state.
        </li>
        <li>
          <strong>Item is one checkbox</strong> of the group: checked while its <code>value</code>{" "}
          is in the set. A plain <code>Checkbox</code> inside the Root is not a member; membership
          is explicit through <code>Item</code>.
        </li>
        <li>
          <strong>Parent is a "select all" box</strong> over the <code>values</code> you give it:
          checked when all are, mixed when some are, and its click sets them all. It has no{" "}
          <code>name</code>, so it is never submitted. Several Parents may share a group, one per
          section; one listing every value acts as a grand-parent.
        </li>
        <li>
          No Indicator part: style the inputs (the example uses <code>appearance: none</code> and{" "}
          <code>::before</code>, see the Checkbox page) or use <code>accent-color</code>.
        </li>
      </ul>

      <h3>The value is a set</h3>
      <p>
        <code>value</code> and <code>defaultValue</code> are <code>string[]</code>, so a{" "}
        <code>useState&lt;string[]&gt;</code> setter plugs in. Order does not matter and duplicates
        are ignored. <code>next</code> is a fresh array in the document order of the Items (what{" "}
        <code>formData.getAll(name)</code> returns); compare it as a set. <code>details.added</code>{" "}
        and <code>details.removed</code> say what changed: one value for an Item click, a whole
        subset for a Parent click, the diff for a form reset. A value with no Item is kept through
        clicks and never submitted.
      </p>
      <Callout title="Controlled and updating after the save? Use the diff">
        <p>
          Two overlapping saves can complete out of order, and <code>setValue(next)</code> after the{" "}
          <code>await</code> would then land the older whole set last. Update from{" "}
          <code>added</code> / <code>removed</code> instead:
        </p>
        <CodeBlock>{`valueChangeAction={async (next, { added, removed }) => {
  await save(added, removed);
  startTransition(() =>
    setToppings((prev) => [
      ...prev.filter((v) => !removed.includes(v)),
      ...added.filter((v) => !prev.includes(v)),
    ]),
  );
}}`}</CodeBlock>
        <p>
          Uncontrolled groups need none of this: the latest dispatch already contains the earlier
          clicks.
        </p>
      </Callout>

      <h3>Props</h3>
      <h4>
        <code>CheckboxGroup.Root</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "value",
            type: "string[]",
            description:
              "Controlled checked values; `[]` checks nothing. undefined means uncontrolled. Order is not significant; duplicates are ignored.",
          },
          {
            name: "defaultValue",
            type: "string[]",
            default: "[]",
            description:
              "Initial values in uncontrolled mode. Also what a form reset returns to: the latest value is mirrored into the boxes' `defaultChecked`.",
          },
          {
            name: "valueChangeAction",
            type: "ChangeAction<string[], CheckboxGroupValueChangeDetails>",
            description: (
              <>
                Runs in the Root's transition whenever the set changes; sync, async or a Server
                Function. Rejections reach the nearest Error Boundary and roll the change back.{" "}
                <code>details</code> is <code>{"{ reason, added, removed }"}</code> (plus the
                virtual <code>event</code>): <code>reason</code> is <code>"activate"</code> for an
                Item or Parent click and <code>"platform"</code> for a form reset or a change found
                at hydration.
              </>
            ),
          },
          {
            name: "name",
            type: "string",
            default: "useId()",
            description:
              "The `name` shared by every Item: the form data key (`formData.getAll(name)`). Pass a real name inside a form you submit.",
          },
          {
            name: "required",
            type: "boolean",
            default: "false",
            description:
              "At least one Item must be checked: every Item is rendered `required` while nothing is checked, none once one is (see Forms).",
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description:
              "Renders `<fieldset disabled>`: every Item and Parent is disabled and unfocusable.",
          },
          {
            name: "form",
            type: "string",
            description: "The `form` attribute, applied to the fieldset and to every Item.",
          },
          ...functionProps(
            "CheckboxGroupRootState",
            "The Label, Parents and Items. The function form receives the optimistic value; must not suspend.",
          ),
          renderProp("fieldset", "CheckboxGroupRootState"),
        ]}
      />
      <p>
        <code>CheckboxGroupRootState</code>: <code>{"{ value, pending, disabled }"}</code>, with{" "}
        <code>value</code> the optimistic set as an array in document order. The Root owns{" "}
        <code>disabled</code> and <code>form</code> and writes no <code>role</code>; other fieldset
        props pass through (<code>aria-label</code> for a group without a Label, for example).
      </p>

      <h4>
        <code>CheckboxGroup.Label</code>
      </h4>
      <PropsTable
        rows={[
          ...functionProps("CheckboxGroupRootState", "Content, or a function of the Root's state."),
          renderProp("legend", "CheckboxGroupRootState"),
        ]}
      />

      <h4>
        <code>CheckboxGroup.Item</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "value",
            type: "string",
            description:
              "Required. The value this box contributes when checked; unique within the Root. Submitted as the form value.",
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description: "Native `disabled`: unfocusable, never dispatches, not validated.",
          },
          transitionRow("Item"),
          {
            name: "className",
            type: "string | ((state: CheckboxGroupItemState) => string | undefined)",
            description: "A class name, or a function of the Item's state.",
          },
          {
            name: "style",
            type: "CSSProperties | ((state: CheckboxGroupItemState) => CSSProperties | undefined)",
            description: "Inline style, or a function of the Item's state.",
          },
          {
            name: "render",
            type: "ReactElement | ((props, state: CheckboxGroupItemState) => ReactNode)",
            description:
              'Replace the default <input>. Must keep an `<input>`; the library sets `type="checkbox"`.',
          },
        ]}
      />
      <p>
        <code>CheckboxGroupItemState</code>: <code>{"{ value, checked, pending, disabled }"}</code>.{" "}
        <code>checked</code> is optimistic; <code>pending</code> is true while an action is in
        flight and this box's optimistic state differs from the committed one (click a box twice
        quickly and it is not pending, the Root still is); <code>disabled</code> includes{" "}
        <code>Root disabled</code>. The Item owns <code>type</code>, <code>name</code>,{" "}
        <code>value</code>, <code>checked</code>, <code>defaultChecked</code>, <code>disabled</code>
        , <code>form</code>, <code>required</code> (computed by the Root) and{" "}
        <code>aria-checked</code> (removed); <code>onChange</code> is merged; <code>id</code>,{" "}
        <code>role</code> and other input props pass through. There is no per-Item{" "}
        <code>required</code>: use a plain <code>Checkbox</code> for "this box must be checked".
      </p>

      <h4>
        <code>CheckboxGroup.Parent</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "values",
            type: "string[]",
            description:
              "Required. The values this Parent controls, usually every Item's value. Values with no Item are still added and removed.",
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description: "Native `disabled`: unfocusable, never dispatches.",
          },
          transitionRow("Parent"),
          {
            name: "className",
            type: "string | ((state: CheckboxGroupParentState) => string | undefined)",
            description: "A class name, or a function of the Parent's state.",
          },
          {
            name: "style",
            type: "CSSProperties | ((state: CheckboxGroupParentState) => CSSProperties | undefined)",
            description: "Inline style, or a function of the Parent's state.",
          },
          {
            name: "render",
            type: "ReactElement | ((props, state: CheckboxGroupParentState) => ReactNode)",
            description:
              'Replace the default <input>. Must keep an `<input>`; the library sets `type="checkbox"`.',
          },
        ]}
      />
      <p>
        <code>CheckboxGroupParentState</code>:{" "}
        <code>{"{ values, checked, indeterminate, pending, disabled }"}</code>. <code>checked</code>
        : every value is in the optimistic set (false for empty <code>values</code>);{" "}
        <code>indeterminate</code>: some but not all, never together with <code>checked</code>, and,
        unlike a plain Checkbox, not hidden while pending (it is derived from the optimistic set, so
        the DOM property, the attribute and <code>:indeterminate</code> always agree);{" "}
        <code>pending</code>: an action is in flight and one of its values is changing. The Parent
        owns <code>type</code>, <code>checked</code>, <code>defaultChecked</code>,{" "}
        <code>indeterminate</code>, <code>disabled</code> and <code>aria-checked</code>, and always
        removes <code>name</code>, <code>value</code>, <code>form</code> and <code>required</code>.
      </p>

      <h4>Click cycle</h4>
      <p>The Parent follows the WAI-ARIA APG mixed-state checkbox example:</p>
      <Table
        head={["Parent shows", "Click", "details"]}
        rows={[
          ["mixed", "Checks every value.", "`added`: the missing values"],
          ["checked", "Unchecks every value.", "`removed`: all its values"],
          [
            "unchecked, after a partial combination was saved",
            "Restores that combination.",
            "`added`: the remembered values",
          ],
          ["unchecked, no saved partial", "Checks every value.", "`added`: all its values"],
        ]}
      />
      <p>
        The remembered combination is the last partial one the group <em>committed</em> (the
        mount-time value counts), never a state that was only pending and then rolled back. From
        "none", a user who wants "all" after a remembered combination clicks twice.
      </p>

      <h3>Data attributes and pseudo-classes</h3>
      <Table
        head={["Attribute", "On", "Pseudo-class", "Meaning"]}
        rows={[
          ["`data-pending`", "Root", "–", "`valueChangeAction` is in flight."],
          [
            "`data-pending`",
            "Item, Parent",
            "–",
            "An action is in flight and this box's (or one of the Parent's values') state is changing.",
          ],
          [
            "`data-checked`",
            "Item, Parent",
            "`:checked`",
            "Optimistic checked state; the DOM holds it.",
          ],
          [
            "`data-indeterminate`",
            "Parent",
            "`:indeterminate`",
            "Some but not all of its values are checked. The attribute also works before hydration.",
          ],
          [
            "`data-disabled`",
            "Root, Item, Parent",
            "`:disabled`",
            "Disabled by prop; on an Item or Parent, by its own prop or `Root disabled`.",
          ],
          [
            "–",
            "Item",
            "`:required`, `:user-invalid`, `:focus-visible`",
            "Platform only; no attribute.",
          ],
        ]}
      />
      <CodeBlock language="css">{`.box:checked::before { scale: 1; }      /* flips on click, reverts on rejection */
.box[data-indeterminate]::before { /* the dash */ }
.box[data-pending] { animation: pulse 1s infinite alternate; }
.group[data-pending] { cursor: progress; }
.group:has(.box:user-invalid) legend { color: red; }  /* empty required group after a submit */`}</CodeBlock>

      <h3>Keyboard and ARIA</h3>
      <p>Everything here is the browser's; the library installs no key handler.</p>
      <Table
        head={["Key", "Behaviour", "Dispatches"]}
        rows={[
          [
            "Tab / Shift+Tab",
            "Every enabled Item and Parent is a tab stop, in document order.",
            "no",
          ],
          ["Space", "Toggles the focused box (a Parent follows the click cycle).", "yes"],
          ["Enter", "Submits the form (implicit submission).", "no"],
          ["Arrows, Home, End", "Nothing (the APG defines no arrow keys for checkboxes).", "–"],
        ]}
      />
      <ul>
        <li>
          The fieldset is a <code>group</code> named by its legend, as the APG advises for related
          checkboxes. The Parent's mixed state reaches assistive technology through the{" "}
          <code>indeterminate</code> property (exposed as <code>aria-checked="mixed"</code>), set
          after hydration.
        </li>
        <li>
          ARIA does not allow <code>aria-required</code> on role <code>group</code>, so a required
          group is not announced as such on the fieldset: say it in the Label ("choose at least
          one") or through <code>aria-describedby</code> on the Root. While the group is empty each
          box is announced as required (Chromium reports them as invalid).
        </li>
        <li>
          The checked state assistive technology reads is the optimistic one. A rollback is silent;
          add an <code>aria-live</code> region if a slow action may fail. The library never moves
          focus.
        </li>
      </ul>

      <h3>Async walkthrough</h3>
      <ol>
        <li>
          Click Ham: the browser checks it; the group dispatches{" "}
          <code>
            valueChangeAction(["cheese", "ham"],{" "}
            {'{ reason: "activate", added: ["ham"], removed: [] }'})
          </code>{" "}
          in the Root's transition. The Root and the Ham box get <code>data-pending</code>; a Parent
          over both values shows checked at once.
        </li>
        <li>Resolve: the set is committed (uncontrolled) and the attributes go.</li>
        <li>
          Reject: the optimistic set reverts, React writes <code>checked</code> back, the Parent
          returns to mixed, and the error reaches the nearest Error Boundary.
        </li>
        <li>
          Clicks while a save is pending stack: each dispatch is computed from what the user sees,
          and only the latest commits.
        </li>
      </ol>

      <h3>Forms</h3>
      <Example
        source={checkboxGroupFormSource}
        fileName="CheckboxGroupForm.tsx"
        css={checkboxGroupCss}
        cssFileName="checkbox-group.css"
      >
        <CheckboxGroupForm />
      </Example>
      <ul>
        <li>
          With a real <code>name</code>, every checked Item posts <code>name=value</code>; read them
          with <code>formData.getAll(name)</code>. Parents post nothing.
        </li>
        <li>
          <strong>
            <code>required</code> means "at least one"
          </strong>
          . HTML has no group constraint, so the Root renders native <code>required</code> on every
          Item while nothing is checked (following the optimistic state) and on none once one is.
          Validation, the browser's localised message and <code>:user-invalid</code> stay native;
          the message reads "check this box". Disabled boxes are not validated, so a disabled group
          never blocks a submit.
        </li>
        <li>
          Before hydration the attribute is whatever the server rendered: in an empty required group
          every box is required, so a user who checks one box and submits before hydration is still
          blocked by another box until hydration. That over-blocks, never under-blocks.
        </li>
        <li>
          <strong>Form reset</strong> (the Reset button, <code>form.reset()</code>, or React's
          automatic reset after the action succeeds) is one dispatch for the whole group, with{" "}
          <code>reason: "platform"</code>, the <code>reset</code> event, and the diff in{" "}
          <code>added</code> / <code>removed</code>. Uncontrolled, the target is the latest{" "}
          <code>defaultValue</code>; controlled, the mount-time values are offered to the parent.
        </li>
        <li>
          <strong>Clicks before hydration</strong> work natively, on Items and on Parents. On
          hydration the Root dispatches once for everything it finds changed, with no event; a
          Parent clicked before hydration counts as "check all" (or "uncheck all") of its values.
          Items that hydrate later, inside a Suspense boundary, are reconciled when they do; unlike
          RadioGroup, a group split across Suspense boundaries works.
        </li>
      </ul>

      <h3>Server Functions and forms</h3>
      <CodeBlock>{`// Autosave: a per-group action with data-pending, passed directly from a Server Component.
// details ({ reason, added, removed }) is serialisable.
<CheckboxGroup.Root defaultValue={order.toppings} valueChangeAction={saveToppings}>...</CheckboxGroup.Root>

// Native submission: no action on the group; pending is the form's.
<form action={createOrder}>
  <CheckboxGroup.Root name="toppings" required>...</CheckboxGroup.Root>
  <SubmitButton />
</form>`}</CodeBlock>
      <p>
        The two channels are independent and may be combined. The group never reads{" "}
        <code>useFormStatus</code>. An action-less group is a working set of native checkboxes
        before hydration and with JavaScript off; the Parent's cascade and the dynamic{" "}
        <code>required</code> need hydration.
      </p>
      <p>
        Transition types: every dispatch adds <code>fsui-checkbox-group</code>, plus{" "}
        <code>fsui-checkbox-group-check</code> when it checks something and{" "}
        <code>fsui-checkbox-group-uncheck</code> when it unchecks something (a reset can carry
        both).
      </p>
    </div>
  );
}
