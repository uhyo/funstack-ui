import { CodeBlock } from "../components/CodeBlock.js";
import { ConceptExample, Terms } from "../components/Concept.js";
import { PageHead } from "../components/PageHead.js";
import { Table } from "../components/Tables.js";

export function TransitionsPage() {
  return (
    <div className="learn-content">
      <PageHead
        title="Transitions & ViewTransition"
        description="Every state change in FUNSTACK UI is a transition. Parts whose content is driven by library state take a transition prop that renders a <ViewTransition>, and changes are tagged with fsui-* transition types."
      />
      <h2>Transitions & ViewTransition</h2>
      <p className="page-intro">
        Every state change the library makes is a React transition. That is what lets React keep old
        content on screen, and it is also what lets <code>&lt;ViewTransition&gt;</code> animate the
        change.
      </p>

      <h3 id="terms">Terms</h3>
      <Terms
        items={[
          {
            id: "commit",
            term: "Commit",
            definition:
              "The moment React applies a finished render to the DOM. One user interaction can lead to several commits: the synchronous one that shows the [optimistic value](/concepts/pending-and-optimistic#optimistic), and the transition commit that ends the action.",
          },
          {
            id: "view-transition",
            term: "View transition",
            definition:
              "The browser's View Transition API: it snapshots the page before and after a DOM change and animates between the two. React starts one for a transition commit when a `<ViewTransition>` boundary in the tree is affected.",
          },
          {
            id: "transition-type",
            term: "Transition type",
            definition:
              "A string attached to a transition with React's `addTransitionType`. A `<ViewTransition>` can pick its animation by type, and CSS can match it with `:active-view-transition-type()`.",
          },
        ]}
      />

      <h3>
        The <code>transition</code> prop
      </h3>
      <p>
        Each part whose mount, unmount or content is driven by library state has a{" "}
        <code>transition</code> prop. When you pass it, the part renders a{" "}
        <code>&lt;ViewTransition default=&#123;transition&#125;&gt;</code> as the outermost node of
        its output; without it, the part renders no boundary at all. The value has exactly React's
        type: <code>"auto"</code>, <code>"none"</code>, a View Transition class, or a map from
        transition type to class.
      </p>
      <p>
        Treat <code>transition</code> as static. Changing it between <code>undefined</code> and a
        value remounts the part (development warns); switching between <code>"none"</code> and a
        class does not. Any value, <code>"none"</code> and a type map that does not match included,
        has a cost: when the part mounts or is revealed in a transition (a tab switch with{" "}
        <code>keepMounted</code> <code>false</code> or <code>true</code>, a part inside a dialog
        that opens), React starts a document view transition. The browser then cross-fades the whole
        page for 250 ms, and the next transition commit waits for it.
      </p>
      <ConceptExample component="Tabs" href="/components/tabs">
        <p>
          <code>Tabs.Panel</code> takes <code>transition</code>, which animates the swap from one
          panel to the next. A class animates every swap; a type map picks a slide direction from
          the Tabs transition types:
        </p>
        <CodeBlock>{`<Tabs.Panel value="billing" transition="fade">...</Tabs.Panel>

<Tabs.Panel
  value="billing"
  transition={{ "fsui-tabs-next": "slide-left", "fsui-tabs-prev": "slide-right", default: "none" }}
>
  ...
</Tabs.Panel>`}</CodeBlock>
        <CodeBlock language="css">{`::view-transition-old(.slide-left) { animation: 160ms ease-in both slide-out-left; }
::view-transition-new(.slide-left) { animation: 160ms ease-out both slide-in-right; }

@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) { animation: none !important; }
}`}</CodeBlock>
      </ConceptExample>
      <p>
        The library ships no animation, so there is nothing to turn off for reduced motion; keep the
        media query above in your own stylesheet.
      </p>
      <p>
        If you want only your own named animations, you can opt out of the page cross-fade with the
        CSS below. It is optional and applies to every view transition on the page, including your
        router's. The last rule keeps clicks working during a transition in Firefox, which otherwise
        suppresses hit testing.
      </p>
      <CodeBlock language="css">{`::view-transition-old(root),
::view-transition-new(root) { animation: none; }
/* or: :root { view-transition-name: none; } */

::view-transition { pointer-events: none; }`}</CodeBlock>

      <h3 id="transition-types">Transition types</h3>
      <p>
        Each dispatch adds <code>fsui-&lt;component&gt;</code> and, where the change has a direction
        or kind, <code>fsui-&lt;component&gt;-&lt;change&gt;</code> through{" "}
        <code>addTransitionType</code>. A few examples:
      </p>
      <Table
        head={["Component", "Types"]}
        rows={[
          ["Toggle", "`fsui-toggle`, `fsui-toggle-press`, `fsui-toggle-release`"],
          [
            "Tabs",
            "`fsui-tabs`, `fsui-tabs-next`, `fsui-tabs-prev` (DOM order of the new tab relative to the committed one)",
          ],
          ["Dialog", "`fsui-dialog`, `fsui-dialog-open`, `fsui-dialog-close`"],
        ]}
      />
      <p>
        Every component page lists its own types, or says that it has none, in the{" "}
        <strong>Transition types</strong> row of its <strong>Async and platform behaviour</strong>{" "}
        section. Components whose state never changes in a transition add none: their commits are
        urgent, or their state belongs to the browser.
      </p>
      <p>
        Use them in a <code>transition</code> map, or in CSS with{" "}
        <code>:active-view-transition-type(fsui-tabs-next)</code>. Types you add yourself with{" "}
        <code>addTransitionType</code> in the synchronous part of an action join the same
        transition.
      </p>
      <p>
        Types are attached only to the commit that ends a dispatched action. A rollback after a
        rejection, or a controlled parent snapping the value back, carries no <code>fsui-*</code>{" "}
        type: a type map needs a <code>default</code> entry if rollbacks should animate.
      </p>

      <h3 id="what-animates-when">What animates when</h3>
      <p>
        React starts a view transition only for commits made entirely of transition lanes (a lane is
        React's priority class for an update; transitions have their own). The optimistic flip is a
        synchronous commit, so it never animates through <code>&lt;ViewTransition&gt;</code>. What
        to animate with depends on which value the part renders (see{" "}
        <a href="/concepts/pending-and-optimistic#terms">the three values</a>):
      </p>
      <Table
        head={["The part renders", "Animate with"]}
        rows={[
          ["optimistic state (a trigger)", "a CSS `transition` on the data attribute"],
          ["committed state (a content region)", "the `transition` prop"],
          ["the end of pending, or a rollback", "the `transition` prop"],
          [
            "[browser-owned state](/concepts/browser-owned-state)",
            "CSS: `@starting-style`, `transition-behavior: allow-discrete`",
          ],
        ]}
      />
      <ConceptExample component="Tabs" href="/components/tabs">
        <p>
          <code>Tabs.Tab</code> renders the optimistic selection: animate its colour with a CSS
          transition on <code>[data-selected]</code>. <code>Tabs.Indicator</code> follows the
          optimistic tab with CSS Anchor Positioning, so a plain CSS transition on its inset
          properties makes it slide on click and slide back on rollback. <code>Tabs.Panel</code>{" "}
          renders the committed selection: animate the swap with its <code>transition</code> prop. A
          spinner rendered from the Tab's <code>pending</code> state disappears in the commit that
          ends the action, which the Tab's own <code>transition</code> prop can animate.
        </p>
      </ConceptExample>

      <h3>Rules the library follows for you</h3>
      <ul>
        <li>
          It never calls <code>document.startViewTransition</code> and never uses{" "}
          <code>flushSync</code>.
        </li>
        <li>
          <code>&lt;ViewTransition&gt;</code> renders no DOM and is safe in server-rendered trees;
          hydration is not a transition, so nothing animates on first paint.
        </li>
        <li>
          <a href="/concepts/pending-and-optimistic#content-region">Content regions</a> kept mounted
          while hidden (Tabs <code>keepMounted</code>) switch their <code>&lt;Activity&gt;</code>{" "}
          mode inside the library's transition, so nested <code>&lt;ViewTransition&gt;</code>{" "}
          boundaries get enter and exit animations.
        </li>
      </ul>
    </div>
  );
}
