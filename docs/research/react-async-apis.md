# React 19.3 async APIs: precise semantics for FUNSTACK UI

Researched 2026-10-15 against react.dev and the React 19.2 / 19.3 release posts and CHANGELOG.
Tracks GitHub issue #3. Everything below was verified against the live docs on that date; where
the docs are silent, the gap is called out explicitly rather than filled from memory.

## Summary and verdicts

| API | Status on 2026-10-15 | Verdict for FUNSTACK UI |
| --- | --- | --- |
| `startTransition` / `useTransition` async Actions | Stable (React 19) | **Adopt.** Core of the action-prop pattern. |
| Action prop naming convention (`action` / `fooAction`) | Documented convention on react.dev | **Adopt** as the library's public API shape. |
| `useOptimistic` | Stable (React 19) | **Adopt** for immediate feedback inside actions. |
| `useActionState` | Stable (React 19) | **Adopt selectively.** Right tool for ordered/queued actions (forms); not for Toggle/Tabs. |
| `<ViewTransition>` | **Stable in 19.3** (blog: "both of these are now stable in React 19.3") | **Adopt**, built in with `default="none"` opt-in design (see §5). |
| `addTransitionType` | Shipped with ViewTransition in 19.3 CHANGELOG ("Adds `<ViewTransition />` and `addTransitionType`"); no Canary banner on its reference page | **Adopt**; use for library-defined transition types. |
| `<Activity>` | Shipped in 19.2 ("New React features: `<Activity>`"); no Canary banner on its reference page; Flight support added in 19.3 | **Adopt** for Tabs/Accordion panel preservation (behind a prop, see §6). |
| `use()` | Stable (React 19) | **Adopt**; needed for Suspense-native children. |
| `useEffectEvent` | Shipped in 19.2; no Canary banner | **Adopt** for internal effects (keyboard/pointer listeners). |
| `browser()` (react-dom) | New in 19.3 release post | **Adopt behind need**; useful for client-only sub-parts. |
| `cacheSignal` | 19.2, RSC-only ("only for use with React Server Components") | Not relevant to a UI library. |
| `onDefaultTransitionIndicator` (createRoot) | `enableDefaultTransitionIndicator = __EXPERIMENTAL__` in `ReactFeatureFlags.js`; not on the stable `createRoot` page | **Not yet.** Do not design around it. |
| Gesture transitions (`startGestureTransition`, `useSwipeTransition`) | `enableGestureTransition = __EXPERIMENTAL__` | **Not yet.** |
| Fragment refs | Stable in 19.3 | Useful for wrapper-less primitives; noted in §9. |

## 1. The action-prop pattern

The convention is defined on the `useTransition` reference page:

> "The function passed to `startTransition` is called the 'Action'."
>
> "By convention, any callback called inside `startTransition` (such as a callback prop) should be
> named `action` or include the 'Action' suffix"

