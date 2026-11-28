import { CodeBlock } from "../components/CodeBlock.js";
import { Callout } from "../components/Callout.js";
import { Example } from "../components/Example.js";
import { BehaviourIndex, BehaviourSection } from "../components/Concept.js";
import { DocPage } from "../components/DocPage.js";
import { PartFacts, PropsTable, Table } from "../components/Tables.js";
import { AlertDialogDeleteProject } from "../examples/AlertDialogDeleteProject.js";
import { AlertDialogServerConfirm } from "../examples/AlertDialogServerConfirm.js";
import { functionProps, renderProp } from "./shared-props.js";

export function AlertDialogPage() {
  return (
    <DocPage
      title="AlertDialog"
      description="A Dialog with alert defaults: role alertdialog, always modal, no light dismiss, focus on Cancel. The confirm button runs your async action with its own pending state, closes when it resolves and stays open when it rejects."
    >
      <p className="page-intro">
        An alert dialog interrupts the user with a question that needs an answer: "Delete this
        project?". It is a <a href="/components/dialog">Dialog</a> with three things fixed: the{" "}
        <code>alertdialog</code> role, no light dismiss (a stray click on the backdrop does
        nothing), and the initial focus on <code>AlertDialog.Cancel</code>, the answer that destroys
        nothing. <code>AlertDialog.Action</code> is the asynchronous half: it runs your action in
        its own transition, shows <code>data-pending</code> on itself, closes the dialog when the
        action resolves and leaves it open when it rejects.
      </p>

      <Example file="AlertDialogDeleteProject.tsx" css="dialog.css">
        <AlertDialogDeleteProject />
      </Example>

      <BehaviourIndex />

      <h3 id="anatomy">Anatomy</h3>
      <CodeBlock>{`import { AlertDialog } from "@funstack/ui/alert-dialog";

<AlertDialog.Root>                                   {/* no DOM: ids, mode, state */}
  <AlertDialog.Trigger>Delete project</AlertDialog.Trigger>
  <AlertDialog.Popup>                                {/* dialog[role=alertdialog] */}
    <AlertDialog.Title>Delete "Atlas"?</AlertDialog.Title>
    <AlertDialog.Description>This cannot be undone.</AlertDialog.Description>
    <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>  {/* focused on open */}
    <AlertDialog.Action action={() => deleteProject(id)}>
      Delete                                         {/* pending, then closes */}
    </AlertDialog.Action>
  </AlertDialog.Popup>
</AlertDialog.Root>`}</CodeBlock>
      <ul>
        <li>
          <strong>Every part is a Dialog part.</strong> Root, Trigger, Popup, Title, Description and
          Form run the code of the Dialog parts of the same name; Cancel and Action run{" "}
          <code>Dialog.Close</code>'s. Everything the <a href="/components/dialog">Dialog</a> page
          says applies unless this page says otherwise: the two modes, focus return, exit
          animations, <code>keepMounted</code>, <code>transition</code>, <code>render</code>.
        </li>
        <li>
          <strong>What is not there.</strong> No <code>modal</code> prop (always{" "}
          <code>showModal()</code>), no <code>lightDismiss</code> or{" "}
          <code>experimental_closedBy</code>, and <code>role</code> is owned. There is no Close
          part: it is <code>Cancel</code>.
        </li>
        <li>
          <strong>A Description is expected.</strong> A screen reader announces an alert dialog by
          its name and description, so a Popup without an <code>AlertDialog.Description</code> (or
          an <code>aria-describedby</code> of yours) is a development warning (logged when its first
          showing ends), as a Popup without a Title is.
        </li>
      </ul>

      <h3 id="how-it-works">How it works</h3>
      <Table
        head={["", "AlertDialog"]}
        rows={[
          ["Role", '`role="alertdialog"` on the `<dialog>`; `aria-modal` from `showModal()`'],
          [
            "Backdrop click",
            "Does nothing, in every engine and before hydration: a modal `<dialog>` without `closedby` does not light-dismiss",
          ],
          [
            "Escape, Android back",
            'Closes the dialog: the browser\'s close request, a fact reported to `onOpenChange(false, { reason: "dismiss", returnValue: "" })`. It means "cancel"; there is no prop to turn it off',
          ],
          [
            "Initial focus",
            "The first enabled `AlertDialog.Cancel`; `initialFocus` on the Popup overrides it; without a Cancel the platform chooses (the first focusable element)",
          ],
          [
            "Cancel",
            '`Dialog.Close` under another name: a close request (`reason: "activate"`, `returnValue` its `value`, `""` by default)',
          ],
          [
            "Action",
            "`Dialog.Close` under another name, usually with an `action`; with one it renders no `commandfor` / `command` (as every Close part), so a click before hydration does nothing",
          ],
          [
            "Modes",
            "Dialog's: JS-free without open-state props on the Root, library mode with any",
          ],
        ]}
      />
      <h4 id="escape">Why Escape closes it</h4>
      <p>
        The WAI-ARIA alert dialog pattern keeps Escape, as every modal dialog does, and keyboard and
        screen-reader users rely on it. The one mechanism that would block it,{" "}
        <code>closedby="none"</code>, is missing in Safari and cannot be emulated there (the browser
        lets a page cancel a close request once per user activation, then closes anyway). So write
        the dialog so that a dismissal is a valid answer: Escape means Cancel, and the destructive
        step happens only in the Action's <code>action</code>. A dialog that must come back (an
        expired session) is controlled: a parent that keeps <code>open</code> after{" "}
        <code>onOpenChange(false)</code> gets it shown again at once.
      </p>
      <h4 id="where-the-work-goes">Where the confirmed work goes</h4>
      <p>
        Put it in the Action's <code>action</code>, not in <code>openChangeAction</code>. The action
        is where the pending state is on the button the user pressed, where a rejection keeps the
        dialog open, and where no dismissal can be mistaken for consent. An action that catches its
        own error resolves, and a resolved action closes the dialog: to keep the dialog open on a
        failure, let the error reach an Error Boundary inside the Popup (as in the example above),
        or use the <a href="#forms">Form</a> with <code>Form.Root</code> for field errors.
      </p>
      <Callout title="A pending confirmation can be dismissed">
        Dismissing a pending confirmation hides it; it does not abort it. Escape closes the dialog
        while the action runs, and the action finishes in the background. In library mode a Cancel
        click meanwhile is a close request that React entangles with the running action: it is held
        until the action settles, and the Cancel has <code>data-pending</code> until then (without{" "}
        <code>aria-disabled</code>), so style it to show the click was taken:{" "}
        <code>{".cancel[data-pending] { opacity: 0.6; transition: opacity 0s 150ms; }"}</code>, or
        dim the whole dialog with <code>{".alert:has([data-pending])"}</code>. When the work can
        take more than a moment, disable Cancel while it runs with your own optimistic state: see{" "}
        <a href="#cancel-while-pending">Cancel unavailable while the confirm runs</a>.
      </Callout>

      <h3 id="props">Props</h3>
      <h4>
        <code>AlertDialog.Root</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "open",
            type: "boolean",
            description:
              "Controlled open state. undefined means uncontrolled. Selects library mode. Pass `onOpenChange` too: Escape closes the dialog without asking (development warns).",
          },
          {
            name: "defaultOpen",
            type: "boolean",
            description:
              "Initial open state in uncontrolled library mode. `defaultOpen={false}` selects library mode without an action.",
          },
          {
            name: "openChangeAction",
            type: "ChangeAction<boolean, AlertDialogOpenChangeDetails>",
            description:
              "Requests only: the Trigger (`true`), a Cancel, an Action, a Form submit or settle, a foreign close command (`false`, with `details.returnValue` the part's `value`). Awaited; the dialog opens or closes when it resolves; a controlled parent that keeps `open` vetoes a close. Never called for Escape. Runs in the Root's transition; may be a Server Function; rejections reach the nearest Error Boundary above the Root. Selects library mode.",
          },
          {
            name: "onOpenChange",
            type: "UrgentChangeHandler<boolean, AlertDialogOpenChangeDetails>",
            description:
              'Facts only: Escape, Android back, an assistive-technology dismiss, a script `close()` / `requestClose()`. Always `false`, with `reason: "dismiss"` and `returnValue` as the browser left it (`""` for Escape). Called synchronously, outside any transition. In controlled mode set state directly here (`onOpenChange={setOpen}`). Selects library mode.',
          },
          {
            name: "children",
            type: "ReactNode | ((state: AlertDialogRootState) => ReactNode)",
            description:
              "The parts. The function form receives the optimistic state and must not suspend.",
          },
        ]}
      />
      <PartFacts
        state={
          "`AlertDialogRootState` is `{ open, pending, modal }` (Dialog's; `modal` is always `true`)."
        }
        owned={"none: the Root renders no element (no `ref`, `className` or `style`)."}
        note={"There is no `modal` prop: an alert dialog is always modal."}
      />

      <h4>
        <code>AlertDialog.Trigger</code>
      </h4>
      <p>
        <code>Dialog.Trigger</code>, unchanged: <code>{'<button command="show-modal">'}</code> in
        JS-free mode, a request through the Root with <code>data-open</code> and{" "}
        <code>data-pending</code> in library mode. Props: <code>disabled</code>,{" "}
        <code>className</code>, <code>style</code>, <code>children</code> (functions of{" "}
        <code>AlertDialogTriggerState</code>, <code>{"{ open, pending, disabled }"}</code>),{" "}
        <code>render</code>. In JS-free mode <code>data-open</code> follows the dialog; inside a
        <code>Toolbar.Root</code> a disabled Trigger is <code>aria-disabled</code> and stays
        focusable. See <a href="/components/dialog#props">Dialog.Trigger</a>.
      </p>

      <h4>
        <code>AlertDialog.Popup</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "initialFocus",
            type: "RefObject<HTMLElement | null> | string",
            default: "the first enabled Cancel",
            description:
              "The element to focus on open: a ref, or a selector resolved inside the dialog. With it, no Cancel is focused. For a long message, point it at the Title with `tabIndex={-1}` so the text is read from the top. Without a Cancel and without `initialFocus`, the platform focuses the first focusable element.",
          },
          {
            name: "keepMounted",
            type: "boolean",
            default: "false",
            description:
              'Library mode: keep the children in `<Activity mode="hidden">` while closed instead of unmounting them. Ignored in JS-free mode (always mounted).',
          },
          {
            name: "transition",
            type: "ViewTransitionClass",
            description:
              "Library mode only. Forwarded to the `<ViewTransition>` around the dialog: animates the open and every library-driven close (Cancel, Action, Form). Escape animates with CSS only. The transition types are Dialog's: `fsui-dialog`, `fsui-dialog-open`, `fsui-dialog-close`.",
          },
          ...functionProps("AlertDialogPopupState"),
          renderProp("dialog", "AlertDialogPopupState"),
        ]}
      />
      <PartFacts
        state={
          "`AlertDialogPopupState` is `{ open, modal }`; `open` is committed (`false` in JS-free mode; `:open` is the DOM truth)."
        }
        owned={
          "`role` (`alertdialog`), `id`, `open`, `closedby` (never rendered), `data-modal`, `suppressHydrationWarning`; `aria-labelledby` and `aria-describedby` are merged with yours."
        }
        note={"`onCancel` and the other `<dialog>` props pass through."}
      />

      <h4>
        <code>AlertDialog.Cancel</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "value",
            type: "string",
            default: '""',
            description:
              'Becomes `dialog.returnValue` and `details.returnValue` of `openChangeAction(false)`. The default is what Escape leaves, so both read as "nothing was confirmed".',
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description:
              "Native `disabled`; owned. A disabled Cancel is not the focus target: the next enabled one is.",
          },
          {
            name: "action",
            type: "Action<[details: AlertDialogCancelActionDetails]>",
            description:
              "Rarely needed. As on `Dialog.Close`: runs in this button's own transition, then closes the dialog; a rejection leaves it open.",
          },
          {
            name: "whilePending",
            type: '"run" | "ignore"',
            default: '"ignore"',
            description:
              "As on `Dialog.Close`. No effect without `action`: the Cancel then shows `data-pending` while its close waits, never `aria-disabled`.",
          },
          ...functionProps("AlertDialogCancelState"),
          renderProp("button", "AlertDialogCancelState"),
        ]}
      />
      <PartFacts
        state={
          "`AlertDialogCancelState` is `{ pending, disabled }`; `pending` runs from the click until the close it asked for has committed (library mode), for example while the close waits for a confirm that is still running."
        }
        owned={
          "`Dialog.Close`'s (`type`, `disabled`, `aria-disabled`, `commandfor`, `command`, `value`, `onClick` in library mode or with `action`, `data-pending`, `data-disabled`), and `autoFocus` in the server and hydration render while it is the focus target in JS-free mode (a Cancel mounted on the client into an open dialog carries the attribute but takes no focus)."
        }
        note={
          'JS-free mode: `<button command="request-close" autofocus>`, in the server HTML too, so the focus is right before hydration. Library mode: no attribute; the Popup writes `autofocus` on the first enabled Cancel right before `showModal()` and removes it after.'
        }
      />

      <h4>
        <code>AlertDialog.Action</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "action",
            type: "Action<[details: AlertDialogActionDetails]>",
            description: (
              <>
                The confirmed work. Runs in this button's own transition (<code>data-pending</code>{" "}
                on it), then closes the dialog with <code>value</code> as <code>returnValue</code>:
                in library mode through the Root (<code>openChangeAction(false)</code> awaited, view
                transition if set), in JS-free mode with <code>close(value)</code>. A rejection
                reaches the nearest Error Boundary above the button and leaves the dialog open. With{" "}
                <code>action</code> the button renders no <code>commandfor</code> /{" "}
                <code>command</code>, so a click before hydration does nothing instead of closing
                the dialog as if the work had been done. Without <code>action</code> it only closes
                the dialog (a native <code>request-close</code> invoker in JS-free mode).{" "}
                <code>details.returnValue</code> is the <code>value</code>.
              </>
            ),
          },
          {
            name: "whilePending",
            type: '"run" | "ignore"',
            default: '"ignore"',
            description:
              '`"ignore"`: a second click, Enter or Space while the action runs is cancelled, and the button is `aria-disabled="true"` meanwhile. `"run"`: the action runs again; the dialog closes once, after the last run, if the latest resolved.',
          },
          {
            name: "value",
            type: "string",
            default: '""',
            description: "Becomes `dialog.returnValue` and `details.returnValue`.",
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description: "Never runs or closes. Native `disabled`; owned.",
          },
          ...functionProps(
            "AlertDialogActionState",
            'Content, or a function of the state: `{({ pending }) => pending ? "Deleting…" : "Delete"}`.',
          ),
          renderProp("button", "AlertDialogActionState"),
        ]}
      />
      <PartFacts
        state={"`AlertDialogActionState` is `{ pending, disabled }`."}
        owned={
          "`type` (on a `<button>` only), `disabled`, `aria-disabled`, `commandfor` and `command` (none with `action`), `value`, `onClick` (library mode, or with `action`), `data-pending`, `data-disabled`. Owned and never written: `popoverTarget`, `popoverTargetAction`."
        }
        note={
          '`data-pending` spans the action and the close that follows. `AlertDialog.Action type="submit"` is not supported (`type` is owned): inside an `AlertDialog.Form`, confirm with a plain submit button.'
        }
      />

      <h4>
        <code>AlertDialog.Form</code>, <code>AlertDialog.Title</code>,{" "}
        <code>AlertDialog.Description</code>
      </h4>
      <p>
        <code>Dialog.Form</code>, <code>Dialog.Title</code> and <code>Dialog.Description</code>,
        unchanged: the same props (<code>action</code>, <code>closeOnSettle</code>,{" "}
        <code>method</code> on the Form; <code>render</code> to change the heading level on the
        Title), the same state types (<code>AlertDialogFormState</code> is{" "}
        <code>{"{ pending }"}</code>; Title and Description get the Popup's) and the same owned keys
        (<code>action</code> and <code>method</code>; <code>id</code>). See{" "}
        <a href="/components/dialog#props">the Dialog props</a>.
      </p>

      <h3 id="data-attributes">Data attributes</h3>
      <Table
        head={["Attribute", "On", "Meaning"]}
        rows={[
          ["`:open`, `:modal`, `::backdrop`", "Popup", "As on a Dialog."],
          ['`[role="alertdialog"]`', "Popup", "Always."],
          ["`data-modal`", "Popup", "Always present."],
          [
            "`data-open`",
            "Trigger",
            "As on a Dialog: optimistic in library mode; in JS-free mode whether the dialog is open, written from its `toggle` event.",
          ],
          ["`data-pending`", "Trigger", "Library mode: as on a Dialog."],
          [
            "`data-pending`",
            "Cancel, Action",
            "From the click until the close it asked for has committed: its `action`, then the Root's close (library mode, also without `action`; a Cancel clicked while the confirm runs).",
          ],
          [
            "`aria-disabled`",
            "Cancel, Action",
            '`"true"` with `action`, while `data-pending` with `whilePending="ignore"` (the default).',
          ],
          ["`data-disabled`", "Trigger, Cancel, Action", "The `disabled` prop."],
        ]}
      />
      <p>
        One stylesheet styles a Dialog and an AlertDialog: the hooks and the transition types are
        the same. To tell them apart in CSS, select <code>[role="alertdialog"]</code>.
      </p>

      <h3 id="keyboard-and-aria">Keyboard and ARIA</h3>
      <Table
        head={["Key", "Where", "Behaviour", "Who"]}
        rows={[
          [
            "Enter / Space",
            "Trigger",
            "Opens; focus moves to the Cancel.",
            "the browser (JS-free) or the Trigger",
          ],
          [
            "Tab / Shift+Tab",
            "Popup",
            "Cycles through the dialog; the page is inert.",
            "the browser",
          ],
          [
            "Escape",
            "Popup",
            'Closes and returns focus to the opener; `onOpenChange(false, { reason: "dismiss" })`.',
            "the browser",
          ],
          ["Enter / Space", "Cancel", "Closes.", "the browser (JS-free) or the Cancel"],
          [
            "Enter / Space",
            "Action",
            "Runs the `action`, then closes; ignored while pending by default.",
            "the Action",
          ],
        ]}
      />
      <ul>
        <li>
          The Popup is <code>role="alertdialog"</code> with <code>aria-modal</code> from{" "}
          <code>showModal()</code>, <code>aria-labelledby</code> pointing at the Title and{" "}
          <code>aria-describedby</code> at the Description. The Trigger is a plain button (no{" "}
          <code>aria-expanded</code>, no <code>aria-haspopup</code>).
        </li>
        <li>
          Development warnings, in addition to Dialog's: a Popup without a Description and without
          an <code>aria-describedby</code> of yours that names an element, once, when its first
          showing ends (a Description behind a Suspense boundary that resolves meanwhile counts).
        </li>
      </ul>

      <BehaviourSection
        id="transition-types"
        summary={
          "Dialog's, not an AlertDialog set: library mode tags an open with `fsui-dialog` plus `fsui-dialog-open`, a Cancel, Action or Form close with `fsui-dialog` plus `fsui-dialog-close`; Escape is a fact and carries none. To tell an alert dialog's open from a dialog's in a transition map, add your own type with `addTransitionType` in `openChangeAction`."
        }
      />

      <BehaviourSection
        id="optimistic-and-pending"
        summary={
          "The Action is a [pure trigger](/concepts/pending-and-optimistic#pure-trigger): `data-pending` and `state.pending` from the click until the close commits, `aria-disabled` while it ignores a second click (the default). From the moment its action resolves the close is the Root's: the Trigger shows `data-pending` too. The Cancel stays active while the Action is pending; clicked meanwhile, it shows `data-pending` (no `aria-disabled`) until its close commits, when the action settles."
        }
      >
        <h4>Walkthrough (library mode)</h4>
        <ol>
          <li>
            Click Delete: the button gets <code>data-pending</code> and{" "}
            <code>aria-disabled="true"</code>; your action runs. A second click is ignored.
          </li>
          <li>
            It resolves: the library asks the Root to close (<code>openChangeAction(false)</code>,{" "}
            <code>reason: "activate"</code>); when that settles the dialog closes, inside the view
            transition if the Popup has <code>transition</code>, and focus returns to the Trigger.
            If the action re-rendered something that suspends, the dialog stays open and the button
            pending until that content has committed: one transition.
          </li>
          <li>
            It rejects: nothing is dispatched, the dialog stays open, focus stays on the button, the
            error reaches the nearest Error Boundary above it.
          </li>
        </ol>
        <h4 id="cancel-while-pending">Cancel unavailable while the confirm runs</h4>
        <CodeBlock>{`const [deleting, setDeleting] = useOptimistic(false);

<AlertDialog.Cancel disabled={deleting}>Cancel</AlertDialog.Cancel>
<AlertDialog.Action
  action={async () => {
    setDeleting(true);            // optimistic: reverts by itself when the action settles
    await deleteProject(project.id);
  }}
>
  Delete
</AlertDialog.Action>`}</CodeBlock>
        <p>Escape still closes the dialog.</p>
      </BehaviourSection>

      <BehaviourSection
        id="suspense"
        summary={
          "As a Dialog's: content that suspends holds the open, the Trigger is pending, and the dialog opens complete with focus on the Cancel (the target is resolved right before `showModal()`). With a `<Suspense>` inside the Popup whose fallback has no Cancel, the dialog opens on the fallback and focus does not move when the Cancel arrives: keep the buttons outside that boundary."
        }
      />

      <BehaviourSection
        id="browser-owned-state"
        summary={
          'JS-free mode: the browser owns everything. Library mode: the Trigger, Cancel, Action and Form are requests (`openChangeAction`); Escape is the browser\'s, a fact: the dialog closes at once and `onOpenChange(false, { reason: "dismiss" })` is called. Cancel and Escape both mean "no" and arrive on different channels: pass the same function to both props to hear every "no".'
        }
      />

      <BehaviourSection
        id="before-hydration"
        summary={
          'JS-free mode: the Trigger (`command="show-modal"`), the role and the wiring, the Cancel (`command="request-close"`, with `autofocus` in the server HTML), Escape, the backdrop that does not dismiss, and an `AlertDialog.Form` with a Server Function all work from a Server Component and before hydration. An Action with `action` needs hydration: before it the button does nothing. Library mode: the content is not in the server HTML.'
        }
      >
        <Example file="AlertDialogServerConfirm.tsx" css="dialog.css">
          <AlertDialogServerConfirm />
        </Example>
        <p>
          This confirmation is a Server Component. The site is static, so its form only closes the
          dialog; with a server, pass a Server Function and nothing else changes:
        </p>
        <CodeBlock>{`// A Server Component; deleteProject is a Server Function ("use server").
<AlertDialog.Root>
  <AlertDialog.Trigger>Delete project</AlertDialog.Trigger>
  <AlertDialog.Popup>
    <AlertDialog.Title>Delete "{project.name}"?</AlertDialog.Title>
    <AlertDialog.Description>This cannot be undone.</AlertDialog.Description>
    <AlertDialog.Form action={deleteProject}>
      <input type="hidden" name="id" value={project.id} />
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <button type="submit">Delete</button>
    </AlertDialog.Form>
  </AlertDialog.Popup>
</AlertDialog.Root>`}</CodeBlock>
        <Table
          head={["", "`AlertDialog.Form action` + submit button", "`AlertDialog.Action action`"]}
          rows={[
            [
              "Before hydration",
              "the form posts to the Server Function; the page is rendered again",
              "the button does nothing",
            ],
            [
              "After hydration",
              "React runs the action; the dialog closes when its transition settles",
              "the action runs in the button's transition, then the close",
            ],
            [
              "Pending",
              "`useFormStatus()` in the submit button, `AlertDialogFormState.pending`",
              "`data-pending` / `state.pending` on the Action",
            ],
            [
              "Rejection",
              "Error Boundary; the dialog stays open",
              "Error Boundary; the dialog stays open",
            ],
            ["Arguments", "`FormData` (hidden inputs)", "a closure"],
          ]}
        />
      </BehaviourSection>

      <h3 id="forms">Forms</h3>
      <p>
        <code>AlertDialog.Form</code> is <code>Dialog.Form</code>: with a function{" "}
        <code>action</code> it closes the dialog once the action's transition settles without
        throwing; rendered as a <code>Form.Root</code> it also waits for a result without field
        errors, so a confirm that needs inline errors next to live buttons is a Form (see{" "}
        <a href="/components/dialog#forms">Dialog: Forms</a>). Confirm with a plain{" "}
        <code>{'<button type="submit">'}</code> inside it, not an <code>AlertDialog.Action</code>:
        the form is React's own channel, and an Action inside it would be a second owner of the same
        click.
      </p>

      <h3 id="recipes">Recipes</h3>
      <h4>Controlled, opened from a menu</h4>
      <CodeBlock>{`const [confirming, setConfirming] = useState(false);

<Menu.Item action={() => setConfirming(true)}>Delete…</Menu.Item>

<AlertDialog.Root open={confirming} openChangeAction={setConfirming} onOpenChange={setConfirming}>
  <AlertDialog.Popup>
    <AlertDialog.Title>Delete 3 files?</AlertDialog.Title>
    <AlertDialog.Description>They are moved to the trash.</AlertDialog.Description>
    <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
    <AlertDialog.Action action={moveToTrash}>Move to trash</AlertDialog.Action>
  </AlertDialog.Popup>
</AlertDialog.Root>`}</CodeBlock>
      <h4>Confirm before closing an editor</h4>
      <p>
        The nested confirm of the <a href="/components/dialog#recipes">Dialog recipes</a>, with the
        inner Root written as an <code>AlertDialog.Root</code>: "Keep editing" is its Cancel
        (focused on open), "Discard" its Action. Keep the inner Root JS-free so it opens
        synchronously in the click; no action awaits the user's answer.
      </p>
      <h4>One place for every outcome</h4>
      <CodeBlock>{`<AlertDialog.Root
  open={open}
  openChangeAction={async (next, { returnValue }) => {
    if (!next && returnValue === "discard") await discardDraft();
    startTransition(() => setOpen(next));
  }}
  onOpenChange={setOpen}
>
  …
  <AlertDialog.Cancel>Keep editing</AlertDialog.Cancel>
  <AlertDialog.Action value="discard">Discard</AlertDialog.Action>`}</CodeBlock>
      <p>
        Here the pending state shows on the Trigger, not on the Action, and a rejection goes to the
        boundary above the Root, which removes the dialog. Prefer the Action's <code>action</code>.
      </p>
    </DocPage>
  );
}
