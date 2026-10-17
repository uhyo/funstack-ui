# Toast

Status: **proposed** (2026-10-17, GitHub issue #54, wave 5). Follows `design/conventions.md`
(accepted); where this document and the conventions disagree, the conventions win, except for the
amendments listed in "Conventions feedback", which need the product owner's acceptance together
with this design.

Inputs: `docs/vision.md`, `design/conventions.md`, `docs/research/toast.md` (primary; its three
findings are binding: the inert toaster under a modal dialog, the urgent queue, `ariaNotify()`),
`docs/research/react-async-apis.md` §2 and §3, `docs/research/view-transition-mount-cost.md`,
the Dialog design (library-owned part closes, "never portal out of a dialog"), the Menu design
(`Item action` keeps the menu open with `data-pending` and closes on settle), the Combobox design
(`ariaNotify`, built-in strings), the Popover design (`useExitAnimation`), the WAI-ARIA APG Alert
pattern and WCAG 2.2 (2.2.1, 2.2.3, 2.5.1, 4.1.3), and the jsdom probe in
`memo/architect/probes/toast-suspense-reveal.mjs`. Prior art: Base UI Toast 1.9, React Aria
Toast 3.53, Radix Toast 1.3, Sonner 2.0.

Toast is the first component whose **state lives on the urgent lane by design**. A toast is the
feedback for something that already happened or is happening elsewhere: an action's progress, its
result, an Undo window. React 19.3 holds every transition update while any async action is
pending anywhere in the app (conventions 2.3 item 5), so a toast pushed as a transition would
appear only after the very action it reports on had finished. The queue is therefore urgent
(research finding 2, the vision's "unless there is a specific reason for urgency"), and Toast
spends its Async React budget elsewhere: a toast that **follows a promise** from pending to
settled, an **Undo** that is an ordinary action prop with `data-pending`, a paused timer and a
close on settle, a **`closeAction`** that tells the consumer whether the Undo window elapsed or
was used, and a **Suspense guard** so a toast whose content suspends fills in when ready without
hiding the stack.

---

## Decisions at a glance

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Anatomy | `toast()` (a function, the queue's only input), `Toast.Viewport` (the region: `<section popover="manual">`, owns the queue, timers, hotkey, focus), `Toast.Root` (`div[role=dialog|alertdialog][tabindex=0]`, one per toast), `Toast.Title` (`div`), `Toast.Description` (`p`), `Toast.Action` (`button` with an `action` prop), `Toast.Close` (`button`). No Provider, no Portal part, no list element. |
| 2 | Imperative input, declarative output | The queue is fed imperatively (`toast(options)` returns an id; `toast.promise`, `toast.update`, `toast.dismiss`) and rendered declaratively: the consumer's Viewport `children(state)` maps `state.toasts` to parts. Section 2 justifies this against the vision: toasts are produced in action bodies and outlive the component that produced them, and no `on*` handler exists anywhere in the API. |
| 3 | Urgent queue | Every queue mutation (add, update, dismiss, drop after exit) is a normal (urgent) update, dispatched from a microtask so a `toast()` call inside a `startTransition` scope escapes it (research §7). The third documented urgent state after a controlled text input and virtual focus (conventions 2.6). Order is preserved. |
| 4 | Promise toasts | `toast.promise(promise, { pending, success, error })` shows `pending` at once with `data-pending`, swaps to `success` / `error` when the promise settles (urgent `update`), announces on settle, and starts the timer only then. It returns a promise that mirrors `promise`, **except** that a rejection is resolved (with `undefined`) when `error` was given: the error toast is the handler the consumer asked for. Returning the promise lets one call feed both the toast and the awaited action prop of the part that started the work (section 3.1). |
| 5 | Undo | `Toast.Action` is a pure-trigger action prop (`useActionTrigger`, like `Menu.Item`): `data-pending` on the Action and the Root while it runs, the toast's timer paused, the toast closed with `reason: "activate"` when it resolves (`closeOnSettle`, default `true`); a rejection keeps the toast and reaches the nearest Error Boundary above the Viewport. |
| 6 | `closeAction` | A per-toast action called when the toast leaves, with `details.reason`: `"activate"` (the Action part settled), `"dismiss"` (Close part, Escape, `toast.dismiss()`, a promise toast with no message for its outcome), or `"timeout"` (the timer elapsed; a new `ChangeReason` value, conventions feedback 1). Run inside the Viewport's own transition, not awaited by anything visible: the "commit the deletion when the Undo window elapses" pattern (section 9.3). |
| 7 | Top layer | One `popover="manual"` region, shown while it has toasts (exiting ones included), hidden when empty. Re-raised (`hidePopover(); showPopover()`) when a toast is added while it is already open, so a later-opened menu or popover does not cover new toasts. While a library `Dialog` is modal, the region is portalled into the topmost open modal `<dialog>` (a module-level registry Dialog writes to) and moved back when it closes, because a top-layer region outside a modal dialog is inert and absent from the accessibility tree (research finding 1). |
| 8 | Announcements | `document.ariaNotify(text, { priority })` after the toast's content has committed un-suspended, coalesced per microtask, `priority: "high"` for `priority: "high"` toasts. No live region anywhere. The text defaults to the Title and Description text (`textContent` of the parts), overridable per toast or per Viewport through `announce(toast)` (built-in strings rule, conventions 11). |
| 9 | Timers | `duration` default 5000 ms; `null` for persistent. A toast with an `action` defaults to persistent (WCAG 2.2.1; product-owner question 3). Paused while the pointer is over the region, focus is inside it, the document is hidden, the window is blurred, the toast is `pending`, or it is queued beyond `limit`; resumed with the remaining time. |
| 10 | Keyboard | `hotkey` (default `["F8"]`, `event.code` / modifier names, Radix's shape; `null` disables) focuses the newest toast; Tab moves through toasts and their buttons in DOM order; ArrowDown / ArrowUp move between toasts; Escape dismisses the toast that contains focus. Focus leaving a dismissed toast goes to the next toast, else back to the element focused before the region was entered. The region's name is `"Notifications (F8)"` by default (`aria-label` overrides). |
| 11 | Stacking | `limit` (default 3) visible toasts; further toasts queue in order and show as earlier ones leave (never dropped). The DOM order is chronological; visual order is CSS. |
| 12 | Animation | Enter with `@starting-style` (CSS), exit with `data-ending` on the Root held until its `getAnimations()` finish (`useExitAnimation`), no `<ViewTransition>` and **no `transition` prop on any part**: every Toast commit is on the urgent lane, where react-dom never starts a view transition (conventions 5.1, third no-`transition` category). |
| 13 | Suspense guard | `Toast.Root` wraps its children in a `<Suspense>` whose fallback renders nothing visible: a toast whose content suspends shows an empty toast (consumers add their own skeleton boundary) instead of pulling the whole Viewport, which lives in an urgent commit, into the nearest consumer boundary. The toast's timer and announcement wait for the reveal, which commits while unrelated actions are pending (retry lane; probe). The one deliberate exception to "the library never wraps children in `<Suspense>`" (conventions 6, feedback 6). |
| 14 | SSR and directives | Client-only behaviour: the Viewport server-renders the empty region (`popover` serialises; no hydration issue), `toast()` calls before the Viewport mounts are buffered. No JS-free mode (a toast cannot exist without JS). Every part file is `"use client"`; `toast.ts` (the manager) has no directive and no React import. |

---

## 1. Anatomy

```tsx
"use client";
import { Toast, toast } from "@funstack/ui/toast";

// Once, near the root of the app (any layout; the region is in the top layer, DOM position is
// irrelevant except for Tab order, which puts it last when rendered last).
export function Notifications() {
  return (
    <Toast.Viewport className="toasts">
      {({ toasts }) =>
        toasts.map((t) => (
          <Toast.Root key={t.id} toast={t} className="toast">
            <Toast.Title />                 {/* t.title */}
            <Toast.Description />           {/* t.description, nothing when absent */}
            <Toast.Action />                {/* t.action.label, nothing when absent */}
            <Toast.Close aria-label="Close">×</Toast.Close>
          </Toast.Root>
        ))
      }
    </Toast.Viewport>
  );
}

// Anywhere, including action bodies, after a Server Function returns, in a store, in a test:
toast({ title: "Link copied" });
```

| Part | Element | Role / ARIA | Data attributes | Notes |
| --- | --- | --- | --- | --- |
| `toast` | – | – | – | A function with methods: `toast(options): string`, `toast.promise(promise, options): Promise`, `toast.update(id, options)`, `toast.dismiss(id?)`. Bound to the default manager; `createToastManager()` makes an isolated one for a second root or a test. |
| `Viewport` | `section` with `popover="manual"` | `region` (named section), `aria-label="Notifications (F8)"` by default | `data-paused`, `data-empty` | Owns the queue state, timers, hotkey, pause, focus return, the portal into a modal dialog, re-raise, announcements. `children` is a function of `ToastViewportState` (or a node, for a fixed layout). |
| `Root` | `div` | `dialog`; `alertdialog` when `priority === "high"`; `tabindex="0"`; `aria-labelledby` → Title id, `aria-describedby` → Description id (both always emitted; a dangling IDREF falls through to `aria-label`) | `data-type` (the toast's `type`), `data-pending`, `data-ending` | One per `ToastItem`; takes `toast`. Renders the Suspense guard around `children`. Keyboard: Escape, ArrowUp / ArrowDown. |
| `Title` | `div` | id for `aria-labelledby` | – | `children` defaults to `toast.title`. Not a heading: a transient notification should not appear in heading navigation. |
| `Description` | `p` | id for `aria-describedby` | – | `children` defaults to `toast.description`; renders nothing when both are absent. |
| `Action` | `button type="button"` | – | `data-pending` | `action` defaults to `toast.action.action`, `children` to `toast.action.label`; renders nothing when the toast has no `action` and the part no `action` prop. `closeOnSettle` default `true`. |
| `Close` | `button type="button"` | – | – | Dismisses the toast (`reason: "dismiss"`). The consumer labels it (`aria-label` or text). No Invoker Command: `hide-popover` would hide the whole region. |

No Provider: with a module-level `toast` function there is nothing to put in context above the
app, and a Server Component can render the client `<Notifications />` file without passing a
function. No Portal part: the region is wherever the Viewport is rendered, and the only move it
makes (into a modal dialog) is the library's. No list element: the toasts are `dialog`s, which
would override `listitem` semantics anyway; the region's name and the arrow keys give screen
reader users the navigation a list would.

---

## 2. Imperative input, declarative output

### 2.1 The two shapes

**Declarative** (Radix): the consumer owns the state and renders `<Toast.Root open={open}>`
where the toast belongs.

```tsx
const [open, setOpen] = useState(false);
<Toast.Root open={open} openChangeAction={setOpen}>…</Toast.Root>
<Menu.Item action={async () => { await archive(id); startTransition(() => setOpen(true)); }} />
```

**Imperative** (Sonner, Base UI, React Aria): the consumer calls a function from wherever the
event happened and renders the queue once.

```tsx
<Menu.Item action={() => toast.promise(archive(id), { pending: { title: "Archiving…" }, success: { title: "Archived" } })} />
```

### 2.2 Why imperative input is the Async React-native choice here

The vision asks for action props instead of handlers, transitions by default, Suspense-native
content, optimistic feedback, `<ViewTransition>`, the platform, and accessibility. It does not
ask every API to be a prop; it asks interaction to be expressed as actions. The queue input is
not an interaction: it is a *command* issued from inside an action (a `Menu.Item`'s `action`, a
`Dialog.Form`'s Server Function, a `Toggle`'s `pressedChangeAction`). Three facts decide it:

1. **The producer is code, not markup.** A toast is created in an action body, after an `await`,
   with the result in hand. A declarative API forces the consumer to turn that result into state
   (`setOpen(true)` after the `await`, re-wrapped in `startTransition`, conventions 2.3 item 4),
   store the message somewhere, and render a `Root` in a tree that may not have a sensible place
   for it.
2. **The toast outlives its producer.** The row whose "Delete" produced "Deleted. Undo" is gone;
   the dialog that saved and closed is unmounted. State that must survive its producer has to
   live above it, which is exactly a queue in the Viewport.
3. **The declarative half is unchanged.** What a consumer *renders* stays a tree of parts in
   their own Viewport children, with `render`, function props and data attributes like every
   other component. The imperative surface is four functions on one object; it has no `on*`
   handler, nothing is subscribed to, and the queue is React state (`useState` in the Viewport),
   not an external store (research §7: `useSyncExternalStore` writes during a transition force a
   blocking re-render).

What is given up: a `Toast.Root` cannot be used standalone as a controlled inline notification
(use `Popover` or plain markup for that), and a toast is not server-renderable (a toast with no
JS is a `<p role="status">` the consumer writes). Both are the nature of the pattern, not costs
of the API.

### 2.3 The default manager and isolation

`toast` is bound to a **module-level default manager**. A `Toast.Viewport` with no `manager`
prop subscribes to it. Reasons: one app has one toaster; the call site needs no hook, so it works
in utility modules, stores and Server Function result handlers; and two Viewports on the default
manager is a mistake a dev warning catches (the second one warns and renders nothing).

`createToastManager()` returns an isolated manager with the same shape (`add`, `promise`,
`update`, `dismiss`), for a second React root, a micro-frontend, or a test that wants a clean
queue; `<Toast.Viewport manager={m}>` binds to it. `toast` itself is `defaultManager.add` with
the other methods attached, so `const { add: toast } = createToastManager()` reads the same.

---

## 3. The Async React story

### 3.1 A toast that follows an action: `toast.promise`

```tsx
<Menu.Item
  action={() =>
    toast.promise(archive(id), {
      pending: { title: "Archiving…" },
      success: { title: "Archived", action: { label: "Undo", action: () => unarchive(id) } },
      error: (e) => ({ title: "Could not archive", description: e.message, priority: "high" }),
    })
  }
>
  Archive
</Menu.Item>
```

Timeline, with `archive(id)` taking two seconds:

| Moment | Toast | Menu |
| --- | --- | --- |
| Click | The `pending` toast is added (urgent, visible at once even though the item's action is now pending) with `data-pending` on its Root; nothing announced yet beyond the pending text ("Archiving…", normal priority); no timer. | Item `data-pending`; the menu stays open (Menu decision 3). |
| `archive` resolves | `update` to the `success` options (urgent): `data-pending` gone, "Archived" announced, the Undo button appears; the timer starts (or not: an `action` toast is persistent by default, section 6). | The item's action resolves (the returned promise mirrors `archive`), so the menu closes on settle. |
| `archive` rejects | `update` to the `error` options: announced with `priority: "high"`, Root becomes `alertdialog`. **The returned promise resolves** (with `undefined`), because `error` was given: the toast is the handler. | The item's action resolves, the menu closes. No Error Boundary involved. |
| `archive` rejects, no `error` option | The pending toast is dismissed (`reason: "dismiss"`). The returned promise **rejects** with the same reason: nothing is swallowed. | The item's action rejects: the menu stays open and the error reaches the nearest boundary (conventions 2.4). |

Rules:

- `toast.promise<T>(promise: PromiseLike<T>, options): Promise<T | undefined>`. The returned
  promise settles when `promise` settles, in the same tick, so an awaiting action prop shows
  pending for exactly as long as the toast does.
- `success` and `error` are options objects or functions of the value / reason; both optional.
  An omitted `success` dismisses the toast on fulfilment, an omitted `error` dismisses it on
  rejection and rethrows, as in the table.
- `toast.promise` is sugar over `add` + `update` + `dismiss`; there is no Suspense involved
  (research §7), so the pending-to-settled swap is an urgent re-render of the same `Root`
  (same `id`, same DOM node, keyed by the consumer on `t.id`). Section 10.3 says why that is not
  animated by `<ViewTransition>` and how CSS animates it instead.
- The sync prefix of the action is still the place to call it: `toast.promise` adds the pending
  toast through the microtask dispatch (section 3.4), so the `startTransition` scope the action
  runs in does not hold it.

### 3.2 Undo: `Toast.Action`

`Toast.Action` is a pure-trigger action part exactly like `Menu.Item` (conventions 2.1 `action`,
3.4, `useActionTrigger`). While its action runs:

- the Action and the Root carry `data-pending`, and the Viewport pauses that toast's timer
  (a pending Undo must not vanish under the user);
- the toast is **not** optimistically removed: a failed Undo must leave the toast on screen;
- parts are never disabled while pending (conventions 3.6); a second click is a second dispatch
  and latest intent wins (2.5), which for an idempotent Undo is harmless.

When the action resolves, the toast closes with `details.reason: "activate"` (`closeOnSettle`,
default `true`; `false` keeps it, for an action that only navigates). When it rejects, the toast
stays and the error reaches the nearest Error Boundary above the Viewport; a consumer who wants
the failure *in the toast* catches inside the action and updates it:

```tsx
// The trap: a caught error RESOLVES the action, so the toast closes on settle and the
// "Could not undo" message is never seen (conventions 2.4: swallowed errors count as success).
action: {
  label: "Undo",
  action: async (details) => {
    try {
      await unarchive(id);
    } catch (e) {
      toast.update(details.id, { title: "Could not undo", description: String(e), priority: "high", action: undefined });
    }
  },
}
```

The rule is therefore explicit in the Action's docs: to keep the toast open after a handled
failure, either rethrow after the `update` (the error then reaches the boundary above the
Viewport, which must render the list with the failure visible, section 15.3), or set
`closeOnSettle={false}` on the Action part and dismiss from the action yourself on success
(`toast.dismiss(details.id)`).

`details` for the Action's action is `ToastActionDetails`: `{ id }` plus the virtual `event`
(conventions 2.2). `id` is there so an action declared inline in `toast({ … })` can update or
dismiss its own toast without a closure variable.

### 3.3 `closeAction` and the Undo window

A toast's `closeAction` runs once, when the toast leaves, with `ToastCloseDetails`: `{ id,
reason }` plus the virtual `event`. It is dispatched inside the **Viewport's** `useTransition`
and awaited there (so a thrown error reaches the boundary above the Viewport, React's rule for
actions), but nothing visible waits for it: the toast is already gone. Section 9.3 is the
"delete when the window closes" example; the reason vocabulary is in section 9.1.

### 3.4 The urgent lane, precisely

Every write to the queue is a normal `setState` in the Viewport, never inside a transition:

| Write | Dispatched from | Lane |
| --- | --- | --- |
| `toast()`, `toast.update()`, `toast.dismiss()` from consumer code | the manager, in a `queueMicrotask` callback | urgent (DefaultLane); a call made inside a `startTransition` scope is no longer inside it when the microtask runs (research probe `toast-lanes.mjs`: a microtask dispatch commits at once while an unrelated action is pending; a synchronous one is held until it settles) |
| `toast.promise` settle | the promise's `then` | urgent |
| Close part, Escape, Action settle, timer | the Viewport's own handlers and effects | urgent |
| Drop after exit animation | `useExitAnimation`'s release | urgent |

The microtask preserves order (React applies queued updates in dispatch order) and costs one
tick: a toast is on screen in the same frame as the click that produced it. The cost of the lane
is the one the research names: Toast's commits never start a document view transition, so its
animation is CSS (section 10).

What stays on the transition lane: the Action's action (pending state, error routing), the
`closeAction`, and everything the consumer does in those. This is the same split as Combobox's
text input: the state React or the product requires to be urgent is urgent, everything it drives
is a transition.

### 3.5 Suspense: the guard

A toast's content is arbitrary React (`title: <Avatar userId={id} />`). If it suspends, the
nearest boundary is above the Viewport, and because the toast was mounted in an urgent commit,
that boundary **shows its fallback** (conventions 6: newly mounted content in a non-transition
render reveals the fallback). A single slow avatar would blank every toast, or the app shell.

So `Toast.Root` renders its children inside `<Suspense fallback={<Guard />}>`, where `Guard`
renders nothing visible and reports its presence to the Root through a layout effect. While the
guard is mounted:

- the Root is **not** `data-pending` (the attribute keeps its one meaning, section 12) and the
  consumer sees an empty toast box unless they render their own `<Suspense fallback={skeleton}>`
  inside the Root, which catches first;
- the timer has not started and nothing has been announced;
- when the content commits, the Root announces (reading the Title and Description text that now
  exists) and starts the timer.

The reveal is a Suspense retry, which commits while unrelated async actions are pending: verified
on React 19.3.1 (`memo/architect/probes/toast-suspense-reveal.mjs`): a toast pushed urgently while
an action was pending showed its fallback at once and its content as soon as React's 300 ms
fallback throttle allowed, with the action still pending. So "Suspense-native" holds without
putting the toast on the transition lane.

This is the one place the library owns a `<Suspense>` (conventions feedback 6). The fallback is
invisible by design: a built-in visible fallback would be UI text (conventions 11 forbids it),
and the consumer's own boundary is the place for a skeleton.

### 3.6 Where `useOptimistic` is not used, and why

Nothing in Toast is optimistic. The toast **is** the feedback; there is no committed value it
anticipates. Removing a toast optimistically when its Action is clicked would hide a failed
Undo; showing a success toast optimistically before the action settles is what `toast.promise`'s
`pending` phase does honestly, with `data-pending`. Conventions 3's "trigger parts render
optimistic state" has no trigger with a value here.

---

## 4. The region and the top layer

### 4.1 One `popover="manual"` region

`Toast.Viewport` renders `<section popover="manual" aria-label="Notifications (F8)">`. `manual`
is the only type that neither closes other popovers when shown nor is closed by them, has no
light dismiss and no Escape (research §1). The Viewport calls `showPopover()` in a layout effect
when the queue goes from empty to non-empty and `hidePopover()` when the last toast (exiting ones
included) has been dropped. The region's open state is **browser-owned in the conventions'
sense** (top layer), but the library drives it in both directions, so it is never notified and
has no action: there is nothing a consumer could do with "the region opened".

While hidden it is `display: none` (UA stylesheet), so an empty region captures no clicks and
needs no `pointer-events` rule. While shown, it is a block in the top layer; the consumer
positions it (`position: fixed; inset: auto 1rem 1rem auto`) and may make its padding
click-through with `pointer-events: none` on the region and `auto` on `.toast`, as every toast
library's stylesheet does (section 10.4).

### 4.2 Re-raise

The most recently shown top-layer element paints on top. A menu opened after the region covers
toasts that arrive while it is open. When a toast is **added while the region is already open**,
the Viewport's layout effect runs `hidePopover(); showPopover()` synchronously, which moves the
region to the top of the top layer, keeps focus inside it, does not close an open `auto` popover
and fires one coalesced `beforetoggle` / `toggle` pair (research `reshow-focus.mjs`, Chromium and
Firefox). Implementation check (browser row, section 16.2): the existing toasts' `@starting-style`
enter must not replay; the two calls happen without a style flush between them, so no box is
destroyed. If an engine does replay it, the fallback is to re-raise only when the region is not
already topmost, detected by `document.elementFromPoint` on a corner of the region.

### 4.3 Modal dialogs

A top-layer region outside an open modal `<dialog>` is inert, unfocusable and absent from the
accessibility tree, even when re-raised above the dialog (research finding 1, verified in
Chromium and Firefox; WHATWG #9936 open). An Undo toast under a modal is a dead button.

The Viewport therefore **portals its region into the topmost open modal dialog** for as long as
one exists, and back when it closes:

- `src/internal/modal-registry.ts` (directive-free) keeps a module-level stack of `<dialog>`
  elements with `subscribe` / `getTopmost` (`null` on the server). `Dialog.Popup` pushes its
  element right after `showModal()` and removes it from the `close` event (and on unmount). The
  registry is the library's second module-level store after the default toast manager, and the
  same "write from a layout effect, read through `useSyncExternalStore`" shape.
- The Viewport reads `useSyncExternalStore(subscribe, getTopmost, () => null)` and renders the
  region with `createPortal(region, topmost)` when non-null, inline otherwise. SSR renders inline
  (react-dom's server renderer has no portals; the server snapshot is `null`).
- A move remounts the region's DOM. Removing a popover from the document hides it, so the apply
  effect re-runs `showPopover()` after every container change. Focus inside a toast at that
  moment is lost; the dialog's own focusing steps take it anyway. The toasts' `@starting-style`
  replays on the move (the elements are new); acceptable, and the only visible cost.
- Toasts added while the dialog is open are inside the dialog's subtree and therefore
  interactive and exposed; `document.ariaNotify()` announces them regardless (section 5).

Not detected: a foreign `<dialog>` the consumer opened with `showModal()` outside the library.
v1 records this as a limitation (product-owner question 7); a `MutationObserver` on `open`
attributes, or `document.querySelectorAll("dialog:modal")` polled from the add path, are the two
options if it is wanted. Non-modal dialogs (`show()`, `Dialog modal={false}`) make nothing inert
and are ignored. A Viewport rendered *inside* a Dialog by the consumer is a dev warning: it would
move out of the dialog on the dialog's own close.

---

## 5. Announcements

No `aria-live`, no `role="status"`: `document.ariaNotify(text, { priority })` (Chrome 141,
Firefox 150, Safari 27; adopted without a flag, conventions 8). Reasons from the research: a
live region inside a popover that was `display: none` a moment ago is unreliable, an inert region
is silent, the DOM text would include "Undo, button", and Suspense fallbacks would be read. The
`document` target is used even when the toast element is exposed, because the element form does
nothing for a node outside the accessibility tree and the research's Firefox shadow-tree bug
argues for the document form as the default.

What is announced, and when:

| Event | Text | Priority | When |
| --- | --- | --- | --- |
| Toast added (or shown from the queue beyond `limit`: announced on **add**, the message is timely even if the box is not yet visible) | `announce(toast)` | `toast.priority` (`"normal"` default, `"high"` → `{ priority: "high" }`) | In an effect after the Root's content has committed un-suspended (section 3.5), never in the click handler (macOS VoiceOver drops an announcement that coincides with the click's own events, research §2) |
| `toast.update` / promise settle | the new text, only if it differs from the last announced text for that id | the new priority | same |
| Dismissal, timeout | nothing | – | – |
| Several toasts in one task | one call with the texts joined by `" "` in dispatch order | the highest priority among them | one microtask after the last effect |

`announce` resolves in this order: the toast's own `announce` option, the Viewport's `announce`
prop, the built-in default. The default joins the `textContent` of the `Toast.Title` and
`Toast.Description` elements registered for that toast with `" "`. Returning `null` announces
nothing. The default is the library's second built-in string after Combobox's result count and
follows conventions 11: it is a function of the toast, never a plain string.

The region's accessible name `"Notifications (F8)"` is the third built-in string. It is static,
so the override is the ordinary `aria-label` pass-through (`aria-label="Benachrichtigungen (F8)"`),
not a function prop; when `hotkey` is changed or disabled the library substitutes the key (`"Notifications (Alt+T)"`) or drops the parenthesis, and a consumer-supplied `aria-label` wins verbatim.

Screen-reader coverage is a manual pass recorded before the component leaves experimental
(NVDA + Chrome / Firefox, VoiceOver + Safari; research §9), with the `announce` seam as the
fallback plan if a live region turns out to be needed somewhere.

---

## 6. Timers and pausing

Each visible toast has one timer, owned by the Viewport (a ref map `id → { remaining, startedAt,
handle }`), not by the manager (which has no React and no DOM) and not by the Root (pausing is a
viewport-wide fact).

| | |
| --- | --- |
| Starts | when the toast is visible (within `limit`), its content has committed un-suspended, and it is not `pending`; `duration` is read then, so an `update` that changes `duration` restarts |
| `duration` | ms; Viewport `duration` is the default (5000); `null` is persistent. A toast with an `action` is persistent unless `duration` is given (decision 9, question 3) |
| Paused while | pointer over the region (`pointerenter` / `pointerleave` on the section; touch lifts the pointer, so a tap does not stick), focus inside the region (`focusin` / `focusout`), `document.hidden`, window `blur`, the toast `pending` (promise unsettled or Action running) |
| Resumed | with the remaining time; `data-paused` on the Viewport while any viewport-wide pause condition holds (so a visible progress bar can pause with it) |
| Elapsed | the toast closes with `reason: "timeout"` |

Pausing helps sighted users only (research §4). For screen-reader users the announcement has
already happened; the persistent default for action toasts and the hotkey are what give them time
to reach the Undo. A consumer who sets a `duration` on an action toast is told, in the prop's
docs, that WCAG 2.2.1 then expects the action to be reachable elsewhere too.

A CSS-driven timer (`animation` paused under `:hover`) is not offered: it cannot see a hidden
tab, a blurred window or a pending action. The `data-paused` attribute lets a consumer's progress
bar follow the real timer.

---

## 7. Keyboard and focus

| Key | Where | Effect |
| --- | --- | --- |
| `hotkey` (default F8) | document | If the region has toasts: `preventDefault()`, remember `document.activeElement`, focus the newest visible toast's Root. If it has none: nothing (the browser keeps the key). `hotkey={null}` installs no listener. |
| Tab / Shift+Tab | region | Platform sequential focus through each toast and its buttons in DOM order; leaving the region with Shift+Tab from the first toast (or Tab from the last control) goes wherever the DOM order leads, as with any top-layer element in its DOM position. Nothing is trapped. |
| ArrowDown / ArrowUp | a toast Root or anything inside it | Focus the next / previous toast's Root (DOM order, no wrap). `preventDefault()`. |
| Escape | a toast Root or anything inside it | Dismiss that toast (`reason: "dismiss"`); then the focus rule below. The region is `manual`, so the platform does nothing on Escape, and no other popover closes. |
| Enter / Space | Action, Close | Native button activation. |

Focus after a toast that contains focus leaves (Escape, Close, Action settle, `toast.dismiss`;
not timeout, which cannot fire while focus is inside): the next toast's Root in DOM order, else
the previous one, else the **element focused before the region was entered**, if still connected,
else `document.body`. The remembered element is set by the hotkey and by any `focusin` whose
`relatedTarget` is outside the region (so Tab-ing in records it too) and cleared when focus
leaves the region.

The region itself is not focusable (no `tabindex`); its Roots are (`tabindex="0"`). A focused
Root reads its name and description (`dialog` with `aria-labelledby` / `aria-describedby`), which
is the screen-reader path to a toast whose announcement was missed. F8 rather than F6: F6 is the
browser's pane-cycling key in Chrome and Firefox on Windows and Linux, which only a library that
implements full landmark cycling (React Aria) can justify taking (research §3). Alt+T, Sonner's
choice, is a menu accelerator on Windows.

---

## 8. Stacking and limits

- `limit` (Viewport, default 3): the number of toasts rendered at once. Toasts beyond it wait in
  order and are rendered as earlier ones are dropped; `state.toasts` contains only the rendered
  ones, `state.queued` the count waiting. A queued toast is announced on add (section 5), its
  timer starts when it becomes visible, and it is never dropped by a newer one (an Undo is never
  lost to a burst). `limit: Infinity` renders everything.
- Order: `state.toasts` and the DOM are chronological (oldest first). Visual stacking is CSS:
  `flex-direction: column-reverse` for a bottom-anchored stack, `:nth-last-child(1)` for the
  newest, `:nth-last-child(n+4)` to collapse older ones. No `data-index`: `:nth-last-child` is
  exact and the library emits no positional attribute (conventions 4.2, pseudo-classes over
  attributes).
- Exiting toasts stay in `state.toasts` with `ending: true` until their animations finish
  (section 10.2), so a stack can animate the gap closing (`grid-template-rows: 1fr → 0fr`).
- A `toast.update` on an id keeps its position. A `toast()` with an explicit `id` that already
  exists is an update (useful for "one toast per key": `toast({ id: "sync", … })`).

---

## 9. Dismissal and `closeAction`

### 9.1 Reasons

| Close | `details.reason` | `details.event` | Who |
| --- | --- | --- | --- |
| `Toast.Action` settled (`closeOnSettle`) | `"activate"` | the Action's click / keydown | library, after the action resolves |
| `Toast.Close` | `"dismiss"` | the click | library |
| Escape in the toast | `"dismiss"` | the keydown | library |
| `toast.dismiss(id)` / `toast.dismiss()` | `"dismiss"` | `undefined` | consumer code |
| Promise toast settled with no message for that outcome | `"dismiss"` | `undefined` | library |
| Timer elapsed | `"timeout"` | `undefined` | library |

`Toast.Close` is `"dismiss"`, not `"activate"` as Dialog's Close part is, deliberately: a
dialog's Close is a decision (Cancel versus OK, with a `returnValue`), a toast's Close only ever
means "go away", the same as Escape, and the Undo-window pattern needs exactly the line between
"acted on the content" (`"activate"`) and "did not" (everything else). `"timeout"` is a new
`ChangeReason` value (conventions feedback 1): a close no user caused and no platform event
carries, which neither `"dismiss"` nor `"platform"` describes.

### 9.2 Swipe

Not in v1 (product-owner question 4). Close, Escape and the timer satisfy WCAG 2.5.1 on their
own. The design reserves `swipeDirection` on the Viewport (`"up" | "down" | "left" | "right"`,
Pointer Events with `setPointerCapture` and `touch-action` on the Root, research §5) for a
follow-up; it is the only piece of pointer tracking Toast would ever carry, and it is better added
once the example app shows what the stack looks like on a phone.

### 9.3 The Undo window

Two patterns, both supported, chosen by the consumer:

```tsx
// Do now, undo later (the common one): the action already ran; Undo reverts it.
<Menu.Item action={() => toast.promise(archive(id), {
  pending: { title: "Archiving…" },
  success: { title: "Archived", action: { label: "Undo", action: () => unarchive(id) } },
})} />

// Do later, unless undone (Gmail's "Undo send"): the toast *is* the grace period.
<Menu.Item action={() => {
  removeFromList(id); // optimistic in the consumer's own state, outside the library
  toast({
    title: "Message deleted",
    action: { label: "Undo", action: () => restoreToList(id) },
    duration: 8000, // the window; an action toast is persistent otherwise
    closeAction: ({ reason }) => (reason === "activate" ? undefined : deleteForReal(id)),
  });
}} />
```

In the second shape `closeAction` runs for `"timeout"`, `"dismiss"` (Close, Escape, page-level
`toast.dismiss()`) alike, and not for `"activate"`. It runs in the Viewport's transition: a
rejection of `deleteForReal` reaches the boundary above the Viewport, and the consumer who wants
it quieter catches and `toast()`s the failure. A page unload before the timer ends is the
consumer's `pagehide` concern, as in every library.

---

## 10. Animation

### 10.1 Enter: CSS

A toast mounts in an urgent commit; `@starting-style` animates insertion in every engine:

```css
.toast { transition: opacity 200ms, translate 200ms; }
@starting-style { .toast { opacity: 0; translate: 0 1rem; } }
```

### 10.2 Exit: `data-ending` and the held item

When a toast closes, the Viewport marks the item `ending: true` (urgent) instead of removing it.
The Root renders `data-ending`; in its layout effect it reads `exitAnimations(element)` (the
shared helper: a style flush, then the finite animations in the subtree) and holds the item until
they settle through `useExitAnimation`, then the Viewport drops it. No animations: dropped in the
same effect. The region hides only when the last item is dropped.

```css
.toast[data-ending] { opacity: 0; translate: 0 1rem; }
/* collapse the gap in the stack */
.toast-slot { display: grid; grid-template-rows: 1fr; transition: grid-template-rows 200ms; }
.toast-slot:has([data-ending]) { grid-template-rows: 0fr; }
@media (prefers-reduced-motion: reduce) { .toast, .toast-slot { transition: none; } }
```

Focus has already moved before the item is marked ending (section 7), so an exiting toast never
holds focus; it is `inert` while ending, so a second click cannot dispatch from it.

### 10.3 `<ViewTransition>`: not used, and no `transition` prop

Every commit Toast makes is on the urgent lane (section 3.4), and react-dom starts a view
transition only when every committed lane is a transition, retry or idle lane (conventions 5.1).
A `<ViewTransition>` around a Root would therefore never animate an enter, an exit, or the
pending-to-settled swap of a promise toast. Rendering one anyway would still cost the page
cross-fade whenever a toast happened to mount inside somebody else's transition commit (#35).
So **no Toast part has a `transition` prop**, the third category of part without one after
browser-owned parts and optimistic-only parts (conventions feedback 4), and the component emits no
`fsui-toast` types.

Two things were considered and deferred, recorded so they are not re-derived:

- **Animating the promise settle through the retry lane.** If the settled content came through
  a Suspense reveal instead of an `update`, that commit would be eligible for a view transition
  (retry lane) without being entangled. It would also pay the document cross-fade on every reveal
  and block hit testing for its duration in Firefox while the user is typing or clicking
  (`view-transition-mount-cost.md`), for a swap CSS animates fine
  (`.toast[data-pending] .spinner`, a transition on `[data-type]`). Element-scoped view
  transitions (`Element.startViewTransition()`, Chromium 147 only) would fix the scope, not the
  lane; "not yet" in the research.
- **Making the exit a transition** so the exit could use `<ViewTransition>` as Popover's does.
  An exit on the transition lane would be held while any unrelated action is pending: the user
  presses Close and the toast stays. Rejected.

### 10.4 Starter stylesheet (docs, not shipped)

```css
.toasts {
  position: fixed; inset: auto 1rem 1rem auto; margin: 0; padding: 0; border: 0;
  display: flex; flex-direction: column-reverse; gap: .5rem; /* newest at the bottom */
  pointer-events: none;            /* the region's box never blocks the page */
}
.toast { pointer-events: auto; padding: 1rem; border-radius: .5rem; background: Canvas; color: CanvasText;
         box-shadow: 0 .5rem 2rem rgb(0 0 0 / .2); transition: opacity 200ms, translate 200ms; }
@starting-style { .toast { opacity: 0; translate: 0 1rem; } }
.toast[data-ending] { opacity: 0; translate: 0 1rem; }
.toast[data-pending] { cursor: progress; }
.toast[data-type="error"] { border-inline-start: 4px solid red; }
.toast:focus-visible { outline: 2px solid Highlight; }
.toasts[data-paused] .toast-progress { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) { .toast { transition: none; } }
```

---

## 11. Props and types

```ts
// src/toast/toast.ts (no directive: no React, no DOM beyond queueMicrotask)
export type ToastPriority = "normal" | "high";

export interface ToastActionOptions {
  readonly label: ReactNode;
  /** Runs in the Action part's transition; the toast closes when it resolves (section 3.2). */
  readonly action: Action<[ToastActionDetails]>;
}

export interface ToastOptions {
  /** Explicit id: an existing one updates that toast. Default: generated. */
  readonly id?: string;
  readonly title?: ReactNode;
  readonly description?: ReactNode;
  /** Free-form, rendered as `data-type` on the Root. */
  readonly type?: string;
  /** Announcement priority and role (`"high"`: `ariaNotify` high, `alertdialog`). Default `"normal"`. */
  readonly priority?: ToastPriority;
  /** ms before the toast closes with `reason: "timeout"`; `null` never. Default: the Viewport's `duration`, or `null` when `action` is set. */
  readonly duration?: number | null;
  readonly action?: ToastActionOptions;
  /** Called once when the toast leaves (section 9). */
  readonly closeAction?: Action<[ToastCloseDetails]>;
  /** The text `ariaNotify` speaks; `null` for nothing. Default: Title and Description text. */
  readonly announce?: (toast: ToastItem) => string | null;
  /** Anything the Viewport's children want to render. */
  readonly data?: unknown;
}

export interface ToastItem extends ToastOptions {
  readonly id: string;
  /** The `toast.promise` promise is unsettled, or an Action dispatched through this toast is in flight. */
  readonly pending: boolean;
  /** Closed; kept for its exit animation (section 10.2). */
  readonly ending: boolean;
}

export interface ToastActionDetails extends ActionDetails { readonly id: string; }
export interface ToastCloseDetails extends ActionDetails { readonly id: string; readonly reason: ChangeReason; } // "activate" | "dismiss" | "timeout"

export interface ToastPromiseOptions<T> {
  readonly pending: ToastOptions;
  readonly success?: ToastOptions | ((value: T) => ToastOptions);
  readonly error?: ToastOptions | ((reason: unknown) => ToastOptions);
  readonly id?: string;
}

export interface ToastManager {
  (options: ToastOptions): string;
  readonly add: (options: ToastOptions) => string;
  readonly promise: <T>(promise: PromiseLike<T>, options: ToastPromiseOptions<T>) => Promise<T | undefined>;
  readonly update: (id: string, options: Partial<ToastOptions>) => void;
  /** One toast, or every toast when `id` is omitted. `reason: "dismiss"`. */
  readonly dismiss: (id?: string) => void;
}

export function createToastManager(): ToastManager;
export const toast: ToastManager; // the default manager
```

```ts
// Viewport
export interface ToastViewportState {
  /** Rendered toasts, chronological, exiting ones included. */
  readonly toasts: readonly ToastItem[];
  /** Waiting beyond `limit`. */
  readonly queued: number;
  /** A viewport-wide pause condition holds (hover, focus inside, hidden document, blurred window). */
  readonly paused: boolean;
}
export interface ToastViewportProps extends Omit<HTMLAttributes<HTMLElement>, "children" | "className" | "style" | "onPointerEnter" | "onPointerLeave" | "onFocus" | "onBlur" | "onKeyDown"> {
  readonly manager?: ToastManager;          // default: the module-level one
  readonly limit?: number;                  // default 3
  readonly duration?: number | null;        // default 5000
  readonly hotkey?: readonly string[] | null; // default ["F8"]; event.code values and modifier names ("altKey")
  readonly announce?: (toast: ToastItem) => string | null;
  readonly children?: StateValue<ReactNode, ToastViewportState>;
  readonly className?: StateValue<string | undefined, ToastViewportState>;
  readonly style?: StateValue<CSSProperties | undefined, ToastViewportState>;
  readonly render?: RenderProp<HTMLAttributes<HTMLElement>, ToastViewportState>;
  readonly ref?: Ref<HTMLElement>;
}

// Root
export interface ToastRootState {
  readonly toast: ToastItem;
  readonly pending: boolean;   // toast.pending
  readonly ending: boolean;    // toast.ending
  readonly type: string | undefined;
  readonly priority: ToastPriority;
}
export interface ToastRootProps extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "className" | "style" | "onKeyDown"> {
  readonly toast: ToastItem;
  readonly children?: StateValue<ReactNode, ToastRootState>;
  readonly className?: StateValue<string | undefined, ToastRootState>;
  readonly style?: StateValue<CSSProperties | undefined, ToastRootState>;
  readonly render?: RenderProp<HTMLAttributes<HTMLDivElement>, ToastRootState>;
  readonly ref?: Ref<HTMLDivElement>;
}

// Title, Description: HTMLAttributes of their element, children defaulting to the toast's field.
// Action
export interface ToastActionState { readonly pending: boolean; readonly toast: ToastItem; }
export interface ToastActionProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className" | "style" | "onClick"> {
  readonly action?: Action<[ToastActionDetails]>;  // default toast.action?.action
  readonly closeOnSettle?: boolean;                 // default true
  readonly children?: StateValue<ReactNode, ToastActionState>; // default toast.action?.label
  // className / style / render / ref as above
}
// Close: ButtonHTMLAttributes minus onClick; state { toast }.
```

Viewport handlers the library uses (`onPointerEnter`, `onPointerLeave`, `onFocus`, `onBlur`,
`onKeyDown`) and the Root's `onKeyDown`, the buttons' `onClick`, are removed from the part types
(conventions 1.5); everything else passes through.

Public types, flat: `ToastOptions`, `ToastItem`, `ToastPriority`, `ToastActionOptions`,
`ToastActionDetails`, `ToastCloseDetails`, `ToastPromiseOptions`, `ToastManager`,
`ToastViewportProps`, `ToastViewportState`, `ToastRootProps`, `ToastRootState`,
`ToastTitleProps`, `ToastDescriptionProps`, `ToastActionProps`, `ToastActionState`,
`ToastCloseProps`, `ToastCloseState`. Namespace: `Toast = { Viewport, Root, Title, Description,
Action, Close }`, plus the named exports `toast` and `createToastManager` from
`@funstack/ui/toast` (and the root entry).

---

## 12. State model

| State | Owner | Kind | Lane | Exposed as |
| --- | --- | --- | --- | --- |
| The queue (items, order, `ending`, `pending` of a promise toast) | Viewport `useState`, written only through the manager's dispatcher and the Viewport's own handlers | library-owned, **urgent** (section 3.4) | urgent | `state.toasts`, `state.queued`; per Root `data-pending`, `data-ending`, `data-type` |
| Region shown | the top layer | browser-owned, driven by the library in both directions, never notified | – | `:popover-open` (no attribute) |
| Pause | Viewport, derived from DOM events and `document.visibilityState` | library-owned, urgent | urgent | `data-paused`, `state.paused` |
| Timers | Viewport ref map | internal | – | none |
| Action in flight | the Action part's `useActionTrigger` | transition | transition | `data-pending` on Action and Root (`toast.pending` is set by the Root while its Action runs, through context, so the Viewport pauses the timer) |
| `closeAction` in flight | Viewport `useTransition` | transition | transition | none (nothing visible waits) |
| Suspended content | Root, from the guard | internal | – | none; gates timer and announcement |
| Focus-return target | Viewport ref | internal | – | none |
| Modal container | module registry, read with `useSyncExternalStore` | library-owned, urgent | urgent | none |

`pending` on a Root has one meaning (conventions 4.1): work this toast reports on is in flight,
whether the promise given to `toast.promise` or an action dispatched through its Action part.
It is not set while content is merely suspended (that is the guard's job, and not a state).
`ending` is a new attribute row for conventions 4.1 (feedback 3).

---

## 13. SSR, directives, JS-free

- **Server render**: `Toast.Viewport` renders `<section popover="manual" aria-label="…">` with
  no children (the queue is empty on the server; `children(state)` is called with an empty
  state, so a consumer map renders nothing). The `popover` attribute serialises; the region is
  `display: none` until `showPopover()`. No `use(browser())`, no Suspense requirement.
- **Hydration**: the Viewport subscribes to the manager in an effect and drains the buffer of
  `toast()` calls made before it mounted (a Server Function result handled during hydration, a
  store firing early). Order preserved.
- **Server Components**: `<Toast.Viewport>` needs a function child, so it is rendered from a
  Client Component file (`notifications.tsx`) that a Server Component layout renders. `toast()`
  is client code; a Server Function returns data and the client calls `toast()` with it (section
  15.4). Passing `toast` to a Server Component is a type error like any function.
- **Directives**: every part file is `"use client"` (hooks, DOM). `toast.ts` (the manager and
  `createToastManager`) and `internal/modal-registry.ts` carry none: no React, no DOM API beyond
  `queueMicrotask`, so a Server Component may import `toast` for its type without a client
  reference, though calling it there is meaningless (the server has no viewport; a dev warning
  when `typeof document === "undefined"`).
- **JS-free**: none. A notification that must exist before hydration is `<p role="status">` in the
  consumer's markup.

---

## 14. Async walkthroughs and edge cases

1. **Toast from the sync prefix of a slow action.** `pressedChangeAction={async (next) => {
   toast({ title: "Saving…" }); await save(next); }}`: the toast appears in the next microtask
   (not after `save`), while the Toggle shows `data-pending`. The action's own transition is
   unaffected.
2. **Two actions pending, toast from a third place.** A form submit and a Toggle are pending; a
   WebSocket handler calls `toast()`. Urgent: visible at once. The same `toast()` wrapped in the
   consumer's own `startTransition` would be held until both settle; the microtask makes the
   wrapping irrelevant.
3. **Undo while its own toast's promise is still pending.** Impossible: the Action renders only
   from the settled options (`pending` toasts rarely carry one; if they do, the Action is a normal
   dispatch and the toast's `pending` stays true until both settle).
4. **Undo rejects.** The Action's transition rejects, `data-pending` leaves, the toast stays, the
   error reaches the boundary above the Viewport. With the boundary around the Viewport's list
   (section 15.3), the list re-renders in error state and the toast is still in the queue; the
   boundary's reset re-renders it.
5. **Undo clicked twice.** Two dispatches; `useActionTrigger` keeps the newest, surfaces the
   older's rejection (conventions 2.4); the first resolve closes the toast, the second's `then`
   finds it gone and does nothing (dismiss is idempotent).
6. **Close pressed while Undo is pending.** The toast closes (`"dismiss"`), the Action's
   transition keeps running to completion in the unmounted part; its `then` is a no-op, its
   rejection is reported through the hook's unmounted path (`reportError`), never swallowed.
7. **Promise toast whose promise never settles.** Stays `pending`, persistent; `toast.dismiss(id)`
   removes it; the returned promise is as unsettled as the input.
8. **`toast.update` on an ending or unknown id.** Ignored (dev warning for unknown).
9. **Timer elapses while the user is mid-Tab into the region.** `focusin` paused it first; the
   pause is applied synchronously in the event, before any timer callback can run.
10. **Modal opens with focus inside a toast.** The region moves into the dialog (remount), the
    dialog's focusing steps take focus; the Viewport's focus-return target is cleared on the
    `focusout` the remount causes. On the dialog's close, the region moves back and the dialog
    returns focus to its own opener.
11. **The Viewport unmounts with toasts in it.** Timers cleared, the manager keeps the items;
    a Viewport mounted later renders them (a route-level Viewport remounting on navigation does
    not lose an Undo). `closeAction`s do not run for an unmount.
12. **StrictMode.** The subscribe effect runs twice; the manager's `subscribe` is idempotent per
    Viewport instance and the buffer is drained once.
13. **A toast whose content suspends, then the promise toast settles before the reveal.** The
    `update` replaces the content; the guard unmounts with it; announcement and timer wait for the
    new content's commit.

---

## 15. Call-site examples

### 15.1 App shell (Server Component) and the client Viewport

```tsx
// app/layout.tsx (Server Component)
import { Notifications } from "./notifications";
export default function Layout({ children }) {
  return (<html lang="en"><body>{children}<Notifications /></body></html>);
}

// app/notifications.tsx
"use client";
import { Toast } from "@funstack/ui/toast";
import "./toast.css";

export function Notifications() {
  return (
    <Toast.Viewport className="toasts" announce={(t) => `${textOf(t.title)}. ${textOf(t.description) ?? ""}`}>
      {({ toasts }) =>
        toasts.map((t) => (
          <div className="toast-slot" key={t.id}>
            <Toast.Root toast={t} className={({ pending }) => `toast ${pending ? "toast-busy" : ""}`}>
              <Toast.Title />
              <Toast.Description />
              <Toast.Action className="toast-action" />
              <Toast.Close className="toast-close" aria-label="Close">×</Toast.Close>
            </Toast.Root>
          </div>
        ))
      }
    </Toast.Viewport>
  );
}
```

(`announce` is shown for the localisation shape; the default already reads the Title and
Description text.)

### 15.2 A toast that follows a Server Function

```tsx
"use client";
import { Menu } from "@funstack/ui/menu";
import { toast } from "@funstack/ui/toast";
import { archive, unarchive } from "./actions"; // "use server"

<Menu.Item
  action={() =>
    toast.promise(archive(id), {
      pending: { title: "Archiving…" },
      success: { title: "Archived", action: { label: "Undo", action: () => unarchive(id) } },
      error: (e) => ({ title: "Could not archive", description: String(e), priority: "high" }),
    })
  }
>
  Archive
</Menu.Item>
```

The item shows `data-pending` and the menu closes when `archive` settles; the toast tracks the
same promise. The Undo is itself a Server Function called from the Action part's transition.

### 15.3 Undo with inline failure handling, and the boundary

```tsx
"use client";
toast({
  title: "Archived",
  action: {
    label: "Undo",
    action: async ({ id }) => {
      try {
        await unarchive(itemId);
      } catch (e) {
        toast.update(id, { title: "Could not undo", description: String(e), priority: "high", action: undefined });
        throw e; // keep the toast: a resolved action would close it on settle
      }
    },
  },
});
```

The rethrow routes to the Error Boundary above the Viewport, so put one around the list and let
it render the queue with the failure visible:

```tsx
<Toast.Viewport>
  {({ toasts }) => (
    <ErrorBoundary fallback={<ToastListFallback />}>{toasts.map(renderToast)}</ErrorBoundary>
  )}
</Toast.Viewport>
```

Alternatively `closeOnSettle={false}` on the Action part and `toast.dismiss(id)` on success,
without throwing. Either way the trap in section 3.2 (catch, resolve, toast closes) is avoided.

### 15.4 A Server Function result in a form

```tsx
"use client";
import { useActionState, useEffect } from "react";
import { toast } from "@funstack/ui/toast";
import { saveProfile } from "./actions";

export function ProfileForm() {
  const [result, formAction, pending] = useActionState(saveProfile, null);
  useEffect(() => {
    if (result?.ok) toast({ title: "Profile saved" });
    else if (result?.error) toast({ title: result.error, priority: "high" });
  }, [result]);
  return <form action={formAction}>…</form>;
}
```

The effect runs after the action's commit; `toast()` is urgent, so it is visible even while
another action is still pending elsewhere.

### 15.5 Undo window (delayed commit)

See section 9.3.

### 15.6 Progress with `data-paused`, Tailwind, `render`

```tsx
<Toast.Viewport className="fixed bottom-4 right-4 flex flex-col-reverse gap-2 data-paused:[--play:paused]">
  {({ toasts }) =>
    toasts.map((t) => (
      <Toast.Root
        key={t.id}
        toast={t}
        className="rounded bg-white p-4 shadow data-pending:animate-pulse data-ending:opacity-0 data-[type=error]:border-l-4"
        render={<article />}
      >
        <Toast.Title className="font-semibold" />
        <Toast.Description className="text-sm" />
        {t.duration != null && <div className="toast-progress" style={{ animationDuration: `${t.duration}ms`, animationPlayState: "var(--play, running)" }} />}
        <Toast.Action className="underline" />
        <Toast.Close aria-label="Close">×</Toast.Close>
      </Toast.Root>
    ))
  }
</Toast.Viewport>
```

### 15.7 Isolated manager in a test

```tsx
const manager = createToastManager();
render(<Toast.Viewport manager={manager}>{({ toasts }) => toasts.map(renderToast)}</Toast.Viewport>);
act(() => { manager.add({ title: "Hello" }); });
await screen.findByRole("dialog", { name: "Hello" });
```

---

## 16. Test plan

### 16.1 jsdom (`toast.test.tsx`)

N/A rows (comment at the top of the file): controlled / uncontrolled parity and the post-await
rule (no controlled state; the queue is not an `x` / `defaultX` triple), optimistic + rollback
(nothing optimistic, section 3.6), platform path (no residual browser path), urgent action
(the queue is urgent but has no `UrgentChangeAction` prop; the urgency is tested under "Lanes").

| Area | What the test proves |
| --- | --- |
| Roles and ARIA | Viewport is a `region` named "Notifications (F8)" with `popover="manual"`; `aria-label` overrides; the name follows a custom `hotkey`; Root is `dialog`, `alertdialog` for `priority: "high"`, `tabindex="0"`, `aria-labelledby` / `aria-describedby` resolve to Title / Description; `data-type`; Title is not a heading. |
| Queue | `toast()` returns an id and renders a Root; explicit existing `id` updates; `update` changes content in place (same DOM node); `dismiss(id)`, `dismiss()`; `limit` renders N and `state.queued` counts the rest, a dismissal promotes the next in order; chronological DOM order. |
| Lanes | With an unrelated `useTransition` action pending (deferred), `toast()` called inside that action's sync prefix, inside a consumer `startTransition`, and plainly, all render before the action settles; order of three calls in one tick preserved. |
| Promise | `toast.promise`: pending options rendered with `data-pending` at once; `success` on resolve (object and function forms), `error` on reject; omitted `success` / `error` dismiss; the returned promise resolves with the value, resolves `undefined` on rejection with `error` given, rejects with the reason without it; `ariaNotify` called on settle with the new text and priority. |
| Sync action | `Toast.Action` calls `action(details)` with `details.id` and `details.event` the native click / keydown; `closeAction` receives `{ id, reason }`; Close dispatches `"dismiss"`; a disabled Action never dispatches; a default from `toast.action` and a prop `action` both work; no Action rendered without either. |
| Async action | While the Undo promise is unresolved: `data-pending` on Action and Root, the toast's timer does not elapse (fake timers advanced past `duration`); after resolve: the toast closes with `reason: "activate"`; `closeOnSettle={false}` keeps it. |
| Rejection | Undo rejects: the toast stays, `data-pending` gone, the error reaches an `<ErrorCatcher>` around the Viewport's list; caught-inside variant resolves and closes (the documented trap); caught-and-rethrown keeps the toast (15.3). |
| Overlap and superseded rejection | Two Undo dispatches resolved out of order: one close; the older rejecting after the newer resolved, and while the newer is pending, both reach the boundary (`useActionTrigger` wiring through the Root). |
| `closeAction` | Called once per close with each reason (`"activate"`, `"dismiss"` for Close / Escape / `dismiss()`, `"timeout"`); runs in a transition (a `useTransition` probe inside it is not needed; assert it is not called synchronously inside the dismissal click, and that its rejection reaches the boundary above the Viewport); not called on Viewport unmount. |
| Timers | Default 5000; Viewport `duration`; per-toast `duration`; `null` persistent; action toasts persistent by default and timed with `duration`; starts only when visible (queued beyond `limit`) and un-suspended; `update` with a new `duration` restarts. |
| Pausing | `pointerenter` / `pointerleave`, `focusin` / `focusout`, `visibilitychange` (hidden / visible), window `blur` / `focus` pause and resume with the remaining time; `data-paused` on the Viewport; a `pending` toast's timer alone is paused while its siblings run. |
| Keyboard | F8 focuses the newest toast and `preventDefault()`s; does nothing with no toasts; `hotkey={null}` installs no listener; `["altKey", "KeyT"]`; ArrowDown / ArrowUp between Roots, no wrap; Escape dismisses the toast containing focus; focus goes to the next toast, else previous, else the element focused before F8 (and before a Tab-in, through `relatedTarget`), else body. |
| Suspending content | A title that suspends: Root rendered with no `data-pending`, nothing announced, timer not started, the Viewport's other toasts unaffected and no consumer boundary above the Viewport shows its fallback; on reveal: announced, timer started. A consumer `<Suspense>` inside the Root shows its own fallback. |
| Announcements | `document.ariaNotify` stubbed: called after the add commit (not synchronously in the click), with Title + Description text and `{ priority }`; `announce` option and prop override, `null` silences; two adds in one tick → one call with both texts and the higher priority; `update` with unchanged text → no call; dismissal → no call; absent `ariaNotify` → no throw. |
| Exit | On close the Root stays with `data-ending` and `inert`; dropped in the same effect in jsdom (no animations); the region's `hidePopover` shim is called when the last item is dropped; `ending` items keep their position. |
| Function props and `render` | `className` / `style` / `children` / `render` on Viewport, Root, Action, Close receive the documented state; `render={<article />}` keeps the handlers and forwards `ref`. |
| Manager | `createToastManager()` isolation (two Viewports, two managers, no cross-talk); a second Viewport on the default manager warns and renders nothing; `toast()` before any Viewport is buffered and rendered on mount, once under StrictMode. |
| Modal registry | With the Dialog shim: a modal `Dialog` open → the region is a descendant of the `<dialog>` and `showPopover` was called again; on close → back inline and shown again; a Viewport rendered inside a Dialog warns. |
| Directive | Every part file starts with `"use client"`; `toast.ts` and `internal/modal-registry.ts` do not. |

jsdom facts to rely on (verified in earlier designs): no Popover API (`showPopover` shim from
`use-popover-hooks` tests), no `ariaNotify` (stub), no `getAnimations` (`exitAnimations` returns
`[]`), `document.hidden` writable through `Object.defineProperty` on `document` for the
visibility row.

### 16.2 Browser mode (`toast.browser.test.tsx`, Chromium, Firefox, WebKit)

| Row | Proves | Engine notes |
| --- | --- | --- |
| Top layer | The region is `:popover-open` after the first toast and not after the last leaves; adding a toast does not close an open `Menu`; a click on a toast light-dismisses an open `auto` Popover (expected). | none |
| Re-raise | Open a toast, open a `Popover` over it, add a toast: the new toast is hit-testable (`elementFromPoint` at its centre is inside it) and the Popover is still open; the existing toast's `getAnimations()` is empty right after the re-raise (no enter replay). | the fallback in 4.2 if an engine replays |
| Modal | Open a toast, open a modal `Dialog`: the toast's Undo is focusable and a real click reaches it (the region moved into the dialog); close the dialog: the region is back inline, visible, and the toast still interactive. | none expected (research verified Chromium and Firefox; WebKit on CI) |
| Enter and exit | With the starter CSS: a new Root has a running transition; after Close the Root stays with `data-ending` until `getAnimations()` settle, then is gone and the region hidden; `prefers-reduced-motion` emulation drops it immediately. | Firefox: no `display` transition on the region, irrelevant (it hides when empty) |
| Announcement | `document.ariaNotify` exists in all three engines (no throw, called once per add). | AT behaviour is the manual pass |
| No view transition | `document.startViewTransition` spied: zero calls for add, update, Close, Escape, Undo settle (there is no `transition` prop; this row guards against a stray boundary). | none |
| Focus | F8 focuses the newest toast in each engine; Escape returns focus to the button that had it. | none |

### 16.3 Manual

A screen-reader pass (NVDA + Chrome and Firefox, VoiceOver + Safari) recording what `ariaNotify`
speaks for an add, an update and a high-priority toast, and whether F8 / arrow navigation reads
each toast's name and description. Required before Toast leaves experimental (research §9).

---

## 17. Implementation notes

```
packages/ui/src/toast/
  index.ts                 # namespace, `toast`, `createToastManager`, type re-exports
  toast.ts                 # no directive: ToastManager, createToastManager, defaultManager, `toast`
  toast-context.ts         # "use client": ViewportContext (dispatch, focus, pause, register), RootContext (item, ids, register parts)
  toast-viewport.tsx       # "use client": queue state, subscription, timers, hotkey, pause, portal, popover apply effect, announcements, closeAction transition
  toast-root.tsx           # "use client": dialog element, Suspense guard, exit hold, keyboard, Action pending through context
  toast-title.tsx          # "use client"
  toast-description.tsx    # "use client"
  toast-action.tsx         # "use client": useActionTrigger
  toast-close.tsx          # "use client"
  toast.test.tsx
  toast.browser.test.tsx
packages/ui/src/internal/
  modal-registry.ts        # no directive: push / remove / subscribe / getTopmost
```

- **Manager.** `createToastManager()` returns a callable (`Object.assign(add, { add, promise,
  update, dismiss })`) over `{ listener: Dispatcher | null, buffer: Command[], nextId }`. Every
  method builds a command (`{ kind: "add" | "update" | "dismiss", … }`) and calls
  `queueMicrotask(() => flush())`; `flush` hands the batch to the listener or appends to the
  buffer. `subscribe(dispatcher)` from the Viewport's effect sets the listener, drains the
  buffer, and returns an unsubscribe; a second subscriber is the dev-warning case. Ids are
  `"fsui-toast-" + n` per manager. `promise` wraps: `const id = add(pending)`, then
  `promise.then(v => update(id, resolve(success, v)) or dismiss(id), e => update(id,
  resolve(error, e)) or dismiss(id))`, and returns a promise built from the same `then` that
  resolves `undefined` after an error update and rethrows when `error` is absent. The manager
  never touches React or the DOM; `queueMicrotask` is the only platform call.
- **Queue reducer** in the Viewport: `useState<{ items: Item[]; }>` with functional updates
  per command. `add` with an existing id → `update`. `dismiss` on an item → `ending: true` and
  `closeAction` scheduled (below); `drop(id)` removes it. Visible items are the first `limit`
  non-ending items plus every ending item; `queued` is the remainder's length.
- **`closeAction` dispatch.** The Viewport keeps one `useTransition`; on a close it runs
  `startTransition(async () => { await closeAction?.(createActionDetails(event, { id, reason })); })`
  from the handler or timer that caused it (never from render). Rejections take React's path to
  the boundary above the Viewport; nothing reads `pending`.
- **Timers.** A ref map; an effect keyed on the visible, non-pending, un-suspended ids starts
  missing timers and clears timers of ids that left; `pause()` records the remaining time and
  clears handles, `resume()` restarts them. Pause sources are counted (hover, focus, hidden,
  blur) in a ref with a `paused` state mirror for `data-paused`. The Root reports "suspended" and
  "action pending" through context so the Viewport's timer effect sees them as inputs.
- **Popover apply effect.** `useLayoutEffect` on `[hasItems, container]`: `showPopover()` when
  it has items and is not open (also after a container change: the element is new), `hidePopover()`
  when it has none and is open; re-raise on an add while open (a `addedSinceLastEffect` ref set
  by the reducer path). Guard every call with `isConnected` and `matches(":popover-open")`.
- **Portal.** `const container = useSyncExternalStore(modalRegistry.subscribe,
  modalRegistry.getTopmost, () => null)`; `container === null ? region :
  createPortal(region, container)`. The Dialog change: `dialog-popup.tsx` calls
  `modalRegistry.push(element)` after `showModal()` and `modalRegistry.remove(element)` in its
  `close` listener and unmount cleanup (two lines each; no behaviour change for Dialog).
- **Announcements.** The Root's effect after commit (and after the guard reports un-suspended)
  calls `viewport.announce(id, text, priority)`; the Viewport collects into a per-microtask
  batch and calls `document.ariaNotify?.(texts.join(" "), { priority })`. Last-announced text per
  id in a ref for the "unchanged" rule.
- **Root.** `<div role tabIndex={0} aria-labelledby aria-describedby data-* inert={ending}>`
  wrapped in nothing (no boundary); children inside `<Suspense fallback={<Guard />}>`. `Guard` is
  a component rendering `null` whose layout effect sets `suspended` in the Root's state on mount
  and clears it on unmount. Exit: on `ending` becoming true, `holdUntil(exitAnimations(el))` and,
  when `held` goes false, `viewport.drop(id)`. Keyboard: `onKeyDown` for Escape and arrows
  (`preventDefault()`; the arrows read the Viewport's registered Root elements sorted by
  `compareDocumentPosition`).
- **Action.** `useActionTrigger()`; `run(() => action(details), () => closeOnSettle &&
  viewport.dismiss(id, "activate", event))`; `pending` is reported to the Root through context
  (`setActionPending`), which merges it into `toast.pending` for its state and the Viewport.
- **Hotkey.** A document `keydown` listener in an effect keyed on the serialised `hotkey`;
  match: `hotkey.every(k => k in event ? event[k] === true : event.code === k)`.
- **Focus return.** `focusin` on the region with `relatedTarget` outside (or null) stores it;
  `focusout` to outside clears it. Before a close of the toast containing focus, compute the
  target (next, previous, stored, body) and `.focus()` it synchronously, then mark ending.
- **Dev warnings** (`useDevWarning`): second Viewport on one manager; Viewport inside a Dialog
  (`element.closest("dialog")`); `toast.update` on an unknown id; `Toast.Close` with no accessible
  name (text or `aria-label`); `toast()` on the server.
- **Shared code reused**: `useActionTrigger`, `useExitAnimation` / `exitAnimations`,
  `createActionDetails`, `dataAttr`, `useRender`, `useDevWarning`, `useLatest`,
  `platform-attributes` (nothing new needed: `popover`, `inert` are typed).

---

## 18. Conventions feedback (amendments this design needs)

1. **2.2 `ChangeReason`: add `"timeout"`** ("a close the library's own timer caused; no user, no
   platform event"). Toast is the first user. Also record that Toast's Close part dispatches
   `"dismiss"`, with the rationale in 9.1, so the "a close through a part is `activate`" rule
   reads "a close through a part that carries a decision".
2. **2.6 urgent updates: a third urgent state**, the Toast queue, with its reason (a transition
   push would be held by the action it reports on) and its mechanism (microtask dispatch from a
   manager, `useState` in the Viewport). Unlike the text input it has no `UrgentChangeAction`
   prop: its input is the imperative `toast()`.
3. **4.1 table**: `pending` row gains Toast's Root and Action (meaning: the promise given to
   `toast.promise` is unsettled or the toast's Action runs); new rows `ending` (Toast Root: closed,
   kept for its exit animation; `inert`), `paused` (Toast Viewport), and `type` (Toast Root,
   consumer-defined enum value).
4. **5.1**: a third category of part without a `transition` prop: parts whose every commit is on
   the urgent lane by design (Toast). 5.3: Toast emits no types.
5. **1.1 / 9.3**: a component may export a **function** alongside its namespace (`toast`,
   `createToastManager`) when its input is a command rather than an interaction; the namespace
   object stays parts-only.
6. **6 Suspense stance**: the one library-owned boundary, Toast's guard, with an invisible
   fallback; the rule "consumers own boundaries" otherwise unchanged, and the reason (urgent mount
   outside the consumer's tree) stated so it is not generalised.
7. **3.5**: a module-level registry (`internal/modal-registry.ts`) is an allowed shape for
   cross-component facts the DOM does not expose (the topmost modal dialog); Dialog writes, Toast
   reads through `useSyncExternalStore`. Also: the Toast region is a top-layer element the library
   drives in both directions and never notifies (no `openChangeAction`), a fourth row in the
   library-owned / browser-owned table.
8. **11 built-in strings**: two more: the region name `"Notifications (F8)"` (static; overridden
   by `aria-label`, since there is no state to be a function of) and the announcement default
   (Title + Description text, a function of the toast).
9. **10.1**: the N/A rows Toast declares (controlled parity, post-await, optimistic, platform
   path, urgent action) and the new "Lanes" row for urgent-by-design state.

---

## 19. For the product owner

Decisions a reviewer could reasonably make the other way. None blocks implementation; the design
proceeds as recommended unless overridden.

1. **Module-level `toast` singleton** (recommended) versus Base UI's explicit
   `createToastManager()` + `useToastManager()` only. The singleton reads best at every call
   site and needs no hook; `createToastManager` and the `manager` prop cover isolation. Risk: two
   libraries' "one global" habits; mitigated by the dev warning and the prop.
2. **`"timeout"` added to `ChangeReason`, and Toast's Close dispatching `"dismiss"`** (9.1,
   feedback 1). Alternative: a Toast-local `ToastCloseReason` union, which breaks the "one
   vocabulary" rule, or folding timeout into `"dismiss"`, which loses the information the Undo
   window pattern and analytics want. Recommended as designed.
3. **Default `duration` for a toast with an `action`: persistent** (recommended, WCAG 2.2.1 and
   the research) versus a longer timed default (10 s, Gmail-like). Sighted users get pause on
   hover and focus either way; screen-reader users only get the persistent default. Consumers who
   want Gmail's behaviour write `duration: 8000`. If overridden, the alternative is a Viewport
   `actionDuration` default rather than reusing `duration`.
4. **Swipe deferred** (recommended). Pointer tracking is the one thing this component would add
   that no other part has; Close and Escape satisfy 2.5.1; add `swipeDirection` once the example
   app runs on a phone.
5. **Focusable `dialog` / `alertdialog` Roots** (recommended; React Aria and Base UI) versus
   non-focusable list items with only the buttons tabbable (Sonner). The focusable Root is what
   makes F8 and arrow navigation read a toast; the cost is a tab stop per toast at the end of the
   document's order.
6. **Hotkey default F8** (Radix) rather than F6 (Base UI, React Aria). F6 is the browsers'
   pane-cycling key; taking it without landmark cycling is hostile. Recommended F8; `hotkey`
   changes it per app.
7. **Foreign modal dialogs not detected in v1.** Only the library's `Dialog` registers. A
   consumer with their own `<dialog>` gets an inert toaster while it is open (today's behaviour
   in every library). Recommended: ship with the limitation documented; add a `MutationObserver`
   if an issue asks.
8. **The library-owned Suspense guard** (feedback 6) is the one departure from "consumers own
   boundaries". The alternative, no guard, makes one suspending toast blank the app shell in the
   common Viewport-at-root layout. Recommended as designed; the fallback renders nothing, so no
   visible UI is shipped.
9. **`limit` default 3 with queueing** (Base UI, React Aria) versus dropping the oldest (Sonner's
   `visibleToasts` hides, Radix shows all). Queueing never loses an Undo. Recommended.
