# @funstack/ui conventions: overlay open state

Part of the API conventions: section 3.9 of `design/conventions.md`, which keeps its heading as
a stub, and the light-dismiss traps that section 3.5 points to. Same status and rank as that
document (accepted and binding; `docs/vision.md` wins over it, it wins over a component
design), and the same rule for history (`design/CHANGELOG.md`).

The sections keep their numbers, so "conventions 3.9.4" is section 3.9.4 here. A section number
in the text that is not a heading of this document (2.1, 2.2, 2.4, 3.4, 3.5, 5.1, 7.4) is a
section of `design/conventions.md`, or of the document its stub there names.

## 3.9 Overlay open state: requests and facts

The `open` state of an overlay is the one state in the library that has both channels of 2.1:
parts ask for a change (a request, `openChangeAction`), and the browser performs one in front
of the user (a fact, `onOpenChange`). This section is the rule for the five overlay Roots:
`Popover.Root`, `Menu.Root` (a context-menu Root and each submenu Root included),
`Combobox.Root` (`open` only), `Dialog.Root` and `HoverCard.Root`. All five run on
`internal/overlay/use-overlay-root.ts`. Each component doc has a table of which cause goes to
which channel: `popover.md` 2.8, `menu.md` 2.4, `combobox.md` 5.6, `dialog.md` 2.7,
`hover-card.md` 2.5. Tooltip has no `open` prop and no callback
(`tooltip.md` 4.1); a toast has no open state, its fact is `onClose` (`toast.md` 9).

### 3.9.1 The props

| Prop | Type | Hears |
| --- | --- | --- |
| `open` / `defaultOpen` | `boolean` | Controlled value / initial uncontrolled value. |
| `openChangeAction` | `ChangeAction<boolean, <C>OpenChangeDetails>` | **Requests only**: opens, and the closes a part asks for. Transition, awaited, pending, optimistic, Error Boundary, veto in controlled mode (section 2). Never called for a fact. |
| `onOpenChange` | `UrgentChangeHandler<boolean, <C>OpenChangeDetails>` | **Facts only**: the popup was closed without the library performing the close. Synchronous, urgent, not awaited (2.1). Only ever called with `false` (3.9.12); the `boolean` stays for the pair's symmetry. |

`<C>OpenChangeDetails` is one type for both props (`reason`, the virtual `event`, Dialog's
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
    startTransition(() => setOpen(next)); // after an await: wrap (2.3 item 4)
  }}
  onOpenChange={setOpen}                  // never wrap this one (3.9.4)
