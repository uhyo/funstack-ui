import { CodeBlock } from "../components/CodeBlock.js";
import { Callout, Example } from "../components/Example.js";
import { BehaviourIndex, BehaviourSection } from "../components/Concept.js";
import { PageHead } from "../components/PageHead.js";
import { PropsTable, Table } from "../components/Tables.js";
import { ButtonCompose } from "../examples/ButtonCompose.js";
import buttonComposeSource from "../examples/ButtonCompose.tsx?raw";
import { ButtonFormActions } from "../examples/ButtonFormActions.js";
import buttonFormActionsSource from "../examples/ButtonFormActions.tsx?raw";
import buttonCssPendingSource from "../examples/ButtonCssPending.tsx?raw";
import { ButtonInvoker } from "../examples/ButtonInvoker.js";
import buttonInvokerSource from "../examples/ButtonInvoker.tsx?raw";
import { ButtonSave } from "../examples/ButtonSave.js";
import buttonSaveSource from "../examples/ButtonSave.tsx?raw";
import buttonCss from "../examples/button.css?raw";
import { ToastNotifications } from "../examples/ToastNotifications.js";
import { functionProps, renderProp } from "./shared-props.js";

export function ButtonPage() {
  return (
    <div className="learn-content">
      <PageHead
        title="Button"
        description="A button whose click is a transition: action in its own transition, data-pending, a second click ignored while pending, formAction with per-submitter pending."
      />
      <h2>Button</h2>
      <p className="page-intro">
        A button whose click is a transition. Compared with <code>{"<button onClick>"}</code>, a{" "}
        <code>Button</code> runs <code>action</code> in its own transition and shows{" "}
        <code>data-pending</code> until it settles, ignores a second click while it is pending,
        sends a rejection to the nearest Error Boundary, and takes a Server Function as{" "}
        <code>action</code> or <code>formAction</code>.
      </p>

      {/* This page's toast region, fed by the caught-inside example. */}
      <ToastNotifications />

      <Example
        source={buttonSaveSource}
        fileName="ButtonSave.tsx"
        css={buttonCss}
        cssFileName="button.css"
      >
        <ButtonSave />
      </Example>
      <p>
        Click Save several times quickly: the action runs once. While it runs the button carries{" "}
        <code>data-pending</code> and <code>aria-disabled="true"</code> and keeps focus. The second
        button rejects into an Error Boundary; the third catches the error inside its action, which
        the library counts as success, and reports it with a toast.
      </p>

      <BehaviourIndex />

      <h3 id="anatomy">Anatomy</h3>
      <CodeBlock>{`import { Button } from "@funstack/ui/button";

<Button action={save}>Save</Button>   {/* <button type="button"> */}`}</CodeBlock>
      <p>
        One element, no parts. It renders <code>{'<button type="button">'}</code>;{" "}
        <code>render</code> substitutes any element, such as <code>{"render={<a href />}"}</code>{" "}
        for a link that runs an action. The Button adds no <code>role</code>: a link stays a link to
        assistive technology.
      </p>

      <h3 id="props">Props</h3>
      <PropsTable
        rows={[
          {
            name: "action",
            type: "Action<[details: ButtonActionDetails]>",
            description: (
              <>
                Runs inside the Button's own transition on click, Enter or Space. Sync or async; may
                be a Server Function (<code>details</code> carries only the virtual{" "}
                <code>event</code>). A rejection reaches the nearest Error Boundary above the
                Button. While it is pending, further activation is ignored and the Button is{" "}
                <code>aria-disabled="true"</code>. Not combinable with <code>formAction</code>{" "}
                (development error).
              </>
            ),
          },
          {
            name: "formAction",
            type: "string | ((formData: FormData) => void | Promise<void>)",
            description: (
              <>
                React's <code>formAction</code>: run by React instead of the form's{" "}
                <code>action</code> when this Button submits the form. With a function the Button is
                pending for its own submissions only, ignores further activation meanwhile, and
                defaults to <code>type="submit"</code>. Prefer a stable function (a Server Function,
                a <code>useActionState</code> dispatch, <code>useCallback</code>) when the form is
                also submitted from script with <code>requestSubmit(button)</code>; an inline
                function works for clicks and Enter. The match is by function identity (React
                reports no submitter), so Buttons that share one function (one dispatch, different{" "}
                <code>name</code> / <code>value</code>) all show pending while either submits; give
                each its own function (<code>{'dispatch.bind(null, "draft")'}</code>) to tell them
                apart.
              </>
            ),
          },
          {
            name: "type",
            type: '"button" | "submit" | "reset"',
            default: '"button", or "submit" with formAction',
            description:
              "Owned on a `<button>` and on a component `render` element (assumed to render a `<button>`; it should spread the prop): set it here, not on the element. Omitted for a host element of another tag (`<a>`). `action` together with `submit` / `reset` warns in development (one click would do two things).",
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description:
              'Native `disabled` and `data-disabled`; never dispatches, and a disabled link does not navigate. With `focusableWhenDisabled`, inside a [Toolbar](/components/toolbar), or when `render` is not a `<button>` (a link, where native `disabled` means nothing), renders `aria-disabled="true"` instead.',
          },
          {
            name: "focusableWhenDisabled",
            type: "boolean",
            default: "false (true inside a Toolbar.Root)",
            description:
              'Keep a disabled Button focusable: `aria-disabled="true"` instead of native `disabled`, so keyboard and screen-reader users still find it and a Tooltip on it still opens.',
          },
          {
            name: "transition",
            type: "ViewTransitionClass",
            description:
              "Forwarded to the Button's `<ViewTransition default>`: animates the commit that ends the action (content keyed on `pending`), not the click.",
          },
          ...functionProps("ButtonState"),
          renderProp("button", "ButtonState"),
        ]}
      />
      <p>
        Every other <code>&lt;button&gt;</code> prop passes through, including <code>name</code>,{" "}
        <code>value</code>, <code>form</code>, <code>commandfor</code>, <code>command</code>,{" "}
        <code>aria-busy</code> and every event handler but <code>onClick</code> (pass-through
        handlers keep firing while pending). <code>onClick</code> and <code>aria-disabled</code> are
        the Button's and are not props. <code>ButtonState</code> is{" "}
        <code>{"{ pending, disabled }"}</code>; <code>ButtonActionDetails</code> is{" "}
        <code>{"{ event }"}</code>.
      </p>

      <h3 id="data-attributes">Data attributes</h3>
      <Table
        head={["Attribute", "Meaning"]}
        rows={[
          [
            "`data-pending`",
            "The Button's own `action` is in flight (until the commit that ends it, including a Suspense wait), or a submission it started with its own function `formAction` is pending.",
          ],
          ["`data-disabled`", "The `disabled` prop. Not set by pending."],
          [
            "`aria-disabled`",
            '`"true"` while pending, and while `disabled` with `focusableWhenDisabled`, inside a Toolbar, or on a non-`<button>` `render` element.',
          ],
        ]}
      />
      <p>
        Pending is not disabled: <code>[data-disabled]</code> and <code>state.disabled</code> are
        your <code>disabled</code> only, so the two states never have to look alike. Owned keys (a{" "}
        <code>render</code> element cannot override them): <code>type</code> (on a{" "}
        <code>&lt;button&gt;</code>), <code>disabled</code>, <code>aria-disabled</code>,{" "}
        <code>onClick</code>, <code>data-pending</code>, <code>data-disabled</code>.
      </p>

      <h3 id="keyboard-and-aria">Keyboard and ARIA</h3>
      <Table
        head={["Key", "Native <button>", "render={<a href>}"]}
        rows={[
          [
            "Enter",
            "Click: runs `action` (unless pending or disabled)",
            "Click: `action` and navigation; while pending, neither",
          ],
          [
            "Space",
            "Click on keyup: runs `action`",
            'Nothing (a link); add `role="button"` and a key handler if a link must act on Space',
          ],
          ["Tab", "Sequential, or the Toolbar's single Tab stop inside one", "Same"],
        ]}
      />
      <p>
        Focus never moves because of pending. The library announces nothing when an action starts or
        ends; the outcome is yours, and that is where status messages belong: a{" "}
        <a href="/components/toast">toast</a> (announced by its Viewport), a field error, content
        that replaces the button, or <code>ariaNotify</code> from the action. <code>aria-busy</code>{" "}
        is not set by default (screen readers either ignore it or may hide the button's name); pass
        it yourself if you want it. A label that changes with <code>pending</code> ("Saving…") is
        your choice, and like any name change on the focused element it is not reliably spoken.
      </p>

      <BehaviourSection
        id="transition-types"
        summary={
          "None: the Button adds no transition types. Its `transition` prop animates the commit that ends its action."
        }
      />

      <BehaviourSection
        id="optimistic-and-pending"
        summary={
          'A [pure trigger](/concepts/pending-and-optimistic#pure-trigger): no optimistic state. `data-pending` and `aria-disabled="true"` while its own action (or a submission started by its own function `formAction`) is in flight; a second click, Enter or Space is ignored meanwhile.'
        }
      >
        <h4 id="pending-and-re-entry">Re-entry while pending</h4>
        <p>
          While the Button's own action is in flight, a click, Enter or Space (also a programmatic{" "}
          <code>click()</code> and the click an implicit form submission sends) starts no second run
          and is <code>preventDefault()</code>ed, so a link does not navigate again, a form does not
          submit again and a <code>command</code> does not run again. Nothing else is blocked:
          focus, hover and your own event handlers work as usual, and ancestors still see the click.
        </p>
        <ul>
          <li>
            The Button is <code>aria-disabled="true"</code> meanwhile, so a screen-reader user who
            presses again, or comes back to it, hears that it is unavailable. It is never natively{" "}
            <code>disabled</code>: Chromium and Firefox move focus to the page when a focused button
            becomes disabled.
          </li>
          <li>
            The guard is the Button's own run, not its look. React may hold the commit that ends the
            action while another async action elsewhere is pending (or while the result suspends):
            the button keeps <code>data-pending</code> and <code>aria-disabled</code> in that
            window, but its own work has settled, so a click there starts a new run rather than
            being dropped. A <code>formAction</code> Button follows React's form status instead and
            stays guarded until its submission commits.
          </li>
          <li>
            Want every click to count (a "+1" button)? Do not await the work:{" "}
            <code>{"action={() => { void increment(); }}"}</code>. The run is over a moment after
            the click, so every click runs the action, even while an unrelated action elsewhere
            holds the Button's commit (then only the pending look lingers until that commit lands).
            An ordered sequence whose steps see each other's results is <code>useActionState</code>{" "}
            (pass its dispatch as <code>formAction</code>, or call it from the action).
          </li>
        </ul>
      </BehaviourSection>

      <BehaviourSection
        id="suspense"
        summary={
          "`data-pending` lasts until the commit that ends the action, including a Suspense wait of what that commit renders."
        }
      />

      <BehaviourSection
        id="browser-owned-state"
        summary={
          "A `commandfor` / `command` Button's command and a link's navigation are performed by the browser."
        }
      />

      <BehaviourSection
        id="before-hydration"
        summary={
          "A `commandfor` / `command` Button runs its command, a Server Function `formAction` submits (React's progressive enhancement) and a `render={<a href>}` link navigates. An `action` Button does nothing until hydration; a Server Function is a valid `action` once hydrated. The server HTML carries no `aria-disabled` and no `data-pending`."
        }
      >
        <h4>From a Server Component</h4>
        <Example source={buttonInvokerSource} fileName="ButtonInvoker.tsx">
          <ButtonInvoker />
        </Example>
        <p>
          <code>ButtonInvoker.tsx</code> has no <code>"use client"</code>: it is a Server Component
          that renders Button (a client module) with serialisable props. The Preview button opens
          the dialog through the browser's Invoker Commands, before hydration and without
          JavaScript. Sync shows a pending look made by <code>[data-pending]</code> CSS alone (
          <code>ButtonCssPending.tsx</code> below; its fake action is the only reason it is a client
          module on this static site). A Server Component can also pass a Server Function as{" "}
          <code>action</code> (it receives <code>details</code> with <code>event</code> undefined)
          or as <code>formAction</code> (progressively enhanced: the button submits before
          hydration), and style pending with <code>[data-pending]</code> CSS. It cannot pass
          function <code>children</code>, <code>className</code>, <code>style</code> or{" "}
          <code>render</code>, nor a plain client function as <code>action</code>: the
          spinner-in-children pattern needs a Client Component.
        </p>
        <CodeBlock title="ButtonCssPending.tsx">{buttonCssPendingSource}</CodeBlock>
        <CodeBlock>{`// A Server Component
import { Button } from "@funstack/ui/button";
import { archive } from "./actions"; // "use server"

<Button action={archive.bind(null, post.id)} className="row-action">Archive</Button>`}</CodeBlock>
        <p>
          Before hydration an <code>action</code> Button does nothing on click; a Server Function{" "}
          <code>formAction</code> submits natively, a command Button runs its command and a link
          navigates. The server HTML carries no <code>aria-disabled</code> and no{" "}
          <code>data-pending</code>.
        </p>
      </BehaviourSection>

      <h3 id="forms">Forms</h3>
      <Example source={buttonFormActionsSource} fileName="ButtonFormActions.tsx">
        <ButtonFormActions />
      </Example>
      <p>
        A Button is <code>type="button"</code> by default, so an <code>action</code> Button never
        submits the form it sits in. With <code>formAction</code> it is a submit button that runs
        its own function instead of the form's <code>action</code>: constraint validation,{" "}
        <code>FormData</code> and React's automatic form reset all apply. It is pending for its own
        submissions only (React reports the submitter's function through{" "}
        <code>useFormStatus().action</code>).
      </p>
      <Table
        head={["", "Form.Submit", "Button formAction", 'Button type="submit"']}
        rows={[
          [
            "Submits",
            "the form's own `action`",
            "its own function instead",
            "the form's own `action`",
          ],
          ["`pending`", "the form channel: any submitter", "its own submissions only", "none"],
          [
            "Re-entry while pending",
            "not blocked (a `useActionState` dispatch queues it, in order)",
            "ignored",
            "none",
          ],
          [
            "Use",
            "the one primary submit button",
            "secondary submitters",
            "rarely; `Form.Submit` is the documented spelling",
          ],
        ]}
      />
      <p>
        Inside a <a href="/components/field">Form.Root</a>, a <code>Button formAction</code> goes
        React's way: its function runs, the form's <code>action</code> does not, and{" "}
        <code>Form.Root</code> shows <code>data-pending</code> as for any submission (its{" "}
        <code>errors</code> are not fed by it; to route field errors, pass the dispatch of the same{" "}
        <code>useActionState</code> as <code>formAction</code>). Implicit submission (Enter in a
        text field) clicks the form's first submit button: if that is a pending{" "}
        <code>Button formAction</code>, the click is ignored and nothing is submitted twice.
      </p>

      <Callout title="Which button?">
        <ul>
          <li>
            Submits the form with its own action: <a href="/components/field">Form.Submit</a>.
          </li>
          <li>
            Runs an action, then closes an overlay: <code>Dialog.Close</code>,{" "}
            <code>Popover.Close</code>.
          </li>
          <li>
            An item of a menu: <a href="/components/menu">Menu.Item</a>. A Button inside a{" "}
            <code>Menu.Popup</code> is not a menu item.
          </li>
          <li>
            Holds a pressed state: <a href="/components/toggle">Toggle</a>.
          </li>
          <li>
            A command in a <a href="/components/toolbar">Toolbar</a>: <code>Button</code> itself.
          </li>
          <li>Anything else whose click is a transition: Button.</li>
        </ul>
      </Callout>

      <h3 id="styling">Styling</h3>
      <CodeBlock language="css">{`.btn[data-pending] { cursor: progress; }
.btn[data-pending] .label { visibility: hidden; }
.btn[data-pending]::after { content: ""; /* spinner */ }
.btn[data-disabled], .btn[aria-disabled="true"]:not([data-pending]) { opacity: .5; }

@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}`}</CodeBlock>
      <p>
        Tailwind: <code>data-pending:cursor-progress data-disabled:opacity-50</code>. With{" "}
        <code>transition</code>, keep the reduced-motion block in your stylesheet; the Button adds
        no view transition types.
      </p>

      <h3 id="recipes">Recipes</h3>
      <h4>Composition</h4>
      <Example source={buttonComposeSource} fileName="ButtonCompose.tsx">
        <ButtonCompose />
      </Example>
      <p>
        <code>{"<Dialog.Trigger render={<Button action={a} />}>"}</code> runs <code>a</code> and
        opens the dialog on one click: the Trigger's handler runs first and cancels the click (its
        command), and the Button runs its action anyway; a cancelled click is not a veto for a
        Button. The two updates start in one event, so React commits them together:{" "}
        <strong>
          an awaited <code>a</code> holds the dialog closed until it settles
        </strong>{" "}
        (the Trigger already shows <code>data-open</code> and <code>data-pending</code>). For a
        prefetch, do not await it, as above. The same works with <code>Popover.Trigger</code> and{" "}
        <code>Tooltip.Trigger</code>; a Tooltip keeps opening on hover and focus while the Button is
        pending, because a pending Button is not natively disabled and removes no listeners.
      </p>
      <p>
        <code>commandfor</code> / <code>command</code> pass through: without <code>action</code> the
        browser runs the command, before and after hydration. With both, one click runs the action
        and the command; while pending, neither runs again. Inside a{" "}
        <a href="/components/toolbar">Toolbar</a> a disabled Button stays focusable and in the
        arrow-key sequence (<code>aria-disabled</code>, the APG Toolbar rule).
      </p>
    </div>
  );
}