and in the React 19 release post: "By convention, functions that use async transitions are called
'Actions'." The React 19 post lists what Actions give you: pending state that "starts at the
beginning of a request and automatically resets when the final state update is committed",
`useOptimistic` support, error handling via Error Boundaries ("and revert optimistic updates to
their original value automatically"), and `<form action>` integration.

The canonical component shape, verbatim from react.dev ("Exposing `action` prop from components"):

```jsx
export default function TabButton({ action, children, isActive }) {
  const [isPending, startTransition] = useTransition();
  if (isActive) {
    return <b>{children}</b>
  }
  if (isPending) {
    return <b className="pending">{children}</b>;
  }
  return (
    <button onClick={() => {
      startTransition(async () => {
        // await the action that's passed in.
        // This allows it to be either sync or async.
        await action();
      });
    }}>
      {children}
    </button>
  );
}
```

The docs' note on this example is the rule the library must follow:

> "When exposing an `action` prop from a component, you should `await` it inside the transition.
> This allows the `action` callback to be either synchronous or asynchronous without requiring an
> additional `startTransition` to wrap the `await` in the action."

Two consequences for consumers of such a prop:

- A consumer's synchronous `setState` calls inside the action body are automatically Transitions,
  because the body runs synchronously inside `startTransition`.
- A consumer's `setState` calls **after their own `await`** are *not* automatically Transitions.
  They must re-wrap them (see §2). The library cannot fix this on the consumer's behalf.
- `useOptimistic` setters may be called directly inside an action prop without `startTransition`
  (react.dev: "In an Action prop, you can call the optimistic setter directly without
  `startTransition`").

## 2. `startTransition` / `useTransition`

### Synchronous scope, async inclusion

> "The function you pass to `startTransition` is called immediately, marking all state updates that
> happen while it executes as Transitions. If you try to perform state updates in a `setTimeout`,
> for example, they won't be marked as Transitions."

> "Any async calls that are awaited in the `action` will be included in the Transition, but
> currently require wrapping any `set` functions after the `await` in an additional
> `startTransition`." ... "This is a known limitation that we will fix in the future."

```js
startTransition(async () => {
  setStep('saving');            // Transition (synchronous in scope)
  await save();
  startTransition(() => {       // required re-wrap after await
    setStep('done');
  });
});
```

The Transition stays pending across the `await` even though post-`await` updates need re-wrapping.

### `isPending` lifecycle

> "the `isPending` state switches to `true` at the first call to `startTransition`, and stays `true`
> until all Actions complete and the final state is shown to the user."

"Final state is shown" includes waiting for any Suspense the resulting render triggers on already
visible content. `isPending` is per `useTransition` call: it tracks only Actions started through
that hook's own `startTransition`. The standalone `startTransition` export has no pending state.

### Overlapping / multiple concurrent Transitions

The docs are currently out of sync with the 19.3 implementation, so both are recorded:

- The `useTransition` and `startTransition` reference pages still say: "If there are multiple
  ongoing Transitions, React currently batches them together. This is a limitation that may be
  removed in a future release."
- The 19.3 CHANGELOG says: "Transitions now render independently instead of being entangled into a
  single render, so a slow transition no longer holds up unrelated ones" (PR #37290, which flipped
  `enableParallelTransitions` on by default; the author noted it "has been on in production at
  Meta").

**Precisely what is and is not entangled in React 19.3.1.** Verified against the `v19.3.0`
source, the shipped `react-dom-client.development.js` 19.3.1, and two jsdom probes
(`memo/platform-researcher/probes/`), which reproduce the architect's findings in
`memo/architect/conventions-notes.md`.

What `enableParallelTransitions` (true since 19.3.0, PR #37290) changes: in
`ReactFiberLane.js` `getHighestPriorityLanes`, a pending transition *update* lane used to return
`lanes & TransitionUpdateLanes` (every pending transition lane, rendered as one batch); it now
returns `getHighestPriorityLane(lanes)` (one lane). The shipped build has `return lanes & -lanes`
in that branch. So transitions from **different events that touch different state** render and
commit in separate passes. Probe 2 confirms: a sync transition whose render suspends inside an
already revealed boundary (so it waits rather than showing a fallback) no longer holds sibling
transitions started in later events; they committed while it was still pending.

What is **still entangled** (unchanged by 19.3):

1. **Everything started inside one browser event.** `requestTransitionLane` hands out one
   `currentEventTransitionLane` per event, so all transition updates in the same event share a
   lane and commit together.
2. **Every transition update started anywhere while any async action is pending.** React keeps an
   "async action scope" (`ReactFiberAsyncAction.js`): "If there are multiple, concurrent async
   actions, they are entangled. All transition updates that occur while the async action is still
   in progress are treated as part of the action." ... "we can't tell which action an update
   corresponds to. So instead, we entangle them all into one." In the shipped build,
   `requestTransitionLane` returns `currentEntangledLane` whenever it is non-zero, i.e. the
   action scope's lane. The scope's `useTransition` pending state is a thenable
   (`chainThenableValue`) unwrapped while rendering that lane, so the lane cannot complete until
   the last action resolves; everything assigned to it commits together. Probe 1: component A ran
   `start(async () => { setN(1); await deferred; })`; a sibling's standalone
   `startTransition(() => setM(1))` in a later event did not commit until `deferred` resolved,
   then both committed in one pass. An urgent `setState` in a third sibling committed immediately.
3. **Transition updates to the same state hook.** `entangleTransitionUpdate` merges a new
   transition lane with the queue's other pending transition lanes and calls
   `markRootEntangled`, so two transitions that update the same `useState` always render together.

Urgent (sync/default lane) updates are never held by any of the three.

Corollaries for a library:

- A component awaiting a slow consumer action holds **every** transition in the app, including
  unrelated components whose `useTransition` has no pending flag to show for it. Await only what
  the UI must wait for; run background work fire-and-forget outside the awaited chain.
- A transition-lane `setState` placed *before* the `await` inside an async action is on the
  action-scope lane and is held until the action settles (architect's note 2). Writing before or
  after the `await` has the same visible timing; the difference is that a pre-`await` write still
  commits when the action throws and is caught, while a post-`await` write is skipped.
- The docs' caveat "React currently batches them together" is still accurate for cases 1 to 3,
  and the changelog's "render independently" is accurate only for different-event,
  different-state transitions with no async action in flight.

What is stable regardless of version:

- Starting a second Transition does **not** cancel or abort the first Action. The async function
  keeps running; there is no AbortSignal from React. Interruption in the docs refers to *render
  work* being restarted when a higher-priority (urgent) update arrives, not to the Action itself.
- Ordering is **not** guaranteed: "Actions within a Transition do not guarantee execution order."
  "When clicking multiple times, it's possible for previous requests to finish after later requests.
  When this happens, React currently has no way to know the intended order." The docs point to
  `useActionState` and `<form>` actions for built-in queueing, "For advanced use cases, you'll need
  to implement your own queuing and abort logic."
- An urgent update (e.g. controlled text input) interrupts the Transition's render and React
  restarts it afterwards: "React will restart the rendering work on the chart component after
  handling the input update."

Implication: a component that fires one action per click (Toggle, TabButton) must tolerate
out-of-order completion. The architect's probe (note 5) shows the concrete failure: with two
overlapping actions on one `useTransition`, a reducer-based `useOptimistic` shows the latest intent
throughout, but post-`await` writes land in *completion* order, so the earlier action's write won
because its promise resolved last. A sequence guard ("only the latest dispatch commits its
post-`await` write") is needed for latest-intent-wins. Where strict sequencing matters (forms,
counters) use `useActionState`, which queues.

### Error handling

The error destination depends on which API started the Transition:

| Started by | Where the error goes |
| --- | --- |
| `useTransition`'s `startTransition` | Nearest Error Boundary **around the component that called `useTransition`**: "wrap the component where you are calling the `useTransition` in an error boundary. Once the function passed to `startTransition` errors, the fallback for the error boundary will be displayed." |
| Standalone `startTransition` import | `reportError` (global): "the standalone function is also not associated with a component, so if the function passed to it throws an error or returns a rejected Promise, React reports the error with `reportError`." "an Error Boundary cannot handle errors from its Transition." |
| `<form action>` | Error Boundary around the form. |
| `useActionState` | "The error is rethrown from `useActionState` and caught by the nearest Error Boundary", and "React cancels all queued Actions. Later `dispatchAction` calls are skipped." |

There is no `onTransitionError` or similar root option on the stable `createRoot` page. The only
root-level hooks are `onCaughtError`, `onUncaughtError`, `onRecoverableError`. An error from an
Action that reaches a boundary is therefore reported through `onCaughtError`, like any boundary
error.

Design consequence: because the boundary is resolved relative to **the component that owns the
`useTransition`**, a library component that calls `useTransition` internally will route a
consumer's thrown action error to the boundary nearest *the library component*, which is usually
the consumer's own boundary around it. That is the desired behavior. The library must **not** use
the standalone `startTransition` for action props, since that sends errors to `reportError` and
bypasses boundaries entirely. Catching inside the library and swallowing would also hide errors,
so the library should let them propagate and optionally expose an `errorAction`-style hook only if
a component genuinely needs inline error UI.

### Suspense fallback avoidance

> "A Transition only waits long enough to avoid hiding revealed content. It doesn't wait for
> everything to load."

> "Transitions only 'wait' long enough to avoid hiding *already revealed* content (like the tab
> container). If the Posts tab had a nested `<Suspense>` boundary, the Transition would not 'wait'
> for it."

Suspense reference: "If visible content suspends again, the `fallback` returns unless the update
came from `startTransition` or `useDeferredValue`." And: "newly rendered Suspense boundaries still
show their fallbacks immediately." To force a fallback during a Transition (e.g. switching to a
different item), key the boundary: `<Suspense key={id}>`.

`useDeferredValue` relates as follows: "When an update is inside a Transition, `useDeferredValue`
always returns the new `value` and does not spawn a deferred render, since the update is already
deferred."

### `useSyncExternalStore`

> "If the store is mutated during a non-blocking Transition update, React will fall back to
> performing that update as blocking. Specifically, for every Transition update, React will call
> `getSnapshot` a second time just before applying changes to the DOM. If it returns a different
> value than when it was called originally, React will restart the update from scratch, this time
> applying it as a blocking update"

> "It's not recommended to *suspend* a render based on a store value returned by
> `useSyncExternalStore`. The reason is that mutations to the external store cannot be marked as
> non-blocking Transition updates, so they will trigger the nearest `Suspense` fallback"

Implication: library-internal state must live in `useState`/`useReducer`/`useOptimistic`, never in
an external store, or "everything is transition" silently degrades to blocking updates and
ViewTransition will not animate. Reading a store like `matchMedia` via `useSyncExternalStore` for
display-only purposes is fine.

### Controlled text inputs

"Transition updates can't be used to control text inputs." This is the one documented place where
an urgent update is mandatory. It matches the vision doc's expected Combobox exception.

## 3. `useOptimistic`

```js
const [optimisticState, setOptimistic] = useOptimistic(value, reducer?);
```

- `optimisticState` "is equal to `value` unless an Action is pending, in which case it is equal to
  the state returned by `reducer` (or the value passed to the set function if no `reducer` was
  provided)."
- The setter accepts a value, an updater `prev => next`, or (with a reducer) an action argument.

### Apply and revert

Optimistic state has no explicit revert. It "only renders while an Action is in progress, otherwise
`value` is rendered." When the Action finishes, React renders `value` and the optimistic value in
the same commit; there is no intermediate render showing the stale optimistic value.

### Rejection

> "If the Action throws an error, the Transition still ends, and React renders with whatever `value`
> currently is. Since the parent typically only updates `value` on success, a failure means `value`
> hasn't changed, so the UI shows what it showed before the optimistic update. You can catch the
> error to show a message to the user."

Rollback is therefore automatic. Catching inside the Action to show a message is optional and
**keeps the error out of the Error Boundary**:

```js
function handleDelete(id) {
  setError(null);
  startTransition(async () => {
    removeItem(id);              // optimistic
    try {
      await deleteAction(id);    // parent updates `items` only on success
    } catch (e) {
      setError(e.message);       // item reappears because `items` never changed
    }
  });
}
```

### Multiple queued optimistic updates

- Multiple `setOptimistic` calls in one Action are queued like `useState` updaters.
- If `value` changes while pending, a **reducer** is re-run against the new `value`: "If `items`
  changes while the Action is pending, React re-runs your `reducer` with the new `items`". An
  updater function "would only see the state from when the Transition started."
- The docs do not specify behavior for several concurrent Actions touching the same hook beyond
  "Optimistic state only renders while an Action is in progress"; treat optimistic state as
  showing until *all* pending Actions that updated it have finished, and prefer reducers so that
  stacked updates stay consistent with the latest base value.

### Optimistic updates render at sync priority, so they can show a Suspense fallback

Not stated on the reference page, but visible in `react-dom-client.development.js`:
`dispatchOptimisticSetState` enqueues the update with `lane: SyncLane` and
`revertLane: requestTransitionLane()`. The optimistic render is therefore an *urgent* render, not
a Transition render. The architect's probe (note 1) confirms the consequence: if content keyed off
the optimistic value suspends, the nearest Suspense fallback is shown (already visible content is
replaced), whereas content keyed off the committed transition value keeps the old content.

Rule for the library: **render optimistic state only in trigger parts** (the pressed button, the
selected tab, `data-pending`), and **render content regions from committed state**. Never derive
"which panel to mount" from `useOptimistic`.

### Must be inside a Transition or Action

Warning text when violated: "An optimistic state update occurred outside a Transition or Action.
To fix, move the update to an Action, or wrap with `startTransition`." The value "will briefly
appear and then immediately revert." Calling during render throws "Cannot update optimistic state
while rendering."

Pending detection options listed by the docs: `optimistic !== value`, `useTransition`'s
`isPending` ("which uses `useOptimistic` under the hood"), or a `pending: true` flag in the reducer
for per-item state.

Library pattern for a controlled-or-uncontrolled Toggle:

```jsx
'use client';
function Toggle({ pressed, defaultPressed = false, changeAction, children }) {
  const [internal, setInternal] = useState(defaultPressed);
  const value = pressed ?? internal;
  const [optimistic, setOptimistic] = useOptimistic(value);
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={optimistic}
      data-pending={isPending || undefined}
      onClick={() => {
        startTransition(async () => {
          const next = !value;
          setOptimistic(next);           // immediate feedback
          setInternal(next);             // uncontrolled source of truth (Transition)
          await changeAction?.(next);    // consumer action, sync or async
        });
      }}
    >
      {children}
    </button>
  );
}
```

If `changeAction` rejects, `optimistic` reverts to `value`; in controlled mode `value` is whatever
the parent chose, so a parent that only updates on success gets automatic rollback. In
uncontrolled mode the `setInternal(next)` above is held until the action settles (entanglement,
§2) and commits even if the action rejects. Moving it after the `await` gives rollback for free,
because a rejection skips the write. The architect's adopted shape is write-after-`await` plus a
latest-dispatch guard; `aria-pressed` above reads `optimistic`, so the trigger still flips
immediately while any suspending content elsewhere reads committed `value` (see §3, sync
priority).

## 4. `useActionState`

```js
const [state, dispatchAction, isPending] = useActionState(reducerAction, initialState, permalink?);
```

- `reducerAction(previousState, payload)` may be async and may have side effects; it is not
  double-invoked in StrictMode.
- **Queueing**: "Multiple dispatches are queued and run sequentially. Each call receives the
  previous call's result as `previousState`. React waits for each Action to finish before starting
  the next." This is the ordering guarantee that `useTransition` lacks.
- `isPending` is "true while any dispatched Action for this Hook is in progress."
- `dispatchAction` must be called inside a Transition, an action prop, or `<form action>`;
  otherwise "development mode logs an error" and `isPending` never updates.
- Thrown errors cancel the remaining queue and surface at the nearest Error Boundary; expected
  failures should be *returned* as state instead.
- No built-in reset; use a reset payload, change `key`, or rely on `<form>` auto-reset.
- `permalink`: "used with React Server Components for progressive enhancement. If a Server Function
  form is submitted before the JavaScript bundle loads, the browser navigates to this URL instead of
  the current page. Once the page is interactive, this parameter has no effect." Irrelevant unless
  the library renders `<form>` with a Server Function.

When to prefer it over `useTransition` + `useOptimistic`:

- You need sequential execution and previous-result threading (counters, multi-step forms).
- You want the action's *result* (validation errors, server messages) as render state.
- You render a `<form>` and want progressive enhancement / `useFormStatus`.

Toggle/Tabs/Accordion do not need any of these; `useTransition` + `useOptimistic` is lighter and
does not serialize rapid clicks (a queued Toggle would replay every click).

## 5. `<ViewTransition>` (stable in 19.3)

Release post: "We're excited to announce that both of these are now stable in React 19.3!"
`enableViewTransition: boolean = true` in `ReactFeatureFlags.js`.

### Props

| Prop | Values | Notes |
| --- | --- | --- |
| `default` | `"auto"` \| `"none"` \| class string \| `{ [transitionType]: value, default?: value }` | Applies to any trigger not given its own prop. "If `default` is `"none"` then all other triggers are turned off unless explicitly listed." |
| `enter`, `exit`, `update`, `share` | same | Per-trigger override. `share` applies to named shared-element pairs. |
| `name` | string | "Only use `name` for shared element transitions. For all other animations, React automatically generates a unique name." Duplicate mounted names throw. |
| `onEnter`, `onExit`, `onUpdate`, `onShare` | `(instance, types) => cleanup` | Imperative Web Animations hooks; "Only one event fires per `<ViewTransition>` per Transition. `onShare` takes precedence." Must return cleanup. |

(The `addTransitionType` page mentions "enter/exit/update/layout/share props" once; `layout` is not
on the `<ViewTransition>` reference page and should be treated as undocumented.)

Class-mapping resolution rules (from `addTransitionType`): "If multiple types match, their classes
are joined together. If no types match, the special `"default"` entry is used. If any matching type
has the value `"none"`, that wins and the `ViewTransition` is disabled (it is not assigned a name)."

### What triggers it

> "By default, `setState` updates immediately and does not activate `<ViewTransition>`, only
> updates wrapped in a Transition, `<Suspense>`, or `useDeferredValue` activate ViewTransition."

Release post: "State updates inside of startTransition, a Suspense reveal, or an update from
useDeferredValue all cause a View Transition to animate."

Trigger selection: `enter` when the boundary "is the first component inserted in this Transition";
`exit` when "first component deleted"; `update` when it "has any DOM mutations inside it that React
is doing (such as a prop changing) or if the `ViewTransition` boundary itself changes size or
position due to an immediate sibling"; `share` when a named boundary is deleted and another with
the same name inserted in the same Transition.

`<Activity>` participates: "When a `<ViewTransition>` inside an `<Activity>` becomes visible, the
`enter` animation activates. When it becomes hidden, the `exit` animation activates." (Only when the
mode change is itself inside a Transition, per the Activity page.)

### Hard constraints

- "`<ViewTransition>` only activates exit/enter if it is placed *before* any DOM nodes." A wrapper
  `<div>` above it inside the same component kills enter/exit.
- "React automatically calls `startViewTransition` itself behind the scenes so you should never do
  that yourself. In fact, if you have something else on the page running a ViewTransition React will
  interrupt it."
- "If a `flushSync` happens to get in the middle of this sequence, then React will skip the
  Transition."
- Gesture/popstate: "React will skip animations from popstate and animations won't run for the back
  button."
- Unsupported browser: in `ReactFiberConfigDOM.js` the `document.startViewTransition` call is in a
  `try` ("We use the error as feature detection"); on failure React runs the mutation and layout
  callbacks synchronously and commits without animation. So it degrades gracefully; no library
  guard is needed.
- Reduced motion: React does nothing. "We recommend always using the `@media
  (prefers-reduced-motion)` media query to disable animations." The library's shipped CSS must
  include this.
- "`<ViewTransition>` creates an image that can be moved around, scaled and cross-faded." Children
  do not animate individually; add nested boundaries for per-item motion.

### Styling: classes, not names

> "We don't recommend that for styling. Instead, we normally recommend using a View Transition
> Class instead."

```jsx
<ViewTransition enter="fsui-fade-in" exit="fsui-fade-out" update="fsui-cross-fade">
```

```css
::view-transition-new(.fsui-fade-in) { animation: fsui-fade-in 200ms ease-out; }
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) {
    animation: none !important;
  }
}
```

`addTransitionType` also exposes the type to CSS: React "adds all Transition Types as browser view
transition types on the element", so `:root:active-view-transition-type(my-type)` works too.

### `addTransitionType`

```js
import { startTransition, addTransitionType } from 'react';
startTransition(() => {
  addTransitionType('fsui-tabs-next');
  setTab(next);
});
```

"Transition Types are reset after each commit." "A `<Suspense>` fallback is associated with the
types added during the `startTransition`. Revealing the content later does not carry those types."
Types from combined Transitions are all collected.

### Interaction with `useOptimistic`

Not documented explicitly. By construction, an optimistic update is a state update inside a
Transition, so it triggers ViewTransition exactly like any other transition update: the optimistic
commit animates, and the later convergence commit (which renders `value`) is a second update that
animates only if something in the DOM actually changes. If optimistic and final DOM are identical,
there is no second animation. If the Action rejects, the revert commit is also a Transition commit
and will animate back. Library CSS should therefore be symmetric (enter/exit or old/new pairs) so a
rollback looks intentional.

### Suspense pattern recommended by the release post

```jsx
<ViewTransition update="auto" default="none">
  <Suspense fallback={<Fallback />}>
    <Component />
  </Suspense>
