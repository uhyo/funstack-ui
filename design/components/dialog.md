# Dialog

Status: **accepted** (2026-10-16, GitHub issue #26; all product-owner questions accepted as
recommended, implementation deviations folded in from `memo/developer/dialog.md` the same day,
and the implementation-review fixes (light dismiss press-and-click, nested Escape, Form
`closeOnSettle` / `method`, Trigger `pending`, owned `disabled`, the nested-confirm pattern)
folded in on 2026-10-17).
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
| 2 | Two modes, one anatomy | **JS-free mode** (Root has none of `open` / `defaultOpen` / `openChangeAction`): the browser owns everything through Invoker Commands; content is always mounted; works from a Server Component and before hydration. **Library mode** (any of the three present): **open is library-owned** (Trigger click intercepted, `openChangeAction(true)` awaited, content rendered from committed state, `showModal()` in a layout effect), **close is browser-owned** (every close request closes natively and at once; `openChangeAction(false)` is a notification from the `close` event). |
| 3 | Modal | `modal` on Root, default `true`. `modal={false}` uses `show()`; it needs one click handler because there is no `show` command, so a non-modal dialog is never JS-free. |
| 4 | Reason vocabulary | `details.reason` is `"activate"` (Trigger, Close, Form submit), `"dismiss"` (Escape, back, light dismiss, assistive-technology dismiss: a close the user requested without a part), or `"platform"` (mount reconciliation of a pre-hydration open). `"dismiss"` is now part of the shared `ChangeReason` (conventions 2.2, accepted 2026-10-16). `details.returnValue` carries `dialog.returnValue` on close. |
| 5 | Pending UI | Trigger: `data-open` (optimistic) and `data-pending` in library mode. The `<dialog>` emits no `data-open`: `:open` and `:modal` are exact. Root has no DOM, so `pending` lives on the Trigger and in Root's `children(state)`. |
| 6 | Content mounting | Library mode: Popup children unmount when closed by default; `keepMounted` keeps them in `<Activity mode="hidden">` (conventions 3.7, boolean only). Unmount is deferred until the dialog's exit animations finish so a fading dialog is never empty. JS-free mode: always mounted (the markup must be complete before hydration). |
| 7 | Initial focus | `initialFocus` on Popup (a ref or a selector). The library writes `autofocus` on the resolved element through the DOM right before `showModal()` and lets the platform's dialog focusing steps run; it never calls `.focus()` on open. Return focus is the platform's; the library only handles "the opener is gone". |
| 8 | Dismissal | Escape and Android back are the platform's and cannot be disabled in v0 (the anti-abuse rule allows one veto per activation, which is not an API). `lightDismiss` on Popup (default `false`) closes on a backdrop click through JS `pointerdown` + `click` listeners: both the press and the click must land outside, as native `closedby="any"` requires. `experimental_closedBy` on Popup renders `closedby="any" \| "closerequest"` and skips the JS where `closedBy` is implemented. |
| 9 | Forms | `Dialog.Form` renders `<form method="dialog">` (JS-free: submit closes with the submitter's `value` as `returnValue`) or, with `action`, `<form action={action}>` plus a status watcher that closes the dialog when the action's transition settles. The action is passed through unwrapped, so a Server Function keeps React's progressive enhancement. `Dialog.Close action` is the single-button form of the same thing. |
| 10 | Animation | Enter and exit with CSS (`@starting-style`, `transition-behavior: allow-discrete`, `overlay`); exit is a progressive enhancement (instant in Firefox). Popup renders `<ViewTransition>` and takes `transition`: it animates the opening commit (content mount plus `showModal()`) and content changes while open, never the close. |
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
| `Trigger` | `button` | button | `data-open` (optimistic), `data-pending`, `data-disabled` (library mode); nothing in JS-free mode | `commandfor` + `command="show-modal"`. Not an `aria-expanded` invoker (APG does not require one; research "Invoker state"). |
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
| Selected when | Root has none of `open`, `defaultOpen`, `openChangeAction` | Root has any of them |
| Open | Browser: `command="show-modal"` | Library: Trigger click intercepted, dispatch inside the Root's transition, `showModal()` in a layout effect of the commit that mounts the content |
| Close | Browser | Browser; `openChangeAction(false)` notified from the `close` event |
| Content | Always mounted | Rendered from committed `open`; unmounted while closed unless `keepMounted` |
| `data-open`, `data-pending` on Trigger | never emitted (use `:open` on the dialog) | emitted |
| `openChangeAction` | n/a | awaited for `true`; a notification for `false` |
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
<Dialog.Root open={open} openChangeAction={(next) => { setOpen(next); }}>

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

### 2.3 Library mode: close is browser-owned

Every close closes natively and immediately: Escape, Android back, an assistive-technology
dismiss gesture, light dismiss, the Close part's `request-close`, a `method="dialog"` form, the
Form watcher's `close()`, the Close action's `close()`, and a controlled parent setting
`open={false}` (section 2.5). The library never delays a close behind an action: close requests
are cancelable only once per user activation (research, "anti-abuse rule"), `close()` from a
form is not cancelable at all, and a user who pressed Escape expects the dialog to go away now.

The Popup listens to the native `close` event and the Root dispatches the notification:

```ts
// Popup, native listener on the <dialog>
dialog.addEventListener("close", (event) => {
  if (event.target !== dialog) return;                    // same filter as every native listener (14)
  const intent = takeCloseIntent();                       // set by command/submit/Close action, else undefined
  root.notifyClosed({
    event: intent?.event ?? event,
    reason: intent?.reason ?? "dismiss",
    returnValue: dialog.returnValue,
  });
});
```

`notifyClosed` skips the dispatch when the latest intent is already `false` (the library's own
`close()` for a controlled parent echoing back, section 2.5) and otherwise runs the normal
dispatch with `next = false`: optimistic `false` at once (the Trigger loses `data-open`), the
action awaited inside the transition, uncontrolled state committed after it. The Trigger shows
`data-pending` while the notification action runs (the Root is pending, section 4.2),
which is what a consumer who persists "dismissed" through a Server Function wants to style.

Close intents. The `close` event carries no source, so the Popup records what caused the close
just before it happens and the `close` listener consumes it:

| Cause | Recorded by | `reason` | `details.event` |
| --- | --- | --- | --- |
| `Dialog.Close` without `action` (or any invoker with `command="request-close"` / `"close"`) | the Popup's `command` listener | `"activate"` | the `CommandEvent` |
| `Dialog.Form` without `action` (`method="dialog"`), or a submitter with `formmethod="dialog"` | a `submit` listener on the Popup (bubbles from the form) | `"activate"` | the `SubmitEvent` |
| `Dialog.Form` with `action`, after the action settled | the Form's watcher before calling `close()` | `"activate"` | the `SubmitEvent` that started it |
| `Dialog.Close` with `action`, after the action settled | the Close part before calling `close()` | `"activate"` | the `click` `MouseEvent` |
| Escape, back, AT dismiss, backdrop click (`lightDismiss` or `closedby="any"`), the JS fallbacks | nothing | `"dismiss"` | the `close` `Event` |
| Controlled parent set `open={false}` | the Popup's apply effect, before `close()` | no dispatch (echo) | |

An intent that does not result in a close (a `request-close` whose `cancel` a consumer prevented
through the pass-through `onCancel`, or a `method="dialog"` submit that validation blocked) is
cleared by a single `setTimeout(0)` scheduled when the intent is recorded, which clears it **only
if the dialog is still open** at that point. That one timer replaces the `cancel` listener the
design first proposed: it covers every way an intent can fail to close, not only a cancelled
close request, and it never clears an intent that the `close` listener is about to consume (a
real close fires `close` in the same task sequence before the timer, and `takeCloseIntent()`
already emptied it).

**A controlled parent that refuses to close.** The dialog is already closed when the action runs.
If the parent keeps `open={true}`, then after the action settles optimistic reverts to `true`,
and the Popup's apply effect sees committed `true` with a closed dialog and calls `showModal()`
again: the dialog re-opens, with focus moved back into it. This is conventions 3.5 ("it follows
the browser, it does not gate it"), the same behaviour as a refused find-in-page reveal in
Accordion, and it is **not a veto mechanism**: the user sees the dialog close and come back. The
docs say so and recommend adopting `false` unconditionally. "Unsaved changes" confirmation is
built *inside* the dialog (a nested JS-free confirm Dialog whose Trigger is the "Discard…"
button and whose Close `action` closes the outer dialog, example 12.5), not by refusing the
close.

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

```ts
useLayoutEffect(() => {
  if (!isLibrary || root.pending || root.latestInFlight() !== null) return;
  const dialog = ref.current!;
  if (closingRef.current) return;   // native close in progress; its `close` event has not arrived yet
  if (committedOpen && !dialog.open) {
    applyInitialFocus(dialog, initialFocus);          // writes `autofocus`, section 6
    modal ? dialog.showModal() : dialog.show();
  } else if (!committedOpen && dialog.open) {
    recordCloseIntent(undefined);                       // echo: the close listener will skip
    dialog.close();                                     // not requestClose(): a parent's close is not vetoable
  }
}, [isLibrary, committedOpen, modal, root.pending, root.latestInFlight]);
```

**The re-open race.** A native close (Escape, light dismiss) closes the dialog synchronously, but
the `close` event, and with it the notification dispatch, arrives a task later. In that window
`committedOpen` is still `true`, `dialog.open` is already `false` and nothing is in flight, so a
commit landing there (any unrelated re-render) would make the effect call `showModal()` and
re-open a dialog the user just closed. The guard is a `closingRef` flag set in the Popup's
**synchronous** `beforetoggle` listener when `newState === "closed"` and cleared in the `close`
listener before `notifyClosed`; while it is set the effect does nothing. `beforetoggle` fires
synchronously inside the close steps in every engine and in the jsdom shim.

This one effect covers: the normal open (committed flipped by the user's dispatch), `defaultOpen`
on mount, a controlled parent opening the dialog programmatically (`setOpen(true)` from a menu,
a route, a timer; no Trigger needed), a controlled parent closing it (`setOpen(false)` after its
own form logic), the re-open of a refused close, and the close after a rejected or refused
pre-hydration open. The library **never renders the `open` attribute** (research: removing it by
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

Baseline JS for non-modal dialogs (both modes): a `keydown` listener on the dialog closes it on
Escape with `requestClose()`, leaving the event alone while it belongs to an inner layer (the
target is inside an open nested `<dialog>` or an open `auto` / `hint` popover, or any open
`auto` / `hint` popover inside the dialog would take the close request; section 9), so the APG
expectation holds; with `lightDismiss`, document `pointerdown` and `click` listeners (capture)
close it when both the press and the click land outside the dialog, **ignoring the Trigger**
(otherwise the Trigger's own click would close and immediately re-open the dialog, or in
JS-free mode close it on every second click). With `experimental_closedBy`
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
   * Awaited for `true` (the dialog opens when it resolves and the content has rendered); a
   * notification for `false` (the dialog is already closed; the action runs inside the Root's
   * transition). May be a Server Function. Rejections reach the nearest Error Boundary above Root.
   *
   * A `setState` placed after your own `await` is not a Transition update; wrap it in
   * `startTransition` (React limitation).
   */
  openChangeAction?: ChangeAction<boolean, DialogOpenChangeDetails>;
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
   * The Root's transition is pending: an open in flight, a close notification in flight, or a
   * re-open requested while a close notification is still settling (section 4.2).
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
`command`, `disabled`, `data-open`, `data-pending`, `data-disabled`, and `onClick` **only when installed**
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
   * the opening commit and content changes while open; the close is the browser's and animates
   * with CSS. Ignored (dev warning) in JS-free mode.
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
consumer choice that keeps all native behaviour. `tabIndex` passes through for the rare
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
   * Runs inside this part's own transition, then closes the dialog with `close(value)`. A
   * rejection reaches the nearest Error Boundary above the Close part and leaves the dialog open.
   * Without `action` the button is a native `command="request-close"` invoker (JS-free).
   */
  action?: Action<[details: DialogCloseDetails]>;
  /** Becomes `dialog.returnValue` (and `details.returnValue` of the close notification). */
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

Owned keys: `type`, `commandfor`, `command`, `value`, `disabled`, `onClick` (only with `action`),
`data-pending`, `data-disabled` (`disabled` is owned on every part that takes the prop,
conventions 1.2). With `action`, the click is `preventDefault()`ed (which cancels
the command) and the part runs the action through the shared `useActionTrigger` (conventions
3.4), its own transition: `run(() => action(details), () => close(value))`; the Close button is
the only element that shows `data-pending` (Root's `pending` is reserved for `openChangeAction`;
dim the dialog with `dialog:has([data-pending])`). Repeated clicks while pending re-run the
action (latest intent; conventions 3.6); the first `close()` wins and later ones are no-ops on a
closed dialog. A superseded click's rejection is surfaced by the hook (conventions 2.4).

**A stale close is dropped** (the Popover 3.4 rule). If the user dismissed the dialog (Escape)
and opened it again while the action ran, the continuation would `close()` the new open. The
Root keeps an **open generation**, a counter bumped by every open it sees (its own open dispatch
and the Popup's native `beforetoggle` to open, which fires synchronously inside `showModal()` /
`show()`, so foreign, pre-hydration and JS-free opens count too, as Popover 14.1; **not**
`toggle`, which is queued and could arrive after a pending Close settled, so the stale close ran
on the new open, a flaky test fixed in 03ab818), and the Close passes it as
`useActionTrigger(openGeneration)`, which skips the
close when the counter changed after the click. The action's result stands; only the close is
dropped. `Dialog.Form` guards the same case with `closedSinceSubmit` (8.1). Added at the Menu
review (M2): until then `Dialog.Close` was the one part without the guard. In library mode the
guard rarely fires: React holds the re-open (entangled with the pending action) until the action
settles, so `dialog.open` is still `false` when `then` runs and `close()` is a no-op anyway. It
matters for the JS-free / native-open case, where the browser re-opens the dialog at once
(the jsdom row that fails without it is the JS-free one).

### 3.5 `Dialog.Form`

```ts
export interface DialogFormProps
  extends Omit<ComponentPropsWithRef<"form">, "method" | "action" | "className" | "style" | "children"> {
  /**
   * React form action (`(formData) => unknown`, may be a Server Function). Passed to the form
   * unwrapped so React's progressive enhancement is kept; the dialog closes with the submitter's
   * `value` as `returnValue` once the action's transition settles (see `closeOnSettle`). A
   * rejection leaves the dialog open. Without `action` the form renders `method="dialog"`:
   * submitting closes the dialog natively. A string `action` (a URL) is a plain navigating form.
   */
  action?: string | ((formData: FormData) => unknown);
  /**
   * With a function `action`: close the dialog once the action's transition settles without
   * throwing. Default `true`.
   *
   * Any result that does not throw counts as success, including a `useActionState`-style result
   * that reports validation errors: with the default the dialog closes and those errors are never
   * seen. Throw to keep the dialog open, or set `closeOnSettle={false}` and close it yourself:
   * a `Dialog.Close`, a submitter with `formMethod="dialog"`, or a controlled `open`.
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
| `open` | Root (`useControllableAction<boolean>`) | **Library-owned for opening, browser-owned for closing** in library mode; fully browser-owned in JS-free mode | optimistic: Trigger `data-open`, `state.open` on Root/Trigger; committed: Popup children mounting, `state.open` on Popup; DOM: `:open`, `:modal` |
| `pending` | Root `useTransition` | library | Trigger `data-pending` (whenever the Root is pending, 4.2), Root `state.pending` |
| Close `pending` | Close part `useTransition` | library | `data-pending` on that Close button |
| Form `pending` | React's form transition | React | `DialogFormState.pending`, `useFormStatus` in children |
| `exiting` | Popup local state | library (derived from the DOM's running animations) | keeps children mounted during the exit animation; not exposed |
| `modal`, `lightDismiss`, `keepMounted`, `initialFocus` | props | n/a | `data-modal` on Popup |
| focus position, `returnValue`, close watcher state | browser | browser | `document.activeElement`, `dialog.returnValue` |

### 4.1 The hook and the reducer

`useControllableAction<boolean, DialogOpenChangeDetails>` with the default replace reducer;
`transitionTypes` returns `fsui-dialog` plus `fsui-dialog-open` or `fsui-dialog-close` from
`next`. `next` is computed against the optimistic value: a Trigger click while the dialog is
optimistically open is a no-op; a `close` notification while a close is already the latest intent
is skipped (the echo case). The hook's `latestInFlight()` is what the Popup's apply effect and
the `close` listener consult, exactly as Accordion's `dispatchFromDom` does.

### 4.2 Where `data-pending` lands

Root has no element, so conventions 4.3's "owner" row has nowhere to land; the Trigger is the
initiating trigger for opens, and every Root dispatch is either an open or a close
notification, both of which belong to the Trigger. Rule: **`trigger.pending = root.pending`**.
Consequences: open pending → Trigger pending; close notification pending → Trigger pending;
open then immediately re-click to close before it opened (impossible: the Trigger is a no-op
while optimistically open) → n/a; refused close re-opening → Trigger pending until the re-open;
**re-open while a close notification is still pending** (walkthrough 8) → the Trigger shows
`data-pending` from the click until the re-open commits, which is after the slow close
notification settles, because the re-open's transition is entangled with it (conventions 2.3
item 5). The user sees "pending" rather than a dialog that opens late for no visible reason.
The Popup never carries `data-pending` (it is a content region, conventions 4.3).

The first version of this rule was `root.pending && root.optimistic !== root.committed`. The
implementation review found that it hides exactly the re-open window: during it the close never
committed, so committed and optimistic are both `true` while the Root is pending, and the
Trigger would have shown nothing for a click the user made. The rule is now the Root's pending
unconditionally (the Trigger's `state.pending` and Root's `children(state).pending` agree).

### 4.3 Error, rollback, veto

- **`openChangeAction(true)` rejects.** The error reaches the Error Boundary nearest the Root;
  optimistic reverts; uncontrolled committed state was never written; the dialog never opened,
  nothing in the DOM to roll back. Caught-inside variant: resolves, commits, opens.
- **`openChangeAction(false)` rejects.** The dialog is already closed. An uncaught rejection
  reaches the boundary above the Root, which **unmounts the whole component**, so the dialog
  cannot re-open: the boundary's fallback is what the user sees. A re-open is observable only
  when the component stays mounted with committed `true`: a controlled parent that refuses the
  close (2.3), or an action that catches the error without adopting `false` (controlled mode).
  In those cases optimistic reverts to `true` and the apply effect calls `showModal()` again
  once nothing is in flight. Consumers who want "closed is closed" adopt `false` before awaiting
  in controlled mode, or stay uncontrolled and catch inside (which commits `false`).
- **Controlled veto of an open** (parent does not adopt `true`): optimistic shows the Trigger
  open while pending, then snaps back; the dialog never opened.
- **Controlled refusal of a close**: section 2.3; re-opens; not a veto.

### 4.4 Exit animations and the deferred unmount

With the default `keepMounted={false}`, committed `false` unmounts the children. A sync
notification action commits within a frame of the `close` event, while in Chromium and Safari the
dialog is still fading out under `transition: display … allow-discrete; overlay … allow-discrete`
(research, "Animation"). Without care the fading box is empty. The Popup therefore keeps the
children mounted while `committed || exiting`:

```ts
// Popup, in the `close` listener, before the Root dispatch
void getComputedStyle(dialog).opacity;                         // flush style so transitions have started
const animations = dialog.getAnimations({ subtree: true });   // includes ::backdrop and descendants
if (animations.length > 0) {
  setExiting(true);                                            // urgent; must land before the unmount commit
  Promise.allSettled(animations.map((a) => a.finished)).then(() => startTransition(() => setExiting(false)));
}
```

In Firefox `display` flips to `none` at once and `getAnimations()` is empty, so the children
unmount with the notification commit. Animations whose `finished` promise can never settle
(`animation-iteration-count: infinite`, an indefinite `::backdrop` pulse) are filtered out before
`allSettled`, so a decorative loop cannot keep the children mounted forever. `setExiting(true)` is a sync-lane write made from a
platform event handler, not a user-triggered state change; it is the one place in this
component where the library writes urgent state, and it is library-internal. The
`exiting` → `false` commit is a transition without `fsui-*` types. `keepMounted` dialogs need the
same `exiting` flag for a different reason: a hidden `<Activity>` is `display: none`, which would
blank the fading box just like an unmount, so the Activity renders
`mode={committed || exiting ? "visible" : "hidden"}` and flips to hidden only when the exit
animation has finished.

`getAnimations({ subtree: true })` lists the `::backdrop` transition in Chromium (verified by
the reviewer), so the children stay until the backdrop fade ends too; where an engine omitted it,
the children would unmount when the dialog's own transition finishes, the same instant in the
documented CSS.

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
command. The library's `close` listener covers the one platform gap: if `document.activeElement`
is still inside the closed dialog (the opener was removed while the dialog was open, research
"Focus return"), it focuses the Trigger element registered with Root if it is connected; if the
Trigger is gone too, it calls `blur()` on the active element so focus lands on `<body>` rather
than staying on an element inside a closed, `display: none` dialog (where keyboard input would
go nowhere). No `returnFocus` prop in v0; a consumer who needs a specific
target focuses it in `openChangeAction(false)`.

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
| Backdrop / outside click | nothing; with `lightDismiss`: JS `pointerdown` + `click` on the dialog, target is the dialog and both points are outside its border box → `requestClose()` | with `lightDismiss`: platform (`closedby="any"`) | nothing; with `lightDismiss`: document `pointerdown` + `click` (capture), both outside the dialog and the Trigger → `requestClose()` | with `lightDismiss`: platform where `closedBy` exists, else JS |
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
- With the flag on, feature detection is `"closedBy" in HTMLDialogElement.prototype` inside the
  effect that would attach the listeners (never during render; conventions 8). Safari 27.0 fails
  the check and keeps the JS. Graduation: when WebKit ships `closedby`, the flag is removed and
  `closedby` is always rendered.

`requestClose()` is used for every JS-initiated user dismissal so a consumer's pass-through
`onCancel` sees it; `close()` is used after a completed action and for a controlled parent's
close, which are not vetoable.

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

Without `action` the Form renders `method="dialog"`: the platform closes the dialog on submit,
fires `submit` then `close`, sets `returnValue` from the submitter. Nothing runs in the library
except the `submit` listener that records the `"activate"` intent (section 2.3).

With `action`, React overrides `method` and calls the action with the `FormData`; the dialog does
**not** close by itself (verified). The Form renders `<form action={action}>` with the action
**unwrapped** (a client closure around a Server Function would lose React's progressive
enhancement: the server HTML would carry a throwing `javascript:` action instead of the real
endpoint and hidden fields) and a child `<FormStatusWatcher>` that reads `useFormStatus()`. A
native `submit` listener on the form records the submitter's `value`. When `pending` goes from
`true` to `false`, the watcher's effect records the `"activate"` intent and calls
`dialog.close(returnValue)`, the **settle close**. Because `useFormStatus().pending` covers the
action's whole transition, a result that re-renders suspending content keeps the dialog open
until that content has committed, which is the Suspense-native order.

**`closeOnSettle`** (default `true`) is whether the settle close happens at all. It exists
because "settled" is not "succeeded": an action wired through `useActionState` that *returns*
validation errors instead of throwing settles its transition normally, and with the default the
dialog closes with the errors unseen. Throwing keeps the dialog open (below); otherwise set
`closeOnSettle={false}`, and the Form neither records an intent nor closes anything: the
consumer closes when the returned state says so (a `<Dialog.Close>` next to the errors, a
submitter with `formMethod="dialog"`, or `setOpen(false)` from the controlled parent once
`state.ok`).

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
library surfaces it as `details.returnValue` on the close notification and sets it from
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
| Escape (modal) | closes via a close request; focus returns to the opener; `openChangeAction(false, { reason: "dismiss" })` | browser |
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
| Close | browser (`close()` / Escape) then a notification commit, `fsui-dialog-close`, with the dialog already `display: none` or fading | the notification commit runs while the dialog is closed; nothing visible to animate | CSS exit in 10.1 |
| Deferred unmount after the exit animation | transition, no types | the children `exit` inside a hidden dialog; invisible | nothing |

Top-layer elements inside a React view transition are **unverified** (research, "Animation").
Until the example app confirms that Chromium captures the dialog's `update` through the top-layer
promotion, the docs present the CSS form as the default and `transition` as the way to animate
content swaps while open. If the capture does not work, the boundary is still rendered for
consumers who set `transition` (they asked for it and accept the mount cost) and the opening row
is documented as "CSS only".

```tsx
<Dialog.Popup transition={{ "fsui-dialog-open": "fsui-dialog-in", default: "none" }}>
```

```css
::view-transition-new(.fsui-dialog-in) { animation: 200ms ease-out both fsui-scale-in; }
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; }
}
```

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
4. **Escape, sync notification.** Dialog open (`C=true`). Escape → close request → `cancel`
   (the library does not prevent it) → the platform closes the dialog and restores focus to the
   Trigger → `close` event (a task later) → no intent recorded → `getAnimations()` finds the fade
   (Chromium/Safari) → `exiting=true` → dispatch `false` with `{ reason: "dismiss", event: closeEvent,
   returnValue: "" }`: `O=false`, `P=true`, Trigger `data-pending` (no `data-open`). Action
   resolves → `C=false` commits → children stay mounted (`exiting`) → the fade ends → `exiting=false`
   in a transition → children unmount. In Firefox `exiting` is never set and the children unmount
   with the `C=false` commit.
5. **Escape, controlled parent refuses.** As 4 until the action settles with `open` still
   `true`: `O` reverts to `true`; the apply effect sees `C=true`, `dialog.open=false`, nothing in
   flight → `showModal()` again. The user saw the dialog close and return. Documented as the
   consequence of not adopting `false`; not a veto.
6. **Close part with `action` (Delete confirmation), action rejects.** Click "Delete" →
   `preventDefault` (cancels the command) → the Close part's transition: `data-pending` on the
   button, `await deleteItem()` → rejects → the error reaches the boundary nearest the Close part
   (inside the dialog if the consumer placed one there; else above Root, which unmounts and
   therefore closes the dialog). No `close()` was called; `openChangeAction` never ran.
7. **Form with a Server Function, success.** Submit → React runs the action; `useFormStatus().pending`
   true in the watcher and in the consumer's SubmitButton → the action resolves and React
   revalidates, say, a list that suspends → pending stays true until that content commits → the
   watcher's effect sees `true → false`, records `{ reason: "activate", event: submitEvent }`,
   calls `close("save")` → `close` event → notification dispatch `false` with
   `returnValue: "save"` → as in 4.
8. **Overlap: close notification pending, user re-opens.** As 4 with a slow notification action
   (`O=false`, `P=true`, `C=true`). Click Trigger: no-op against optimistic? `O=false`, so it is
   a real dispatch: `O=true` (reducer replaces), types added, action awaited. The close
   notification resolves first: it is superseded, so no `setInternal(false)` (uncontrolled
   latest-dispatch guard). The open resolves: `setInternal(true)`, but `C` is already `true`
   (the close was never committed) → React commits with no state change; the apply effect runs
   (nothing in flight), sees `C=true` and `dialog.open=false` → `showModal()`. Net: the dialog
   re-opens when the user's second click settles, both actions were called, latest intent won.
   The superseded close's rejection, if any, is surfaced by the shared hook (conventions 2.4).
   The Trigger shows `data-open` and `data-pending` from the second click until the re-open
   commits (4.2). Variant: the close was an Escape during a `Dialog.Form` save. Both the
   notification and the re-open are entangled with the form's action; when the save settles the
   dialog opens (latest intent) and the Form's watcher does **not** close it again, because the
   dialog was closed since the submit (8.1). `openChangeAction` ran three times: open, close
   (`"dismiss"`), open.
9. **Pre-hydration click, then hydration.** Server HTML: Trigger with `command="show-modal"`,
   empty `<dialog>`. Click → native open, focus on the dialog element, page inert. Hydration:
   React warns about the `open` attribute (suppressed) → the Popup's mount effect finds
   `dialog.open && !C` → dispatch `true` with `{ reason: "platform", event: undefined }` → `O=true`,
   Trigger `data-open` + `data-pending` → action resolves → `C=true` → children mount into the
   open dialog; the apply effect sees `dialog.open` already true → nothing. Focus stays where
   the platform put it. If the parent refuses or the action rejects: after settle, `C=false`,
   `dialog.open=true` → `close()` (intent recorded as echo) → the dialog closes, focus returns to
   the Trigger, no notification dispatch.
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
    example's `setLast("discarded")`), not in the outer notification. What must **not** be
    written: any action that awaits the user's answer (an outer Close whose action returns a
    promise the confirm resolves, or that opens the confirm with `startTransition` and then
    awaits). React puts every transition started while an async action is pending into that
    action's lane, so the confirm never opens, or every transition in the app is held until the
    user answers (conventions 2.3 item 6; a characterisation test keeps this on record).

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

<Dialog.Root open={open} openChangeAction={(next) => { setOpen(next); }}>
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

<Dialog.Root defaultOpen={!user.sawWelcome} openChangeAction={rememberDismissed}>
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
    <Dialog.Root open={open} openChangeAction={(next) => setOpen(next)}>
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

### 13.1 jsdom facts (jsdom 30.1.3, the version `packages/ui` resolves)

Probed while designing (`memo/architect/dialog-notes.md`):

- `HTMLDialogElement` exists and `open` reflects the attribute, but **`show()`, `showModal()`,
  `close()`, `requestClose()`, `returnValue` and `closedBy` are all missing**.
- `:open` matches the attribute; `:modal` parses and never matches; no `toggle`, `beforetoggle`,
  `cancel` or `close` events are ever fired.
- No `CommandEvent`, no `commandForElement`: a click on `<button commandfor command>` does
  nothing. No close watcher: Escape does nothing.
- `form.method` reflects `"dialog"`; `submitter.formMethod` is undefined.

So the jsdom project needs a **dialog shim**, `src/__tests__/dialog-shim.ts`, loaded from
`vitest.setup.ts` next to the popover shim and installed only where `showModal` is missing:
`show()`, `showModal()` (sets `open`, marks the element modal in a `WeakSet`, dispatches
`beforetoggle` synchronously and queues `toggle`, runs a minimal focusing step: `[autofocus]`
descendant, else first `button, input, …`, else the dialog), `close(v)` (clears `open` and the
modal mark, sets `returnValue`, restores focus to the element focused at open, queues `close`),
`requestClose(v)` (dispatches a cancelable `cancel`, then `close(v)` unless prevented),
`returnValue`, `closedBy` **not** defined (so the flag's feature detection stays false and the JS
baseline is what jsdom tests), `matches(":modal")` overridden to the shim's mark, and a `submit`
listener that closes the dialog for `method="dialog"` forms (and for a submitter with
`formmethod="dialog"`, setting `returnValue` from the submitter's `value`). The shim **also
emulates invoker clicks**: a document-level `click` listener on `button[commandfor]` dispatches a
cancelable `CommandEvent`-shaped `command` event (`command`, `source`) on the target and, unless
prevented, runs `show-modal` / `request-close` / `close`, so tests click Triggers and Close parts
with `user-event` like a user would. Escape is driven by calling `dialog.requestClose()`
directly (no close watcher in jsdom). Exit animations: `getAnimations` is absent in jsdom; the shim
returns `[]` so the deferred-unmount path is a browser-mode test.

### 13.2 Coverage against conventions 10.1

"both" = `describe.each` over uncontrolled and controlled wrappers (controlled follows
update-on-success). Library mode unless stated.

| Row | Dialog tests (jsdom) |
| --- | --- |
| Roles and ARIA | Default elements `button[type=button][commandfor][command=show-modal]`, `dialog[id][aria-labelledby][aria-describedby][data-modal]`, `h2[id]`, `p[id]`, `button[command=request-close]`, `form[method=dialog]`; ids resolve; consumer `aria-describedby="x"` becomes `"x <id>"`; `modal={false}` renders no `command` and no `data-modal`; `experimental_closedBy` renders `closedby="closerequest"`, with `lightDismiss` `"any"`, and nothing without the flag; `role="alertdialog"` passes through; `open` is never rendered, also with `defaultOpen`. |
| Keyboard | Enter/Space on the Trigger (user-event clicks buttons) dispatches; Escape is **not** simulable (no close watcher): the dismiss path is tested through `requestClose()` and the non-modal `keydown` listener is tested with user-event Escape while focus is inside the dialog. |
| Sync action (both) | Trigger click → `openChangeAction(true, details)` with `details.event` the native `MouseEvent`, `reason: "activate"`, `returnValue: undefined`; `details.event.defaultPrevented` is true (the command was cancelled); disabled Trigger never dispatches; a click while optimistically open never dispatches; a `command` event with `command: "show-modal"` on the dialog is cancelled and dispatches with that event. |
| Async action (both) | `deferred()` open: `data-open` + `data-pending` on Trigger, `showModal` spy not called, children not rendered; resolve: `showModal` called once, children rendered, attributes gone. Close notification: `requestClose("x")` → `close` → `openChangeAction(false, { reason: "dismiss", returnValue: "x" })` after... (a `requestClose` from script is a dismiss; the `"activate"` label is asserted through a `command` event with `request-close` and through a `method="dialog"` submit); while pending the Trigger has `data-pending` and no `data-open`. |
| Rejection (both) | Open rejects: `ErrorCatcher` receives it, `showModal` never called, no `data-open`. Close notification rejects uncaught: the catcher above Root receives it and the whole component is replaced (no re-open to assert). Re-open is asserted where the component stays mounted: controlled parent refusing the close, and a controlled action that catches without adopting `false` → `showModal` called again once settled. Caught-inside variants commit. |
| Overlap | Walkthrough 11.8 with two `deferred()`s resolved out of order: `openChangeAction` called twice, final `showModal` call count and `data-open` match the latest dispatch. |
| Superseded rejection (both) | Older dispatch rejects after and while the newer is pending; `ErrorCatcher` gets it; the newer outcome unaffected. |
| Suspending content (both) | Popup children mount `<Suspender>` on open: `showModal` not called, Trigger pending, no fallback from the boundary above; resolve: `showModal` called, content present. `keepMounted`: Suspender mounts hidden at page render inside `<Activity>`. |
| Function props | `className` / `style` / `children` / `render` on every part receive the documented state; JS-free mode passes `open: false`, `pending: false`. |
| `render` element | `render={<dialog className="x" />}` keeps `id`, ARIA and the listeners; `render={<a href />}` on Trigger in library mode dispatches through the click handler and gets no `type`; a non-dialog element warns. |
| Post-await rule | Controlled parent updating after `await` inside `startTransition` end to end. |
| Directive | Every file under `src/dialog/` except `index.ts` begins with `"use client"`. |
| Platform path | Mount with the dialog's `open` attribute already set (pre-hydration open): one dispatch with `reason: "platform"`, `event: undefined`; parent accepts → children mount and `showModal` not called again; parent refuses → `close` called. Controlled `open` flipping `true`/`false` programmatically calls `showModal` / `close` and the resulting `close` event does **not** dispatch (echo). |
| Close part | Without `action`: `command="request-close"`, `value` rendered. With `action`: click is default-prevented, `data-pending` while the deferred action runs, `close(value)` called on resolve, not on reject (error in the catcher inside the dialog). |
| Close part, stale close | A `Dialog.Close` action pending; Escape closes the dialog; the Trigger re-opens it; the action resolves: `close` is not called on the new open (open-generation guard), the action ran once. A superseded click's rejection reaches the catcher (one row; it fails without the shared hook). |
| Form part | `method="dialog"` without `action`; with `action`: `method` absent, the action receives `FormData`, `close(submitterValue)` called after it settles (fake the status through a resolved `deferred()`), not called when it throws. `closeOnSettle`: a `useActionState` validation result closes by default; with `false` the dialog stays open showing the result and a `Dialog.Close` closes it. A close since the submit (Escape during the save, then a re-open through the Trigger) blocks the settle close: the dialog ends open, `close` not called again. `method="post"` is kept with a string `action` and replaced by `"dialog"` without one. |
| Light dismiss (baseline) | With `lightDismiss`: a `pointerdown` + `click` on the dialog with coordinates outside `getBoundingClientRect()` (mocked) calls `requestClose`; inside, on a descendant, or a `pointerdown` inside followed by a `click` outside (drag out) does not; without the prop nothing. Non-modal: document pointerdown + click outside closes; a click on the Trigger does not. |
| Focus | `initialFocus` ref/selector: the element has `autofocus=""` when `showModal` is called (spy inspects the DOM) and not afterwards; missing target warns. Opener removed: after `close`, if `activeElement` is inside the dialog the Trigger is focused when connected. |
| Mode guard | Changing Root from JS-free to library mode after mount warns; `transition` / `keepMounted={false}` in JS-free mode warn. |
| `transition` smoke | Popup renders with and without `transition`. **Browser:** a plain open calls `document.startViewTransition` zero times with `transition` absent **and** with `transition="none"` (the children mount under the `<dialog>`, which shields the boundary); a nested `Dialog.Root` mounted by a transition together with outer content, with `transition="none"` on its Popup, calls it once (conventions 10.1). |

### 13.3 Browser mode (`dialog.browser.test.tsx`, Chromium, Firefox, WebKit)

Only what jsdom cannot observe: a real `command="show-modal"` click opens the dialog modally in
JS-free mode and goes through the library in library mode (`details.event` is a `CommandEvent`
only for foreign invokers; the Trigger's own click is a `MouseEvent`); Escape closes and
`openChangeAction(false, { reason: "dismiss" })` fires; focus lands on the `initialFocus` target
through a deferred `showModal()` and returns to the Trigger on close; `aria-modal` is exposed;
nested dialogs need two Escapes; `closedby="any"` light dismiss with the flag where `closedBy`
exists and the JS fallback where it does not (branch on a feature check in `engine.ts`, assert
both); exit animation keeps the children mounted until `getAnimations()` settle in Chromium and
WebKit, and unmounts at once in Firefox (branch on whether `getAnimations()` is non-empty after
`close()`); the CSS scroll lock recipe; `<ViewTransition>` capture of the opening commit (the
unverified row of 10.3; the test may be marked expected-to-differ until confirmed).

---

## 14. Implementation notes

```
packages/ui/src/dialog/
  index.ts                 # no directive: namespace + type re-exports; imports platform-attributes for side effects
  dialog-context.ts        # "use client": DialogContext
  dialog-root.tsx          # "use client": useId, mode, useControllableAction, trigger element ref, context
  dialog-trigger.tsx       # "use client": button, commandfor/command, click interception
  dialog-popup.tsx         # "use client": <dialog>, native listeners, apply effect, mount reconciliation, exiting, Activity
  dialog-close.tsx         # "use client": button, request-close, optional action in its own transition
  dialog-form.tsx          # "use client": form, method=dialog or action + FormStatusWatcher
  dialog-title.tsx         # "use client"
  dialog-description.tsx   # "use client"
  dialog.test.tsx
  dialog.browser.test.tsx
packages/ui/src/__tests__/dialog-shim.ts   # section 13.1
```

- **Every part file is `"use client"`.** Trigger, Popup, Close, Form, Title and Description read
  context (ids, mode, dispatch); Root creates it. No directive-free part (same reasoning as
  Accordion 12 and Tooltip 2.4). The Directive test row lists all eight modules; `index.ts` is
  directive-free.
- **Context.** `{ mode: "static" | "library", ids: { dialog, title, description }, modal,
  committed, optimistic, pending, dispatch(next, details), latestInFlight, setTriggerElement,
  dialogRef (RefObject<HTMLDialogElement | null>), recordCloseIntent(intent | undefined),
  openGeneration() }`. `openGeneration` reads a counter the Root bumps on every open (3.4);
  `Dialog.Close` passes it to `useActionTrigger`.
  Root recomputes the object every render (as Accordion does; `dispatch` is new per render).
  `dialogRef` is how Close and Form reach the dialog element for `close(value)` without a second
  registry; it is set by the Popup's callback ref.
- **Mode detection** once, from the first render's props, in a `useState` initialiser; warn on
  change (Accordion pattern).
- **Root.** `useControllableAction<boolean, DialogOpenChangeDetails>({ controlled: open,
  defaultValue: defaultOpen, initialValue: false, action: openChangeAction, transitionTypes:
  (next) => transitionTypes("dialog", next ? "open" : "close"), warn: { component: "Dialog.Root",
  prop: "open" } })`. In static mode the hook is still called (hooks cannot be conditional) with
  `action: undefined` and never dispatched. The trigger element is kept in a `useRef`, written by
  the Trigger's callback ref (no state, read only in the `close` listener's focus fallback).
- **Trigger.** `libraryProps`: `type` via `rendersButton(render)`, `commandfor: modal ? dialogId
  : undefined`, `command: modal ? "show-modal" : undefined`, `onClick` installed (and owned) only
  when `mode === "library" || !modal`, `disabled` (owned), `data-open`, `data-pending`,
  `data-disabled`. `state.pending` is `root.pending` (4.2). Static non-modal click:
  `dialogRef.current?.show()`. The `disabled` prop maps to native `disabled`.
- **Popup, listeners.** All native, attached in one effect through the ref (conventions 7.4), each
  filtered on `event.target === dialog` (React still emulates bubbling for `toggle`, and `command`
  / `submit` bubble from descendants by design):
  - `command` (library mode): `show-modal` → `preventDefault()` + dispatch `true` with
    `reason: "activate"`; `request-close` / `close` → `recordCloseIntent({ reason: "activate",
    event })`. In static mode only the second branch runs.
  - `submit`: if `event.target.method === "dialog"` or `event.submitter?.formMethod === "dialog"`
    → record the `"activate"` intent with the submitter's `value`.
  - `beforetoggle` (synchronous): `newState === "closed"` → set `closingRef` (the re-open race
    guard, 2.5). No `cancel` listener: stale intents are cleared by the `setTimeout(0)` scheduled
    at `recordCloseIntent`, which clears only while the dialog is still open (2.3).
  - `close`: clear `closingRef`, focus fallback (6.2), exit detection (4.4), then in library mode
    `root.notifyClosed(details)`; in static mode nothing else.
  - `keydown` Escape (non-modal only, no `closedBy` support or flag off) → `preventDefault()` +
    `requestClose()`, unless the Escape belongs to an inner layer (section 9): walking from
    `event.target` up to the dialog finds an open `<dialog>` or an open `auto` / `hint` popover,
    or any `[popover]` inside the dialog is an open `auto` / `hint` one (`:popover-open`; the
    state is read through the `popover` IDL attribute so an engine that maps `hint` to `manual`
    is honoured, with the attribute as the fallback where the IDL is missing). Then the event is
    left untouched for the inner layer's close watcher.
  - `pointerdown` + `click` (`lightDismiss`, no native `closedby`): modal → both on the dialog
    with the point outside its rect (`::backdrop`) → `requestClose()` on the click; the
    `pointerdown` sets a `pressedOutside` flag the `click` consumes. Non-modal → document-level
    capture listeners for both while open, outside meaning "not inside the dialog and not inside
    the Trigger". They are installed and removed from a **native** `toggle` listener on the
    dialog (the React `onToggle` prop never fires after hydration, a native listener does),
    reading `dialog.open` rather than `newState` (coalescing rule) and guarding every decision
    on `dialog.open`, as the Tooltip effect does with `:popover-open`.
- **Popup, effects.** (1) Mount reconciliation layout effect (2.4), once. (2) The apply effect
  (2.5) after every commit. (3) `initialFocus` write inside (2) right before `show*()`, removal
  right after. (4) The listener effect above, re-subscribed when the element changes.
- **Popup, rendering.** `<dialog id … aria-labelledby aria-describedby closedby={flag ?
  (lightDismiss ? "any" : "closerequest") : undefined} data-modal
  suppressHydrationWarning>{content}</dialog>`, wrapped in `<ViewTransition default={transition}>`
  only when `isLibrary && transition !== undefined` (conventions 5.1), where `content` is: static mode → children; library `keepMounted` →
  `<Activity mode={committed || exiting ? "visible" : "hidden"}>{children}</Activity>`; library
  default → `committed || exiting ? children : null`. `closedby` is typed in `@types/react` 19.3 (research)
  and needs no augmentation; `commandfor` / `command` on the buttons are already in
  `platform-attributes.ts`.
- **Close.** `libraryProps`: `type`, `disabled` (owned), `commandfor: dialogId`,
  `command: "request-close"`, `value`, `onClick` only with `action`, `data-pending`,
  `data-disabled`. `const { pending, run } = useActionTrigger(root.openGeneration)` (conventions
  3.4; `src/internal/use-action-trigger.ts`, shared with `Popover.Close` and `Menu.Item`); the
  click runs `run(() => action(details), () => { recordCloseIntent({ reason: "activate", event });
  dialogRef.current?.close(value ?? ""); })`. Errors: the latest click's rejection takes React's
  route to the boundary; a superseded click's rejection is caught by the hook and thrown from
  the part's render (the gap recorded for v0 was closed by ac7064e). `then` is skipped when the
  open generation changed (the user dismissed and re-opened the dialog while the action ran;
  Menu review M2) and still runs after the part unmounted (a no-op on a closed dialog).
- **Form.** `libraryProps`: `method: action === undefined ? "dialog" : typeof action ===
  "string" ? method : undefined`, `action`. Renders `<form …>{resolvedChildren}<FormStatusWatcher
  /></form>` (the watcher only with a function `action`); the watcher is a `null`-rendering
  component that calls `useFormStatus()`, keeps the previous `pending` in a ref and, in an effect
  on `true → false`, calls the Form's `onSettled`, which returns early when `closeOnSettle` is
  `false`, when the dialog closed since the last `submit` (a `closedSinceSubmit` ref set by a
  `close` listener on `form.closest("dialog")` and reset by the capture `submit` listener), or
  when the dialog is not open, and otherwise records the intent and calls
  `close(submitterValue)`. The submitter's `value` comes from that native `submit` listener on
  the form (capture) set up in the same part. `DialogFormState.pending` is read by the watcher and lifted through a tiny context
  for the `className` / `children` functions of the Form itself (one extra render when pending
  changes; acceptable).
- **Title / Description.** `libraryProps: { id }`; `h2` / `p` defaults.
- **Dev warnings** (`useDevWarning`): mode change; `transition` / `keepMounted={false}` in static
  mode; wrong `tagName` behind `render`; no name on the dialog; `initialFocus` unresolved or
  outside the dialog; Trigger without a Popup (checked in the Trigger's effect through
  `document.getElementById(dialogId)`). A part rendered outside a `Dialog.Root` **throws** (no
  context), consistent with Tabs and Tooltip, rather than warning.
- **Implementation checks** (example app, all three engines; resolved: `getAnimations({ subtree:
  true })` lists `::backdrop` in Chromium, 4.4): the top-layer `<ViewTransition>` capture (10.3);
  that `setAttribute("autofocus")` immediately before `showModal()` is honoured
  by WebKit (research verified Chromium and Firefox only); that a `close` event fired for a
  removed dialog (unmount while open) is handled without touching a disconnected element.

---

## Review corrections (2026-10-17, from the Menu review)

From `memo/reviewer/menu.md` (review of #41 / #47, which moved the Close part onto the shared
hook); folded into the sections named.

| Item | Correction | Section |
| --- | --- | --- |
| M2 | `Dialog.Close` drops a stale close: the Root carries an open-generation counter (bumped on the open dispatch and on the Popup's native `beforetoggle` to open, synchronous inside `showModal()` / `show()`; `toggle` is queued and arrived too late, 03ab818) and the Close passes it to `useActionTrigger`, as `Popover.Close` does (02f2f42). Load-bearing for JS-free / native re-opens; in library mode React's entanglement already holds the re-open. | 3.4, 13.2, 14 |
| L2 | The Close part runs through the shared `useActionTrigger` (ac7064e); the superseded-rejection gap recorded for v0 is closed. | 3.4, 14 |

---

## Conventions feedback (applied 2026-10-16)

All eight items below were applied to `design/conventions.md`: `"dismiss"` in `ChangeReason`
and `details.returnValue` (2.2); per-direction ownership (3.5); observing the form channel and
the `Form` part (2.7, 1.1); `keepMounted` narrowing (3.7); `pending` on an owner without DOM
(4.3); `Dialog.Popup experimental_closedBy` (8); the Dialog `open` row (4.1); and the
part-cancelled-event note for the `preventDefault()` warning (2.3). Kept for the record:

1. **2.2 `reason` vocabulary: add `"dismiss"`.** "The user closed the component without acting
   on one of its parts: Escape, Android back, an assistive-technology dismiss gesture, light
   dismiss. `details.event` is the platform's `close` (or `toggle`) event." `"activate"` keeps
   its meaning (Trigger, Close, Form submit are parts). `"platform"` keeps its meaning (mount
   reconciliation; the browser, not the user). Without this value a dialog would have to label
   an Escape as `"platform"`, which misdescribes a user action, or as `"activate"`, which
   contradicts "acted on a trigger part". Popover and Menu will need the same value.
2. **3.5 browser-owned table: a third column.** Dialog's `open` is library-owned for the
   transition that opens it and browser-owned for the close. The table's two columns cannot
   express "awaited for `true`, a notification for `false`" on one prop. Suggested sentence
   under the table: "A state may be library-owned in one direction and browser-owned in the
   other (Dialog: open is a transition, close is a notification); the component doc says which,
   and the `xChangeAction` doc comment says so per value."
3. **2.7 form-level actions: `Dialog.Form`.** The part observes React's form channel
   (`useFormStatus`) to close the dialog after a successful action; it does not fold form pending
   into any control's `pending` and does not wrap the action. Suggest a sentence: "A part may
   *observe* the form channel to perform a platform side effect after a successful action
   (Dialog.Form closes the dialog); it never wraps the action and never reports form pending as
   its own `pending`." Also `Form` joins the part vocabulary table (1.1): "A form whose successful
   submission completes the component's interaction. Default `form`."
4. **3.7 `keepMounted` shape.** "Future content regions … reuse the prop unchanged" should allow
   narrowing the type: Dialog accepts `boolean` only, because `"until-found"` has no meaning
   inside a closed `display: none` dialog.
5. **4.3 `data-pending` on an owner without DOM.** Tooltip's Root had no action; Dialog's does.
   Suggest: "When the owner renders no element, `pending` is exposed through its `children`
   function and on the trigger part only."
6. **8 experimental table.** `experimental_closedby` moves from `Dialog.Root` to `Dialog.Popup`
   (the part that renders the attribute) and is spelled `experimental_closedBy` like
   `experimental_interestFor`.
7. **4.1 `open` row.** Add Dialog: Trigger emits optimistic `data-open` in library mode; the
   `<dialog>` emits none (`:open` / `:modal` are exact, 7.4). The row already says this for
   browser-owned popups; Dialog's Popup is the first part whose open is library-driven and yet
   emits no attribute, because the DOM attribute is written by the same commit.
8. **2.3 item 3, the `preventDefault()` note.** Dialog's Trigger `preventDefault()`s the click
   itself (to cancel the command), so `details.event.defaultPrevented` is already `true` when
   the consumer's sync prefix runs. Worth a sentence so the dev warning for "defaultPrevented
   after the prefix" is not applied to Dialog (or is keyed on a flag the part sets).

## Questions for the product owner (all nine accepted as recommended, issue #26 comment)

1. **`"dismiss"` reason** (feedback 1): approve the third value, or fold dismissals into
   `"platform"`? Recommendation: approve; `"platform"` should keep meaning "not the user".
   Accepted; now in conventions 2.2.
2. **No way to disable Escape in v0.** The platform allows one veto per activation, which is not
   an API. Options: ship nothing (recommended, documented), or an `experimental_closedBy="none"`
   value that works in Chromium and Firefox only and cannot be emulated in Safari.
3. **The library never renders the `open` attribute**, so a non-modal `defaultOpen` dialog and a
   JS-free non-modal dialog cannot start open in the server HTML. Accept for v0 (recommended;
   non-modal dialogs are the minority and the flash is one hydration), or allow `open` to be
   rendered for the non-modal initial render only, with the "remove by hand" caveat managed by
   never re-rendering it.
4. **`state.open` is `false` in JS-free mode** rather than `undefined` (Accordion chose
   `undefined` for the same situation). Recommendation: keep `false` here (the only reader is a
   `children` function that branches on a boolean) and accept the inconsistency, or align with
   Accordion.
5. **`lightDismiss` defaults to `false`** (Radix and Base UI default to outside-click dismissal).
   Recommendation: keep `false`; a modal with a form should not close on a stray click.
6. **`Dialog.Close action` and `Dialog.Form` both exist.** Either alone would do; both are
   proposed because one is the library's action-prop idiom and the other is the platform's
   form idiom. Drop one?
7. **Pre-hydration click in library mode opens an empty dialog** that fills in after hydration
   (2.4). Alternatives were a dead Trigger or always-rendered content. Confirm.
8. **Refused close re-opens the dialog** (2.3), by the conventions' re-apply rule. Confirm that
   consistency wins over "closed stays closed" (the alternative would make the controlled `open`
   prop lie after a dismiss).
9. **jsdom dialog shim** (13.1) is a second test shim next to the popover one; the alternative is
   to move most Dialog rows to browser mode, which is slower on three engines.
