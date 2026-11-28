import { CodeBlock } from "../components/CodeBlock.js";
import { ConceptExample, Term, Terms } from "../components/Concept.js";
import { Callout } from "../components/Callout.js";
import { Example } from "../components/Example.js";
import { DocPage } from "../components/DocPage.js";
import { Table } from "../components/Tables.js";
import { CheckboxReject } from "../examples/CheckboxReject.js";
import { ToggleErrors } from "../examples/ToggleErrors.js";

export function ActionPropsPage() {
  return (
    <DocPage
      title="Action props"
      description="FUNSTACK UI components take action props instead of event handlers. Actions run inside the component's transition, may be async, and report errors to Error Boundaries. A change that had already happened is reported to an on* handler instead."
    >
      <p className="page-intro">
        FUNSTACK UI has no <code>onClick</code>, <code>onChange</code> or <code>onValueChange</code>
        . Interactive props are <em>actions</em>: callbacks that the component runs inside its own
        transition and awaits. A change that had already happened when the library heard of it, and
        that it could not hold, is reported to an{" "}
        <a href="#handlers">
          <code>on*</code> handler
        </a>{" "}
        instead.
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

      <h3 id="terms">Terms</h3>
      <Terms
        items={[
          {
            id: "settle",
            term: "Settle",
            definition:
              "An action settles when its promise resolves or rejects (a synchronous action settles when it returns). `data-pending` stays on until the settle and the render it causes have committed.",
          },
          {
            id: "adopt",
            term: "Adopt",
            definition:
              "A controlled parent adopts a dispatched value by setting its controlled prop to it (in the synchronous part of the action, or inside `startTransition` after an `await`).",
          },
          {
            id: "veto",
            term: "Veto",
            definition:
              "A controlled parent refuses a change by not adopting the value: when the action settles, the optimistic value snaps back to the committed one. Only a [request](#request) can be vetoed; a [dismissal](/concepts/browser-owned-state#dismissal) is a [fact](#fact) and cannot.",
          },
          {
            id: "urgent-update",
            term: "Urgent update",
            definition:
              "A state update outside any transition. React renders it at once, in the event that caused it, and does not hold it back for a pending transition. A `setState` in an event handler is urgent unless it is wrapped in `startTransition`.",
          },
          {
            id: "form-channel",
            term: "Form channel",
            definition:
              "React's own form machinery: `<form action>`, `useFormStatus`, `useActionState` and the automatic reset after a successful action. Independent of a control's change action; see [Form actions are a separate channel](#form-actions).",
          },
        ]}
      />

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

/** What an action's details has and a handler's does not. */
interface Rejectable {
  /** Call before the action settles: the request counts as rejected, and nothing is thrown. */
  readonly reject: () => void;
}

type ChangeAction<T, Details extends ActionDetails = ActionDetails> =
  Action<[next: T, details: Details & Rejectable]>;`}</CodeBlock>
      <p>
        The first argument is the next value, so the common case stays short. The second is a{" "}
        <code>details</code> object with the native DOM event (not React's synthetic one) and any
        component-specific fields, such as <code>reason</code> (below) or Dialog's{" "}
        <code>returnValue</code>. An action's <code>details</code> also has{" "}
        <a href="#reject">
          <code>reject()</code>
        </a>
        . The named details types (<code>SwitchCheckedChangeDetails</code>) do not include it,
        because handlers share them: a function written apart from the JSX annotates{" "}
        <code>details: SwitchCheckedChangeDetails &amp; Rejectable</code> (both exported from{" "}
        <code>@funstack/ui/types</code> and the root entry). The return type is <code>unknown</code>
        : return a promise and the component awaits it, return anything else and it is ignored. That
        means a function that returns data (a Server Function, a <code>fetch</code>) type-checks
        without wrapping.
      </p>
      <ConceptExample component="Toggle" href="/components/toggle">
        <p>
          A change action that returns data, and (on <a href="/components/tabs">Tabs</a>) one that
          returns nothing:
        </p>
        <CodeBlock>{`<Toggle pressedChangeAction={(pressed) => api.setFavorite(id, pressed)}>Favorite</Toggle>
<Tabs.Root defaultValue="general" valueChangeAction={(tab) => analytics.track(tab)}>...</Tabs.Root>`}</CodeBlock>
      </ConceptExample>

      <h3 id="handlers">
        Requests and facts: <code>on*</code> handlers
      </h3>
      <p>
        The name of a callback prop is a contract. A prop named <code>action</code> or{" "}
        <code>fooAction</code> receives a <Term id="request">request</Term>: the component calls it
        before the change is committed, inside a transition, and awaits it; a rejection, or a
        controlled parent that does not adopt the value, rolls the UI back. A prop named{" "}
        <code>onFoo</code> is an{" "}
        <Term id="on-handler">
          <code>on*</code> handler
        </Term>
        : it reports a <Term id="fact">fact</Term>, a change that had already happened when the
        library heard of it and that the library could not hold.
      </p>
      <p>
        The test: if the callback rejects, or the parent ignores it, can the library put the UI back
        without the user noticing? If yes, the change is a request. A form reset or a click before
        hydration on a checkbox passes the test (the DOM is the optimistic state, and the library
        restores it on a refusal), so it is a request even though the browser changed the DOM first.
        A popup the user dismissed with Escape fails it: the user saw it go away.
      </p>
      <p>
        Most state has only an action. Where both kinds of change exist, a component offers both
        props, and each component page documents its own handlers. Every <code>on*</code> handler
        the library defines follows one rule:
      </p>
      <ul>
        <li>
          Called <strong>synchronously</strong>, in the event that reports the fact, outside any
          transition: a <code>setState</code> in the body is an{" "}
          <a href="#urgent-update">urgent update</a>.
        </li>
        <li>
          <strong>Not awaited</strong>, with no pending or optimistic state: the change has already
          happened.
        </li>
        <li>
          It <strong>may return a promise</strong> (an <code>async</code> function, a Server
          Function). A rejection, like a synchronous throw, goes to <code>reportError</code>, never
          to an Error Boundary; a throw does not stop the library from updating the component.
          Nothing warns about a returned promise.
        </li>
      </ul>
      <CodeBlock language="typescript">{`/** Called synchronously, outside any Transition, and not awaited. */
type UrgentChangeHandler<T, Details extends ActionDetails = ActionDetails> =
  (next: T, details: Details) => void;
/** The same for a fact that carries no next value. */
type UrgentHandler<Details extends ActionDetails = ActionDetails> = (details: Details) => void;`}</CodeBlock>
      <p>
        Set state directly in a handler, not inside <code>startTransition</code> and not after an{" "}
        <code>await</code>. The advice for actions (
        <a href="#after-await">wrap a state update after an await</a>) does not apply: a handler is
        not in a transition, and a late update leaves the UI showing the old value for a while.
      </p>
      <ConceptExample component="Popover" href="/components/popover">
        <p>
          An overlay's open state has both kinds of change. Opening, and a close the user asks one
          of its parts for (a Close button), are requests: <code>openChangeAction</code>. Escape or
          a click outside is a fact: the browser has already hidden the popup when{" "}
          <code>onOpenChange(false, details)</code> is called from its event. A controlled Root
          adopts both, with the same setter:
        </p>
        <CodeBlock>{`const [open, setOpen] = useState(false);
<Popover.Root open={open} openChangeAction={setOpen} onOpenChange={setOpen}>`}</CodeBlock>
        <p>
          See <a href="/concepts/browser-owned-state#requests-and-facts">Requests and facts</a> for
          what each one does to the popup.
        </p>
      </ConceptExample>
      <ConceptExample component="Combobox" href="/components/combobox">
        <h4 id="urgent-lane">The text of a controlled input</h4>
        <p>
          React requires a controlled text input to update in the same event as the keystroke, so
          typed text is a fact: when the library hears of it, the DOM already holds it. Combobox
          keeps the usual pair, <code>inputValue</code> / <code>defaultInputValue</code>, but its
          callback is a handler, <code>onInputValueChange</code>, not an action.{" "}
          <code>{"(next) => setText(next)"}</code> is the whole controlled pattern. What the text
          drives (a deferred query, an open, a selection) goes back to transitions at once; a fetch
          whose results should render belongs there, through <code>useDeferredValue</code> of the
          text.
        </p>
      </ConceptExample>

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
            "The user acted on one of the component's parts: a click, Enter or Space, focus in automatic activation, a Close button or a form submit.",
            "The native `click`, `keydown` or `focusin` event. For checkboxes and radios always the `click`, including Space and arrow keys.",
          ],
          [
            '`"platform"`',
            "The browser changed the state by itself: find-in-page, a form reset, or an interaction before hydration found on mount. Never a direct user interaction (a click, key press or touch).",
            "The platform event (`beforematch`, `toggle`, `reset`), or `undefined` on mount.",
          ],
          [
            '`"dismiss"`',
            'The user closed the component without one of its parts: Escape, Android back, an assistive-technology dismiss, a click outside; also a close nobody caused through the component (script, another top-layer element, focus leaving). On an overlay most of these are [facts](#fact), reported to `onOpenChange`. Also a [Toast](/components/toast)\'s Close part, which only means "go away".',
            "The platform's `close` or `toggle` event; for Toast the click or keydown.",
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
        description of its change action and of its <code>on*</code> handler. A{" "}
        <code>"platform"</code> dispatch goes through the same action as a user one, so a controlled
        parent hears about a form reset and decides whether to adopt it. See{" "}
        <a href="/concepts/browser-owned-state">Browser-owned state</a>.
      </p>

      <h3 id="details-valid">
        <code>details.valid</code>
      </h3>
      <p>
        Every value action of a form control (Checkbox, Switch, RadioGroup, CheckboxGroup, Select,
        MultiSelect, Combobox, TextField, NumberField, Slider, and OTPField's{" "}
        <code>completeAction</code>) says whether the requested value passes constraint validation:
        the control's native constraints (<code>required</code>, <code>pattern</code>,{" "}
        <code>min</code> / <code>max</code> / <code>step</code>, a group's &quot;at least one&quot;)
        and, inside a <a href="/components/field">Field</a>, the Field's <code>validate</code>, for
        that value. A server error does not count: it is about a value already submitted. Every
        reason carries it (a form reset, a value adopted at mount, NumberField's{" "}
        <code>"dismiss"</code>). Handlers and the actions of other components have none.
      </p>
      <CodeBlock>{`<TextField
  required
  defaultValue={task.title}
  valueCommitAction={async (next, details) => {
    if (!details.valid) return; // nothing saved
    await saveTitle(next);
  }}
/>`}</CodeBlock>
      <p>
        It is information, not a gate: the library dispatches an invalid value like any other (the
        control holds what the user entered, and a Field shows the error). An action that saves
        checks it. Uncontrolled, the early return keeps the invalid value in the control and saves
        nothing; a controlled parent that does not adopt it rolls back instead. To put the saved
        value back instead, return <code>details.reject()</code> (<a href="#reject-valid">below</a>
        ). It is an ordinary boolean field, so a Server Function passed directly receives it.
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
          interactions (clicking the tab that is already selected) do not dispatch either. A form
          reset is not a user interaction with the control: <code>form.reset()</code> resets
          disabled inputs too, so a disabled control still follows it, with{" "}
          <code>reason: "platform"</code>.
        </li>
        <li>
          <strong>Parts are never natively disabled while pending.</strong> A trigger that changes
          state sets <code>data-pending</code> and takes every click: a second click is a new intent
          (below). What a <a href="/concepts/pending-and-optimistic#pure-trigger">pure trigger</a>{" "}
          does with a second activation while its own action is pending is its{" "}
          <code>whilePending</code> prop: <code>"run"</code> runs it again (the default of a{" "}
          <code>Button</code>), <code>"ignore"</code> drops it and makes the part{" "}
          <code>aria-disabled="true"</code> meanwhile (the default of a Close part; use it on a Save
          that must not run twice). See{" "}
          <a href="/concepts/pending-and-optimistic#second-click">A second click while pending</a>.
        </li>
      </ul>

      <h3 id="after-await">
        After an <code>await</code>, wrap state updates yourself
      </h3>
      <p>
        This is a React rule, and the library cannot hide it: a <code>setState</code> that runs
        after your own <code>await</code> is no longer part of the transition. Wrap it in{" "}
        <code>startTransition</code>.
      </p>
      <ConceptExample component="Tabs" href="/components/tabs">
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
      </ConceptExample>

      <h3 id="pending-actions-hold-transitions">Pending actions hold other transitions</h3>
      <p>
        While any async action is pending, React holds <em>every</em> transition update in the app,
        from any component, until the last pending action has settled. Then it commits them
        together. This is React's behaviour, not the library's: React cannot tell which action an
        update belongs to, so it puts all of them in one batch. That includes a router navigation,
        when the router renders it in a transition.
      </p>
      <p>
        The library commits its state changes in transitions (that is what lets content that{" "}
        <a href="/concepts/suspense">suspends</a> keep the old UI on screen). So a popup that opens,
        a tab panel that switches or an item that expands waits for any pending action, even one in
        an unrelated component, and even when it has no action of its own. Its{" "}
        <a href="/concepts/pending-and-optimistic#trigger">trigger</a> still shows the{" "}
        <a href="/concepts/pending-and-optimistic#optimistic">optimistic value</a> at once, with{" "}
        <code>data-pending</code>; the{" "}
        <a href="/concepts/pending-and-optimistic#content-region">content region</a> waits. Not
        held, because the browser performs them and the library holds no state for them: the changes
        of a component in <a href="/concepts/browser-owned-state#js-free-mode">JS-free mode</a>, and
        a <a href="/concepts/browser-owned-state#dismissal">dismissal</a>.
      </p>
      <p>
        How long the wait can be, measured in a test app built with the library: a checkbox whose
        awaited save took 300 to 1200 ms, and while it saved, a menu took 1.3 to 1.8 s to open and a
        tab switch 1.4 to 1.9 s. Typing in a text input took 20 ms. The time beyond the save was the
        app's refetch, which the save's action started (see{" "}
        <a href="#refetch-after">Start refetches after the action</a>).
      </p>

      <h4 id="what-waits">What waits and what does not</h4>
      <p>Held until every pending action has settled:</p>
      <ul>
        <li>
          Every transition update: a <code>setState</code> inside <code>startTransition</code> or
          any <code>useTransition</code>, a state update in the synchronous part of an action, and
          the library's own commits.
        </li>
        <li>
          A transition that a pending action starts after its <code>await</code> joins the same
          batch. If its render suspends (a refetch), the held updates wait for that data too, even
          though the action has settled.
        </li>
      </ul>
      <p>Not held:</p>
      <ul>
        <li>
          <a href="#urgent-update">Urgent updates</a>, such as typing into a controlled input.
        </li>
        <li>
          Values set with{" "}
          <a href="https://react.dev/reference/react/useOptimistic">
            <code>useOptimistic</code>
          </a>
          , which is why a trigger flips at once.
        </li>
        <li>
          The background render of{" "}
          <a href="https://react.dev/reference/react/useDeferredValue">
            <code>useDeferredValue</code>
          </a>
          : content that follows a deferred value updates while an action is pending, and if it
          suspends, the old content stays without a fallback.
        </li>
      </ul>

      <h4 id="await-only">Return the promise only when the UI must wait for it</h4>
      <p>
        Return (or <code>await</code>) the save when the UI should wait for it: the component then
        shows pending state and rolls back if the save fails. For background work, start the promise
        and return nothing. The action then settles at once, so nothing waits for the save.
      </p>
      <p>
        What you give up: no <code>data-pending</code> while the save runs, and no{" "}
        <a href="/concepts/pending-and-optimistic#rollback">rollback</a>. The library never sees the
        promise, so a rejection does not reach an Error Boundary either: handle it yourself (with{" "}
        <code>.catch</code>), or it becomes an unhandled rejection.
      </p>
      <ConceptExample component="Tabs" href="/components/tabs">
        <CodeBlock>{`// The panel switches immediately; the save runs in the background.
valueChangeAction={(next) => { void saveSelection(next); }}

// The panel switches when the save succeeds; the tab shows pending meanwhile.
valueChangeAction={async (next) => { await saveSelection(next); }}`}</CodeBlock>
      </ConceptExample>

      <h4 id="refetch-after">Start refetches after the action</h4>
      <p>
        A refetch started inside the action, after its <code>await</code>, joins the action's batch:
        every transition held during the save then also waits for the refetched data. Start it once
        the action has settled instead. A callback queued with <code>setTimeout</code> runs after
        the component's transition has settled, so the refetch is a transition of its own. Better
        still, skip the refetch when the component already shows the new value.
      </p>
      <ConceptExample component="Checkbox" href="/components/checkbox">
        <CodeBlock>{`// refresh() re-reads the task list; its render suspends until the data arrives.

// The refetch holds every open that waited for the save, until its data loads.
checkedChangeAction={async (checked) => {
  await saveTask(id, checked);
  startTransition(() => refresh());
}}

// Opens held by the save commit when the save settles; the refetch runs after.
checkedChangeAction={async (checked) => {
  await saveTask(id, checked);
  setTimeout(() => startTransition(() => refresh()));
}}`}</CodeBlock>
      </ConceptExample>

      <h4 id="urgent-open">Open your own controlled overlay urgently</h4>
      <p>
        When your own code opens a controlled overlay (a keyboard shortcut, a command palette), set
        its <code>open</code> state with an <a href="#urgent-update">urgent update</a>, not inside{" "}
        <code>startTransition</code>. An urgent update is not held, so the overlay opens even while
        a save is pending. The cost: the open is not a transition, so content that suspends shows
        the nearest Suspense fallback instead of keeping the old UI. Put a{" "}
        <code>&lt;Suspense&gt;</code> boundary inside the popup, or keep its content from
        suspending.
      </p>
      <ConceptExample component="Dialog" href="/components/dialog">
        <p>
          In the test app above, this dialog opened in 72 ms while a save was pending; opened inside{" "}
          <code>startTransition</code>, it took up to 2.3 s.
        </p>
        <CodeBlock>{`const [open, setOpen] = useState(false);

useEffect(() => {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "n" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      setOpen(true); // urgent: not held by a pending action
    }
  };
  document.addEventListener("keydown", onKeyDown);
  return () => document.removeEventListener("keydown", onKeyDown);
}, []);

