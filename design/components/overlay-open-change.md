# Overlay open state: requests and facts (`openChangeAction` / `onOpenChange`)

Status: **accepted** (2026-11-24, GitHub issue #148; every open point decided by the user the
same day, conventions resolved question 45). **Implemented 2026-11-24** (branch
`feat/148-on-open-change`; probes and notes in `memo/developer/issue-148.md`). The conventions
sections of 12.2 are amended in place; the component designs carry a short "#148" amendment
that points here. One deviation from the sketch of section 11, recorded in conventions 3.4: the
optimistic passthrough stays the plain committed value and the epoch lives in the reducer's
closure, because an object passthrough defeated React's render bailout (an update loop with an
inline ref).

Scope: `Popover.Root`, `Menu.Root` (context menu and submenus included), `Combobox.Root`
(`open` only), `Dialog.Root`, and Toast's `closeAction`. Tooltip is covered to say what does not
change. One cross-component document instead of five amendments, because the change is one rule
applied to one shared hook (`internal/use-overlay-root.ts`); at acceptance each component design
gets a short amendment that points here (section 12).

Inputs: `docs/vision.md`; conventions 2.1, 2.2, 2.4, 2.6, 3.5, 5.1; the component designs;
`memo/architect/143-design-questions.md` (#147, #148); the user's decisions on issue #148
(2026-11-23 and 2026-11-24).

## Decisions at a glance

| # | Topic | Decision | Source |
| --- | --- | --- | --- |
| 1 | The rule | An **action** (`fooAction`) is a change the library can still roll back: called before the commit, in a transition, awaited, with pending and optimistic state. An **`on*` handler** reports a change the library cannot hold: synchronous, urgent, not awaited, no pending state. | user |
| 2 | Where the pair exists | Only on overlay Roots: Popover, Menu, Combobox (`open`), Dialog. `openChangeAction` for requests, `onOpenChange` for facts. | user |
| 3 | Controlled refusal | A controlled Root whose parent keeps `open={true}` after a fact **re-opens**. The prop and the DOM never disagree. | user |
| 4 | Uncontrolled fact | Committed `open` becomes `false` urgently, in the event. No `data-pending`, no view transition. | user |
| 5 | Form controls, Accordion | `reason: "platform"` dispatches stay actions. No form control gets a second prop. | user |
| 6 | Dev warning | `open` without `onOpenChange` warns. No runtime heuristic (section 9). | user |
| 7 | What a fact is, exactly | The `toggle` (closed) / `close` event of a hide **the library did not perform in its apply effect**: everything `notifyClosed` receives today. Channel and `reason` are independent (section 2.2). | architect |
| 8 | A fact while a request is in flight | The fact wins: it supersedes every request in flight (section 2.5). Dialog's "dismissal kept for a vetoed part close" machinery is deleted. | architect |
| 9 | **Every `on*` handler the library defines** | One library-wide rule: called synchronously, not awaited, no pending state; it may return a promise; a returned promise's rejection and a synchronous throw go to `reportError`; no dev warning for a returned promise. Covers `onOpenChange` (four Roots), Toast's `onClose` and the existing `onInputValueChange`, whose promise warning is removed (section 2.6). | user |
| 10 | Toast `closeAction` | Renamed `onClose`, under rule 9 (section 7). | user |
| 11 | A popup found open at hydration | Stays a request: `openChangeAction(true, { reason: "platform" })`, as today. `onOpenChange` only ever receives `false` (section 2.12). | user |
| 12 | Tooltip | No callback today, none added. If one is ever wanted it is `onOpenChange` only. | architect |

---

## 1. The rule

The rule, as written into conventions 2.1 / 2.6 at acceptance, and into principle 3 of
`docs/vision.md` (bc0512c), which replaced its old "one exception React forces" paragraph:

> A prop named `action` or `fooAction` is a **request**. The library calls it before the change
> is committed, inside a transition, and awaits it; the outcome decides the state. A rejection,
> or a controlled parent that does not adopt, rolls the UI back, so the change has pending and
> optimistic state.
>
> A prop named `onFoo` reports a **fact**: a change that had already happened when the library
> heard of it, and that the library could not have held. It is called synchronously in the
> event that reports it, outside any transition, and is not awaited. There is no pending or
> optimistic state for it: the DOM already holds the new value.
>
> The test: **if the callback rejects, or the parent ignores it, can the library put the UI back
> without the user noticing?** If yes, it is an action. If the change was performed by the
> browser in front of the user (a popup the user dismissed, a keystroke), it is a fact.

Three consequences that follow from the test, each decided by the user:

- `onInputValueChange` (Combobox) is no longer "the one exception": it is the first fact.
- A form reset, a find-in-page reveal and input before hydration on a **form control or an
  Accordion** stay actions (`reason: "platform"`). The browser changed the DOM first, but there
  the DOM is the optimistic state: the library restores it on a rejection or a refusal, cheaply
  and invisibly. Same shape as a click.
- A dismissed popup fails the test. The user saw it go away; showing it again is not a rollback
  anybody wants, so the library does not offer one in uncontrolled mode. (Controlled mode
  re-opens, decision 3, for a different reason: the prop is the truth.)

A new `on*` prop needs the component's design doc to show who performs the change and why the
library cannot hold it, and a conventions amendment (the gate of 2.1, reworded from "a
React-imposed urgency").

---

## 2. Shared semantics (Popover, Menu, Combobox, Dialog)

### 2.1 Props, before and after

The four Roots share this part of their props. `<C>` is the component.

| Prop | Before | After |
| --- | --- | --- |
| `open?: boolean` | Controlled open state. | Unchanged. |
| `defaultOpen?: boolean` | Initial state, uncontrolled. | Unchanged. |
| `openChangeAction?: ChangeAction<boolean, <C>OpenChangeDetails>` | Every change: awaited for opens and for closes a part asks for; a "notification" after a dismissal. | **Requests only**: opens, and closes a part asks for. Never called for a fact. Contract unchanged (transition, awaited, pending, optimistic, Error Boundary, veto in controlled mode). |
| `onOpenChange?: UrgentChangeHandler<boolean, <C>OpenChangeDetails>` | (none) | **New. Facts only**: the popup was closed without the library performing the close. Synchronous, urgent, not awaited. |

`<C>OpenChangeDetails` is one type for both props (`reason`, the virtual `event`, and Dialog's
`returnValue`), so one function can serve both:

```tsx
// Controlled: the same setter in both channels. In the action it is a transition update,
// in the handler an urgent one.
const [open, setOpen] = useState(false);
<Dialog.Root open={open} openChangeAction={setOpen} onOpenChange={setOpen}>

// Uncontrolled: load on open (a request), log dismissals (a fact).
<Popover.Root
  openChangeAction={async (open) => { if (open) await preloadFilters(); }}
  onOpenChange={(open, { reason }) => track("filters closed", reason)}
>

// Controlled, server-backed open; dismissals adopted at once.
<Popover.Root
  open={open}
  openChangeAction={async (next) => {
    if (next) await prefetchFilters();
    startTransition(() => setOpen(next)); // after an await: wrap (conventions 2.3 item 4)
  }}
  onOpenChange={setOpen}                  // never wrap this one (section 2.4)
>
```

Types (`internal/types.ts`):

```ts
/** A fact about a state: called synchronously in the event that reports it, outside any
 *  Transition, not awaited. A returned promise's rejection, or a synchronous throw, is passed
 *  to reportError (the rule for every `on*` handler, conventions 2.1). */
export type UrgentChangeHandler<T, Details extends ActionDetails = ActionDetails> = (next: T, details: Details) => void;
```

The type is the existing one; only its doc comment changes. `void` as the return type accepts a
function that returns a promise (a Server Function, an `async` arrow), which is intended.

Trade-off, stated: controlled mode now needs two props where it needed one. The two names
differ by a prefix and a suffix, and the difference is the whole point (one is asked, one is
told), but it is one more thing to learn. The dev warning of section 9 catches the omission.
In these four components `onOpenChange` is only ever called with `false` (2.12); the `boolean`
argument stays for the pair's symmetry (`onOpenChange={setOpen}`) and for a future fact that
opens.
Rejected: letting `onOpenChange` alone receive requests too when `openChangeAction` is absent
(a second meaning for the name), and a combined `openChange` prop (no name left to say which
lane it runs in).

### 2.2 What is a fact, exactly

**A fact is the platform event (`toggle` with `newState: "closed"` on a popover, `close` on a
dialog) of a hide that the library did not perform in its apply effect.** That is precisely the
set of calls `notifyClosed` receives today (two call sites: `use-popover-popup.ts`,
`dialog-popup.tsx`), so the split needs no new classification code. It includes hides the
library *triggers* but cannot hold, because holding them would leave a popup on screen that the
user has already left: Menu's Tab-out, right-click outside and scroll close, Combobox's
focus-leaving close, the lost-interest hide, Dialog's JS Escape and light dismiss.

Everything dispatched through `requestOpen` / `requestClose` today stays a request.

**Channel and `reason` are independent.** The channel says whether the library held the change;
`reason` (conventions 2.2, vocabulary unchanged) says what the user did. Most facts are
`"dismiss"` and most requests `"activate"`; `"platform"` is always a request (2.12). The
crossovers:

| Channel | `reason` | Where |
| --- | --- | --- |
| `onOpenChange` | `"activate"` | A consumer's own invoker button (`popovertarget`, `commandfor` with a popover command) closes a popover, menu or listbox: the user acted on a button, the browser performed the hide (#125). A non-button Trigger pressed while open (#115). |
| `openChangeAction` | `"dismiss"` | A close the library does hold although no part asked: the pointer leaving a hover-opened submenu (`menu-hover.ts`), lost interest while an interest open is still pending (nothing is shown yet; the `false` supersedes the open). |

`onOpenChange` is never called for a change the consumer made through the `open` prop, for the
library's own hide after a request, or for the library's re-open of a refused fact.

### 2.3 Uncontrolled: what a fact does

In the platform event's listener, in this order, all in one batch:

1. The existing bookkeeping: clear `awaitingClose`, consume the close intent, read the exit
   animations and set `held` if there is a CSS exit (popover.md 4.4, unchanged).
2. Supersede the requests in flight (section 2.5).
3. Write committed `open = false` with a plain `setState`: **urgent**.
4. Call `onOpenChange(false, details)` synchronously.

One urgent commit follows. In it the Trigger loses `data-open`, the Popup's children unmount
(or stay for the CSS exit while `held`), and nothing is pending. No transition is started, so
no view transition runs and no `fsui-<component>-close` type is added. An unrelated async
action that is pending somewhere in the app does not delay any of this (today it delays the
committed state, because the notification commit is entangled with it: conventions 2.3 item 5).

### 2.4 Controlled: what a fact does, and the re-open

Steps 1, 2 and 4 are the same; step 3 is the parent's:

```tsx
<Dialog.Root open={open} openChangeAction={setOpen} onOpenChange={setOpen}>
```

`setOpen(false)` inside the handler is an urgent update, batched with the library's own
bookkeeping into the same commit; committed `open` is `false` in it and the DOM agrees.

**A parent that keeps `open={true}`** (decision 3): the commit that follows the event renders
`open={true}` over a hidden popup, and the apply effect, which already re-applies the prop to
the DOM after every commit, shows it again (`showPopover({ source })` / `showModal()`).

- The library forces that commit itself (an urgent internal state write in step 2), so the
  re-open does not depend on the parent re-rendering.
- It happens in the task of the `toggle` / `close` event: the popup was hidden for the time
  between the browser's hide and that event (about one task; a frame may paint). Today it stays
  hidden until the notification action settles; the re-open is now immediate.
- It is a fresh show: a new open generation, the CSS enter (`@starting-style`) runs, but **no
  initial focus of the library's own** (#155, user decision 2026-11-24): focus stays where the
  dismissal put it (the Trigger after Escape, the next tab stop after a Tab-out), so an
  un-migrated controlled Menu cannot trap the keyboard (review-148 L3). `usePopoverPopup` keeps a
  `refusedFact` flag: set when a fact hides the popup, cleared by any commit with `committed`
  false (the fact adopted), consumed by the next show. Not for a `<dialog>` popup (Popover's
  default, Dialog): the browser's dialog focusing steps run on every `showPopover()` /
  `show()` / `showModal()` whatever the library does, so the library still names its
  `initialFocus` target there (a modal dialog must hold focus; a Popover does not close on Tab,
  so it is no trap). One consequence for a `<dialog popover>`: re-opened after a refused click
  outside, it takes focus back from the element the user clicked (#156 asks whether to return
  focus there instead, a `.focus()` against design 6.1); with a CSS exit in flight the
  browser reverses it. The children were never unmounted (committed never left `true`), so
  their state is kept.
- No callback is called for the re-open: the parent was told `false` and chose `true`.
- No view transition (the commit is urgent).
- While a request is in flight the apply effect waits, as it does today, and re-opens when it
  settled (section 2.5).

This is still **not a veto**: the user sees the popup go and come back. A popup that must not
be dismissed is configured on the platform side (Dialog without `lightDismiss`,
`experimental_closedBy="none"`), and docs keep saying "adopt a fact's `false`".

**The handler must write state directly.** `onOpenChange={(o) => startTransition(() =>
setOpen(o))}`, or a `setOpen` after an `await`, leaves `open={true}` in the event's own commit:
the popup is re-opened and then closed again when the late update lands. This is the mistake
the library's own "wrap it in `startTransition`" advice (conventions 2.3 item 4) invites, so
the docs of every Root say it next to the prop. No warning can catch it reliably (section 9),
so the sentence in the docs is the whole defence.

A controlled parent's own later updates are its own: if a request that was in flight when the
fact arrived calls `setOpen(true)` after its `await`, the parent has set `open={true}` and the
popup opens. Controlled state is the parent's; the library does not filter it.

### 2.5 A fact while a request is in flight

Three situations exist; a fact cannot arrive while an open is pending and nothing is shown
(there is nothing to hide; a cause that arrives then, like lost interest, is a superseding
request as today).

| In flight when the fact arrives | Today | After |
| --- | --- | --- |
| A part's close (`openChangeAction(false)` awaited, popup still shown), then Escape | The dismissal is not dispatched (`false` is already intended). Dialog stores it and sends it only if the parent later vetoes the part's close (dialog.md 2.3, 11.13). | `onOpenChange(false, { reason: "dismiss" })` at once. Uncontrolled: committed `false` now. The request keeps running; its outcome no longer decides anything. Both callbacks were called: the consumer was asked, then told. |
| A Close part's own `action` (the Close's transition; no Root request yet), then Escape | Notification dispatched; the Close's continuation finds `false` intended and requests nothing. | The fact, at once. The continuation's `requestClose` is a no-op as today, so `openChangeAction(false)` is never called for this close. |
| Trigger clicked twice while shown (close requested, then open requested again; the popup never hid), then Escape | The notification is a third dispatch and wins as the latest. | The fact wins: the pending open request must not show the popup again when it resolves. |

Rule: **a fact supersedes every request in flight on that Root.** In
`useControllableAction` terms (new method, section 11):

- the latest-dispatch counter advances, so no dispatch in flight commits uncontrolled state;
- the in-flight intent becomes the fact's value, so `intended()` is `false` and the next
  Trigger click is an open;
- optimistic patches older than the fact are dropped, so the Trigger does not keep `data-open`
  for a hidden popup while a superseded action is still running;
- a superseded request that later **rejects** goes to `reportError`, not to the Error Boundary
  (conventions 2.4: it is no longer the latest intent). Its resolution changes nothing.

One honest leftover: React's `isPending` stays `true` until the superseded action settles, so
the Trigger shows `data-pending` (without `data-open`) for that time. It reports the request
that is still running, not the dismissal; a dismissal by itself never produces `data-pending`.

Controlled mode, same situations: the handler is called at once, the parent adopts urgently.
If the parent keeps `open={true}`, the re-open waits until nothing is in flight, as the apply
effect does for every re-application today.

### 2.6 The handler's contract: the rule for every `on*` handler

User decision (2026-11-24): one rule for **every `on*` handler the library defines**, written
into conventions 2.1. "Consistency and simplicity are very important."

- Called **synchronously** in the event that reports the fact, outside any transition. A
  `setState` in its body is urgent.
- **Not awaited.** Nothing is pending or optimistic for it.
- **It may return a promise.** The library attaches a rejection handler that calls
  `reportError`. A synchronous throw is caught and passed to `reportError` too, so the
  library's own bookkeeping after the call still runs. Nothing reaches an Error Boundary: there
  is no render to throw from and nothing to roll back.
- **No dev warning for a returned promise.**

The handlers it covers (the complete list; a search of the public props found no other `on*`
prop that is not a DOM pass-through):

| Handler | Type | Change |
| --- | --- | --- |
| `Popover.Root`, `Menu.Root`, `Combobox.Root`, `Dialog.Root`: `onOpenChange` | `UrgentChangeHandler<boolean, <C>OpenChangeDetails>` | new |
| `toast({ onClose })` (`ToastOptions`) | `UrgentHandler<ToastCloseDetails>` | renamed from `closeAction` (section 7) |
| `Combobox.Root`: `onInputValueChange` | `UrgentChangeHandler<string, ComboboxInputValueChangeDetails>` | **its "returned a promise" dev warning is removed**; a rejection or a throw now goes to `reportError` (before: an unhandled rejection; a throw propagated out of the `input` listener) |

Specific to `onOpenChange`: called once per fact with `(next, details)`; `details.event` is
the platform event (or the recorded cause: the `CommandEvent`, the `loseinterest` event, the
`click`).

One shared helper implements the rule (`internal/call-urgent-handler.ts`, section 11), so the
three call sites cannot drift.

### 2.7 What each surface shows after a dismissal

Uncontrolled, or controlled with an adopting parent. "Fact commit" is the urgent commit of the
`toggle` / `close` task.

| Surface | Reads | Before | After |
| --- | --- | --- | --- |
| Popup visibility, `:popover-open` / `:open` | DOM | hidden at once by the browser | same |
| Exposed expanded state: the browser's own on a `popovertarget` Trigger (#121); `aria-expanded` on a non-button Trigger and on `Combobox.Input` (the urgent `shown` mirror, #118) | DOM / `shown` | `false` in the `toggle` task | same |
| Trigger `data-open`, `state.open` on Root / Trigger (Menu: `ContextTrigger` and `SubmenuTrigger` too; Combobox: Input and Trigger) | optimistic | removed when the notification is dispatched | removed in the fact commit (the same moment) |
| Committed `open`: Popup `state.open`, children mounted | committed | `true` until the notification action settled and its transition committed; later still while any async action is pending in the app | `false` in the fact commit |
| Trigger `data-pending`, Root `state.pending` | Root transition | present while the notification action runs | **absent** (except for a superseded request still running, 2.5) |
| Popup children | committed, `held` | unmount at the notification commit, or after the CSS exit | unmount in the fact commit, or after the CSS exit (`held`, unchanged) |
| View transition | transition commit | the notification commit starts one, with `fsui-<c>-close` | **none**, no type |
| A rejection | | Error Boundary above Root, for a popup that is already gone | `reportError` (a returned promise) |

### 2.8 View transitions and the `transition` prop

The `transition` prop of the Popup parts is unchanged in shape and meaning. What it animates:

| Change | Lane | `<ViewTransition>` |
| --- | --- | --- |
| Open through a request; content swap while open | transition, `fsui-<c>-open` | yes |
| Close through a request (Trigger, Close, item, Form) | transition, `fsui-<c>-close` | yes, in every engine |
| Controlled close (the parent sets `open={false}` in a transition) | the parent's transition, no library type | yes |
| **A fact** (dismissal), adopted or uncontrolled | urgent | **never**. CSS exit only (`@starting-style` / `allow-discrete`; none in Firefox) |
| Re-open of a refused fact | urgent | never. CSS enter |
| `held` release after a CSS exit | urgent | never (unchanged) |

So the split is by who performs the change: the view transition animates what the library does,
CSS animates what the browser does. A dismissal with `transition` set and no CSS exit used to
start a view transition that had nothing to show; it now starts none. Section 10 has the
consequence for #147.

### 2.9 Errors

| Case | Before | After |
| --- | --- | --- |
| `openChangeAction(true)` rejects | boundary; nothing shown | unchanged |
| A part's `openChangeAction(false)` rejects | boundary; popup still open | unchanged |
| The callback for a dismissal rejects | boundary above Root, which unmounts the component | `onOpenChange`: `reportError`; the UI is untouched |
| Controlled veto of an open, or of a part's close | snap-back | unchanged |
| Controlled refusal of a fact | re-open after the action settles | re-open at once (2.4) |
| A request in flight, superseded by a fact, rejects | n/a (the notification was a dispatch) | `reportError` (2.5) |

### 2.10 Server Functions

`details` stays serialisable with a virtual `event` (conventions 2.2), for both props.

- A Server Function passed to `openChangeAction` hears **requests only**. It no longer hears
  Escape or a click outside. This is the main behavioural loss of the change.
- A Server Function may be passed to `onOpenChange`, also from a Server Component. It is called
  from the event and not awaited; nothing shows pending; a rejection goes to `reportError`
  (2.6). This is what the "may return a promise" half of the rule buys: without it, "remember
  that the welcome dialog was dismissed" (dialog.md 12.4) would need a Client Component
  wrapper.

```tsx
// Server Component (dialog.md 12.4, after). A Close button is a request, Escape is a fact:
// to hear both, pass both.
<Dialog.Root defaultOpen={!user.sawWelcome} openChangeAction={rememberDismissed} onOpenChange={rememberDismissed}>
```

To verify at implementation (not probed): that the RSC frameworks in use accept a Server
Function call made outside a transition without a warning (it is a plain `callServer` call;
Next.js wraps the call in its own transition).

### 2.11 JS-free mode

Popover and Dialog select JS-free mode when the Root has **none of** `open`, `defaultOpen`,
`openChangeAction`, `onOpenChange` (one prop added to the test; the mode-switch dev warning
names four props). JS-free mode itself is unchanged: the browser owns every open and close, no
callback exists, the CSS exit is the only animation.

A Root with only `onOpenChange` is an uncontrolled library-mode Root. Rejected: a "JS-free plus
listener" mode (the browser owns the state, the handler only observes). It would be a third
mode with its own rules for `data-open` and content mounting, for a need `toggle` on a `ref`
already covers.

Menu and Combobox have no JS-free mode; nothing changes there.

### 2.12 A popup found open at hydration: a request, unchanged

Library mode renders the native invoker markup, so a click before hydration opens the popup
natively and empty; at mount the Popup finds it open with committed `false` (popover.md 2.4,
dialog.md 2.4) and dispatches `openChangeAction(true, { reason: "platform", event: undefined
})` in the Root's transition. The content mounts when it settles; a rejection or a refusing
parent hides the popup. **This stays exactly as it is** (user decision, 2026-11-24).

Why it is a request although the browser opened the popup first: it passes the rule's test. The
library can roll it back (it hides an empty popup), and the DOM is the optimistic state, which
is the reasoning that keeps pre-hydration input on form controls an action (decision 5). Every
open then goes through one channel, so load-on-open code in the action runs for all of them,
and Suspense and pending state behave as for any open.

Consequence: **`onOpenChange` is only ever called with `false`** in the four overlays.

History: the first draft of this document specified it as a fact (`onOpenChange(true, {
reason: "platform" })`) and offered this as the alternative. The fact version skipped the
action's load-on-open code, needed a transition for the uncontrolled write anyway (an urgent
mount of suspending content shows the nearest Suspense fallback), and made a controlled parent
wrap `setOpen(true)` while it must not wrap `setOpen(false)`.

