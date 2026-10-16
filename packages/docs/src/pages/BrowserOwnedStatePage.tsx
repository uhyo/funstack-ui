import { CodeBlock } from "../components/CodeBlock.js";
import { PageHead } from "../components/PageHead.js";
import { Table } from "../components/Tables.js";

export function BrowserOwnedStatePage() {
  return (
    <div className="learn-content">
      <PageHead
        title="Browser-owned state"
        description="Some state belongs to the browser: the popover top layer, <details open>, closing a <dialog>, a native input before React hears about it. FUNSTACK UI observes it instead of driving it."
      />
      <h2>Browser-owned state</h2>
      <p className="page-intro">
        "Transition by default" is about state the library owns. Some state belongs to the browser,
        which changes it before React hears about it. FUNSTACK UI prefers that state whenever the
        platform offers it, because it is the only way a component can work without JavaScript.
      </p>

      <h3>Two kinds of state</h3>
      <Table
        head={["", "Library-owned", "Browser-owned"]}
        rows={[
          [
            "Examples",
            "Toggle `pressed`, Tabs `value`, Accordion `value` in library mode, Switch and Checkbox `checked`, RadioGroup `value`, opening a Dialog in library mode",
            "Tooltip open state (top layer), `<details open>` in Accordion's JS-free mode, a Dialog in JS-free mode, closing any Dialog",
          ],
          [
            "Who changes it",
            "the library, inside its transition",
            "the browser (hover, light dismiss, Escape, find-in-page, a summary click, an invoker command)",
          ],
          ["Optimistic state", "`useOptimistic`", "the DOM itself"],
          [
            "Action prop",
            "awaited; the UI waits for it",
            "a notification after the fact (Dialog's `openChangeAction(false)`), or none",
          ],
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
        needs to, and it does not duplicate a pseudo-class with a data attribute: there is no{" "}
        <code>data-open</code> on a tooltip, because <code>:popover-open</code> already says it.
      </p>

      <h3>Tooltip</h3>
      <p>
        A tooltip's visibility is not application state: nobody persists it or awaits it. The popup
        is a <code>popover</code> in the top layer, so Tooltip has no <code>open</code> prop and no
        action. Style and animate it in CSS:
      </p>
      <CodeBlock language="css">{`.tip { opacity: 0; transition: opacity 120ms, display 120ms allow-discrete, overlay 120ms allow-discrete; }
.tip:popover-open {
  opacity: 1;
  @starting-style { opacity: 0; }
}
/* The trigger of an open tooltip: the popup is its next sibling. */
.trigger:has(+ .tip:popover-open) { outline: 1px solid; }`}</CodeBlock>

      <h3>Accordion: two modes, one anatomy</h3>
      <p>
        An Accordion without <code>value</code>, <code>defaultValue</code> and{" "}
        <code>valueChangeAction</code> runs in <strong>JS-free mode</strong>: the browser owns every{" "}
        <code>&lt;details open&gt;</code>, nothing runs on toggle, and <code>exclusive</code>{" "}
        renders the native <code>name</code> group. Add any of the three and it switches to{" "}
        <strong>library mode</strong>: the summary click is intercepted, open state is React state
        changed in a transition, and triggers get optimistic <code>data-open</code> and{" "}
        <code>data-pending</code>.
      </p>
      <CodeBlock>{`// JS-free: the browser owns open state.
<Accordion.Root exclusive>...</Accordion.Root>

// Library mode: transitions, actions, optimistic state.
<Accordion.Root exclusive defaultValue={null} valueChangeAction={save}>...</Accordion.Root>`}</CodeBlock>
      <p>
        The browser can still open a closed item in library mode (find-in-page, a text fragment, a
        click before hydration). The Accordion turns that into a regular dispatch with{" "}
        <code>details.reason === "platform"</code>, and once the action settles it re-applies the
        committed state to the DOM, so a controlled parent that refuses the change closes the item
        again. Tabs does the same for panels with <code>keepMounted="until-found"</code>.
      </p>
      <p>
        The mode is decided on the first render; switching between them later is not supported
        (development warning).
      </p>

      <h3>Dialog: library-owned open, browser-owned close</h3>
      <p>
        Dialog has the same two modes as Accordion. Without <code>open</code>,{" "}
        <code>defaultOpen</code> and <code>openChangeAction</code> the browser owns everything
        through Invoker Commands (<code>command="show-modal"</code>,{" "}
        <code>command="request-close"</code>, <code>&lt;form method="dialog"&gt;</code>). With any
        of them, ownership is split by direction:
      </p>
      <Table
        head={["", "Opening", "Closing"]}
        rows={[
          ["Owner", "the library", "the browser"],
          [
            "How",
            "the Trigger's click is cancelled and dispatched in the Root's transition; `showModal()` runs in the commit that mounts the content",
            "Escape, Android back, a click outside, a Close button or a form submit close the dialog natively and at once",
          ],
          [
            "`openChangeAction`",
            "`(true, details)`, awaited: the dialog opens when it resolves and the content has rendered",
            '`(false, details)`, a notification: `reason` is `"dismiss"` or `"activate"`, `returnValue` says which button',
          ],
          [
            "Pending",
            "the Trigger shows `data-pending` until the dialog opens",
            "the Trigger shows `data-pending` while the notification runs",
          ],
          [
            "A controlled parent that refuses",
            "a veto: the dialog never opens",
            "not a veto: the dialog is re-opened once the action settles",
          ],
        ]}
      />
      <p>
        Closing stays with the browser on purpose: close requests can be cancelled only once per
        user activation, a <code>method="dialog"</code> submit cannot be cancelled at all, and a
        user who pressed Escape expects the dialog to go away now. See{" "}
        <a href="/components/dialog">Dialog</a>.
      </p>

      <h3>Native inputs: the DOM is the optimistic state</h3>
      <p>
        Switch, Checkbox and RadioGroup render real <code>&lt;input&gt;</code> elements whose{" "}
        <code>checked</code> is library-owned. The browser flips the input before any JavaScript
        runs, and after every event react-dom restores a controlled input to its current props. Only
        the synchronous optimistic state has rendered by then, so these components render{" "}
        <code>checked={"{optimistic}"}</code>. That is a <strong>correctness requirement</strong>:
        an input driven by committed state would snap back right after the click and stay wrong for
        as long as the action runs. As a consequence <code>:checked</code> and{" "}
        <code>data-checked</code> agree, and assistive technology hears the new state at once.
      </p>
      <p>
        The browser can still change a native input without a click the library sees. Each case is a
        regular dispatch with <code>details.reason === "platform"</code>, and afterwards the DOM
        follows the decision:
      </p>
      <ul>
        <li>
          <strong>Form reset</strong>: a reset button, <code>form.reset()</code>, or React's
          automatic reset after a successful <code>&lt;form action&gt;</code>. Uncontrolled, the
          target is the latest <code>defaultChecked</code> / <code>defaultValue</code>; controlled,
          the browser's mount-time value is offered to the parent, which adopts it or not.
        </li>
        <li>
          <strong>Mount reconciliation</strong>: a click before hydration, or Firefox restoring form
          state on reload. React keeps the DOM value when hydrating and fires nothing, so the
          component compares on mount and dispatches once (once per group for RadioGroup).
        </li>
      </ul>
      <p>
        A fourth kind of state is <strong>consumer-owned and mirrored</strong>: Checkbox's{" "}
        <code>indeterminate</code> is derived by the parent, has no default and no action, and the
        library only writes it to the DOM property after every commit. It is suspended while an
        action is pending, because the browser clears it on the click.
      </p>
    </div>
  );
}
