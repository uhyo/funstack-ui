# AlertDialog

Status: **decided and implemented** (#167, part of #162). The decisions and the implementation
notes are in the 2026-11-26 #167 entries of `design/CHANGELOG.md`. Follows
`design/conventions.md`; where this document and the conventions disagree, the conventions win.
**Read `design/components/dialog.md` first**: an AlertDialog is a Dialog, and every rule of that
document applies unless this one says otherwise. This document states only what differs.

Inputs: `docs/vision.md`, `design/conventions.md`, `design/overlay-open-state.md`,
`design/components/dialog.md`, `docs/research/dialog.md` (close requests, `closedby`, the
anti-abuse rule, the `alertdialog` role on `<dialog>`), the implemented
`packages/ui/src/dialog/*` and `internal/overlay/use-overlay-close.ts`, the WAI-ARIA APG Alert
and Message Dialogs pattern and its Dialog (Modal) pattern, prior art (Radix AlertDialog, Base
UI AlertDialog), and working notes in `memo/architect/alert-dialog-notes.md`.

An alert dialog interrupts the user with a message that needs an answer: "Delete this project?",
"Your session expired". It is a modal `<dialog>` with `role="alertdialog"` that a stray click
cannot close and that opens with focus on the answer that destroys nothing. The Async React
half is the confirm button: `AlertDialog.Action` runs an async `action`, shows `data-pending`
on itself, closes the dialog when the action resolves and leaves it open when it rejects.

## Decisions at a glance

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Shape | A separate namespace, `AlertDialog`, at `@funstack/ui/alert-dialog`: `Root`, `Trigger`, `Popup`, `Title`, `Description`, `Cancel`, `Action`, `Form`. Not a prop on `Dialog`. Every part runs the code of the matching Dialog part with some props fixed (section 8). |
| 2 | Always modal | No `modal` prop. `showModal()` only: top layer, inert page, `aria-modal`. |
| 3 | Role | `AlertDialog.Popup` renders `<dialog role="alertdialog">`; `role` is owned. `aria-labelledby` and `aria-describedby` are wired to Title and Description as in Dialog; a missing Description warns in development (the APG requires the message to be the description). |
| 4 | No light dismiss | No `lightDismiss` prop and no `experimental_closedBy`. A click on the backdrop does nothing, in every engine, with no JS. |
| 5 | Escape closes | Escape, Android back and an assistive-technology dismiss close the dialog, as the APG and Radix have it. It is the platform's close request: a fact, `onOpenChange(false, { reason: "dismiss" })`, and it means "cancel". There is no prop to turn it off (section 4). |
| 6 | Initial focus | The first enabled `AlertDialog.Cancel`, through Dialog's `autofocus` mechanism. `initialFocus` on Popup overrides it. Without a Cancel the platform chooses. |
| 7 | `Cancel` | `Dialog.Close` under another name, plus being the default focus target. |
| 8 | `Action` | `Dialog.Close` with an `action` under another name: the action runs in the part's own transition, `data-pending` and (by default) `aria-disabled` meanwhile, then the close goes through the Root; a rejection leaves the dialog open. With `action` it is not a native close invoker (section 3.2), as every Close part with an `action` (conventions 7.3). |
| 9 | No-JS path | JS-free mode as Dialog's. The Trigger and Cancel are Invoker Commands; the confirm that works without JS is `AlertDialog.Form action={serverFunction}` with a submit button (section 6). |
| 10 | Requests and facts | Unchanged from `dialog.md` 2.7, minus the rows that cannot occur (light dismiss, non-modal). |
| 11 | Styling surface | The same as a Dialog's: `:open`, `:modal`, `::backdrop`, `data-modal`, `data-open` (both modes: DOM-synced in JS-free mode, `dialog.md` 2) / `data-pending` on the Trigger, `data-pending` on Cancel and Action, the `fsui-dialog*` transition types. One stylesheet styles both. |

---

## 1. Anatomy

```tsx
import { AlertDialog } from "@funstack/ui/alert-dialog";

<AlertDialog.Root>                                {/* no DOM */}
  <AlertDialog.Trigger>Delete project</AlertDialog.Trigger>
  <AlertDialog.Popup>                             {/* dialog[role=alertdialog] */}
    <AlertDialog.Title>Delete "Atlas"?</AlertDialog.Title>
    <AlertDialog.Description>
      The project and its 12 documents are removed for everyone. This cannot be undone.
    </AlertDialog.Description>
    <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>           {/* focused on open */}
    <AlertDialog.Action action={() => deleteProject(id)}>     {/* pending, then closes */}
      Delete
    </AlertDialog.Action>
  </AlertDialog.Popup>
</AlertDialog.Root>
```

Rendered HTML (JS-free mode):

```html
<button type="button" commandfor="_r_1_" command="show-modal">Delete project</button>
<dialog id="_r_1_" role="alertdialog" aria-labelledby="_r_1_-title"
        aria-describedby="_r_1_-description" data-modal="">
  <h2 id="_r_1_-title">Delete "Atlas"?</h2>
  <p id="_r_1_-description">The project and its 12 documents are removed …</p>
  <button type="button" commandfor="_r_1_" command="request-close" autofocus>Cancel</button>
  <button type="button">Delete</button>   <!-- has `action`: no command (3.2) -->
</dialog>
```

| Part | Element | Is Dialog's | Differs in |
| --- | --- | --- | --- |
| `Root` | none | `Dialog.Root` | no `modal` prop (always `true`) |
| `Trigger` | `button` | `Dialog.Trigger` | nothing |
| `Popup` | `dialog` | `Dialog.Popup` | `role="alertdialog"` (owned); no `lightDismiss`, no `experimental_closedBy`; default `initialFocus` is the Cancel; a development warning for a missing Description |
| `Title` | `h2` | `Dialog.Title` | nothing |
| `Description` | `p` | `Dialog.Description` | nothing |
| `Cancel` | `button` | `Dialog.Close` | the default initial focus target |
| `Action` | `button` | `Dialog.Close` | nothing (with `action` no native command, as every Close part) |
| `Form` | `form` | `Dialog.Form` | nothing |

Why a separate namespace and not `<Dialog.Root alert>` or a documented recipe:

- **The defaults are the component.** What makes a dialog an alert dialog is three things a
  consumer must otherwise remember each time: the role, the absence of light dismiss, and the
  focus on the safe answer. A preset prop on `Dialog.Root` would have to reach the Popup (role,
  dismissal) and a Close (focus), and would leave `modal={false}` and `lightDismiss` on the type
  for a combination that must reject them. A namespace removes them from the types instead.
- **The part names carry meaning.** `Cancel` and `Action` say which button is the safe one;
  `Dialog.Close` twice does not, and the library needs to know which is which for the initial
  focus.
- **Familiarity is free here.** `AlertDialog.Root / Trigger / Title / Description / Cancel /
  Action` are the names Radix and shadcn/ui users already type; `Popup` (not `Content`) is this
  library's word for top-layer content (conventions 1.1). No Portal and no Overlay part, as in
  Dialog: the top layer and `::backdrop` are the platform's.
- **It costs almost no code.** The build is unbundled (conventions 7.2), so the subpath imports
  the Dialog modules; the AlertDialog files are thin callers (section 8).

`Form` is in the namespace, although Radix has none, because it is the confirm that works
without JavaScript and with a Server Function (section 6).

**The parts share Dialog's context.** `AlertDialog.Root` provides the Dialog context, so a
part binds to the nearest Root of either kind: a `Dialog.Close` written inside an
`AlertDialog.Popup` closes the alert dialog, and an `AlertDialog.Root` nested in a
`Dialog.Popup` is the nested confirm of `dialog.md` 12.5 with the same placement rule (the outer
dialog's parts sit outside the inner Root). The documented parts of an AlertDialog are its own;
mixing is not an error and is not advertised.

---

## 2. What is fixed, and why

### 2.1 Modal only

An alert dialog exists to interrupt. A non-modal one would leave the page operable under a
question that is supposed to block it, and would have no close watcher. `AlertDialog.Root` has
no `modal` prop and always opens with `showModal()`. One consequence: the non-modal branches of
Dialog (the Trigger's `show()` click handler, the JS Escape listener, the document light-dismiss
listeners, the focus-free re-open of a refused fact) are never reached.

`data-modal` is still rendered on the Popup and `modal: true` stays in the state objects, so
selectors and render functions written for a Dialog apply unchanged.

### 2.2 `role="alertdialog"`

The research verified that `role="alertdialog"` on `<dialog>` keeps every native behaviour
(`docs/research/dialog.md`, "Accessibility"). The Popup renders it and owns it: a consumer's
`role`, on the part or on a `render` element, is dropped (conventions 1.2). `aria-modal` is the
browser's, from `showModal()`.

The APG asks for `aria-labelledby` (or `aria-label`) and for `aria-describedby` naming the
alert message. Both ids are wired as in Dialog. In development the Popup warns, once per
instance, if by the end of its first showing (its first `close`) no `AlertDialog.Description`
was mounted and no consumer `aria-describedby` named an element (a Description behind a
Suspense boundary that resolves while the dialog is open counts): a screen reader announces an alert dialog by its name and description, and
without the description the user hears a title and two buttons. (Dialog's warning for a missing
name stays.)

### 2.3 No light dismiss

`AlertDialog.Popup` has no `lightDismiss` and no `experimental_closedBy`, and `closedby` is
owned and not rendered. A modal `<dialog>` without `closedby` behaves as `closerequest` in every
engine, Safari included: Escape and the back button close it, a click on the backdrop does not.
So "no light dismiss" needs no attribute and no listener, and is the same before hydration.

Not `closedby="none"`: see section 4.

---

## 3. Parts and types

Types that are Dialog's are exported under AlertDialog names as aliases, so a function typed
for one accepts the other.

```ts
export type AlertDialogOpenChangeDetails = DialogOpenChangeDetails; // reason, returnValue
export type AlertDialogRootState = DialogRootState;                 // open, pending, modal (true)
export interface AlertDialogRootProps extends Omit<DialogRootProps, "modal"> {}

export type AlertDialogTriggerProps = DialogTriggerProps;
export type AlertDialogTriggerState = DialogTriggerState;

export type AlertDialogPopupState = DialogPopupState;               // open, modal (true)
export interface AlertDialogPopupProps
  extends Omit<DialogPopupProps, "role" | "lightDismiss" | "experimental_closedBy"> {
  /**
   * Element to focus when the dialog opens: a ref, or a selector resolved inside the dialog.
   * Default: the first enabled `AlertDialog.Cancel`; without one, the platform's choice.
   */
  initialFocus?: RefObject<HTMLElement | null> | string;
}

export type AlertDialogTitleProps = DialogTitleProps;
export type AlertDialogDescriptionProps = DialogDescriptionProps;
export type AlertDialogFormProps = DialogFormProps;
export type AlertDialogFormState = DialogFormState;
```

`keepMounted`, `transition`, `className` / `style` / `children` as functions of state, `render`
and the native pass-through are Dialog's. The mode rule is Dialog's too: a Root with none of
`open`, `defaultOpen`, `openChangeAction`, `onOpenChange` is JS-free; any of them selects library
mode (conventions 3.9.11).

### 3.1 `AlertDialog.Cancel`

```ts
export type AlertDialogCancelProps = DialogCloseProps;   // action, whilePending, value, disabled, …
export type AlertDialogCancelState = DialogCloseState;   // pending, disabled
export type AlertDialogCancelActionDetails = DialogCloseActionDetails;   // conventions 9.4: <Component><Part>ActionDetails
```

Everything `dialog.md` 3.4 says of `Dialog.Close` holds: a native `request-close` invoker in
JS-free mode, a library-owned close through the Root in library mode (`openChangeAction(false,
{ reason: "activate", returnValue })` awaited, view transition if set, a controlled veto). It
keeps `action` and `whilePending` because it is the same part; a Cancel rarely needs them.
Like every Close part it shows `data-pending` (`state.pending`) from the click until its close
has committed, without an `action` too (conventions 4.3): that is the feedback for a Cancel
whose close waits behind a pending Action (7.4).

Its `value` defaults to `""`, which is also what Escape leaves in `returnValue`: by default
"the user pressed Cancel" and "the user pressed Escape" read the same, and both mean that
nothing was confirmed. They still arrive on different channels (section 5).

What it adds: it is the default initial focus target (section 3.4).

### 3.2 `AlertDialog.Action`

```ts
export interface AlertDialogActionProps
  extends Omit<
    ComponentPropsWithRef<"button">,
    "onClick" | "value" | "type" | "commandfor" | "command" | "popoverTarget" | "popoverTargetAction" | "aria-disabled" | "className" | "style" | "children"
  > {
  /**
   * The confirmed work. Runs inside this part's own transition (`data-pending` on the button),
   * then closes the dialog with `value` as `returnValue`: in library mode through the Root
   * (`openChangeAction(false)` awaited, view transition if set), in JS-free mode with
   * `close(value)`. A rejection reaches the nearest Error Boundary above this part and leaves
   * the dialog open. If the dialog was dismissed and opened again while the action ran, the
   * close is dropped. Without `action` the button only closes the dialog (read `returnValue`
   * in `openChangeAction`).
   */
  action?: Action<[details: AlertDialogActionDetails]>;
  /**
   * What a click does while the `action` is pending. `"ignore"`: nothing (`aria-disabled="true"`
   * meanwhile). `"run"`: the action runs again; the dialog still closes once. Default `"ignore"`.
   */
  whilePending?: WhilePending;
  /** Becomes `dialog.returnValue` (and `details.returnValue` of the close request). Default `""`. */
  value?: string;
  disabled?: boolean;
  className?: StateValue<string | undefined, AlertDialogActionState>;
  style?: StateValue<CSSProperties | undefined, AlertDialogActionState>;
  children?: StateValue<ReactNode, AlertDialogActionState>;
  render?: RenderProp<ComponentPropsWithRef<"button">, AlertDialogActionState>;
}
export type AlertDialogActionState = DialogCloseState;      // pending, disabled
export type AlertDialogActionDetails = DialogCloseActionDetails;  // event, returnValue; the part is named `Action`, so the word is not repeated (conventions 9.4)
```

This is `Dialog.Close` with an `action`, rule for rule (`dialog.md` 3.4; conventions 2.5.1, the
"mixed" owner):

| | |
| --- | --- |
| Lane | the part's own transition (`useActionTrigger` through `useOverlayClose`); the Root's transition takes over for the close |
| Pending | `data-pending` and `state.pending` on the Action from the click until the close commits; then also on the Trigger and Root (`dialog.md` 4.2) |
| `whilePending` | default `"ignore"`: a second click, Enter or Space is cancelled and the button is `aria-disabled="true"` while pending. `"run"`: every click runs the action; one close, after the last run, if the latest resolved |
| Resolves | library mode: `requestClose(event, "activate", value ?? "")`; JS-free mode: `dialog.close(value ?? "")` |
| Rejects | nothing is dispatched; the dialog stays open, focus stays on the Action; the error goes to the nearest Error Boundary above the part |
| `openChangeAction(false)` rejects, or a controlled parent keeps `open` | as `dialog.md` 4.3: Error Boundary above the Root; snap-back (a real veto) |
| Stale close | dropped by the open-generation guard |

**An Action with `action` renders no `commandfor` / `command`.** A native command would close
the dialog before hydration **without running the action**: for a confirm button a false
answer, the dialog going away as if the project had been deleted. So an Action that has an
`action` is a plain `<button type="button">` until hydration (the click does nothing), and the
click handler is the only thing that ever closes it. This started as the one difference from
`Dialog.Close`; since #182 it is the rule for every Close part with an `action` (conventions
7.3), so there is no difference left. This matters in JS-free mode only: in library mode the
content is not in the server HTML, so there is no Action to click before hydration. An Action
**without** `action` keeps the native command, as there is nothing to skip. The confirm that
must work before hydration is the Form (section 6).

Owned keys: `Dialog.Close`'s (`type`, `disabled`, `commandfor`, `command`, `value`, `onClick`
when installed, `aria-disabled`, `data-pending`, `data-disabled`).

