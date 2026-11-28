import { CodeBlock } from "../components/CodeBlock.js";
import { ConceptExample, Terms } from "../components/Concept.js";
import { Example } from "../components/Example.js";
import { DocPage } from "../components/DocPage.js";
import { TabsSaved } from "../examples/TabsSaved.js";

export function PendingOptimisticPage() {
  return (
    <DocPage
      title="Pending & optimistic state"
      description="A state owner keeps a committed, an optimistic and a pending value. Triggers render the optimistic value, content regions the committed one, and data-pending marks an action in flight."
    >
      <p className="page-intro">
        Every component that owns state keeps three values for it. Knowing which part of the
        component shows which value is the key to styling FUNSTACK UI.
      </p>

      <h3 id="terms">Terms</h3>
      <p>
        These words are used throughout the documentation. A{" "}
        <a href="/getting-started#part">part</a> is one element-rendering piece of a component, such
        as <code>Tabs.Tab</code>.
      </p>
      <Terms
        items={[
          {
            id: "state-owner",
            term: "State owner",
            definition:
              "The part that holds a piece of state, runs its [action](/concepts/action-props#action) in a transition and decides when the state is committed. For a compound component it is usually the `Root`; a single-element component (a Toggle, a Switch) owns its own state.",
          },
          {
            id: "trigger",
            term: "Trigger",
            definition:
              "A part the user acts on to change the state: a button, a tab, a summary, a checkbox. Some components have a part literally named `Trigger`; the concept is wider than that name.",
          },
          {
            id: "pure-trigger",
            term: "Pure trigger",
            definition:
              "A trigger whose action changes no state of its own: it runs a task (save, close, confirm). See [A second click while pending](#second-click).",
          },
          {
            id: "content-region",
            term: "Content region (panel)",
            definition:
              "A part that shows the content belonging to a state rather than letting the user change it: the content of the selected tab, of an open accordion item, of an open dialog. The docs call it a **panel** when the part is named `Panel`.",
          },
          {
            id: "committed",
            term: "Committed value",
            definition:
              "The value the application has accepted: the controlled prop, or, uncontrolled, the internal state written after the action succeeded.",
          },
          {
            id: "optimistic",
            term: "Optimistic value",
            definition:
              "The value the user asked for, shown before the action has finished. It is React's `useOptimistic` over the committed value, set at the start of the action.",
          },
          {
            id: "pending",
            term: "Pending",
            definition:
              "True while an action dispatched through a component is in flight, from the user's interaction until the render that ends it has committed (including a Suspense wait). It is the pending flag of the transition that runs the action: the state owner's, or a pure trigger's own. Field and Form read the form channel (`useFormStatus`) instead.",
          },
          {
            id: "rollback",
            term: "Rollback",
            definition:
              "The optimistic value falling back to the committed one when the action ends without the new value being committed (it rejected, or a controlled parent did not adopt it).",
          },
        ]}
      />

      <h3>Triggers are optimistic, content is committed</h3>
      <p>
        Triggers render the optimistic value, so the user sees their click land at once. Content
        regions render the committed value. This rule follows from how React works, not from taste.
        An optimistic update renders synchronously, and a synchronous render that suspends shows the
        nearest Suspense fallback. If a content region followed the optimistic value, choosing
        content that loads data would flash a fallback. Because content regions follow the committed
        value, the old content stays on screen while the new one loads, the trigger already shows
        the new choice, and the state owner and the trigger are marked pending. When the data is
        ready, the content swaps in one commit.
      </p>
      <ConceptExample component="Tabs" href="/components/tabs">
        <p>
          In Tabs, <code>Tabs.Tab</code> and <code>Tabs.Indicator</code> are triggers and show the
          optimistic selection (<code>aria-selected</code>, <code>data-selected</code>);{" "}
          <code>Tabs.Panel</code> is the content region and shows the committed selection;{" "}
          <code>Tabs.Root</code> is the state owner. In the tabs below, switching waits for an 800
          ms save. The indicator and the tab colour move at once (optimistic); the panel changes
          when the save resolves (committed). Every third save fails and everything rolls back.
        </p>
        <Example file="TabsSaved.tsx" css="tabs.css">
          <TabsSaved />
        </Example>
      </ConceptExample>
      <p>Two consequences for triggers:</p>
      <ul>
        <li>
          Content rendered from a trigger's state (its <code>children</code> function) must not
          suspend, or must have its own Suspense boundary.
        </li>
        <li>
          The optimistic flip is a synchronous commit and never starts a view transition. Animate
          trigger visuals with a CSS <code>transition</code> on the data attribute (see{" "}
          <a href="/concepts/transitions#what-animates-when">What animates when</a>).
        </li>
      </ul>
      <p>
        Each component page lists which of its parts show which value in its{" "}
        <strong>Optimistic and pending</strong> section and its data attributes table.
      </p>

      <h3>
        Where <code>data-pending</code> lands
      </h3>
      <ul>
        <li>
          <strong>On the state owner</strong> while its transition is pending.
        </li>
        <li>
          <strong>On the trigger the user is waiting on</strong>: the one whose optimistic value
          differs from the committed one, or that started the action. Decorative parts that follow
          the trigger (an indicator) may mirror it.
        </li>
        <li>
          <strong>On a part that asked its owner to close</strong> (a <code>Dialog.Close</code>,{" "}
          <code>Popover.Close</code>, <code>Drawer.Close</code>, an AlertDialog Cancel or Action, a
          closing <code>Menu.Item</code>): from the click until that close has committed, with or
          without an <code>action</code> of its own. The Trigger may be out of sight under a modal
          backdrop. Without an <code>action</code> the part is never <code>aria-disabled</code>:
          nothing of its own is ignored.
        </li>
        <li>
          <strong>Never on content regions.</strong> A content region shows the committed value or
          nothing; it is never "in between". To dim the old content while the next one loads, select
          through the state owner.
        </li>
        <li>
          <strong>Never for a fact.</strong> A <a href="/concepts/action-props#fact">fact</a>, a
          change that had already happened when the library heard of it (a popup dismissed with
          Escape or a click outside), is reported to an <code>on*</code> handler and is not awaited,
          so nothing is pending for it: the popup, <code>data-open</code> and the committed state
          all change at once (
          <a href="/concepts/browser-owned-state#requests-and-facts">Requests and facts</a>).
        </li>
      </ul>
      <p>
        The same names exist in the function props (<code>className</code>, <code>style</code>,{" "}
        <code>children</code> as a function of state): <code>state.pending</code>, and the state's
        own name such as <code>state.pressed</code>, <code>state.selected</code> or{" "}
        <code>state.open</code>.
      </p>
      <ConceptExample component="Tabs" href="/components/tabs">
        <p>
          <code>data-pending</code> is on <code>Tabs.Root</code> and on the <code>Tabs.Tab</code>{" "}
          that is the optimistic selection; <code>Tabs.Indicator</code> mirrors the Root. The panels
          never get it, so the CSS selects through the Root:
        </p>
        <CodeBlock language="css">{`.tabs[data-pending] .panel { opacity: 0.6; transition: opacity 150ms 150ms; }
.tab[data-pending]::after { content: ""; /* spinner */ }`}</CodeBlock>
        <CodeBlock>{`<Tabs.Tab value="billing">
  {({ pending }) => <>Billing{pending && <Spinner />}</>}
</Tabs.Tab>`}</CodeBlock>
      </ConceptExample>

      <h3 id="second-click">A second click while pending</h3>
      <p>
        A trigger that changes state takes every click: a second click on a pending trigger is a new
        intent, the optimistic value follows it, and the latest intent wins (see{" "}
        <a href="/concepts/action-props#overlapping-actions">Overlapping actions</a>). A{" "}
        <a href="#pure-trigger">pure trigger</a> has no value to protect, so what a second click,
        Enter or Space does while its own action is pending is its <code>whilePending</code> prop:
      </p>
      <ul>
        <li>
          <code>"run"</code>: the activation runs the action again, in the same transition. The part
          shows <code>data-pending</code> until every run has settled, and is not{" "}
          <code>aria-disabled</code>: it still acts.
        </li>
        <li>
          <code>"ignore"</code>: the activation starts nothing and its default action (a link's
          navigation, a form submission, a command) is cancelled. The part renders{" "}
          <code>aria-disabled="true"</code> for as long as it shows <code>data-pending</code>, so a
          screen-reader user who presses again hears that it is unavailable.
        </li>
      </ul>
      <p>
        The default follows <strong>who owns the action</strong>. Where the action is yours alone (a{" "}
        <code>Button</code>), every click runs, as with React's own <code>useTransition</code>: only
        you know whether two overlapping runs are a bug (Save) or the point (a counter). Where the
        library acts after your action (a <code>Dialog.Close</code> or <code>Popover.Close</code>{" "}
        closes its overlay, a <code>Menu.Item</code> closes its menu, a <code>Toast.Action</code>{" "}
        closes its toast), a second activation is ignored: the first one already ends in that close.
        Switch the library's close off (<code>{"closeOnActivate={false}"}</code>) and the item or
        action becomes yours, so it runs every activation again. Either way the prop overrides the
        default, and no part is ever natively disabled, so focus stays where it is. A closing part
        in <code>"run"</code> mode closes once, when its last run has settled, and only if the
        latest run resolved: a rejection leaves the overlay, menu or toast open, as it does in{" "}
        <code>"ignore"</code> mode.
      </p>
      <ConceptExample component="Button" href="/components/button">
        <p>
          A counter wants every click; a Save must not run twice. Opt the Save in to{" "}
          <code>"ignore"</code>:
        </p>
        <CodeBlock>{`<Button action={async () => { await incrementOnServer(); }}>+1</Button>  // every click runs
<Button action={save} whilePending="ignore">Save</Button>                // one save at a time`}</CodeBlock>
        <p>
          In <code>"run"</code> mode the runs overlap, and their errors follow{" "}
          <a href="/concepts/action-props#overlapping-actions">the usual rule</a>: the latest run's
          rejection reaches the Error Boundary, an older run's goes to <code>reportError</code>. For
          runs that must happen one after another, each seeing the previous result, use{" "}
          <code>useActionState</code> and call its dispatch from the action.
        </p>
      </ConceptExample>

      <h3>Rollback</h3>
      <p>
        If the action rejects, or a controlled parent does not adopt the new value, the optimistic
        value falls back to the committed one when the transition ends. Nothing has to be undone by
        hand: uncontrolled state is only written after success.
      </p>

      <h3>Assistive technology</h3>
      <p>
        ARIA state on a trigger (<code>aria-pressed</code>, <code>aria-selected</code>, a native
        input's checked state) follows the optimistic value, so screen reader users get the same
        immediate feedback as sighted users. Where HTML gives the state to a native element that
        cannot carry the ARIA attribute, assistive technology hears the committed state and the
        optimistic data attribute is visual only; the component page says so when that applies (for
        example <a href="/components/accordion">Accordion</a>). The same holds for the trigger of a
        popup and for the Combobox input: assistive technology hears whether the popup is shown, and{" "}
        <code>data-open</code> is the optimistic state (see{" "}
        <a href="/concepts/browser-owned-state#popup-triggers">Triggers of a popup</a>).
      </p>
    </DocPage>
  );
}
