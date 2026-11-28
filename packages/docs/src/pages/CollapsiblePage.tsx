import { CodeBlock } from "../components/CodeBlock.js";
import { Callout } from "../components/Callout.js";
import { Example } from "../components/Example.js";
import { BehaviourIndex, BehaviourSection } from "../components/Concept.js";
import { DocPage } from "../components/DocPage.js";
import { PartFacts, PropsTable, Table } from "../components/Tables.js";
import { CollapsibleFilters } from "../examples/CollapsibleFilters.js";
import { CollapsibleReplies } from "../examples/CollapsibleReplies.js";
import { CollapsibleSpoiler } from "../examples/CollapsibleSpoiler.js";
import { functionProps, renderProp } from "./shared-props.js";

export function CollapsiblePage() {
  return (
    <DocPage
      title="Collapsible"
      description="One disclosure built on <details>/<summary>: no JavaScript when you need no state; actions, optimistic data-open and Suspense-friendly content when you do."
    >
      <p className="page-intro">
        One show/hide region: the Root <em>is</em> the <code>&lt;details&gt;</code> and the Trigger
        its <code>&lt;summary&gt;</code>. Without open props its behaviour needs no JavaScript (the
        parts still ship as client modules; see{" "}
        <a href="/concepts/server-components">Server Components</a>); with them it becomes a regular{" "}
        <a href="/concepts/pending-and-optimistic#state-owner">state owner</a> with actions,
        optimistic <code>data-open</code> and lazily mounted content. For a set of disclosures with
        arrow-key navigation or one-open-at-a-time, use{" "}
        <a href="/components/accordion">Accordion</a>.
      </p>

      <Example file="CollapsibleSpoiler.tsx" css="collapsible.css">
        <CollapsibleSpoiler />
      </Example>

      <BehaviourIndex />

      <h3 id="anatomy">Anatomy</h3>
      <CodeBlock>{`import { Collapsible } from "@funstack/ui/collapsible";

<Collapsible.Root>          {/* details: state and the transition */}
  <Collapsible.Trigger>     {/* summary: must be the Root's first child */}
    Advanced options
  </Collapsible.Trigger>
  <Collapsible.Panel>       {/* div: the content */}
    ...
  </Collapsible.Panel>
</Collapsible.Root>`}</CodeBlock>
      <p>
        There is one Trigger and it must be the first child of the Root: that is where the platform
        puts a <code>&lt;summary&gt;</code>. A Trigger placed after the content or outside the Root
        is not possible; drive the Collapsible from elsewhere with controlled <code>open</code>{" "}
        instead (<a href="#recipes">recipe</a>). A heading may go inside the Trigger. If you use{" "}
        <code>render</code>, the Root must still render a <code>&lt;details&gt;</code> and the
        Trigger a <code>&lt;summary&gt;</code> (development warning otherwise).
      </p>

      <h3 id="how-it-works">How it works</h3>
      <h4>Two modes</h4>
      <Table
        head={["", "JS-free mode", "Library mode"]}
        rows={[
          [
            "Selected when",
            "Root has none of `open`, `defaultOpen`, `openChangeAction`",
            "Root has any of them (`defaultOpen={false}` included)",
          ],
          ["Open state owner", "the browser", "React (committed state)"],
          ["Initial open", "closed", "`defaultOpen` / `open`"],
          [
            "`data-open`, `data-pending`",
            "not emitted; style with `:open`",
            "emitted (optimistic)",
          ],
          ["Works before hydration", "yes, fully", "yes; reconciled on mount"],
          [
            "`transition` (Root, Panel)",
            "no effect (development warning)",
            "animates the commit that ends an action",
          ],
          ["`state.open`", "`false` (React holds no value)", "optimistic (Panel: committed)"],
        ]}
      />
      <p>
        A Collapsible that starts open is in library mode: <code>defaultOpen</code> selects it. The
        HTML is the same <code>&lt;details open&gt;</code> and it toggles natively before hydration;
        after hydration the toggle runs through the Root's transition, which with no action commits
        at once. See <a href="/concepts/browser-owned-state">Browser-owned state</a> for the
        reasoning. Switching modes after mount is not supported.
      </p>

      <h3 id="props">Props</h3>
      <h4>
        <code>Collapsible.Root</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "open",
            type: "boolean",
            description:
              "Controlled open state. undefined means uncontrolled. Selects library mode.",
          },
          {
            name: "defaultOpen",
            type: "boolean",
            default: "none (JS-free mode)",
            description:
              "Initial open state, uncontrolled; read once. Its presence selects library mode, false included. Library mode without it (open or openChangeAction only) starts closed, as false.",
          },
          {
            name: "openChangeAction",
            type: "ChangeAction<boolean, CollapsibleOpenChangeDetails>",
            description: (
              <>
                Called with the next open state on every change, inside the Root's transition. Sync,
                async or a Server Function. <code>details.reason</code> (a <code>ChangeReason</code>
                ) is <code>"activate"</code> for the Trigger, or <code>"platform"</code> when the
                browser opened or closed the <code>&lt;details&gt;</code> itself. There is no{" "}
                <code>onOpenChange</code>: every change is a request. Selects library mode.
              </>
            ),
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description:
              'The Trigger gets aria-disabled="true" and never toggles. Enforced by a click handler, so in JS-free mode it does not hold before hydration.',
          },
          {
            name: "experimental_interpolateSize",
            type: "boolean",
            default: "false",
            description: (
              <>
                Sets <code>interpolate-size: allow-keywords</code> on the{" "}
                <code>&lt;details&gt;</code> so <code>::details-content</code> can transition{" "}
                <code>height</code> to <code>auto</code>. Chromium only today; merged under your{" "}
                <code>style</code>. Both modes.
              </>
            ),
          },
          {
            name: "transition",
            type: "ViewTransitionClass",
            description:
              "Library mode only. Forwarded to the <ViewTransition> around the <details>; animates the open/close commit.",
          },
          ...functionProps(
            "CollapsibleRootState",
            "Content, or a function of the Root's state. The Trigger must come first.",
          ),
          renderProp("details", "CollapsibleRootState"),
        ]}
      />
      <PartFacts
        state={
          "`CollapsibleRootState` is `{ open, pending, disabled }`; `open` is optimistic, and `false` in JS-free mode (the browser owns it and React holds no value; style with `:open`)."
        }
        owned={
          "`open`, `name`, `suppressHydrationWarning`, `data-open`, `data-pending`, `data-disabled`, and `onToggle` in library mode."
        }
      />

      <h4>
        <code>Collapsible.Trigger</code>
      </h4>
      <PropsTable
        rows={[
          ...functionProps(
            "CollapsibleTriggerState",
            "Rendered from optimistic state; must not suspend.",
          ),
          renderProp("summary", "CollapsibleTriggerState"),
        ]}
      />
      <PartFacts
        state={"`CollapsibleTriggerState` is the Root's state."}
        owned={
          "`aria-disabled`, `data-open`, `data-pending`, `data-disabled`, and `onClick` in library mode (and when disabled)."
        }
        note={
          "No `disabled` prop: the Root carries it, and `aria-disabled` is owned. No `transition` prop: everything the Trigger renders is optimistic, and the Root's boundary covers it; animate `data-open` with CSS. Links and form controls inside the summary keep their own behaviour and do not toggle."
        }
      />

      <h4>
        <code>Collapsible.Panel</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "transition",
            type: "ViewTransitionClass",
            description:
              "Library mode only. Animates content that mounts or changes in the commit that ends an action.",
          },
          ...functionProps(
            "CollapsiblePanelState",
            "Always mounted. The function form receives committed open: use it to mount content lazily (library mode).",
          ),
          renderProp("div", "CollapsiblePanelState"),
        ]}
      />
      <PartFacts
        state={
          "`CollapsiblePanelState` is `{ open, disabled }`; `open` is committed (`false` in JS-free mode)."
        }
        owned={"`data-disabled`."}
        note={
          "No `keepMounted`: closed content is always in the DOM, which keeps it searchable. No `data-open` either: select `details:open > .panel`."
        }
      />

      <h3 id="data-attributes">Data attributes</h3>
      <Table
        head={["Attribute", "On", "Meaning"]}
        rows={[
          ["`:open`", "Root (`details`)", "Committed open state, both modes."],
          ["`data-open`", "Root, Trigger", "Optimistic open state (library mode only)."],
          ["`data-pending`", "Root, Trigger", "Library mode: an action is in flight."],
          ["`data-disabled`", "Root, Trigger, Panel", "The Root's `disabled` prop."],
          ["`aria-disabled`", "Trigger", '`"true"` when disabled.'],
          ["`::details-content`", "Root", "The native content slot: animate it."],
        ]}
      />
      <CodeBlock language="css">{`.c > summary { list-style: none; }                /* hide the UA marker */
.c > summary::-webkit-details-marker { display: none; }
.c > summary::before { content: "▸"; }
.c:open > summary:not([data-pending])::before,
.c > summary[data-open]::before { content: "▾"; }   /* flips at once in library mode */

/* Open/close animation, every engine, both modes */
.c::details-content {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 200ms ease, content-visibility 200ms allow-discrete;
}
.c:open::details-content { grid-template-rows: 1fr; }
.c > .panel { min-height: 0; overflow: hidden; }

@media (prefers-reduced-motion: reduce) {
  .c::details-content { transition: none; }
}`}</CodeBlock>

      <h3 id="keyboard-and-aria">Keyboard and ARIA</h3>
      <Table
        head={["Key", "Where", "Behaviour"]}
        rows={[
          ["Enter / Space", "Trigger", "Toggles (native)."],
          ["Tab / Shift+Tab", "anywhere", "The Trigger is a Tab stop; closed content is skipped."],
        ]}
      />
      <ul>
        <li>
          The <code>&lt;details&gt;</code> is a group and the summary the engine's disclosure
          control, with its expanded state from <code>open</code>. No <code>aria-*</code> is added
          except <code>aria-disabled</code>.
        </li>
        <li>
          HTML forbids <code>aria-expanded</code> on a summary, so assistive technology hears the
          committed state; <code>data-open</code> is visual only. For an audible pending state,
          render an <code>aria-live</code> region from the Trigger's state.
        </li>
        <li>
          The accessible name is the Trigger's content; a label that changes ("Show replies" / "Hide
          replies") is announced through the name, on top of the expanded state.
        </li>
        <li>A disabled Trigger stays focusable. Focus never moves on open or close.</li>
      </ul>

      <BehaviourSection
        id="transition-types"
        summary={
          "Library mode: `fsui-collapsible` plus `fsui-collapsible-open` or `fsui-collapsible-close`, the kinds of every open state in the library. JS-free mode starts no transitions."
        }
      />

      <BehaviourSection
        id="optimistic-and-pending"
        summary={
          "Library mode: the Root and Trigger show the optimistic open state (`data-open`) and `data-pending` while an action is in flight. The `<details>` element (`:open`, and what assistive technology hears) and the Panel's function child follow the committed state. A second click while pending reverses the first; `data-pending` stays until both actions have settled. JS-free mode has no optimistic or pending state."
        }
      >
        <h4 id="async-walkthrough">Walkthrough (async action)</h4>
        <Example file="CollapsibleFilters.tsx" css="collapsible.css">
          <CollapsibleFilters />
        </Example>
        <ol>
          <li>
            Click the Trigger: the click is intercepted, the chevron flips (<code>data-open</code>),
            the Root and Trigger get <code>data-pending</code>, and{" "}
            <code>openChangeAction(true, {'{ reason: "activate" }'})</code> runs.
          </li>
          <li>
            The save resolves: the <code>&lt;details&gt;</code> opens (committed state) and{" "}
            <code>data-pending</code> goes.
          </li>
          <li>
            If the action rejects, <code>data-open</code> reverts, the content never opens, and the
            error goes to the nearest Error Boundary.
          </li>
        </ol>
        <Callout title="Find-in-page in library mode">
          <p>
            The browser opens a closed Collapsible when find-in-page or a text fragment matches its
            content. That is dispatched as <code>reason: "platform"</code> with the{" "}
            <code>toggle</code> event; the content stays visible while the action runs. If a
            controlled parent does not adopt the change, it is closed again when the action settles;
            a rejection goes to the nearest Error Boundary. A disabled Collapsible is re-closed
            without dispatching. A reveal while a close is pending is dispatched too; a match in
            content that is still open while its close is pending changes nothing the browser
            reports, so the close commits and hides it.
          </p>
        </Callout>
      </BehaviourSection>

      <BehaviourSection
        id="suspense"
        summary={
          "The Panel is always mounted; its function child receives the committed `open`, which is how you mount content lazily (library mode: `defaultOpen={false}` is enough). If that content suspends, the `<details>` stays closed with the Trigger pending until the content is ready, then opens. Trigger content must not suspend."
        }
      >
        <Example file="CollapsibleReplies.tsx" css="collapsible.css">
          <CollapsibleReplies />
        </Example>
      </BehaviourSection>

      <BehaviourSection
        id="browser-owned-state"
        summary={
          'JS-free mode: the browser owns `<details open>`; style with `:open` and animate with `::details-content`. Library mode: open state is library-owned, but the browser can still open or close the `<details>` (find-in-page, a text fragment, a click before hydration). That is dispatched with `reason: "platform"`, and the committed state is re-applied once the action settles.'
        }
      />

      <BehaviourSection
        id="before-hydration"
        summary={
          'JS-free mode: everything: open and close, Enter and Space, find-in-page, CSS animation. Hydration only adds `disabled`. Library mode: the native toggle; a Collapsible toggled before hydration is reconciled on mount with one `openChangeAction` call (`reason: "platform"`, no event).'
        }
      />

      <h3 id="recipes">Recipes</h3>
      <h4>Remember the open state with a Server Function</h4>
      <CodeBlock>{`// Server Component
import { rememberOpen } from "./actions"; // "use server"

<Collapsible.Root defaultOpen={prefs.filtersOpen} openChangeAction={rememberOpen.bind(null, "filters")}>
  <Collapsible.Trigger>Filters</Collapsible.Trigger>
  <Collapsible.Panel><Filters /></Collapsible.Panel>
</Collapsible.Root>`}</CodeBlock>
      <p>
        Every toggle waits for the round trip. For a toggle that should not wait, pass a client
        function that calls the Server Function without returning its promise.
      </p>
      <h4>Open from a control elsewhere</h4>
      <CodeBlock>{`"use client";
const [open, setOpen] = useState(false);

<Button action={() => setOpen(true)}>Show details</Button>

<Collapsible.Root open={open} openChangeAction={setOpen}>
  <Collapsible.Trigger>Details</Collapsible.Trigger>
  <Collapsible.Panel>...</Collapsible.Panel>
</Collapsible.Root>`}</CodeBlock>
      <p>
        One setter serves both: the Trigger's click and a find-in-page reveal arrive through{" "}
        <code>openChangeAction</code>. The outside control is your own button; give it{" "}
        <code>aria-expanded</code> and <code>aria-controls</code> if it needs them.
      </p>
      <h4>Animate the box with ViewTransition</h4>
      <CodeBlock>{`<Collapsible.Root defaultOpen={false} transition="grow">...</Collapsible.Root>`}</CodeBlock>
      <p>
        Use either the <code>transition</code> prop or a <code>::details-content</code> CSS
        transition for a given change, not both. Content after the Collapsible jumps unless you give
        it a <code>&lt;ViewTransition&gt;</code> of its own.
      </p>
    </DocPage>
  );
}