</ViewTransition>
```

Principles: "Fallbacks should appear immediately *without animation*. A fallback should update to
final content *with animation*. Children that don't suspend should appear immediately *without
animation*." `<ViewTransition>` "also waits up to 500 ms for new fonts and visible images to load"
during a reveal.

### SSR behavior

The reference page does not discuss SSR or hydration. What follows from the trigger rules:

- Initial render/hydration is not a Transition insert, so no `enter` animation on first paint.
- A streamed Suspense reveal is a "Suspense reveal", which is a trigger. The 19.2 post says SSR
  Suspense reveals are now batched "to align with the client-rendered behavior" and that this
  "prepares for `<ViewTransition>` with Suspense during SSR". Expect streamed reveals inside a
  `<ViewTransition>` to animate; verify in a demo before documenting it as a library feature.
- `<ViewTransition>` renders no DOM of its own and is safe in server-rendered trees; it is a
  client-side concept and must live in a `'use client'` module only if its *parent* needs client
  features. Importing `ViewTransition` from `react` in a Server Component is allowed (it is an
  element type, not a hook).

### How the library should wire it

Recommendation:

1. Every animatable primitive wraps its animated region in `<ViewTransition>` placed **before any
   DOM node** in that subtree, with `default="none"` so nothing animates unless opted in.
2. A single prop on the component, e.g. `transition`, accepts the same shape as the ViewTransition
   props (`"auto"`, `"none"`, class string, or a type-map object) and is spread into
   `enter`/`exit`/`update` (or one prop per trigger if a component needs it). This keeps React's
   documented semantics without inventing new ones.
3. The library calls `addTransitionType('fsui-<component>-<direction>')` inside its own
   `startTransition` so consumers can key animations on direction (`next`/`prev`, `open`/`close`)
   via the type-map form or `:active-view-transition-type()`. Use hyphens, not colons: a colon
   would need escaping inside the `:active-view-transition-type()` selector.
4. Ship optional CSS presets as View Transition Classes, with a `prefers-reduced-motion` block.
5. Never call `document.startViewTransition` directly; never use `flushSync` in a component that
   contains a `<ViewTransition>`.

## 6. `<Activity>`

Shipped in 19.2 ("Activity supports two modes: `visible` and `hidden`"), reference page has no
Canary banner, and 19.3 adds Flight (RSC payload) support (#34697).

```jsx
<Activity mode={activeTab === 'home' ? 'visible' : 'hidden'}>
  <Home />