### 3.3 `AlertDialog.Form`

`Dialog.Form`, unchanged (`dialog.md` 3.5 and 8): `method="dialog"` without `action`; with a
function `action`, React's form action passed through unwrapped and a settle close through the
Root; `closeOnSettle`; the `Form.Root` composition for field errors.

### 3.4 Initial focus

The APG's Dialog (Modal) pattern says to put focus on the least destructive action when the
dialog completes something that cannot be undone. That is the Cancel.

- **The rule.** When `AlertDialog.Popup` has no `initialFocus`, the target is the first
  `AlertDialog.Cancel` in the Popup, in tree order, that is not disabled. With no such Cancel
  (a message dialog with a single "OK") the Popup names no target and the platform's dialog
  focusing steps choose: the first focusable element. A missing Cancel is not a warning.
- **Library mode.** The Popup resolves the target right before `showModal()` and writes
  `autofocus` on it, then removes it after the open: Dialog's mechanism (`dialog.md` 6.1), with
  the Cancel in place of a consumer's ref. The library never calls `.focus()`.
- **JS-free mode.** The browser opens the dialog itself, so the attribute has to be there
  already. An enabled Cancel renders React's `autoFocus` when the Popup has no `initialFocus`
  (the Popup tells its descendants through context, so this is decided during the server
  render): the attribute is in the server HTML and the focus is right before hydration. The
  prop is rendered only in the server render and the render that hydrates it (the server
  snapshot of `useSyncExternalStore`): on a client-created element React does not write the
  attribute but calls `.focus()`. The Cancel's ref writes the attribute in every render, and
  removes it when the Cancel becomes disabled or stops being the target. With several Cancels each enabled
  one carries the attribute and the platform takes the first; the dialog focusing steps skip a
  disabled element that carries it (verified in the three engines). A Cancel that mounts or
  remounts on the client into an already open JS-free dialog (a key change, a Suspense reveal,
  an Error Boundary fallback) therefore takes no focus: React's `.focus()` would move it away
  from the user, and with two Cancels the last one mounted would win against the rule.
