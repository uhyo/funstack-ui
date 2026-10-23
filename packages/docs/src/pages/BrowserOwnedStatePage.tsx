import { CodeBlock } from "../components/CodeBlock.js";
import { ConceptExample, Terms } from "../components/Concept.js";
import { PageHead } from "../components/PageHead.js";
import { Table } from "../components/Tables.js";

export function BrowserOwnedStatePage() {
  return (
    <div className="learn-content">
      <PageHead
        title="Browser-owned state"
        description="Some state belongs to the browser: the popover top layer, <details open>, dismissing a <dialog>, a native input before React hears about it. FUNSTACK UI observes it instead of driving it."
      />
      <h2>Browser-owned state</h2>
      <p className="page-intro">
        "Transition by default" is about state the library owns. Some state belongs to the browser,
        which changes it before React hears about it. FUNSTACK UI prefers that state whenever the
        platform offers it, because it is the only way a component can work without JavaScript.
      </p>

      <h3 id="terms">Terms</h3>
      <Terms
        items={[
          {
            id: "library-owned",
            term: "Library-owned state",
            definition:
              "State held in React and changed only by the library, inside the [state owner](/concepts/pending-and-optimistic#state-owner)'s transition, after the user acts on a [trigger](/concepts/pending-and-optimistic#trigger).",
          },
          {
            id: "browser-owned",
            term: "Browser-owned state",
            definition:
              "State held in the DOM and changed by the browser itself: whether a `<details>` is open, whether a popover is in the top layer (the layer the browser draws above the whole page), whether a dialog is shown. The library reads it; it does not keep a copy in React state.",
          },
          {
            id: "dismissal",
            term: "Dismissal",
            definition:
              "Closing something without one of its parts: Escape, the Android back gesture, an assistive-technology dismiss, or a click outside (also called light dismiss).",
          },
          {
            id: "invoker-command",
            term: "Invoker command",
            definition:
              "A button's `commandfor` and `command` attributes (Invoker Commands), which make the browser itself open or close a dialog or popover on click, without JavaScript.",
          },
          {
            id: "js-free-mode",
            term: "JS-free mode and library mode",
            definition:
              "Some components can run either way. In **JS-free mode** (no controlled or default state and no change action), the browser owns the state and the library adds no behaviour on the native path. In **library mode** (any of those props), the state is library-owned. See [Two modes](#two-modes).",
          },
        ]}
      />

      <h3>Two kinds of state</h3>
      <Table
        head={["", "Library-owned", "Browser-owned"]}
        rows={[
          [
            "Who changes it",
            "the library, inside its transition",
            "the browser (hover, light dismiss, Escape, find-in-page, a summary click, an invoker command)",
          ],
          [
            "Optimistic state",
            "[`useOptimistic`](/concepts/pending-and-optimistic#optimistic)",
            "the DOM itself",
          ],
          ["Action prop", "awaited; the UI waits for it", "a notification after the fact, or none"],
          ["Styling", "`data-*` attributes", "pseudo-classes: `:popover-open`, `:open`"],
          [
            "Animation",
            "`transition` prop (`<ViewTransition>`)",
            "CSS: `@starting-style`, `transition-behavior: allow-discrete`",
          ],
        ]}
      />
      <p>
        The library never mirrors browser-owned state into React state. It reads the DOM when it
        needs to, and it does not duplicate a pseudo-class with a data attribute. State that nobody
        persists or awaits (whether a hint is showing) is left to the browser entirely, with no prop
        and no action. Each component page says what it leaves to the browser in the{" "}
        <strong>Browser-owned state</strong> row of its{" "}
        <strong>Async and platform behaviour</strong> section.
      </p>
      <ConceptExample component="Tooltip" href="/components/tooltip">
        <p>
          A tooltip's visibility is not application state. The popup is a <code>popover</code> in
          the top layer, so Tooltip has no <code>open</code> prop, no action and no{" "}
          <code>data-open</code>: <code>:popover-open</code> already says it. Style and animate it
          in CSS:
        </p>
        <CodeBlock language="css">{`.tip { opacity: 0; transition: opacity 120ms, display 120ms allow-discrete, overlay 120ms allow-discrete; }
.tip:popover-open {
  opacity: 1;
  @starting-style { opacity: 0; }
}
/* The trigger of an open tooltip: the popup is its next sibling. */
.trigger:has(+ .tip:popover-open) { outline: 1px solid; }`}</CodeBlock>
      </ConceptExample>

      <h3 id="two-modes">Two modes, one anatomy</h3>
      <p>
        Where a native element can do the whole interaction, a component offers both. Without any
        controlled value, default value or change action it runs in{" "}
        <a href="#js-free-mode">JS-free mode</a>: the browser owns the state and nothing runs when
        it changes. Add any of them and it switches to <strong>library mode</strong>: the native
        interaction is intercepted, the state is React state changed in a transition, and triggers
        get optimistic data attributes and <code>data-pending</code>. The parts and the markup are
        the same in both. The mode is decided on the first render; switching between them later is
        not supported (development warning).
      </p>
      <p>
        The browser can still change the state in library mode (find-in-page, a text fragment, a
        click before hydration). The component turns that into a regular dispatch with{" "}
        <code>details.reason === "platform"</code>, and once the action settles it re-applies the
        committed state to the DOM, so a controlled parent that refuses the change gets its state
        back.
      </p>
      <ConceptExample component="Accordion" href="/components/accordion">
        <p>
          An Accordion without <code>value</code>, <code>defaultValue</code> and{" "}
          <code>valueChangeAction</code> leaves every <code>&lt;details open&gt;</code> to the
          browser, and <code>exclusive</code> renders the native <code>name</code> group. With any
          of them, the summary click is intercepted and open state changes in a transition.
        </p>
        <CodeBlock>{`// JS-free: the browser owns open state.
<Accordion.Root exclusive>...</Accordion.Root>

// Library mode: transitions, actions, optimistic state.
<Accordion.Root exclusive defaultValue={null} valueChangeAction={save}>...</Accordion.Root>`}</CodeBlock>
      </ConceptExample>

      <h3>Parts vs dismissals</h3>
      <p>
        For something that opens and closes in library mode, ownership is split by{" "}
        <strong>who asked</strong>. Opening, and a close the user asks one of the component's parts
        for, belong to the library: the click, submit or command is cancelled and dispatched in a
        transition, the action is awaited, a controlled parent can refuse it, and it can animate
        with a view transition. A <a href="#dismissal">dismissal</a> belongs to the browser: the
        element closes natively and at once, the change action is called afterwards as a
        notification with <code>reason: "dismiss"</code>, and a controlled parent that refuses
        cannot keep it open (it can only open it again).
      </p>
      <p>
        The line sits where the platform lets the library cancel a step freely: a part's click
        (which cancels its command), a <code>command</code> event, a form's <code>submit</code>. A
        dismissal goes through a close request instead, whose <code>cancel</code> the browser
        honours only once per user activation, and a user who pressed Escape expects the element to
        go away now. So the library never promises to hold a dismissal.
      </p>
      <ConceptExample component="Dialog" href="/components/dialog">
        <p>
          A library-mode Dialog opens through its Trigger and closes through its Close parts and{" "}
          <code>Dialog.Form</code> after <code>openChangeAction</code> resolves. Escape or a click
          outside closes it at once, and <code>openChangeAction(false, details)</code> follows with{" "}
          <code>reason: "dismiss"</code>; a controlled parent that keeps <code>open</code> gets the
          dialog re-opened once the action settles.
        </p>
      </ConceptExample>

      <h3>Native inputs: the DOM is the optimistic state</h3>
      <p>
        A form control built on a real <code>&lt;input&gt;</code> has library-owned state, but the
        browser flips the input before any JavaScript runs, and after every event react-dom restores
        a controlled input to its current props. Only the synchronous optimistic state has rendered
        by then, so such a control renders the input from the optimistic value. That is a{" "}
        <strong>correctness requirement</strong>: an input driven by committed state would snap back
        right after the click and stay wrong for as long as the action runs. As a consequence the
        native pseudo-class (<code>:checked</code>) and the data attribute agree, and assistive
        technology hears the new state at once.
      </p>
      <ConceptExample component="Switch" href="/components/switch">
        <p>
          A Switch renders <code>{'<input type="checkbox" role="switch">'}</code> with{" "}
          <code>checked={"{optimistic}"}</code>, so <code>:checked</code> and{" "}
          <code>data-checked</code> agree from the click on.
        </p>
      </ConceptExample>
      <p>
        The browser can still change a native input without a click the library sees. Each case is a
        regular dispatch with <code>details.reason === "platform"</code>, and afterwards the DOM
        follows the decision:
      </p>
      <ul>
        <li>
          <strong>Form reset</strong>: a reset button, <code>form.reset()</code>, or React's
          automatic reset after a successful <code>&lt;form action&gt;</code>. Uncontrolled, the
          target is the latest default value; controlled, the browser's mount-time value is offered
          to the parent, which adopts it or not.
        </li>
        <li>
          <strong>Mount reconciliation</strong>: a click before hydration, or Firefox restoring form
          state on reload. React keeps the DOM value when hydrating and fires nothing, so the
          component compares on mount and dispatches once (once per group for a group of inputs).
        </li>
      </ul>

      <h3>Consumer-owned, mirrored state</h3>
      <p>
        A fourth kind of state is <strong>consumer-owned and mirrored</strong>: the parent derives
        it, there is no default and no action, and the library only writes it to the DOM after every
        commit. Where the browser clears it on a click, the library stops writing it while an action
        is pending.
      </p>
      <ConceptExample component="Checkbox" href="/components/checkbox">
        <p>
          <code>indeterminate</code> is derived by a "select all" parent from its rows. The library
          writes the DOM property after every commit and suspends it while an action is pending,
          because the browser clears it on the click.
        </p>
      </ConceptExample>
    </div>
  );
}