---

## 3. Popover

### 3.1 Root props

| Prop | Before | After |
| --- | --- | --- |
| `open`, `defaultOpen`, `children` | | unchanged |
| `openChangeAction` | `ChangeAction<boolean, PopoverOpenChangeDetails>`: awaited for `true` and for a part's `false`; a notification for a dismissal | same type; **requests only** |
| `onOpenChange` | | **new**: `UrgentChangeHandler<boolean, PopoverOpenChangeDetails>` |

`PopoverOpenChangeDetails` (`{ reason: ChangeReason }` plus the virtual `event`),
`PopoverRootState` (`open` optimistic, `pending`) and every other part's props are unchanged.

### 3.2 Which event goes where

| Cause | Channel | `next` | `reason` | `details.event` |
| --- | --- | --- | --- | --- |
| Trigger click while closed | `openChangeAction` | `true` | `"activate"` | `click` |
| A foreign open: a consumer's invoker button, script `showPopover()`, interest (cancelled at `beforetoggle`, routed through the library) | `openChangeAction` | `true` | `"activate"` | `beforetoggle` `ToggleEvent` |
| `<button>` Trigger click while open | `openChangeAction` | `false` | `"activate"` | `click` |
| `Popover.Close`, after its own `action` if it has one | `openChangeAction` | `false` | `"activate"` | `click` |
| Lost interest while the interest open is still pending (#127) | `openChangeAction` | `false` | `"dismiss"` | `loseinterest` |
| Found open at hydration (2.12; unchanged) | `openChangeAction` | `true` | `"platform"` | `undefined` |
| Escape, Android back, an assistive-technology dismiss | **`onOpenChange`** | `false` | `"dismiss"` | `toggle` `ToggleEvent` |
| Light dismiss (click outside) | **`onOpenChange`** | `false` | `"dismiss"` | `toggle` |
| Another `auto` popover or a modal dialog opening outside the stack; a parent popover closing | **`onOpenChange`** | `false` | `"dismiss"` | `toggle` |
| Script `hidePopover()` | **`onOpenChange`** | `false` | `"dismiss"` | `toggle` |
| A foreign `hide-popover` / `toggle-popover` `commandfor` button | **`onOpenChange`** | `false` | `"activate"` | `CommandEvent` |
| A foreign `popovertarget` button (#125) | **`onOpenChange`** | `false` | `"activate"` | `beforetoggle` `ToggleEvent` (`source` is the button) |
| Lost interest after an interest open, popup shown (#127; the library's `hidePopover()` by proxy) | **`onOpenChange`** | `false` | `"dismiss"` | `loseinterest` |
| A non-button Trigger (`render={<a />}`) pressed while open (#115: light dismiss hides it at `pointerup`, before the `click`) | **`onOpenChange`** | `false` | `"activate"` | `click` |
| Controlled `open` changed by the parent; the library's re-open of a refused fact; removal from the document | none | | | |

The #115 row changes mechanism: today the `click` dispatches `(false, "activate")` as a request
for a popup that is already hidden. After: when the Trigger's click finds `true` intended but
the popup no longer `:popover-open`, it records an `"activate"` close intent with the click and
dispatches nothing; the pending `toggle` reports the fact. Reason and event are as today. The
existing browser row for #115 pins it.

### 3.3 Behaviour

Uncontrolled and controlled: sections 2.3 to 2.5. `data-open`, `data-pending`, the exposed
expanded state: 2.7. View transitions: 2.8. Nesting: an outside click closes the whole stack
and each Root gets its own `onOpenChange(false, { reason: "dismiss" })`; Escape closes the
innermost only. Focus return (popover.md 6.2) is untouched: it is driven by the `toggle`
listener, not by the dispatch.

Walkthroughs to rewrite at acceptance: popover.md 11 (every row that ends in "notification"),
4.3 ("Dismissal notification rejects" becomes one line: `reportError`), 2.3 ("A controlled
parent that refuses a dismissal": immediate re-open), 12.3 and 12.4 (controlled examples gain
`onOpenChange={setOpen}`).

---

## 4. Menu (context menu and submenus included)

### 4.1 Root props

| Prop | Before | After |
| --- | --- | --- |
| `open`, `defaultOpen`, `loop`, `delay`, `closeDelay`, `children` | | unchanged |
| `openChangeAction` | `ChangeAction<boolean, MenuOpenChangeDetails>`: awaited for `true` and for part closes; a notification for dismissals | same type; **requests only** |
| `onOpenChange` | | **new**: `UrgentChangeHandler<boolean, MenuOpenChangeDetails>` |

The same two props on every `Menu.Root`: the top-level one, a context-menu Root
(context-menu.md 3.1 adds nothing), and each submenu Root.

### 4.2 Which event goes where

| Cause | Channel | `next` | `reason` |
| --- | --- | --- | --- |
| Trigger click, Enter / Space / ArrowDown / ArrowUp on the Trigger, while closed | `openChangeAction` | `true` | `"activate"` |
| `ContextTrigger`: `contextmenu`, long-press, Shift+F10 / the Menu key (context-menu.md 2) | `openChangeAction` | `true` | `"activate"` |
| `SubmenuTrigger`: click, ArrowRight, Enter, hover after `delay` | `openChangeAction` (the submenu's Root) | `true` | `"activate"` |
| A foreign open (invoker button, script) | `openChangeAction` | `true` | `"activate"` |
| Found open at hydration (2.12; unchanged) | `openChangeAction` | `true` | `"platform"` |
| Item activation with `closeOnActivate`, after the item's `action` | `openChangeAction` (the **root** Root) | `false` | `"activate"` |
| Trigger click while open (#110) | `openChangeAction` | `false` | `"activate"` |
| ArrowLeft in a submenu | `openChangeAction` (that submenu's Root) | `false` | `"activate"` |
| The pointer leaving a hover-opened submenu, after `closeDelay` (held by the library today, `menu-hover.ts`; unchanged) | `openChangeAction` (that submenu's Root) | `false` | `"dismiss"` |
| Escape (the innermost menu) | **`onOpenChange`** | `false` | `"dismiss"` |
| Light dismiss; another `auto` popover or modal dialog opening outside | **`onOpenChange`** (every Root of the stack) | `false` | `"dismiss"` |
| Tab / Shift+Tab, focus leaving the menu tree (the library's immediate `hidePopover()`) | **`onOpenChange`** | `false` | `"dismiss"` |
| Right-click or middle-button press outside the tree (#45) | **`onOpenChange`** | `false` | `"dismiss"` |
| Context menu placed at a point: scroll of the document or an ancestor; captured-pointer release outside (context-menu.md 5) | **`onOpenChange`** | `false` | `"dismiss"` |
| A submenu hidden because its parent menu closed, whatever closed the parent (also a request on the root: item activation) | **`onOpenChange`** (the submenu's Root) | `false` | `"dismiss"` |
| A foreign invoker button closing the root popup (#125, #126) | **`onOpenChange`** | `false` | `"activate"` |
| Script `hidePopover()` | **`onOpenChange`** | `false` | `"dismiss"` |
| A context-menu **move** (right-click inside the region while open, context-menu.md 4.3); controlled prop change; re-open of a refused fact | none | | |

### 4.3 Behaviour

Sections 2.3 to 2.9 apply to each Root independently. Notes specific to Menu:

- **An item's action is pending and the user presses Escape.** The fact closes the menu at
  once. Uncontrolled: committed `false`; the items unmount (after the CSS exit, `held`). The
  item's action keeps running in the item's own transition; its continuation finds the menu
  closed (open-generation guard) and requests nothing; its rejection follows the existing
  "owner left" rule (`reportError`, conventions 2.4, #152).
- **Item activation closes a root with open submenus.** One request on the root Root
  (`openChangeAction(false, "activate")`); when the root popup hides in its commit, each submenu
  Root gets `onOpenChange(false, { reason: "dismiss" })` from its own `toggle`. Today those are
  `openChangeAction` notifications. A controlled submenu Root needs `onOpenChange` like any
  other controlled Root (the library would otherwise try to show it again under a hidden
  parent); the warning of section 9 covers it.
- `ContextTrigger` and `SubmenuTrigger` render optimistic `data-open` and the Root's
  `data-pending` like the Trigger: both follow 2.7. `data-context` on the Popup keeps its own
  rule (until the popup is hidden and its exit is over).
- `aria-expanded` on a `SubmenuTrigger` (a `menuitem`, not an invoker button) is the `shown`
  mirror: unchanged.
- `CheckboxItem` / `RadioItem` state (`checkedChangeAction`, `valueChangeAction`) is not open
  state and is untouched: actions.

---

## 5. Combobox

### 5.1 Root props (open state only)

| Prop | Before | After |
| --- | --- | --- |
| `open`, `defaultOpen` | | unchanged |
| `openChangeAction` | `ChangeAction<boolean, ComboboxOpenChangeDetails>`: every change | same type; **requests only** |
| `onOpenChange` | | **new**: `UrgentChangeHandler<boolean, ComboboxOpenChangeDetails>` |
| `value` / `defaultValue` / `valueChangeAction` | | unchanged: an action |
| `inputValue` / `defaultInputValue` / `onInputValueChange` | the "one exception"; a returned promise is a dev warning | reclassified as a fact (the keystroke is in the DOM first); under the rule of 2.6 the promise warning is removed and a rejection or a throw goes to `reportError` |

After the change the Root has three states in three shapes, each for a stated reason: `value`
(requests only: nothing but the library changes it), `inputValue` (facts only: the browser
writes every keystroke), `open` (both: parts ask, the browser dismisses).

### 5.2 Which event goes where

| Cause | Channel | `next` | `reason` |
| --- | --- | --- | --- |
| Typing; ArrowDown / ArrowUp / Alt+ArrowDown while closed; Trigger click while closed; a pointer click in the input with `openOnClick`; a foreign open | `openChangeAction` | `true` | `"activate"` |
| Found open at mount (2.12; only script can cause it here; unchanged) | `openChangeAction` | `true` | `"platform"` |
| The close after an accepted option (after `valueChangeAction` settled); re-accepting the selected option; Trigger click while open (#112); Alt+ArrowUp | `openChangeAction` | `false` | `"activate"` |
| Escape while open | **`onOpenChange`** | `false` | `"dismiss"` |
| Focus leaving the input to outside the popup (the library's immediate `hidePopover()`) | **`onOpenChange`** | `false` | `"dismiss"` |
| Light dismiss; another `auto` popover or modal dialog opening outside; a `Clear` click while open (the button is outside the popup) | **`onOpenChange`** | `false` | `"dismiss"` |
| A foreign invoker button closing the listbox (#126) | **`onOpenChange`** | `false` | `"activate"` |
| Script `hidePopover()` | **`onOpenChange`** | `false` | `"dismiss"` |

### 5.3 Behaviour

- What a close *also does* is unchanged and stays on its own channel: the text revert or the
  custom-value commit after focus leaves (`valueChangeAction`, an action, combobox.md 5.3), the
  `Clear` dispatch of `null`.
- **An accepted option's `valueChangeAction` is pending and the user presses Escape.** The fact
  closes the listbox at once (`onOpenChange`). The value action is a different state: it is not
  superseded, keeps `data-pending` on the option's owner and commits or rolls back as today;
  its continuation requests no close (nothing is open; open-generation guard).
- `aria-expanded` on the Input is the `shown` mirror (#118): unchanged. `data-open` on Input
  and Trigger is optimistic: 2.7.
- Controlled `open` with a refusing parent: the listbox re-opens at once after Escape, with the
  input still focused. Controlled `open` on a Combobox is rare; the docs example gets
  `onOpenChange={setOpen}`.

---

## 6. Dialog

### 6.1 Root props

| Prop | Before | After |
| --- | --- | --- |
| `open`, `defaultOpen`, `modal`, `children` | | unchanged |
| `openChangeAction` | `ChangeAction<boolean, DialogOpenChangeDetails>`: awaited for `true` and for a part's `false`; a notification for a dismissal | same type; **requests only** |
| `onOpenChange` | | **new**: `UrgentChangeHandler<boolean, DialogOpenChangeDetails>` |

`DialogOpenChangeDetails` keeps `reason` and `returnValue` on both channels: for a fact,
`returnValue` is `dialog.returnValue` as the browser left it (`""` for Escape).

### 6.2 Which event goes where

| Cause | Channel | `next` | `reason` | `returnValue` |
| --- | --- | --- | --- | --- |
| Trigger click; a foreign `show-modal` command (cancelled, routed) | `openChangeAction` | `true` | `"activate"` | `undefined` |
| Found open at hydration (2.12; unchanged) | `openChangeAction` | `true` | `"platform"` | `undefined` |
| `Dialog.Close`, after its own `action` if it has one | `openChangeAction` | `false` | `"activate"` | the Close's `value` |
| `Dialog.Form` without a function `action`, or any `method="dialog"` submit inside the Popup | `openChangeAction` | `false` | `"activate"` | the submitter's `value` |
| `Dialog.Form` with a function `action`, when it settled (`closeOnSettle`) | `openChangeAction` | `false` | `"activate"` | the submitter's `value` |
| A foreign `request-close` / `close` command (cancelled, routed) | `openChangeAction` | `false` | `"activate"` | the invoker's `value` |
| Escape, Android back, an assistive-technology dismiss (the platform's close request; the JS `keydown` baseline of a non-modal dialog) | **`onOpenChange`** | `false` | `"dismiss"` | `""` |
| Light dismiss: `lightDismiss` (JS baseline or native `closedby="any"`), including a Trigger click on an open non-modal `lightDismiss` dialog (#116) | **`onOpenChange`** | `false` | `"dismiss"` | `""` |
| Script `dialog.close(v)` / `requestClose(v)`; `form.submit()` on a `method="dialog"` form | **`onOpenChange`** | `false` | `"dismiss"` | `dialog.returnValue` |
| Controlled prop change; re-open of a refused fact; removal from the document (no `close` event) | none | | | |

`cancel` stays the consumer's pass-through hook for the platform's close request, with the
platform's once-per-activation rule; nothing about it changes.

### 6.3 Behaviour

Sections 2.3 to 2.9, with `close` in place of `toggle` and `showModal()` / `show()` for the
re-open (focus moves back into the dialog by the dialog focusing steps). Dialog-specific:

- **Deleted: the stored dismissal** (`dismissedWhilePending`, dialog.md 2.3 and walkthrough
  11.13). It existed because a dismissal during a pending part close could not be dispatched
  ("one `openChangeAction(false)`, not two") and had to survive a veto of the part's close. A
  fact is now reported the moment it happens (2.5), so there is nothing to store. The pending
  part `returnValue` is still dropped when the browser closes first.
- **The echo is recognised by its source**, as today (`libraryClose`). Popover's echo check
  moves from "`false` is already intended" to the same kind of marker (section 11), because "a
  fact during a pending part close" must now be reported and not mistaken for an echo.
- `Dialog.Form` (`closeOnSettle`, `closedSinceSubmit`): unchanged; a dismissal while the form
  action runs is a fact, and the settle then finds the dialog closed, as today.
- JS-free mode (2.11) and non-modal dialogs (never JS-free, dialog.md 2.6): no change beyond
  the channel.
- dialog.md 4.3 loses "Dismissal notification rejects" (now: `reportError`); 4.2's "close
  notification pending → Trigger pending" and "re-open while a close notification is still
  pending" rows disappear with the notification.

---

## 7. Toast: `closeAction` becomes `onClose`

User decision (2026-11-24): option (c) of the first draft. `closeAction` is renamed `onClose`
and follows the rule of 2.6.

### Why

`toast({ closeAction })` was called once when a toast leaves, with `ToastCloseDetails` (`id`,
`reason`: `"activate"` when its Action settled, `"dismiss"` for `Toast.Close` / Escape /
`toast.dismiss()`, `"timeout"`). The queue write that removes the toast is urgent by design
(conventions 2.6), so the toast is already leaving; the callback then ran from a microtask
inside the **Viewport's** transition and was awaited there. By the rule of section 1 that is a
fact for every reason: there is nothing the library could roll back (the request in a toast is
`Toast.Action`'s `action`, which stays an action). Running it in a transition also had two side
effects:

- **Entanglement.** While an async `closeAction` was pending, every transition in the app
  waited for it (conventions 2.3 item 5): a slow `deleteForReal` that started because a timer
  elapsed, with no user gesture, delayed an unrelated navigation.
- **The error surface was the whole toast region.** A rejection replaced everything under the
  boundary above the Viewport, for a toast that had already left. Elsewhere the rejection of an
  action whose owner has left is already report-only (conventions 2.4, #152).

### At the call site (the Undo-window pattern, toast.md 9.3)

```tsx
toast({
  title: "Message deleted",
  duration: 8000,
  action: { label: "Undo", action: () => restoreToList(id) },
  onClose: ({ reason }) => (reason === "activate" ? undefined : deleteForReal(id)),
});

// Showing the failure to the user is the consumer's:
onClose: async ({ reason }) => {
  if (reason === "activate") return;
  try {
    await deleteForReal(id);
  } catch {
    restoreToList(id);
    toast({ title: "Could not delete the message", priority: "high" });
  }
},
```

The first form is the old call site with one word changed, and a Server Function can be passed
directly. An unhandled failure reaches `window`'s `error` event and monitoring tools, and fails
a test run that does not expect it; the toast region stays up. Lost: the Error Boundary route.
A consumer who relied on the boundary to show a failed delete must catch (second form).

### Spec

| | Before | After |
| --- | --- | --- |
| Option on `ToastOptions` (wherever it is accepted today) | `closeAction?: Action<[details: ToastCloseDetails]>` | `onClose?: UrgentHandler<ToastCloseDetails>` |
| When | a microtask after the close, inside the Viewport's transition | where the close is applied to the queue (the Viewport's handler, timer callback or command loop), after the entry is marked ending; never inside a transition (the queue is urgent, toast.md 3.4) |
| Awaited | yes, by the Viewport's transition | no |
| A `setState` in the body | a transition update | urgent |
| Rejection / throw | Error Boundary above the Viewport | `reportError` |
| `reason` values, once per close, not called on Viewport unmount, called for a toast dismissed before it rendered | | unchanged |
| Viewport `useTransition` for close actions; the "`closeAction` in flight" state row (toast.md 12) | exists | removed |

```ts
/** A fact that carries no state. Same lane and error rule as UrgentChangeHandler. */
export type UrgentHandler<Details extends ActionDetails = ActionDetails> = (details: Details) => void;
```

The name is `onClose`, not `onOpenChange`: a toast has no `open` state (no `open` /
`defaultOpen`), so the conventions 2.1 row is "a fact with no state: `on<Event>`", which
replaces the reserved "Other notification: `<event>Action`" row. `Toast.Action`'s `action`,
`whilePending` and `closeOnSettle` are untouched.

History: the alternatives were (a) keep `closeAction` as an explicit exception to the rule
(both side effects stay) and (b) `onClose` with the return value ignored and a dev warning for
a promise (`void deleteForReal(id).catch(…)` at the call site, no Server Function).

---

## 8. Tooltip

No change. Tooltip has no `open` prop, no callback and no `data-open` (tooltip.md 4.1), and
this design adds none.

What changes is the argument in tooltip.md 4.1. It rejected an `openChangeAction` because a
tooltip's open state is browser-owned and an action "would invite awaited work on every hover".
Under the rule the answer is simpler: every tooltip open and close is performed by the browser
or by timers the user drives, so nothing about it is a request, and **if a callback is ever
wanted it is `onOpenChange` only** (both `true` and `false`, synchronous, no entanglement). It
would still cost the native path its only remaining listener, so it is not proposed now.

---

## 9. The development warning

User decision (2026-11-24): **the static warning only.**

`open !== undefined && onOpenChange === undefined`, checked once per Root instance after mount
(`useDevWarning`), in the four Roots:

```
Dialog.Root: `open` is set without `onOpenChange`. The browser can close this dialog without
asking (Escape, a click outside), and `onOpenChange` is where a controlled Root is told.
Without it the dialog re-opens after every dismissal. Pass `onOpenChange={setOpen}`, or
`onOpenChange={() => {}}` if re-opening is what you want.
```

This is React's `value` without `onChange`. React's opt-out is `readOnly`; here it is an
explicit empty handler, which states the intent in the code. An intentional re-open with a
handler (`onOpenChange={(o) => { if (!saving) setOpen(o); }}`) never triggers it.

**No runtime heuristic.** The mistake the static check cannot see is late adoption: a handler
that sets state in `startTransition` or after an `await` (2.4). At runtime it looks exactly
like an intentional re-open followed by an unrelated programmatic close ("the dialog cannot be
dismissed while saving; it closes when the save completes"): `open` stays `true` in the event's
own commit and turns `false` in a later one. The difference is when the parent scheduled its
update, which a child cannot observe; a lane probe fails on entanglement (conventions 2.3 item
5) and "no user input in between" fails on the same example. The first draft offered a
100 ms-window heuristic (W3) with a stated residual false positive; the user dropped it. The
docs sentence next to the prop (2.4) is the defence against late adoption.

Not warned either: `open` without `openChangeAction` (a Trigger-less controlled dialog is
legitimate with `onOpenChange` alone, dialog.md 12.3), and a promise returned from any `on*`
handler (2.6).

---

## 10. Interaction with #147 (CSS exit and view transition on one popup)

#147's restriction had two halves (memo, "#147", the "both" row):

1. **Library close**: the view transition and the popup's CSS exit start together; in Chromium
   the hidden box stays rendered through its fade and the new snapshot shows it next to the old
   image.
2. **Dismissal**: the CSS exit starts, then the *notification commit*, a transition commit,
   starts a view transition in the middle of the fade and captures the fading box in both
   snapshots.

**Half 2 disappears.** A fact produces an urgent commit, and only transition commits start a
view transition (2.8). After this change a dismissal starts none, with or without `transition`
on the Popup, in every engine. What goes with it:

- the "Dismissal" row of the view-transition tables (popover.md 10.2, dialog.md 10.3) becomes
  "never; CSS exit only";
- the browser rows "a dismissal runs one view transition, not two" become "runs none";
- the reason the recipe selector had to cover dismissals. Its stated side cost (an unrelated
  page view transition cuts a dismissal's fade) is no longer something the recipe needs to
  accept for the dismissal's own sake;
- in option B of #147 (the library cuts the popup's CSS transition around its own hide), the
  branch "cut at the notification commit too" is not needed. The library's cut is exactly: in
  the apply effect, around its own `hidePopover()` / `close()`, when `transition` is set.

**Half 1 remains** and is #147's to decide (recipe, or the library's inline cut after a
three-engine probe). It is unaffected by this design. **Decided 2026-11-24: the library's inline
cut (option B)**, around its own show as well as its hide (conventions 5.1,
`internal/css-transition-cut.ts`); the recipe line is gone from every stylesheet.

One residual overlap is new only in the sense that it is now the consumer's doing: a controlled
parent that adopts a fact inside `startTransition` (the late-adoption mistake) gets the
re-open, and then a controlled close in a transition commit, with a view transition if
`transition` is set. The docs name it (2.4); nothing warns (section 9).

Order of work: #148 first, then the #147 probe, which then has one case to cover instead of
two.

---

## 11. Implementation sketch (for the developer; not binding in detail)

**First step: the four probes at the end of this section.** The design rests on them; run them
(throwaway, three engines where a browser is involved) before writing library code, and bring
a failed one back to the architect.

- **`useControllableAction`**: one new method next to `adopt`:

  ```ts
  /** A fact: `next` is already true in the DOM. Supersedes every dispatch in flight (none of
   *  them commits; a later rejection is reported, not thrown), makes `next` the in-flight
   *  intent, drops older optimistic patches, and in uncontrolled mode writes the committed
   *  value urgently. Never calls the action. Call it from the platform event's listener. */
  readonly adoptFact: (next: T) => void;
  ```

  Dropping older optimistic patches: the `useOptimistic` passthrough becomes `{ value:
  committed, epoch }` with `epoch` in urgent state; a patch carries the epoch of its dispatch;
  the reducer ignores a patch whose epoch is older than the passthrough's. React re-bases
  pending patches when the passthrough changes, so one urgent `setEpoch` drops them. The same
  `setEpoch` is the urgent write that forces the commit in which a controlled Root re-opens.
  Other state owners never call `adoptFact` and are unaffected.
- **`useOverlayRoot`**: `onOpenChange` in the options and in mode detection; `notifyClosed`
  stops being an alias of `requestClose` and becomes: skip if this is the library's own hide;
  `adoptFact(false)`; call the handler through the shared helper below.
- **`internal/call-urgent-handler.ts`** (new, directive-free): `callUrgentHandler(handler,
  ...args)` calls the handler in `try` / `catch`, passes a throw to `reportError`, and attaches
  `.then(undefined, reportError)` to a returned thenable. The three call sites use it:
  `onOpenChange`, Toast's `onClose`, and Combobox's `onInputValueChange` (where it replaces the
  "returned a promise" dev warning).
- **`use-popover-popup.ts`**: the echo of the library's own `hidePopover()` is recognised by a
  marker set in the apply effect (as Dialog's `libraryClose`), not by `intended()`. The apply
  effect's re-open branch is unchanged. The #115 Trigger path (section 3.2).
- **`dialog-popup.tsx`**: remove `dismissedWhilePending`.
- **Mount reconciliation** (2.12): untouched, still `requestOpen(undefined, "platform")`.
- **Toast**: `scheduleCloseActions` becomes a synchronous loop after the queue write;
  the Viewport's close transition is removed.
- **Type guard** (`action-naming.test.ts`): the `on*` allow-list gains `onOpenChange` on the
  four Root props types (and `ToastOptions.onClose` if it is covered there).
- **The four probes** (the first step, above): (1) updates scheduled from a native `toggle` /
  `close` listener batch into one synchronous-lane commit with the parent's `setOpen` (expected:
  React reads the priority from `window.event`); (2) the passthrough re-base of `useOptimistic`
  drops the stale patch in the same commit; (3) a re-open inside a running CSS exit reverses it
  cleanly in Chromium and WebKit; (4) 2.10's Server Function call outside a transition.

---

## 12. Migration

### 12.1 Breaking changes (for the Roadmap page)

1. **`openChangeAction` no longer runs for dismissals** on `Popover.Root`, `Menu.Root`,
   `Combobox.Root` and `Dialog.Root`: Escape, a click outside, Android back, an
   assistive-technology dismiss, focus leaving a menu or combobox, a right-click outside a
   menu, another top-layer element, script `hidePopover()` / `close()`, a consumer's own invoker
   button closing a popover, lost interest. They are reported to the new `onOpenChange`
   instead.
2. **A controlled Root needs `onOpenChange`** as well: `open={open} openChangeAction={setOpen}
   onOpenChange={setOpen}`. Without it the popup re-opens after every dismissal (development
   warns).
3. **`onOpenChange` must set state directly**, not in `startTransition` and not after an
   `await`.
4. **A dismissal is no longer pending**: no `data-pending` on the Trigger, `state.pending`
   stays `false`, the committed state is `false` at once, and the callback is not awaited.
5. **A dismissal starts no view transition** and carries no `fsui-<component>-close` type.
   `transition` on a Popup animates opens and the closes a part asks for; a dismissal is
   animated by CSS only.
6. **A controlled Root that keeps `open={true}` after a dismissal is re-opened at once**, not
   after the callback settled.
7. **Errors**: a failing dismissal callback no longer reaches an Error Boundary; a rejected
   promise returned from `onOpenChange`, or a throw, goes to `reportError`.
8. **A dismissal during a pending close is reported at once**; a request that was in flight is
   superseded (its rejection goes to `reportError`). `Dialog.Root` no longer holds such a
   dismissal back.
9. **Server Functions**: one passed to `openChangeAction` no longer hears dismissals; pass it
   to `onOpenChange` too.
10. **Submenu Roots**: a submenu closed by its parent menu reports through `onOpenChange`.
11. **JS-free mode** (Popover, Dialog): `onOpenChange` on the Root selects library mode.
12. **Toast**: `toast({ closeAction })` is renamed `onClose`. It is called synchronously when
    the toast closes, is not awaited, no longer holds other transitions, and its rejection goes
    to `reportError` instead of the Error Boundary above the Viewport.
13. **`Combobox.Root`'s `onInputValueChange`** may return a promise: the development warning is
    gone, and a rejection or a throw goes to `reportError` (not breaking for correct code).

Not changing: a popup opened before hydration is still reported through
`openChangeAction(true, { reason: "platform" })`.

A codemod is not worth writing: the mechanical part (add `onOpenChange` next to a controlled
`openChangeAction`) is one line per Root, and the rest is a decision per call site.

### 12.2 Design documents to amend at acceptance

- `docs/vision.md` principle 3: the "one exception" paragraph becomes the rule of section 1.
- conventions: decisions 2, 3, 11; 2.1 (table: `on<State>Change` as "a fact about a state",
  `on<Event>` in place of the reserved notification row, the gate reworded; "never names a prop
  `onOpenChange`" removed); 2.2 (`"dismiss"` row: channel note; the crossover table of 2.2
  here); 2.4 (the fact handler's error route; superseded-by-a-fact); 2.6 (the urgent lane
  generalised; Toast's `closeAction` sentence); 3.4 (`adoptFact`); 3.5 (the "browser-owned"
  column: `xChangeAction` and "Controlled mode" and "Pending" rows; the "library-owned for some
  causes" bullet); 4.1 / 4.3 (no `data-pending` for a fact); 5.1 and 5.3 (no view transition
  and no close type for a fact); 10.1 (a new row "Fact handler (both)", the Urgent handler row
  merged into it, the Action naming allow-list). **Already applied at acceptance**: decisions
  2 and 11, 2.1, 2.6 (the handler rule, `onInputValueChange`'s warning, Toast's `onClose`), the
  Urgent handler row of 10.1, resolved question 45. The rest (2.2, 2.4, 3.4, 3.5, 4, 5, the new
  10.1 row) describes shipped behaviour and is amended with the implementation.
- popover.md 2 (mode table), 2.3, 2.5, 3.1, 4.1 to 4.4, 10.2, 11, 12, 13; dialog.md the same
  sections plus 2.3's stored dismissal, 11.13, 12.4; menu.md 2.2, 3.1, 10, 12; context-menu.md
  3.1, 5, 7, 10; combobox.md 3.1, 5.4, 5.5, 10; toast.md 3.3, 3.4, 9, 11, 12, 14;
  tooltip.md 4.1 (the argument). combobox.md and toast.md carry an amendment section for #148
  since acceptance; the other component designs get theirs with the implementation.

### 12.3 Churn estimate

Counted with `grep` on the current tree; upper bounds on what must be read, not on what must
be rewritten.

**Tests** (`packages/ui/src`):

| File(s) | Tests today | Lines mentioning `"dismiss"` | Expected work |
| --- | --- | --- | --- |
| `popover.test.tsx` / `.browser.test.tsx` | 92 / 46 | 10 / 17 | spy moves to `onOpenChange` in about 25 tests; the pending / notification / refusal rows rewritten (about 8) |
| `menu.test.tsx` / `.browser.test.tsx` | 100 / 38 | 6 / 8 | about 14 spy moves; submenu-closed-by-parent rows (about 4) |
| `menu-context-trigger.test.tsx` / `.browser.test.tsx` | 112 / 40 | 5 / 5 | about 10 spy moves |
| `combobox.test.tsx` / `.browser.test.tsx` | 141 / 47 | 5 / 8 | about 13 spy moves; controlled-refusal row rewritten |
| `dialog.test.tsx`, `dialog-close.test.tsx`, `dialog-form.test.tsx`, `dialog.browser.test.tsx` | 50, 19, 17, 30 | 3 + 16 lines in close / form | about 12 spy moves; the stored-dismissal rows (11.13) deleted and replaced (about 4) |
| Shared suites: `overlay-open-state-suite.tsx` (38), `overlay-browser-suite.tsx` (9), `overlay-close-part-suite.tsx` (15), `foreign-invoker-press-browser-suite.tsx` (2) | 64 | 6 | the dismissal-notification, refusal and re-open rows rewritten once for all four components (about 10); foreign-invoker rows flip channel |
| `toast.test.tsx` / `.browser.test.tsx` | 105 / 11 | 51 lines mentioning `closeAction` | a rename in about 20 tests; the "runs in a transition" and "rejection reaches the boundary" rows inverted (2) |
| `use-controllable-action.test.tsx`, `use-popover-hooks.test.tsx`, `action-naming.test.ts` | 15, 9, 4 | | new: `adoptFact` rows (about 6), allow-list entries |

In total: about 95 existing tests edited mechanically (the callback spy changes prop), about
30 rewritten because the asserted behaviour changes (pending, error route, re-open timing,
view-transition counts), about 30 new (the "Fact handler" row per component in both modes, a
fact during each kind of in-flight request, immediate re-open, the static warning, the Server
Function shape, the `reportError` route of each of the three handlers). The browser suites carry the rows that matter most (real Escape and light dismiss,
view-transition counts in three engines).

**Docs site** (`packages/docs`): the Browser-owned state page (the "Parts vs dismissals"
section is rewritten around the two channels) and the Action props page (the rule; the handlers
section) are the two conceptual rewrites; Popover (17 mentions of `openChangeAction`), Dialog
(19), Menu (6), Context menu (2), Combobox (6) pages each gain a props-table row, a "Requests
and facts" section and updated controlled examples; Toast page (7 mentions of `closeAction`); Pending and optimistic, Server Components and Suspense pages: a paragraph each;
Tooltip page: one sentence; Roadmap: the list of 12.1. Ten example files use `openChangeAction`
or `closeAction` (the controlled ones gain a prop; `ToastUndoWindow.tsx` is renamed inside).
The agent skill (`skills/funstack-ui-knowledge/SKILL.md`): three lines. The playground
(`packages/example`): four demo files, 18 mentions. With #147 decided, nine stylesheets lose or
narrow the recipe line.

---

## 13. Resolved questions (user, 2026-11-24)

1. **A popup found open at hydration** stays a request, `openChangeAction(true, { reason:
   "platform" })`; `onOpenChange` only receives `false` (2.12).
2. **A promise returned from a handler**: allowed, never a warning; rejection and throw to
   `reportError`. Made a library-wide rule for every `on*` handler, `onInputValueChange`
   included (2.6).
3. **The development warning** is the static one only; the runtime heuristic is dropped
   (section 9).
4. **Toast**: `closeAction` becomes `onClose` under the handler rule (section 7).
5. Noted without objection: the pointer leaving a hover-opened submenu stays a request with
   `reason: "dismiss"`, so "dismiss" does not always mean `onOpenChange` (2.2).

Also decided on the issue: no alpha release until #148 has landed.