- **Opting out.** `initialFocus` on the Popup wins (a ref or a selector), and then no Cancel
  renders `autoFocus`. The APG's other advice still applies to a long message: point
  `initialFocus` at the Title with `tabIndex={-1}` so the text is read from the top.

A refused dismissal's re-open (a controlled parent that keeps `open={true}` after Escape) is a
normal modal open and focuses the Cancel again (conventions 3.9.4).

Return focus is the platform's and Dialog's (`dialog.md` 6.2).

### 3.5 Namespace

```ts
export const AlertDialog = {
  Root: AlertDialogRoot,
  Trigger: AlertDialogTrigger,
  Popup: AlertDialogPopup,
  Title: AlertDialogTitle,
  Description: AlertDialogDescription,
  Cancel: AlertDialogCancel,
  Action: AlertDialogAction,
  Form: AlertDialogForm,
} as const;
```

---

## 4. Escape

| | Escape | Backdrop click |
| --- | --- | --- |
| WAI-ARIA APG | the alert dialog pattern has no keyboard section of its own and points to Dialog (Modal): Escape closes the dialog | not mentioned |
| Radix AlertDialog | closes (`onEscapeKeyDown` may prevent it) | does not close |
| **AlertDialog** | closes: the platform's close request | does not close |

Escape closes an alert dialog, and the close is the browser's: closed at once, focus returned
by the platform, committed `false` written urgently, `onOpenChange(false, { reason: "dismiss",
returnValue: "" })` called from the `close` event (`dialog.md` 2.3, conventions 3.9.3). It is
the keyboard's Cancel. Android back and an assistive-technology dismiss gesture are the same
close request.

