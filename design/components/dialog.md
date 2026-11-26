# Dialog

Status: **accepted**, implemented. History (reviews, amendments, implementation notes, the
test plan): `design/CHANGELOG.md`, parts "dialog.md". The code under `packages/ui/src/dialog/` is the ground truth where this document is silent.
Follows `design/conventions.md` (accepted); where this document and the conventions disagree, the
conventions win.

Inputs: `docs/vision.md`, `design/conventions.md`, `docs/research/dialog.md` (primary; its
verdicts and the "Option C" ownership recommendation are binding),
`docs/research/popover-anchor-tooltip.md` (Invoker Commands), `docs/research/react-async-apis.md`,
the Accordion design (two modes, mount reconciliation, `reason: "platform"`), the Tooltip design
(browser-owned open, native listeners through refs, experimental flags), the Tabs design
(committed-vs-optimistic content, `keepMounted`), the WAI-ARIA APG Dialog (Modal) pattern, and
the jsdom probes in `memo/architect/dialog-notes.md`. Prior art: Base UI Dialog, React Aria
Dialog/Modal, Radix Dialog, Ark UI Dialog.

Dialog is where the platform does the most for the library: `<dialog>` with `showModal()` gives
top layer, `::backdrop`, inertness of the rest of the page, `aria-modal`, Escape and Android back,
initial focus and focus return. The library adds nothing a focus trap, a portal or a z-index
would add. What it adds is the Async React half: opening a dialog that loads its content is a
transition keyed on committed state, so the trigger shows `data-pending` and the dialog opens
when the content is ready.

