import { CodeBlock } from "../components/CodeBlock.js";
import { Callout, Example } from "../components/Example.js";
import { PageHead } from "../components/PageHead.js";
import { Table } from "../components/Tables.js";
import { TabsSaved } from "../examples/TabsSaved.js";
import tabsSavedSource from "../examples/TabsSaved.tsx?raw";
import tabsCss from "../examples/tabs.css?raw";

export function PendingOptimisticPage() {
  return (
    <div className="learn-content">
      <PageHead
        title="Pending & optimistic state"
        description="Triggers render optimistic state, content regions render committed state, and data-pending marks an action in flight."
      />
      <h2>Pending & optimistic state</h2>
      <p className="page-intro">
        Every component that owns state keeps three values. Knowing which part shows which one is
        the key to styling FUNSTACK UI.
      </p>

      <h3>Three values</h3>
      <Table
        head={["Value", "Source", "Shown by"]}
        rows={[
          [
            "**committed**",
            "the controlled prop, or internal state written after the action succeeds",
            "content regions: `Tabs.Panel`, `Accordion.Panel`, the `<details open>` attribute",
          ],
          [
            "**optimistic**",
            "`useOptimistic` over the committed value",
            "triggers: `Toggle`, `Tabs.Tab`, `Tabs.Indicator`, `Accordion.Trigger` and `Item` (`aria-pressed`, `aria-selected`, `data-selected`, `data-open`)",
          ],
          [
            "**pending**",
            "the owner's `useTransition`",
            "`data-pending` on the owner and on the trigger the user acted on",
          ],
        ]}
      />

      <h3>Triggers are optimistic, content is committed</h3>
      <p>
        This rule follows from how React works, not from taste. An optimistic update renders
        synchronously, and a synchronous render that suspends shows the nearest Suspense fallback.
        If a panel followed the optimistic value, selecting a tab whose panel loads data would flash
        a fallback. Because panels follow the committed value, the old panel stays on screen while
        the new one loads, the tab is already selected, and both the tab and the root carry{" "}
        <code>data-pending</code>. When the data is ready, the panel swaps.
      </p>
      <p>
        Try the tabs below: switching waits for an 800 ms save. The indicator and the tab colour
        move at once (optimistic); the panel changes when the save resolves (committed). Every third
        save fails and everything rolls back.
      </p>
      <Example
        source={tabsSavedSource}
        fileName="TabsSaved.tsx"
        css={tabsCss}
        cssFileName="tabs.css"
      >
        <TabsSaved />
      </Example>
      <p>Two consequences for triggers:</p>
      <ul>
        <li>
          Content rendered from a trigger's state (its <code>children</code> function) must not
          suspend, or must have its own Suspense boundary.
        </li>
        <li>
          The optimistic flip is a synchronous commit and never starts a view transition. Animate
          trigger visuals with a CSS <code>transition</code> on the data attribute.
        </li>
      </ul>

      <h3>
        Where <code>data-pending</code> lands
      </h3>
      <ul>
        <li>
          <strong>The owner</strong> (<code>Toggle</code>, <code>Tabs.Root</code>,{" "}
          <code>Accordion.Root</code>) while its transition is pending.
        </li>
        <li>
          <strong>The trigger the user is waiting on</strong>: the Toggle itself; the Tab that is
          the optimistic selection; the Accordion Item and Trigger whose open state is changing.{" "}
          <code>Tabs.Indicator</code> also mirrors the Root's pending state.
        </li>
        <li>
          <strong>Never on panels.</strong> A panel is either the committed one or not. To dim the
          old panel while the next one loads, select through the root:
        </li>
      </ul>
      <CodeBlock language="css">{`.tabs[data-pending] .panel { opacity: 0.6; transition: opacity 150ms 150ms; }
.tab[data-pending]::after { content: ""; /* spinner */ }`}</CodeBlock>
      <p>
        The same names exist in the function props: <code>state.pending</code>,{" "}
        <code>state.pressed</code>, <code>state.selected</code>, <code>state.open</code>.
      </p>
      <CodeBlock>{`<Tabs.Tab value="billing">
  {({ pending }) => <>Billing{pending && <Spinner />}</>}
</Tabs.Tab>`}</CodeBlock>

      <h3>A second click while pending</h3>
      <p>
        Parts that own state take every click: a second click on a pending Toggle, Tab or Checkbox
        is a new intent, the optimistic value follows it, and the latest intent wins. Pure triggers,
        buttons whose action has no state of their own (<code>Button</code>,{" "}
        <code>Dialog.Close</code>, <code>Popover.Close</code>, <code>Menu.Item</code>,{" "}
        <code>Toast.Action</code>), ignore a second click, Enter or Space while their own action is
        pending, and render <code>aria-disabled="true"</code> for as long as they show{" "}
        <code>data-pending</code>. They are never natively disabled, so focus stays on them. For a
        button that should count every click (a "+1"), do not return the promise:{" "}
        <code>{"action={() => { void increment(); }}"}</code>.
      </p>

      <h3>Rollback</h3>
      <p>
        If the action rejects, or a controlled parent does not adopt the new value, the optimistic
        value falls back to the committed one when the transition ends. Nothing has to be undone by
        hand: uncontrolled state is only written after success.
      </p>
      <Callout title="Assistive technology hears optimistic state too, mostly">
        <p>
          <code>aria-pressed</code> and <code>aria-selected</code> follow the optimistic value, so
          screen reader users get the same immediate feedback. The exception is Accordion: HTML
          forbids <code>aria-expanded</code> on a <code>&lt;summary&gt;</code>, so the expanded
          state assistive technology hears is the committed one, and <code>data-open</code> is
          visual only.
        </p>
      </Callout>
    </div>
  );
}
