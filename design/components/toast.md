# Toast

Status: **accepted** (proposed 2026-10-17, GitHub issue #54, wave 5; accepted by the product
owner on 2026-10-18 with the server-side no-op amendment, section 19). Implemented in
3266e4e..fa6e481 (merged at 03404ef). The review of that implementation (`memo/reviewer/toast.md`,
2805959; fixes in eeacdbf, docs page in 906702d, the developer's reasoning in
`memo/developer/toast.md` "Review fixes") is folded in on 2026-10-18 into the sections it touches
and audited in "Review corrections (#54)" at the end; the leftovers are GitHub issue #63, and
section 21 (`Toast.Root fallback`, for its timer item) was **accepted on 2026-10-18** and
awaits implementation. The code under
`packages/ui/src/toast/` is the ground truth where this document is silent. Follows
`design/conventions.md` (accepted, with the section 18 amendments applied); where this document
and the conventions disagree, the conventions win.

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
| 3 | Urgent queue | Every queue mutation (add, update, dismiss, drop after exit) is a normal (urgent) update, dispatched from a microtask so a `toast()` call inside a `startTransition` scope escapes it (research §7). The third documented urgent state after a controlled text input and virtual focus (conventions 2.6). Order is preserved, dismissals included: a `toast.dismiss()` closes the toasts open at that point of the batch and never one added later in the same tick (review H1). |
| 4 | Promise toasts | `toast.promise(promise, { pending, success, error })` shows `pending` at once with `data-pending`, swaps to `success` / `error` when the promise settles (urgent `update`), announces on settle, and starts the timer only then. It returns a promise that mirrors `promise`, **except** that a rejection is resolved (with `undefined`) when `error` was given: the error toast is the handler the consumer asked for. Returning the promise lets one call feed both the toast and the awaited action prop of the part that started the work (section 3.1). |
| 5 | Undo | `Toast.Action` is a pure-trigger action prop (`useActionTrigger`, like `Menu.Item`): `data-pending` on the Action and the Root while it runs, the toast's timer paused, the toast closed with `reason: "activate"` when it resolves (`closeOnSettle`, default `true`); a rejection keeps the toast and reaches the nearest Error Boundary above the Viewport. |
| 6 | `closeAction` | A per-toast action called when the toast leaves, with `details.reason`: `"activate"` (the Action part settled), `"dismiss"` (Close part, Escape, `toast.dismiss()`, a promise toast with no message for its outcome), or `"timeout"` (the timer elapsed; a new `ChangeReason` value, conventions feedback 1). Run inside the Viewport's own transition, not awaited by anything visible: the "commit the deletion when the Undo window elapses" pattern (section 9.3). |
| 7 | Top layer | One `popover="manual"` region, shown while it has toasts (exiting ones included), hidden when empty. Re-raised (`hidePopover(); showPopover()`) when a toast is added while it is already open, so a later-opened menu or popover does not cover new toasts. While a library `Dialog` is modal, the region is inside the topmost open modal `<dialog>` and back inline when it closes, because a top-layer region outside a modal dialog is inert and absent from the accessibility tree (research finding 1). Mechanism: the region always portals into a library-owned `display: contents` host element that the library itself moves with a DOM `append` (React never sees the move, so the toasts keep their React state: an Undo in flight stays pending; review M2) between an inline anchor and the topmost modal (a module-level registry Dialog writes to). |
| 8 | Announcements | `document.ariaNotify(text, { priority })` after the toast's content has committed un-suspended, coalesced per microtask, `priority: "high"` for `priority: "high"` toasts. No live region anywhere. The text defaults to the Title and Description text (`textContent` of the parts), overridable per toast or per Viewport through `announce(toast)` (built-in strings rule, conventions 11). |
| 9 | Timers | `duration` default 5000 ms; `null` for persistent. A toast with an `action` defaults to persistent (WCAG 2.2.1; product-owner question 3). Paused while the pointer is over the region, focus is inside it, the document is hidden, the window is blurred, the toast is `pending`, or it is queued beyond `limit`; resumed with the remaining time. |
| 10 | Keyboard | `hotkey` (default `["F8"]`, `event.code` / modifier names, Radix's shape, but an unlisted modifier held rejects the match: Ctrl+F8 is not F8, review L4; `null` disables) focuses the newest toast; Tab moves through toasts and their buttons in DOM order; ArrowDown / ArrowUp move between toasts; Escape dismisses the toast that contains focus. Focus leaving a dismissed toast goes to the next toast, else back to the element focused before the region was entered. The region's name is `"Notifications (F8)"` by default (`aria-label` overrides). |
| 11 | Stacking | `limit` (default 3) visible toasts; further toasts queue in order and show as earlier ones leave (never dropped). The DOM order is chronological; visual order is CSS. |
| 12 | Animation | Enter with `@starting-style` (CSS), exit with `data-ending` on the Root held until the animations **the ending state started** finish (animations already running before the close, a paused progress bar, are snapshotted and not waited for; review M1; a plain layout effect, not `useExitAnimation`), no `<ViewTransition>` and **no `transition` prop on any part**: every Toast commit is on the urgent lane, where react-dom never starts a view transition (conventions 5.1, third no-`transition` category). |
| 13 | Suspense guard | `Toast.Root` wraps its children in a `<Suspense>` whose fallback renders nothing visible: a toast whose content suspends shows an empty toast (consumers add their own skeleton boundary) instead of pulling the whole Viewport, which lives in an urgent commit, into the nearest consumer boundary. The toast's timer and announcement wait for the reveal, which commits while unrelated actions are pending (retry lane; probe). A consumer's own `<Suspense>` inside the Root catches first and is invisible to the guard: its reveal is announced (Title and Description report their commit, review M3) but the timer starts at mount; section 21 adds a `fallback` prop on the Root to close that gap (accepted 2026-10-18, implementation pending). The one deliberate exception to "the library never wraps children in `<Suspense>`" (conventions 6, feedback 6). |
| 14 | SSR and directives | Client-only behaviour: the Viewport server-renders the empty region (`popover` serialises; no hydration issue), on the client, `toast()` calls before the Viewport mounts are buffered; on the server (`typeof document === "undefined"`) a call is a **no-op with a dev warning, never buffered** (the module-level manager would otherwise hold a queue shared between requests). No JS-free mode (a toast cannot exist without JS). Every part file is `"use client"`; `toast.ts` (the manager) has no directive and no React import. |

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
| `Viewport` | `section` with `popover="manual"` | `region` (named section), `aria-label="Notifications (F8)"` by default | `data-paused`, `data-empty` | Owns the queue state, timers, hotkey, pause, focus return, the portal host (on the client the region sits inside two `display: contents` `div`s: an anchor where the Viewport is rendered and the host the library moves into a modal dialog, section 4.3), re-raise, announcements. `children` is a function of `ToastViewportState` (or a node, for a fixed layout). |
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
| `success` or `error` is a function that throws | The toast is dismissed (`reason: "dismiss"`), never left `pending`. The returned promise **rejects with what the function threw** (review M4). Not the `error` toast: the operation's outcome is known, its message is not, and an error message would misreport a fulfilment. | The item's action rejects: the consumer's bug reaches the boundary. |

Rules:

- `toast.promise<T>(promise: PromiseLike<T>, options): Promise<T | undefined>`. The returned
  promise settles when `promise` settles, in the same tick, so an awaiting action prop shows
  pending for exactly as long as the toast does.
- `success` and `error` are options objects or functions of the value / reason; both optional.
  An omitted `success` dismisses the toast on fulfilment, an omitted `error` dismisses it on
  rejection and rethrows, as in the table. A `success` or `error` **function that throws**
  dismisses the toast and the returned promise rejects with what it threw (review M4; before the
  fix the throw escaped `then` before anything was dispatched and the toast stayed `data-pending`
  forever).
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
| Drop after exit animation | the Root's exit layout effect, once the animations the ending state started have settled (section 10.2) | urgent |

The microtask preserves order (React applies queued updates in dispatch order, and the Viewport
applies one tick's commands in order, **dismissals included**: `toast.dismiss(); toast({ title })`
in one action body shows the new toast, `toast.dismiss("sync"); toast({ id: "sync", … })`
replaces the old one; review H1, where the first implementation applied the dismissals after the
adds, so the new toast closed at once and its `closeAction` ran with `"dismiss"`) and costs one
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

A consumer boundary inside the Root changes what the guard can see: its fallback never mounts, so
to the Root the toast looks like one whose content committed at once. What still works is the
**announcement**. `Toast.Title` and `Toast.Description` report their commit to the Root from a
`[]` layout effect (mount, and re-show after a boundary inside the Root hid them); after the
Root's first announcement effect has run, such a report queues one microtask that re-runs the
announcement, so a Title and a Description revealed together are announced as one text, and the
text the guard would have missed is spoken when the consumer's skeleton gives way (review M3).
What does not work is the **timer**: it starts at mount, while the skeleton shows. Nothing
committed tells the library that a consumer boundary is showing its fallback (a Title that never
mounted looks the same as a toast without one), and the alternative, a render-phase "Title
rendered but not committed" flag, can be left set by a discarded render and freeze a toast
forever. The docs say so next to the skeleton recipe; section 21 proposes a `fallback` prop on
the Root so the skeleton can live in the library's own boundary, which does see it (GitHub issue
#63; accepted 2026-10-18, implementation pending).

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
- The region is **always portalled into a library-owned host element** on the client: a `div`
  with `display: contents` that the Viewport creates once (`useState`) and `createPortal`s the
  region into for its whole client life. The library moves the host itself, with a DOM `append`,
  in a layout effect that runs on every commit: into the topmost modal (read with
  `useSyncExternalStore(subscribe, getTopmost, () => null)`) when there is one, back into an
  inline **anchor** (`<div style="display: contents">`, rendered where the Viewport is) when
  there is none. React never sees the move, so every Root, Action and `useActionTrigger` keeps
  its state across it: an Undo in flight stays `data-pending` and its toast's timer stays paused
  (review M2). The first shape, `container === null ? region : createPortal(region, container)`,
  remounted the whole subtree on each move (as `createPortal` also does when its container
  changes: react-dom compares `containerInfo`), which cleared the Action's pending flag and let a
  timed Undo toast expire during the undo.
- A move is still a DOM move. Removing a popover from the document hides it, so the host-move
  effect is declared before the region effect, which runs `showPopover()` again in the same
  commit. Focus inside a toast at that moment is lost (a removal fires no `focusout`; the
  per-commit effect clears the focus pause when focus is no longer inside); the dialog's own
  focusing steps take it anyway. The toasts' `@starting-style` replays on the move (the elements
  were removed and re-inserted); acceptable, and the only visible cost. The two wrappers have no
  box and no role.
