# Architect memo: the four design questions from #143 (2026-11-23)

Issues #145, #146, #147, #148. Evaluation only: no library code, design doc or docs page was
changed. Everything below is a proposal for the user to decide.

How the four connect (read this first):

- #145 and #146 interact. Today a pure trigger's guard makes "superseded rejection" unreachable
  for `Button`. If the guard becomes opt-in (#146), a counter button has overlapping runs, and
  what happens to an older run's rejection (#145) becomes a real question for Button too.
- #147 and #148 interact. Half of the "CSS exit vs view transition" restriction exists because a
  dismissal's notification is a transition commit that starts a view transition. If a dismissal
  becomes an urgent notification (#148), dismissals never start a view transition, and the
  remaining half can be handled inside the library.

Evidence used: `react-dom@19.3.1` and `react@19.3.1` in `packages/ui/node_modules` (development
builds, line numbers below), React `main` source comments, a throwaway jsdom probe (not
committed), the library source, `design/conventions.md`, the component designs.

---

## #145 Superseded action rejections

**Summary.** React 19.3.1 really does drop the rejection of an older overlapping action started
through `useTransition` (and through a `<form action>`): no Error Boundary, no `reportError`, no
`unhandledrejection`. The library catches it and throws it from render (conventions 2.4).
Aligning is easy and deletes code, but React is not uniform here (the standalone `startTransition`
reports every rejection; `useActionState` throws the first and cancels the rest), and nothing in
React's source says the drop is intended. Recommendation: stop throwing to the boundary, but
report the error with `reportError`, as React's own standalone `startTransition` does. One
existing bug becomes visible and needs its own fix (set-valued state, below).

### What React does (verified)

| Entry point | Older action rejects while a newer one exists | Source |
| --- | --- | --- |
| `useTransition`'s `startTransition` | **Dropped.** Each call stores one thenable in the hook's state queue; state is last-write-wins, so only the newest thenable is ever unwrapped by `use`. `chainThenableValue` records `status = "rejected"` and nothing else reads it. | `react-dom-client.development.js` 9250-9325 (`startTransition`), 6213-6237 (`chainThenableValue`), 9408 (`updateTransition`) |
| `<form action={fn}>` / `formAction` | **Dropped**, same mechanism: `startHostTransition` calls the same `startTransition` on the form fiber's queue. | 9326-9346 |
| standalone `startTransition` (from `react`) | **Reported**: `returnValue.then(noop, reportGlobalError)`. Every rejection reaches `window.reportError`, superseded or not. No boundary. | `react.development.js` 563 |
| `useActionState` | Not concurrent: queued. The first rejection is thrown from the hook (boundary) and the calls queued behind it are cancelled. | 8752-8845 (`onActionError`) |

Probe (jsdom, React 19.3.1, two overlapping runs, both resolution orders):

```
useTransition, old rejects (before or after new resolves) -> "idle", nothing caught, nothing reported
useTransition, latest rejects                              -> boundary catches it
standalone startTransition, old rejects                    -> reportError("old")
<form action>, 2 submits, first rejects                    -> "idle", nothing caught, nothing reported
useActionState, first of two rejects                       -> boundary; second call never runs
```

Is the drop what React *wants*? The source does not say so. There is no comment about a superseded
rejection anywhere; `ReactFiberAsyncAction.js` says of overlapping actions "The ideal behavior
would be to treat each async function as an independent action. However, without a mechanism like
AsyncContext, we can't tell which action an update corresponds to." So the drop reads as a
by-product of "pending state is one piece of state", not a stated policy. The docs sentence
"React would silently drop…" is accurate; "the library goes against what React wants" is not
established either way.

### What the library does today, and why

`useSupersededRejection()` (`packages/ui/src/internal/use-superseded-rejection.ts`) is called by
`useControllableAction` and `useActionTrigger`. A dispatch that is not the latest and rejects is
caught, stored in state with an urgent `setState`, and thrown from the owner's render. Decided by
the product owner on the rule "the library never swallows an error" (conventions 2.4). Costs it
already carries:

- The hook must run **before** `useTransition` (a retry would suspend on the pending thenable).
- Components with two transition channels (`Slider.Root`, `NumberField.Root`) create one capture
  and pass it to both hooks (`captureSuperseded`).
- "Only the first superseded error is kept; later ones go to `reportError`"; "which error wins
  when both the latest and a superseded dispatch reject is not defined."
- A required test row per component ("Superseded rejection (both)", conventions 10.1): 28
  mentions in 18 test files.
- The outcome is heavy: an Error Boundary replaces the UI because of an intent the user has
  already replaced.

### What the user objects to

The library adds a behaviour React does not have for the same code written by hand. A consumer who
knows React is surprised, and if React later changes its own handling the library double-handles.

### Options

**A. Exactly React: drop.** The wrapper stops distinguishing latest from superseded and always
rethrows inside the transition; React drops the superseded one.

```ts
// use-controllable-action.ts / use-action-trigger.ts
try { await action?.(next, details); } finally { settle(); }
```

- Deletes `useSupersededRejection`, the hook-order constraint, `captureSuperseded`, the "first of
  a burst" rule, the 2.4 contract text.
- A failed older save is invisible everywhere: no boundary, no console, no monitoring. Contradicts
  "the library never swallows an error" (it is React that swallows, but the user of the library
  cannot tell).

**B. React's routing, but not silent: `reportError` (recommended).** No throw from render, no
boundary. A superseded rejection is passed to `reportError`, exactly what React's standalone
`startTransition` does with a rejection it has no boundary for.

```ts
} catch (error) {
  settle();
  if (id === latest.current) throw error; // React's own route to the boundary
  reportError(error);                      // superseded: window "error" event, monitoring tools
  return;
}
```

- Same deletions as A except one `reportError` call (no state, no hook, no ordering constraint).
- The UI stays up and shows the latest intent; the failure reaches `window.onerror` / Sentry and
  fails a test run that does not expect it (vitest treats it as an uncaught error), so it is not
  silent for the developer.
- Still a small difference from a hand-written `useTransition` (which reports nothing). It is the
  behaviour of one of React's own entry points, so "aligned with React" is defensible.

**C. Keep today's rethrow.** No change; reword the docs sentence so it does not sound like a
disagreement with React ("React reports only the latest action's failure; the library also
reports an older one").

### What breaks if the library stops rethrowing (A or B)

1. **Tests**: every "Superseded rejection" row flips from "boundary gets it" to "boundary does
   not; `reportError` called" (B). Mechanical, about 18 files. `use-action-trigger.test.tsx` and
   `use-controllable-action.test.tsx` lose their hook-order rows.
2. **Docs/design**: conventions 2.4 (rewritten, much shorter), 2.5, 10.1; one sentence on the
   Action props page; the "superseded" lines in dialog, popover, menu, checkbox-group designs.
3. **Pending state**: unchanged. `pending` already lasts until every overlapping action settled
   (React entangles them).
4. **A latent bug becomes visible: uncontrolled set-valued state.** In CheckboxGroup, ToggleGroup
   (multiple) and Accordion (multiple) the latest dispatch's `next` is computed from the intended
   set, which includes earlier in-flight clicks (`checkbox-group-root.tsx:287`,
   checkbox-group.md 5.4 "correct by construction"). Check A (save rejects), check B (save
   resolves): the latest-dispatch guard commits `{A, B}` although A failed. Today the Error
   Boundary hides this by replacing the UI. Without the rethrow the group shows A checked while
   the server has it unchecked. (From reading the code, not probed.) This needs a fix whichever
   option is chosen (today it is only masked by the boundary); the fix is to commit from
   settled dispatches (drop a rejected
   dispatch's `added` / `removed` from the committed value) instead of the latest whole value.
   Single-valued state (Tabs, Toggle, Select, RadioGroup, overlay `open`) has no such problem:
   the replaced intent is simply gone.
5. **With #146**: if Button's guard becomes opt-in, an unguarded Button has overlapping runs and
   an older run's rejection takes this path. Under A, a counter button whose first increment
   failed shows nothing at all.

### Recommendation

B. It removes the behaviour the user objects to (a superseded failure no longer tears the UI
down), removes the machinery, and keeps one honest signal. Do item 4 in the same change.

### For the user to decide

1. A (silent, exactly `useTransition`), B (`reportError`, like standalone `startTransition`), or
   C (keep)?
2. Agree that the set-valued commit bug (item 4) is fixed in the same wave?

---

## #146 Pure trigger double-invocation guard

**Summary.** Five parts ignore a second activation while their own `action` is pending and render
`aria-disabled`: `Button`, `Dialog.Close`, `Popover.Close`, `Menu.Item`, `Toast.Action`. A
synchronous counter already works; an **async** counter (`action={async () => { await inc(); }}`)
loses clicks, and the documented workaround (`void inc()`) gives up pending state and error
routing. A correct guard cannot be built by a consumer from the rendered `pending`, so "easy to
add" has to be a prop. Recommendation: one boolean prop `ignoreWhilePending` on all five parts;
default `false` on `Button`; default "on when a successful run closes the part's container"
elsewhere.

### Where the guard is

All through `useActionTrigger` (`internal/use-action-trigger.ts`, option `ignoreWhilePending`,
default `true`):

| Part | File | What a successful run does | Guarded today |
| --- | --- | --- | --- |
| `Button` (`action`) | `button/button.tsx:134` | nothing (stays) | yes |
| `Button` (function `formAction`) | `button/button.tsx` (`formPending` branch) | nothing | yes: a second submit by the same submitter is `preventDefault()`ed |
| `Dialog.Close` (`action`) | `dialog/dialog-close.tsx` via `use-overlay-close.ts:56` | closes the dialog | yes |
| `Popover.Close` (`action`) | `popover/popover-close.tsx` via `use-overlay-close.ts:56` | closes the popover | yes |
| `Menu.Item` | `menu/menu-item.tsx:92` | closes the menu (`closeOnActivate`, default `true`) | yes |
| `Toast.Action` | `toast/toast-action.tsx:83` | closes the toast (`closeOnSettle`, default `true`) | yes |
| `Slider.Root`, `NumberField.Root` steps | `ignoreWhilePending: false` | n/a | no (every step runs) |

State owners (Toggle, Tabs, Menu checkbox / radio items, …) are not guarded: latest intent wins.

Why it was built in (conventions 2.5, button.md 5.2 and 16, #79 / #81): a double click on Save
runs the save twice; every library with a pending button blocks it. The guard reads a synchronous
in-flight counter, not the rendered `pending`, for two measured reasons: two activations in one
task happen before any re-render, and React can hold the commit that clears `pending` (entangled
actions, a suspended render), so a guard on rendered `pending` drops legitimate clicks (the
review's probe lost two of three).

### What the user objects to

A policy the consumer did not ask for, with an awkward opt-out. The valid case is concrete:

```tsx
// Works today: sync, the counter never stays in flight.
<Button action={() => setCount((c) => c + 1)}>+1</Button>

// Loses clicks today: the second click during the await is ignored and aria-disabled is shown.
<Button action={async () => { await incrementOnServer(); }}>+1</Button>

// Today's documented workaround: no pending state, and a rejection never reaches a boundary.
<Button action={() => { void incrementOnServer(); }}>+1</Button>
```

It is also an alignment point: React's own `<button formAction>` and `useTransition` do not guard.

### How could a consumer opt in?

- **Reading pending state**: not enough. `state.pending` is only available inside `className` /
  `style` / `children` / `render` functions, it is the rendered value (the two failure modes
  above), and it cannot stop a `render`ed link from navigating or a `command` from running.
- **A helper around the action** (`const save = useSingleFlight(saveFn)`): gets the side effect
  right (a ref-based counter), but the ignored click still starts a transition, nothing renders
  `aria-disabled`, and the default action of the click is not prevented. It also needs a hook for
  a stable identity, which is more ceremony than a prop.
- **A prop on the part**: one word, and the part can do everything the built-in guard does today
  (ignore, `preventDefault()`, `aria-disabled` while pending). This is the only form that keeps
  the accessibility behaviour.

### Options

**A. Opt-in prop, off everywhere.**

```tsx
<Button action={save}>Save</Button>                      // every click runs
<Button action={save} ignoreWhilePending>Save</Button>   // today's behaviour
<Dialog.Close action={deleteItem} ignoreWhilePending>Delete</Dialog.Close>
```

Uniform and aligned with React. Cost: a confirm-and-close part (`Dialog.Close action={deleteItem}`)
now double-runs on a double click unless every call site remembers the prop; the second delete
typically rejects, and that rejection goes wherever #145 sends it.

**B. Same prop, default follows the part's shape (recommended).**

| Part | Default | Reason |
| --- | --- | --- |
| `Button` (`action` and `formAction`) | `false` | It stays on screen; counting clicks is a valid use. Matches React. |
| `Dialog.Close`, `Popover.Close` | `true` | A successful run removes the part. There is nothing to count; a second run can only repeat the side effect. |
| `Menu.Item` | `closeOnActivate` (so `true` by default) | With `closeOnActivate={false}` the item stays ("Zoom in"): every activation counts. |
| `Toast.Action` | `closeOnSettle` (so `true` by default) | Same rule. |

```tsx
<Button action={async () => { await incrementOnServer(); }}>+1</Button>   // counts every click
<Button action={save} ignoreWhilePending>Save</Button>
<Menu.Item closeOnActivate={false} action={zoomIn}>Zoom in</Menu.Item>     // counts every activation
<Dialog.Close action={deleteItem}>Delete</Dialog.Close>                    // one run, then close
<Dialog.Close action={log} ignoreWhilePending={false}>Close</Dialog.Close> // explicit override
```

The rule is one sentence ("a part whose successful run closes its container runs once; anything
else runs every time unless you ask"), and it is not really a built-in policy on the consumer's
action: for a one-shot part the guard is part of "this activation consumes the part". Cost: a
default that differs per part must be documented on each page.

**C. Keep the default, add the opt-out prop** (`<Button action={inc} ignoreWhilePending={false}>`).
Smallest change, fixes the counter properly (pending and errors kept), but it is the opposite of
what the user asked for.

Variant of the prop's shape, for A or B: `whilePending="run" | "ignore"` instead of a boolean. It
leaves room for a later `"queue"` (ordered runs, `useActionState` semantics, which is what a
server-side counter really wants), at the price of a longer call site. I would start with the
boolean.

### Consequences of A or B

- **Unguarded pending Button**: `data-pending` only, **no `aria-disabled`** (it still acts).
  `aria-disabled` while pending appears exactly when `ignoreWhilePending` is on. Conventions 2.3
  item 9 and 3.6 are reworded.
- **Overlap on a pure trigger becomes reachable**: `pending` stays true until all runs settle;
  an older run's rejection follows #145. button.md's "overlap and superseded rows are N/A"
  becomes real rows for Button.
- **The `then` of a closer** (close after the action) already tolerates two runs (the close is
  idempotent and guarded by the open generation), so an explicit `ignoreWhilePending={false}` on
  a Close is safe.
- **Server Functions / progressive enhancement**: unaffected; the prop is a boolean and the
  action is still passed through untouched. An unguarded `formAction` Button behaves like React's
  own submitter.
- **Churn**: `useActionTrigger` default flips (or each part passes its own); the "Re-entry" test
  row required for every pure trigger (conventions 10.1) becomes two rows (default, opposite);
  roughly 60 guard-related assertions in the test suite to revisit, most in `button.test.tsx`
  and `use-action-trigger.test.tsx`; docs: "A second click while pending" on the Pending &
  optimistic page, Button page, the Close / Item / Action sections; conventions 2.3, 2.5, 3.6;
  button.md 5.2 and 16. Breaking for Button consumers who rely on the guard (alpha: acceptable,
  called out in the release notes).

### Recommendation

B, with the boolean prop `ignoreWhilePending`. Button gets the behaviour the user asked for and a
one-word way back; the one-shot closers keep the protection where no counter-like use exists.

### For the user to decide

1. A (off everywhere) or B (off for Button, on for parts that close on success)?
2. The prop's name and shape: `ignoreWhilePending` (boolean) or `whilePending="ignore"`?
3. Should a guarded part keep rendering `aria-disabled` while pending (my assumption: yes, and an
   unguarded one renders none)?

---

## #147 CSS exit transition + view transition on a popup

**Summary.** The restriction only exists when a consumer uses **both** animation systems on the
same top-layer popup: the `transition` prop (view transition) and a CSS exit
(`transition: … display allow-discrete, overlay allow-discrete`), and it only shows in Chromium.
The two are not redundant: the view transition can only animate closes the library performs; the
CSS exit is the only thing that can animate a dismissal (Escape, click outside). Dropping CSS
exits would mean dismissals never animate, in any engine. Recommendation: keep both and make the
library apply the cut itself, so the consumer writes no extra rule; this needs a three-engine
probe first, and it gets simpler if #148 makes dismissals urgent.

### The restriction, precisely

Parts concerned: `Dialog.Popup`, `Popover.Popup`, `Menu.Popup` (context menu included),
`Combobox.Popup`. Tooltip and Toast have no `transition` prop and are not affected.

| Consumer writes | Library close (Close part, Trigger, item, controlled `open={false}`) | Dismissal (Escape, light dismiss) | Restriction |
| --- | --- | --- | --- |
| CSS exit only | CSS exit (Chromium, WebKit); none in Firefox | CSS exit (Chromium, WebKit); none in Firefox | none |
| `transition` only | view transition, all three engines | nothing: the popup is already `display: none` when React commits | none |
| both | view transition **and** the CSS exit start together | CSS exit, then the notification commit starts a view transition in the middle of it | needs `html:active-view-transition .popup { transition: none; }` |

Why "both" misbehaves (conventions 5.1; dialog.md 10.3; popover.md 10.2; `memo/architect/issue-132.md`):
React starts the view transition, the old snapshot is taken, the commit's layout effect calls
`hidePopover()` / `close()`, the new snapshot is taken. With a `display` / `overlay` discrete
transition the hidden element **stays rendered** through its fade, so in Chromium the new snapshot
contains a live fading popup next to the old image: a double image. For a dismissal the
notification commit (a transition commit, so it also runs a view transition) lands inside the
CSS fade and captures the fading box in both snapshots. Firefox animates no CSS exit for
top-layer elements; WebKit has the box `display: none` by the transition's `ready`. The rule is
untyped because a controlled close carries no transition types; its side cost is that any
unrelated view transition on the page cuts a dismissal's fade in progress.

Why a consumer wants both: the view transition is the only exit that works in Firefox and the
only one that knows the direction/type of the change; the CSS exit is the only one that covers a
dismissal.

### What "dropping CSS `transition` support" would mean

The library cannot stop anyone writing CSS. What it does for CSS exits today is (1) keep the
popup's children mounted until the exit's animations finish (`held`,
`internal/use-exit-animation.ts`, popover.md 4.4), and (2) document the recipe. Dropping support
means removing `held` and telling consumers not to put an exit `transition` on a popup with
`transition` set (or on any popup).

### Options

**A. Status quo.** One documented CSS line per popup class. Costs: consumers must know it; five
docs stylesheets and four playground stylesheets carry it; browser rows "a CSS exit (recipe=…)".

**B. The library applies the cut; the consumer writes nothing (recommended, needs a probe).**
Only when the part has `transition` set, the part itself suppresses the popup's own CSS
transition around the hide it performs, in the same layout effect that calls `hidePopover()` /
`close()`:

```ts
// sketch, inside the apply effect of a popup that has `transition`
popup.style.setProperty("transition", "none");  // the hide flips `display` at once
popup.hidePopover();
// restored before the next show (or when the view transition finishes)
```

```tsx
// call site: no recipe line any more
<Popover.Popup className="popover" transition={{ "fsui-popover-close": "pop-out", default: "none" }}>
```
```css
.popover { transition: opacity 150ms, display 150ms allow-discrete, overlay 150ms allow-discrete; }
/* the library guarantees this never overlaps a view transition */
```

- Scoped: only the popup's own hide, only when `transition` is set. An unrelated page view
  transition no longer cuts a dismissal's fade.
- An inline style needs no shipped stylesheet (conventions 12 forbids shipped rules that touch a
  consumer's element with anything but `--fsui-` properties) and is CSP-exempt when written
  through the CSSOM. The alternative mechanism, a shipped rule
  `html:active-view-transition [data-fsui-…] { transition: none !important }`, would need a
  conventions 12 exception and a new CSP hash; I do not recommend it.
- The dismissal half: today the notification commit runs a view transition mid-fade. Either the
  library cuts there too (same effect as today's recipe: the old snapshot carries the rest of the
  exit), or, with #148 option 2, the dismissal is an urgent commit and **starts no view
  transition at all**. Then the split is clean: the view transition animates what the library
  does, CSS animates what the browser does, and they cannot overlap.
- The same mechanism can cover the documented "use `transition` **or** the CSS enter, not both
  for the same open" rule (popover.md 10.2, dialog.md 10.3).
- Unknowns for the developer's probe (Chromium, Firefox, WebKit): the inline cut gives a clean
  new snapshot; when to restore it (before the next `showPopover()`; whether a consumer `style`
  prop containing `transition` is re-applied correctly by React); nested popups the browser
  closes together with the parent (today "put the rule on the whole class" covers them; the
  library would have to cut on each registered child popup).
- Cost: one probe, a small change in `use-popover-popup.ts` and `dialog-popup.tsx`, the recipe
  rows inverted (no rule needed), the recipe removed from docs, designs and nine stylesheets.

**C. Drop CSS exit support (the user's idea).** Remove `held`; docs say a popup animates its
close with `transition` only.

- The restriction disappears, and `use-exit-animation.ts` with its baseline bookkeeping and
  tests goes away (Toast keeps its own `data-ending` exit).
- **Dismissals never animate**, in any engine: Escape and click outside (for a popover or menu,
  the usual way to close) snap, while the Close button fades. A consumer who writes a CSS exit
  anyway sees the content vanish at the notification commit while the empty box fades.
- JS-free mode popups (Server Components, no `transition` prop possible) keep CSS as their only
  animation, so the docs still have to teach `@starting-style` / `allow-discrete` there; the
  rule becomes "CSS in JS-free mode, `transition` in library mode".
- Unless dismissals also become library-owned (rejected in the design: `beforetoggle` for a hide
  is not cancelable, a dialog's `cancel` is honoured once per activation), there is no way to
  get the dismissal animation back.

**D. The opposite drop: no `transition` prop on top-layer popups** (CSS only, like Tooltip and
Toast). No overlap by construction, but no exit animation in Firefox, no typed animations, no
animation of a content swap or of `pending` leaving, and it weakens principle 4. Not recommended.

### Recommendation

B, after a probe confirms it in three engines; decide it together with #148. If the probe fails,
stay on A (a one-line recipe is a smaller cost than losing dismissal animations). I advise
against C.

### For the user to decide

1. Is losing the exit animation of Escape / click outside acceptable (C), or should the library
   absorb the rule (B)?
2. If B: may the library write an inline `transition: none` on the consumer's popup element for
   the duration of its own hide (a functional write on the consumer's element)?

---

## #148 Parts vs dismissals: what is a callback that runs after the fact?

**Summary.** Today one prop, `openChangeAction`, serves two different things: a **request**
(Trigger, Close: called before the change, awaited, can be refused) and a **report** (Escape,
click outside: the popup is already gone). The report is still wrapped in a transition, so it
literally meets the #96 contract, but conceptually it is the same situation as a controlled text
input: the DOM already holds the new state and React must follow. Proposal for discussion: state
the rule as "an **action** is a request whose outcome decides the state; an **`on*` handler** is a
report of a change that has already happened", and give overlay Roots both channels:
`openChangeAction` for requests, `onOpenChange` for facts. This is breaking for every overlay and
for Toast, and it costs controlled mode a second prop.

### What the library does today

For Popover, Menu (and context menu), Combobox and Dialog in library mode (conventions 3.5;
popover.md 2.3, 4.3; `internal/use-overlay-root.ts` `requestClose` / `notifyClosed`):

| | A part's close (Trigger, `Close`, menu item, `Dialog.Form`) | A dismissal (Escape, light dismiss, Android back, AT dismiss, another top-layer element, focus leaving a menu / combobox, script `hidePopover()`) |
| --- | --- | --- |
| When the popup hides | in the commit, after `openChangeAction(false)` resolved | at once, by the browser, before any callback |
| Callback | `openChangeAction(false, { reason: "activate" })` | `openChangeAction(false, { reason: "dismiss" })`, from the `toggle` / `close` event |
| Lane | the Root's transition, awaited | the Root's transition, awaited |
| Rejection | Error Boundary; popup stays open | Error Boundary; popup is already closed |
| Controlled parent keeps `open={true}` | a real veto (nothing was hidden) | the popup is **re-opened** after the action settles ("follows, does not gate") |
| Committed `open` | `false` when the action resolved | still `true` while the action runs, although nothing is shown |
| `data-pending` | Trigger, while the close is awaited | Trigger, for a popup that is already closed |
| View transition | yes | the notification commit starts one (the second half of #147) |

Other after-the-fact callbacks in the library:

- **Toast `closeAction`** (`"activate"` / `"dismiss"` / `"timeout"`): called when the toast is
  already leaving; runs in the Viewport's transition; nothing visible waits (toast.md 9).
- **Platform paths** (`reason: "platform"`): form reset, find-in-page on an Accordion,
  pre-hydration clicks, a popup opened before hydration. The browser changed the DOM first and
  the change is dispatched as an ordinary action.
- **Foreign invoker closes** (`reason: "activate"`, performed by the browser).
- Tooltip has no callback at all.

Why it is this way: one prop makes controlled mode one line (`openChangeAction={setOpen}`), a
Server Function passed to it hears every change, and the dispatch reuses `useControllableAction`
unchanged. The docs call the dismissal case a "notification".

### What the user objects to

"Eventually the library calls an action callback after the fact, which I'd classify as an urgent
update, not an action." I think this is right, and the library's own text agrees with it:
conventions 3.5 describes a controlled browser-owned state with the words "it follows the
browser, it does not gate it", and 2.6 describes the urgent text of a Combobox with "a controlled
urgent prop follows the DOM and does not gate it". It is the same thing with two names. The
practical symptoms are the rows above that make no sense for something already finished: a
pending Trigger for a closed popup, a committed `open` that lags reality (and lags further while
any unrelated async action is pending, because of entanglement), a "refusal" that flashes the
popup back open, and a view transition for a change that is not React's.

### A sharper definition

- **Action** (`fooAction`): a **request**. Called before the change is committed, inside a
  transition, awaited. Its outcome decides: a rejection or a controlled parent that does not adopt
  rolls the UI back. Has pending and optimistic state.
- **Handler** (`onFoo`): a **report**. Called synchronously in the event that tells the library a
  change has already happened; urgent; not awaited; cannot veto. No pending, no optimistic state
  (the DOM is already there).

This generalises the #96 rule instead of adding a second one. `onInputValueChange` stops being
"the one exception React forces" and becomes the first instance of the general case: the
keystroke is in the DOM before React hears about it. (The user already noted in #143 that "the
fact that it is the only one is not important. There may be another in the future.")

The test for which side a callback is on: **if the callback rejects, or the parent ignores it,
does the UI go back?** If yes, it is an action. If the honest answer is "it cannot" or "it should
not", it is a report.

### Options

**Option 1. Keep one prop, fix only the words.** `openChangeAction` stays for everything; the
docs stop saying "notification" and say "an action that runs after the change". No churn. It does
not answer the objection, and the symptoms stay.

**Option 2. Two channels per state: action for requests, `on*` for facts (my proposal).**

```ts
interface PopoverRootProps {
  open?: boolean;
  defaultOpen?: boolean;
  /** Requests: Trigger, Close, a foreign open. In a transition, awaited, can be refused. */
  openChangeAction?: ChangeAction<boolean, PopoverOpenChangeDetails>;
  /** Facts: the popup was closed without being asked through a part. Sync, urgent, not awaited. */
  onOpenChange?: UrgentChangeHandler<boolean, PopoverOpenChangeDetails>;
}
```

```tsx
// Uncontrolled: load on open (request), log dismissals (fact).
<Popover.Root openChangeAction={async (open) => { if (open) await preload(); }}
              onOpenChange={(open, { reason }) => track("popover", reason)}>

// Controlled: the same setter in both channels. In the action it is a transition update,
// in the handler an urgent one.
const [open, setOpen] = useState(false);
<Dialog.Root open={open} openChangeAction={setOpen} onOpenChange={setOpen}>
```

Behaviour of a fact:

- Uncontrolled: the library writes committed `open = false` with an urgent update in the
  `toggle` / `close` event. Trigger `data-open` drops at once, no `data-pending`, children
  unmount after the CSS exit (`held`, unchanged). No view transition, no `fsui-*-close` type.
- Controlled: `onOpenChange(false, details)` is called synchronously; the parent's `setOpen` is
  urgent. If the parent keeps `open={true}`, the popup **stays closed** ("follows the DOM, does
  not gate it", the text-input rule) and development warns, like React's "`value` without
  `onChange`"; a controlled Root with `open` and no `onOpenChange` gets the same warning.
  "This dialog must not be dismissable" is a prop (`closedby`, `lightDismiss`, a manual popover),
  not a refusal after the fact.
- A returned thenable is a development warning, as for `onInputValueChange` today.

Where each existing dispatch would go:

| Component | Stays `…ChangeAction` (request) | Becomes `on…Change` (fact) |
| --- | --- | --- |
| Popover | Trigger open / close, `Popover.Close`, a foreign open (caught at `beforetoggle`) | Escape, light dismiss, another top-layer element, script `hidePopover()`, a foreign invoker's close, lost interest, a popup found open at hydration |
| Menu, context menu | Trigger, item activation (`closeOnActivate`), keyboard opens | the above, plus Tab out, a right / middle click outside, the pointer leaving a submenu, a parent menu closing |
| Combobox (`open`) | Trigger, typing / arrow-key opens, accept-and-close | Escape, focus leaving, light dismiss. `valueChangeAction` stays an action; `onInputValueChange` is already a fact |
| Dialog | Trigger, `Dialog.Close`, `Dialog.Form`, a foreign close command | Escape, Android back, AT dismiss, light dismiss; `details.returnValue` on both |
| Tooltip | none | none today. If a callback is ever wanted it is `onOpenChange` only: the abstraction gives it a place |
| Toast | `Toast.Action`'s `action` (the request) | `closeAction` → `onClose(details)` (see the cost below) |
| Accordion, Checkbox, Switch, RadioGroup, Select, Slider, … | everything, **including `reason: "platform"`** | nothing |

The last row is a deliberate line. A form reset or a find-in-page reveal has also "already
happened" in the DOM, but there the library does roll back: the DOM is the optimistic state, a
rejection or a refusing parent restores it, and the restore is cheap and invisible. That passes
the test above, so those stay actions and no form control gets a second prop. An overlay fails
the test: re-opening a popup the user just dismissed is not a rollback anyone wants.

Costs of option 2:

- **Controlled mode needs two props.** `openChangeAction={setOpen} onOpenChange={setOpen}` reads
  acceptably and a dev warning catches the omission, but it is one more thing to know, and the
  two names differ by a prefix and a suffix. Alternative name for the fact channel: `onDismiss`
  (`(details) => void`). It reads better at the call site, but it does not fit "a popup found
  open at hydration" or a foreign invoker's close, and each component with facts would need its
  own word (`onDismiss`, `onClose`, …) instead of one rule
  (`x` / `defaultX` / `xChangeAction` / `onXChange`).
- **Server Functions.** A Server Function passed to `openChangeAction` no longer hears
  dismissals. Passing one to `onOpenChange` works mechanically (it is called from the event) but
  returns a promise (dev warning) and its rejection is unhandled; a Server Component cannot wrap
  it. Persisting "closed by Escape" on the server needs a small Client Component. I think this
  is rare for popups; it is not rare for Toast.
- **Toast is the expensive case.** The Undo-window pattern
  (`closeAction: ({ reason }) => reason === "activate" ? undefined : deleteForReal(id)`) uses
  the transition: the async delete has an Error Boundary route. As `onClose` the consumer writes
  `void deleteForReal(id).catch(report)` or their own `startTransition`. Consistent, but worse
  for the pattern the design was built around. Keeping `closeAction` there would keep the
  conventions 2.1 row "Other notification: `<event>Action`", which is exactly the category the
  user questions.
- **No progressive-enhancement cost**: JS-free mode has no callbacks either way.
- **Accessibility**: neutral to positive. `aria-expanded` already follows the shown popup
  (#118); `data-open` on the Trigger would now agree with it immediately after a dismissal.
- **Implementation**: `notifyClosed` in `use-overlay-root.ts` becomes an urgent write instead of
  a dispatch; `useControllableAction` needs an "adopt urgently" path that is also safe while a
  request is in flight (a dismissal during a pending part close; an open request pending while
  the popup is not yet shown cannot be dismissed). Needs its own design pass per overlay.
- **Churn**: every dismissal row in five components' jsdom and browser suites (test lines
  mentioning `dismiss`, jsdom + browser, by grep: popover 61, combobox 46, menu 45 + context
  trigger 27, dialog 31 + close / form 16, toast 43; an upper bound on what must be revisited), the Browser-owned state and Action props pages, five
  component pages, conventions 2.1, 2.2, 2.6, 3.5, vision principle 3 (the "one exception"
  paragraph becomes the general rule). `ChangeReason` values are unchanged.
- **Gain for #147**: a dismissal no longer runs a view transition, which removes the dismissal
  half of the CSS-exit restriction.

**Option 3. One prop, two lanes inside.** Keep `openChangeAction` for everything, but for a
dismissal commit the state urgently first and then call the action in a transition as a detached
side effect (pending and error routing kept, no rollback, no re-open). Fixes the lagging
committed state for uncontrolled Roots and keeps Server Functions and Toast as they are. But the
prop named `Action` still reports something it cannot influence, and a controlled parent's
`setOpen` inside it is still a transition update. A half measure; useful only if option 2's
controlled-mode cost is judged too high.

**Option 4. Make every close a request** (the library owns dismissals: its own Escape and
outside-press handling on a manual popover, as Radix and Base UI do, which is why their
`onOpenChange` can be cancelled). Rejected in the existing designs and still, in my view:
it gives up the Popover API's light dismiss, top-layer stacking and `closedby`, cannot cover
Android back or an assistive-technology dismiss without a CloseWatcher in every engine, and a
user who pressed Escape expects the popup to go away now.

(Considered and dropped: making the Root report-only (`onOpenChange` for everything) and moving
all awaited work to the parts' own `action`s. Requests come from too many places (Trigger,
keyboard opens, foreign invokers, items) for controlled mode to work without a Root-level
request channel.)

### Recommendation (for discussion, not a decision)

Option 2 with `on<State>Change` as the fact channel, the rule "action = request, handler =
report", and the platform paths of form controls left as actions. Decide Toast separately.
If the second controlled-mode prop is judged too costly, option 3 is the fallback, and it should
be described honestly as "an action that cannot be refused".

### For the user to decide

1. Which rule defines an action: "wrapped in a transition" (#96 as written; today's dismissal
   already complies) or "a request whose outcome decides the state" (option 2)?
2. If option 2: the fact channel's name, `onOpenChange` (general rule) or `onDismiss` (reads
   better, less general)?
3. A controlled Root that keeps `open={true}` after a dismissal: stays closed with a dev warning
   (my proposal), or is re-opened as today?
4. Toast: `closeAction` → `onClose` for consistency, or keep it as an action because the
   Undo-window pattern needs the async route?
5. Do `reason: "platform"` dispatches on form controls and Accordion stay actions (my proposal)?