There is no prop that turns Escape off:

- The APG keeps Escape, and a keyboard or screen-reader user relies on it in every dialog.
- The honest mechanism, `closedby="none"`, is in Chromium and Firefox and not in Safari 27.0,
  and it cannot be emulated there: cancelling `cancel` holds once per user activation and then
  the dialog closes anyway (`docs/research/dialog.md`, the anti-abuse rule). A prop would work
  in two engines and silently not in the third.
- `closedby="none"` does not stop `requestClose()` or a `request-close` command either, so it
  would not make "must answer" true by itself.

An alert dialog whose answer the application cannot do without is written so that a dismissal
is a valid answer: Escape means Cancel, and the destructive or required step happens only in
the Action's `action`. Where the dialog must come back (a session that has expired), a
controlled Root that keeps `open={true}` gets it re-opened in the same task with focus inside
(conventions 3.9.4); the user sees it leave and return, and that is stated as what it is, not
as a veto. `onCancel` passes through to the `<dialog>` for a consumer who wants the platform's
once-per-activation hook.

---

## 5. Requests and facts

Conventions 3.9 and `dialog.md` 2.7, with the rows an alert dialog can have:

| Cause | Channel | `next` | `reason` | `returnValue` |
| --- | --- | --- | --- | --- |
| Trigger click; a foreign `show-modal` command | `openChangeAction` | `true` | `"activate"` | `undefined` |
| Found open at hydration | `openChangeAction` | `true` | `"platform"` | `undefined` |
| `AlertDialog.Cancel` | `openChangeAction` | `false` | `"activate"` | the Cancel's `value` (`""`) |
| `AlertDialog.Action`, after its `action` resolved | `openChangeAction` | `false` | `"activate"` | the Action's `value` (`""`) |
| `AlertDialog.Form` submit or settle; a foreign `request-close` / `close` command | `openChangeAction` | `false` | `"activate"` | the submitter's or invoker's `value` |
| Escape, Android back, an assistive-technology dismiss | **`onOpenChange`** | `false` | `"dismiss"` | `""` |
| Script `close()` / `requestClose()` | **`onOpenChange`** | `false` | `"dismiss"` | `dialog.returnValue` |
| Controlled prop change; re-open of a refused fact; removal from the document | none | | | |

