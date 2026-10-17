import { CodeBlock } from "../components/CodeBlock.js";
import { Example } from "../components/Example.js";
import { PageHead } from "../components/PageHead.js";
import { AccordionThreads } from "../examples/AccordionThreads.js";
import accordionThreadsSource from "../examples/AccordionThreads.tsx?raw";
import { TabsSuspending } from "../examples/TabsSuspending.js";
import tabsSuspendingSource from "../examples/TabsSuspending.tsx?raw";

export function SuspensePage() {
  return (
    <div className="learn-content">
      <PageHead
        title="Suspense"
        description="FUNSTACK UI content regions keep old content on screen while new content suspends. You own the Suspense boundaries."
      />
      <h2>Suspense</h2>
      <p className="page-intro">
        Suspending children are the normal case, not an edge case. Content that reads data with{" "}
        <code>use()</code> works inside any FUNSTACK UI panel without extra props.
      </p>

      <h3>You own the boundaries</h3>
      <p>
        The library never wraps <code>children</code> in <code>&lt;Suspense&gt;</code> and has no{" "}
        <code>fallback</code> props. Where a fallback appears is a layout decision, so it is yours.
        Put a boundary wherever you would put one without the library, for example above the whole
        Tabs.
      </p>

      <h3>What happens when a panel suspends</h3>
      <p>
        Selecting a tab is a transition, and panels follow the committed value. So when the newly
        selected panel suspends, React keeps the current panel on screen instead of showing the
        fallback; the tab is already selected (optimistic) and the root and tab carry{" "}
        <code>data-pending</code>. When the data arrives, the panel swaps in one commit.
      </p>
      <Example source={tabsSuspendingSource} fileName="TabsSuspending.tsx">
        <TabsSuspending />
      </Example>
      <p>
        Pressing arrow keys quickly with automatic activation dispatches one selection per key; the
        latest one wins, and only its panel is committed.
      </p>

      <h3>Accordion: open when ready</h3>
      <p>
        <code>Accordion.Panel</code> is always mounted (closed <code>&lt;details&gt;</code> content
        stays in the DOM and is searchable). Its function child receives the committed{" "}
        <code>open</code> state, which is how you mount content lazily. If that content suspends,
        the item stays closed with the trigger pending until the content is ready, then opens.
      </p>
      <Example source={accordionThreadsSource} fileName="AccordionThreads.tsx">
        <AccordionThreads />
      </Example>

      <h3>Combobox: results from a deferred query</h3>
      <p>
        A <a href="/components/combobox">Combobox</a> renders its results from{" "}
        <code>useDeferredValue</code> of the typed text, so an async search is just{" "}
        <code>use(search(query))</code> inside a boundary in the List. The first load shows your
        fallback (a new boundary); after that, every keystroke keeps the previous results on screen,
        marked <code>data-stale</code> and <code>aria-busy</code>, until the new ones are ready.
        Only the latest query is ever rendered, so responses cannot arrive out of order.
      </p>

      <h3>Opting into a fallback</h3>
      <p>
        A boundary that mounts with the new content shows its fallback immediately (a React rule).
        That is the way to say "show a skeleton instead of waiting":
      </p>
      <CodeBlock>{`<Tabs.Panel value="orders">
  <Suspense fallback={<OrdersSkeleton />}>
    <Orders />
  </Suspense>
</Tabs.Panel>`}</CodeBlock>
      <p>
        To get a fresh fallback per item rather than a wait, key the boundary:{" "}
        <code>&lt;Suspense key={"{tab}"}&gt;</code>.
      </p>

      <h3>What must not suspend</h3>
      <p>
        Trigger content is rendered from optimistic state, which updates synchronously. A{" "}
        <code>children</code> function on a <code>Tabs.Tab</code>, <code>Toggle</code> or{" "}
        <code>Accordion.Trigger</code> must not suspend (or must have its own boundary inside the
        trigger). Tooltip content is rendered at mount, not at open time: keep it static, or put the
        boundary inside <code>Tooltip.Popup</code>.
      </p>
    </div>
  );
}
