import { CodeBlock } from "../components/CodeBlock.js";
import { Callout } from "../components/Callout.js";
import { Example } from "../components/Example.js";
import { BehaviourIndex, BehaviourSection } from "../components/Concept.js";
import { DocPage } from "../components/DocPage.js";
import { PartFacts, PropsTable, Table } from "../components/Tables.js";
import { AccordionFaq } from "../examples/AccordionFaq.js";
import { AccordionThreads } from "../examples/AccordionThreads.js";
import { functionProps, renderProp } from "./shared-props.js";

export function AccordionPage() {
  return (
    <DocPage
      title="Accordion"
      description="An accordion built on <details>/<summary>: no JavaScript when you need no state; actions, optimistic data-open and Suspense-friendly panels when you do."
    >
      <p className="page-intro">
        Built on <code>&lt;details&gt;</code> and <code>&lt;summary&gt;</code>. Without value props
        its behaviour needs no JavaScript (the parts still ship as client modules; see{" "}
        <a href="/concepts/server-components">Server Components</a>); with them it becomes a regular{" "}
        <a href="/concepts/pending-and-optimistic#state-owner">state owner</a> with actions,
        optimistic <code>data-open</code> and Suspense-friendly panels.
      </p>

      <Example file="AccordionFaq.tsx" css="accordion.css">
        <AccordionFaq />
      </Example>

      <BehaviourIndex />

      <h3 id="anatomy">Anatomy</h3>
      <CodeBlock>{`import { Accordion } from "@funstack/ui/accordion";

<Accordion.Root>                     {/* div: state, keyboard navigation */}
  <Accordion.Item value="shipping">  {/* details */}
    <Accordion.Trigger>              {/* summary: must be the Item's first child */}
      <h3>Shipping</h3>
    </Accordion.Trigger>
    <Accordion.Panel>                {/* div: the content */}
      We ship worldwide.
    </Accordion.Panel>
  </Accordion.Item>
</Accordion.Root>`}</CodeBlock>
      <p>
        There is no Header part: the only valid place for a heading is inside the{" "}
        <code>&lt;summary&gt;</code>, so put it in the Trigger. If you use <code>render</code>, the
        Item must still render a <code>&lt;details&gt;</code> and the Trigger a{" "}
        <code>&lt;summary&gt;</code> (development warning otherwise).
      </p>

      <h3 id="how-it-works">How it works</h3>
      <h4>Two modes</h4>
      <Table
        head={["", "JS-free mode", "Library mode"]}
        rows={[
          [
            "Selected when",
            "Root has none of `value`, `defaultValue`, `valueChangeAction`",
            "Root has any of them",
          ],
          ["Open state owner", "the browser", "React (committed state)"],
          ["Initial open", "`Item defaultOpen`", "`Root defaultValue` / `value`"],
          ["`exclusive`", "native `<details name>` group", "the library keeps at most one value"],
          [
            "`data-open`, `data-pending`",
            "not emitted; style with `:open`",
            "emitted (optimistic)",
          ],
          ["Works before hydration", "yes, fully", "yes; reconciled on mount"],
          [
            "`transition`",
            "no effect (development warning)",
            "animates the commit that ends an action",
          ],
        ]}
      />
      <p>
        See <a href="/concepts/browser-owned-state">Browser-owned state</a> for the reasoning.
        Switching modes after mount is not supported.
      </p>

      <h3 id="props">Props</h3>
      <h4>
        <code>Accordion.Root</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "exclusive",
            type: "boolean",
            default: "false",
            description:
              "At most one item open. Also decides the value type: string | null when exclusive, string[] otherwise.",
          },
          {
            name: "value",
            type: "string[]  |  string | null (exclusive)",
            description:
              "Controlled open items. undefined means uncontrolled; [] or null means none open. Selects library mode.",
          },
          {
            name: "defaultValue",
            type: "string[]  |  string | null (exclusive)",
            description: "Initial open items in uncontrolled library mode. Selects library mode.",
          },
          {
            name: "valueChangeAction",
            type: "ChangeAction<string[] | string | null, AccordionValueChangeDetails>",
            description: (
              <>
                Called with the next open items on every change, inside the Root's transition. Sync,
                async or a Server Function. <code>details</code>: <code>reason</code> (a{" "}
                <code>ChangeReason</code>; Accordion dispatches <code>"activate"</code> or{" "}
                <code>"platform"</code>), <code>item</code> (the item that changed) and{" "}
                <code>open</code> (its new state). In multiple mode the array lists items in the
                order they mounted. Selects library mode.
              </>
            ),
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description: 'Disables every item: triggers get aria-disabled="true" and never toggle.',
          },
          {
            name: "experimental_interpolateSize",
            type: "boolean",
            default: "false",
            description: (
              <>
                Sets <code>interpolate-size: allow-keywords</code> on the root so{" "}
                <code>::details-content</code> can transition <code>height</code> to{" "}
                <code>auto</code>. Chromium only today; merged under your <code>style</code>.
              </>
            ),
          },
          ...functionProps("AccordionRootState"),
          renderProp("div", "AccordionRootState"),
        ]}
      />
      <PartFacts
        state={"`AccordionRootState` is `{ pending, disabled }`."}
        owned={"`onKeyDown`, `data-pending`, `data-disabled`."}
      />

      <h4>
        <code>Accordion.Item</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "value",
            type: "string",
            description: "Required in both modes. Identifies the item in the Root's value.",
          },
          {
            name: "defaultOpen",
            type: "boolean",
            default: "false",
            description:
              "JS-free mode only: renders the initial open attribute. Ignored in library mode (development warning).",
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description:
              "The Trigger gets aria-disabled and never toggles. Enforced by a click handler, so in JS-free mode it does not hold before hydration.",
          },
          {
            name: "transition",
            type: "ViewTransitionClass",
            description:
              "Library mode only. Forwarded to the <ViewTransition> around the <details>; animates the open/close commit.",
          },
          ...functionProps("AccordionItemState"),
          renderProp("details", "AccordionItemState"),
        ]}
      />
      <PartFacts
        state={
          "`AccordionItemState` is `{ value, open, pending, disabled }`; `open` is optimistic, and `undefined` in JS-free mode (the browser owns it)."
        }
        owned={
          "`open`, `name`, `suppressHydrationWarning`, `data-open`, `data-pending`, `data-disabled`, and `onToggle` in library mode."
        }
      />

      <h4>
        <code>Accordion.Trigger</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "transition",
            type: "ViewTransitionClass",
            description:
              "Library mode only. Animates the commit that ends an action (for example a spinner disappearing), not the optimistic data-open flip.",
          },
          ...functionProps(
            "AccordionTriggerState",
            "Rendered from optimistic state; must not suspend. A heading inside is recommended.",
          ),
          renderProp("summary", "AccordionTriggerState"),
        ]}
      />
      <PartFacts
        state={"`AccordionTriggerState` is the Item's state."}
        owned={
          "`aria-disabled`, `data-open`, `data-pending`, `data-disabled`, and `onClick` in library mode (and on disabled items)."
        }
        note={
          "Links and form controls inside the summary keep their own behaviour and do not toggle the item."
        }
      />

      <h4>
        <code>Accordion.Panel</code>
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
            "AccordionPanelState",
            "Always mounted. The function form receives committed open: use it to mount content lazily.",
          ),
          renderProp("div", "AccordionPanelState"),
        ]}
      />
      <PartFacts
        state={
          "`AccordionPanelState` is `{ value, open, disabled }`; `open` is committed (`undefined` in JS-free mode)."
        }
        owned={"`data-disabled`."}
        note={
          "Panels have no `keepMounted`: closed content is always in the DOM, which keeps it searchable."
        }
      />

      <h3 id="data-attributes">Data attributes</h3>
      <Table
        head={["Hook", "On", "Meaning"]}
        rows={[
          ["`:open`", "Item (`details`)", "Committed open state, both modes."],
          ["`data-open`", "Item, Trigger", "Optimistic open state (library mode only)."],
          ["`data-pending`", "Root", "An action is in flight."],
          ["`data-pending`", "Item, Trigger", "This item's open state is changing."],
          ["`data-disabled`", "Root, Item, Trigger, Panel", "Disabled by prop or by the Root."],
          ["`aria-disabled`", "Trigger", '`"true"` when disabled.'],
          ["`::details-content`", "Item", "The native content slot: animate it."],
        ]}
      />
      <CodeBlock language="css">{`.trigger { list-style: none; }                 /* hide the UA marker */
.trigger::-webkit-details-marker { display: none; }
.trigger::before { content: "▸"; }
.item:open > .trigger:not([data-pending])::before,
.trigger[data-open]::before { content: "▾"; }  /* flips at once in library mode */

/* Open/close animation, every engine, both modes */
.item::details-content {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 200ms ease, content-visibility 200ms allow-discrete;
}
.item:open::details-content { grid-template-rows: 1fr; }
.panel { min-height: 0; overflow: hidden; }

@media (prefers-reduced-motion: reduce) {
  .item::details-content { transition: none; }
}`}</CodeBlock>

      <h3 id="keyboard-and-aria">Keyboard and ARIA</h3>
      <Table
        head={["Key", "Behaviour"]}
        rows={[
          ["Enter / Space on a trigger", "Toggles the item (native)."],
          ["Tab / Shift+Tab", "Every trigger is a tab stop."],
          [
            "ArrowDown / ArrowUp",
            "Next / previous trigger in the same Root, wrapping, skipping disabled triggers.",
          ],
          ["Home / End", "First / last enabled trigger."],
        ]}
      />
      <ul>
        <li>
          The summary's disclosure role and expanded state are native. No <code>aria-*</code> is
          added except <code>aria-disabled</code>.
        </li>
        <li>
          HTML forbids <code>aria-expanded</code> on a summary, so assistive technology hears the
          committed state; <code>data-open</code> is visual only. For an audible pending state,
          render an <code>aria-live</code> region from the Trigger's state.
        </li>
        <li>Disabled triggers stay focusable. Focus never moves on open or close.</li>
      </ul>

      <BehaviourSection
        id="transition-types"
        summary={
          "Library mode: `fsui-accordion` plus `fsui-accordion-expand` or `fsui-accordion-collapse`. JS-free mode starts no transitions."
        }
      />

      <BehaviourSection
        id="optimistic-and-pending"
        summary={
          "Library mode: the Item and Trigger show the optimistic open state (`data-open`) and `data-pending` while their open state is changing; the Root carries `data-pending` while an action is in flight. The `<details>` element (`:open`, and what assistive technology hears) and the Panel's function child follow the committed state. JS-free mode has no optimistic or pending state."
        }
      >
        <h4 id="async-walkthrough">Walkthrough (library mode)</h4>
        <Example file="AccordionThreads.tsx" css="accordion.css">
          <AccordionThreads />
        </Example>
        <ol>
          <li>
            Click a trigger: the click is intercepted, the chevron flips (<code>data-open</code>),
            the item and trigger get <code>data-pending</code>, and{" "}
            <code>valueChangeAction(next, {'{ reason: "activate", item, open: true }'})</code> runs.
          </li>
          <li>
            The commit renders the Panel's function child with <code>open: true</code>; the replies
            suspend, so React holds the commit. The <code>&lt;details&gt;</code> stays closed.
          </li>
          <li>
            The data arrives: the item opens with its content in one commit, and{" "}
            <code>data-pending</code> goes.
          </li>
          <li>
            If the action rejects, <code>data-open</code> reverts, the item never opens, and the
            error goes to the nearest Error Boundary.
          </li>
        </ol>
        <Callout title="Find-in-page in library mode">
          <p>
            The browser opens a closed item when find-in-page or a text fragment matches its
            content. The Accordion dispatches that as <code>reason: "platform"</code> with the{" "}
            <code>toggle</code> event. If a controlled parent does not adopt the change, the item is
            closed again when the action settles. Disabled items are re-closed without dispatching.
          </p>
        </Callout>
      </BehaviourSection>

      <BehaviourSection
        id="suspense"
        summary={
          "The Panel is always mounted; its function child receives the committed `open`, which is how you mount content lazily. If that content suspends, the item stays closed with the trigger pending until the content is ready, then opens. Trigger content must not suspend."
        }
      />

      <BehaviourSection
        id="browser-owned-state"
        summary={
          'JS-free mode: the browser owns every `<details open>`, and `exclusive` is the native `name` group; style with `:open` and animate with `::details-content`. Library mode: open state is library-owned, but the browser can still open a closed item (find-in-page, a text fragment, a click before hydration). That is dispatched with `reason: "platform"`, and the committed state is re-applied once the action settles.'
        }
      />

      <BehaviourSection
        id="before-hydration"
        summary={
          'JS-free mode: everything: open and close, Enter and Space, the `exclusive` group (`<details name>`), find-in-page, CSS animation. Hydration only adds arrow-key navigation and `disabled`. Library mode: the native toggle; items opened before hydration are reconciled on mount with one `valueChangeAction` call (`reason: "platform"`).'
        }
      />

      <h3 id="recipes">Recipes</h3>
      <h4>Persist open sections with a Server Function</h4>
      <CodeBlock>{`// Server Component
<Accordion.Root defaultValue={user.openSections} valueChangeAction={saveOpenSections}>
  ...
</Accordion.Root>`}</CodeBlock>
      <h4>Animate item boxes with ViewTransition</h4>
      <CodeBlock>{`<Accordion.Root exclusive defaultValue={null} valueChangeAction={save}>
  <Accordion.Item value="a" transition="grow">...</Accordion.Item>
</Accordion.Root>`}</CodeBlock>
      <p>
        Use either the <code>transition</code> prop or a <code>::details-content</code> CSS
        transition for a given change, not both.
      </p>
    </DocPage>
  );
}