## Decisions at a glance

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Anatomy | `Dialog.Root` (no DOM), `Dialog.Trigger` (`button[commandfor][command="show-modal"]`), `Dialog.Popup` (the `<dialog>`), `Dialog.Close` (`button[commandfor][command="request-close"]`), `Dialog.Form` (`form`, closes on successful submit), `Dialog.Title` (`h2`), `Dialog.Description` (`p`). No Portal, no Backdrop part (`::backdrop` is CSS), no Positioner. |
| 2 | Two modes, one anatomy | **JS-free mode** (Root has none of `open` / `defaultOpen` / `openChangeAction` / `onOpenChange`): the browser owns everything through Invoker Commands; content is always mounted; works from a Server Component and before hydration. **Library mode** (any of the four present): **open is library-owned** (Trigger click intercepted, `openChangeAction(true)` awaited, content rendered from committed state, `showModal()` in a layout effect); **part-initiated closes are library-owned** (`Dialog.Close`, a `Dialog.Form` submit or settle, a foreign close command, a controlled `open={false}`: `openChangeAction(false)` awaited, `close(returnValue)` in the layout effect of the commit that ends it, so `<ViewTransition>` animates the exit in every engine); **dismissals are browser-owned facts** (Escape, Android back, AT dismiss, light dismiss: closed at once, committed `false` urgently, reported to `onOpenChange(false)` from the `close` event, never to `openChangeAction`; 2.7). |
| 3 | Modal | `modal` on Root, default `true`. `modal={false}` uses `show()`; it needs one click handler because there is no `show` command, so a non-modal dialog is never JS-free. |
| 4 | Reason vocabulary | `details.reason` is `"activate"` (Trigger, Close, Form submit), `"dismiss"` (Escape, back, light dismiss, assistive-technology dismiss: a close the user requested without a part), or `"platform"` (mount reconciliation of a pre-hydration open). `"dismiss"` is now part of the shared `ChangeReason` (conventions 2.2, accepted 2026-10-16). `details.returnValue` carries `dialog.returnValue` on close. |
| 5 | Pending UI | Trigger: `data-open` (optimistic) and `data-pending` in library mode. The `<dialog>` emits no `data-open`: `:open` and `:modal` are exact. Root has no DOM, so `pending` lives on the Trigger and in Root's `children(state)`. |
| 6 | Content mounting | Library mode: Popup children unmount when closed by default; `keepMounted` keeps them in `<Activity mode="hidden">` (conventions 3.7, boolean only). Unmount is deferred until the dialog's exit animations finish so a fading dialog is never empty. JS-free mode: always mounted (the markup must be complete before hydration). |
| 7 | Initial focus | `initialFocus` on Popup (a ref or a selector). The library writes `autofocus` on the resolved element through the DOM right before `showModal()` and lets the platform's dialog focusing steps run; it never calls `.focus()` on open. Return focus is the platform's; the library only handles "the opener is gone". |
| 8 | Dismissal | Escape and Android back are the platform's and cannot be disabled in v0 (the anti-abuse rule allows one veto per activation, which is not an API). `lightDismiss` on Popup (default `false`) closes on a backdrop click through JS `pointerdown` + `click` listeners: both the press and the click must land outside, as native `closedby="any"` requires. `experimental_closedBy` on Popup renders `closedby="any" \| "closerequest"` and skips the JS where `closedBy` is implemented. |
| 9 | Forms | `Dialog.Form` renders `<form method="dialog">` (JS-free: submit closes with the submitter's `value` as `returnValue`; library mode: the submit is intercepted and closes through the Root) or, with `action`, `<form action={action}>` plus a status watcher that closes the dialog (through the Root in library mode) when the action's transition settles. The action is passed through unwrapped, so a Server Function keeps React's progressive enhancement. Field errors are not a Form prop: render the form as a `Form.Root` (`render={<Form.Root errors={state.errors} />}`), and the settle close then waits for a result with no field error (#59). `Dialog.Close action` is the single-button form of the same thing. |
| 10 | Animation | Enter and exit with CSS (`@starting-style`, `transition-behavior: allow-discrete`, `overlay`); the CSS exit is a progressive enhancement (instant in Firefox). Popup renders `<ViewTransition>` and takes `transition`: it animates the opening commit (content mount plus `showModal()`), content changes while open, and **every library-driven close** (Close, Form, foreign close command, controlled close) in all three engines; dismissals animate with CSS only. |
| 11 | Scroll lock | CSS only, documented: `html:has(dialog:modal) { overflow: hidden }` with `scrollbar-gutter: stable`. No attribute on `<html>`, no JS. |
| 12 | Directives | Every part file is `"use client"` (context for ids and mode). "JS-free" means no behaviour JS runs for the interaction and the markup works before hydration, as in Accordion. |

---

## 1. Anatomy

```tsx
import { Dialog } from "@funstack/ui/dialog";

<Dialog.Root>                                   {/* no DOM; owns ids, mode, state, context */}
  <Dialog.Trigger>Edit profile</Dialog.Trigger> {/* button[commandfor][command=show-modal] */}
  <Dialog.Popup>                                {/* dialog */}
    <Dialog.Title>Edit profile</Dialog.Title>   {/* h2; wires aria-labelledby */}
    <Dialog.Description>                        {/* p; wires aria-describedby */}
      Changes are saved to your account.
    </Dialog.Description>
    <Dialog.Form action={saveProfile}>          {/* form; closes after the action settles */}
      <input name="name" />
      <Dialog.Close>Cancel</Dialog.Close>       {/* button[commandfor][command=request-close] */}
      <button type="submit">Save</button>
    </Dialog.Form>
  </Dialog.Popup>
</Dialog.Root>
```

Rendered HTML (JS-free mode; ids come from one `useId` in Root):

```html
<button type="button" commandfor="_r_1_" command="show-modal">Edit profile</button>
<dialog id="_r_1_" aria-labelledby="_r_1_-title" aria-describedby="_r_1_-description" data-modal="">
  <h2 id="_r_1_-title">Edit profile</h2>
  <p id="_r_1_-description">Changes are saved to your account.</p>
  <form action="…">                   <!-- method="dialog" when no action is given -->
    <input name="name" />
    <button type="button" commandfor="_r_1_" command="request-close">Cancel</button>
    <button type="submit">Save</button>
  </form>
</dialog>
```

| Part | Element | Role (native) | Library state rendered | Notes |
| --- | --- | --- | --- | --- |
| `Root` | none | | `state.pending`, `state.open` (optimistic), `state.modal` in `children(state)` | Owns `useId`, mode, `modal`, the state hook and context. No `ref`, `className`, `style`. |
| `Trigger` | `button` | button | `data-open` (optimistic), `data-pending` (library mode); `data-disabled` whenever disabled, in every mode (wave 9, 5fc05d5: the styling hook agrees with `disabled` / `aria-disabled` in JS-free mode too); otherwise nothing in JS-free mode | `commandfor` + `command="show-modal"`. Not an `aria-expanded` invoker (APG does not require one; research "Invoker state"). |
| `Popup` | `dialog` | `dialog` (`aria-modal` from `showModal()`) | `data-modal`; no `data-open` (`:open`, `:modal`) | Carries `id`, `aria-labelledby`, `aria-describedby`, `closedby` (flag). The content region: children render from committed state in library mode. |
| `Close` | `button` | button | `data-pending` (when `action` runs) | `command="request-close"`; `value` becomes `returnValue`. |
| `Form` | `form` | form | none | `method="dialog"` or `action` + watcher. |
| `Title` | `h2` | heading | none | `id` wiring. `render={<h3 />}` changes the level. |
| `Description` | `p` | | none | `id` wiring. |

Why these parts:

- **`Root` renders no DOM.** The trigger sits in toolbars and flex rows where a wrapper would
  change layout; the dialog is in the top layer and needs no wrapper. Trigger and Popup need not
  be siblings: `commandfor` links them by id, and they only have to share the Root for context.
  A Popup without a Trigger is valid (controlled `open`, section 2.2); a Trigger without a Popup
  is a dev warning.
- **`Popup` is the `<dialog>` itself**, not a wrapper around it. It is the part consumers style,
  the part that carries `::backdrop`, and the part whose children are the content region.
  `Popup` is the conventions' vocabulary word for top-layer content; `Content` (Radix) was
  rejected to keep one word across Tooltip, Popover and Dialog.
- **No `Backdrop` part.** `::backdrop` is a pseudo-element of the dialog; a DOM backdrop would
  need a portal and a z-index, exactly what `showModal()` makes unnecessary. A consumer who wants
  an element backdrop renders a `div` as the first child of Popup; it is then inside the dialog
  and clicks on it are not light dismiss (section 7).
- **`Form` exists** because `<form method="dialog">` is the platform's "submit closes" and React
  overrides the method of any form with a function `action` (research, "Forms"). One part gives
  both behaviours under one call-site shape, and it is the only way the library can close the
  dialog after a Server Function without wrapping the function (which would lose React's
  progressive enhancement, section 8).
- **`Close` has an `action`** because "run this, then close" without a form (a Delete
  confirmation) is the single most common dialog interaction, and the library's idiom for it is
  an action prop with `data-pending`.
- **`Title` and `Description`** are plain elements with ids; the Popup wires `aria-labelledby`
  and `aria-describedby` to them whether or not they are mounted (dangling references are
  skipped by the accessible-name computation, so a Popup with `aria-label` and no Title is still
  named correctly; a Popup with neither warns in development, section 9).

Element constraints for `render`: `Popup` must render a `<dialog>`; `Trigger` and `Close` must
render a `<button>` for the command path (a non-button `render` works in library mode through
the click handler, and never in JS-free mode); `Form` must render a `<form>`. The library warns
in development when the mounted `tagName` is wrong.

---

## 2. The two modes

The tension is the one Accordion resolved: the platform owns `<dialog open>` and performs every
close itself, while the library wants the open to be a transition with optimistic feedback and
committed content. One anatomy, two modes, chosen by the Root's props (research, Option C):

| | JS-free mode | Library mode |
| --- | --- | --- |
| Selected when | Root has none of `open`, `defaultOpen`, `openChangeAction`, `onOpenChange` | Root has any of them |
| Open | Browser: `command="show-modal"` | Library: Trigger click intercepted, dispatch inside the Root's transition, `showModal()` in a layout effect of the commit that mounts the content |
| Close by a part (Close, Form, foreign close command, controlled `open={false}`) | Browser | Library: click / submit / command intercepted, dispatch inside the Root's transition, `close(returnValue)` in a layout effect of the commit that ends it (2.3) |
| Dismissal (Escape, back, AT dismiss, light dismiss) | Browser | Browser; a fact: committed `false` urgently and `onOpenChange(false)` called from the `close` event (2.7) |
| Content | Always mounted | Rendered from committed `open`; unmounted while closed unless `keepMounted` |
| `data-open`, `data-pending` on Trigger | never emitted (use `:open` on the dialog) | emitted |
| `openChangeAction` | n/a | requests only: awaited for `true` and for a part-initiated `false` |
| `onOpenChange` | n/a | facts only: called synchronously for a dismissal, not awaited |
| Works before hydration | yes | the native open happens; the library reconciles on mount (2.4) |
| `transition` (ViewTransition) on Popup | accepted, no effect, dev warning | yes |

Switching modes after mount is unsupported (dev warning), like controlled/uncontrolled.

### 2.1 JS-free mode

```tsx
// app/profile.tsx: a Server Component. No client component of your own, no behaviour JS.
import { Dialog } from "@funstack/ui/dialog";
import { saveProfile } from "./actions"; // "use server"

export function EditProfile({ user }: { user: User }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="btn">Edit profile</Dialog.Trigger>
      <Dialog.Popup className="dialog">
        <Dialog.Title>Edit profile</Dialog.Title>
        <Dialog.Form action={saveProfile}>
          <input name="name" defaultValue={user.name} autoFocus />
          <Dialog.Close>Cancel</Dialog.Close>
          <button type="submit">Save</button>
        </Dialog.Form>
      </Dialog.Popup>
    </Dialog.Root>
  );
}
```

The browser does all of it: the Trigger's `command="show-modal"` opens the dialog in the top
layer with the page inert, focuses the `autofocus` input (the attribute is in the server HTML, so
it works), Escape and the Cancel button's `command="request-close"` close it and return focus to
the Trigger. The form posts to the Server Function with React's progressive enhancement before
hydration and through the fetch path after; once hydrated, the Form's watcher closes the dialog
when the action settles (section 8).

What still runs JS in this mode, after hydration: the Form watcher when `action` is given, the
`Close` action when given, the `lightDismiss` click listener, the non-modal Escape listener, and
development warnings. None of them changes React state.

What this mode cannot do: load content on open (everything is in the HTML), show pending state,
or start closed-by-default non-modal dialogs without JS. Those are library mode.

### 2.2 Library mode: open is library-owned

Any of `open`, `defaultOpen`, `openChangeAction` on Root turns the Dialog into a FUNSTACK state
owner through `useControllableAction<boolean>`.

```tsx
// Uncontrolled: the dialog opens when the action resolves and the content has rendered.
<Dialog.Root defaultOpen={false} openChangeAction={(open) => analytics.track("dialog", open)}>

// Controlled, local state: sync prefix, a Transition update.
<Dialog.Root open={open} openChangeAction={(next) => { setOpen(next); }} onOpenChange={setOpen}>

// Controlled, server-backed: update on success, re-wrapped after the await.
<Dialog.Root
  open={open}
  openChangeAction={async (next, { reason }) => {
    if (next) await prefetchProfile();
    startTransition(() => setOpen(next)); // required after an await
  }}
>
```

How the open is intercepted. A click on `<button commandfor command="show-modal">` runs the
command as the button's activation behaviour, after the `click` event has finished dispatching
and only if it was not cancelled. Enter and Space synthesize the same `click`. So one handler in
`Trigger` covers mouse, touch, keyboard and any `render` element:

```tsx
// inside DialogTrigger (library mode)
onClick={(event) => {
  event.preventDefault();                    // the browser does not run the command
  if (disabled) return;
  if (root.optimistic) return;               // no-op against the optimistic value (conventions 2.3)
  root.dispatch(true, { event: event.nativeEvent, reason: "activate" });
}}
```

and the Root's dispatch is the conventions' shape:

```ts
startOwnTransition(async () => {
  addTransitionType("fsui-dialog");
  addTransitionType("fsui-dialog-open");
  setOptimistic(true);                       // Trigger: data-open, data-pending
  await openChangeAction?.(true, details);
  if (!isControlled && id === latest.current) startTransition(() => setInternal(true));
});
```

The commit that sets committed `open` to `true` renders the Popup's children. If they suspend,
React keeps the dialog closed and the Trigger `data-pending` until the data is ready (the boundary
above is already revealed and the update is a transition). The same commit's layout effect in
Popup calls `showModal()` (or `show()`), and the platform's dialog focusing steps run against
fully rendered content. Verified by the research (`command-intercept` probe): a `showModal()`
called later, after the command was cancelled, still focuses inside the dialog and still returns
focus to the Trigger on close.

A second interception site covers invokers the library did not render: the Popup listens to the
`command` event on the dialog (native listener; React does not synthesize it) and, in library
mode, cancels `show-modal` from any source and dispatches the same way with the `CommandEvent` as
`details.event`. A consumer's own `<button commandfor={id} command="show-modal">` therefore goes
through the library too. (`show-modal` is the only open command; there is no `show`.)

What the user sees while the open is pending:

| Surface | Reads | During a pending open |
| --- | --- | --- |
| `Trigger` `data-open`, `data-pending`, `state.open` | optimistic | present |
| `Popup` `:open`, `:modal`, `open` attribute, visibility | DOM (follows committed) | closed |
| `Popup` children | committed | not rendered (default) or hidden (`keepMounted`) |
| `Root` `state.pending` | transition | true |

### 2.3 Library mode: three kinds of close

The line is "parts versus dismissals", as in Popover 2.3. A close a part asks for is a request;
a dismissal is a fact (2.7, conventions 3.9).

| Close | Owner | What happens | `reason` | `details.event` | `details.returnValue` |
| --- | --- | --- | --- | --- | --- |
| `Dialog.Close` without `action` | library | click cancelled (so the `request-close` command does not run); `requestClose` dispatches `false`; `openChangeAction(false)` awaited; committed `false` commits; apply effect `close(value)` (view transition if `transition` is set) | `"activate"` | the `click` `MouseEvent` | the Close's `value`, `""` without |
| `Dialog.Close` with `action` | library | click cancelled; `action` awaited in the Close's own transition (`data-pending` on the button); then the same dispatch as above | `"activate"` | the `click` `MouseEvent` | the Close's `value` |
| `Dialog.Form` without `action` (`method="dialog"`), or any `method="dialog"` form / `formmethod="dialog"` submitter inside the Popup | library | the `submit` event is cancelled after the consumer's own `onSubmit` ran (so a consumer `preventDefault()` still blocks it, as it blocks the native close); same dispatch | `"activate"` | the `SubmitEvent` | the submitter's `value`, `""` without |
| `Dialog.Form` with a function `action`, after the action's transition settled | library | the watcher calls `requestClose` instead of `close()`; same dispatch (`closeOnSettle` and `closedSinceSubmit` unchanged, 8.1) | `"activate"` | the `SubmitEvent` that started it | the submitter's `value` |
| A foreign invoker with `command="request-close"` / `"close"` | library | the Popup's `command` listener cancels it (as it cancels a foreign `show-modal`, 2.2); same dispatch | `"activate"` | the `CommandEvent` | the invoker's `value`, `""` without |
| Controlled parent sets `open={false}` | library | apply effect `close("")`; the resulting `close` event is an echo, no dispatch and no callback | (none) | | |
| Escape, Android back, AT dismiss; light dismiss (`lightDismiss`'s `requestClose()`, or native `closedby="any"`) | browser | closed at once; `close` event → a **fact**: requests in flight superseded, committed `false` written urgently (uncontrolled), `onOpenChange(false)` called synchronously (conventions 3.9.3) | `"dismiss"` | the `close` `Event` | `dialog.returnValue` (`""`) |
| Script `dialog.close()` / `requestClose()`, `form.submit()` on a `method="dialog"` form (no `submit` event), removal from the document | browser | as a dismissal (removal fires no `close`; nothing is reported) | `"dismiss"` | the `close` `Event` | `dialog.returnValue` |

Why the line is here. The research's objection to a library-owned close was the platform's
**close request**: `cancel` is honoured once per user activation (the anti-abuse rule) and the
`close()` a `method="dialog"` form performs has no `cancel` at all, so the library cannot gate
*those* and must not promise to. But a part's close never reaches that machinery if the library
cancels the step before it: a `click` on the Close part cancels its `request-close` command
exactly as the Trigger's click cancels `show-modal` (and as `Dialog.Close action` already did),
a `submit` event is freely cancelable (it is how every form validates), and a `command` event
is cancelable from any source. Those are the closes the user asks a **part** for, and once the
library owns them the dialog closes when the library says so: the close commit's layout effect
calls `close(returnValue)` inside the view transition React started for that commit, so the old
snapshot carries the dialog's box and content out in Chromium, WebKit and Firefox (where CSS
cannot animate a `<dialog>`'s exit, 10.1), and a controlled parent can veto the close by not
adopting `false` (4.3). The closes the user performs **without a part** (Escape, back, an AT
gesture, a click on the backdrop) stay the browser's: the user expects the dialog to go away
now, the platform restores focus itself, and `cancel` remains the consumer's pass-through hook
for them; they are reported to `onOpenChange`.

The dispatch is the Root's `requestClose(event, reason, returnValue)`, the mirror of
`requestOpen`: a no-op unless `true` is intended (`intended()` = the latest in-flight dispatch's
`next`, else the optimistic value of the last commit, read through a ref written in
`useInsertionEffect` so a Close action's continuation after an `await` sees the current value,
not its click's closure). It records the `returnValue` for the apply effect and
dispatches `false` with `createActionDetails(event, { reason, returnValue })`. The apply effect
(2.5) performs the close once the dispatch has committed and nothing is in flight.

**The fact path.** The Popup listens to the native `close` event (filtered to `event.target
=== dialog`, as every native listener). The library's own `close()` (a settled part-initiated
close, a controlled close, a refused pre-hydration open) is recognised **by its source**: the
apply effect sets the `libraryClose` marker right before calling `close()`, and the `close`
listener consumes it a task later and reports nothing. (Recognising the echo by `!intended()`
would take a re-open that became intended in the task between `close()` and its `close` event
for a dismissal.) Every other `close` event is a fact, whatever is in flight:

1. the `returnValue` a pending part close had recorded is dropped (the dialog closed with the
   browser's value, and the part's will never be applied);
2. the Root adopts the fact (`adoptFact(false)`, conventions 3.9.3 and 3.9.5): every request in
   flight is superseded and, uncontrolled, committed `false` is written urgently;
3. `onOpenChange(false, { reason, event, returnValue: dialog.returnValue })` is called
   synchronously, with the recorded close intent's `reason` and `event` if there is one, else
   `"dismiss"` and the `close` event.

Nothing pends and no view transition starts. **A dismissal while a part's close is in flight
is reported at once** and supersedes that close: the consumer was asked about the part's close,
then told about the dismissal; a later veto of the part's close changes nothing, and nothing is
stored for later.

Close intents survive for the paths the library does not own. The `close` event carries no
source, so the Popup records what caused a browser-owned close just before it happens and the
`close` listener consumes it:

| Cause | Recorded by | `reason` | `details.event` |
| --- | --- | --- | --- |
| JS-free mode: `Dialog.Close` (or any `request-close` / `close` invoker), a `method="dialog"` submit, `Dialog.Close action` / `Dialog.Form action` after the action settled | the Popup's `command` / `submit` listeners; the Close part and the Form's watcher before `close()` | n/a (no Root state; the intent only keeps the listeners' logic identical across modes) | |
| Library mode: a close performed by the apply effect (a settled part-initiated close, a controlled close, a refused pre-hydration open) | the apply effect records `undefined` and sets the `libraryClose` marker before `close()` | no dispatch (an echo, recognised by the marker) | |
| Library mode: Escape, back, AT dismiss, backdrop click (`lightDismiss` or `closedby="any"`), the JS fallbacks, script | nothing | `"dismiss"` | the `close` `Event` |

An intent that does not result in a close is cleared by a single `setTimeout(0)` scheduled when
the intent is recorded, which clears it **only if the dialog is still open** at that point (it
never clears an intent that the `close` listener is about to consume: a real close fires `close`
in the same task sequence before the timer, and `takeCloseIntent()` already emptied it).

**A controlled parent that refuses a dismissal.** The dialog is already closed when
`onOpenChange(false)` is called. If the parent keeps `open={true}`, the Popup's apply effect
sees committed `true` with a closed dialog in the fact's own commit and calls `showModal()`
again: the dialog re-opens, with focus moved back into it (a modal dialog must hold focus). A
non-modal dialog (`modal={false}`) is re-shown with `show()` without moving focus: the Popup
writes no `autofocus` and is `inert` for the duration of the call (unless the consumer set
`inert`), so the dialog focusing steps focus nothing (conventions 3.9.4). It is **not a veto
mechanism**: the user sees the dialog close and come back. The docs say so and recommend
adopting a dismissal's `false` unconditionally (`onOpenChange={setOpen}`); a controlled Root
without `onOpenChange` warns in development.

**A controlled parent that refuses a part-initiated close** (keeps `open={true}` after a Close
click, a Form submit or settle) gets a plain snap-back: nothing was closed, the Trigger's
`data-open` returns, the dialog stays open with its content and focus untouched. That is a real
veto, available because the close was library-owned (Popover 2.3). It is the first honest "keep
the dialog open" the component offers, and it covers "the save failed, keep editing" when the
Form's result is checked in `openChangeAction`. It does **not** cover "ask the user first": an
action must never await user input (conventions 2.3 item 6), so "unsaved changes" confirmation
is still built *inside* the dialog (a nested JS-free confirm Dialog whose Trigger is the
"Discard…" button and whose Close `action` closes the outer dialog, example 12.5), not by
holding the close.

**JS-free mode is unchanged.** Every close is the browser's: the Close part is a native
`request-close` invoker, a `method="dialog"` form closes on submit, `Dialog.Close action` and
`Dialog.Form action` call `dialog.close(value)` directly after their action (there is no Root
state to go through), and the CSS exit of 10.1 is the only exit animation (none in Firefox).
`transition` keeps its dev warning in that mode. The library-mode markup is identical
(`command="request-close"`, `method="dialog"`), so a click on a Close or a submit **before
hydration** still closes the dialog natively; nothing is left to reconcile, because a closed
dialog and committed `false` agree.

### 2.4 Pre-hydration opens and mount reconciliation (library mode)

Library mode renders the same `commandfor` / `command="show-modal"` markup as JS-free mode, so a
click before hydration opens the dialog natively. With the default content mounting, that dialog
is **empty** (the children are not in the server HTML): the user sees the styled dialog box with
focus on the dialog element itself. On mount, a Popup layout effect compares `dialog.open` with
committed `open` and, if the dialog is open and committed is `false`, dispatches
`openChangeAction(true, { event: undefined, reason: "platform" })`. The content mounts into the
already-open dialog when the action settles; if the parent refuses or the action rejects, the
apply effect closes the dialog. Focus is not moved when the content lands (the platform's
focusing steps ran at the native open); Tab reaches the content.

This was chosen over rendering the Trigger without `commandfor` until hydration (a dead button
during the hydration window, and different markup per mode) and over always server-rendering
library-mode content (which is what `keepMounted` is **not**, section 5: a hidden `<Activity>`
emits no HTML). A dialog whose pre-hydration experience matters is written in JS-free mode.

`<dialog>` carries `suppressHydrationWarning` in both modes: a pre-hydration open leaves an
`open` attribute the server did not render, React logs a mismatch and does not patch it (research,
"React 19.3 integration"), and the attribute is browser-owned anyway.

### 2.5 Controlled `open` and the apply effect

In library mode the Popup re-applies committed state to the DOM in a layout effect after every
commit, **only while nothing is in flight** (Root not pending and no dispatch unsettled, the
Accordion rule):

- committed `true`, dialog closed, and no `close` event outstanding (`awaitingClose`): write
  `autofocus` on the `initialFocus` target (section 6) and call `showModal()` or `show()`,
  inside `withCssTransitionCut` when the Popup has `transition` (10.3). For the re-show of a
  refused fact on a non-modal dialog: no `autofocus`, `inert` for the call (conventions 3.9.4);
  the `refusedFact` flag is cleared by any commit with committed `false`.
- committed `false`, dialog open: set the `libraryClose` marker (2.3) and call
  `close(returnValue)`, inside the same cut when `transition` is set, with the part's value, `""` for a controlled close; not
  `requestClose()`: the veto point was `openChangeAction`. Then return focus if the close commit
  unmounted the focused content (6.2).
- after every commit, in flight or not: forget "content had focus" while the dialog is shown
  (content that left while open is not a close), and release a `held` that nothing else will
  release (4.4).

**The re-open race.** A native close (Escape, light dismiss) closes the dialog synchronously, but
the `close` event, and with it the fact, arrives a task later. In that window
`committedOpen` is still `true`, `dialog.open` is already `false` and nothing is in flight, so a
commit landing there (any unrelated re-render) would make the effect call `showModal()` and
re-open a dialog the user just closed. The guard is the `awaitingClose` flag set in the Popup's
**synchronous** `beforetoggle` listener when `newState === "closed"` and cleared in the `close`
listener before the fact is adopted; while it is set the effect does nothing. `beforetoggle` fires
synchronously inside the close steps in every engine and in the jsdom shim. An open's
`beforetoggle` (a foreign `show()` in the same task) does not clear it: HTML queues the `close`
event whatever follows, and the flag is read only while the dialog is closed. The flag and the
`libraryClose` marker belong to the element. When the callback ref attaches a different
`<dialog>` (a remount during a close, such as a change of `transition`), the old element's `close`
event never reaches the Popup. A library close (the marker set) has nothing to report: both are
cleared there. A fact is replayed in a timer task (`setTimeout(0)`; not the `close` event's own
task, so it can run later and an input task can come first): the `close` listener's work on the
old element (its `returnValue`), so `onOpenChange(false, { reason,
returnValue })` is called and committed state follows (a controlled parent that refuses gets the
refused fact's re-open, conventions 3.9.4). `details.event` is the recorded intent's, else
`undefined`: no event fired. Until the replay the wait stays set, so the new element is not shown
first. Nothing is replayed once the Popup has unmounted; a Popup a Suspense boundary hides (its
ref detached, still mounted) still gets the replay, as the fact happened before the hide. Refs attach in the layout phase, children
first, so the attach runs before the Popup's own apply effect: that effect must stay in an
ancestor of the `<dialog>`. The same element attached again (a new merged ref) changes nothing.

This one effect covers: the normal open (committed flipped by the user's dispatch), `defaultOpen`
on mount, a controlled parent opening the dialog programmatically (`setOpen(true)` from a menu,
a route, a timer; no Trigger needed), a controlled parent closing it (`setOpen(false)` after its
own form logic), **a part-initiated close after `openChangeAction(false)` settled** (2.3), the
re-open of a refused dismissal, and the close after a rejected or refused pre-hydration open.
It also returns focus after a close whose commit already unmounted the focused content (6.2) and
releases a `held` that no exit animation is going to release (4.4). The library **never renders
the `open` attribute** (research: removing it by
hand hides a modal dialog without `close` and leaves `:modal` true), not even for non-modal
dialogs; a non-modal `defaultOpen` therefore opens after hydration, not in the server HTML
(open question 3).

### 2.6 Non-modal dialogs (`modal={false}`)

`show()` instead of `showModal()`: no top layer, no backdrop, no inertness, no close watcher
(Escape does nothing natively; the platform's `closedby` default for non-modal is `none`), focus
returns to the opener only if it was inside the dialog. Invoker Commands have no `show` command,
so the Trigger renders no `command` attributes in non-modal mode and attaches a click handler in
**both** modes: in JS-free mode it calls `dialog.show()` directly (browser-owned, no React
state; the Tooltip model), in library mode it dispatches. A non-modal dialog is therefore never
JS-free; the markup is still complete and the content is in the HTML.

A non-modal dialog's part-initiated closes are library-owned exactly as a modal one's (2.3): the
apply effect calls `close(returnValue)` after `show()` as after `showModal()`, and the
`<ViewTransition>` captures a non-top-layer box just the same. One difference matters for focus:
the platform restores focus on `close()` unconditionally for a modal dialog but only when focus
is *inside* a non-modal one, so a non-modal close whose commit unmounted the focused Close part
(default mounting with `transition`) relies on the library's focus return (6.2). The Trigger
remains open-only (it is not a toggle, there being no `toggle` command for dialogs), reachable
or not: its own handler opens nothing while the dialog is open. With `lightDismiss`, though, a
pointer click on it while open is a click outside and dismisses the dialog (#116, section 13);
in JS-free mode the Trigger records `dialog.open` at `pointerdown` and skips `show()` on that
click if it was open, so the outcome is "closed" on every path (a keyboard click has no press
and stays a no-op).

Baseline JS for non-modal dialogs (both modes): a `keydown` listener on the dialog closes it on
Escape with `requestClose()`, leaving the event alone while it belongs to an inner layer (the
target is inside an open nested `<dialog>` or an open `auto` / `hint` popover, or any open
`auto` / `hint` popover inside the dialog would take the close request; section 9), so the APG
expectation holds; with `lightDismiss`, document `pointerdown` and `click` listeners (capture)
close it when both the press and the click land outside the dialog, **the Trigger included**,
as native `closedby="any"` does (#116; the click does not re-open the dialog: in library mode
it arrives while the dialog is still optimistically open, in JS-free mode the Trigger saw it
open at `pointerdown`). With `experimental_closedBy`
the dialog renders `closedby="closerequest"` or `"any"` and both listeners are skipped where
`closedBy` is implemented. Non-modal dialogs never lock scroll (the CSS recipe keys on `:modal`).

Nested dialogs need nothing from the library: an inner `Dialog.Root` inside an outer Popup gets
its own ids and context; modal dialogs stack in the top layer; Escape closes the topmost one and
returns focus to its opener inside the lower one (research, "Nesting"). One cost to know: an
inner Popup with `transition` set mounts its `<ViewTransition>` together with the outer content,
and react-dom starts a document view transition for any boundary that mounts in a transition
commit, whatever `"none"` says (#35): the page cross-fades and the inner open lands about 250 ms
late. Leave `transition` off the inner Popup (no boundary is rendered then, 10.3) unless the
animation is wanted.

### 2.7 Requests and facts: which cause goes where

The rule is conventions 3.9, with `close` in place of `toggle` and `showModal()` / `show()` for
the re-open. `DialogOpenChangeDetails` carries `reason` and `returnValue` on both channels: for
a fact, `returnValue` is `dialog.returnValue` as the browser left it (`""` for Escape).

| Cause | Channel | `next` | `reason` | `returnValue` |
| --- | --- | --- | --- | --- |
| Trigger click; a foreign `show-modal` command (cancelled, routed) | `openChangeAction` | `true` | `"activate"` | `undefined` |
| Found open at hydration (2.4) | `openChangeAction` | `true` | `"platform"` | `undefined` |
| `Dialog.Close`, after its own `action` if it has one | `openChangeAction` | `false` | `"activate"` | the Close's `value` |
| `Dialog.Form` without a function `action`, or any `method="dialog"` submit inside the Popup | `openChangeAction` | `false` | `"activate"` | the submitter's `value` |
| `Dialog.Form` with a function `action`, when it settled (`closeOnSettle`) | `openChangeAction` | `false` | `"activate"` | the submitter's `value` |
| A foreign `request-close` / `close` command (cancelled, routed) | `openChangeAction` | `false` | `"activate"` | the invoker's `value` |
| Escape, Android back, an assistive-technology dismiss (the platform's close request; the JS `keydown` baseline of a non-modal dialog) | **`onOpenChange`** | `false` | `"dismiss"` | `""` |
| Light dismiss: `lightDismiss` (JS baseline or native `closedby="any"`), including a Trigger click on an open non-modal `lightDismiss` dialog | **`onOpenChange`** | `false` | `"dismiss"` | `""` |
| Script `dialog.close(v)` / `requestClose(v)`; `form.submit()` on a `method="dialog"` form; a `submit` whose propagation the consumer stopped | **`onOpenChange`** | `false` | `"dismiss"` | `dialog.returnValue` |
| Controlled prop change; re-open of a refused fact; removal from the document (no `close` event) | none | | | |

`cancel` is the consumer's pass-through hook for the platform's close request, with the
platform's once-per-activation rule.

Dialog-specific:

- The library's own close is recognised by its source (`libraryClose`, set in the apply effect).
- **A dismissal while a part's close is in flight is reported at once** and supersedes that
  close; a later veto of the part's close changes nothing (a controlled parent already adopted
  the fact). Nothing is stored. The pending part's `returnValue` is dropped when the browser
  closes first.
- `Dialog.Form` (`closeOnSettle`): a dismissal while the form action runs is a fact, and the
  settle then finds the dialog closed.
- A refused fact: a modal dialog re-opens with `showModal()` and initial focus (the dialog
  focusing steps); a non-modal dialog re-opens with `show()` and does not move focus
  (conventions 3.9.4).

---

## 3. Props and types

Shared types come from `packages/ui/src/internal/types.ts`; the `transition` prop is typed with
React's own `ViewTransitionClass` (the type of `<ViewTransition default>`, imported from
`react`), as on every animatable part (conventions 5.1).

### 3.1 `Dialog.Root`

```ts
// `ChangeReason` is the shared public type (conventions 2.2): "activate" | "platform" | "dismiss".
export interface DialogOpenChangeDetails extends ActionDetails {
  /**
   * "activate": the user acted on a part: Trigger (open), Close or Form submit (close).
   * "dismiss": the user closed the dialog without a part: Escape, Android back, an assistive-
   * technology dismiss gesture, or a click outside (`lightDismiss` / `closedby="any"`).
   * "platform": the dialog was found open on mount (opened before hydration); `event` is undefined.
   */
  readonly reason: ChangeReason;
  /**
   * On close: `dialog.returnValue`: the `value` of the Close button or the form submitter that
   * closed it, `""` for a dismiss. On open: `undefined`.
   */
  readonly returnValue: string | undefined;
}

export interface DialogRootState {
  /** Optimistic open state. Content rendered from it must not suspend. */
  readonly open: boolean;
  /** An `openChangeAction` dispatched through this Dialog is in flight (library mode only). */
  readonly pending: boolean;
  readonly modal: boolean;
}

export interface DialogRootProps {
  /** Controlled open state. `undefined` means uncontrolled (and, with the other two absent, JS-free mode). */
  open?: boolean;
  /**
   * Initial open state in uncontrolled library mode. `true` renders the content and the Trigger's
   * open state into the server HTML; a modal dialog is shown after hydration (`showModal()`
   * cannot be server-rendered).
   */
  defaultOpen?: boolean;
  /**
   * Requests only. Awaited for `true` (the dialog opens when it resolves and the content has
   * rendered) and for a `false` the user asked a part for (`Dialog.Close`, a `Dialog.Form`
   * submit or settled action, a foreign close command: the dialog closes with
   * `details.returnValue` when it resolves, with a view transition if `transition` is set; a
   * controlled parent that keeps `open` vetoes it). Never called for a dismissal. May be a
   * Server Function. Rejections reach the nearest Error Boundary above Root.
   *
   * A `setState` placed after your own `await` is not a Transition update; wrap it in
   * `startTransition` (React limitation).
   */
  openChangeAction?: ChangeAction<boolean, DialogOpenChangeDetails>;
  /**
   * Facts only: the dialog was closed without the library performing the close (Escape,
   * Android back, a click outside, script). Called synchronously with `false`, outside any
   * Transition, not awaited; `details.returnValue` is the browser's (`""` for Escape). A
   * returned promise's rejection and a throw go to `reportError`. A controlled Root adopts it
   * directly (`onOpenChange={setOpen}`, never wrapped in `startTransition`); a parent that
   * keeps `open` gets the dialog re-opened, which is not a veto.
   */
  onOpenChange?: UrgentChangeHandler<boolean, DialogOpenChangeDetails>;
  /** `showModal()` (top layer, backdrop, inert page, Escape) or `show()`. Default `true`. */
  modal?: boolean;
  children?: StateValue<ReactNode, DialogRootState>;
}
```

No `ref`, `className`, `style` (no DOM). No `disabled` on Root: a dialog is not disabled, its
Trigger is. `state.open` is `false` in JS-free mode for want of a better value; the real state is
`:open` on the dialog (the same `undefined`-vs-`false` question Accordion answered with
`undefined`; here `open` is a plain boolean because Root's `children` function is the only reader
and a boolean is what every consumer will branch on; see open question 4).

### 3.2 `Dialog.Trigger`

```ts
export interface DialogTriggerState {
  /** Optimistic open state (library mode); `false` in JS-free mode. */
  readonly open: boolean;
  /**
   * The Root's transition is pending: an open or a part-initiated close in flight (section 4.2).
   */
  readonly pending: boolean;
  readonly disabled: boolean;
}

export interface DialogTriggerProps
  extends Omit<ComponentPropsWithRef<"button">, "onClick" | "className" | "style" | "children"> {
  /** Native `disabled`: a disabled button is not a valid invoker and never dispatches. */
  disabled?: boolean;
  className?: StateValue<string | undefined, DialogTriggerState>;
  style?: StateValue<CSSProperties | undefined, DialogTriggerState>;
  children?: StateValue<ReactNode, DialogTriggerState>;
  /** Should render a `<button>`; another element works only in library mode (click handler). */
  render?: RenderProp<ComponentPropsWithRef<"button">, DialogTriggerState>;
}
```

Owned keys: `type` (`"button"`, only when the rendered element is a `<button>`), `commandfor`,
`command` (only on a `<button>` or a component render: another element is no invoker, #115),
`disabled`, `data-open`, `data-pending`, `data-disabled`, `onPointerDown` (non-modal JS-free
mode, #116), and `onClick` **only when installed**
(library mode, or non-modal JS-free mode), the Accordion rule: in modal JS-free mode the Trigger
installs no handler, owns no `onClick`, and a `render` element's own `onClick` passes through.
`onClick` is still omitted from the props type because the library installs it in the other
modes (prop form, as Accordion's Trigger; the handler is not feature-detected away, so the
Tooltip `addEventListener` route buys nothing here). Native `disabled` is used, not `aria-disabled`: the APG dialog pattern
has no focusable-disabled requirement for the opener, and a natively disabled button is already
not an invoker, so the JS-free mode gets `disabled` for free. `disabled` is owned (conventions
1.2): a `render` element can neither re-enable a disabled Trigger (in JS-free mode the browser
would run its command) nor disable an enabled one. Conventions 3.6 ("never disabled while
pending") still holds: the library never sets `disabled` itself.

### 3.3 `Dialog.Popup`

```ts
export interface DialogPopupState {
  /** Committed open state (library mode); `false` in JS-free mode. Read `:open` for the DOM truth. */
  readonly open: boolean;
  readonly modal: boolean;
}

export interface DialogPopupProps
  extends Omit<
    ComponentPropsWithRef<"dialog">,
    "id" | "open" | "closedby" | "onToggle" | "onBeforeToggle" | "className" | "style" | "children"
  > {
  /**
   * Library mode: what happens to the children while the dialog is closed.
   * - `false` (default): not rendered. Mounting them is part of the opening transition, so
   *   content that suspends holds the open until it is ready. Unmount waits for the dialog's
   *   exit animations.
   * - `true`: rendered inside `<Activity mode="hidden">`: DOM and state preserved, effects
   *   stopped, pre-rendered at low priority. Not in the server HTML.
   * Ignored in JS-free mode (always mounted).
   */
  keepMounted?: boolean;
  /**
   * Element to focus when the dialog opens: a ref, or a selector resolved inside the dialog.
   * The library writes `autofocus` on it right before `showModal()` / `show()` and the platform
   * focuses it. Default: the platform's choice (first focusable descendant; the dialog itself if
   * none). Use `tabIndex={-1}` on a heading or wrapper for long or destructive dialogs (APG).
   */
  initialFocus?: RefObject<HTMLElement | null> | string;
  /**
   * Close on a click outside the dialog (on the backdrop for modal dialogs). Default `false`.
   * Baseline: JS `pointerdown` + `click` listeners, which close only when both the press and the
   * click land outside (a drag that starts inside, such as selecting text, never closes); with
   * `experimental_closedBy`, native `closedby="any"`, which behaves the same.
   */
  lightDismiss?: boolean;
  /**
   * Experimental (Chrome 134+, Firefox 141+; Safari 27.0 ignores it, Technology Preview only).
   * Renders `closedby` (`"any"` when `lightDismiss`, else `"closerequest"`) and skips the JS
   * dismiss listeners where `HTMLDialogElement.prototype.closedBy` exists. Elsewhere the JS
   * baseline stays active. Default `false`.
   */
  experimental_closedBy?: boolean;
  /**
   * Library mode only. Forwarded to the `<ViewTransition default>` around the dialog. Animates
   * the opening commit, content changes while open, and every library-driven close (a Close
   * part, a Form submit or settled action, a foreign close command, a controlled
   * `open={false}`), in all engines; dismissals (Escape, a click outside) are the browser's and
   * animate with CSS only. Ignored (dev warning) in JS-free mode.
   *
   * Static: without `transition` the part renders no `<ViewTransition>`; changing it between
   * `undefined` and a value remounts the element. Any value, `"none"` included, makes a mount or
   * `<Activity>` reveal of this part inside a transition start a document view transition: the
   * page cross-fades for about 250 ms and the next transition commit waits for it (issue #35,
   * section 10.3).
   */
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, DialogPopupState>;
  style?: StateValue<CSSProperties | undefined, DialogPopupState>;
  children?: StateValue<ReactNode, DialogPopupState>;
  /** Must render a `<dialog>`. */
  render?: RenderProp<ComponentPropsWithRef<"dialog">, DialogPopupState>;
}
```

Owned keys: `id`, `open` (never rendered; owned so a `render` element cannot add it),
`closedby`, `aria-labelledby` and `aria-describedby` (token-merged), `data-modal`,
`suppressHydrationWarning`. `onToggle` / `onBeforeToggle` are omitted because they do not fire
on a hydrated `<dialog>` (react/react#37261) and a consumer relying on them would be misled;
`onCancel` and `onClose` are typed, work, and pass through (the library's own `close` and
`cancel` listeners are native, section 14). `role` passes through: `role="alertdialog"` is a
consumer choice that keeps all native behaviour; a confirmation is better written as an
`AlertDialog` (`alert-dialog.md`), which adds the focus on the Cancel and removes the props an
alert dialog must not have. `tabIndex` passes through for the rare
"focus the dialog itself" case.

### 3.4 `Dialog.Close`

```ts
export interface DialogCloseState {
  /** The `action` is in flight. */
  readonly pending: boolean;
  readonly disabled: boolean;
}

export interface DialogCloseProps
  extends Omit<
    ComponentPropsWithRef<"button">,
    "onClick" | "value" | "className" | "style" | "children"
  > {
  /**
   * Runs inside this part's own transition (`data-pending` on the button), then closes the
   * dialog with `value` as `returnValue`: in library mode through the Root
   * (`openChangeAction(false)` awaited, view transition if set), in JS-free mode with
   * `close(value)`. A rejection reaches the nearest Error Boundary above the Close part and
   * leaves the dialog open. If the dialog was dismissed and opened again while the action ran,
   * the close is dropped: it belonged to the earlier open. Without `action` in JS-free mode the
   * button is a native `command="request-close"` invoker.
   */
  action?: Action<[details: DialogCloseDetails]>;
  /**
   * What a click does while this part's `action` is pending. `"ignore"`: nothing (the click is
   * cancelled, `aria-disabled="true"` meanwhile). `"run"`: the action runs again; the dialog
   * still closes once. No effect without `action`. Conventions 2.5.1 (#146).
   * Default `"ignore"`.
   */
  whilePending?: WhilePending;
  /** Becomes `dialog.returnValue` (and `details.returnValue` of the close request). */
  value?: string;
  /** Native `disabled`; owned, so a `render` element cannot re-enable the button. */
  disabled?: boolean;
  className?: StateValue<string | undefined, DialogCloseState>;
  style?: StateValue<CSSProperties | undefined, DialogCloseState>;
  children?: StateValue<ReactNode, DialogCloseState>;
  render?: RenderProp<ComponentPropsWithRef<"button">, DialogCloseState>;
}

export interface DialogCloseDetails extends ActionDetails {
  /** The `value` the dialog closes with (`dialog.returnValue`); `""` without `value`. */
  readonly returnValue: string;
}
```

Owned keys: `type`, `commandfor`, `command`, `value`, `disabled`, `onClick` (library mode, or
with `action`), `data-pending`, `data-disabled` (`disabled` is owned on every part that takes
the prop, conventions 1.2). In library mode the click is always `preventDefault()`ed (which
cancels the `request-close` command) and the close goes through the Root (2.3): without
`action`, `requestClose(event, "activate", value ?? "")` at once; with `action`, the part runs
the action through the shared `useActionTrigger` (conventions 3.4), its own transition, and
`requestClose` in its continuation: `run(() => action(details), () => requestClose(...))`. The
markup is the same in both modes, so a pre-hydration click still closes natively. In JS-free
mode without `action` the browser runs the command; with `action` the part runs it and then
calls `dialog.close(value)` directly (a browser-owned close; there is no Root state). A
non-button `render` works in library mode (click handler) and never in JS-free mode without
`action` (dev warning), the Trigger's rule.

**Pending, in order.** The Close button shows `data-pending` from the click until the close
commits: its own action, then `openChangeAction(false)` (React entangles the Root's transition
with the Close's pending async action, so the Close's `isPending` clears in the same commit that
closes the dialog). The Trigger (and Root's `state.pending`) shows `data-pending` from the
Root's dispatch until that commit, as for every Root dispatch (4.2). Dim the dialog with
`dialog:has([data-pending])` for the Close's part; the Popup itself never carries
`data-pending`.

**`whilePending`** (conventions 2.5.1). `Dialog.Close` is a part whose activation the library
owns (it closes the dialog with no user code), so the default is `"ignore"`, also for a Close
that is given an `action` (mixed ownership: the consumer's function, then the library's close):
a repeated click, Enter or Space while the Close's own action is pending is ignored (the click
is `preventDefault()`ed) and the button renders `aria-disabled="true"` for as long as it shows
`data-pending`, which spans the action and the close commit (not while natively disabled, conventions 1.2). Without `action` the prop has no
effect: a repeated click finds `false` already intended and does nothing. With
`whilePending="run"` every click runs the action again in the part's transition: `data-pending`
until every run has settled, **no** `aria-disabled` from pending. The close is requested once,
when the last run in flight settles, and only if the latest run resolved, in library and
JS-free mode alike, and
still dropped for a stale open as below. So a rejection leaves the dialog open in both modes. An
older run's rejection goes to `reportError`, the latest one's to the boundary above the Close
(conventions 2.4, #145). Without `action` the prop has no effect: nothing of
the part's own is pending, and a repeated click finds the close already intended.

**Rejection and veto.** The action rejects: nothing was dispatched, the dialog stays open, the
error reaches the boundary nearest the Close. `openChangeAction(false)` rejects: the dialog is
still open (nothing was closed); the error reaches the boundary above Root, which unmounts the
component and thereby removes (closes) the dialog; caught inside, it resolves, commits `false`
and closes. A controlled parent that keeps `open={true}`: snap-back, the dialog stays open (a
real veto, 2.3).

**A stale close is dropped** (the Popover 3.4 rule). If the user dismissed the dialog (Escape)
and opened it again while the action ran, the continuation would close the new open. The
Root keeps an **open generation**, a counter bumped by every open it sees (its own open dispatch
and the Popup's native `beforetoggle` to open, which fires synchronously inside `showModal()` /
`show()`, so foreign, pre-hydration and JS-free opens count too, as in Popover; **not**
`toggle`, which is queued and could arrive after a pending Close settled, so the stale close ran
on the new open, a flaky test fixed in 03ab818; the library's own `showModal()` is counted
twice, once at the dispatch and once at its `beforetoggle`, which is harmless because only
"changed since the click" is ever asked), and the Close passes it as
`useActionTrigger(openGeneration)`, which skips the continuation when the counter changed after
the click. The action's result stands; only the close is dropped. `Dialog.Form` guards the same
case with `closedSinceSubmit` (8.1). Added at the Menu review (M2): until then `Dialog.Close`
was the one part without the guard.

With the library-owned close (2.3) the guard matters in **both** modes, and the two guards it
sits behind are worth telling apart. In library mode a re-open dispatched while the Close's
action runs is entangled with it and commits when the action settles; the continuation then
runs with `intended()` back to `true` (the re-open is the latest intent), so without the
generation guard `requestClose` would dispatch a second `false` against the open the user just
asked for. The guard drops it. In JS-free mode the browser re-opens the dialog at once and the
continuation's `dialog.close(value)` would close it; the guard drops that too (a jsdom row
fails without it). A dismissal **without** a re-open needs no guard: `intended()` is
`false` after the fact, so `requestClose` is a no-op, and in JS-free mode `dialog.open`
is `false`, so `close()` is.

### 3.5 `Dialog.Form`

```ts
export interface DialogFormProps
  extends Omit<ComponentPropsWithRef<"form">, "method" | "action" | "className" | "style" | "children"> {
  /**
   * React form action (`(formData) => unknown`, may be a Server Function). Passed to the form
   * unwrapped so React's progressive enhancement is kept; the dialog closes with the submitter's
   * `value` as `returnValue` once the action's transition settles (see `closeOnSettle`): in
   * library mode through the Root (`openChangeAction(false)` awaited, view transition if set),
   * in JS-free mode with `close(value)`. A rejection leaves the dialog open. Without `action`
   * the form renders `method="dialog"`: submitting closes the dialog, natively in JS-free mode
   * and through the Root in library mode (a `preventDefault()` in your own `onSubmit` blocks
   * both; `stopPropagation()` there leaves the close to the browser, reported as a dismissal).
   * A string `action` (a URL) is a plain navigating form.
   */
  action?: string | ((formData: FormData) => unknown);
  /**
   * With a function `action`: close the dialog once the action's transition settles without
   * throwing and, when this form is rendered as a `Form.Root`
   * (`render={<Form.Root errors={state.errors} />}`), with no field error: a settle whose
   * `errors` has a non-empty entry (hidden stale ones included, the `autoReset` rule) keeps
   * the dialog open and the Form focuses the first errored field. Default `true`.
   *
   * Without a `Form.Root` the library never sees a result, so any settle that does not throw
   * counts, including a `useActionState` result that reports errors: render the form as a
   * `Form.Root` to route them, throw to keep the dialog open, or set `closeOnSettle={false}`
   * and close it yourself (a `Dialog.Close`, a submit button in a separate `method="dialog"`
   * form, or a controlled `open`). A `formMethod="dialog"` submitter inside this form cannot
   * close it: React prevents every submit of a form with a function `action` and runs the
   * action again.
   *
   * The dialog is not closed either when it was closed (Escape, a Close part) while the action
   * ran, also if the user re-opened it meanwhile (section 8.1).
   */
  closeOnSettle?: boolean;
  /**
   * Only with a string `action` (a navigating form, for example `"post"`). Owned otherwise:
   * `"dialog"` without `action`, React's own with a function `action`.
   */
  method?: ComponentPropsWithRef<"form">["method"];
  className?: StateValue<string | undefined, DialogFormState>;
  style?: StateValue<CSSProperties | undefined, DialogFormState>;
  children?: StateValue<ReactNode, DialogFormState>;
  render?: RenderProp<ComponentPropsWithRef<"form">, DialogFormState>;
}

export interface DialogFormState {
  /** `useFormStatus().pending` of this form, exposed for `className` / `children` functions. */
  readonly pending: boolean;
}
```

Owned keys: `action`, and `method` except with a string `action`: `"dialog"` without `action`,
React's own (nothing rendered) with a function `action`. A string `action` (a URL) renders a
plain navigating form that does not close the dialog (the page navigates); only then does the
`method` prop apply (`method="post"` with a URL action is the consumer's form). The base
`method` is omitted and re-declared so that its doc comment states this rule; a `render`
element's `method` is overridden in the owned cases. `DialogFormState.pending`
is the one place the library reads `useFormStatus`: it is this form's own status, not folded into
any control's `pending`, so conventions 2.7 is respected. `data-pending` is **not** emitted on
the form element (the status is read by a child component, which cannot write the parent's
attributes without a second render); submit buttons read `useFormStatus` as React intends.

### 3.6 `Dialog.Title`, `Dialog.Description`

```ts
export interface DialogTitleProps
  extends Omit<ComponentPropsWithRef<"h2">, "id" | "className" | "style" | "children"> {
  className?: StateValue<string | undefined, DialogTitleState>;
  style?: StateValue<CSSProperties | undefined, DialogTitleState>;
  children?: StateValue<ReactNode, DialogTitleState>;
  render?: RenderProp<ComponentPropsWithRef<"h2">, DialogTitleState>;
}
export type DialogTitleState = DialogPopupState;

export interface DialogDescriptionProps
  extends Omit<ComponentPropsWithRef<"p">, "id" | "className" | "style" | "children"> { /* same shape */ }
export type DialogDescriptionState = DialogPopupState;
```

Owned key: `id`. Both read the Popup's state through context so a `children` function can, say,
show a different title while open (rare; the type is shared rather than invented).

### 3.7 Namespace

```ts
export const Dialog = {
  Root: DialogRoot,
  Trigger: DialogTrigger,
  Popup: DialogPopup,
  Close: DialogClose,
  Form: DialogForm,
  Title: DialogTitle,
  Description: DialogDescription,
} as const;
```

---

## 4. State model

| State | Owner | Library-owned or browser-owned | Where it shows |
| --- | --- | --- | --- |
| `open` | Root (`useControllableAction<boolean>`) | **Library-owned for opening and for part-initiated closing, browser-owned for dismissals** in library mode (2.3); fully browser-owned in JS-free mode | optimistic: Trigger `data-open`, `state.open` on Root/Trigger; committed: Popup children mounting, `state.open` on Popup; DOM: `:open`, `:modal` |
| `pending` | Root `useTransition` | library | Trigger `data-pending` (whenever the Root is pending, 4.2), Root `state.pending` |
| Close `pending` | Close part `useTransition` | library | `data-pending` on that Close button |
| Form `pending` | React's form transition | React | `DialogFormState.pending`, `useFormStatus` in children |
| `held` (was `exiting`) | Popup local state (`useExitAnimation`, shared with Popover) | library (derived from committed and the DOM's running animations) | keeps children mounted until the close has finished animating; not exposed |
| pending `returnValue` | Root ref | library | the value the apply effect passes to `close()` for a part-initiated close; cleared when optimistic returns to `true` |
| `modal`, `lightDismiss`, `keepMounted`, `initialFocus` | props | n/a | `data-modal` on Popup |
| focus position, `returnValue`, close watcher state | browser | browser | `document.activeElement`, `dialog.returnValue` |

### 4.1 The hook and the reducer

`useControllableAction<boolean, DialogOpenChangeDetails>` with the default replace reducer;
`transitionTypes` returns `fsui-dialog` plus `fsui-dialog-open` or `fsui-dialog-close` from
`next`. `next` is computed against the optimistic value: a Trigger click while the dialog is
optimistically open is a no-op. A fact goes through `adoptFact(false)` (conventions 3.4): it
supersedes every request in flight, is not a dispatch and adds no transition type. The hook's `latestInFlight()` is what the Popup's apply effect and
the `close` listener consult, exactly as Accordion's `dispatchFromDom` does.

### 4.2 Where `data-pending` lands

Root has no element, so conventions 4.3's "owner" row has nowhere to land; the Trigger is the
initiating trigger for opens, and every Root dispatch is an open or a part-initiated close,
both of which belong to the Trigger. Rule: **`trigger.pending = root.pending`**,
unconditionally (the Trigger's `state.pending` and Root's `children(state).pending` agree).
Consequences: open pending → Trigger pending; part-initiated close pending
(`openChangeAction(false)` awaited while the dialog is still open) → Trigger pending, and the
Close button that asked for it pending too (3.4). A dismissal never pends; a request it
superseded keeps the Trigger pending (without `data-open`) until it settles (conventions
3.9.5).
The Popup never carries `data-pending` (it is a content region, conventions 4.3).

### 4.3 Error, rollback, veto

- **`openChangeAction(true)` rejects.** The error reaches the Error Boundary nearest the Root;
  optimistic reverts; uncontrolled committed state was never written; the dialog never opened,
  nothing in the DOM to roll back. Caught-inside variant: resolves, commits, opens.
- **Part-initiated `openChangeAction(false)` rejects.** The dialog is still open (nothing was
  closed). The error reaches the boundary above Root, which unmounts the component, and the
  removal closes the dialog (the platform removes a disconnected dialog from the top layer
  without a `close` event). Caught inside: resolves, commits `false`, closes.
- **`onOpenChange` throws, or its promise rejects.** `reportError`; the dialog is closed and
  the UI is untouched. A request a fact superseded that later rejects goes to `reportError` too.
- **Controlled veto of an open** (parent does not adopt `true`): optimistic shows the Trigger
  open while pending, then snaps back; the dialog never opened.
- **Controlled veto of a part-initiated close**: snap-back; the dialog stays open (a real veto,
  2.3). **Controlled refusal of a dismissal**: re-opens at once (2.3); not a veto.

### 4.4 Exit animations and the deferred unmount

(Rewritten for #46 to Popover 4.4's shape; the shared `useExitAnimation` hook in
`src/internal/overlay/use-exit-animation.ts` replaces the Popup's local `exiting` state.) With the default
`keepMounted={false}`, committed `false` unmounts the children, and two kinds of close must not
keep them for the wrong reason:

- **A dismissal** (browser close) runs the consumer's CSS exit (Chromium and Safari; Firefox
  flips `display` at once). The `close` listener reads the running animations after flushing
  style (`exitAnimations(dialog)`: `getAnimations({ subtree: true })`, which lists the
  `::backdrop` transition in Chromium, verified by the reviewer, filtered to animations that end,
  so a decorative loop cannot hold the content forever, and excluding those already running at
  the synchronous `beforetoggle(closed)`, so a progress bar inside is not the exit; #64) and, if
  any remain, sets `held` (an
  urgent, library-internal write) **before** adopting the fact, so the urgent commit that
  sets committed `false` keeps the children; when the animations settle, `held` is cleared as a
  **normal update, never in a transition**: the dialog is already `display: none`, nothing
  visible changes, and only transition commits start a document view transition. In Firefox
  `getAnimations()` is empty and the children unmount in the fact's commit.
- **A library-driven close** (2.3) commits `false` first and closes in the layout effect, so the
  children would be gone before the fade starts. Two cases:
  - **`transition` set**: the children unmount in the close commit and `close(returnValue)` runs
    in its layout effect, inside the view transition React started for that commit. The old
    snapshot was captured before the mutation, so it holds the dialog's box with its content;
    `::view-transition-old(…)` is the exit. No `held`: keeping the children would make the later
    unmount a second, invisible view transition that holds every transition for 250 ms (#35).
  - **`transition` absent**: the Popup holds the children for the close. During render, when
    committed flips from `true` to `false` (the "previous value in state" pattern), it sets
    `held`, so `visible = committed || held` stays `true` through the close commit; the apply
    effect closes the dialog; the `close` listener (a task later, style flushed) reads the
    animations; with none (Firefox, or no CSS exit) `held` is cleared at once (a normal update;
    the extra commit is invisible), otherwise when they settle. Before this amendment a
    controlled close had this gap: the content unmounted in the close commit, the CSS fade
    showed an empty box, and the `close` listener's `exiting` then **re-mounted** the content
    (fresh state) into the fading dialog.

**The release rule in the apply effect.** The render-time derivation (committed `true → false`,
no `transition`) also fires for a dismissal's commit, which lands after the
`close` listener already ran its animation read; nothing later would clear that hold. So the
apply effect (2.5), after every commit, releases `held` when all of: `held` is set, committed is
`false`, no `holdUntil` wait is running, no `close` event is pending (`awaitingClose`) and the
dialog is not open. Cost: one extra invisible commit per dismissal without an exit animation.
The `close` listener tells the two closes apart **by source**: when the event is the echo of
the library's own `close()` (the `libraryClose` marker the apply effect set, 2.3) and
`transition` is set, it skips the animation read; otherwise it reads and holds or releases. A
dismissal that lands during an in-flight part close is a browser close and is read and held like
any other (the first implementation keyed the echo on `!intended()` and skipped the hold there,
so a settle during the fade unmounted the content inside the fading box; review L3).

`keepMounted` uses the same flag: `<Activity mode={committed || held ? "visible" : "hidden"}>`
(a hidden `<Activity>` is `display: none` and would blank the fading box like an unmount). The
`held` → `false` update carries no `fsui-*` types and starts no view transition.

---

## 5. Content mounting and Suspense

### 5.1 Strategies (library mode)

| | `keepMounted={false}` (default) | `keepMounted` |
| --- | --- | --- |
| Closed dialog's children | Not rendered (after the exit animation) | Rendered inside `<Activity mode="hidden">` (hidden only after the exit animation; 4.4) |
| React state of children | Lost on close | Preserved (a half-filled form survives Escape) |
| Effects while closed | None | Stopped |
| `use()` data fetch | Starts on open, **inside the opening transition**: the dialog opens when the data is ready | Starts at page mount, at low priority |
| Server HTML | Empty dialog | Empty dialog (hidden Activity emits nothing) |
| Pre-hydration open | Empty until reconciled (2.4) | Empty until hydrated, then filled without a dispatch |
| `<ViewTransition>` on open | `enter` for the children (inside the same commit as `showModal()`) | `enter` via the Activity mode change, which happens inside the Root's transition |

`"until-found"` is not accepted: a closed dialog is `display: none` and find-in-page cannot
reach it, so the value has no meaning here (conventions 3.7 is written as a shared shape; the
Dialog's type narrows it to `boolean`, feedback item 4).

JS-free mode: always mounted. The whole point of that mode is that the server HTML is complete;
`keepMounted` is accepted and ignored (dev warning when `false` is passed explicitly, since it
cannot be honoured).

### 5.2 Why unmounting is the default

The same reasons as Tabs, plus one specific to dialogs: a page can hold many dialogs (every row's
"edit" dialog), and mounting all of their content at page load is the Option A cost the research
rejected. Unmounting makes "open the edit dialog" request its data when, and only when, the user
asks, inside the transition, with the Trigger pending meanwhile. That is principle 1.

### 5.3 The two Suspense shapes

```tsx
// Wait, then open: the Trigger spins; the dialog opens with content in place.
<Dialog.Popup>
  <Dialog.Title>Order #{id}</Dialog.Title>
  <OrderDetails id={id} />            {/* use(orderPromise) */}
</Dialog.Popup>

// Open now, show a skeleton: a newly mounted boundary shows its fallback immediately.
<Dialog.Popup>
  <Dialog.Title>Order #{id}</Dialog.Title>
  <Suspense fallback={<OrderSkeleton />}>
    <OrderDetails id={id} />
  </Suspense>
</Dialog.Popup>
```

Both are the consumer's choice (conventions 6). In the second form the opening commit carries the
skeleton, `showModal()` runs, the platform focuses the first focusable element (possibly the
Close button) while the data loads, and the content swaps in a later transition commit, which is
where a `transition` prop on the Popup can animate the swap. Content rendered from a **Trigger's**
`children` function must not suspend (conventions 3.2).

---

## 6. Focus

### 6.1 Initial focus

The platform runs the dialog focusing steps on `showModal()` / `show()`: `autofocus` descendant,
else the first sequentially focusable descendant, else the dialog itself (Chromium still focuses
`tabindex="-1"` elements and ignores `autofocus` on the dialog itself; research, "Focus"). The
library adds one thing, because React's `autoFocus` prop is lost on client-rendered content
(react/react#23301: React drops the attribute and calls `.focus()` at mount, which does nothing
in a closed dialog):

```tsx
const nameRef = useRef<HTMLInputElement>(null);
<Dialog.Popup initialFocus={nameRef}>…<input ref={nameRef} name="name" />…</Dialog.Popup>

// Serialisable form, usable from a Server Component:
<Dialog.Popup initialFocus="[name=name]">
<Dialog.Popup initialFocus="[data-initial-focus]">
```

In the apply effect, right before `showModal()`, the Popup resolves the target (`ref.current`, or
`dialog.querySelector(selector)`), warns in development if it is missing or outside the dialog,
and calls `setAttribute("autofocus", "")` on it. The platform does the rest, in the platform's
order, in every engine (research, "Practical rules"). The attribute is removed again after the
open so a later `initialFocus` change cannot leave two candidates. The library never calls
`.focus()` on open.

`initialFocus` also works in **JS-free mode**: there is no apply effect, so the Popup writes
`autofocus` on the resolved target in its mount effect and **keeps** it (a native `show-modal`
command may open the dialog any number of times, and the attribute must be there each time).
`autoFocus` on an element works too, in JS-free mode and for `keepMounted` content that was
server-rendered, because the attribute is in the HTML (verified: `reactAutoFocusHydrated`), and
**only then**: React writes `autofocus` into server-rendered HTML, not on client render, so after
a client navigation to a Server Component page the attribute is missing and the dialog focusing
steps pick the first focusable element instead. `initialFocus` is written after mount in JS-free
mode and covers both. The docs recommend `initialFocus` in both modes, with `autoFocus` as the
alternative for markup that is always server-rendered (Popover review L7).

APG guidance, repeated in the docs: for long or destructive dialogs focus a static element
(`<Dialog.Title tabIndex={-1}>` as the `initialFocus` target) so the user hears the title before
landing on "Delete".

### 6.2 Return focus

On close the platform focuses the element that was focused when the dialog opened (for non-modal
dialogs, only if focus was inside). Verified for a `showModal()` deferred past the intercepted
command. The library covers two platform gaps:

1. **The opener is gone.** The `close` listener finds `document.activeElement` still inside the
   closed dialog (the opener was removed while the dialog was open, research "Focus return"): it
   focuses the Trigger element registered with Root if it is connected; if the Trigger is gone
   too, it calls `blur()` on the active element so focus lands on `<body>` rather than staying
   on an element inside a closed, `display: none` dialog (where keyboard input would go nowhere).
2. **The close commit unmounted the focused content** (Popover review H1). A library-driven
   close with `transition` and the default mounting removes the children, the focused Close
   button included, *before* the apply effect's `close()`; focus falls to `<body>`. A modal
   dialog is unaffected: the platform restores its previously focused element on `close()`
   unconditionally. A **non-modal** dialog restores only when focus is inside at the close, so
   it would leave focus on `<body>`. The Popup renders its library-mode content through the
   shared content probe (`useContentFocusProbe` in `src/internal/overlay/content-focus-probe.tsx`, the
   one `usePopoverPopup` uses), whose layout-effect cleanup records that the content
   held focus when it went away; the apply effect, right after `close()`, then applies the
   Popover 6.2 rule: focus is on `<body>` or inside the dialog → focus the Trigger if connected,
   else blur. Cleared whenever the content unmounts while the dialog stays open.

No `returnFocus` prop in v0; a consumer who needs a specific target focuses it in
`openChangeAction(false)`.

### 6.3 Focus trapping

None in the library. `showModal()` makes the rest of the document inert; Tab cycles through the
dialog and the browser chrome, which the APG allows. Non-modal dialogs are not traps by
definition. Nothing outside the dialog subtree is reachable, which is why **no FUNSTACK overlay
ever portals out of a dialog** (research, "Light dismiss and portals"): a Tooltip, Popover or
Menu opened from inside the dialog renders inside its subtree and the top layer stacks it above.

---

## 7. Dismissal

| Close request | Modal, baseline | Modal, `experimental_closedBy` | Non-modal, baseline | Non-modal, `experimental_closedBy` |
| --- | --- | --- | --- | --- |
| Escape, Android back, AT dismiss | platform | platform (`closedby="closerequest"`) | JS `keydown` on the dialog → `requestClose()` | platform where `closedBy` exists, else JS |
| Backdrop / outside click | nothing; with `lightDismiss`: JS `pointerdown` + `click` on the dialog, target is the dialog and both points are outside its border box → `requestClose()` | with `lightDismiss`: platform (`closedby="any"`) | nothing; with `lightDismiss`: document `pointerdown` + `click` (capture), both outside the dialog → `requestClose()`; **the Trigger counts as outside** (#116: native `closedby="any"` has no invoker exemption, so a Trigger click on an open non-modal dialog is a dismissal on every path and engine; it does not re-open: in library mode the click arrives while the dialog is still optimistically open, in JS-free mode the Trigger saw it open at `pointerdown` and skips `show()`) | with `lightDismiss`: platform where `closedBy` exists, else JS |
| Close part, Form submit | platform (`request-close` / `method="dialog"`) | same | same | same |

- **Escape cannot be turned off** in v0. `cancel.preventDefault()` holds once per user
  activation and then the dialog closes anyway (research, "anti-abuse rule"), so a
  `closeOnEscape={false}` prop would be a lie in every engine; `closedby="none"` is honest but
  Chromium/Firefox-only. Deferred until `closedby` is Baseline (open question 2).
- **`lightDismiss` defaults to `false`**, unlike Radix and Base UI. A modal dialog that closes
  on a stray click loses a half-filled form; the APG says nothing about outside clicks; and the
  JS-free mode has no click handler, so a `true` default would make the baseline differ between
  modes. Consumers opt in per dialog.
- The JS light dismiss uses `click`, matching Chromium's native behaviour since 154 (research
  table), **and requires the preceding `pointerdown` to have been outside as well**: a drag that
  starts inside the dialog (selecting text in a field) and releases over the backdrop does not
  close, which is what native `closedby="any"` does. The Popup records the last `pointerdown`
  target (capture) and the `click` handler checks both. It ignores events whose target is a
  descendant of the dialog (an element backdrop the consumer rendered as the first child, a
  popover nested in the dialog), so only the real `::backdrop` dismisses, which is also the
  native rule. A consequence: a **keyboard-synthesised click never dismisses** a non-modal
  dialog (Enter or Space on a button outside it, or `element.click()`), because no
  `pointerdown` preceded it; native `closedby="any"` behaves the same, and a modal dialog's
  `::backdrop` cannot be reached by keyboard at all. Keyboard users dismiss with Escape.
- The JS light dismiss does **not** exempt the Trigger (#116). The platform's dialog light
  dismiss walks the target's ancestors for an open `<dialog>` and nothing else (HTML "nearest
  clicked dialog"; WebKit's `nearestClickedDialog` is the same walk): unlike popovers, there is
  no invoker exemption, and a non-modal dialog's Trigger is not an invoker anyway (no command
  for `show()`). So under native `closedby="any"` a Trigger click on an open non-modal dialog
  is a click outside, and the JS baseline, which exists to behave the same where `closedBy` is
  missing, treats it the same: `(false, "dismiss")`, on every engine, with or without the flag,
  and surviving the flag's graduation. The dialog does not re-open from that click: in library
  mode `close()` queues its `close` event, so the Trigger's handler runs while the dialog is
  still optimistically open and dispatches nothing; in JS-free mode the Trigger records
  `dialog.open` at `pointerdown` and skips `show()` on a click whose press saw it open (the
  dismissal has already closed it by the click, natively at `pointerup` or in the JS capture
  listener). Modal dialogs already behaved this way (a Trigger click lands on
  the `::backdrop`). This is not a 3.5 "single source of the close" case: the Dialog Trigger
  has no library-owned close to protect (it only opens), and dismissals are browser-owned by
  design (decision 2).
- With the flag on, feature detection is `"closedBy" in HTMLDialogElement.prototype` inside the
  effect that would attach the listeners (never during render; conventions 8). Safari 27.0 fails
  the check and keeps the JS. Graduation: when WebKit ships `closedby`, the flag is removed and
  `closedby` is always rendered.

`requestClose()` is used for every JS-initiated user dismissal so a consumer's pass-through
`onCancel` sees it; `close()` is used by the apply effect for every library-owned close (a part's
close after `openChangeAction(false)` settled, a controlled parent's close), whose veto point was
the action, not `cancel`. Every row of the table above is **browser-owned: a fact reported to `onOpenChange` with
`"dismiss"`**, under both the JS baseline and the native `closedby` path, so the experimental
flag never changes a close's ownership; what a part asks for (the third row's Close and Form)
is library-owned in library mode (2.3). Why a dismissal is not made library-owned by cancelling
`cancel` and closing later: the anti-abuse rule honours that veto once per activation (a second
Escape closes anyway, and Chromium skips `cancel` without a recent activation), so the library
would be promising a gate it cannot keep, and it would hold a dismissal the user expects to be
immediate behind an action.

---

## 8. Forms and `returnValue`

### 8.1 `Dialog.Form`

```tsx
// JS-free close: submit closes the dialog with returnValue = submitter.value.
<Dialog.Form>
  <Dialog.Close value="cancel">Cancel</Dialog.Close>
  <button type="submit" value="ok">OK</button>
</Dialog.Form>

// Action, then close. `saveProfile` may be a Server Function.
<Dialog.Form action={saveProfile}>
  <input name="name" />
  <Dialog.Close>Cancel</Dialog.Close>
  <SubmitButton>Save</SubmitButton>   {/* reads useFormStatus().pending */}
</Dialog.Form>
```

Without `action` the Form renders `method="dialog"`. In **JS-free mode** the platform closes the
dialog on submit, fires `submit` then `close`, sets `returnValue` from the submitter, and nothing
runs in the library except the `submit` listener that records the intent (section 2.3). In
**library mode** the same markup is intercepted (2.3): the Popup's `submit` listener, which runs
**after** the consumer's React `onSubmit` (it is attached in the bubble phase to the dialog's
root node, `dialog.getRootNode()`: the document, or the shadow root the dialog lives in, since
`submit` does not cross a shadow boundary; React's container is inside that node, so React's
listener runs first, or is the same node and was registered earlier), leaves a submit the
consumer already `preventDefault()`ed
alone (the form did not submit, so the dialog stays open, exactly as natively), and otherwise
cancels the native submission and calls `requestClose(event, "activate", submitter?.value ??
"")`: `openChangeAction(false)` is awaited and the apply effect closes the dialog with that
`returnValue`, inside the view transition if `transition` is set. Interactive constraint
validation runs before `submit` fires, so an invalid form never reaches the listener and stays
open in both modes. The listener applies to any `method="dialog"` form inside the Popup and to
a submitter with `formmethod="dialog"`, Form part or not, because the platform's close would
have too. A submit the consumer `stopPropagation()`s in React is left alone as well: it never
reaches the listener when React's container sits below the root node, and when React's root
**is** the document (FUNSTACK Static hydrates with `hydrateRoot(document, …)`, this repo's docs
site included) `stopPropagation()` cannot stop a listener on the same node, so the listener also
returns when `event.cancelBubble` is set (review M3). Either way the form closes the dialog
natively and the close is reported as a `"dismiss"` fact, which the docs list as the one way to opt a
form out of the library-owned close. A script `form.submit()` fires no `submit` event and closes
natively (a `"dismiss"` fact).

With `action`, React overrides `method` and calls the action with the `FormData`; the dialog does
**not** close by itself (verified). The Form renders `<form action={action}>` with the action
**unwrapped** (a client closure around a Server Function would lose React's progressive
enhancement: the server HTML would carry a throwing `javascript:` action instead of the real
endpoint and hidden fields) and a child `<FormStatusWatcher>` that reads `useFormStatus()`. A
native `submit` listener on the form records the submitter's `value`. When `pending` goes from
`true` to `false`, the watcher's effect performs the **settle close**: in library mode
`requestClose(submitEvent, "activate", returnValue)` (the Root's transition then shows on the
Trigger, and the dialog closes when `openChangeAction(false)` has settled, with the view
transition if set); in JS-free mode it records the intent and calls `dialog.close(returnValue)`
as before. Because `useFormStatus().pending` covers the action's whole transition, a result
that re-renders suspending content keeps the dialog open until that content has committed,
which is the Suspense-native order. One visible consequence of React's own behaviour: React
resets an uncontrolled form after a successful function action in the action's commit, which
is *before* the close commit, so an exit animation (CSS or view transition) shows the fields
at their defaults while the dialog goes; a form whose fields must keep their values through
the exit uses controlled inputs or `useActionState`, the usual React answer.

**`closeOnSettle`** (default `true`) is whether the settle close happens at all. It exists
because "settled" is not "succeeded": an action wired through `useActionState` that *returns*
validation errors instead of throwing settles its transition normally, and a plain `Dialog.Form`
never sees the result, so with the default the dialog closes with the errors unseen. The answer
for a form with field errors is the **`Form.Root` composition** (#59):
`<Dialog.Form action={dispatch} render={<Form.Root errors={state.errors} />}>`. `Form.Root`
then runs the action, routes the errors to the Fields and resets only on a clean settle
(field-form.md 3), and `Dialog.Form`'s settle close becomes **error-aware**: a child rendered
among the form's children reads the `FormContext` (present exactly when the form is a
`Form.Root`, in either orientation of the composition) and the close is requested only when
`hasAnyError(errors)` is false at the settle commit, the same predicate as `autoReset`, hidden
stale entries included, so "reset" and "close" never disagree; a settle with errors keeps the
dialog open while `Form.Root` focuses the first errored field. Three outcomes: the action throws
(the dialog stays open, the Error Boundary shows the error), returns errors (open, values kept,
first errored field focused, nothing reset), or settles clean (`Form.Root` resets, then the
settle close through the Root with `reason: "activate"` and the submitter's `value`). The reset
runs in the settle effect and the close commits later, so an exit animation shows the fields at
their defaults, as React's own path already does for a plain `Dialog.Form` (below); with the
default content mounting the next open mounts fresh fields anyway, so a consumer whose exit is
visible passes `autoReset={false}` on the `Form.Root` element (keep the default with
`keepMounted`). The composition **needs a function `action`**: without one `Form.Root` owns
`method` and removes the `"dialog"` `Dialog.Form` passed (merge-props' owned-key rule), leaving
a GET-navigating form; the library warns in development.

Without a `Form.Root`, throwing keeps the dialog open (below); otherwise set
`closeOnSettle={false}`, and the Form neither records an intent nor closes anything: the
consumer closes when the returned state says so (a `<Dialog.Close>` next to the errors, a
submit button in a separate `method="dialog"` form, or `setOpen(false)` from the controlled
parent once `state.ok`). A `formMethod="dialog"` submitter *inside* the action form is not an
option: React prevents every submit of a form with a function `action` and runs the action
again, so it neither closes the dialog nor reaches the Popup's listener as a closing submit
(reviewer probe P8; an older version of this text suggested it).

**A close since the submit blocks the settle close.** The Form listens to the dialog's `close`
event and remembers whether the dialog closed after the last `submit`; the settle close is
skipped while that flag is set (and, trivially, while the dialog is not open). The case it
guards is the review's variant of walkthrough 8: the user presses Escape during a slow save,
then re-opens the dialog with the Trigger; the re-open is entangled with the form's action,
so the dialog opens when the save settles, and the watcher's edge arrives at the same time with
the dialog open again. Without the flag the Form would close the dialog the user just
re-opened. The flag is reset by the next `submit`. In every case the action still ran to
completion; `closeOnSettle` and the flag only decide whether the Form closes afterwards.

An action that throws rejects the form's transition and reaches the nearest Error Boundary; the
watcher never sees `false` with a submitted form, so the dialog stays open. A boundary inside
the Popup shows the error inside the dialog; a boundary above the Root replaces the dialog
subtree, which removes the `<dialog>` from the DOM and therefore closes it (platform). React's
automatic form reset after a successful action runs before the close; it is invisible because
the dialog closes.

What this is not: an `action` prop in the conventions' sense. It is React's own form action, with
React's own pending channel (`useFormStatus`), and the Form part only observes it. The dialog's
`openChangeAction(false)` still fires afterwards, as for any close, with `reason: "activate"` and
the submitter's `returnValue`.

### 8.2 `returnValue`

`dialog.returnValue` is a string set by `close(v)`, `requestClose(v)`, the `value` of a
`command="close"` / `"request-close"` button, or the submitter of a `method="dialog"` form. The
library surfaces it as `details.returnValue` (on the request and on the fact) and sets it from
`Dialog.Close value` and the Form submitter's `value`. A dismiss gives `""`:

```tsx
<Dialog.Root
  openChangeAction={(open, { reason, returnValue }) => {
    if (!open && reason === "activate" && returnValue === "ok") startTransition(() => confirm());
  }}
>
```

---

## 9. Keyboard and ARIA

| Key | Behaviour | Who |
| --- | --- | --- |
| Enter / Space on Trigger | opens (JS-free: the command; library: the intercepted click) | browser / Trigger |
| Tab / Shift+Tab inside a modal dialog | cycles through the dialog's focusable content and the browser UI; the page is inert | browser |
| Escape (modal) | closes via a close request; focus returns to the opener; `onOpenChange(false, { reason: "dismiss" })` | browser |
| Escape (non-modal) | closes via `requestClose()` | Popup listener (or `closedby` with the flag) |
| Escape inside a nested popover or dialog | modal: closes the innermost one only (platform close watchers). Non-modal: the dialog's JS `keydown` listener **ignores Escape while it belongs to an inner layer**: the target is inside an open nested `<dialog>` or an open `auto` / `hint` popover within the Popup, **or any open `auto` / `hint` popover inside the dialog is open** (close watchers are per document, not per focus, so an open popover takes the close request wherever focus is). The event is neither prevented nor acted on, the inner layer closes, and the next Escape closes the dialog. A `manual` popover (or `hint` where the engine maps it to `manual`, read through the `popover` IDL attribute) has no close watcher and does not take Escape: Escape inside it closes the dialog | browser / Popup listener |
| Enter in a form field | submits the Form: closes (`method="dialog"`) or runs the action then closes | browser / Form |

| Part | ARIA |
| --- | --- |
| Popup | implicit `role="dialog"`; `aria-modal="true"` exposed by the browser after `showModal()` (never set by hand: HTML-AAM maps it from the modal flag); `aria-labelledby` → Title id, `aria-describedby` → Description id, both always emitted, token-merged with the consumer's; `role="alertdialog"` passes through |
| Trigger | plain button; no `aria-expanded` (not an invoker state for dialogs), no `aria-haspopup` (inconsistently announced; research) |
| Close | plain button; a consumer gives an icon-only ✕ an `aria-label` |
| Title | `h2` by default; `render={<h3 />}` for a different level |

Development warnings (effect in Popup, once per instance): no Title mounted and no `aria-label`
/ consumer `aria-labelledby` on the dialog; `initialFocus` resolves to nothing or to an element
outside the dialog; a Trigger or Close rendered as a non-button in JS-free mode (the command will
not run); a Popup mounted without a Root; `transition` or `keepMounted={false}` in JS-free mode;
a Popup whose first mount finds `dialog.open` true in JS-free mode is **not** a warning (the
browser owns it).

VoiceOver did not reliably move into dialogs on `autofocus` in older WebKit (bug 314893, fixed;
release unverified). The example app must check NVDA, JAWS and VoiceOver before the component
leaves "proposed".

---

## 10. Styling, animation, scroll lock

The library ships no CSS. The hooks, both modes:

```css
.dialog { border: 0; border-radius: 8px; padding: 24px; max-inline-size: 32rem; }
.dialog::backdrop { background: rgb(0 0 0 / .4); }
.dialog:modal { box-shadow: 0 8px 32px rgb(0 0 0 / .3); }     /* modal only */
.dialog:not([data-modal]) { position: fixed; inset-block-end: 16px; }  /* a non-modal panel */
.btn[data-pending] { cursor: progress; }                     /* Trigger (library mode), Close with action */
.btn[data-open] { color: var(--accent); }                    /* optimistic, library mode */
.dialog:has([data-pending]) { opacity: .7; }                 /* dim while a Close action runs */
```

### 10.1 Enter and exit (CSS, both modes)

```css
.dialog, .dialog::backdrop {
  opacity: 0;
  transition: opacity 150ms, display 150ms allow-discrete, overlay 150ms allow-discrete;
}
.dialog:open, .dialog:open::backdrop { opacity: 1; }
@starting-style { .dialog:open, .dialog:open::backdrop { opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  .dialog, .dialog::backdrop { transition: none; }
}
```

Enter works in all three engines. Exit is a **progressive enhancement**: Chromium (with
`overlay`, which keeps the dialog in the top layer and keeps the backdrop while it fades) and
Safari animate; Firefox flips `display` to `none` at once (bug 1834877) and closes instantly.
`overlay` is Chromium-only, harmless elsewhere, and may be removed by the CSSWG; the docs note
it. No JS fallback for Firefox. The library's deferred unmount (4.4) is what keeps the content
visible during the exit where there is one.

### 10.2 Scroll lock (CSS, documented, not shipped)

```css
html { scrollbar-gutter: stable; }               /* no layout shift when the scrollbar goes */
html:has(dialog:modal) { overflow: hidden; }     /* wheel, PageDown and touch on the backdrop stop */
dialog { overscroll-behavior: contain; }         /* a scrollable dialog body does not chain to the page */
```

`showModal()` does not stop the page from scrolling (research, "Scroll locking"); this is the
only CSS-only lock that works in Chromium and Firefox, and because it keys on `:modal` it covers
dialogs opened before hydration and nested dialogs (one rule, any number of open modals). It is
part of the starter stylesheet in the docs. The alternative, a `data-` attribute toggled on
`<html>` by the Root, was rejected: it needs JS (so not before hydration), it needs
reference-counting across dialogs, and it writes outside the component's subtree. iOS Safari's
touch-scroll leak through `overflow: hidden` on the root is a known platform issue
(whatwg/html#7732) and is documented, not worked around.

### 10.3 `transition` (ViewTransition, library mode only)

Popup renders `<ViewTransition default={transition}>` as the outermost node of its output,
around the `<dialog>`, **only when `transition` is given** (conventions 5.1, #35); otherwise no
boundary. Cost on open: **a plain open starts no document view transition**, with or without
`transition`. The Popup's children mount *under* the `<dialog>` element, which is already in the
DOM, and a host element shields nested boundaries from react-dom's enter tracking (research, "Host
elements shield nested boundaries"). What does pay the 250 ms root cross-fade is a `<ViewTransition>`
that is itself the top of an inserted subtree in a transition commit: a nested `Dialog.Root`
mounted together with outer content (the original #35 report, "delayed inner open"), or any Root
inserted by a transition, when `transition` is set on it. Types per
the conventions: `fsui-dialog`, `fsui-dialog-open`, `fsui-dialog-close`.

What the boundary sees, and does not:

| Change | Lane | `<ViewTransition>` | Animate with |
| --- | --- | --- | --- |
| Trigger's `data-open` flip on click, and its snap-back | sync (optimistic) | never | CSS transition on `[data-open]` |
| Opening commit: children mount, then `showModal()` in the layout effect of the same commit | transition, `fsui-dialog-open` | yes: `update` on the dialog (hidden → shown in the top layer) and `enter` on the children; **the `::backdrop` is a pseudo-element and is not captured** | `transition` prop, **or** the CSS enter in 10.1, not both for the same open |
| Content swap while open (a Suspense boundary inside the dialog resolving, a `children` change) | transition | yes | `transition` prop |
| **Library-driven close** (Close part, Form submit or settle, foreign close command; `fsui-dialog-close`; a controlled close carries no types): children unmount and `close(returnValue)` in the same commit | transition | yes: the dialog's box as `old`, content included, in Chromium, Firefox and WebKit (CI, 13.3); **the `::backdrop` is not captured on its own**: it is part of the root snapshot, so it fades with the UA root cross-fade and vanishes at once if the page disables that cross-fade (conventions 5.1 page-policy CSS). The library cuts the dialog's CSS transition around the close, so a 10.1 CSS exit on the same dialog does not show as a live, fading copy next to the `old` image | `transition` prop |
| Dismissal (Escape, light dismiss): `close()` by the browser; a fact, one urgent commit | urgent, no type | never (conventions 3.9.8) | CSS exit in 10.1 (not in Firefox) |
| Re-open of a dismissal a controlled parent refused | urgent | never | CSS enter in 10.1 |
| `held` → `false` after a CSS exit | normal update (not a transition), no types | never: the children exit inside a hidden dialog; a transition here would start a second, invisible document view transition (4.4) | nothing |

The opening row (a top-layer `<dialog>` promoted inside a React view transition) is still an
implementation check for `showModal()` (research, "Animation"); the closing row has the Popover
evidence behind it and gets a browser test row (13.3). If the opening capture does not work, the
boundary is still rendered for consumers who set `transition` (they asked for it and accept the
mount cost) and the opening row is documented as "CSS only".

```tsx
<Dialog.Popup transition={{ "fsui-dialog-open": "fsui-dialog-in", "fsui-dialog-close": "fsui-dialog-out", default: "none" }}>
```

```css
::view-transition-new(.fsui-dialog-in) { animation: 200ms ease-out both fsui-scale-in; }
::view-transition-old(.fsui-dialog-out) { animation: 150ms ease-in both fsui-scale-out; }
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; }
}
```

**The CSS exit of 10.1 stays next to `transition`; the library keeps them apart.** When `transition` is set, the view transition is the animation for
every library-driven change, and the CSS exit of 10.1 animates dismissals, which happen in the
browser before React hears about them. The two must not run at the same time: in Chromium a
`<dialog>` with the `display` / `overlay` transition stays rendered through its fade after
`close()`, so a library-driven close's view transition would capture the fading dialog as a live
`::view-transition-new(…)` next to the `::view-transition-old(…)` image (a double image, reviewer
probe P4), and in every engine the open's `@starting-style` enter would run under the view
transition's enter. The library therefore cuts the dialog's CSS transitions around its own
`showModal()` / `show()` / `close()` while `html:active-view-transition` matches (conventions
5.1): the box is `display: none` when the new snapshot is taken, and the `old` image alone
carries the exit. Per engine (13.3): Chromium 156 shows the double image without the cut;
Firefox animates no CSS exit; WebKit has the box `display: none` by the transition's `ready`
either way. `Dialog.Popup` wraps its own `showModal()` / `show()` and the apply effect's
`close()` in `withCssTransitionCut` when the Popup has `transition`
(`internal/overlay/css-transition-cut.ts`); no consumer CSS is needed. The cut is scoped to the
library's own calls: a dismissal starts no view transition and keeps its CSS fade, also during
an unrelated page view transition.
The backdrop deserves one sentence in the docs: with the page's root cross-fade disabled,
a dialog whose backdrop should fade out with a library-driven close renders an element backdrop
as the first child of Popup (`position: fixed; inset: 0`; inside the dialog, so clicks on it are
not light dismiss, section 1), which the view transition captures with the dialog's box.

In JS-free mode `transition` is accepted and does nothing (dev warning), as in Accordion.

---

## 11. Async walkthroughs (library mode)

Notation: `C` = committed open, `O` = optimistic open, `P` = Root pending. Setup unless stated:
uncontrolled, `defaultOpen={false}`, modal, `keepMounted={false}`.

1. **Open with content that suspends, no action.** Click Trigger → `preventDefault` (no native
   command) → dispatch: types `fsui-dialog`, `fsui-dialog-open`; `O=true`, `P=true`; Trigger
   `data-open` + `data-pending`; `<dialog>` closed. Action resolves at once → post-await
   `setInternal(true)` (transition) → children render, `<OrderDetails>` suspends → the boundary
   above is revealed, so React holds: dialog closed, Trigger still pending. Data arrives → commit:
   `C=true`, children in the DOM, the Popup's apply effect runs `setAttribute("autofocus")` on the
   `initialFocus` target and `showModal()` → the dialog is in the top layer, the page inert, focus
   on the target. `P=false`.
2. **Open with an awaited Server Function.** Same, except `P` lasts through the round trip and
   then through the content render. The Trigger spins for the whole time; the dialog appears
   once, complete. A controlled parent follows "update on success" (`startTransition(() =>
   setOpen(true))` after the await).
3. **Open rejects.** `O=true` while pending, then the error reaches the boundary above Root;
   `O` reverts; `setInternal` never ran; the dialog never opened. Trigger loses `data-open` and
   `data-pending` in the same commit. Caught-inside variant: resolves, commits, opens.
4. **Escape.** Dialog open (`C=true`). Escape → close request → `cancel` (the library does not
   prevent it) → the platform closes the dialog and restores focus to the Trigger → `close`
   event (a task later) → no intent recorded → `getAnimations()` finds the fade
   (Chromium/Safari) → `held=true` (urgent) → the fact: `C=false` written urgently and
   `onOpenChange(false, { reason: "dismiss", event: closeEvent, returnValue: "" })` called
   synchronously. One urgent commit: `O=false`, `C=false`, `P=false`; the Trigger loses
   `data-open` and never shows `data-pending`; children stay mounted (`held`) → the fade ends →
   `held=false` (a normal update, 4.4) → children unmount. In Firefox `held` is never set and
   the children unmount in the fact's commit. `openChangeAction` is not called.
5. **Escape, controlled parent refuses.** As 4, with `open` still `true` in the fact's commit:
   the apply effect sees `C=true`, `dialog.open=false`, nothing in flight → `showModal()`
   again, in the task of the `close` event. The user saw the dialog close and return.
   Documented as the consequence of not adopting `false`; not a veto.
6. **Close part with `action` (Delete confirmation), action rejects.** Click "Delete" →
   `preventDefault` (cancels the command) → the Close part's transition: `data-pending` on the
   button, `await deleteItem()` → rejects → the error reaches the boundary nearest the Close part
   (inside the dialog if the consumer placed one there; else above Root, which unmounts and
   therefore closes the dialog). `requestClose` never ran; `openChangeAction` never ran; a
   surviving dialog stays open.
7. **Form with a Server Function, success.** Submit → React runs the action; `useFormStatus().pending`
   true in the watcher and in the consumer's SubmitButton → the action resolves and React
   revalidates, say, a list that suspends → pending stays true until that content commits → the
   watcher's effect sees `true → false` → `requestClose(submitEvent, "activate", "save")`:
   `O=false`, `P=true` (Trigger `data-pending`), `openChangeAction(false, { reason: "activate",
   returnValue: "save" })` awaited → resolves → `C=false` commits (children unmounted inside the
   view transition if `transition` is set, else held, 4.4) → apply effect `close("save")` →
   `dialog.returnValue === "save"`, focus back on the Trigger (platform) → `close` event: `false`
   intended → echo, no dispatch. `P=false`.
8. **Overlap: part-initiated close pending, user dismisses, then re-opens.** A slow
   `openChangeAction(false)` from a Close (`O=false`, `P=true`, `C=true`, dialog open). Escape:
   the fact supersedes the close (13). Click Trigger: `O=false`, so it is a real dispatch:
   `O=true`, types added, action awaited; when it resolves, `C=true` and the apply effect calls
   `showModal()`. The superseded close's resolution changes nothing; its rejection, if any, is
   passed to `reportError` (conventions 2.4). The Trigger shows `data-open` and `data-pending`
   from the click until the re-open commits (4.2). Variant: an Escape during a `Dialog.Form`
   save, then a re-open. When the save settles the Form's watcher does **not** close the
   dialog again, because the dialog was closed since the submit (8.1). `openChangeAction` ran
   for the opens only; `onOpenChange` heard the dismissal.
9. **Pre-hydration click, then hydration.** Server HTML: Trigger with `command="show-modal"`,
   empty `<dialog>`. Click → native open, focus on the dialog element, page inert. Hydration:
   React warns about the `open` attribute (suppressed) → the Popup's mount effect finds
   `dialog.open && !C` → dispatch `true` with `{ reason: "platform", event: undefined }` → `O=true`,
   Trigger `data-open` + `data-pending` → action resolves → `C=true` → children mount into the
   open dialog; the apply effect sees `dialog.open` already true → nothing. Focus stays where
   the platform put it. If the parent refuses or the action rejects: after settle, `C=false`,
   `dialog.open=true` → `close()` (the library's own: an echo) → the dialog closes, focus returns to
   the Trigger, no callback.
10. **Nested confirm (example 12.5).** The outer dialog is controlled (`open` +
    `openChangeAction={(next) => setOpen(next)}`). "Discard…" inside it is the `Dialog.Trigger`
    of a nested **JS-free** `Dialog.Root`: a native `command="show-modal"`, so the confirm opens
    synchronously in the click, with no transition and nothing pending; an unrelated transition
    started while the user decides commits normally. The confirm stacks on top; Escape and the
    "Keep editing" Close (`request-close`) close the confirm only. The "Discard" Close has
    `action={async () => { await discardDraft(); startTransition(() => setOpen(false)); }}`: the
    Close shows `data-pending` while the draft is discarded, then its own `close()` closes the
    confirm, and the outer `open` becomes `false` in a transition. The outer dialog is closed by
    **the parent's controlled close**: the outer apply effect sees committed `false` with an open
    dialog, records the echo intent and calls `close()`; the outer `openChangeAction(false)` is
    **not** called (2.3, "controlled parent set `open={false}`" row) and the outer
    `returnValue` is `""`. A consumer who needs the outcome records it in the Close action (the
    example's `setLast("discarded")`), not in an outer callback. What must **not** be
    written: any action that awaits the user's answer (an outer Close whose action returns a
    promise the confirm resolves, or that opens the confirm with `startTransition` and then
    awaits). React puts every transition started while an async action is pending into that
    action's lane, so the confirm never opens, or every transition in the app is held until the
    user answers (conventions 2.3 item 6; a characterisation test keeps this on record). With
    #46 the "Discard" Close's own close of the **confirm** is library-owned too: the inner Root
    is JS-free, so that close is the browser's (`dialog.close("discard")` after the action), and
    the outer close is the parent's controlled close through the apply effect, as before.
11. **Close part without `action`, `transition` set (the #46 case).** `C=true`, `O=true`. Click
    "Cancel" (`value="cancel"`) → `preventDefault` (the `request-close` command does not run) →
    `requestClose(click, "activate", "cancel")`: `intended()` is `true` → dispatch `false`:
    `O=false` (Trigger loses `data-open`), `P=true` (Trigger `data-pending`), the pending
    `returnValue` is `"cancel"`, `openChangeAction(false, { reason: "activate", returnValue:
    "cancel", event: click })` awaited. Resolves → `C=false` commits: React starts a view
    transition (the boundary's subtree changed), captures the dialog's box with its content as
    `old`, unmounts the children, runs the apply effect's `close("cancel")` inside the update
    callback (`beforetoggle` sets `awaitingClose`; the platform restores focus to the Trigger),
    the `new` snapshot has no box → the exit plays in every engine. `close` event (a task
    later): `awaitingClose` cleared; `false` intended → echo, no dispatch; animation read
    skipped (`transition` set). `P=false`. Firefox shows the same exit, which no CSS can give it.
12. **Same, `transition` absent, Chromium.** As 11 until `C=false`: the render sees committed
    `true → false` and sets `held`, so the children stay; apply effect `close("cancel")`; the
    `close` listener finds the CSS fade (10.1) → `held` cleared when it settles, a normal
    update; in Firefox (no fade) it is cleared at once. The user sees the dialog fade with its
    content, as a dismissal does today.
13. **Dismissal during a pending part-initiated close.** As 11 with a slow
    `openChangeAction(false)`: `O=false`, `P=true`, `C=true`, the dialog still open. Escape →
    the platform closes it and restores focus → `close` event: not the library's own
    (`libraryClose` unset) → the part's pending `returnValue` is dropped → the fact: the
    pending close is superseded, `C=false` urgently (uncontrolled), `onOpenChange(false, {
    reason: "dismiss", returnValue: "" })` at once; `held` may be set for the CSS fade. The
    consumer heard `openChangeAction(false, "activate")`, then `onOpenChange(false,
    "dismiss")`. Whatever the action then does changes nothing: adopted or vetoed, the dialog
    stays closed (a controlled parent already adopted the fact; one that refuses the fact gets
    the re-open of 5); a rejection goes to `reportError`. `P` stays until it settles. If the
    Trigger re-opens the dialog before the action settles (8), the dialog ends open, which is
    what the user asked for last.
14. **Controlled parent vetoes a part-initiated close.** As 11 with `openChangeAction={(next,
    { returnValue }) => { if (next || returnValue !== "cancel" || !dirty) setOpen(next); }}`: the
    action resolves, the parent keeps `open={true}`, `O` reverts to `true`, `C` never changed,
    the apply effect sees `C=true` and the dialog open → nothing. The Trigger's `data-open`
    snapped back; the dialog never blinked; focus stayed where it was. A real veto, available
    because this close was library-owned; the docs show it with the usual "adopt `false`
    unless …" shape and note that a *dismissal* refused the same way re-opens (5), and that a
    dismissal which landed during the vetoed close is sent, not undone (13).
15. **`method="dialog"` submit, consumer `onSubmit` validates.** Submit → React's `onSubmit`
    runs first (root listener): invalid → `preventDefault()`; the Popup's document-level
    listener sees `defaultPrevented` → nothing; the form did not submit, the dialog stays open
    (as natively). Valid → the listener cancels the native submission and `requestClose(submit,
    "activate", submitter.value)` → as 11 with the `SubmitEvent` as `details.event`.
16. **Close action pending, controlled parent closes meanwhile.** `setOpen(false)` from
    elsewhere while a Close `action` runs: the commit is entangled with the action and lands
    when it settles; the continuation runs first, `intended()` still reads `true` (the commit
    has not landed) → `requestClose` dispatches `false` and the parent receives one
    `openChangeAction(false)` for a close it already decided; it adopts it idempotently
    (`setOpen(false)` again) → one close, one view transition. Documented as a note; no
    mechanism, since the generation guard cannot see a controlled close.

---

## 12. Call-site examples

### 12.1 Server Component, JS-free, Server Function form

Section 2.1 shows it. Everything is in the server HTML; the dialog opens, focuses the
`autoFocus` input, submits with progressive enhancement and closes after the action, with no
client component written by the consumer.

### 12.2 Client Component, uncontrolled, content loaded on open

```tsx
"use client";
import { Dialog } from "@funstack/ui/dialog";

export function OrderRow({ order }: { order: OrderSummary }) {
  return (
    <tr>
      <td>{order.number}</td>
      <td>
        <Dialog.Root defaultOpen={false}>
          <Dialog.Trigger className="btn">
            {({ pending }) => (pending ? <Spinner aria-hidden /> : "Details")}
          </Dialog.Trigger>
          <Dialog.Popup className="dialog" lightDismiss initialFocus="[data-close]">
            <Dialog.Title>Order {order.number}</Dialog.Title>
            <OrderDetails id={order.id} />          {/* use(fetchOrder(id)): the dialog opens when ready */}
            <Dialog.Close className="btn" data-close>Close</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Root>
      </td>
    </tr>
  );
}
```

`defaultOpen={false}` is the shortest way to select library mode without an action; the Trigger
spins while the order loads and the dialog opens complete. Fifty rows mount fifty closed dialogs
and zero fetches.

### 12.3 Controlled, opened without a Trigger

```tsx
"use client";
const [open, setOpen] = useState(false);
useEffect(() => { if (unsaved && navigatingAway) startTransition(() => setOpen(true)); }, [...]);

<Dialog.Root open={open} openChangeAction={(next) => { setOpen(next); }} onOpenChange={setOpen}>
  <Dialog.Popup>
    <Dialog.Title>Unsaved changes</Dialog.Title>
    <Dialog.Close value="stay">Stay</Dialog.Close>
    <Dialog.Close value="leave" action={() => router.navigate(target)}>Leave</Dialog.Close>
  </Dialog.Popup>
</Dialog.Root>
```

No Trigger: the apply effect opens the dialog when `open` becomes `true`. Focus returns to
whatever was focused before the open (the platform), or nowhere if it was removed.

### 12.4 Persisting a dismissal with a Server Function, from a Server Component

```tsx
// Server Component
import { Dialog } from "@funstack/ui/dialog";
import { rememberDismissed } from "./actions"; // "use server": (open, details) => Promise<void>

<Dialog.Root defaultOpen={!user.sawWelcome} openChangeAction={rememberDismissed} onOpenChange={rememberDismissed}>
  <Dialog.Popup>…</Dialog.Popup>
</Dialog.Root>
```

The dialog opens after hydration (a modal `defaultOpen` cannot be in the HTML); when the user
dismisses it the Server Function receives `(false, { reason: "dismiss", returnValue: "" })` and
the Trigger-less dialog shows nothing pending (there is no Trigger), which is fine: the close
already happened. Using a Server Function for the **open** side is possible but rarely useful;
the idiomatic server interaction is `Dialog.Form action` (12.1).

### 12.5 Confirm before closing (nested JS-free dialog, one action)

An action must never await user input (conventions 2.3 item 6). The first drafts of this example
had an action wait for the confirm dialog's answer, either by returning a promise its buttons
resolved or by opening it with `startTransition` and awaiting; both **deadlock or stall**: React
puts every transition started while an async action is pending into that action's lane, so the
confirm's open never commits, or every transition in the app is held until the user answers.
The shape that was implemented and verified (example app, Chromium and Firefox: the confirm is
`:modal` synchronously after the click) has no action waiting for anything:

```tsx
"use client";
function EditDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} openChangeAction={(next) => setOpen(next)} onOpenChange={setOpen}>
      <Dialog.Trigger>Edit</Dialog.Trigger>
      <Dialog.Popup>
        <Dialog.Title>Edit</Dialog.Title>
        <Dialog.Form action={save}>…<button type="submit">Save</button></Dialog.Form>
        {/* Outer parts come before the inner Root: a part binds to the nearest Root. */}
        <Dialog.Close value="close">Close</Dialog.Close>

        {/* JS-free: the Trigger is a native show-modal command, so the confirm opens at once. */}
        <Dialog.Root>
          <Dialog.Trigger>Discard…</Dialog.Trigger>
          <Dialog.Popup role="alertdialog">
            <Dialog.Title>Discard changes?</Dialog.Title>
            <Dialog.Close value="keep">Keep editing</Dialog.Close>
            {/* The confirm's own Close action does the work, then closes the controlled editor. */}
            <Dialog.Close
              value="discard"
              action={async () => {
                await discardDraft();
                startTransition(() => setOpen(false));
              }}
            >
              {({ pending }) => (pending ? <Spinner /> : "Discard")}
            </Dialog.Close>
          </Dialog.Popup>
        </Dialog.Root>
      </Dialog.Popup>
    </Dialog.Root>
  );
}
```

What each piece does. "Discard…" is the inner Root's `Dialog.Trigger`, not a Close of the
outer dialog: a Close part always closes its own dialog (natively, through `request-close`, or
after its `action`), and neither form can "close only if confirmed". The inner Root is JS-free
(none of `open` / `defaultOpen` / `openChangeAction`), so its Trigger is a native
`command="show-modal"` and the confirm opens synchronously inside the click, with no transition
and nothing pending while the user decides; its Popup has no `transition`, so no
`<ViewTransition>` mounts with the editor's content and the #35 cross-fade is not paid (2.6).
"Keep editing" and Escape close the confirm only
(it is a DOM descendant of the editor, so it is not inert and stacks above; a second Escape
closes the editor unconfirmed, which cannot be gated on this platform, section 7). The
"Discard" Close's `action` discards the draft (`data-pending` on that button meanwhile; a
Server Function can be awaited there), then closes the editor through its controlled `open` in
a transition; the Close part closes the confirm itself after the action resolves. The outer
dialog is closed by the parent's controlled close (2.5), so the outer `openChangeAction(false)`
is **not** called for it and its `returnValue` is `""`: record the outcome in the Close action,
as the example app's `setLast("discarded")` does.

Placement rule: **the outer dialog's parts must sit outside the inner Root.** A part binds to
the nearest `Dialog.Root` context, so an outer `Dialog.Close` written inside the inner Root
would close the confirm instead. Keep the outer Form and Close before (or after) the inner
`<Dialog.Root>` element, as above.

The reviewer's alternative, deferring the confirm's open with `setTimeout(() =>
setConfirming(true))` from inside an outer Close action that then awaits the answer, also
opens the confirm, but it keeps an action awaiting user input and every transition in the app
is held until the user answers; rejected for that reason.

### 12.6 Tailwind, non-modal, `render`

```tsx
<Dialog.Root modal={false} defaultOpen={false}>
  <Dialog.Trigger className="data-open:bg-accent data-pending:animate-pulse">Help</Dialog.Trigger>
  <Dialog.Popup
    lightDismiss
    className="fixed bottom-4 right-4 m-0 rounded-lg shadow-lg"
    render={<aside aria-label="Help panel" />}   /* dev warning: must be a <dialog>; use className instead */
  >…</Dialog.Popup>
</Dialog.Root>
```

(The `render={<aside />}` line is the documented mistake; the example in the docs shows the
warning text and the fix.)

---

## 13. Test plan

Moved to `design/CHANGELOG.md` (part "dialog.md"). Not part of the contract: the code and the tests are the reference.

## 14. Implementation notes

Moved to `design/CHANGELOG.md` (part "dialog.md"). Not part of the contract: the code and the tests are the reference.