Cancel is a request and Escape is a fact, although both mean "no". The difference is who
performed the close, as everywhere (conventions 3.9.2): a Cancel click is held by the library
(awaited, vetoable, animated with the view transition), Escape is not. A consumer who wants to
hear every "no" passes the same function to both props (conventions 3.9.10).

**The confirmed work belongs in the Action's `action`, not in `openChangeAction`.** The action
is where the pending state is on the button the user pressed, where a rejection keeps the
dialog open, and where no dismissal can be mistaken for consent. `openChangeAction(false)` with
`returnValue` remains for a dialog whose owner wants one place for every outcome:

```tsx
<AlertDialog.Root
  open={open}
  openChangeAction={async (next, { returnValue }) => {
    if (!next && returnValue === "discard") await discardDraft();
    startTransition(() => setOpen(next));
  }}
  onOpenChange={setOpen}
>
  …
  <AlertDialog.Cancel>Keep editing</AlertDialog.Cancel>
  <AlertDialog.Action value="discard">Discard</AlertDialog.Action>
```

There the pending state shows on the Trigger and Root, not on the Action, and a rejection goes
to the boundary above the Root, which removes the dialog. Prefer the `action`.

---

## 6. JS-free mode and the path without JavaScript

A Root with none of the four state props is JS-free, as a Dialog's (`dialog.md` 2.1): the
Trigger is `command="show-modal"`, the Cancel `command="request-close"`, the content is in the
server HTML, the role and the wiring are attributes, the Cancel carries `autofocus`, the
backdrop does not dismiss and Escape does. All of it works from a Server Component and before
hydration.

The confirm has two shapes, the two Dialog already has:

