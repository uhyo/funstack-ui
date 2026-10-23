import { CodeBlock } from "../components/CodeBlock.js";
import { ConceptExample, Term } from "../components/Concept.js";
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
        , with <a href="#urgent-lane">one exception, below</a>. Interactive props are{" "}
        <em>actions</em>: callbacks that the component runs inside its own transition and awaits.
      </p>
      <p>
        An <Term id="action">action</Term> is a function prop that the component calls when the user
        (or the browser) asks for something, inside a React transition the component starts for it.
        To <Term id="dispatch">dispatch</Term> is to start that transition and call the action once;
        every click, key press or platform change that asks for a change is one dispatch. A
        transition is React's way to mark an update as non-urgent, so it can keep the current UI on
        screen while the update is prepared (see{" "}
        <a href="/concepts/transitions">Transitions & ViewTransition</a>).
      </p>

      <h3>Naming</h3>
      <p>
        A controllable state <code>x</code> always comes as a triple: <code>x</code> (controlled),{" "}
        <code>defaultX</code> (uncontrolled initial value) and <code>xChangeAction</code>.
      </p>
      <ConceptExample component="Toggle" href="/components/toggle">
        <p>
          A Toggle's state is <code>pressed</code>, so its props are <code>pressed</code>,{" "}
          <code>defaultPressed</code> and <code>pressedChangeAction</code>. Each component page
          lists its own triple in its props table.
        </p>
      </ConceptExample>
      <p>
        A part that performs one task rather than changing a state (a{" "}
        <a href="/concepts/pending-and-optimistic#pure-trigger">pure trigger</a>) takes a plain{" "}
        <code>action</code> (<code>Dialog.Close action</code>: run this, then close). A state that
        the consumer derives and the library only mirrors is a controlled-only prop with no default
        and no action (<code>Checkbox indeterminate</code>).
      </p>
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
        component-specific fields, such as <code>reason</code> (below) or Dialog's{" "}
        <code>returnValue</code>. The return type is <code>unknown</code>: return a promise and the
        component awaits it, return anything else and it is ignored. That means a function that
        returns data (a Server Function, a <code>fetch</code>) type-checks without wrapping.
      </p>
      <CodeBlock>{`<Toggle pressedChangeAction={(pressed) => api.setFavorite(id, pressed)}>Favorite</Toggle>
<Tabs.Root defaultValue="general" valueChangeAction={(tab) => analytics.track(tab)}>...</Tabs.Root>`}</CodeBlock>

      <h3>
        <code>details.reason</code>
      </h3>
      <p>
        Components that can change for more than one reason say why, with one library-wide
        vocabulary (the public type <code>ChangeReason</code>):
      </p>
      <Table
        head={["reason", "Meaning", "details.event"]}
        rows={[
          [
            '`"activate"`',
            "The user acted on one of the component's parts: a click, Enter or Space, focus in automatic activation, a Dialog Close button or form submit.",
            "The native `click`, `keydown` or `focusin` event. For checkboxes and radios always the `click`, including Space and arrow keys.",
          ],
          [
            '`"platform"`',
            "The browser changed the state by itself: find-in-page, a form reset, or an interaction before hydration found on mount. Never a direct user interaction (a click, key press or touch).",
            "The platform event (`beforematch`, `toggle`, `reset`), or `undefined` on mount.",
          ],
          [
            '`"dismiss"`',
            'The user closed the component without one of its parts: Escape, Android back, an assistive-technology dismiss, a click outside. Also a [Toast](/components/toast)\'s Close part, which only means "go away".',
            "The platform's `close` event; for Toast the click or keydown.",
          ],
          [
            '`"timeout"`',
            "The library's own timer closed the component: a [Toast](/components/toast) whose `duration` elapsed. No user interaction, no platform event.",
            "`undefined`",
          ],
        ]}
      />
      <p>
        A component uses only the reasons that can happen to it; its page lists them in the
        description of its change action. A <code>"platform"</code> dispatch goes through the same
        action as a user one, so a controlled parent hears about a form reset and decides whether to
        adopt it. See <a href="/concepts/browser-owned-state">Browser-owned state</a>.
      </p>

      <h3>What happens on a click</h3>
      <p>
        In one transition of its own, the component tags the transition with its{" "}
        <a href="/concepts/transitions#transition-types">transition types</a>, sets the{" "}
        <a href="/concepts/pending-and-optimistic#optimistic">optimistic value</a>, awaits your
        action, and, when it is uncontrolled and this is still the latest dispatch, commits the new
        value.
      </p>
      <ConceptExample component="Toggle" href="/components/toggle">
        <CodeBlock language="typescript">{`startTransition(async () => {
  addTransitionType("fsui-toggle");     // plus fsui-toggle-press / -release
  setOptimistic(next);                  // the button flips immediately
  await pressedChangeAction?.(next, details);
  // uncontrolled: commit \`next\` now, if this is still the latest dispatch
});`}</CodeBlock>
      </ConceptExample>
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
          <strong>Disabled parts never dispatch</strong> for user interaction, and no-op
          interactions (clicking the tab that is already selected) do not dispatch either. (A form
          reset still reaches a disabled native input: the browser resets disabled inputs too, and
          the form's author asked for it.)
        </li>
        <li>
          <strong>Parts are never natively disabled while pending.</strong> A trigger that changes
          state sets <code>data-pending</code> and takes every click: a second click is a new intent
          (below). A <a href="/concepts/pending-and-optimistic#pure-trigger">pure trigger</a>{" "}
          ignores a second activation while its own action is pending and is{" "}
          <code>aria-disabled="true"</code> meanwhile, so a double click never runs a save twice
          (see{" "}
          <a href="/concepts/pending-and-optimistic#second-click">A second click while pending</a>
          ).
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
        owns the transition (the{" "}
        <a href="/concepts/pending-and-optimistic#state-owner">state owner</a>: usually the{" "}
        <code>Root</code>, or a single-element component such as a Toggle). The library never
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

      <h3 id="overlapping-actions">Overlapping actions: the latest intent wins</h3>
      <p>
        React neither cancels nor orders overlapping transitions: two actions started one after the
        other run at the same time, and either may finish first. The components handle this: the
        optimistic state always shows the most recent click, and uncontrolled state is committed
        only for the most recently dispatched action, even if an older one resolves later. The
        components have no queue and no abort signal; if you need to cancel a request, keep an{" "}
        <code>AbortController</code> in a ref inside your action.
      </p>
      <p>
        If your actions must run in order, one after another, or each must build on the result of
        the one before (reducer-style accumulation), use React's{" "}
        <a href="https://react.dev/reference/react/useActionState">
          <code>useActionState</code>
        </a>{" "}
        and call its dispatch function from the component's action. React queues those calls and
        runs them sequentially, passing each the state the previous one returned. Drive the
        component in controlled mode from that state:
      </p>
      <CodeBlock>{`const [pressed, dispatch] = useActionState(async (_previous: boolean, next: boolean) => {
  await api.setFavorite(id, next); // runs only after the previous call has finished
  return next;
}, initial);

<Toggle pressed={pressed} pressedChangeAction={(next) => dispatch(next)}>Favorite</Toggle>`}</CodeBlock>
      <p>
        The component stays pending and keeps showing the latest optimistic value until the queue
        has drained. React's rules for the queue apply: when one call throws, React skips the calls
        still queued behind it and the error goes to the nearest Error Boundary above the component
        that called <code>useActionState</code>.
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

      <h3>Form actions are a separate channel</h3>
      <p>
        <code>&lt;form action&gt;</code>, <code>useFormStatus</code> and React's automatic form
        reset are React's form channel. A control's change action is per control and runs in the
        control's own transition. The two are independent:
      </p>
      <ul>
        <li>
          A Switch, Checkbox or RadioGroup inside <code>&lt;form action={"{serverFn}"}&gt;</code>{" "}
          needs no change action: with a <code>name</code> it posts its value like any native input,
          and <code>useFormStatus().pending</code> covers the submit.
        </li>
        <li>
          A control never folds <code>useFormStatus</code> into its own <code>pending</code>: that
          would mark every control in the form pending during a submit. Read{" "}
          <code>useFormStatus</code> in your own <code>className</code> function, or style{" "}
          <code>form:has(...)</code>.
        </li>
        <li>
          "Autosave on change" is <code>checkedChangeAction={"{saveSetting}"}</code>; "submit on
          change" is <code>checkedChangeAction={"{() => formRef.current?.requestSubmit()}"}</code>.
        </li>
        <li>
          A part may observe the form channel for a platform side effect: <code>Dialog.Form</code>{" "}
          closes its dialog once the form action has settled. It never wraps your action, so a
          Server Function keeps React's progressive enhancement.
        </li>
        <li>
          While a form action is pending, a control's transition is entangled with it, and the
          reverse: React commits them together.
        </li>
      </ul>

      <h3 id="urgent-lane">The urgent lane</h3>
      <p>
        One kind of state cannot be a transition: the text of a controlled text input, which React
        must update in the same event as the keystroke. Such a state keeps the <code>x</code> /{" "}
        <code>defaultX</code> pair (<code>inputValue</code> / <code>defaultInputValue</code> on{" "}
        <a href="/components/combobox">Combobox</a>), but its callback is a handler, not an action:{" "}
        <code>onInputValueChange</code>, typed:
      </p>
      <CodeBlock language="typescript">{`/** Called synchronously, outside any Transition, and not awaited. */
type UrgentChangeHandler<T, Details extends ActionDetails = ActionDetails> =
  (next: T, details: Details) => void;`}</CodeBlock>
      <p>
        Nothing is pending or optimistic for it: the DOM already holds the value when it runs, so{" "}
        <code>{"(next) => setText(next)"}</code> is the whole controlled pattern. Everything the
        urgent value drives leaves the urgent lane at once (a deferred query, an open, a selection).
        A returned promise is ignored and warned about in development. It is the library's one{" "}
        <code>on*</code> prop, and it is one on purpose: <code>fooAction</code> always means a
        handler the component runs in a transition, so a callback that must not run in one is named
        like the plain React handler it is. Nothing else in the library is an <code>on*</code> prop.
      </p>

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