<Dialog.Root open={open} openChangeAction={setOpen} onOpenChange={setOpen}>`}</CodeBlock>
      </ConceptExample>

      <h4 id="short-actions">Keep actions short</h4>
      <p>
        An action holds the whole app for as long as it is pending, so put in it only the work the
        UI must wait for. Leave out background saves, logging, analytics and prefetching: start them
        without returning their promise, or after the action has settled. A control that dispatches
        many times per gesture (a slider drag, a held stepper button, arrow keys that select as they
        move) needs a cheap action. Where a component also has an action that runs once per gesture,
        put the save there.
      </p>

      <h3>Errors go to Error Boundaries</h3>
      <p>
        An action that throws or rejects reaches the nearest Error Boundary above the component that
        owns the transition (the{" "}
        <a href="/concepts/pending-and-optimistic#state-owner">state owner</a>: usually the{" "}
        <code>Root</code>, or a single-element component such as a Toggle). The library never
        swallows an error: the rejection of an older action that a newer one superseded goes to{" "}
        <code>reportError</code> instead (see{" "}
        <a href="/concepts/action-props#overlapping-actions">Overlapping actions</a>), and so does a
        rejection that arrives after the component unmounted (a toast or menu closed while its
        action ran) or while it is hidden (an <code>&lt;Activity&gt;</code>, a closed overlay with{" "}
        <code>keepMounted</code>, or a Suspense boundary showing its fallback), since React has no
        render left to deliver it through. A hidden component's error is reported once and does not
        show the Error Boundary when the component reappears. The optimistic state reverts
        automatically, and uncontrolled state is only written after success, so a failed action
        leaves it untouched.
      </p>
      <p>
        For inline error UI instead, catch inside the action and call{" "}
        <a href="#reject">
          <code>details.reject()</code>
        </a>
        . Without that call a caught error makes the action resolve, which counts as success: in
        uncontrolled mode the new value is committed, and a menu item or a toast's Undo closes its
        container.
      </p>
      <ConceptExample component="Toggle" href="/components/toggle">
        <p>
          The left Toggle catches its errors inline and vetoes in controlled mode; the right one
          lets them reach a boundary.
        </p>
        <Example file="ToggleErrors.tsx">
          <ToggleErrors />
        </Example>
      </ConceptExample>

      <h3 id="reject">Handling a failed save without an Error Boundary</h3>
      <p>
        An action that catches its own error, shows its own message and then calls{" "}
        <code>details.reject()</code> before it settles is treated as if it had rejected, except
        that nothing is thrown and nothing is reported:
      </p>
      <ul>
        <li>the optimistic value reverts, in uncontrolled mode too (nothing is committed);</li>
        <li>
          a part that closes its container after its action does not close it: a{" "}
          <code>Menu.Item</code> leaves the menu open, a <code>Toast.Action</code> keeps its toast,
          a Close part or <code>AlertDialog.Action</code> keeps the dialog open;
        </li>
        <li>
          an overlay's <code>openChangeAction</code> leaves <code>open</code> as it was;
        </li>
        <li>
          no Error Boundary, no <code>reportError</code>, no <code>data-rejected</code>: the message
          is yours to render.
        </li>
      </ul>
      <ConceptExample component="Checkbox" href="/components/checkbox">
        <p>
          Uncontrolled checkboxes that save on change. Tick &quot;Make the next save fail&quot;,
          then a task: the box rolls back and the message appears below the list.
        </p>
        <Example file="CheckboxReject.tsx" css="checkbox.css">
          <CheckboxReject />
        </Example>
      </ConceptExample>
      <p>The rules:</p>
      <ul>
        <li>
          <strong>Read when the action settles.</strong> A synchronous action calls it before
          returning, an async one at any point before its promise resolves. Pending does not end
          early: the part stays <code>data-pending</code> until the action settles.
        </li>
        <li>
          <strong>Call it before the action settles.</strong> A call afterwards (from a promise the
          action did not return or await, or a timer) does nothing and logs a development warning.
          The usual mistake is <code>{"void save().catch(() => details.reject())"}</code>: return or
          await the promise instead.
        </li>
        <li>
          <strong>Twice is once, and a throw wins.</strong> It cannot be taken back; an action that
          calls it and then throws anyway is an ordinary rejection and reaches the boundary.
        </li>
        <li>
          <strong>Overlaps.</strong> It belongs to its own dispatch. On an older action that a newer
          one superseded it changes nothing on screen; in a set-valued component (CheckboxGroup)
          that one change is dropped and the others are kept.
        </li>
        <li>
          <strong>Controlled mode.</strong> The parent's prop stays the truth: for the value,{" "}
          <code>reject()</code> equals not adopting. It is still what keeps a menu, a toast or a
          dialog open.
        </li>
        <li>
          <strong>Actions only.</strong> An <code>on*</code> handler reports a fact and has no{" "}
          <code>reject</code>. A form action (<code>Form.Root action</code>,{" "}
          <code>Dialog.Form action</code>) receives <code>FormData</code> and no details; it returns
          errors instead (<a href="/components/field">Field and Form</a>).
        </li>
      </ul>
      <h4 id="reject-server">With a Server Function</h4>
      <p>
        Like <code>event</code>, <code>reject</code> is not an own property of <code>details</code>,
        so it is not sent to the server: a Server Function passed directly has no{" "}
        <code>details.reject</code>, and refuses by throwing. To show a message instead, wrap it on
        the client:
      </p>
      <CodeBlock>{`checkedChangeAction={async (next, details) => {
  const result = await setTaskDone(task.id, next); // "use server", returns { ok, message }
  if (!result.ok) {
    toast({ title: result.message });
    details.reject();
  }
}}`}</CodeBlock>
      <p>
        <code>reject</code> does not depend on <code>this</code>:{" "}
        <code>{"async (next, { reject }) => …"}</code> works. A copy (
        <code>{"{ ...details }"}</code>) has no <code>reject</code>.
      </p>
      <h4 id="reject-valid">
        With <code>details.valid</code>
      </h4>
      <p>
        The two give the two things an inline-save action can do with an invalid value: keep it in
        the control and save nothing, or put the saved value back.
      </p>
      <CodeBlock>{`valueCommitAction={async (next, details) => {
  if (!details.valid) return;                  // the text stays; the Field shows why
  // or: if (!details.valid) return details.reject();   // the saved text is back
  await saveTitle(next);
}}`}</CodeBlock>

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
        Components whose value is a set of items (CheckboxGroup, and ToggleGroup and Accordion
        without <code>exclusive</code>) commit each change on its own instead: once every
        overlapping action has settled, the changes whose actions resolved are applied in the order
        they were made, and a change whose action rejected is left out. Check A, then B: if saving A
        fails and saving B succeeds, the uncontrolled group ends with only B checked. B's action
        still received <code>["A", "B"]</code> as <code>next</code>, because A was pending when B
        was clicked, so save <code>details.added</code> and <code>details.removed</code> rather than
        the whole <code>next</code>.
      </p>
      <p>
        In controlled mode the committed value is your state, and the library cannot order your
        updates. A <code>setState</code> after an <code>await</code> runs when that action's promise
        resolves, so the updates land in completion order: an older response that arrives last
        overwrites the newer value. Guard the update yourself (keep the latest request's id in a ref
        and skip a stale one), or queue the calls with <code>useActionState</code> as below.
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
      <ConceptExample component="Toggle" href="/components/toggle">
        <CodeBlock>{`const [pressed, dispatch] = useActionState(async (_previous: boolean, next: boolean) => {
  await api.setFavorite(id, next); // runs only after the previous call has finished
  return next;
}, initial);

