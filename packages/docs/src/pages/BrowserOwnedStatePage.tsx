import { CodeBlock } from "../components/CodeBlock.js";
import { ConceptExample, Terms } from "../components/Concept.js";
import { DocPage } from "../components/DocPage.js";
import { Table } from "../components/Tables.js";

export function BrowserOwnedStatePage() {
  return (
    <DocPage
      title="Browser-owned state"
      description="Some state belongs to the browser: the popover top layer, <details open>, dismissing a <dialog>, a native input before React hears about it. FUNSTACK UI observes it instead of driving it."
    >
      <p className="page-intro">
        "Transition by default" is about state the library owns. Some state belongs to the browser,
        which changes it before React hears about it. FUNSTACK UI prefers that state whenever the
        platform offers it, because it is the only way a component can work without JavaScript.
      </p>

      <h3 id="terms">Terms</h3>
      <Terms
        items={[
          {
            id: "library-owned",
            term: "Library-owned state",
            definition:
              "State held in React and changed only by the library, usually inside the [state owner](/concepts/pending-and-optimistic#state-owner)'s transition after the user acts on a [trigger](/concepts/pending-and-optimistic#trigger). Some library-owned state is urgent instead (typed text, a toast queue): still the library's, but not a transition.",
          },
          {
            id: "browser-owned",
            term: "Browser-owned state",
            definition:
              "State held in the DOM and changed by the browser itself: whether a `<details>` is open, whether a popover is in the top layer (the layer the browser draws above the whole page), whether a dialog is shown. The library reads it; it does not keep a copy in React state.",
          },
          {
            id: "dismissal",
            term: "Dismissal",
            definition:
              "Closing something without one of its parts: Escape, the Android back gesture, an assistive-technology dismiss, a click outside, or another top-layer element opening (the Popover API calls the last two light dismiss).",
          },
          {
            id: "invoker",
            term: "Invoker",
            definition:
              'A button that names a popover or dialog by id, so that the browser itself opens or closes it on click, without JavaScript: through `popovertarget` (the Popover API) or through `commandfor` and `command` (Invoker Commands). A `<button>` or an `<input type="button">` / `<input type="reset">` can be one; a disabled button and a submit button inside a form are not. See [Triggers of a popup](#popup-triggers).',
          },
          {
            id: "foreign-invoker",
            term: "Foreign invoker",
            definition:
              "An invoker of your own that targets a component's popup or dialog, but is not one of the component's parts.",
          },
          {
            id: "platform-path",
            term: "Platform path",
            definition:
              'A change the browser makes to library-owned state on its own, without a click the library sees: a form reset, find-in-page opening an item, a click before hydration. The component dispatches it like a user change, with `details.reason: "platform"`, and re-applies the committed state afterwards.',
          },
          {
            id: "request-and-fact",
            term: "Request and fact",
            definition:
              "A [request](/concepts/action-props#request) is a change the library can still roll back: it goes to an action prop (`openChangeAction`) before it is committed. A [fact](/concepts/action-props#fact) is a change that had already happened when the library heard of it, and that it could not hold: it is reported to an [`on*` handler](/concepts/action-props#on-handler) (`onOpenChange`). Both terms are defined on Action props; see [Requests and facts](#requests-and-facts) for what they mean for a popup.",
          },
          {
            id: "parts-close",
            term: "A part's close",
            definition:
              "A close the user asks one of the component's parts for (a Close button, the Trigger, a form submit). It is a request: dispatched in a transition, awaited, vetoable and animatable. The opposite of a dismissal.",
          },
          {
            id: "js-free-mode",
            term: "JS-free mode and library mode",
            definition:
              "Some components can run either way. In **JS-free mode** (no controlled or default state, no change action and no `on*` handler), the browser owns the state and the library adds no behaviour on the native path. In **library mode** (any of those props), the state is library-owned. See [Two modes](#two-modes).",
          },
        ]}
      />

      <h3>Two kinds of state</h3>
      <Table
        head={["", "Library-owned", "Browser-owned"]}
        rows={[
          [
            "Who changes it",
            "the library, inside its transition",
            "the browser (hover, light dismiss, Escape, find-in-page, a summary click, an [invoker](#invoker))",
          ],
          [
            "Optimistic state",
            "React state ([optimistic](/concepts/pending-and-optimistic#optimistic), `useOptimistic`)",
            "the DOM itself",
          ],
          [
            "Callback",
            "an action prop for a [request](/concepts/action-props#request), awaited; an `on*` handler for a [fact](/concepts/action-props#fact) (typed text)",
            "an `on*` handler for a fact (`onOpenChange`), not awaited; or none",
          ],
          ["Styling", "`data-*` attributes", "pseudo-classes: `:popover-open`, `:open`"],
          [
            "Animation",
            "`transition` prop (`<ViewTransition>`)",
            "CSS: `@starting-style`, `transition-behavior: allow-discrete`",
          ],
        ]}
      />
      <p>
        The library never mirrors browser-owned state into React state. It reads the DOM when it
        needs to, and it does not duplicate a pseudo-class with a data attribute. State that nobody
        persists or awaits is left to the browser entirely, with no prop and no action. Whether a
        hint popup (such as a tooltip) is showing is one example. One read is mirrored: whether a
        popup is shown, where no native element exposes it to assistive technology: on a Trigger
        that is no invoker, and on the Combobox input (see{" "}
        <a href="#popup-triggers">Triggers of a popup</a>). Each component page says what it leaves
        to the browser in its <strong>Browser-owned state</strong> section.
      </p>
      <ConceptExample component="Tooltip" href="/components/tooltip">
        <p>
          A tooltip's visibility is not application state. The popup is a <code>popover</code> in
          the top layer, so Tooltip has no <code>open</code> prop, no action and no{" "}
          <code>data-open</code>: <code>:popover-open</code> already says it. Style and animate it
          in CSS:
        </p>
        <CodeBlock language="css">{`.tip { opacity: 0; transition: opacity 120ms, display 120ms allow-discrete, overlay 120ms allow-discrete; }
.tip:popover-open {
  opacity: 1;
  @starting-style { opacity: 0; }
}
/* The trigger of an open tooltip: the popup is its next sibling. */
.trigger:has(+ .tip:popover-open) { outline: 1px solid; }`}</CodeBlock>
      </ConceptExample>

      <h3 id="two-modes">Two modes, one anatomy</h3>
      <p>
        Some components built on a native element that does the whole interaction offer both (their
        pages have a <strong>Two modes</strong> section). Without any controlled value, default
        value, change action or <code>on*</code> handler it runs in{" "}
        <a href="#js-free-mode">JS-free mode</a>: the browser owns the state and nothing runs when
        it changes. Add any of them and the component switches to <strong>library mode</strong>: the
        native interaction is intercepted, the state is React state changed in a transition, and
        triggers get optimistic data attributes and <code>data-pending</code>. The parts and the
        markup are the same in both. The mode is decided on the first render; switching between them
        later is not supported (development warning).
      </p>
      <p>
        The browser can still change the state in library mode (find-in-page, a text fragment, a
        click before hydration). The component turns that into a regular dispatch with{" "}
        <code>details.reason === "platform"</code>, and once the action settles it re-applies the
        committed state to the DOM, so a controlled parent that refuses the change gets its state
        back.
      </p>
      <ConceptExample component="Accordion" href="/components/accordion">
        <p>
          An Accordion without <code>value</code>, <code>defaultValue</code> and{" "}
          <code>valueChangeAction</code> leaves every <code>&lt;details open&gt;</code> to the
          browser, and <code>exclusive</code> renders the native <code>name</code> group. With any
          of them, the summary click is intercepted and open state changes in a transition.
        </p>
        <CodeBlock>{`// JS-free: the browser owns open state.
<Accordion.Root exclusive>...</Accordion.Root>

// Library mode: transitions, actions, optimistic state.
<Accordion.Root exclusive defaultValue={null} valueChangeAction={save}>...</Accordion.Root>`}</CodeBlock>
      </ConceptExample>

      <h3 id="requests-and-facts">Requests and facts</h3>
      <p>
        For something that opens and closes in library mode, a change is either a{" "}
        <a href="/concepts/action-props#request">request</a> or a{" "}
        <a href="/concepts/action-props#fact">fact</a>, and each has its own prop. Opening, and a
        close the user asks one of the component's parts for, are requests: the click, submit or
        command is cancelled and dispatched in a transition, <code>openChangeAction</code> is
        awaited, a controlled parent can veto it, and it can animate with a view transition. A{" "}
        <a href="#dismissal">dismissal</a> is a fact: the element closes natively and at once, and{" "}
        <code>onOpenChange(false, details)</code> is called synchronously from the browser's own
        event. Nothing is pending, no view transition runs (a CSS exit animates it), and the
        committed state is <code>false</code> in the same event. A close the library performs itself
        but cannot hold, because the user has already moved on (focus leaving the popup), is a fact
        too.
      </p>
      <p>
        The line sits where the platform lets the library cancel a step freely: a part's click
        (which cancels its command), a <code>command</code> event, a form's <code>submit</code>.
        Escape and the back gesture reach the element as an HTML{" "}
        <a href="https://html.spec.whatwg.org/multipage/interaction.html#close-requests">
          close request
        </a>{" "}
        (the platform's term, not a request in the sense above), whose <code>cancel</code> event the
        browser honours only once per user activation, and a user who pressed Escape expects the
        element to go away now. So the library never holds a dismissal.
      </p>
      <p>
        A popup the browser opened before hydration is still a request (
        <code>openChangeAction(true, {'{ reason: "platform" }'})</code>): the library can roll it
        back by hiding the empty popup, and its load-on-open code runs. So <code>onOpenChange</code>{" "}
        is only ever called with <code>false</code>.
      </p>
      <p>
        <strong>Controlled mode needs both props.</strong> Pass the same setter to both:{" "}
        <code>openChangeAction</code> adopts a request (in a transition), <code>onOpenChange</code>{" "}
        adopts a fact (an <a href="/concepts/action-props#urgent-update">urgent update</a>). Set
        state directly in <code>onOpenChange</code>, never in <code>startTransition</code> and never
        after an <code>await</code>: a parent that still says <code>open={"{true}"}</code> once the
        browser's event has been handled gets the element shown again at once, and a late{" "}
        <code>false</code> then closes it a second time. A controlled Root without{" "}
        <code>onOpenChange</code> warns in development.
      </p>
      <p>
        A parent that keeps <code>open={"{true}"}</code> after a dismissal on purpose gets the same
        re-open. This is not a veto: the user sees the element close and come back, possibly for a
        frame. A popup that must not be dismissed is set up on the platform side instead, where the
        component offers it. The re-open never moves focus: a Menu, a Combobox, a Popover (its
        default <code>&lt;dialog&gt;</code> as well as a <code>&lt;div&gt;</code>) or a non-modal
        Dialog shown again this way leaves focus where the dismissal put it (the Trigger after
        Escape, the field the user clicked, the next field after Tab). So a parent that never adopts{" "}
        <code>false</code> cannot trap the keyboard in the popup, and the re-open does not take
        focus away from the field the user just clicked. A modal Dialog (the default) is the
        exception: it must hold focus, so its re-open moves focus inside as on any open.
      </p>
      <p>
        <strong>Uncontrolled, pass what you need.</strong> <code>openChangeAction</code> for work an
        open or a part's close must wait for (loading data on open); <code>onOpenChange</code> to
        observe a dismissal (logging it, remembering it). To hear every close, pass one function to
        both props and check its first argument: the action is called with <code>true</code> for an
        open too.
      </p>
      <ConceptExample component="Dialog" href="/components/dialog">
        <p>
          A library-mode Dialog opens through its Trigger and closes through its Close parts and{" "}
          <code>Dialog.Form</code> after <code>openChangeAction</code> resolves. Escape or a click
          outside closes it at once and calls <code>onOpenChange(false, details)</code> with{" "}
          <code>reason: "dismiss"</code>. Controlled, with both props:
        </p>
        <CodeBlock>{`const [open, setOpen] = useState(false);
<Dialog.Root open={open} openChangeAction={setOpen} onOpenChange={setOpen}>`}</CodeBlock>
        <p>
          A Dialog without <code>lightDismiss</code> ignores a click outside; Escape still closes a
          modal dialog.
        </p>
      </ConceptExample>

      <h3 id="one-escape">One Escape closes one layer</h3>
      <p>
        A <strong>layer</strong> here is anything an Escape can close: a popup, a dialog, a toast,
        or the unsaved text of an input that reverts on Escape. Layers nest (a tooltip inside a
        dialog, a listbox inside a drawer), and one Escape closes only one of them. The browser does
        this for the layers it owns (a modal dialog, an <code>auto</code> popover) through its{" "}
        <a href="https://html.spec.whatwg.org/multipage/interaction.html#close-watchers">
          close watchers
        </a>
        . Where the library handles Escape in JavaScript, it follows the same order:
      </p>
      <ul>
        <li>
          An input with an edited draft takes the Escape first: it reverts the text, and nothing
          else closes.
        </li>
        <li>
          Then a tooltip or a hover card that is showing, wherever focus is; with two unrelated
          ones, the one that opened first.
        </li>
        <li>
          Then the innermost layer around the focus. The next Escape reaches the layer outside it.
        </li>
      </ul>
      <p>
        To keep a layer open on Escape, call <code>preventDefault()</code> on the{" "}
        <code>keydown</code>. <code>stopPropagation()</code> keeps none open: the browser skips the
        close request only for a cancelled <code>keydown</code>, and the library reads the same
        signal. An Escape pressed during an IME composition only ends the composition.
      </p>
      <ConceptExample component="Tooltip" href="/components/tooltip">
        <p>
          A Tooltip shown inside an open Dialog: the first Escape hides the tooltip and the dialog
          stays open; the second Escape closes the dialog.
        </p>
      </ConceptExample>

      <h3 id="popup-triggers">Triggers of a popup</h3>
      <p>
        A component whose popup is a popover has a <strong>Trigger</strong>: the part that opens and
        closes it. A Trigger rendered as a <code>&lt;button&gt;</code> names the popup with{" "}
        <code>popovertarget</code>, which makes it the popup's <a href="#invoker">invoker</a>. That
        relationship gives it three things from the browser:
      </p>
      <ul>
        <li>It can open the popup before hydration and with JavaScript off.</li>
        <li>
          A press on it is not a click outside: light dismiss spares the invoker of an open popover,
          so the Trigger's click can close the popup as <a href="#parts-close">a part's close</a>,
          awaited and animated.
        </li>
        <li>
          The browser exposes the popover's expanded or collapsed state on it. The Trigger therefore
          renders no <code>aria-expanded</code>;{" "}
          <a href="https://w3c.github.io/html-aria/">ARIA in HTML</a> forbids the attribute on an
          element with <code>popovertarget</code>.
        </li>
      </ul>
      <p>A component may give up one of these on purpose; its page says so.</p>
      <p>
        Only a <code>&lt;button&gt;</code> can be the Trigger's invoker. A Trigger rendered as a
        link or another element works through the library's click handler instead, and has none of
        the above: it renders <code>aria-expanded</code> itself, from whether the popup is shown;
        and a press on it while the popup is open counts as a click outside, so light dismiss closes
        the popup before the click arrives. That close is a{" "}
        <a href="/concepts/action-props#fact">fact</a>, reported to <code>onOpenChange</code> (with{" "}
        <code>reason: "activate"</code> and the click), not a request: it is not awaited, a
        controlled parent cannot veto it, and there is no view transition. A development warning
        says so. A disabled Trigger that stays focusable (it renders <code>aria-disabled</code>) is
        no invoker either, so that nothing native can open the popup.
      </p>
      <p>
        <strong>Two kinds of open state on a Trigger.</strong> What assistive technology hears is
        whether the popup is shown. In library mode, <code>data-open</code> is the{" "}
        <a href="/concepts/pending-and-optimistic#optimistic">optimistic</a> state: it flips at the
        click, while an open that waits for an action or for content is still pending. Style click
        feedback with <code>[data-open]</code> and <code>[data-pending]</code>, never with{" "}
        <code>[aria-expanded]</code>, which a <code>&lt;button&gt;</code> Trigger does not have. An
        element that controls a popup without being its invoker, such as the Combobox input, renders{" "}
        <code>aria-expanded</code> from the shown popup too.
      </p>
      <p>
        <strong>One Trigger per Root.</strong> The library anchors the popup to its Trigger or
        returns focus to it, so a Root has one. A second Trigger in the same Root is not supported
        (development warning); use a Root per trigger.
      </p>
      <p>
        <strong>Foreign invokers.</strong> A <a href="#foreign-invoker">foreign invoker</a> still
        works in library mode. An open through it is routed through the library like the Trigger's,
        so the action runs and the content loads first. A close through it has{" "}
        <code>reason: "activate"</code>, because the user acted on a button. It is a request where
        the component routes it through the library (it cancels the invoker's step and closes after{" "}
        <code>openChangeAction</code>), and a <a href="/concepts/action-props#fact">fact</a>{" "}
        reported to <code>onOpenChange</code> where the browser performs it first; each component
        page says which. A component that keeps focus in its popup or its input does not lose it
        when you press a foreign invoker: the invoker's own close is the only one.
      </p>
      <ConceptExample component="Popover" href="/components/popover">
        <p>
          A <code>Popover.Trigger</code> renders <code>&lt;button popovertarget&gt;</code> with no{" "}
          <code>aria-expanded</code>. Its styling hook is <code>data-open</code>; on a page that
          never hydrates, select on the popup that follows it:
        </p>
        <CodeBlock language="css">{`.trigger[data-open] { color: var(--accent); }
/* Without JavaScript: the Popup right after the Trigger. */
.trigger:has(+ :popover-open) { color: var(--accent); }`}</CodeBlock>
      </ConceptExample>

      <h3 id="native-inputs">Native inputs: the DOM is the optimistic state</h3>
      <p>
        A form control built on a real <code>&lt;input&gt;</code> has library-owned state, but the
        browser flips the input before any JavaScript runs, and after every event react-dom restores
        a controlled input to its current props. Only the synchronous optimistic state has rendered
        by then, so such a control renders the input from the optimistic value. That is a{" "}
        <strong>correctness requirement</strong>: an input driven by committed state would snap back
        right after the click and stay wrong for as long as the action runs. As a consequence the
        native pseudo-class (<code>:checked</code>) and the data attribute agree, and assistive
        technology hears the new state at once.
      </p>
      <ConceptExample component="Switch" href="/components/switch">
        <p>
          A Switch renders <code>{'<input type="checkbox" role="switch">'}</code> with{" "}
          <code>checked={"{optimistic}"}</code>, so <code>:checked</code> and{" "}
          <code>data-checked</code> agree from the click on.
        </p>
      </ConceptExample>
      <p>
        The browser can still change a native input without a click the library sees. Each case is a
        regular dispatch with <code>details.reason === "platform"</code>, and afterwards the DOM
        follows the decision:
      </p>
      <ul>
        <li>
          <strong>Form reset</strong>: a reset button, <code>form.reset()</code>, or React's
          automatic reset after a successful <code>&lt;form action&gt;</code>. Uncontrolled, the
          target is the latest default value; controlled, the browser's mount-time value is offered
          to the parent, which adopts it or not.
        </li>
        <li>
          <strong>Mount reconciliation</strong>: a click before hydration, or Firefox restoring form
          state on reload. React keeps the DOM value when hydrating and fires nothing, so the
          component compares on mount and dispatches once (once per group for a group of inputs).
        </li>
      </ul>

      <h3>Consumer-owned, mirrored state</h3>
      <p>
        A fourth kind of state is <strong>consumer-owned and mirrored</strong>: the parent derives
        it, there is no default and no action, and the library only writes it to the DOM after every
        commit. Where the browser clears it on a click, the library stops writing it while an action
        is pending.
      </p>
      <ConceptExample component="Checkbox" href="/components/checkbox">
        <p>
          <code>indeterminate</code> is derived by a "select all" parent from its rows. The library
          writes the DOM property after every commit and suspends it while an action is pending,
          because the browser clears it on the click.
        </p>
      </ConceptExample>
    </DocPage>
  );
}