- Hydration: the server renders the region inline (react-dom's server renderer has no portals).
  The hydration render matches it (`useSyncExternalStore(subscribeNothing, () => true, () =>
  false)`: the server snapshot, used for the hydration render too, says "inline"), then the
  first client render switches to the anchor plus the portal: one remount, with an empty queue
  (the manager subscription is a passive effect, so nothing is in the queue yet and nothing is
  lost). A client-only root portals from its first render.
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
| Toast added (or shown from the queue beyond `limit`: announced on **add**, the message is timely even if the box is not yet visible) | `announce(toast)` | `toast.priority` (`"normal"` default, `"high"` → `{ priority: "high" }`) | In an effect after the Root's content has committed un-suspended (section 3.5; a Title or Description revealed by a consumer boundary inside the Root reports its commit and is announced then, review M3), never in the click handler (macOS VoiceOver drops an announcement that coincides with the click's own events, research §2) |
| `toast.update` / promise settle | the new text, only if it differs from the last announced text for that id | the new priority | same |
| Dismissal, timeout | nothing | – | – |
| Viewport remount with retained toasts (section 14 item 11) | nothing: the manager carries the last announced text per toast (`RetainedToast.announced`) and the next Viewport seeds its "last announced" map from it (review L1) | – | – |
| `toast({ id })` on an **ending** toast with the same text | the text again: the replaced entry's last-announced text is cleared (review L7) | the new priority | as for an add |
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
| Starts | when the toast is visible (within `limit`), its content has committed un-suspended **as far as the library's guard can see** (a consumer `<Suspense>` inside the Root is not seen: the timer runs while its skeleton shows, section 3.5 and 21), and it is not `pending`; `duration` is read then, so an `update` that changes `duration` restarts; a `toast({ id })` that replaces an ending toast gets a fresh timer |
| `duration` | ms; Viewport `duration` is the default (5000); `null` is persistent. A toast with an `action` is persistent unless `duration` is given (decision 9, question 3) |
| Paused while | pointer over the region (`pointerenter` / `pointerleave` on the section; touch lifts the pointer, so a tap does not stick; the hover pause also ends when the region empties or its host moves, which deliver no `pointerleave`, #63 L3), focus inside the region (`focusin` / `focusout`), `document.hidden`, window `blur` (from the first `blur` event only: the pause is not seeded from `document.hasFocus()` at mount, #63 L6), the toast `pending` (promise unsettled or Action running) |
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
| `hotkey` (default F8) | document | The match requires every listed key and modifier **and no unlisted modifier** (Ctrl+F8, Alt+F8 and Shift+F8 are not F8; Radix accepts them, review L4), so a browser or OS chord that shares the key is left alone. If the region has toasts: `preventDefault()`, remember `document.activeElement`, focus the newest visible toast's Root. If it has none: nothing (the browser keeps the key). `hotkey={null}` installs no listener. |
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
  lost to a burst). A dismissed toast that has no Root yet (queued, or added in the same tick)
  leaves at once, without rendering as an ending Root; its `closeAction` still runs (#63 L5).
  `limit: Infinity` renders everything.
- Order: `state.toasts` and the DOM are chronological (oldest first). Visual stacking is CSS:
  `flex-direction: column-reverse` for a bottom-anchored stack, `:nth-last-child(1)` for the
  newest, `:nth-last-child(n+4)` to collapse older ones. No `data-index`: `:nth-last-child` is
  exact and the library emits no positional attribute (conventions 4.2, pseudo-classes over
  attributes).
- Exiting toasts stay in `state.toasts` with `ending: true` until their animations finish
  (section 10.2), so a stack can animate the gap closing (`grid-template-rows: 1fr → 0fr`).
- A `toast.update` on an id keeps its position. A `toast()` with an explicit `id` that already
  exists is an update (useful for "one toast per key": `toast({ id: "sync", … })`). A `toast()`
  with the `id` of an **ending** toast replaces it: the ending entry is removed and a new one
  appended, with a fresh timer and a fresh announcement (its last-announced text is cleared,
  review L7) and no exit hold for the old one. When both happen in one tick
  (`toast.dismiss("sync"); toast({ id: "sync", … })`) the keyed Root is reused, so focus is not
  moved out and no exit baseline is taken, but the replaced entry's `closeAction` still runs with
  `"dismiss"`.
- The commands of one tick apply in order, dismissals included (section 3.4, review H1): a
  `toast.dismiss()` never touches a toast added after it in the same batch.

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
| Promise toast whose `success` / `error` function threw (section 3.1) | `"dismiss"` | `undefined` | library |
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
Right before that write, still in the closing handler, the Viewport **snapshots the animations
already running** in the toast (`root.getAnimations({ subtree: true })`, a style flush; kept per
id as the *exit baseline* until the toast is dropped or replaced). The Root renders
`data-ending`; in its layout effect it reads `exitAnimations(element)` (the shared helper: a
style flush, then the finite animations in the subtree), **drops every animation in the
baseline**, waits for the rest with `Promise.allSettled`, then asks the Viewport to drop the
item. Nothing left to wait for: dropped in the same effect. The region hides only when the last
item is dropped.

The rule is therefore: **the exit waits only for animations the ending state started.** They are
compared by animation object, not by `startTime` or `pending`: a progress bar paused under
`[data-paused]` (section 15.6, the documented recipe) has `startTime === null` exactly like a
just-created animation, so the timeline cannot tell them apart and identity can. A transition
the ending style retargets is a new `CSSTransition` object, so it is waited for. Without the
baseline, Close clicked over a 5 s progress bar held the invisible, inert toast (and the region,
and `data-empty`) until the pointer left and the bar finished (review M1). Cost: one
`getAnimations()` per close, in the closing handler. The hold is a plain layout effect rather
than `useExitAnimation`: the item lives in the Viewport's queue, and the hook's `held` flag would
need a re-render to observe the release (a `true` → `false` pair batched into one render would
never drop). An ending entry with no registered Root (never shown) is dropped by the Viewport's
own layout effect.

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
  /** Omitted: dismissed on fulfilment. A function that throws dismisses the toast and the returned promise rejects with what it threw. */
  readonly success?: ToastOptions | ((value: T) => ToastOptions);
  /** Omitted: dismissed on rejection, the returned promise rejects with the reason. A throwing function: as for `success`. */
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
  readonly hotkey?: readonly string[] | null; // default ["F8"]; event.code values and modifier names ("altKey"); unlisted modifiers must be up
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
| Modal container | module registry, read with `useSyncExternalStore`; the region's host `div` is moved by the library (section 4.3), never re-created | library-owned, urgent | urgent | none |
| Exit baseline (the animations running before the close) | Viewport ref map, per ending id | internal | – | none; filters the exit hold (section 10.2) |
| Content committed (a Title / Description inside a consumer boundary) | Root, from the parts' layout effects | internal | – | none; re-runs the announcement (section 3.5) |

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
  `toast()` calls made **on the client** before it mounted (a Server Function result handled
  during hydration, a store firing early). Order preserved. The buffer is client-only (next
  bullet). The hydration render keeps the region inline to match the server HTML; the first
  client render after it moves the region into the portal host (section 4.3).
- **A second Viewport on a taken manager** renders nothing from its first render (`isTaken`,
  read during render) and installs no document listeners. Two Viewports mounted in the same
  commit still render the second region once (neither has subscribed yet), and the server always
  renders it: the dev-warning case, cosmetic (review L8, partial). Not fixed (#63): that region
  is a closed `popover` (`display: none`, outside the accessibility tree) with an empty queue, so
  it is never shown, and it is gone after the next commit; claiming the manager earlier would
  mean a render-phase side effect or a layout-effect subscription (which changes the hydration
  order of section 4.3).
- **Server Components**: `<Toast.Viewport>` needs a function child, so it is rendered from a
  Client Component file (`notifications.tsx`) that a Server Component layout renders. `toast()`
  is client code; a Server Function returns data and the client calls `toast()` with it (section
  15.4). Passing `toast` to a Server Component is a type error like any function.
- **Directives**: every part file is `"use client"` (hooks, DOM). `toast.ts` (the manager and
  `createToastManager`) and `internal/modal-registry.ts` carry none: no React, no DOM API beyond
  `queueMicrotask`, so a Server Component may import `toast` for its type without a client
  reference. **A `toast()` call on the server is a no-op with a dev warning and is never
  buffered** (product-owner amendment): the default manager is module-level, so a server-side
  buffer would be a queue shared between requests, leaking memory and one user's data to
  another. Every manager method checks `typeof document === "undefined"` first; the pre-mount
  buffer exists on the client only.
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
10. **Modal opens with focus inside a toast.** The library moves the region's host into the
    dialog (a DOM move, no remount: a pending Undo stays pending, its timer paused), the dialog's
    focusing steps take focus; the Viewport's focus pause and focus-return target are cleared by
    the per-commit effect (a removal fires no `focusout`). On the dialog's close, the host moves
    back and the dialog returns focus to its own opener.
11. **The Viewport unmounts with toasts in it.** Timers cleared, the manager keeps the items;
    a Viewport mounted later renders them (a route-level Viewport remounting on navigation does
    not lose an Undo). `closeAction`s do not run for an unmount. The manager also carries the
    last announced text per toast, so the later Viewport does not announce them again (review
    L1).
12. **StrictMode.** The subscribe effect runs twice; the manager's `subscribe` is idempotent per
    Viewport instance and the buffer is drained once.
13. **A toast whose content suspends, then the promise toast settles before the reveal.** The
    `update` replaces the content; the guard unmounts with it; announcement and timer wait for the
    new content's commit.
14. **`toast.dismiss(); toast({ title: "Saved", closeAction })` in one action body.** Both
    commands land in one microtask batch and apply in order: the dismissal closes what was open,
    the add appends "Saved", which shows and keeps its `closeAction` for later (review H1). The
    explicit-id variant, `toast.dismiss("sync"); toast({ id: "sync", … })`, replaces the toast:
    the old entry's `closeAction` runs with `"dismiss"`, the new one has a fresh timer and
    announcement, and the keyed Root is reused (section 8). `toast(); toast.dismiss()` in one
    tick closes the new toast too: order, not kind, decides.
15. **`toast.promise` whose `success` renderer throws** (`success: (r) => ({ title: r.name })`
    with `r` undefined). The toast is dismissed and the returned promise rejects with the
    `TypeError`; the awaiting action prop rejects and its boundary shows it. Before the fix the
    toast stayed `data-pending` forever (review M4).
16. **Title inside the consumer's `<Suspense>` in the Root** (`title: <Avatar />` behind a
    skeleton). The Root commits with the skeleton, nothing is announced, the timer starts
    (section 3.5); when the avatar's data arrives the boundary reveals the Title, which reports
    its commit, and the toast is announced then (review M3). The timer gap is section 21's
    proposal.
17. **Undo in flight when a modal opens, timed toast** (the 9.3 Gmail shape with
    `duration: 8000`, an Undo that opens a confirm `Dialog` and awaits it). The host moves into
    the dialog; the Action keeps its `useActionTrigger` state, the Root keeps `data-pending`, the
    timer stays paused; the Undo settles, the toast closes with `"activate"`, `deleteForReal`
    never runs. Before the fix the remount reset the pending flag and the timer could expire
    during the undo (review M2).

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
| Queue | `toast()` returns an id and renders a Root; explicit existing `id` updates; `update` changes content in place (same DOM node); `dismiss(id)`, `dismiss()`; `limit` renders N and `state.queued` counts the rest, a dismissal promotes the next in order; chronological DOM order; `dismiss()` then `toast()` in one tick shows the new toast, `dismiss(id)` then `toast({ id })` replaces it (the old `closeAction` runs with `"dismiss"`), `toast()` then `dismiss()` closes the new one too (review H1); a dismissed queued toast, or one added and dismissed in one tick, is never rendered (#63 L5). |
| Lanes | With an unrelated `useTransition` action pending (deferred), `toast()` called inside that action's sync prefix, inside a consumer `startTransition`, and plainly, all render before the action settles; order of three calls in one tick preserved. |
| Promise | `toast.promise`: pending options rendered with `data-pending` at once; `success` on resolve (object and function forms), `error` on reject; omitted `success` / `error` dismiss; the returned promise resolves with the value, resolves `undefined` on rejection with `error` given, rejects with the reason without it; `ariaNotify` called on settle with the new text and priority; a throwing `success` / `error` function dismisses the toast and the returned promise rejects with what it threw (review M4). |
| Sync action | `Toast.Action` calls `action(details)` with `details.id` and `details.event` the native click / keydown; `closeAction` receives `{ id, reason }`; Close dispatches `"dismiss"`; a disabled Action never dispatches; a default from `toast.action` and a prop `action` both work; no Action rendered without either. |
| Async action | While the Undo promise is unresolved: `data-pending` on Action and Root, the toast's timer does not elapse (fake timers advanced past `duration`); after resolve: the toast closes with `reason: "activate"`; `closeOnSettle={false}` keeps it. |
| Rejection | Undo rejects: the toast stays, `data-pending` gone, the error reaches an `<ErrorCatcher>` around the Viewport's list; caught-inside variant resolves and closes (the documented trap); caught-and-rethrown keeps the toast (15.3). |
| Overlap and superseded rejection | Two Undo dispatches resolved out of order: one close; the older rejecting after the newer resolved, and while the newer is pending, both reach the boundary (`useActionTrigger` wiring through the Root). |
| `closeAction` | Called once per close with each reason (`"activate"`, `"dismiss"` for Close / Escape / `dismiss()`, `"timeout"`); runs in a transition (a `useTransition` probe inside it is not needed; assert it is not called synchronously inside the dismissal click, and that its rejection reaches the boundary above the Viewport); not called on Viewport unmount. |
| Timers | Default 5000; Viewport `duration`; per-toast `duration`; `null` persistent; action toasts persistent by default and timed with `duration`; starts only when visible (queued beyond `limit`) and un-suspended; `update` with a new `duration` restarts. |
| Pausing | `pointerenter` / `pointerleave`, `focusin` / `focusout`, `visibilitychange` (hidden / visible), window `blur` / `focus` pause and resume with the remaining time; `data-paused` on the Viewport; a `pending` toast's timer alone is paused while its siblings run; the hover pause ends when the region empties under the pointer (#63 L3). |
| Keyboard | F8 focuses the newest toast and `preventDefault()`s; does nothing with no toasts; `hotkey={null}` installs no listener; `["altKey", "KeyT"]`; ArrowDown / ArrowUp between Roots, no wrap; Escape dismisses the toast containing focus; focus goes to the next toast, else previous, else the element focused before F8 (and before a Tab-in, through `relatedTarget`), else body; Ctrl+F8 (an unlisted modifier) is ignored (review L4). |
| Suspending content | A title that suspends: Root rendered with no `data-pending`, nothing announced, timer not started, the Viewport's other toasts unaffected and no consumer boundary above the Viewport shows its fallback; on reveal: announced, timer started. A consumer `<Suspense>` inside the Root shows its own fallback, and the toast is announced once that boundary reveals the Title (review M3; the timer is not gated by it, #63). |
| Announcements | `document.ariaNotify` stubbed: called after the add commit (not synchronously in the click), with Title + Description text and `{ priority }`; `announce` option and prop override, `null` silences; two adds in one tick → one call with both texts and the higher priority; `update` with unchanged text → no call; dismissal → no call; absent `ariaNotify` → no throw. |
| Exit | On close the Root stays with `data-ending` and `inert`; dropped in the same effect in jsdom (no animations); the region's `hidePopover` shim is called when the last item is dropped; `ending` items keep their position; an animation running before the close (a progress bar, `getAnimations` stubbed on the Root) is not waited for (review M1). |
| Function props and `render` | `className` / `style` / `children` / `render` on Viewport, Root, Action, Close receive the documented state; `render={<article />}` keeps the handlers and forwards `ref`. |
| Manager | `createToastManager()` isolation (two Viewports, two managers, no cross-talk); a second Viewport on the default manager warns and renders nothing; `toast()` before any Viewport is buffered and rendered on mount, once under StrictMode; with `document` undefined (a `// @vitest-environment node` row or a deleted global) every method is a no-op that warns once and leaves the buffer empty; a second Viewport added while another holds the manager never renders its region, from its first render on (review L8); a Viewport remount does not announce a restored toast again (review L1); two Viewports mounted in one commit never show the second region (#63 L8); a `manager` prop change shows the new manager's retained toasts and keeps the two queues apart (#63 L2). |
| Modal registry and portal host | With the Dialog shim: a modal `Dialog` open → the region is a descendant of the `<dialog>` and `showPopover` was called again; on close → back inline and shown again; the toasts' React state survives the move (an Undo in flight stays `data-pending`, its timer paused, review M2); a move that hid the popover shows it again in the same commit (jsdom's shim keeps a popover open across a synchronous `append`, so that row stubs `append` to hide like a browser); a move ends the hover pause (#63 L3); `hydrateRoot` on the server's inline region hydrates without a mismatch, then portals and renders toasts; a Viewport rendered inside a Dialog warns. |
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
| Enter and exit | With the starter CSS and a long (5 s) exit, so the assertions cannot race the wall clock (the wall-clock version was the flake in #62): a new Root has a running transition; after Close the Root stays with `data-ending`; `finish()` on the captured animations drops it and hides the region; `prefers-reduced-motion` emulation drops it immediately. A 5 s progress bar paused under `data-paused` does not hold the exit (review M1). | Firefox: no `display` transition on the region, irrelevant (it hides when empty) |
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
  method first returns (no-op, dev warning) when `typeof document === "undefined"`, so a server
  never buffers; otherwise it builds a command (`{ kind: "add" | "update" | "dismiss", … }`) and
  calls `queueMicrotask(() => flush())`; `flush` hands the batch to the listener or appends to
  the client-only buffer. `subscribe(dispatcher)` from the Viewport's effect sets the listener, drains the
  buffer, and returns an unsubscribe; a second subscriber is the dev-warning case. Ids are
  `"fsui-toast-" + n` per manager. `promise` wraps: `const id = add(pending)`, then
  `promise.then(v => update(id, resolve(success, v)) or dismiss(id), e => update(id,
  resolve(error, e)) or dismiss(id))`, and returns a promise built from the same `then` that
  resolves `undefined` after an error update and rethrows when `error` is absent; the resolution
  runs inside a `settle` helper whose `catch` dismisses the toast and rethrows (review M4). The
  unsubscribe asks the listener to `retain()` its non-ending entries (options, `pending`, the
  last announced text) for the next subscriber's `restore` (review L1); `isTaken(listener)` is
  readable during render for the second-Viewport case (review L8). The manager never touches
  React or the DOM; `queueMicrotask` is the only platform call.
- **Queue reducer** in the Viewport: `useState` plus an authoritative `entriesRef` written
  together, so a burst of commands composes and side effects stay out of updaters. The commands
  of one batch apply **in order inside the loop, dismissals included** (`dismiss` marks the
  entries open at that point `ending: true`); the side effects run after the loop: `moveFocusOut`
  and the exit-baseline snapshot for the ids that actually leave (not one replaced by a later
  add in the same batch), `closeAction` for every dismissed entry (review H1). `add` with an
  existing non-ending id → `update`; with an ending id → the entry is replaced and its timer,
  last-announced text and exit baseline are cleared (review L7). `drop(id)` removes an ending
  entry. Visible items are the first `limit` non-ending items plus every ending item; `queued`
  is the remainder's length.
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
- **Portal host.** `const container = useSyncExternalStore(modalRegistry.subscribe,
  modalRegistry.getTopmost, () => null)`; `const [host] = useState(createHost)` (a
  `display: contents` `div`, `null` on the server); `portalled =
  useSyncExternalStore(subscribeNothing, () => true, () => false)` tells the hydration render
  from a client render. Render: inline while `!portalled`, else `<><div ref={anchorRef}
  style="display: contents" />{createPortal(content, host)}</>`. A per-commit layout effect,
  declared **before** the region effect, does `(container ?? anchor).append(host)` when the host
  is not already there; the region effect then re-shows the popover the move hid (review M2).
  The host is removed on unmount. The Dialog change: `Dialog.Popup` calls
  `useModalRegistration(dialog)` (one hook, one import), which reads `:modal` after
  `beforetoggle` (a microtask later) and on `toggle` / `close`, so every way of opening counts.
- **Announcements.** The Root's effect after commit (and after the guard reports un-suspended)
  calls `viewport.announce(id, text, priority)`; the Viewport collects into a per-microtask
  batch and calls `document.ariaNotify?.(texts.join(" "), { priority })`. Last-announced text per
  id in a ref for the "unchanged" rule, seeded from `RetainedToast.announced` on `restore`
  (review L1). The Root's announcement is a **layout** effect (visible toasts announce before
  the Viewport's effect announces the queued ones: dispatch order). `Toast.Title` and
  `Toast.Description` call `root.contentCommitted()` from a `[]` layout effect; after the Root's
  first announcement effect has run, that queues one microtask which re-runs the announcement
  (coalesced, so a Title and a Description revealed together produce one text), which is how a
  reveal inside a consumer `<Suspense>` is announced (review M3).
- **Root.** `<div role tabIndex={0} aria-labelledby aria-describedby data-* inert={ending}>`
  wrapped in nothing (no boundary); children inside `<Suspense fallback={<Guard />}>`. `Guard` is
  a component rendering `null` whose layout effect sets `suspended` in the Root's state on mount
  and clears it on unmount. Exit: on `ending` becoming true, `exitAnimations(el)` filtered by
  `viewport.exitBaseline(id)` (section 10.2), `Promise.allSettled`, then `viewport.drop(id)`
  (guarded against a cancelled effect; idempotent; the baseline is kept until the drop so a
  StrictMode effect re-run sees it too). Keyboard: `onKeyDown` for Escape and arrows
  (`preventDefault()`; the arrows read the Viewport's registered Root elements sorted by
  `compareDocumentPosition`).
- **Action.** `useActionTrigger()`; `run(() => action(details), () => closeOnSettle &&
  viewport.dismiss(id, "activate", event))`; `pending` is reported to the Root through context
  (`setActionPending`), which merges it into `toast.pending` for its state and the Viewport.
- **Hotkey.** A document `keydown` listener in an effect keyed on the serialised `hotkey`;
  match: every modifier flag on the event equals "listed in `hotkey`" (so an unlisted modifier
  held rejects, review L4), and every non-modifier entry equals `event.code`.
- **Focus return.** `focusin` on the region with `relatedTarget` outside (or null) stores it;
  `focusout` to outside clears it. Before a close of the toast containing focus, compute the
  target (next, previous, stored, body) and `.focus()` it synchronously, then mark ending.
- **Dev warnings** (`useDevWarning`): second Viewport on one manager; Viewport inside a Dialog
  (`element.closest("dialog")`); `toast.update` on an unknown id; `Toast.Close` with no accessible
  name (text or `aria-label`); `toast()` on the server.
- **Shared code reused**: `useActionTrigger`, `exitAnimations` (not the `useExitAnimation`
  hook, section 10.2),
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
10. **6 Suspense stance** (added 2026-10-18 with section 21): the one library-owned boundary
    gains the one `fallback` prop, under the rule "`fallback` exists only where the library owns
    the boundary, which is Toast alone", with the precedent risk named. Applied.

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

**Accepted by the product owner (2026-10-18):** all nine recommendations as written. One amendment: a `toast()` call on the server (`typeof document === "undefined"`) must be a no-op with a dev warning. It must **not** be buffered: the default manager is module-level, so on a server it would build up a queue shared between requests (leaking memory and data between users). The pre-mount buffer is for the client only.

---

## 20. Review corrections (#54, 2026-10-18)

From `memo/reviewer/toast.md` (review of 3266e4e..fa6e481, merged at 03404ef; commit 2805959) and
the developer's reasoning in `memo/developer/toast.md` "Review fixes"; code and tests in eeacdbf,
the docs page in 906702d. Each item is folded into the sections named; this table is the audit
trail. The architect agrees with every choice the developer made; none is corrected here. The
leftovers are GitHub issue #63.

| Item | Correction | Section |
| --- | --- | --- |
| H1 | Dismissals apply **in batch order**: the Viewport's `apply` marks entries ending inside the command loop, so `toast.dismiss()` (all) and `toast.dismiss(id)` close what is open at that point of the batch and never a toast added later in the same tick. Side effects run after the loop: focus move and exit-baseline snapshot only for ids that actually leave (a `dismiss(id); toast({ id })` pair keeps its keyed Root), `closeAction` for every dismissed entry (the replaced one included, `"dismiss"`). Before: dismissals were applied after every add, so `toast.dismiss(); toast({ title: "Saved", closeAction })` never showed "Saved" and ran its `closeAction` at once (`deleteForReal` in the 9.3 pattern). | Decisions 3, 3.4, 8, 14.14, 16.1, 17 |
| M1 | The exit hold **excludes animations already running before `data-ending`**, compared by animation object: the Viewport snapshots `root.getAnimations({ subtree: true })` in the closing handler, before the ending write, and the Root's exit effect filters `exitAnimations(element)` by that baseline. Identity rather than `startTime` / `pending` because a progress bar paused under `[data-paused]` is indistinguishable from a just-created animation on the timeline. A retargeted transition is a new object, so it is waited for. Before: Close over a paused 5 s progress bar held the inert, invisible toast (and the region, and `data-empty`) until the pointer left and the bar ended. Also records why the hold is a layout effect and not `useExitAnimation`. | Decisions 12, 3.4, 10.2, 12, 16.1, 16.2, 17 |
| M2 | The region **always portals into a library-owned `display: contents` host `div`** that the library moves with a DOM `append` between an inline anchor (`<div style="display: contents">` where the Viewport renders) and the topmost modal dialog. React never sees the move, so the Roots, Actions and `useActionTrigger` keep their state (an Undo in flight stays `data-pending`, its timer paused). The hydration render stays inline to match the server HTML (`useSyncExternalStore` with a `false` server snapshot); the first client render switches to the portal with an empty queue. The host-move effect runs before the region effect, which re-shows the popover the move hid. Before: `container === null ? region : createPortal(region, container)` remounted the subtree on each move (and `createPortal` remounts on a container change anyway), clearing the Action's pending flag so a timed Undo toast could expire during the undo. | Decisions 7, 1, 4.3, 12, 13, 14.10, 14.17, 16.1, 17 |
| M3 (announcement) | `Toast.Title` and `Toast.Description` **report their commit** (`root.contentCommitted()` from a `[]` layout effect: mount, and re-show after a boundary inside the Root hid them). After the Root's first announcement effect has run, a report queues one microtask that re-runs the announcement, so a reveal inside a consumer `<Suspense>` is announced, and a Title and Description revealed together are one text. Before: the Root's effect ran once at the skeleton commit, recorded `""` as announced, and the boundary's retry never re-ran it: `ariaNotify` was never called. | 3.5, 5, 14.16, 16.1, 17 |
| M3 (timer) | **Not fixed.** The timer starts at mount while a consumer boundary inside the Root shows its skeleton: nothing committed distinguishes "Title not yet committed" from "no Title", and a render-phase flag can be left set by a discarded render. Documented next to the skeleton recipe; section 21 is the proposal (`fallback` on `Toast.Root`), tracked in #63. | 3.5, 6, 21 |
| M4 | A **throwing `success` / `error` function in `toast.promise` dismisses the toast and the returned promise rejects** with what was thrown (a `settle` helper wraps `resolveOptions`). Not the `error` toast: the operation's outcome is known, only its message is not, and an error message would misreport a fulfilment; the consumer's bug reaches the awaiting action's boundary. Before: the throw escaped `then` before any dispatch and the toast stayed `data-pending` with no timer, forever. | 3.1, 9.1, 11, 14.15, 16.1, 17 |
| L1 | `RetainedToast.announced` carries the last announced text (`null` for silenced) across a Viewport unmount; `restore` seeds the next Viewport's map, so a route-level Viewport does not repeat "Archived, Undo" on every navigation. | 5, 14.11, 16.1, 17 |
| L4 | The **hotkey rejects unlisted modifiers**: every modifier flag must equal "listed in `hotkey`", so Ctrl+F8, Alt+F8 and Shift+F8 are not F8 (Radix accepts them; the design chooses the stricter match so a chord that shares the key is left to the browser or OS). Docs prop row updated. | Decisions 10, 7, 11, 16.1, 17 |
| L7 | A `toast({ id })` on an ending id clears that id's timer, last-announced text and exit baseline in the "ending entry replaced" branch, so the same text is announced again and the timer is fresh. | 5, 8, 17 |
| L8 (partial) | `rejected` is initialised from `isTaken(listener)` during render, so a Viewport added while another holds the manager renders nothing from its first render and installs no document listeners. Two Viewports mounted in the same commit still render the second region once, and the server always renders it: not fixed, by decision (#63, section 13); a test asserts that region is never shown. | 13, 16.1 |
| Flake | The browser exit row uses a 5 s exit, asserts the held state, `finish()`es the captured animations and asserts the drop, so it no longer races a wall clock under suite load (#62). A new browser row covers M1 with a paused 5 s progress bar. | 16.2 |
| L2 | Fixed (#63): when `manager` changes, the subscription effect resets the Viewport's queue (entries, timers, announced texts, exit baselines; focus inside a toast moves out) after the old manager retained its toasts and before subscribing to the new one, so the new manager's retained toasts are restored and the queues never mix. Generated ids are unique across managers (a module-level counter), so a late close from the old queue (an Undo settling) cannot hit a new toast. | 16.1 |
| L3 | Fixed (#63): the hover pause is cleared when the portal host moves (into or out of a modal) and when the region empties, the two ways it leaves under the pointer without a `pointerleave`. A pointer still over a moved region pauses again on its next move. Not `matches(":hover")` on every commit: jsdom never matches it, and a re-inserted node is not `:hover` until the pointer moves. | 6, 16.1 |
| L5 | Fixed (#63): a dismissed toast without a registered Root (queued beyond `limit`, or added in the same tick) is removed in `apply` instead of being marked ending; its `closeAction` still runs. | 8, 16.1 |
| L6 | Not fixed, by decision (#63): the `blurred` pause starts with the first window `blur`. Seeding it from `!document.hasFocus()` at mount pauses every timer until a click in an unfocused iframe (Storybook, sandboxes, vitest browser mode) and in jsdom (false until an element is focused, so consumers' own jsdom tests would never see a toast time out); a top-level-only seed still hits jsdom. The case left (a page that loads in a visible tab while another application has focus) is rare and costs one toast that times out unseen. | 6 |

---

## 21. `fallback` on `Toast.Root` (review M3, the timer; issue #63): accepted

Status: **accepted by the product owner on 2026-10-18** (note at the end of this section);
**implementation pending**. Nothing above depends on it, and the design stands without it. It
works out the developer's suggestion from `memo/developer/toast.md`. It amends conventions 6
("no `fallback` props"), applied the same day: *`fallback` exists only where the library owns
the boundary, which is Toast alone*, with the precedent risk named there (section 18 item 10).

### 21.1 The gap

The library's Suspense guard (section 3.5) gates the timer and the announcement on the toast's
content committing. The documented way to show a skeleton is a consumer `<Suspense>` inside the
Root, which catches first and is invisible to the guard: after M3 the reveal is still announced,
but the timer starts while the skeleton shows. A 5 s toast whose avatar takes 3 s to load is on
screen, readable, for 2 s. The library cannot detect the consumer's boundary without render-phase
bookkeeping that a discarded render can corrupt (review M3, section 3.5).

### 21.2 API

```ts
export interface ToastRootProps … {
  /**
   * Rendered by the Root's own Suspense guard while `children` suspend, in place of the
   * invisible default. The toast's timer and announcement wait for the reveal either way.
   */
  readonly fallback?: ReactNode;
}
```

```tsx
<Toast.Root key={t.id} toast={t} className="toast" fallback={<ToastSkeleton />}>
  <Toast.Title />          {/* t.title may be <Avatar userId={…} />, which suspends */}
  <Toast.Description />
  <Toast.Action />
  <Toast.Close aria-label="Close">×</Toast.Close>
</Toast.Root>
```

Implementation: `<Suspense fallback={<SuspenseGuard>{fallback}</SuspenseGuard>}>`; the guard
component keeps reporting its mount and unmount to the Root as today and renders `fallback`
(default `null`). About five lines in `toast-root.tsx`.

### 21.3 Semantics

- **While `children` suspend**: `fallback` is visible inside the Root's `div[role=dialog]`; the
  Root is not `data-pending` (the attribute keeps its one meaning, section 12); the timer has
  not started; nothing is announced. Exactly the invisible guard's behaviour, made visible.
- **On reveal**: the guard unmounts, the Root announces the Title and Description text that now
  exists, the timer starts (section 6). The reveal is a retry-lane commit, so it lands while
  unrelated actions are pending (the probe in section 3.5).
- **Mount**: the toast mounts urgently, and a newly mounted boundary shows its fallback at once
  (conventions 6), so the skeleton is on screen in the same frame as the `toast()` call. That is
  what a skeleton wants; it is the opposite of the transition-keyed content regions elsewhere,
  and it is why the boundary belongs to the Root and not to the Viewport.
- **An `update` (or a promise settle) whose new content suspends**: the mounted boundary is
  updated urgently, so React shows `fallback` again in place of the committed content, the guard
  mounts, the timer stops and the announcement waits for the new reveal (section 14 item 13,
  unchanged in substance, visible now).
- **Parts inside the fallback** are allowed (a visually hidden `<Toast.Title>Loading…
  </Toast.Title>` gives the Root an accessible name while the skeleton shows **on mount**;
  without one the `aria-labelledby` IDREF dangles and a user who presses F8 into the toast
  hears a nameless dialog, as today) but gate nothing: a `contentCommitted` report while the
  guard is mounted is ignored, and nothing is announced for the fallback. On an **update** that
  re-suspends, the fallback Title does not rename the toast: React hides the committed content
  with `display: none` but keeps it in the DOM, so the previous Title keeps the same `id` and
  comes first in the document; the toast keeps its old name ("Uploading", not "Loading…") until
  the reveal (issue #63; the jsdom row pins this). A consumer who wants "Loading…" announced
  has `toast.promise`'s `pending` phase for that.
- **A consumer `<Suspense>` inside `children`** still catches first and still has the timer gap;
  the docs steer to `fallback` and keep the caveat for the nested shape.
- **Type**: a `ReactNode`, as React's own `fallback`, not a `StateValue` function: nothing in
  `ToastRootState` changes while the fallback shows that the skeleton could depend on, and the
  consumer has `t` (its `type`, `data`) in the closure. A function form can be added later
  without a break.
- **SSR**: not applicable (the server renders an empty region).

### 21.4 Trade-offs

- **The convention.** Conventions 6 says "no `fallback` props in v0": boundary placement is the
  consumer's layout decision. Toast is already the one component that owns a boundary (the
  guard, accepted in section 18 item 6, for the reason that an urgent mount from outside the
  consumer's tree would otherwise reveal the app shell's fallback). The prop does not move the
  boundary; it lets the consumer style the one the library already has. The rule to write is
  narrow: *`fallback` exists only where the library owns the boundary, which is Toast alone.*
  Risk: precedent, with Dialog or Popover asking for one next; the answer there is unchanged
  (transition-mounted content keeps old UI and shows `data-pending`; the consumer places the
  boundary), and the rule names the reason so it cannot be generalised by analogy.
- **Alternatives considered.** (a) Detect the consumer boundary with a render-phase "Title
  rendered but not committed" flag: unsafe, a discarded render leaves it set and the toast never
  times out. (b) Gate the timer on `contentCommitted` instead of on the guard: a toast without a
  Title or Description (custom content from `t.data`) would never start its timer, and the
  library cannot tell "no Title" from "Title not yet committed", which is the same wall as (a).
  (c) A `Toast.Content` part that owns the boundary: the Root already is that part; a second
  wrapper adds anatomy for nothing. (d) Status quo, documented: the cheapest; the cost is a
  recipe whose skeleton silently eats the toast's duration, in the one component where the
  library chose to own the boundary precisely so that the timer and announcement would be right.
- **Built-in strings.** Unchanged: the fallback is the consumer's node; the library ships no
  skeleton and no text (conventions 11).
- **Tests to add** (16.1 "Suspending content"): `fallback` rendered while the title suspends,
  no `data-pending`, nothing announced, timer not started; on reveal, announced and timer
  started; an `update` whose content suspends shows `fallback` again and pauses the timer. Docs
  page: the prop row and the Suspense paragraph (which today says the timer starts at once).

**Accepted by the product owner** (2026-10-18). Section 21 is accepted as proposed: `fallback?: ReactNode` on `Toast.Root`, with the narrow conventions 6 rule "`fallback` exists only where the library owns the boundary (Toast alone)". The architect amends conventions 6 (and the 4.1 `ending` wording); a developer implements it with the tests listed above. Closes the M3 timer item of #63.
