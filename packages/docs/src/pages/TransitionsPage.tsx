import { CodeBlock } from "../components/CodeBlock.js";
import { Callout } from "../components/Example.js";
import { PageHead } from "../components/PageHead.js";
import { Table } from "../components/Tables.js";

export function TransitionsPage() {
  return (
    <div className="learn-content">
      <PageHead
        title="Transitions & ViewTransition"
        description="Every state change in FUNSTACK UI is a transition. Parts wrap themselves in <ViewTransition>, take a transition prop, and tag changes with fsui-* transition types."
      />
      <h2>Transitions & ViewTransition</h2>
      <p className="page-intro">
        Every state change the library makes is a React transition. That is what lets React keep old
        content on screen, and it is also what lets <code>&lt;ViewTransition&gt;</code> animate the
        change.
      </p>

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

      <h3>Transition types</h3>
      <p>
        Each dispatch adds <code>fsui-&lt;component&gt;</code> and, where the change has a direction
        or kind, <code>fsui-&lt;component&gt;-&lt;change&gt;</code> through{" "}
        <code>addTransitionType</code>:
      </p>
      <Table
        head={["Component", "Types"]}
        rows={[
          ["Toggle", "`fsui-toggle`, `fsui-toggle-press`, `fsui-toggle-release`"],
          [
            "Tabs",
            "`fsui-tabs`, `fsui-tabs-next`, `fsui-tabs-prev` (DOM order of the new tab relative to the committed one)",
          ],
          ["Accordion", "`fsui-accordion`, `fsui-accordion-expand`, `fsui-accordion-collapse`"],
          ["Tooltip", "none (no transitions; see below)"],
          ["Dialog", "`fsui-dialog`, `fsui-dialog-open`, `fsui-dialog-close`"],
          ["Switch", "`fsui-switch`, `fsui-switch-on`, `fsui-switch-off`"],
          ["Checkbox", "`fsui-checkbox`, `fsui-checkbox-check`, `fsui-checkbox-uncheck`"],
          ["RadioGroup", "`fsui-radio-group`"],
        ]}
      />
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

      <h3>What animates when</h3>
      <p>
        React starts a view transition only for commits made entirely of transition lanes. The
        optimistic flip is a synchronous commit, so it never animates through{" "}
        <code>&lt;ViewTransition&gt;</code>:
      </p>
      <Table
        head={["The part renders", "Animate with", "Examples"]}
        rows={[
          [
            "optimistic state",
            "a CSS `transition` on the data attribute",
            "`Toggle` `[data-pressed]`, `Tabs.Tab` `[data-selected]`, `Accordion.Trigger` `[data-open]`, `Tabs.Indicator` (anchor insets)",
          ],
          [
            "committed state",
            "the `transition` prop",
            "`Tabs.Panel` swaps, `Accordion.Item` / `Panel` in library mode",
          ],
          [
            "pending ending, a snap-back",
            "the `transition` prop",
            "a spinner rendered from `pending` disappearing",
          ],
          [
            "browser-owned state",
            "CSS: `@starting-style`, `transition-behavior: allow-discrete`",
            "Tooltip popup, Accordion in JS-free mode (`::details-content`)",
          ],
        ]}
      />
      <Callout title="Toggle has a transition prop too">
        <p>
          It animates the commit that ends the action (for example a spinner turning back into an
          icon), not the pressed flip itself. Use CSS on <code>[data-pressed]</code> for that.
        </p>
      </Callout>
      <p>
        <code>Tabs.Indicator</code> follows the optimistic tab with CSS Anchor Positioning; a plain
        CSS transition on its inset properties makes it slide on click and slide back on rollback.
      </p>

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
          Kept-mounted panels (<code>keepMounted</code>) switch their <code>&lt;Activity&gt;</code>{" "}
          mode inside the library's transition, so nested <code>&lt;ViewTransition&gt;</code>{" "}
          boundaries get enter and exit animations.
        </li>
      </ul>
    </div>
  );
}
