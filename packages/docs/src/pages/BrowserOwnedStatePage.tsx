import { CodeBlock } from "../components/CodeBlock.js";
import { PageHead } from "../components/PageHead.js";
import { Table } from "../components/Tables.js";

export function BrowserOwnedStatePage() {
  return (
    <div className="learn-content">
      <PageHead
        title="Browser-owned state"
        description="Some state belongs to the browser: the popover top layer, <details open>. FUNSTACK UI observes it instead of driving it."
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
            "Toggle `pressed`, Tabs `value`, Accordion `value` in library mode",
            "Tooltip open state (top layer), `<details open>` in Accordion's JS-free mode",
          ],
          [
            "Who changes it",
            "the library, inside its transition",
            "the browser (hover, light dismiss, find-in-page, a summary click)",
          ],
          ["Optimistic state", "`useOptimistic`", "the DOM itself"],
          ["Action prop", "awaited; the UI waits for it", "none in the current components"],
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
    </div>
  );
}
