import { CodeBlock } from "../components/CodeBlock.js";
import { Term } from "../components/Concept.js";
import { Callout } from "../components/Callout.js";
import { DocPage } from "../components/DocPage.js";
import { Table } from "../components/Tables.js";

export function GettingStartedPage() {
  return (
    <DocPage
      title="Getting started"
      description="Install @funstack/ui, import a component from its subpath, and style it with data attributes and CSS."
    >
      <p className="page-intro">
        Install the package, import a component from its subpath, and style it with CSS. There is no
        provider, no theme and no stylesheet to import.
      </p>

      <h3>Install</h3>
      <CodeBlock language="bash">{`npm install @funstack/ui@alpha`}</CodeBlock>
      <Callout kind="warning" title="Alpha">
        <p>
          <code>@funstack/ui</code> is published as alpha releases under the <code>alpha</code>{" "}
          dist-tag; there is no <code>latest</code> release yet. APIs change without notice.
        </p>
      </Callout>
      <p>
        React <strong>19.3 or later</strong> is a peer dependency (<code>react</code> and{" "}
        <code>react-dom</code> <code>&gt;=19.3.0</code>). The library relies on React 19.3 features
        such as <code>&lt;ViewTransition&gt;</code> and <code>addTransitionType</code>. The package
        is ESM only and has no other runtime dependencies.
      </p>

      <h3>Imports</h3>
      <p>
        Every component has its own subpath, which is the documented form. The root entry re-exports
        everything, and both resolve to the same files.
      </p>
      <CodeBlock>{`import { Toggle } from "@funstack/ui/toggle";
import { Tabs } from "@funstack/ui/tabs";
import { Accordion } from "@funstack/ui/accordion";
import { Tooltip } from "@funstack/ui/tooltip";

// Also works:
import { Tabs, Toggle } from "@funstack/ui";

// Shared types live in @funstack/ui/types (the root entry exports them too).
import type { ActionDetails, ChangeAction } from "@funstack/ui/types";`}</CodeBlock>
      <p>
        <code>@funstack/ui/types</code> holds the types that several components share and none owns:{" "}
        <code>Action</code>, <code>ActionDetails</code>, <code>ChangeAction</code>,{" "}
        <code>ChangeReason</code>, <code>Rejectable</code>, <code>RenderProp</code>,{" "}
        <code>StateValue</code>, <code>UrgentChangeHandler</code>, <code>UrgentHandler</code> and{" "}
        <code>WhilePending</code>. It contains types only, so importing it costs nothing at runtime.
        A type that belongs to one component (<code>TabsValueChangeDetails</code>) comes from that
        component's subpath; the component subpaths do not re-export the shared types.
      </p>
      <p>
        Single-element components are plain components (<code>Toggle</code>). Compound components
        are a namespace of parts (<code>Tabs.Root</code>, <code>Tabs.Tab</code>, ...). The namespace
        itself is not a component.
      </p>
      <p>
        A <Term id="part">part</Term> is one piece of a component that you render yourself and that
        usually renders one element: <code>Tabs.Tab</code> is a part, and so is a whole{" "}
        <code>Toggle</code>. The <Term id="root">Root</Term> is the part of a compound component
        that holds its state (and its transition, when it has one) and provides them to the other
        parts through context; it is usually, not always, the outermost part. Other recurring words
        (trigger, content region, optimistic and committed value) are defined on{" "}
        <a href="/concepts/pending-and-optimistic#terms">Pending & optimistic state</a>.
      </p>

      <h3>A first component</h3>
      <CodeBlock>{`"use client";
import { Toggle } from "@funstack/ui/toggle";
import { saveFavorite } from "./api";

export function FavoriteButton({ postId, initial }: { postId: string; initial: boolean }) {
  return (
    <Toggle
      className="favorite"
      defaultPressed={initial}
      pressedChangeAction={(pressed) => saveFavorite(postId, pressed)}
    >
      Favorite
    </Toggle>
  );
}`}</CodeBlock>
      <p>
        <code>pressedChangeAction</code> is an <a href="/concepts/action-props#action">action</a>:
        it runs inside a transition. While the returned promise is pending, the button already shows
        the new pressed state (<a href="/concepts/pending-and-optimistic#optimistic">optimistic</a>)
        and carries <code>data-pending</code>. If it rejects, the pressed state rolls back and the
        error goes to the nearest Error Boundary. The{" "}
        <a href="/concepts/action-props">Action props</a> page explains the details.
      </p>

      <h3 id="styling">Styling: data attributes and CSS</h3>
      <p>
        Components render plain, accessible HTML and ship no styles. Library state appears as{" "}
        <code>data-*</code> attributes, emitted by presence (<code>data-pending=""</code> when true,
        absent when false). Enum-like states carry a value (<code>data-orientation="vertical"</code>
        ).
      </p>
      <CodeBlock language="css">{`.favorite[data-pressed] { background: gold; }
.favorite[data-pending] { cursor: progress; opacity: 0.8; }
.favorite[data-disabled] { opacity: 0.5; }

/* Interaction state comes from the platform, not from attributes. */
.favorite:hover { filter: brightness(1.05); }
.favorite:focus-visible { outline: 2px solid; }`}</CodeBlock>
      <p>
        Hover, focus and active state are deliberately not attributes: use <code>:hover</code>,{" "}
        <code>:focus-visible</code> and <code>:active</code>. Tailwind's <code>data-*</code>{" "}
        variants work as is: <code>data-pressed:bg-amber-300 data-pending:opacity-80</code>.
      </p>
      <p>
        When CSS is not enough, <code>className</code>, <code>style</code> and <code>children</code>{" "}
        also accept a function of the part's state:
      </p>
      <CodeBlock>{`<Toggle
  className={({ pressed, pending }) => (pending ? "fav busy" : pressed ? "fav on" : "fav")}
>
  {({ pressed, pending }) => (pending ? <Spinner /> : pressed ? <StarFilled /> : <StarOutline />)}
</Toggle>`}</CodeBlock>

      <p>
        Each component page lists the fields of a part's state object in the <strong>State</strong>{" "}
        line under the part's props table.
      </p>
      <p>
        To render a different element (your design system's button, a link), pass{" "}
        <code>render</code>; see{" "}
        <a href="/concepts/render">
          Replacing the element: <code>render</code>
        </a>
        .
      </p>

      <h3>What the components share</h3>
      <p>These props mean the same on every component that has them:</p>
      <Table
        head={["Prop", "Meaning"]}
        rows={[
          [
            "`x` / `defaultX` / `xChangeAction`",
            "Controlled value, initial uncontrolled value, and the action called on every change.",
          ],
          [
            "`transition`",
            "On parts whose content is driven by library state: forwarded to the part's `<ViewTransition default>`. Without it the part renders no `<ViewTransition>`.",
          ],
          [
            "`render`",
            "Replaces the rendered element (no `asChild`, no `as`). See [Replacing the element](/concepts/render).",
          ],
          ["`ref`", "An ordinary prop on every part that renders an element."],
          ["`experimental_*`", "Opt-in use of a platform feature that is not in every engine yet."],
        ]}
      />
      <p>
        One attribute is shared too, but it is not a prop: every component with an action renders{" "}
        <code>data-pending</code> while an action dispatched through it is in flight (see{" "}
        <a href="#styling">Styling</a> above).
      </p>
    </DocPage>
  );
}