<Toggle pressed={pressed} pressedChangeAction={(next) => dispatch(next)}>Favorite</Toggle>`}</CodeBlock>
      </ConceptExample>
      <p>
        The component stays pending and keeps showing the latest optimistic value until the queue
        has drained. React's rules for the queue apply: when one call throws, React skips the calls
        still queued behind it and the error goes to the nearest Error Boundary above the component
        that called <code>useActionState</code>.
      </p>
      <p>
        When an older action rejects after a newer one has started, React does not send the error to
        an Error Boundary: only the latest action's failure is thrown, and the UI keeps showing the
        latest intent. The library does the same, and also passes the older rejection to the global{" "}
        <code>reportError</code>, as React's standalone <code>startTransition</code> does with a
        rejection it has nowhere else to send. The error is not lost: it fires the window{" "}
        <code>error</code> event, so error monitoring sees it, and a test runner reports it as an
        uncaught error.
      </p>

      <h3>Server Functions work directly</h3>
      <p>
        A Server Function (<code>"use server"</code>) can be passed straight to any action prop,
        from a Server Component or a Client Component, without a client wrapper. The server receives
        the same arguments, <code>(next, details)</code>, with one difference: a DOM event cannot be
        sent to the server, so <code>details.event</code> is <code>undefined</code> there, and{" "}
        <a href="#reject-server">
          <code>details.reject</code>
        </a>{" "}
        is missing. Every other field of <code>details</code> (<code>reason</code>, for example)
        arrives intact.
      </p>
      <ConceptExample component="Toggle" href="/components/toggle">
        <CodeBlock>{`// app/post.tsx: a Server Component
