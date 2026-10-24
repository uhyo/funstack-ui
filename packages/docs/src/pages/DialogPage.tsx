import { CodeBlock } from "../components/CodeBlock.js";
import { Callout, Example } from "../components/Example.js";
import { BehaviourIndex, BehaviourSection } from "../components/Concept.js";
import { PageHead } from "../components/PageHead.js";
import { PartFacts, PropsTable, Table } from "../components/Tables.js";
import { DialogConfirm } from "../examples/DialogConfirm.js";
import { DialogOrders } from "../examples/DialogOrders.js";
import { DialogProfile } from "../examples/DialogProfile.js";
import { functionProps, renderProp } from "./shared-props.js";

export function DialogPage() {
  return (
    <div className="learn-content">
      <PageHead
        title="Dialog"
        description="A dialog built on <dialog> and Invoker Commands: JS-free when you need no state; a transition-driven open with a pending trigger, Suspense-ready content, and library-owned closes with a ViewTransition exit in every engine when you do."
      />
      <h2>Dialog</h2>
      <p className="page-intro">
        Built on <code>&lt;dialog&gt;</code>, <code>showModal()</code> and Invoker Commands. The
        platform supplies the top layer, the backdrop, the inert page, Escape, initial focus and
        focus return. The library adds the asynchronous half: opening a dialog whose content loads
        is a transition, so the trigger shows <code>data-pending</code> and the dialog opens once
        its content is ready, and closing it with one of its parts waits for your action and can
        animate with a view transition.
      </p>

      <Example file="DialogConfirm.tsx" css="dialog.css">
        <DialogConfirm />
      </Example>
      <p>
        This confirmation is a Server Component in JS-free mode. Every button is a native invoker or
        a <code>method="dialog"</code> submit, so it works before hydration and with JavaScript
        disabled.
      </p>

      <BehaviourIndex />

      <h3 id="anatomy">Anatomy</h3>
      <CodeBlock>{`import { Dialog } from "@funstack/ui/dialog";

<Dialog.Root>                                   {/* no DOM: ids, mode, state */}
  <Dialog.Trigger>Edit profile</Dialog.Trigger> {/* button[commandfor][command=show-modal] */}
  <Dialog.Popup>                                {/* dialog */}
    <Dialog.Title>Edit profile</Dialog.Title>   {/* h2, wired to aria-labelledby */}
    <Dialog.Description>…</Dialog.Description>  {/* p, wired to aria-describedby */}
    <Dialog.Form action={saveProfile}>          {/* form: closes after the action settles */}
      <input name="name" />
      <Dialog.Close>Cancel</Dialog.Close>       {/* button[commandfor][command=request-close] */}
      <button type="submit">Save</button>
    </Dialog.Form>
  </Dialog.Popup>
</Dialog.Root>`}</CodeBlock>
      <ul>
        <li>
          <strong>Root renders no DOM.</strong> Trigger and Popup need not be siblings:{" "}
          <code>commandfor</code> links them by id. A Popup without a Trigger is fine (controlled{" "}
          <code>open</code>); a Trigger without a Popup is a development warning. A{" "}
          <code>&lt;button commandfor command&gt;</code> of your own that targets the dialog is a{" "}
          <em>foreign invoker</em>; in library mode it goes through the library too.
        </li>
        <li>
          <strong>
            Popup is the <code>&lt;dialog&gt;</code> itself
          </strong>
          , so it carries <code>::backdrop</code>. There is no Portal, Backdrop or Positioner part:
          the top layer makes them unnecessary. Nothing inside the dialog portals out of it.
        </li>
        <li>
          <code>render</code>: Popup must render a <code>&lt;dialog&gt;</code>, Form a{" "}
          <code>&lt;form&gt;</code>. Trigger and Close must render a <code>&lt;button&gt;</code> for
          the command path; another element works only through a click handler (Trigger in library
          mode, Close with <code>action</code>). Wrong elements are development warnings.
        </li>
      </ul>

      <h3 id="how-it-works">How it works</h3>
      <h4 id="two-modes">Two modes</h4>
      <Table
        head={["", "JS-free mode", "Library mode"]}
        rows={[
          [
            "Selected when",
            "Root has none of `open`, `defaultOpen`, `openChangeAction`",
            "Root has any of them",
          ],
          [
            "Open",
            'the browser runs `command="show-modal"`',
            "the click is intercepted and dispatched in the Root's transition; `showModal()` runs in the commit that mounts the content",
          ],
          [
            "Close by a part (Close, Form, a foreign close command, controlled `open={false}`)",
            "the browser",
            "the click, submit or command is cancelled and dispatched in the Root's transition; `close(returnValue)` runs in the commit that ends it",
          ],
          [
            "Dismissal (Escape, Android back, a click outside)",
            "the browser",
            "the browser, at once; `openChangeAction(false)` is a notification",
          ],
          [
            "Popup content",
            "always mounted (in the server HTML)",
            "rendered from committed `open`; unmounted while closed unless `keepMounted`",
          ],
          [
            "Trigger `data-open`, `data-pending`",
            "not emitted; style `:open` on the dialog",
            "emitted (optimistic)",
          ],
          [
            "Before hydration",
            "everything works",
            "the native open happens; the content arrives on hydration (see below)",
          ],
          [
            "`transition` on Popup",
            "no effect (development warning)",
            "animates opens, content swaps and every library-driven close",
          ],
        ]}
      />
      <p>
        In library mode, opening and{" "}
        <a href="/concepts/browser-owned-state#parts-close">a part's close</a> are the library's; a{" "}
        <a href="/concepts/browser-owned-state#dismissal">dismissal</a> (Escape, Android back, a
        click outside) is the browser's, and the Root is notified afterwards (
        <a href="/concepts/browser-owned-state#parts-vs-dismissals">Parts vs dismissals</a>). The
        mode is decided on the first render; switching later is not supported (development warning).
      </p>

      <h3 id="props">Props</h3>
      <h4>
        <code>Dialog.Root</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "open",
            type: "boolean",
            description:
              "Controlled open state. undefined means uncontrolled. Selects library mode.",
          },
          {
            name: "defaultOpen",
            type: "boolean",
            description:
              "Initial open state in uncontrolled library mode. A dialog that starts open is shown after hydration, never by the server HTML; its content and the Trigger's open state are already in that HTML. `defaultOpen={false}` is the usual way to select library mode without an action.",
          },
          {
            name: "openChangeAction",
            type: "ChangeAction<boolean, DialogOpenChangeDetails>",
            description: (
              <>
                Awaited for <code>true</code>: the dialog opens when it resolves and the content has
                rendered. Awaited for a <code>false</code> the user asked a part for (a{" "}
                <code>Dialog.Close</code>, a <code>Dialog.Form</code> submit or settled action, a
                foreign close command): the dialog closes with <code>details.returnValue</code> when
                it resolves, with a view transition if the Popup has <code>transition</code>; a
                controlled parent that keeps <code>open</code> vetoes it. A notification for a
                dismissal (Escape, a click outside): the dialog is already closed when it runs. Runs
                in the Root's transition; may be a Server Function; rejections reach the nearest
                Error Boundary above the Root. <code>details</code>: <code>reason</code> (
                <code>"activate"</code>, <code>"dismiss"</code> or <code>"platform"</code>) and{" "}
                <code>returnValue</code> (the closing button's or submitter's <code>value</code>,{" "}
                <code>""</code> for a dismiss, <code>undefined</code> on open). Selects library
                mode.
              </>
            ),
          },
          {
            name: "modal",
            type: "boolean",
            default: "true",
            description:
              "`showModal()` (top layer, backdrop, inert page, Escape) or `show()`. A non-modal dialog has no command to open it, so its Trigger always uses a click handler: it is never JS-free.",
          },
          {
            name: "children",
            type: "ReactNode | ((state: DialogRootState) => ReactNode)",
            description:
              "The parts. The function form receives the optimistic state and must not suspend.",
          },
        ]}
      />
      <PartFacts
        state={
          "`DialogRootState` is `{ open, pending, modal }`; `open` is optimistic, and `open` and `pending` are `false` in JS-free mode."
        }
        owned={"nothing rendered: the Root has no element (no `ref`, `className` or `style`)."}
      />

      <h4>
        <code>Dialog.Trigger</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description:
              'Native `disabled`: a disabled button is not an invoker and never opens. With a link or component `render` where the Trigger handles the click (library mode, or a non-modal dialog), `aria-disabled="true"` instead (the element stays focusable).',
          },
          ...functionProps(
            "DialogTriggerState",
            "Rendered from optimistic state; must not suspend.",
          ),
          renderProp("button", "DialogTriggerState"),
        ]}
      />
      <PartFacts
        state={
          "`DialogTriggerState` is `{ open, pending, disabled }`; `pending` is true while the Root is pending: an open in flight, a part's close waiting for `openChangeAction(false)`, a close notification in flight, or a re-open requested while a close notification is still settling."
        }
        owned={
          "`type` (on a `<button>` only), `disabled`, `aria-disabled` (a link or component `render` with the click handler installed), `commandfor`, `command`, `onClick` (when it installs one), `data-open`, `data-pending`, `data-disabled`."
        }
      />

      <h4>
        <code>Dialog.Popup</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "keepMounted",
            type: "boolean",
            default: "false",
            description: (
              <>
                Library mode. <code>false</code>: children are not rendered while closed, so content
                that suspends holds the open until it is ready. <code>true</code>: children stay in{" "}
                <code>&lt;Activity mode="hidden"&gt;</code> (state kept, effects stopped,
                pre-rendered at low priority; not in the server HTML). Either way, unmounting waits
                for the dialog's CSS exit animation, or happens inside the close's view transition
                when <code>transition</code> is set. Ignored in JS-free mode (always mounted).
              </>
            ),
          },
          {
            name: "initialFocus",
            type: "RefObject<HTMLElement | null> | string",
            description: (
              <>
                The element to focus on open: a ref, or a selector resolved inside the dialog. The
                library writes <code>autofocus</code> on it right before <code>showModal()</code>{" "}
                and lets the platform focus it; it never calls <code>.focus()</code>. Default: the
                platform's choice (the first focusable element). In JS-free mode the attribute is
                written after mount; prefer it to <code>autoFocus</code>, which React writes only
                into server-rendered HTML (not when the Popup renders on the client, for example
                after a client navigation to a Server Component page).
              </>
            ),
          },
          {
            name: "lightDismiss",
            type: "boolean",
            default: "false",
            description:
              'Close on a click outside the dialog (the `::backdrop` for a modal). JS `pointerdown` and `click` listeners: both the press and the click must land outside, so a drag that starts inside (selecting text) never closes. With `experimental_closedBy`, native `closedby="any"`, which behaves the same.',
          },
          {
            name: "experimental_closedBy",
            type: "boolean",
            default: "false",
            description:
              'Renders `closedby` (`"any"` with `lightDismiss`, else `"closerequest"`) and skips the JS dismiss listeners where the browser implements it (Chromium, Firefox). Elsewhere the JS stays. See [Experimental features](/concepts/experimental).',
          },
          {
            name: "transition",
            type: "ViewTransitionClass",
            description:
              "Library mode only. Forwarded to the `<ViewTransition>` around the dialog; without it no boundary is rendered. Animates the opening commit, content swaps while open, and every library-driven close (a Close part, a Form submit or settled action, a foreign close command, a controlled `open={false}`) in all engines. Dismissals (Escape, a click outside) are the browser's and animate with CSS only. Keep it static; any value makes a Root inserted by a transition run the page cross-fade.",
          },
          ...functionProps("DialogPopupState"),
          renderProp("dialog", "DialogPopupState"),
        ]}
      />
      <PartFacts
        state={
          "`DialogPopupState` is `{ open, modal }`; `open` is committed (`false` in JS-free mode; `:open` is the DOM truth)."
        }
        owned={
          "`id`, `open` (never rendered: opening goes through `showModal()` only), `closedby`, `data-modal`, `suppressHydrationWarning`; `aria-labelledby` and `aria-describedby` are merged with yours. `onToggle` and `onBeforeToggle` are not accepted: use a `ref` for the platform events."
        }
        note={'Other props, such as `role="alertdialog"` or `onCancel`, pass through.'}
      />

      <h4>
        <code>Dialog.Close</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "action",
            type: "Action<[details: DialogCloseDetails]>",
            description: (
              <>
                Runs in this button's own transition (<code>data-pending</code> on it), then closes
                the dialog with <code>value</code> as <code>returnValue</code>: in library mode
                through the Root (<code>openChangeAction(false)</code> awaited, view transition if
                set; the button stays pending until the dialog closes), in JS-free mode with{" "}
                <code>close(value)</code>. A rejection reaches the nearest Error Boundary above the
                button and leaves the dialog open. If the dialog was closed and opened again while
                the action ran, the close is dropped: it belonged to the previous opening. A second
                click while it is pending is ignored, and the button is{" "}
                <code>aria-disabled="true"</code> meanwhile. Without <code>action</code> the button
                is a native <code>command="request-close"</code> invoker in JS-free mode and goes
                straight through the Root in library mode. <code>details.returnValue</code> is the{" "}
                <code>value</code>.
              </>
            ),
          },
          {
            name: "value",
            type: "string",
            description:
              "Becomes `dialog.returnValue`, and `details.returnValue` of `openChangeAction(false)`.",
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description:
              'Native `disabled`; owned, so a `render` element cannot re-enable it. With a link or component `render` where the Close handles the click (library mode, or with `action`), `aria-disabled="true"` instead (the element stays focusable).',
          },
          ...functionProps("DialogCloseState"),
          renderProp("button", "DialogCloseState"),
        ]}
      />
      <PartFacts
        state={"`DialogCloseState` is `{ pending, disabled }`."}
        owned={
          "`type` (on a `<button>` only), `disabled`, `aria-disabled`, `commandfor`, `command`, `value`, `onClick` (library mode, or with `action`), `data-pending`, `data-disabled`; a `render` element cannot re-enable a disabled Close."
        }
        note={
          'A second click, Enter or Space while the action is pending is ignored (and cancelled), and the button is `aria-disabled="true"` for as long as it shows `data-pending`, which spans the action and the close; it is never natively disabled, so it keeps focus. To close at once and finish the work in the background, do not return the promise: `action={() => { void save(); }}`.'
        }
      />

      <h4>
        <code>Dialog.Form</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "action",
            type: "string | ((formData: FormData) => unknown)",
            description: (
              <>
                Without <code>action</code> the form renders <code>method="dialog"</code>: a submit
                closes the dialog with the submitter's <code>value</code>, natively in JS-free mode
                and through the Root in library mode (<code>openChangeAction(false)</code> awaited,
                view transition if set). A <code>preventDefault()</code> in your{" "}
                <code>onSubmit</code> keeps it open in both modes. A function (may be a Server
                Function) is React's form action, passed through unwrapped; the dialog closes, in
                the same way, once the action's transition has settled, including any Suspense wait
                it causes (see <code>closeOnSettle</code>). A rejection leaves the dialog open. A
                string is a plain navigating form.
              </>
            ),
          },
          {
            name: "closeOnSettle",
            type: "boolean",
            default: "true",
            description: (
              <>
                With a function <code>action</code>: close the dialog once the action settles
                without throwing and, when the form is rendered as a <code>Form.Root</code> (
                <code>{"render={<Form.Root errors={state.errors} />}"}</code>), with no field error:
                a settle whose <code>errors</code> has a non-empty entry (hidden stale ones
                included, the <code>autoReset</code> rule) keeps the dialog open and the Form
                focuses the first errored field. Without a <code>Form.Root</code> the library never
                sees a result, so any settle that does not throw counts, including a{" "}
                <code>useActionState</code> result that reports errors: render the form as a{" "}
                <code>Form.Root</code> to route them, throw to keep the dialog open, or set{" "}
                <code>false</code> and close it yourself (a <code>Dialog.Close</code>, a submit
                button in a separate <code>method="dialog"</code> form, or a controlled{" "}
                <code>open</code>; a <code>formMethod="dialog"</code> submitter inside this form
                runs the action again instead). The dialog is never closed when it was closed while
                the action ran, even if the user re-opened it meanwhile.
              </>
            ),
          },
          {
            name: "method",
            type: "string",
            description:
              'Only with a string `action` (for example `"post"`). Otherwise owned: `"dialog"` without `action`, React\'s own with a function.',
          },
          ...functionProps("DialogFormState"),
          renderProp("form", "DialogFormState"),
        ]}
      />
      <PartFacts
        state={
          "`DialogFormState` is `{ pending }`, this form's `useFormStatus().pending`; it is not emitted as `data-pending` and not folded into any other part's state."
        }
        owned={"`action`, and `method` unless `action` is a string."}
      />
      <p>
        With field errors from <code>useActionState</code>, render it as a <code>Form.Root</code>:{" "}
        <code>
          {"<Dialog.Form action={dispatch} render={<Form.Root errors={state.errors} />}>"}
        </code>
        . The Form then runs the action, routes the errors to its fields and resets the form only on
        success (React's own path resets it after every successful action), and the dialog closes
        only on a result with no field error: errors keep it open with the first errored field
        focused. The composition needs a function <code>action</code> (without one the form would
        navigate; a development warning says so). The reset runs before the close, so pass{" "}
        <code>autoReset={"{false}"}</code> on the <code>Form.Root</code> element if your exit
        animation is visible. See{" "}
        <a href="/components/field#dialog-form">Field and Form: in a Dialog</a>.
      </p>

      <h4>
        <code>Dialog.Title</code>, <code>Dialog.Description</code>
      </h4>
      <PropsTable
        rows={[
          ...functionProps("DialogTitleState"),
          {
            name: "render",
            type: "ReactElement | ((props, state: DialogTitleState) => ReactNode)",
            description:
              "Replace the default <h2> (Title) or <p> (Description). `render={<h3 />}` changes the heading level.",
          },
        ]}
      />
      <PartFacts
        state={
          "the Popup's (`DialogTitleState` and `DialogDescriptionState` are `DialogPopupState`)."
        }
        owned={"`id`."}
      />

      <h3 id="data-attributes">Data attributes</h3>
      <Table
        head={["Hook", "On", "Meaning"]}
        rows={[
          ["`:open`", "Popup", "The dialog is open (DOM truth, both modes)."],
          ["`:modal`", "Popup", "Opened with `showModal()`."],
          ["`::backdrop`", "Popup", "The modal backdrop."],
          ["`data-modal`", "Popup", "The `modal` prop (also before the dialog opens)."],
          ["`data-open`", "Trigger", "Optimistic open state (library mode only)."],
          [
            "`data-pending`",
            "Trigger",
            "An open, a part's close, or a close notification is in flight (library mode only).",
          ],
          ["`data-pending`", "Close", "Its `action` is in flight."],
          [
            "`aria-disabled`",
            "Close",
            '`"true"` while `data-pending`: a second click is ignored meanwhile.',
          ],
          ["`data-disabled`", "Trigger, Close", "The `disabled` prop (both modes)."],
        ]}
      />
      <p>
        The <code>&lt;dialog&gt;</code> emits no <code>data-open</code>: <code>:open</code> and{" "}
        <code>:modal</code> are exact. Enter and exit animate in CSS, in both modes:
      </p>
      <CodeBlock language="css">{`.dialog, .dialog::backdrop {
  opacity: 0;
  transition: opacity 150ms, display 150ms allow-discrete, overlay 150ms allow-discrete;
}
.dialog:open, .dialog:open::backdrop { opacity: 1; }
@starting-style { .dialog:open, .dialog:open::backdrop { opacity: 0; } }

/* Scroll lock, CSS only: keyed on :modal, so it covers pre-hydration opens and nested dialogs. */
html { scrollbar-gutter: stable; }
html:has(dialog:modal) { overflow: hidden; }`}</CodeBlock>
      <p>
        The CSS exit animates in Chromium and Safari; Firefox closes a dialog instantly. The library
        keeps the content mounted until the exit animation ends, so a fading dialog is never empty,
        and a controlled close keeps it through the fade as well.
      </p>

      <h3 id="keyboard-and-aria">Keyboard and ARIA</h3>
      <Table
        head={["Key", "Behaviour", "Who"]}
        rows={[
          ["Enter / Space on the Trigger", "Opens", "the browser (JS-free) or the Trigger"],
          [
            "Tab / Shift+Tab in a modal",
            "Cycles through the dialog and the browser UI; the page is inert",
            "the browser",
          ],
          [
            "Escape (modal)",
            'Closes and returns focus; `openChangeAction(false, { reason: "dismiss" })`',
            "the browser",
          ],
          [
            "Escape (non-modal)",
            "Closes with `requestClose()`",
            "the Popup (or `closedby` with the flag)",
          ],
          ["Escape in a nested dialog", "Closes the innermost one only", "the browser"],
          [
            "Enter in a form field",
            "Submits the Form: closes (through the Root in library mode), or runs the action and then closes",
            "the browser / Form",
          ],
        ]}
      />
      <ul>
        <li>
          The Popup's role is the native <code>dialog</code>; <code>aria-modal</code> is exposed by
          the browser after <code>showModal()</code>, never set by hand.{" "}
          <code>role="alertdialog"</code> passes through. <code>aria-labelledby</code> and{" "}
          <code>aria-describedby</code> point at Title and Description. A Popup with neither a Title
          nor an <code>aria-label</code> is a development warning.
        </li>
        <li>
          There is no focus trap: <code>showModal()</code> makes the rest of the page inert. Focus
          return is the platform's; the library only steps in when the opener has been removed
          (focus goes to the Trigger if it is still there, else to the body), and when a
          library-driven close of a non-modal dialog unmounted the focused button before the dialog
          closed (focus goes to the Trigger).
        </li>
        <li>
          For long or destructive dialogs, focus a static element so the title is heard first:{" "}
          <code>initialFocus</code> pointing at a{" "}
          <code>&lt;Dialog.Title tabIndex={"{-1}"}&gt;</code>.
        </li>
        <li>
          The Trigger is a plain button: no <code>aria-expanded</code>, no{" "}
          <code>aria-haspopup</code>. Give an icon-only Close an <code>aria-label</code>.
        </li>
      </ul>
      <Callout title="Escape cannot be turned off">
        <p>
          Browsers honour <code>cancel.preventDefault()</code> only once per user activation, so a{" "}
          <code>closeOnEscape={"{false}"}</code> prop could not keep its promise. Build "unsaved
          changes" confirmation inside the dialog: a "Discard…" button that is the Trigger of a
          nested confirm Dialog, whose own <code>Dialog.Close action</code> does the work and then
          closes the outer dialog. Never write an action that awaits the user's answer in another
          dialog: React holds every transition started while an async action is pending, so the
          confirm would never open.
        </p>
      </Callout>

      <BehaviourSection
        id="transition-types"
        summary={
          "Library mode: `fsui-dialog` plus `fsui-dialog-open` or `fsui-dialog-close`; a controlled close carries none. JS-free mode starts no transitions."
        }
      >
        <h4>ViewTransition: an exit in every engine</h4>
        <p>
          With <code>transition</code>, the Popup renders <code>&lt;ViewTransition&gt;</code> around
          the <code>&lt;dialog&gt;</code>. A library-driven open calls <code>showModal()</code> in
          the layout effect of its commit and a library-driven close calls{" "}
          <code>close(returnValue)</code> in the layout effect of its commit, so the view transition
          captures the dialog's box as <code>::view-transition-new</code> on open and{" "}
          <code>::view-transition-old</code> (with its content) on close. That is the only way a
          dialog's exit can animate in Firefox. The order example below uses it.
        </p>
        <CodeBlock>{`<Dialog.Popup transition={{ "fsui-dialog-open": "pop", "fsui-dialog-close": "pop", default: "none" }}>`}</CodeBlock>
        <CodeBlock language="css">{`::view-transition-new(.pop) { animation: 180ms ease-out both pop-in; }
::view-transition-old(.pop) { animation: 140ms ease-in both pop-out; }
/* Keep the CSS exit above for dismissals, but not while a view transition runs. */
html:active-view-transition .dialog { transition: none; }
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; }
}`}</CodeBlock>
        <ul>
          <li>
            Library-driven closes: a <code>Dialog.Close</code>, a <code>Dialog.Form</code> submit or
            settled action, a foreign <code>request-close</code> / <code>close</code> command, a
            controlled <code>open={"{false}"}</code>. Transition types: <code>fsui-dialog</code>{" "}
            plus <code>fsui-dialog-open</code> or <code>fsui-dialog-close</code>; a controlled close
            carries none.
          </li>
          <li>
            Dismissals (Escape, a click outside) happen in the browser before React hears about
            them, so they animate with the CSS exit only: keep it. Cut it while a view transition
            runs (<code>html:active-view-transition .dialog {"{ transition: none; }"}</code>):
            otherwise a dialog closed by the library stays rendered through its fade, and Chromium
            captures it in the close's new snapshot as well, a double image. The untyped selector is
            deliberate: a controlled close carries no transition types. The cost: an unrelated view
            transition of the page also cuts a fade in progress.
          </li>
          <li>
            The <code>::backdrop</code> is not captured on its own: it is part of the page snapshot
            and leaves with the root cross-fade. A backdrop that should animate with the dialog is
            an element rendered as the Popup's first child (<code>position: fixed; inset: 0</code>;
            clicks on it are not light dismiss).
          </li>
          <li>
            A plain open with <code>transition="none"</code> starts no document view transition (the
            content mounts under the already-mounted <code>&lt;dialog&gt;</code>). A Root inserted
            by a transition with <code>transition</code> on its Popup, or a nested Popup with{" "}
            <code>transition</code> that mounts with the outer content, runs the page cross-fade (
            <a href="https://github.com/uhyo/funstack-ui/issues/35">issue #35</a>).
          </li>
        </ul>
      </BehaviourSection>

      <BehaviourSection
        id="optimistic-and-pending"
        summary={
          "Library mode: the Trigger shows the optimistic open state (`data-open`) and `data-pending` while an open, a part's close or a close notification is in flight. The Popup's content renders from the committed `open`. A Close with an `action` is a [pure trigger](/concepts/pending-and-optimistic#pure-trigger) (`data-pending`, `aria-disabled`)."
        }
      >
        <h4>Walkthrough (library mode)</h4>
        <Example file="DialogOrders.tsx" css="dialog.css">
          <DialogOrders />
        </Example>
        <ol>
          <li>
            Click Details: the click is cancelled (so the native command does not run), the Trigger
            gets <code>data-open</code> and <code>data-pending</code>, and{" "}
            <code>openChangeAction(true, {'{ reason: "activate", returnValue: undefined }'})</code>{" "}
            runs.
          </li>
          <li>
            The commit that sets committed <code>open</code> renders the Popup's children;{" "}
            <code>OrderDetails</code> suspends, so React holds the commit. The dialog stays closed;
            the Trigger keeps spinning.
          </li>
          <li>
            The data arrives: the content commits and <code>showModal()</code> runs in the same
            commit's layout effect, so the platform focuses fully rendered content (here the Close
            button, through <code>initialFocus</code>).
          </li>
          <li>
            Close it with the Close button: the click is cancelled, the Trigger shows{" "}
            <code>data-pending</code> while{" "}
            <code>openChangeAction(false, {'{ reason: "activate", returnValue: "done" }'})</code>{" "}
            runs, then the dialog closes in a view transition (the <code>transition</code> prop), in
            Firefox too. Escape or a click on the backdrop (<code>lightDismiss</code>) are
            dismissals: the browser closes the dialog at once and the Root then receives{" "}
            <code>reason: "dismiss"</code>. The second open is instant (the data is cached).
          </li>
          <li>
            If the opening action rejects, the error reaches the Error Boundary above the Root and
            the dialog never opens.
          </li>
        </ol>
        <p>
          To open now and show a skeleton instead, put a <code>&lt;Suspense&gt;</code> boundary
          inside the Popup: a newly mounted boundary shows its fallback immediately.
        </p>
        <Callout kind="warning" title="A part's close is yours to refuse; a dismissal's is not">
          <p>
            A close a part asks for waits for <code>openChangeAction(false)</code>: a controlled
            parent that keeps <code>open</code> gets a plain snap-back, and the dialog never blinks
            (for example "the save failed, keep editing", checked through{" "}
            <code>details.returnValue</code>). A dismissal is already done when the action runs: a
            parent that does not adopt <code>false</code> gets the dialog re-opened once the action
            settles, and the user sees it close and come back. Adopt a dismissal's{" "}
            <code>false</code> unconditionally. If the user dismisses the dialog while a part's
            close is still running and you then veto that close, the dialog stays closed and you
            receive the dismissal (<code>reason: "dismiss"</code>) right after. Neither is a way to
            ask the user first: an action must never await input, so build confirmation inside the
            dialog (see the callout above).
          </p>
        </Callout>
      </BehaviourSection>

      <BehaviourSection
        id="suspense"
        summary={
          "Content that suspends holds the open: the dialog stays closed with the Trigger pending, then opens once, complete. A `<Suspense>` inside the Popup opens at once with a skeleton instead."
        }
      />

      <BehaviourSection
        id="browser-owned-state"
        summary={
          'JS-free mode: the browser owns everything through Invoker Commands. Library mode: opening and a close asked for by a part are library-owned; a dismissal (Escape, Android back, a click outside) is the browser\'s: the dialog closes at once, `openChangeAction(false)` is a notification with `reason: "dismiss"`, and a controlled parent that keeps `open` gets it re-opened once the action settles. Dismissals animate with CSS only.'
        }
      />

      <BehaviourSection
        id="before-hydration"
        summary={
          'JS-free mode: everything for a modal dialog: open (`command="show-modal"`), Escape, Close buttons (`command="request-close"`), `<form method="dialog">`, focus and focus return, `autoFocus` in server-rendered markup, CSS animation; a `Dialog.Form` with a Server Function action submits with React\'s progressive enhancement. Hydration adds `initialFocus`, `lightDismiss` and closing after a form action. A non-modal dialog needs JavaScript to open. Library mode: the Trigger opens the dialog natively, but its content is not in the HTML; on hydration it is reconciled with one `openChangeAction(true)` call (`reason: "platform"`) and the content mounts.'
        }
      >
        <h4>
          The <a href="/concepts/browser-owned-state#platform-path">platform paths</a>
        </h4>
        <ul>
          <li>
            <strong>Before hydration, JS-free mode:</strong> everything works, including{" "}
            <code>autoFocus</code> in server-rendered markup and <code>Dialog.Form</code> with a
            Server Function action (React's progressive enhancement). After hydration, and for
            content React renders on the client, use <code>initialFocus</code>: React does not write{" "}
            <code>autofocus</code> on client-rendered elements.
          </li>
          <li>
            <strong>Before hydration, library mode:</strong> the Trigger already carries the
            command, so a click opens the dialog natively, but the content is not in the HTML yet.
            On hydration the Popup finds the dialog open and dispatches{" "}
            <code>openChangeAction(true, {'{ reason: "platform" }'})</code> with no event; the
            content mounts into the open dialog. If the action rejects or a controlled parent
            refuses, the dialog closes again. A dialog whose pre-hydration experience matters
            belongs in JS-free mode.
          </li>
          <li>
            <strong>Foreign invokers:</strong> in library mode, any{" "}
            <code>&lt;button commandfor command="show-modal"&gt;</code> (or{" "}
            <code>"request-close"</code> / <code>"close"</code>) pointing at the dialog goes through
            the library too, as the Trigger and Close parts do; a close command's <code>value</code>{" "}
            becomes the <code>returnValue</code>.
          </li>
        </ul>
      </BehaviourSection>

      <h3 id="forms">Forms</h3>
      <Example file="DialogProfile.tsx" css="dialog.css">
        <DialogProfile />
      </Example>
      <ol>
        <li>
          Submit: React runs the form action; <code>useFormStatus().pending</code> is true in the
          Save button. The dialog stays open.
        </li>
        <li>
          The action resolves and the name updates in a transition. When the form's pending state
          ends, the Form asks the Root to close the dialog with the submitter's <code>value</code> (
          <code>"save"</code>): <code>openChangeAction(false)</code> runs with{" "}
          <code>reason: "activate"</code>, then the dialog closes.
        </li>
        <li>
          A name containing "fail" rejects: the Error Boundary inside the Popup shows the error and
          the dialog stays open. A boundary above the Root would unmount the dialog instead.
        </li>
      </ol>
      <p>
        For a single "run this, then close" button without a form, such as Delete, use{" "}
        <code>Dialog.Close action</code>: it shows <code>data-pending</code> on the button and
        closes when the action resolves.
      </p>
      <p>
        In library mode a <code>method="dialog"</code> submit is a library-owned close too, with the
        submitter's <code>value</code>, after your own <code>onSubmit</code> ran. To leave such a
        form to the browser, call <code>event.stopPropagation()</code> in its <code>onSubmit</code>:
        the dialog then closes natively and the Root is notified with <code>reason: "dismiss"</code>
        .
      </p>

      <h4>Server Functions</h4>
      <p>
        The dialog's action and the <a href="/concepts/action-props#form-channel">form channel</a>{" "}
        are independent, and both usable from a Server Component:
      </p>
      <CodeBlock>{`// Persist "seen" when the user dismisses an announcement.
<Dialog.Root defaultOpen={!user.seenAnnouncement} openChangeAction={markAnnouncementSeen}>
  ...
</Dialog.Root>

// A form inside the dialog: progressive enhancement before hydration, close after success.
<Dialog.Form action={saveProfile}>...</Dialog.Form>`}</CodeBlock>
      <p>
        <code>openChangeAction</code> is a per-dialog action with the Trigger's pending state;{" "}
        <code>Dialog.Form action</code> is React's form action with React's{" "}
        <code>useFormStatus</code>. The Form only observes the form channel to close the dialog
        afterwards; it never wraps your function and never reports form pending as the dialog's.
      </p>

      <h3 id="recipes">Recipes</h3>
      <h4>Controlled, opened without a Trigger</h4>
      <CodeBlock>{`const [open, setOpen] = useState(false);

<Dialog.Root open={open} openChangeAction={(next) => { setOpen(next); }}>
  <Dialog.Popup>...</Dialog.Popup>
</Dialog.Root>`}</CodeBlock>
      <h4>Branch on how it closed</h4>
      <CodeBlock>{`<Dialog.Root
  defaultOpen={false}
  openChangeAction={(open, { reason, returnValue }) => {
    if (!open && reason === "activate" && returnValue === "delete") deleteDraft();
  }}
>`}</CodeBlock>
      <p>
        A <code>&lt;ViewTransition&gt;</code> that mounts inside a transition runs the page
        cross-fade (<a href="/concepts/transitions#transition-prop">the transition prop</a>, issue{" "}
        <a href="https://github.com/uhyo/funstack-ui/issues/35">#35</a>). In a library-mode dialog
        that happens when the content mounts parts that render one, such as a nested Dialog or a
        control with <code>transition</code> set.
      </p>
    </div>
  );
}