>
```

Trade-off: controlled mode needs two props. The names differ by a prefix and a suffix, and the
difference is the point (one is asked, one is told). Not offered: `onOpenChange` receiving
requests when `openChangeAction` is absent (a second meaning for the name), and a combined
`openChange` prop (no name left to say which lane it runs in).

### 3.9.2 What is a fact

**A fact is the platform event (`toggle` with `newState: "closed"` on a popover, `close` on a
dialog) of a hide that the library did not perform in its apply effect.** The library's own
hide is recognised by a marker set in the apply effect, not by "`false` is already intended",
so a dismissal during a pending part close is a fact and not mistaken for the echo. The set
includes hides the library _triggers_ but cannot hold, because holding them would leave a popup
on screen that the user has already left: Menu's Tab-out, right-click outside and scroll close,
Combobox's focus-leaving close, the lost-interest hide (HoverCard's on both of its paths),
HoverCard's Escape and press outside, Dialog's JS Escape and light dismiss.

**Channel and `reason` are independent.** The channel says whether the library held the change;
`reason` (2.2) says what the user did. Most facts are `"dismiss"` and most requests
`"activate"`; `"platform"` is always a request (3.9.12). The crossovers:

| Channel | `reason` | Where |
| --- | --- | --- |
| `onOpenChange` | `"activate"` | A consumer's own invoker button (`popovertarget`, `commandfor` with a popover command) closes a popover, menu or listbox: the user acted on a button, the browser performed the hide. A non-button Trigger pressed while open (light dismiss hides the popup before the click; the click records the intent and the `toggle` reports it). |
| `openChangeAction` | `"dismiss"` | A close the library does hold although no part asked: the pointer leaving a hover-opened submenu, lost interest while an interest open is still pending (nothing is shown yet; the `false` supersedes the open), a HoverCard's Escape or press while its open is still pending. |

`onOpenChange` is never called for a change the consumer made through the `open` prop, for the
library's own hide after a request, for the library's re-open of a refused fact, or for removal
from the document.

### 3.9.3 Uncontrolled: what a fact does

In the platform event's listener, in this order, in one batch:

1. Bookkeeping: clear the awaited-close state, consume the close intent, read the exit
   animations and set `held` if there is a CSS exit (`popover.md` 4.4).
2. Supersede the requests in flight (3.9.5).
3. Write committed `open = false` with a plain `setState`: **urgent**.
4. Call `onOpenChange(false, details)` synchronously.

One urgent commit follows. In it the Trigger loses `data-open`, the Popup's children unmount
(or stay for the CSS exit while `held`), and nothing is pending. No transition is started, so no
view transition runs and no `fsui-<component>-close` type is added. An unrelated async action
pending elsewhere in the app delays none of this.

### 3.9.4 Controlled: what a fact does, and the re-open

Steps 1, 2 and 4 are the same; step 3 is the parent's. `setOpen(false)` inside the handler is an
urgent update, batched with the library's bookkeeping into the same commit.

**A parent that keeps `open={true}` gets the popup re-opened.** The prop and the DOM never
disagree: the commit that follows the event renders `open={true}` over a hidden popup, and the
apply effect shows it again (`showPopover({ source })` / `showModal()` / `show()`).

- The library forces that commit itself (an urgent internal write, the Root's `epoch`), so the
  re-open does not depend on the parent re-rendering.
- It happens in the task of the `toggle` / `close` event: the popup was hidden for about one
  task (a frame may paint).
- It is a fresh show: a new open generation, the CSS enter (`@starting-style`) runs; a CSS exit
  still running is reversed by the browser. The children were never unmounted (committed never
  left `true`), so their state is kept.
- **A refused re-open never moves focus.** Focus stays where the dismissal put it (the Trigger
  after Escape, the next tab stop after a Tab-out, the element the user clicked outside, with
  no `blur` / `focus` event and its selection kept), so a controlled Root without
  `onOpenChange` cannot trap the keyboard. The popup hook keeps a `refusedFact` flag: set when
  a fact hides the popup, cleared by any commit with committed `false` (the fact was adopted),
  consumed by the next show. For that show the library runs no initial focus of its own and
  sets `inert` on the popup for the duration of the synchronous `showPopover()` / `show()` call
  (only when the consumer has not set `inert`), so the platform's focusing steps find nothing
  focusable, whether they are the dialog focusing steps of a `<dialog popover>` or a consumer's
  `autofocus` in a `<div>` popup. A non-modal Dialog follows the same rule. **A modal Dialog
  does not**: its re-open with `showModal()` is a normal open with initial focus, because a
  modal dialog must hold focus.
- No callback is called for the re-open (the parent was told `false` and chose `true`), and no
  view transition runs (the commit is urgent).
- While a request is in flight the apply effect waits, and re-opens when it has settled.

This is **not a veto**: the user sees the popup go and come back. A popup that must not be
dismissed is configured on the platform side (Dialog without `lightDismiss`,
`experimental_closedBy="none"`), and the docs say "adopt a fact's `false`".

**The handler must write state directly.** `onOpenChange={(o) => startTransition(() =>
setOpen(o))}`, or a `setOpen` after an `await`, leaves `open={true}` in the event's own commit:
the popup is re-opened and then closed again when the late update lands (with a view transition
if `transition` is set). No warning can catch it (3.9.13), so the docs of every Root say it next
to the prop.

A controlled parent's own later updates are its own: if a request that was in flight when the
fact arrived calls `setOpen(true)` after its `await`, the popup opens. The library does not
filter controlled state.

### 3.9.5 A fact while a request is in flight

**A fact supersedes every request in flight on that Root** (`adoptFact`, 3.4):

- the latest-dispatch counter advances, so no dispatch in flight commits uncontrolled state;
- the in-flight intent becomes the fact's value, so `intended()` is `false` and the next Trigger
  click is an open;
- optimistic patches older than the fact are dropped, so the Trigger does not keep `data-open`
  for a hidden popup while a superseded action is still running;
- a superseded request that later **rejects** goes to `reportError`, not to the Error Boundary
  (2.4). Its resolution changes nothing.

| In flight when the fact arrives | What happens |
| --- | --- |
| A part's close (`openChangeAction(false)` awaited, popup still shown), then Escape | `onOpenChange(false, { reason: "dismiss" })` at once. Uncontrolled: committed `false` now. The request keeps running; its outcome decides nothing. Both callbacks were called: the consumer was asked, then told. |
| A Close part's own `action` (the Close's transition; no Root request yet), then Escape | The fact, at once. The continuation's close request is a no-op (open-generation guard), so `openChangeAction(false)` is never called for this close. |
| Trigger clicked twice while shown (close requested, then open requested again), then Escape | The fact wins: the pending open request does not show the popup again when it resolves. |

A fact cannot arrive while an open is pending and nothing is shown; a cause that arrives then
(lost interest) is a superseding request.

One leftover: React's `isPending` stays `true` until the superseded action settles, so the
Trigger shows `data-pending` (without `data-open`) for that time. It reports the request that
is still running; a dismissal by itself never produces `data-pending`.

Controlled: the handler is called at once and the parent adopts urgently. If the parent keeps
`open={true}`, the re-open waits until nothing is in flight.

### 3.9.6 The handler's contract

`onOpenChange` follows the one rule for every `on*` handler (2.1), implemented by
`internal/action/call-urgent-handler.ts`: synchronous, not awaited, may return a promise, a rejection
or a throw goes to `reportError`. It is called once per fact with `(false, details)`;
`details.event` is the platform event or the recorded cause (the `CommandEvent`, the
`loseinterest` event, the `click`).

### 3.9.7 What each surface shows after a dismissal

Uncontrolled, or controlled with an adopting parent. "Fact commit" is the urgent commit of the
`toggle` / `close` task.

| Surface | Reads | After a dismissal |
| --- | --- | --- |
| Popup visibility, `:popover-open` / `:open` | DOM | hidden at once by the browser |
| Exposed expanded state: the browser's own on a `popovertarget` Trigger; `aria-expanded` on a non-button Trigger and on `Combobox.Input` (the urgent `shown` mirror, 3.5) | DOM / `shown` | `false` in the `toggle` task |
| Trigger `data-open`, `state.open` on Root / Trigger (Menu: `ContextTrigger` and `SubmenuTrigger` too; Combobox: Input and Trigger) | optimistic | removed in the fact commit |
| Committed `open`: Popup `state.open`, children mounted | committed | `false` in the fact commit; children unmount then, or after the CSS exit (`held`) |
| Trigger `data-pending`, Root `state.pending` | Root transition | absent (except for a superseded request still running, 3.9.5) |
| View transition | transition commit | none, no type |

### 3.9.8 View transitions

| Change | Lane | `<ViewTransition>` |
| --- | --- | --- |
| Open through a request; content swap while open | transition, `fsui-<c>-open` | yes |
| Close through a request (Trigger, Close, item, Form) | transition, `fsui-<c>-close` | yes, in every engine |
| Controlled close (the parent sets `open={false}` in a transition) | the parent's transition, no library type | yes |
| **A fact** (dismissal), adopted or uncontrolled | urgent | **never**. CSS exit only (`@starting-style` / `allow-discrete`; none in Firefox) |
| Re-open of a refused fact | urgent | never. CSS enter |
| `held` release after a CSS exit | urgent | never |

The split is by who performs the change: the view transition animates what the library does,
CSS animates what the browser does. Where one popup has both a `transition` and a CSS exit,
the library cuts the CSS transition around its own show and hide (5.1,
`internal/overlay/css-transition-cut.ts`); a fact's hide is not cut.

### 3.9.9 Errors

| Case | Route |
| --- | --- |
| `openChangeAction(true)` rejects | Error Boundary; nothing shown |
| A part's `openChangeAction(false)` rejects | Error Boundary; popup still open |
| `onOpenChange` throws or its promise rejects | `reportError`; the UI is untouched |
| Controlled veto of an open, or of a part's close | snap-back |
| Controlled refusal of a fact | re-open at once (3.9.4) |
| A request in flight, superseded by a fact, rejects | `reportError` (3.9.5) |

### 3.9.10 Server Functions

`details` is serialisable with a virtual `event` (2.2) for both props. A Server Function passed
to `openChangeAction` hears requests only: not Escape, not a click outside. A Server Function
may be passed to `onOpenChange`, also from a Server Component; it is called from the event and
not awaited, nothing shows pending, a rejection goes to `reportError`. To hear both a Close
button and Escape, pass both:

```tsx
<Dialog.Root defaultOpen={!user.sawWelcome} openChangeAction={rememberDismissed} onOpenChange={rememberDismissed}>
```

### 3.9.11 JS-free mode

Popover and Dialog select JS-free mode when the Root has **none of** `open`, `defaultOpen`,
`openChangeAction`, `onOpenChange`. In it the browser owns every open and close, no callback
exists, and the CSS exit is the only animation. A Root with only `onOpenChange` is an
uncontrolled library-mode Root; there is no "JS-free plus listener" mode (a `toggle` listener
on a `ref` covers the need). Menu, Combobox and HoverCard have no JS-free mode.

### 3.9.12 A popup found open at hydration is a request

Library mode renders the native invoker markup, so a click before hydration opens the popup
natively and empty; at mount the Popup finds it open with committed `false` and dispatches
`openChangeAction(true, { reason: "platform", event: undefined })` in the Root's transition.
The content mounts when it settles; a rejection or a refusing parent hides the popup. It is a
request although the browser opened the popup first, because the library can roll it back (it
hides an empty popup) and the DOM is the optimistic state, the reasoning that keeps
pre-hydration input on form controls an action. Every open goes through one channel, so
load-on-open code in the action runs for all of them. Consequence: **`onOpenChange` is only
ever called with `false`.**

### 3.9.13 The development warning

`open !== undefined && onOpenChange === undefined`, checked once per Root instance after mount
(`useDevWarning`), in the five Roots:

```
Dialog.Root: `open` is set without `onOpenChange`. The browser can close this dialog without
asking (Escape, a click outside), and `onOpenChange` is where a controlled Root is told.
Without it the dialog re-opens after every dismissal. Pass `onOpenChange={setOpen}`, or
`onOpenChange={() => {}}` if re-opening is what you want.
```

This is React's `value` without `onChange`; the opt-out is an explicit empty handler. There is
**no runtime heuristic** for late adoption (a handler that sets state in `startTransition` or
after an `await`): at runtime it looks exactly like an intentional re-open followed by an
unrelated programmatic close, and a child cannot observe when the parent scheduled its update.
Not warned either: `open` without `openChangeAction` (a Trigger-less controlled dialog is
legitimate with `onOpenChange` alone), and a promise returned from any `on*` handler.

## The light-dismiss traps (conventions 3.5)

**A part's library-owned close is the single source of that close.** Whatever the press does on
the way to the `click` must not trip one of the component's immediate, browser-shaped closes
first; otherwise the popup is gone before the action runs, the reason is wrong (the fact's
`"dismiss"` lands first and the click's dispatch is a no-op) and the outcome depends on the
engine. Three traps, and the rule for each (the helpers are `internal/overlay/invokers.ts`,
`use-popover-trigger.ts` and `pointer-capture.ts`):

1. **The focus move of a `mousedown`** (Chromium and Firefox focus a button on press, WebKit
   does not). A component that closes on focus leaving (Menu's Tab-out, Combobox's focus loss)
   has the parts outside its popup `preventDefault()` the `mousedown` while the popup is open
   (Combobox: always, the input must keep focus; Menu's Trigger: while `intended()` is `true`,
   because an opening click must focus the Trigger for the platform's focus return). **The
   same press on a foreign invoker** (a consumer's own `<button>` whose `popovertarget`, or
   `commandfor` with a popover `command`, names the shown popup) is not a focus-out either:
   while the popup is shown a document capture `mousedown` listener prevents the primary
   button's default when the target's closest `<button>` is outside the popup and names it.
   The click's native toggle then closes the popup, `ToggleEvent.source` names the close
   `"activate"`, and focus never left, so the platform's hide returns it (Menu: to the
   Trigger) or it stays in the input (Combobox). Ignoring an invoker `relatedTarget` in the
   `focusout` path instead is wrong: a Tab onto such a button would leave the popup open with
   focus outside, and a dragged-off press would strand focus on the button.
2. **Light dismiss** (engine-independent): a press on a part outside the popup that is not a
   button naming the popover hides the popup at `pointerup`, a task before the `click`. The
   exemption is the invoker relationship of HTML's "topmost clicked popover": a `<button>`
   whose `popovertarget`, or `commandfor` with a popover `command`, names the shown popover
   counts as part of it (so do `interestfor` and a `<select>`'s picker); a custom `command`
   does not. **The element the popover was shown with (`showPopover({ source })`) is not
   exempt.** A part that closes through its action therefore names the popup with
   `popovertarget` and cancels its click so the activation never runs (`usePopoverTrigger`
   does both for Popover and Menu; Combobox's Trigger writes the attribute through its ref
   after hydration, 7.4, because a pre-hydration activation would open an empty, mis-anchored
   popup). The exemption exists for `<button>`s only, so a Trigger rendered as
   another element through `render` keeps a browser-shaped close in library mode (a fact with
   reason `"activate"`, nothing awaited, no veto, no exit transition); the guarantee is stated
   for a `<button>` Trigger and the non-button development warning says so (popover.md 2.7).
3. **A part that is not a `<button>` and must survive its own press** (Combobox's Input) has
   one lever, **pointer capture**: light dismiss compares the popover under the press with the
   popover under the release, and capture retargets the release, so
   `popup.setPointerCapture(pointerId)` at the part's `pointerdown` (primary button, popover
   shown) makes the release count as inside the popup, with a mouse, a pen or a finger (one
   engine hole: Chromium ignores the capture for a touch tap inside a same-origin iframe). The
   compat `mousedown` is not retargeted (the caret still lands where the user pressed); for a
   mouse or pen press `pointerup`, `mouseup` and the `click` land on the popup, so the part's
   own `onClick` does not fire for that press (a touch tap's `click` reaches the part). Known
   cost: Firefox routes the mouse drag to the capturing element, so a drag-to-select in the
   field does not extend while the popover is open. Preventing `pointerdown`, `pointerup` or
   `click` changes nothing: light dismiss is not cancelable.

A part whose close is browser-owned by design (Combobox's Clear) needs none of this; nor does a
Trigger that never closes: Dialog's Trigger only opens, so a Trigger click on an open non-modal
`lightDismiss` dialog is a dismissal on every path, as native `closedby="any"` treats it
(dialog.md 2.7). jsdom cannot catch this class of bug (user-event fires mousedown, mouseup and
click in one task and a synthesised click runs no light dismiss): a browser row with a real
pointer that asserts the reason, `document.activeElement` and `:popover-open` across the
click's pending window is required.