import { Toggle } from "@funstack/ui/toggle";
import { setFavorite } from "./actions"; // "use server"

<Toggle defaultPressed={post.favorited} pressedChangeAction={setFavorite.bind(null, post.id)}>
  Favorite
</Toggle>`}</CodeBlock>
      </ConceptExample>
      <Callout title="details.event is not an ordinary field">
        <p>
          To keep <code>details</code> serialisable, <code>event</code> is not an own property of
          the object, so some operations do not see it. <code>Object.keys(details)</code>, spreading
          and <code>JSON.stringify</code> do not include <code>event</code>;{" "}
          <code>"event" in details</code> and <code>details.event</code> do.{" "}
          <code>structuredClone(details)</code> throws. In tests, assert <code>details.event</code>{" "}
          directly rather than <code>toEqual({"{ event }"})</code>. An action's{" "}
          <code>details.reject</code> is served the same way.
        </p>
      </Callout>

      <h3 id="form-actions">Form actions are a separate channel</h3>
      <p>
        <code>&lt;form action&gt;</code>, <code>useFormStatus</code> and React's automatic form
        reset are React's form channel. A control's change action is per control and runs in the
        control's own transition. The two are independent:
      </p>
      <ul>
        <li>
          A native form control (a Switch, for example) inside{" "}
          <code>&lt;form action={"{serverFn}"}&gt;</code> needs no change action: with a{" "}
          <code>name</code> it posts its value like any native input, and{" "}
          <code>useFormStatus().pending</code> covers the submit.
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
          closes its dialog once the form action has settled. It watches the form's status and
          passes your action to <code>&lt;form action&gt;</code> unchanged, instead of wrapping it
          in a function of its own. That matters for a Server Function: React can only{" "}
          <a href="https://react.dev/reference/react-dom/components/form#handle-form-submission-with-a-server-function">
            submit a form before JavaScript loads
          </a>{" "}
          when the <code>action</code> is the Server Function itself; a client wrapper around it
          would need JavaScript to run.
        </li>
        <li>
          While a form action is pending, a control's transition waits for it, and the reverse:
          React commits them together.
        </li>
      </ul>

      <h3>What about native handlers?</h3>
      <p>
        DOM event props that a part does not use itself pass through to the element (an{" "}
        <code>onPointerEnter</code> on a Tab, an <code>onClick</code> on a Tooltip Trigger). They
        are the platform's API, not the library's. Handlers the part installs itself, in any mode
        (for example <code>onClick</code> on a Toggle), are removed from its props type: the part's
        API for that event is its action prop. For the raw event, put a handler on the{" "}
        <code>render</code> element or use <code>ref</code> (
        <a href="/concepts/render">Replacing the element</a>).
      </p>
    </DocPage>
  );
}