```tsx
// (a) A Server Function through a form: works before hydration and without JavaScript.
<AlertDialog.Root>
  <AlertDialog.Trigger>Delete project</AlertDialog.Trigger>
  <AlertDialog.Popup>
    <AlertDialog.Title>Delete "{project.name}"?</AlertDialog.Title>
    <AlertDialog.Description>This cannot be undone.</AlertDialog.Description>
    <AlertDialog.Form action={deleteProject}>          {/* "use server" */}
      <input type="hidden" name="id" value={project.id} />
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <button type="submit">Delete</button>
    </AlertDialog.Form>
  </AlertDialog.Popup>
</AlertDialog.Root>

// (b) An action prop on the button: needs hydration, shows pending on the button.
<AlertDialog.Action action={() => deleteProject(project.id)}>Delete</AlertDialog.Action>
```

| | (a) `Form action` + submit button | (b) `Action action` |
| --- | --- | --- |
| Before hydration | the form posts to the Server Function (React's progressive enhancement); the page is rendered again | the button does nothing (3.2) |
| After hydration | React runs the action; the Form's watcher closes the dialog when its transition settles | the action runs in the part's transition; then the close |
| Pending | `useFormStatus()` in the submit button, `AlertDialogFormState.pending` | `data-pending` / `state.pending` on the Action |
| Rejection | Error Boundary; the dialog stays open | Error Boundary above the Action; the dialog stays open |
| Arguments | `FormData` (hidden inputs) | a closure |

Shape (a) uses a plain submit button, not `AlertDialog.Action`: the form is React's own channel
(conventions 2.7) and an Action inside it would be a second owner of the same click.
`AlertDialog.Action type="submit"` is not supported (`type` is owned).

In JS-free mode with (b), after hydration, the Action runs its action and then calls
`dialog.close(value)`: a browser-owned close, as `Dialog.Close action` in that mode. Library
mode is needed only for what Dialog needs it for: content that loads on open, a controlled
`open`, the callbacks, the view-transition exit.

---

## 7. Async walkthroughs

Library mode, uncontrolled, unless stated. `C` committed open, `O` optimistic open.

1. **Confirm resolves.** Click "Delete": the click is handled by the part (no native command) →
   the Action's transition: `data-pending` + `aria-disabled` on the button, `await
   deleteProject()` → resolves → `requestClose(click, "activate", "")`: `O=false`, the Trigger
   shows `data-pending`, `openChangeAction(false)` awaited → `C=false` commits, the apply effect
   calls `close("")` inside the view transition if `transition` is set; the platform returns
   focus to the Trigger. The Action's `data-pending` clears in that same commit. If the action
   re-renders the page (the deleted row leaves a list that suspends), the dialog stays open and
   the Action pending until that content has committed: one transition.
2. **Confirm rejects.** As 1 until the rejection: nothing was dispatched, `C` and `O` stay
   `true`, the dialog is open and focus is on the Action. The error reaches the nearest Error
   Boundary above the Action. A boundary inside the Popup, around the Action only, shows the
   failure in the dialog; one that also contains the Cancel removes the way out, and one above
   the Root replaces the whole subtree, which removes the dialog. An action that catches its
   error and calls `details.reject()` gets the same "nothing dispatched, dialog open, focus on
   the Action" with no boundary (conventions 2.4.1; section 9.1 shows both).
3. **Escape while the confirm is pending.** The platform closes the dialog: a fact,
   `onOpenChange(false, "dismiss")`, `C=false` at once. **The action keeps running**; an action
   cannot be recalled. When it resolves, its close is a no-op (`false` is already intended).
   When it rejects, the Action has unmounted with the content (or is hidden), so the error
   follows conventions 2.4's owner-gone route. The docs say: dismissing a pending confirmation
   hides it, it does not abort it.
4. **Cancel while the confirm is pending.** The same outcome through the other channel, later:
   the Cancel's close is a Root request (`openChangeAction(false, "activate")`), and React
   entangles its transition with the Action's pending one (conventions 2.3 item 5), so in
   library mode the dialog stays open, the Trigger pending, until the **action** settles; then
   the close commits and the Action's own close is a no-op. A rejection still reaches the
   boundary above the Action, and the dialog closes. In JS-free mode the Cancel is the browser's
   command and closes the dialog at once, as Escape does in both modes. **The Cancel shows
   that its click was taken**: it has `data-pending` from the click until the close commits
   (every Close part runs in its own transition, conventions 4.3), without `aria-disabled`,
   so a stylesheet can show a spinner on it or dim the dialog
   (`.alert:has([data-pending])`); the Trigger's `data-pending` is under the modal backdrop
   and shows nothing here. The dialog still stays open until the action settles. The library
   does not disable the Cancel while an Action is pending: Escape cannot be held either, so
   "the dialog can leave while the work runs" is true whatever the Cancel does, and one rule
   covers both. A dialog whose work takes long may instead make the Cancel unavailable
   meanwhile with its own optimistic state (section 9.3).
5. **Two clicks on the confirm.** Default `"ignore"`: the second is cancelled, one run, one
   close. `whilePending="run"`: two runs, one close after the last.
6. **Open with content that suspends.** `dialog.md` 11.1: the Trigger is pending, the dialog
   opens complete, and the focus lands on the Cancel because the target is resolved right
   before `showModal()`, after the content has committed. With a `<Suspense>` inside the Popup
   whose fallback has no Cancel, the dialog opens on the fallback, the platform focuses the
   first focusable element or the dialog itself, and focus is not moved when the Cancel
   arrives: keep the buttons outside that boundary.
7. **Controlled, Trigger-less, opened by something else** (a Menu item, an expired session):
   the parent sets `open` in a transition; the apply effect opens the dialog; Cancel and Action
   are requests the parent adopts in `openChangeAction`, Escape a fact it adopts in
   `onOpenChange`.
8. **Controlled veto.** A parent that does not adopt the `false` an Action's resolved action
   asks for keeps the dialog open (snap-back): the work was done, the dialog stayed. Rarely
   wanted; stated for completeness.

---

## 8. Implementation: what is shared

Nothing in `internal/` changes its rules. The folder `packages/ui/src/alert-dialog/` has one
file per part (conventions 9.1), each a `"use client"` component with its own `displayName`,
props type and JSDoc, and each calls the code of a Dialog part:

| AlertDialog part | Runs | With |
| --- | --- | --- |
| `Root` | the body of `DialogRoot` (`useOverlayRoot`, `requestClose`, the `returnValue` ref, `DialogContext`) | `modal: true`; `part: "AlertDialog.Root"` for the messages |
| `Trigger` | the body of `DialogTrigger` | part name |
| `Popup` | the body of `DialogPopup` | `role: "alertdialog"` as an owned key, `lightDismiss: false`, `experimental_closedBy: false`, the default initial focus target, the Description warning, part name; it provides the small context of 3.4 (whether a Cancel is the default target, and the Cancel registry), since `initialFocus` is the Popup's prop |
| `Title`, `Description`, `Form` | the bodies of the Dialog parts | part name |
| `Cancel` | the body of `DialogClose` (`useOverlayClose`) | part name; registers its element as a focus candidate; in JS-free mode, while enabled and the default target, React's `autoFocus` (server HTML) and the attribute written by its ref (a client render), removed when it stops being the target (3.4) |
| `Action` | the body of `DialogClose` (`useOverlayClose`) | part name; no invoker attributes when `action` is given (one new option of `useOverlayClose`) |

To make that possible the Dialog part files export their bodies as hooks that take the
namespace (or part name) and the fixed options (`useDialogRoot`, `useDialogTrigger`,
`useDialogPopup`, `useDialogTitle`, `useDialogDescription`, `useDialogClose`, `useDialogForm`;
the public `Dialog.*` components call them with `"Dialog"`), and `useDialogPopup` takes a
`defaultInitialFocus` resolver used only without `initialFocus`, which bypasses
`useInitialFocusTarget` and its "resolved to no element" warning. The files are
`packages/ui/src/alert-dialog/alert-dialog-*.tsx`, with the Cancel context in
`alert-dialog-context.ts`. No Dialog behaviour changes.

Shared with Dialog without a second name: the transition types (`fsui-dialog`,
`fsui-dialog-open`, `fsui-dialog-close`; conventions 5.3 has no AlertDialog row because an
AlertDialog's dispatches are a Dialog's), the modal registry Toast uses, the development
warnings (worded with the AlertDialog part names), and the `open`-without-`onOpenChange`
warning of conventions 3.9.13.

Trade-off of sharing the types: a `transition` map or a `:active-view-transition-type()`
selector cannot tell an alert dialog's open from a dialog's. A consumer who needs that calls
`addTransitionType` in `openChangeAction`'s sync prefix.

---

## 9. Call-site examples

### 9.1 Client component: confirm with an action, error shown in the dialog

```tsx
"use client";
import { AlertDialog } from "@funstack/ui/alert-dialog";

export function DeleteProject({ project }: { project: Project }) {
  const [failure, setFailure] = useState<string | null>(null);
  return (
    <AlertDialog.Root defaultOpen={false}>
      <AlertDialog.Trigger className="btn danger">Delete</AlertDialog.Trigger>
      <AlertDialog.Popup className="dialog" transition="dialog-fade">
        <AlertDialog.Title>Delete "{project.name}"?</AlertDialog.Title>
        <AlertDialog.Description>
          The project and its documents are removed for everyone. This cannot be undone.
        </AlertDialog.Description>
        {failure !== null && <p className="dialog-error">{failure}</p>}
        <AlertDialog.Cancel className="btn">Cancel</AlertDialog.Cancel>
        <AlertDialog.Action
          className="btn danger"
          action={async (details) => {
            try {
              await deleteProject(project.id);
            } catch (e) {
              setFailure(String(e));
              details.reject();        // the dialog stays open, Cancel and Delete stay usable
            }
          }}
        >
          {({ pending }) => (pending ? "Deleting…" : "Delete")}
        </AlertDialog.Action>
      </AlertDialog.Popup>
    </AlertDialog.Root>
  );
}
```

`details.reject()` (conventions 2.4.1) is the way to keep the dialog open on a handled failure:
an action that catches its error and does not call it **resolves**, and a resolved action closes
the dialog (conventions 2.4). The message is the consumer's own markup; inside an alert dialog
give it `role="alert"` or move focus to it if it must be announced.

With an Error Boundary instead (the action lets the error through), put the boundary around the
**Action only**:

```tsx
<AlertDialog.Cancel className="btn">Cancel</AlertDialog.Cancel>
<ErrorBoundary fallback={<span className="dialog-error">Could not delete.</span>}>
  <AlertDialog.Action className="btn danger" action={() => deleteProject(project.id)}>Delete</AlertDialog.Action>
</ErrorBoundary>
```

A boundary that also wraps the Cancel replaces it with the fallback on failure, and Escape is
then the only way out. A confirm that needs field-level or inline errors next to live buttons is
shape (a) of section 6 with the `Form.Root` composition (`dialog.md` 8.1), whose settle close
waits for a result without errors.

### 9.2 Server Component, no client code

Section 6, shape (a).

### 9.3 Cancel unavailable while the confirm runs

```tsx
const [deleting, setDeleting] = useOptimistic(false);
…
<AlertDialog.Cancel disabled={deleting}>Cancel</AlertDialog.Cancel>
<AlertDialog.Action
  action={async () => {
    setDeleting(true);            // optimistic: reverts by itself when the action settles
    await deleteProject(project.id);
  }}
>
  Delete
</AlertDialog.Action>
```

Escape still closes the dialog (section 4).

### 9.4 Controlled, opened from a menu

```tsx
const [confirming, setConfirming] = useState(false);

<Menu.Item action={() => setConfirming(true)}>Delete…</Menu.Item>
…
<AlertDialog.Root open={confirming} openChangeAction={setConfirming} onOpenChange={setConfirming}>
  <AlertDialog.Popup>
    <AlertDialog.Title>Delete 3 files?</AlertDialog.Title>
    <AlertDialog.Description>They are moved to the trash.</AlertDialog.Description>
    <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
    <AlertDialog.Action action={moveToTrash}>Move to trash</AlertDialog.Action>
  </AlertDialog.Popup>
</AlertDialog.Root>
```

### 9.5 Confirm before closing an editor

`dialog.md` 12.5 with the inner Root written as an `AlertDialog.Root`: the "Discard…" button is
its Trigger, "Keep editing" its Cancel (focused on open), "Discard" its Action, whose `action`
discards the draft and closes the controlled editor. The inner Root stays JS-free so that it
opens synchronously in the click, and the rule that no action awaits the user's answer
(conventions 2.3 item 6) is unchanged.

---

## 10. Keyboard and ARIA

| Key | Behaviour | Who |
| --- | --- | --- |
| Enter / Space on Trigger | opens; focus moves to the Cancel | browser / Trigger, Popup |
| Tab / Shift+Tab | cycles through the dialog's focusable content and the browser UI; the page is inert | browser |
| Escape | closes (a dismissal); focus returns to the opener | browser |
| Enter / Space on Cancel | closes | browser (JS-free) / part |
| Enter / Space on Action | runs the `action`, then closes; ignored while pending by default | part |

| Part | ARIA |
| --- | --- |
| Popup | `role="alertdialog"`; `aria-modal="true"` from `showModal()`; `aria-labelledby` → Title, `aria-describedby` → Description |
| Trigger | plain button (no `aria-expanded`, no `aria-haspopup`), as Dialog |
| Cancel, Action | plain buttons; `aria-disabled="true"` while their own action is pending and ignoring |

Development warnings, in addition to Dialog's: no Description and no consumer
`aria-describedby` when first shown (2.2). To verify with NVDA, JAWS and VoiceOver before the
docs page is written: the title and the description are both announced on open with the role
"alert dialog", and focus is on the Cancel.

## 11. Not offered

- `modal={false}`, `lightDismiss`, `experimental_closedBy`, `role` (section 2).
- A prop that turns Escape off (section 4).
- `AlertDialog.Close`: it is `Cancel`.
- A `destructive` flag or attribute on Action: styling is the consumer's `className`.
- A library rule that disables the Cancel while an Action is pending (walkthrough 4, 9.3).
- An imperative `confirm()` function that returns a promise: an action must not await the
  user's answer (conventions 2.3 item 6), and a promise-returning confirm exists to be awaited.
