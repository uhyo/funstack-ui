import { CodeBlock } from "../components/CodeBlock.js";
import { Example } from "../components/Example.js";
import { BehaviourIndex, BehaviourSection } from "../components/Concept.js";
import { DocPage } from "../components/DocPage.js";
import { PartFacts, PropsTable, Table } from "../components/Tables.js";
import { SeparatorLayout } from "../examples/SeparatorLayout.js";
import { renderProp, stylingProps } from "./shared-props.js";

export function SeparatorPage() {
  return (
    <DocPage
      title="Separator"
      description="A line between two pieces of content: an hr with aria-orientation and data-orientation, a decorative mode, and a component that is itself a Server Component."
    >
      <p className="page-intro">
        A line between two pieces of content (WAI-ARIA <code>separator</code>). It has no state, no
        action and nothing pending: what it adds over a bare <code>&lt;hr&gt;</code> is the vertical
        case (<code>aria-orientation</code> plus a styling hook), the decorative case (
        <code>role="none"</code>) and a name for your styled layer. Directive-free, so a Server
        Component renders it.
      </p>

      <Example file="SeparatorLayout.tsx" css="separator.css">
        <SeparatorLayout />
      </Example>
      <p>
        This example is a Server Component (no <code>"use client"</code>), and so is{" "}
        <code>Separator</code>: the function <code>className</code> ran on the server.
      </p>

      <BehaviourIndex />

      <h3 id="anatomy">Anatomy</h3>
      <CodeBlock>{`import { Separator } from "@funstack/ui/separator";

<article>…</article>
<Separator />                                     {/* hr role="separator" aria-orientation="horizontal" */}
<article>…</article>

<nav aria-label="Breadcrumb">
  <a href="/">Home</a>
  <Separator orientation="vertical" decorative /> {/* hr role="none" data-orientation="vertical" data-decorative */}
  <a href="/docs">Docs</a>
</nav>`}</CodeBlock>
      <p>
        One plain component, no parts. It renders <code>&lt;hr&gt;</code>, which is void: there is
        no <code>children</code> prop. The part writes the role itself (<code>separator</code>, or{" "}
        <code>none</code> while <code>decorative</code>), so a <code>render</code> element of
        another tag is a separator too.
      </p>

      <h3 id="props">Props</h3>
      <PropsTable
        rows={[
          {
            name: "orientation",
            type: '"horizontal" | "vertical"',
            default: '"horizontal"',
            description:
              "The direction of the line itself. A vertical separator sits between things laid out in a row. Rendered as `aria-orientation` (both values) and `data-orientation`.",
          },
          {
            name: "decorative",
            type: "boolean",
            default: "false",
            description:
              'A visual line with no meaning: `role="none"` and no `aria-orientation`. Leave it `false` when the line marks a real break a sighted reader would describe ("the comments start here"); set it for a line that only tidies a row or a list.',
          },
          ...stylingProps("SeparatorState"),
          {
            ...renderProp("hr", "SeparatorState"),
            description:
              "Replace the `<hr>` (element form) or take over rendering (function form). The part writes the role, so any element is a separator (or, with `decorative`, none).",
          },
        ]}
      />
      <PartFacts
        state={
          '`SeparatorState` is `{ orientation, decorative }`, the two props (`orientation` defaults to `"horizontal"`).'
        }
        owned={
          '`role` in both modes (`"separator"`, or `"none"` while `decorative`; either wins over a `render` element\'s own), `aria-orientation`, `data-orientation`, `data-decorative`. `role` and `aria-orientation` are not in the props type.'
        }
        note={
          'Every other `<hr>` prop passes through, `ref` included. `role="separator"` on the default `<hr>` restates its implicit role: assistive technology reads the same thing, and `render={<div />}` stays a separator.'
        }
      />

      <h3 id="data-attributes">Data attributes</h3>
      <Table
        head={["Hook", "Meaning"]}
        rows={[
          ["`data-orientation`", '`"horizontal"` or `"vertical"`, always (decorative too).'],
          ["`aria-orientation`", "The same value; absent while `decorative`."],
          ["`data-decorative`", "Present while `decorative` (`state.decorative`)."],
        ]}
      />

      <h3 id="keyboard-and-aria">Keyboard and ARIA</h3>
      <Table
        head={["Case", "Rendered", "Announced"]}
        rows={[
          ["default", "`hr[role=separator][aria-orientation=horizontal]`", "separator"],
          [
            '`orientation="vertical"`',
            "`hr[role=separator][aria-orientation=vertical]`",
            "separator, vertical where the screen reader says so",
          ],
          ["`decorative`", "`hr[role=none][data-decorative]`", "nothing"],
        ]}
      />
      <ul>
        <li>Not focusable, no keyboard interaction, in every case.</li>
        <li>
          Inside a <a href="/components/menu">Menu</a>, a <a href="/components/toolbar">Toolbar</a>{" "}
          or a <a href="/components/select">Select</a>, use <code>Menu.Separator</code>,{" "}
          <code>Toolbar.Separator</code> (it takes the orientation perpendicular to the
          toolbar&apos;s) or <code>Select.Separator</code>.
        </li>
        <li>
          Inside a listbox (<a href="/components/combobox">Combobox</a>,{" "}
          <a href="/components/multi-select">MultiSelect</a>) a <code>separator</code> is not
          allowed, but a <code>role="none"</code> element is:{" "}
          <code>&lt;Separator decorative /&gt;</code> between options or groups is valid, a semantic
          one is not.
        </li>
        <li>
          A line with a word in it ("or") is <code>render={"{<div>or</div>}"}</code>. The children
          of a separator are presentational, so the word is not announced: right for "or", wrong for
          anything that matters.
        </li>
      </ul>

      <BehaviourSection
        id="transition-types"
        summary={"None: the separator never changes on its own, and it takes no `transition` prop."}
      />

      <BehaviourSection
        id="optimistic-and-pending"
        summary={"None: no state, no action, nothing pending."}
      />

      <BehaviourSection
        id="suspense"
        summary={"Nothing specific: the separator renders no content region."}
      />

      <BehaviourSection id="browser-owned-state" summary={"None."} />

      <BehaviourSection
        id="before-hydration"
        summary={
          "Everything: there is no behaviour. The component is itself a Server Component; rendered by one, it runs once, on the server, function `className`, `style` and `render` included."
        }
      />

      <h3 id="recipes">Recipes</h3>
      <h4>CSS</h4>
      <p>
        The library ships no CSS. An <code>&lt;hr&gt;</code> has user-agent margins, a border and a
        border-derived height, so reset them:
      </p>
      <CodeBlock language="css">{`.separator { margin: 0; border: 0; background: var(--line); flex: none; }
.separator[data-orientation="horizontal"] { block-size: 1px; inline-size: 100%; }
.separator[data-orientation="vertical"]   { inline-size: 1px; align-self: stretch; }`}</CodeBlock>
      <p>
        Tailwind: <code>data-[orientation=horizontal]:h-px data-[orientation=vertical]:w-px</code>.
      </p>
      <h4>Inside a Toolbar</h4>
      <p>
        A standalone <code>Separator</code> does not read the Toolbar&apos;s orientation (that would
        make it a client component). It works there, but stays horizontal unless told otherwise; use{" "}
        <code>Toolbar.Separator</code>.
      </p>
    </DocPage>
  );
}
