import { CodeBlock } from "../components/CodeBlock.js";
import { Callout, Example } from "../components/Example.js";
import { PageHead } from "../components/PageHead.js";
import { Table } from "../components/Tables.js";
import { ToggleErrors } from "../examples/ToggleErrors.js";
import toggleErrorsSource from "../examples/ToggleErrors.tsx?raw";

export function ActionPropsPage() {
  return (
    <div className="learn-content">
      <PageHead
        title="Action props"
        description="FUNSTACK UI components take action props instead of event handlers. Actions run inside the component's transition, may be async, and report errors to Error Boundaries."
      />
      <h2>Action props</h2>
      <p className="page-intro">
        FUNSTACK UI has no <code>onClick</code>, <code>onChange</code> or <code>onValueChange</code>
        . Interactive props are <em>actions</em>: callbacks that the component runs inside its own
        transition and awaits.
      </p>

      <h3>Naming</h3>
      <p>
        A controllable state <code>x</code> always comes as a triple: <code>x</code> (controlled),{" "}
        <code>defaultX</code> (uncontrolled initial value) and <code>xChangeAction</code>.
      </p>
      <Table
        head={["Component", "State", "Action"]}
        rows={[
          ["Toggle", "`pressed` / `defaultPressed`", "`pressedChangeAction`"],
          ["Tabs", "`value` / `defaultValue`", "`valueChangeAction`"],
          ["Accordion", "`value` / `defaultValue`", "`valueChangeAction`"],
          ["Tooltip", "open state is browser-owned", "none"],
        ]}
      />
      <p>
        <code>undefined</code> always means "uncontrolled"; "nothing selected" is <code>null</code>.
        Switching between controlled and uncontrolled after mount is not supported (development
        warning).
      </p>

      <h3>Signature</h3>
      <CodeBlock language="typescript">{`type Action<Args extends readonly unknown[] = []> = (...args: Args) => unknown;

interface ActionDetails {
  /** The DOM event that caused the action, or undefined. */
  readonly event: Event | undefined;
}

type ChangeAction<T, Details extends ActionDetails = ActionDetails> =
  Action<[next: T, details: Details]>;`}</CodeBlock>
      <p>
        The first argument is the next value, so the common case stays short. The second is a{" "}
        <code>details</code> object with the native DOM event (not React's synthetic one) and any
        component-specific fields, such as <code>reason</code> on Tabs and Accordion. The return
        type is <code>unknown</code>: return a promise and the component awaits it, return anything
        else and it is ignored. That means a function that returns data (a Server Function, a{" "}
        <code>fetch</code>) type-checks without wrapping.
      </p>
      <CodeBlock>{`<Toggle pressedChangeAction={(pressed) => api.setFavorite(id, pressed)}>Favorite</Toggle>
<Tabs.Root defaultValue="general" valueChangeAction={(tab) => analytics.track(tab)}>...</Tabs.Root>`}</CodeBlock>

      <h3>What happens on a click</h3>
      <p>The component does, in one transition of its own:</p>
      <CodeBlock language="typescript">{`startTransition(async () => {
  addTransitionType("fsui-toggle");     // plus fsui-toggle-press / -release
  setOptimistic(next);                  // the button flips immediately
  await pressedChangeAction?.(next, details);
  // uncontrolled: commit \`next\` now, if this is still the latest dispatch
});`}</CodeBlock>
      <p>What you can rely on:</p>
      <ul>
        <li>
          <strong>Sync or async.</strong> The action is awaited; <code>data-pending</code> stays on
          until the promise settles <em>and</em> the resulting render has committed (including a
          Suspense wait).
        </li>
        <li>
          <strong>The synchronous part runs during the event.</strong>{" "}
          <code>details.event.preventDefault()</code> works there, and a <code>setState</code> there
          is a transition update.
        </li>
        <li>
          <strong>Disabled parts never dispatch</strong>, and no-op interactions (clicking the tab
          that is already selected) do not dispatch either.
        </li>
        <li>
          <strong>Parts are never disabled while pending.</strong> The library only sets{" "}
          <code>data-pending</code>; a second click is a new intent (below). If you want to block
          it, use CSS: <code>[data-pending] {"{ pointer-events: none }"}</code>.
        </li>
      </ul>

      <h3>
        After an <code>await</code>, wrap state updates yourself
      </h3>
      <p>
        This is a React rule, and the library cannot hide it: a <code>setState</code> that runs
        after your own <code>await</code> is no longer part of the transition. Wrap it in{" "}
        <code>startTransition</code>.
      </p>
      <CodeBlock>{`// Controlled, local state: set it in the synchronous part.
<Tabs.Root value={tab} valueChangeAction={(next) => { setTab(next); }}>

// Controlled, server-backed: adopt the value on success, re-wrapped after the await.
<Tabs.Root
  value={tab}
  valueChangeAction={async (next) => {
    await saveTab(next);
    startTransition(() => setTab(next));
  }}
>`}</CodeBlock>

      <h3>Await only what the UI must wait for</h3>
      <p>
        While an async action is pending, React holds <em>every</em> transition in the app that
        started meanwhile and commits them together. A two-second awaited save in one Toggle also
        delays a router navigation. Background work that the UI need not wait for should not be
        returned:
      </p>
      <CodeBlock>{`// The panel switches immediately; the save runs in the background.
valueChangeAction={(next) => { void saveSelection(next); }}

// The panel switches when the save succeeds; the tab shows pending meanwhile.
valueChangeAction={async (next) => { await saveSelection(next); }}`}</CodeBlock>

      <h3>Errors go to Error Boundaries</h3>
      <p>
        An action that throws or rejects reaches the nearest Error Boundary above the component that
        owns the transition (the <code>Root</code>, or the Toggle itself). The library never
        swallows an error. The optimistic state reverts automatically, and uncontrolled state is
        only written after success, so a failed action leaves it untouched.
      </p>
      <p>
        For inline error UI instead, catch inside the action. A caught error makes the action
        resolve, which counts as success: in uncontrolled mode the new value is committed. Use
        controlled mode when the parent must be able to veto.
      </p>
      <Example source={toggleErrorsSource} fileName="ToggleErrors.tsx">
        <ToggleErrors />
      </Example>

      <h3>Overlapping actions: the latest intent wins</h3>
      <p>
        React neither cancels nor orders overlapping actions. The components do this: the optimistic
        state always shows the most recent click, and uncontrolled state is committed only for the
        most recently dispatched action, even if an older one resolves later. There is no queue and
        no abort signal; if you need to cancel a request, keep an <code>AbortController</code> in a
        ref inside your action.
      </p>
      <p>
        React would silently drop the rejection of a superseded (older) action. The library catches
        it and rethrows it from render, so it still reaches the same Error Boundary as a failure of
        the latest action.
      </p>

      <h3>Server Functions work directly</h3>
      <p>
        A Server Function (<code>"use server"</code>) can be passed straight to any action prop,
        from a Server Component or a Client Component. <code>details</code> is a plain object of
        serialisable fields; <code>event</code> is served by a proxy and is not an own property, so
        React's serialiser never sees it. The server receives <code>(next, details)</code> with{" "}
        <code>details.event</code> undefined and every other field intact.
      </p>
      <CodeBlock>{`// app/post.tsx: a Server Component
import { Toggle } from "@funstack/ui/toggle";
import { setFavorite } from "./actions"; // "use server"

<Toggle defaultPressed={post.favorited} pressedChangeAction={setFavorite.bind(null, post.id)}>
  Favorite
</Toggle>`}</CodeBlock>
      <Callout title="Costs of the virtual event">
        <p>
          <code>Object.keys(details)</code>, spreading and <code>JSON.stringify</code> do not
          include <code>event</code>; <code>"event" in details</code> and <code>details.event</code>{" "}
          do. <code>structuredClone(details)</code> throws. In tests, assert{" "}
          <code>details.event</code> directly rather than <code>toEqual({"{ event }"})</code>.
        </p>
      </Callout>

      <h3>What about native handlers?</h3>
      <p>
        DOM event props that a part does not use itself pass through to the element (an{" "}
        <code>onPointerEnter</code> on a Tab, an <code>onClick</code> on a Tooltip trigger). They
        are the platform's API, not the library's. Handlers the part does install (for example{" "}
        <code>onClick</code> on a Toggle) are removed from its props type so they cannot be
        clobbered by accident.
      </p>
    </div>
  );
}