</Activity>
```

Hidden behavior:

- Children "are visually hidden with `display: "none"`"; "Their Effects are destroyed"; "Their
  state and DOM are preserved"; "They still re-render in response to new props, but at a lower
  priority than visible content."
- Pre-rendering: a boundary hidden on first render still renders children "at a lower priority than
  the visible content, and without mounting their Effects", so `use()`-based data fetches start
  early. "Activity does not detect data fetched inside an Effect."
- Text-only children render nothing while hidden (no element to hide).
- `useLayoutEffect` cleanup runs when hidden; the docs recommend it for pausing media because a
  regular Effect "could be delayed by (say) a re-suspending Suspense boundary or a View Transition."
- Selective hydration: Activity boundaries let React hydrate the tab buttons before heavy panel
  content, without showing a fallback the way Suspense would.
- Conceptually "treat hidden Activities as unmounted"; StrictMode simulates hide/show.

Suspense interaction: the docs do not state whether a hidden boundary's suspended children show a
fallback. The pre-render example nests Activities inside a Suspense boundary and the text implies
the fallback is not shown for hidden content, but this is not stated. Verify with a demo before
relying on it.

Tabs/Accordion guidance: offer a `keepMounted` style prop that switches between conditional
rendering (default, matches current ecosystem expectations and avoids hidden `<video>` surprises)
and `<Activity mode>` (preserves DOM/state and pre-renders). The mode change must be inside the
library's Transition so a nested `<ViewTransition>` gets enter/exit. `hidden=until-found` is not
compatible with `<Activity>` (Activity sets `display: none`); pick one per panel.

## 7. `use()` and Suspense inside transitions

- `use(promise)` suspends; `use(context)` reads context and may be called conditionally. "`use`
  cannot be called inside a try-catch block." Rejections "propagate to the nearest Error Boundary."
- Promises must be cached across renders or the boundary loops ("A component was suspended by an
  uncached promise").
- In a Transition, a `use()` that suspends keeps the old UI visible (no fallback) for already
  revealed boundaries; new boundaries still show fallbacks immediately.
- `use(browser())` (19.3, react-dom): on the server the component suspends and "the closest
  Suspense fallback goes into the HTML"; in the browser it returns `undefined`. "Requires a Suspense
  boundary during server rendering" or the server render fails. Must be called from a Client
  Component. Server bailouts are reported via `onBrowserBailout`, not `onError`.

Boundary placement for library components whose children may suspend:

- **Do not** wrap `children` in a library-owned `<Suspense>` by default. A boundary decides where
  fallbacks appear and resets state for first-mount suspends ("If a render suspends before it
  mounts for the first time, React discards its state"). That is the consumer's layout decision.
- Because the library's updates are Transitions, a consumer's suspending panel keeps the previous
  panel visible while the new one loads, and the component's `data-pending` reflects that wait.
  This is the Suspense-native behavior the vision wants, and it needs no boundary inside the
  library.
- Accept a `fallback` prop (or a `<Tabs.Panel fallback>`) only where the component owns a natural
  reveal region, and when present render `<ViewTransition update="auto" default="none"><Suspense
  fallback={fallback}>` per the release-post pattern.
- When the library intentionally changes "which thing" is displayed (a different item, not a
  refresh), key the consumer-facing region so a fresh fallback shows; document that consumers can
  key their own boundary.

## 8. React Server Components boundaries

Client-only, per the `'use client'` reference ("Third-party components that use any of the
following must run on the client"): `createContext`, all `react` and `react-dom` hooks **except
`use` and `useId`**, `forwardRef`, `memo`, `startTransition`, and DOM APIs. "Server Components
cannot support interaction as event handlers must be registered and triggered by a client."

So `useTransition`, `useOptimistic`, `useActionState`, `useEffectEvent`, `addTransitionType`
(called inside a Transition) and any `action`/`onClick` prop make a module client-only.
`<ViewTransition>`, `<Activity>`, `<Suspense>`, `<Fragment>` are element types and can appear in
Server Component JSX; `<Activity>` has Flight support since 19.3.

Context in Server Components (19.3): "Server Components still can't *create* Context, but they can
*render* it" when the Context object is imported from a `'use client'` module. A library can export
a `createContext` result from a client module and let a consumer's Server Component render
`<ThemeContext value={...}>` directly.

Rules for a library that wants some primitives usable as Server Components:

1. Put `'use client'` **in each source file that uses a client-only API** and nowhere else. A
   JS-free primitive (static Accordion using `<details>`, a non-interactive Separator) should live
   in a file without the directive and import nothing from client files.
2. Preserve module boundaries in the build (Rollup `preserveModules: true` plus a directive-
   preserving plugin, or tsup/esbuild `banner`). Rollup strips directives by default when bundling;
   Terser can strip them again unless `compress.directives: false`. Next.js's library-author advice:
   "add the `"use client"` directive to entry points that rely on client-only features. This lets
   your users import components into Server Components without needing to create wrappers. It's
   worth noting some bundlers might strip out `"use client"` directives."
3. "When a `'use client'` module is imported from another client-rendered module, the directive has
   no effect", so over-marking is harmless on the client but prevents a file from ever rendering as
   a Server Component.
4. Props crossing from a Server Component into a library client component must be serializable:
   functions are allowed only if they are Server Functions (`'use server'`). This means a Server
   Component **cannot pass a plain `changeAction` callback** to `<Toggle>`; it can pass a Server
   Function, or render `<Toggle>` from its own client component. Compound components that take
   `children` work because "Client Components can render Server Components because you can pass JSX
   as props."
5. `use(browser())` is the sanctioned way to make a sub-part client-only inside an otherwise
   server-renderable tree, with a Suspense fallback in the HTML.

## 9. Other 19.2 / 19.3 items relevant to a UI library

- **`useEffectEvent`** (19.2): extracts non-reactive logic from an Effect; "always read the latest
  committed render values, and they are excluded from Effect dependencies." Call only inside
  Effects of the same component; do not pass to children. Needs `eslint-plugin-react-hooks@latest`.
  Ideal for keyboard/pointer listeners that read current props without resubscribing.
- **Ref callback cleanup** (19): return a cleanup function from `ref` callbacks; "If a function is
  not returned by the `ref` callback, React will call the callback again with `null` ... This
  behavior will be removed in a future version." Library refs should always return cleanup.
- **Fragment refs** (19.3 stable): `<Fragment ref>` yields a `FragmentInstance` with
  `addEventListener`, `focus`/`focusLast`/`blur`, `observeUsing` (Intersection/ResizeObserver),
  `getClientRects`, `scrollIntoView`. Enables wrapper-less focus management and observation for
  compound components without adding DOM, which also keeps `<ViewTransition>`'s "before any DOM
  node" rule satisfiable.
- **`onCaughtError` / `onUncaughtError` / `onRecoverableError`** (`createRoot` options): the only
  stable root-level error hooks; action errors surface through `onCaughtError` once a boundary
  catches them.
- **`prerender` / `resume`** (19.2): `prerender` "waits for all data to load before resolving";
  partial prerender with `postponed` and `resume`. Only `use()`-driven Suspense counts; Effect
  fetching is invisible. No impact on component API, but the library must render deterministically
  on the server (no `window` access in render; use `use(browser())`).
- **`useId` prefix** is now `_r_` (19.2) "so generated IDs are valid for `view-transition-name`",
  so `useId()` output can be used as a `<ViewTransition name>` for shared-element pairs.
- **`<form action>`**: a function action "will handle the form submission in a Transition following
  the Action prop pattern", receives `FormData`, resets uncontrolled fields on success, and errors
  go to the surrounding Error Boundary. `useFormStatus` reads `pending` from inside the form.
- **`submit` events include `submitter`** and **`onReset` fires on auto-reset after a Server
  Action** (19.3), relevant to any form-related primitive.
- **Suspense reveal batching on SSR** (19.2) and **`<Suspense defer>`** (experimental, listed on the
  Suspense page) do not change component APIs.
- **`cacheSignal`** (19.2): RSC-only; returns `null` in Client Components. Not relevant.
- **Behavior change (19.3)**: "Effects are double-invoked in Strict Mode during hydration, matching
  client-rendered roots." Library effects must already be idempotent.

## Implications for FUNSTACK UI API design

1. **Action props run inside the component's own `useTransition`, and the library awaits them.**
   This is required for error routing to the consumer's boundary and for `isPending` to cover async
   consumers. Never use the standalone `startTransition` for consumer callbacks.
2. **Document the post-`await` rule loudly.** Consumers' `setState` after their own `await` is not a
   Transition unless re-wrapped. The library cannot paper over this.
3. **Errors from actions go to Error Boundaries, not callbacks.** There is no root-level transition
   error hook in stable React. Decide per component whether to additionally expose an optional
   `errorAction`-style prop; default should be "let it propagate". Optimistic state rolls back on
   its own either way.
4. **Trigger parts render optimistic state; content regions render committed state.** Optimistic
   updates render at sync priority, so suspending content keyed off them shows a fallback. For
   uncontrolled state, write after the `await` (same visible timing as before it, because
   transition writes are held until the action settles anyway) so a rejection skips the write and
   controlled and uncontrolled roll back the same way. This is the rule the architect adopted in
   `design/conventions.md`.
5. **Overlapping actions are neither cancelled nor ordered, and async actions entangle every
   transition in the app.** Design single-shot components (Toggle, TabButton) for latest-intent-
   wins with a sequence guard on the post-`await` write, use reducer-form `useOptimistic` so stacked
   optimistic updates rebase onto the latest `value`, await only what the UI must wait for, and
   reserve `useActionState` for components that need a queue.
6. **Never hold library state in `useSyncExternalStore`.** Store mutations during a Transition
   force a blocking re-render and defeat both fallback avoidance and ViewTransition.
7. **ViewTransition wiring**: `<ViewTransition default="none">` placed before any DOM node, a
   `transition`-style prop that forwards React's own class/type-map shapes, library-emitted
   hyphenated transition types via `addTransitionType`, optional CSS presets with reduced-motion
   handling, and no `flushSync` anywhere near it.
8. **Suspense boundaries belong to consumers.** Library components should not wrap children in
   `<Suspense>` by default; because library updates are Transitions, suspending children already
   keep the old content visible and surface as `data-pending`.
9. **RSC packaging**: per-file `'use client'`, preserved modules in the build, JS-free primitives in
   directive-free files, and documentation that Server Components can only pass Server Functions as
   action props.
10. **Activity for panels** is stable enough to adopt behind an opt-in prop; it is incompatible with
    `hidden=until-found` on the same element, and its Suspense-fallback behavior while hidden needs a
    demo-based check.

## References

- React 19.3 release post: https://react.dev/blog/2026/09/09/react-19-3
- React 19.2 release post: https://react.dev/blog/2025/10/01/react-19-2
- React 19 release post (Actions): https://react.dev/blog/2024/12/05/react-19
- CHANGELOG: https://github.com/facebook/react/blob/main/CHANGELOG.md
- Parallel transitions PR #37290: https://github.com/facebook/react/pull/37290
- Async action entanglement: https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberAsyncAction.js
- Architect's jsdom probes on 19.3.1 (entanglement, optimistic sync lane, ordering): `memo/architect/conventions-notes.md`
- `useTransition`: https://react.dev/reference/react/useTransition
- `startTransition`: https://react.dev/reference/react/startTransition
- `useOptimistic`: https://react.dev/reference/react/useOptimistic
- `useActionState`: https://react.dev/reference/react/useActionState
- `<ViewTransition>`: https://react.dev/reference/react/ViewTransition
- `addTransitionType`: https://react.dev/reference/react/addTransitionType
- `<Activity>`: https://react.dev/reference/react/Activity
- `<Suspense>`: https://react.dev/reference/react/Suspense
- `use`: https://react.dev/reference/react/use
- `browser`: https://react.dev/reference/react-dom/browser
- `useDeferredValue`: https://react.dev/reference/react/useDeferredValue
- `useSyncExternalStore`: https://react.dev/reference/react/useSyncExternalStore
- `useEffectEvent`: https://react.dev/reference/react/useEffectEvent
- `cacheSignal`: https://react.dev/reference/react/cacheSignal
- `createRoot` options: https://react.dev/reference/react-dom/client/createRoot
- `prerender`: https://react.dev/reference/react-dom/static/prerender
- `<form>`: https://react.dev/reference/react-dom/components/form
- Ref callbacks: https://react.dev/reference/react-dom/components/common
- `'use client'`: https://react.dev/reference/rsc/use-client
- Server Components: https://react.dev/reference/rsc/server-components
- Feature flags: https://github.com/facebook/react/blob/main/packages/shared/ReactFeatureFlags.js
- DOM host config (startViewTransition fallback): https://github.com/facebook/react/blob/main/packages/react-dom-bindings/src/client/ReactFiberConfigDOM.js
- Next.js library-author advice on `'use client'`: https://nextjs.org/docs/app/getting-started/server-and-client-components
- rollup-plugin-preserve-directives: https://www.npmjs.com/package/rollup-plugin-preserve-directives
