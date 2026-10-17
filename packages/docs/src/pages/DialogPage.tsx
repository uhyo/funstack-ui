import { CodeBlock } from "../components/CodeBlock.js";
import { Callout, Example } from "../components/Example.js";
import { PageHead } from "../components/PageHead.js";
import { PropsTable, Table } from "../components/Tables.js";
import { DialogConfirm } from "../examples/DialogConfirm.js";
import dialogConfirmSource from "../examples/DialogConfirm.tsx?raw";
import { DialogOrders } from "../examples/DialogOrders.js";
import dialogOrdersSource from "../examples/DialogOrders.tsx?raw";
import { DialogProfile } from "../examples/DialogProfile.js";
import dialogProfileSource from "../examples/DialogProfile.tsx?raw";
import dialogCss from "../examples/dialog.css?raw";
import { functionProps, renderProp } from "./shared-props.js";

export function DialogPage() {
  return (
    <div className="learn-content">
      <PageHead
        title="Dialog"
        description="A dialog built on <dialog> and Invoker Commands: JS-free when you need no state, a transition-driven open with a pending trigger and Suspense-ready content when you do."
      />
      <h2>Dialog</h2>
      <p className="page-intro">
        Built on <code>&lt;dialog&gt;</code>, <code>showModal()</code> and Invoker Commands. The
        platform supplies the top layer, the backdrop, the inert page, Escape, initial focus and
        focus return. The library adds the Async React half: opening a dialog whose content loads is
        a transition, so the trigger shows <code>data-pending</code> and the dialog opens once its
        content is ready.
      </p>

      <Example
        source={dialogConfirmSource}
        fileName="DialogConfirm.tsx"
        css={dialogCss}
        cssFileName="dialog.css"
      >
        <DialogConfirm />
      </Example>
      <p>
        This confirmation is a Server Component in JS-free mode. Every button is a native invoker or
        a <code>method="dialog"</code> submit, so it works before hydration and with JavaScript
        disabled.
      </p>

      <h3>Anatomy</h3>
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
          <code>open</code>); a Trigger without a Popup is a development warning.
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

      <h3>Two modes</h3>
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
          ["Close", "the browser", "the browser; `openChangeAction(false)` is a notification"],
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
            "animates the opening commit and content swaps",
          ],
        ]}
      />
      <p>
        Open state in library mode is owned by the library in one direction only: opening is a
        transition the library drives and awaits; closing is performed by the browser and reported
        afterwards. See <a href="/concepts/browser-owned-state">Browser-owned state</a>. The mode is
        decided on the first render; switching later is not supported (development warning).
      </p>

      <h3>Props</h3>
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
                rendered. A notification for <code>false</code>: the dialog is already closed when
                it runs. Runs in the Root's transition; may be a Server Function; rejections reach
                the nearest Error Boundary above the Root. <code>details</code>: <code>reason</code>{" "}
                (<code>"activate"</code>, <code>"dismiss"</code> or <code>"platform"</code>) and{" "}
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
      <p>
        <code>DialogRootState</code>: <code>{"{ open, pending, modal }"}</code>, where{" "}
        <code>open</code> is optimistic and both are <code>false</code> in JS-free mode. The Root
        has no <code>ref</code>, <code>className</code> or <code>style</code>.
      </p>

      <h4>
        <code>Dialog.Trigger</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description: "Native `disabled`: a disabled button is not an invoker and never opens.",
          },
          ...functionProps(
            "DialogTriggerState",
            "Rendered from optimistic state; must not suspend.",
          ),
          renderProp("button", "DialogTriggerState"),
        ]}
      />
      <p>
        <code>DialogTriggerState</code>: <code>{"{ open, pending, disabled }"}</code>.{" "}
        <code>pending</code> is true while the Root is pending: an open or a close notification in
        flight, or a re-open requested while a close notification is still settling. The Trigger
        owns <code>type</code>, <code>disabled</code>, <code>commandfor</code>, <code>command</code>{" "}
        and, when it installs one, <code>onClick</code>.
      </p>

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
                for the dialog's exit animation. Ignored in JS-free mode (always mounted).
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
            default: "–",
            description:
              "Library mode only. Forwarded to the `<ViewTransition>` around the dialog; without it no boundary is rendered. It animates the opening commit and content swaps while open. The close is the browser's; animate it with CSS.",
          },
          ...functionProps("DialogPopupState"),
          renderProp("dialog", "DialogPopupState"),
        ]}
      />
      <p>
        <code>DialogPopupState</code>: <code>{"{ open, modal }"}</code>, with <code>open</code>{" "}
        committed (<code>false</code> in JS-free mode; <code>:open</code> is the DOM truth). The
        Popup owns <code>id</code>, <code>open</code> (never rendered: opening goes through{" "}
        <code>showModal()</code> only), <code>closedby</code>, <code>onToggle</code> and{" "}
        <code>onBeforeToggle</code>; its <code>aria-labelledby</code> and{" "}
        <code>aria-describedby</code> are merged with yours. Other props, such as{" "}
        <code>role="alertdialog"</code> or <code>onCancel</code>, pass through.
      </p>

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
                the dialog with <code>close(value)</code>. A rejection reaches the nearest Error
                Boundary above the button and leaves the dialog open. If the dialog was closed and
                opened again while the action ran, the close is dropped: it belonged to the previous
                opening. Without <code>action</code> the button is a native{" "}
                <code>command="request-close"</code> invoker. <code>details.returnValue</code> is
                the <code>value</code>.
              </>
            ),
          },
          {
            name: "value",
            type: "string",
            description:
              "Becomes `dialog.returnValue`, and `details.returnValue` of the close notification.",
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description: "Native `disabled`.",
          },
          ...functionProps("DialogCloseState"),
          renderProp("button", "DialogCloseState"),
        ]}
      />
      <p>
        <code>DialogCloseState</code>: <code>{"{ pending, disabled }"}</code>. Repeated clicks while
        pending re-run the action; the first close wins. The Close owns <code>disabled</code>, so a{" "}
        <code>render</code> element cannot re-enable it.
      </p>

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
                closes the dialog natively with the submitter's <code>value</code>. A function (may
                be a Server Function) is React's form action, passed through unwrapped; the dialog
                closes once the action's transition has settled, including any Suspense wait it
                causes (see <code>closeOnSettle</code>). A rejection leaves the dialog open. A
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
                without throwing. Any non-throwing result counts, including a{" "}
                <code>useActionState</code> result that reports validation errors; set{" "}
                <code>false</code> to keep the dialog open and close it yourself (a{" "}
                <code>Dialog.Close</code>, a <code>formMethod="dialog"</code> submitter, or a
                controlled <code>open</code>). The dialog is never closed when it was closed while
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
      <p>
        <code>DialogFormState</code>: <code>{"{ pending }"}</code>, this form's{" "}
        <code>useFormStatus().pending</code>. It is not emitted as <code>data-pending</code> and not
        folded into any other part's state. The Form owns <code>action</code>, and{" "}
        <code>method</code> unless <code>action</code> is a string.
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
      <p>
        Both own their <code>id</code>. Their state is the Popup's (<code>DialogTitleState</code>{" "}
        and <code>DialogDescriptionState</code> are <code>DialogPopupState</code>).
      </p>

      <h3>Data attributes and pseudo-classes</h3>
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
            "An open, or a close notification, is in flight (library mode only).",
          ],
          ["`data-pending`", "Close", "Its `action` is in flight."],
          ["`data-disabled`", "Trigger (library mode), Close", "The `disabled` prop."],
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
        The exit animates in Chromium and Safari; Firefox closes instantly. The library keeps the
        content mounted until the exit animation ends, so a fading dialog is never empty.
      </p>

      <h3>Keyboard and ARIA</h3>
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
            "Submits the Form: closes, or runs the action and then closes",
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
          (focus goes to the Trigger if it is still there, else to the body).
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

      <h3>Async walkthrough (library mode)</h3>
      <Example
        source={dialogOrdersSource}
        fileName="DialogOrders.tsx"
        css={dialogCss}
        cssFileName="dialog.css"
      >
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
          Close it with Escape, a click on the backdrop (<code>lightDismiss</code>) or the Close
          button: the browser closes it at once, then the Root receives{" "}
          <code>openChangeAction(false, details)</code> with <code>reason: "dismiss"</code> or{" "}
          <code>"activate"</code> and the <code>returnValue</code>. The second open is instant (the
          data is cached).
        </li>
        <li>
          If the opening action rejects, the error reaches the Error Boundary above the Root and the
          dialog never opens.
        </li>
      </ol>
      <p>
        To open now and show a skeleton instead, put a <code>&lt;Suspense&gt;</code> boundary inside
        the Popup: a newly mounted boundary shows its fallback immediately.
      </p>
      <Callout kind="warning" title="Closing is not a veto">
        <p>
          The dialog is already closed when <code>openChangeAction(false)</code> runs. A controlled
          parent that does not adopt <code>false</code> gets the dialog re-opened once the action
          settles: the user sees it close and come back. Adopt <code>false</code> unconditionally.
        </p>
      </Callout>

      <h3>Forms: action, then close</h3>
      <Example
        source={dialogProfileSource}
        fileName="DialogProfile.tsx"
        css={dialogCss}
        cssFileName="dialog.css"
      >
        <DialogProfile />
      </Example>
      <ol>
        <li>
          Submit: React runs the form action; <code>useFormStatus().pending</code> is true in the
          Save button. The dialog stays open.
        </li>
        <li>
          The action resolves and the name updates in a transition. When the form's pending state
          ends, the Form closes the dialog with the submitter's <code>value</code> (
          <code>"save"</code>), and the Root is notified with <code>reason: "activate"</code>.
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

      <h3>The platform paths</h3>
      <ul>
        <li>
          <strong>Before hydration, JS-free mode:</strong> everything works, including{" "}
          <code>autoFocus</code> in server-rendered markup and <code>Dialog.Form</code> with a
          Server Function action (React's progressive enhancement). After hydration, and for content
          React renders on the client, use <code>initialFocus</code>: React does not write{" "}
          <code>autofocus</code> on client-rendered elements.
        </li>
        <li>
          <strong>Before hydration, library mode:</strong> the Trigger already carries the command,
          so a click opens the dialog natively, but the content is not in the HTML yet. On hydration
          the Popup finds the dialog open and dispatches{" "}
          <code>openChangeAction(true, {'{ reason: "platform" }'})</code> with no event; the content
          mounts into the open dialog. If the action rejects or a controlled parent refuses, the
          dialog closes again. A dialog whose pre-hydration experience matters belongs in JS-free
          mode.
        </li>
        <li>
          <strong>Foreign invokers:</strong> in library mode, any{" "}
          <code>&lt;button commandfor command="show-modal"&gt;</code> pointing at the dialog goes
          through the library too.
        </li>
      </ul>

      <h3>Server Functions</h3>
      <p>Two independent channels, both usable from a Server Component:</p>
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

      <h3>Recipes</h3>
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
      <Callout title="ViewTransition cost on open">
        <p>
          A <code>&lt;ViewTransition&gt;</code> that mounts inside a transition makes React start a
          document view transition even with <code>default="none"</code>, which runs the browser's
          root cross-fade and delays the next commit by about 250 ms. In a library-mode dialog that
          happens when the content mounts parts that render one (a nested Dialog, a Switch, a
          Checkbox, a RadioGroup item). Tracked in{" "}
          <a href="https://github.com/uhyo/funstack-ui/issues/35">issue #35</a>.
        </p>
      </Callout>
    </div>
  );
}
