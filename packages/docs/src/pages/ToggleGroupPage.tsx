import { CodeBlock } from "../components/CodeBlock.js";
import { Callout } from "../components/Callout.js";
import { Example } from "../components/Example.js";
import { BehaviourIndex, BehaviourSection } from "../components/Concept.js";
import { DocPage } from "../components/DocPage.js";
import { PartFacts, PropsTable, Table } from "../components/Tables.js";
import { ToggleGroupAlignment } from "../examples/ToggleGroupAlignment.js";
import { ToggleGroupStyles } from "../examples/ToggleGroupStyles.js";
import { functionProps, renderProp } from "./shared-props.js";

export function ToggleGroupPage() {
  return (
    <DocPage
      title="ToggleGroup"
      description="A set of aria-pressed toggle buttons sharing one value: several pressed, or at most one with exclusive. Optimistic, with pending state."
    >
      <p className="page-intro">
        A set of toggle buttons that share one value: any number pressed by default, at most one
        with <code>exclusive</code>. Every Item is the <a href="/components/toggle">Toggle</a>{" "}
        element (<code>&lt;button aria-pressed&gt;</code>); the group is one Tab stop with arrow
        keys between the Items, and inside a <a href="/components/toolbar">Toolbar</a> its Items
        join the toolbar's sequence.
      </p>

      <Example file="ToggleGroupStyles.tsx" css="toggle-group.css">
        <ToggleGroupStyles />
      </Example>
      <p>
        Each Item flips the moment it is clicked and carries <code>data-pending</code> until its
        save settles; the group carries it too. A rejected save flips the Item back and reaches the
        Error Boundary around the group. Name the group with <code>aria-label</code> or{" "}
        <code>aria-labelledby</code>: it is what tells screen-reader users the buttons belong
        together.
      </p>

      <BehaviourIndex />

      <h3 id="anatomy">Anatomy</h3>
      <CodeBlock>{`import { ToggleGroup } from "@funstack/ui/toggle-group";

<ToggleGroup.Root aria-label="Text style" defaultValue={["bold"]} valueChangeAction={save}>
  <ToggleGroup.Item value="bold">Bold</ToggleGroup.Item>
  <ToggleGroup.Item value="italic">Italic</ToggleGroup.Item>
</ToggleGroup.Root>`}</CodeBlock>
      <Table
        head={["Part", "Element", "Role"]}
        rows={[
          [
            "`ToggleGroup.Root`",
            '`<div role="group">`',
            "Owns the value, the transition and the roving focus.",
          ],
          [
            "`ToggleGroup.Item`",
            '`<button type="button" aria-pressed>`',
            "One toggle; its pressed state is the Root's.",
          ],
        ]}
      />

      <h3 id="how-it-works">How it works</h3>
      <h4>Exclusive mode</h4>
      <Example file="ToggleGroupAlignment.tsx">
        <ToggleGroupAlignment />
      </Example>
      <p>
        With <code>exclusive</code>, <code>value</code> is <code>string | null</code>. Pressing the
        pressed Item releases it (<code>next === null</code>); a view switcher that must always show
        one value passes <code>deselectable={"{false}"}</code>, and pressing the pressed Item then
        dispatches nothing.
      </p>
      <Callout title="When to use RadioGroup instead">
        <p>
          The Items stay <code>aria-pressed</code> buttons in both modes, so a screen reader does
          not announce "1 of 3" or mutual exclusivity. If the choice is a form value, must always
          have a value, or should be announced as one choice among several, use a{" "}
          <a href="/components/radio-group">RadioGroup</a> styled as a segmented control: native
          radios, arrows that select, <code>name</code> and <code>required</code>.
        </p>
      </Callout>

      <h3 id="props">Props</h3>
      <h4>ToggleGroup.Root</h4>
      <p>
        The props are discriminated on <code>exclusive</code>: without it (or with{" "}
        <code>exclusive={"{false}"}</code>) the value is a <code>string[]</code>; with{" "}
        <code>exclusive</code> it is <code>string | null</code>, and <code>deselectable</code>{" "}
        becomes available. The mode is fixed when the group mounts.
      </p>
      <PropsTable
        rows={[
          {
            name: "exclusive",
            type: "boolean",
            default: "false",
            description: "At most one Item pressed; `value` becomes `string | null`.",
          },
          {
            name: "value",
            type: "string[] | (exclusive) string | null",
            description:
              "Controlled pressed values. `[]` / `null` presses nothing; `undefined` means uncontrolled. Order is not significant.",
          },
          {
            name: "defaultValue",
            type: "string[] | (exclusive) string | null",
            default: "[] / null",
            description: "Initial pressed values in uncontrolled mode.",
          },
          {
            name: "valueChangeAction",
            type: "ChangeAction<string[] | (exclusive) string | null, ToggleGroupValueChangeDetails>",
            description:
              "Runs inside the Root's transition on every change. `next` is a fresh array in document order (exclusive: the value or `null`); `details` is `{ added, removed }` plus the virtual `event`. Rejections roll the change back and reach the nearest Error Boundary.",
          },
          {
            name: "deselectable",
            type: "boolean",
            default: "true",
            description:
              "Exclusive only. `false`: pressing the pressed Item does nothing, so the action never receives `null`.",
          },
          {
            name: "orientation",
            type: '"horizontal" | "vertical"',
            default: '"horizontal"',
            description:
              "Axis of the arrow keys and `data-orientation`. Ignored inside a Toolbar (development warning).",
          },
          {
            name: "loop",
            type: "boolean",
            default: "true",
            description: "Arrows wrap from the last Item to the first. Ignored inside a Toolbar.",
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description:
              'Disables every Item (native `disabled`; `aria-disabled="true"` on an Item with a link or component `render`).',
          },
          {
            name: "experimental_focusgroup",
            type: "boolean",
            default: "false",
            description: (
              <>
                Renders <code>focusgroup="toolbar … nomemory"</code> and{" "}
                <code>focusgroupstart</code> on the first pressed Item; where the browser implements
                it (Chromium 150+) the browser moves focus, and Tab enters on the pressed Item.
                Ignored inside a Toolbar, with a development warning: a nested focusgroup would add
                Tab stops. See <a href="/concepts/experimental">Experimental features</a>.
              </>
            ),
          },
          ...functionProps("ToggleGroupRootState"),
          renderProp("div", "ToggleGroupRootState"),
        ]}
      />
      <PartFacts
        state={
          "`ToggleGroupRootState` is `{ value, pending, disabled, orientation }`; `value` is the optimistic set as an array in document order (exclusive mode: `[value]` or `[]`)."
        }
        owned={
          '`role` (`"group"`), `data-orientation`, `data-pending`, `data-disabled`; standalone (outside a Toolbar) also the roving-focus handlers `onKeyDown`, `onFocus`, `onBlur`, `onPointerDown` and, with the flag, `focusgroup`.'
        }
        note={"Every other `<div>` prop passes through."}
      />

      <h4>ToggleGroup.Item</h4>
      <PropsTable
        rows={[
          {
            name: "value",
            type: "string",
            description: "The value this Item presses. Unique within the group.",
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description:
              'Never dispatches. Native `disabled` on a `<button>`, skipped by the arrow keys. With a link or component `render`, `aria-disabled="true"` instead: the element stays focusable and the arrow keys reach it (the APG Toolbar behaviour).',
          },
          {
            name: "transition",
            type: "ViewTransitionClass",
            description:
              "Forwarded to the Item's `<ViewTransition default>`. Animates the commit that ends the group's action, not the optimistic flip.",
          },
          ...functionProps(
            "ToggleGroupItemState",
            "Rendered from optimistic state; must not suspend.",
          ),
          renderProp("button", "ToggleGroupItemState"),
        ]}
      />
      <PartFacts
        state={"`ToggleGroupItemState` is `{ pressed, pending, disabled, orientation }`."}
        owned={
          '`aria-pressed`, `disabled`, `aria-disabled` (link or component `render`), `onClick`, `tabIndex` (the roving focus writes it), `data-pressed`, `data-pending`, `data-disabled`, `data-orientation`, and `focusgroupstart` while the Root renders `focusgroup`. `type` defaults to `"button"`; a `render` element\'s own wins.'
        }
      />

      <h3 id="data-attributes">Data attributes</h3>
      <Table
        head={["Attribute", "On", "Meaning"]}
        rows={[
          [
            "`data-orientation`",
            "Root, Item",
            "The effective orientation (the Toolbar's inside one).",
          ],
          ["`data-pending`", "Root", "An action dispatched through the group is in flight."],
          [
            "`data-pending`",
            "Item",
            "In flight and this Item's optimistic state differs from its committed one.",
          ],
          ["`data-pressed`", "Item", "Optimistically pressed (agrees with `aria-pressed`)."],
          ["`data-disabled`", "Root, Item", "Disabled (the Item's own or the Root's)."],
        ]}
      />

      <h3 id="keyboard-and-aria">Keyboard and ARIA</h3>
      <Table
        head={["Key", "Horizontal", "Vertical", "Effect"]}
        rows={[
          [
            "ArrowRight / ArrowLeft",
            "Next / previous enabled Item (swapped under `direction: rtl`)",
            "Ignored",
            "Moves focus only; wraps if `loop`. Never presses.",
          ],
          ["ArrowDown / ArrowUp", "Ignored", "Next / previous enabled Item", "Same."],
          ["Home / End", "First / last enabled Item", "Same", "Same."],
          ["Space / Enter", "", "", "Toggles the focused Item (native button activation)."],
          [
            "Tab / Shift+Tab",
            "",
            "",
            "Enters on the first pressed enabled Item, else the first enabled one; leaves with the next press.",
          ],
        ]}
      />
      <ul>
        <li>
          The Root is <code>role="group"</code> with no <code>aria-orientation</code> (ARIA does not
          allow it on a group); orientation is <code>data-orientation</code> only.
        </li>
        <li>
          <code>aria-pressed</code> is always <code>"true"</code> or <code>"false"</code> and
          follows the optimistic state. Focus never changes it.
        </li>
        <li>
          Disabled Items are natively disabled and leave the arrow-key sequence. An Item rendered as
          a link or a component is <code>aria-disabled</code> instead, and the arrow keys still
          reach it (it never dispatches). A rejected action rolls the pressed state back; focus
          stays where it is.
        </li>
        <li>
          Before hydration every Item is a Tab stop; the single Tab stop is set up by the first
          effect. The server HTML carries no <code>tabindex</code>.
        </li>
      </ul>

      <BehaviourSection
        id="transition-types"
        summary={
          "`fsui-toggle-group`, plus `fsui-toggle-group-press` and / or `fsui-toggle-group-release`."
        }
      />

      <BehaviourSection
        id="optimistic-and-pending"
        summary={
          "Items show the optimistic set (`aria-pressed`, `data-pressed`). `data-pending` is on the Root while an action is in flight, and on each Item whose optimistic state differs from its committed one. An Item's `transition` animates the commit that ends the action, not the flip."
        }
      />

      <BehaviourSection
        id="suspense"
        summary={"No content region. Item content renders optimistic state and must not suspend."}
      />

      <BehaviourSection
        id="browser-owned-state"
        summary={"None: the pressed set is library-owned."}
      />

      <BehaviourSection
        id="before-hydration"
        summary={
          "Markup and ARIA; every Item is its own Tab stop until the first effect sets up the single Tab stop. Pressing needs JavaScript."
        }
      />

      <h3 id="styling">Styling</h3>
      <CodeBlock language="css">{`.group[data-pending] { cursor: progress; }
.item[data-pressed] { background: var(--accent); color: white; }
.item[data-pending]::after { content: ""; /* spinner */ }

@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}`}</CodeBlock>
      <p>
        The optimistic flip is a synchronous commit: animate it with a CSS transition on{" "}
        <code>[data-pressed]</code>. View transition types are <code>fsui-toggle-group</code>, plus{" "}
        <code>fsui-toggle-group-press</code> and / or <code>fsui-toggle-group-release</code>.
      </p>

      <h3 id="recipes">Recipes</h3>
      <h4>Controlled, saved on the server</h4>
      <p>
        <code>next</code> is the whole set; <code>details.added</code> and{" "}
        <code>details.removed</code> say what changed. When you update after your own{" "}
        <code>await</code>, apply the diff with a functional update: two overlapping saves that
        settle out of order then cannot lose a change.
      </p>
      <CodeBlock>{`const [styles, setStyles] = useState<string[]>(doc.styles);

<ToggleGroup.Root
  aria-label="Text style"
  value={styles}
  valueChangeAction={async (_next, { added, removed }) => {
    await api.patchStyles(doc.id, { added, removed });
    startTransition(() =>
      setStyles((prev) => [
        ...prev.filter((v) => !removed.includes(v)),
        ...added.filter((v) => !prev.includes(v)),
      ]),
    );
  }}
>
  …
</ToggleGroup.Root>`}</CodeBlock>
      <p>
        A slow awaited <code>valueChangeAction</code> holds every other transition in the app until
        it settles (
        <a href="/concepts/action-props#await-only">Await only what the UI must wait for</a>); for a
        fire-and-forget save, call <code>void save(next)</code> without awaiting it.
      </p>
    </DocPage>
  );
}
