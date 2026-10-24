import { CodeBlock } from "../components/CodeBlock.js";
import { ConceptExample } from "../components/Concept.js";
import { Example } from "../components/Example.js";
import { DocPage } from "../components/DocPage.js";
import { TabsSuspending } from "../examples/TabsSuspending.js";

export function SuspensePage() {
  return (
    <DocPage
      title="Suspense"
      description="FUNSTACK UI content regions keep old content on screen while new content suspends. You own the Suspense boundaries."
    >
      <p className="page-intro">
        Suspending children are the normal case, not an edge case. Content that reads data with{" "}
        <code>use()</code> works inside any FUNSTACK UI{" "}
        <a href="/concepts/pending-and-optimistic#content-region">content region</a> without extra
        props.
      </p>

      <h3>You own the boundaries</h3>
      <p>
        The library never wraps <code>children</code> in <code>&lt;Suspense&gt;</code> and has no{" "}
        <code>fallback</code> props. Where a fallback appears is a layout decision, so it is yours.
        Put a boundary wherever you would put one without the library, for example above the whole
        component.
      </p>

      <h3>What happens when new content suspends</h3>
      <p>
        A change of state is a transition, and content regions follow the{" "}
        <a href="/concepts/pending-and-optimistic#committed">committed value</a>. When the content
        for the new value suspends, React keeps the current content on screen instead of showing the
        fallback, because during a transition React does not hide content that is already visible
        behind a fallback. Meanwhile the{" "}
        <a href="/concepts/pending-and-optimistic#trigger">trigger</a> already shows the new value
        (optimistic), and the state owner and the trigger carry <code>data-pending</code>. When the
        data arrives, the new content replaces the old in one commit. If the user changes their mind
        while waiting, only the latest choice is ever committed.
      </p>
      <ConceptExample component="Tabs" href="/components/tabs">
        <p>
          Selecting a tab whose panel suspends keeps the current panel on screen; the new tab is
          already selected and the Root and that tab carry <code>data-pending</code>. Pressing arrow
          keys quickly with automatic activation dispatches one selection per key; the latest one
          wins, and only its panel is committed.
        </p>
        <Example file="TabsSuspending.tsx">
          <TabsSuspending />
        </Example>
      </ConceptExample>
      <p>
        The same rule has two more shapes. Content that is hidden until a state opens it waits in
        the closed state: the trigger is pending, and the open happens once, complete. Content that
        is re-rendered for a new input (a search) keeps the previous result on screen, marked stale,
        until the next one is ready. Each component page describes its case in its{" "}
        <strong>Suspense</strong> section.
      </p>
      <ConceptExample component="Accordion" href="/components/accordion#suspense">
        <p>
          <code>Accordion.Panel</code> is always mounted; its function child receives the committed{" "}
          <code>open</code> state, which is how content is mounted lazily. In library mode, if that
          content suspends, the item stays closed with the trigger pending until the content is
          ready, then opens.
        </p>
      </ConceptExample>
      <ConceptExample component="Combobox" href="/components/combobox#suspense">
        <p>
          A Combobox renders its results from <code>useDeferredValue</code> of the typed text, so an
          async search is <code>use(search(query))</code> inside a boundary in the List. The first
          load shows the fallback (a new boundary); after that, every keystroke keeps the previous
          results on screen, marked <code>data-stale</code> and <code>aria-busy</code>, until the
          new ones are ready. Only the latest query is ever rendered, so responses cannot arrive out
          of order.
        </p>
      </ConceptExample>

      <h3>Opting into a fallback</h3>
      <p>
        A boundary that mounts with the new content shows its fallback immediately (a React rule).
        That is the way to say "show a skeleton instead of waiting". Put the boundary inside the
        content region:
      </p>
      <ConceptExample component="Tabs" href="/components/tabs">
        <CodeBlock>{`<Tabs.Panel value="orders">
  <Suspense fallback={<OrdersSkeleton />}>
    <Orders />
  </Suspense>
</Tabs.Panel>`}</CodeBlock>
        <p>
          To get a fresh fallback per tab rather than a wait, key the boundary:{" "}
          <code>&lt;Suspense key={"{tab}"}&gt;</code>.
        </p>
      </ConceptExample>

      <h3>What must not suspend</h3>
      <p>
        <a href="/concepts/pending-and-optimistic#trigger">Trigger</a> content is rendered from{" "}
        <a href="/concepts/pending-and-optimistic#optimistic">optimistic state</a>, which updates
        synchronously, and a synchronous render that suspends shows a fallback. A{" "}
        <code>children</code> function on a trigger must not suspend, or must have its own boundary
        inside the trigger. The props tables mark these props "must not suspend". Content that a
        component renders ahead of time, before it is shown, follows the same rule: keep it static
        or put the boundary inside the part that shows it.
      </p>
    </DocPage>
  );
}
