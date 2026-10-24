import { CodeBlock } from "../components/CodeBlock.js";
import { Term } from "../components/Concept.js";
import { Callout } from "../components/Example.js";
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

// Shared types live in the root entry.
import type { ActionDetails, ChangeAction } from "@funstack/ui";`}</CodeBlock>
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

      <h3>Styling: data attributes and CSS</h3>
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

      <h3>
        Replacing the element: <code>render</code>
      </h3>
      <p>
        Every part that renders an element accepts <code>render</code>. The element form replaces
        the default element and merges the library's props into it; the function form hands you the
        props and the state.
      </p>
      <CodeBlock>{`// Element form: a design-system button. It must accept \`ref\` and spread its props.
<Toggle render={<MyButton variant="ghost" />}>Bold</Toggle>

// Function form: full control.
<Toggle render={(props, state) => <button {...props}>{state.pressed ? "On" : "Off"}</button>} />`}</CodeBlock>
      <p>
        On every component page, each part's props table is followed by two fixed lines:{" "}
        <strong>State</strong>, the object the function props and <code>render</code> receive, and{" "}
        <strong>Owned</strong>, the props the part sets itself, which a <code>render</code> element
        cannot override. Everything not listed passes through to the element.
      </p>
      <p>Merge rules for the element form:</p>
      <ul>
        <li>
          <code>className</code> values are concatenated; <code>style</code> objects are merged (the
          element wins). Event handlers the part installs run after the element's own.
        </li>
        <li>
          Attributes the part computes (its <code>role</code>, ARIA state, ids, <code>data-*</code>{" "}
          state) always win. ARIA id lists (<code>aria-describedby</code>,{" "}
          <code>aria-labelledby</code>, <code>aria-controls</code>) are merged instead.
        </li>
        <li>
          Everything else, the element wins. <code>type="button"</code> is only added when the
          rendered element is a <code>&lt;button&gt;</code>.
        </li>
      </ul>

      <h3>What the components share</h3>
      <Table
        head={["Pattern", "Meaning"]}
        rows={[
          [
            "`x` / `defaultX` / `xChangeAction`",
            "Controlled value, initial uncontrolled value, and the action called on every change.",
          ],
          ["`data-pending`", "An action dispatched through this component is in flight."],
          [
            "`transition`",
            "On parts whose content is driven by library state: forwarded to the part's `<ViewTransition default>`. Without it the part renders no `<ViewTransition>`.",
          ],
          ["`render`", "Element polymorphism (no `asChild`, no `as`)."],
          ["`ref`", "An ordinary prop on every part that renders an element."],
          ["`experimental_*`", "Opt-in use of a platform feature that is not in every engine yet."],
        ]}
      />
    </DocPage>
  );
}
