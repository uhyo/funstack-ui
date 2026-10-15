# @funstack/ui API conventions

Status: **accepted** (2026-10-15, GitHub issue #5; open questions resolved by the product owner
with the user, see the end of this document; amended 2026-10-15 after the Toggle design, #6, with
the ViewTransition correction in 5.1, the pending-is-never-disabled rule in 3.6, and the Server
Function note in 2.4). Binding for every component design in
`design/components/`. `docs/vision.md` wins over this document; this document wins
over any individual component design.

Inputs: `docs/vision.md`, `docs/research/react-async-apis.md`, `docs/research/popover-anchor-tooltip.md`,
`docs/research/modern-platform-survey.md`, prior art (Base UI, React Aria Components, Radix,
Ark UI, Headless UI), and a handful of React 19.3.1 behaviour probes recorded in
`memo/architect/conventions-notes.md`.

## Decisions

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Composition | Compound parts under a namespace (`Tabs.Root`, `Tabs.Tab`); single-element components are plain (`Toggle`). Element polymorphism via a `render` prop (element or `(props, state) => node`), never `asChild` or `as`. `ref` is a normal prop. `className`, `style`, `children` accept a value or a function of the part's state. |
| 2 | Action props | `<state>ChangeAction` for state changes (`pressedChangeAction`, `valueChangeAction`), bare `action` for pure triggers. Signature `(next, details)`; sync or async; the library `await`s it inside the state owner's `useTransition`. Errors go to the nearest Error Boundary. No `on*` handlers in the library API. |
| 3 | State model | `x` / `defaultX` / `xChangeAction`. The state owner holds committed state, optimistic state (`useOptimistic`, reducer form) and the transition. **Trigger parts render optimistic state; content regions render committed state.** Uncontrolled state is committed after the action resolves; the latest dispatched action wins. "Transition by default" applies to library-owned state; browser-owned state (top layer, `<details open>`) is observed, not driven. |
| 4 | Exposure | One vocabulary in three forms: `data-pending` / `state.pending` / docs. Booleans by attribute presence. Hover/focus/active come from CSS pseudo-classes, not attributes. |
| 5 | ViewTransition | Every animatable part wraps its output in `<ViewTransition default="none">`; a `transition` prop forwards React's own `default` shape. Library adds `fsui-<component>[-<change>]` transition types. Reduced motion handled in CSS. |
| 6 | Suspense | Consumers own Suspense boundaries. Library content regions are keyed off committed state so suspending children keep the old UI and show as `data-pending`. |
| 7 | RSC and platform attributes | `"use client"` per source file; unbundled build (`tsdown` `unbundle: true`, verified to keep the directive); "JS-free" means no behaviour JS runs for the interaction and the markup works before hydration (the `<details>` Accordion); whether a part file is directive-free is a per-component fact recorded in its design doc, and none of the initial four has one (directive-free variants tracked in #19). Attributes react-dom cannot express use lowercase pass-through, one module augmentation file, and a ref-based upgrade for `hidden="until-found"`. |
| 8 | Experimental | `experimental_<feature>` props on the part that uses the feature (first customers: `popover="hint"`, `interestfor`, `focusgroup`, `interpolate-size`, `closedby`, customizable `<select>`); whole components that cannot exist without a flagged feature ship from `@funstack/ui/experimental`. No provider. |
| 9 | Layout | `src/<component>/` folders, kebab-case files, `index.ts` per component without a directive. Root entry plus per-component subpaths (`@funstack/ui/tabs`). Flat public type names (`TabsTabProps`, `TabsTabState`). |
| 10 | Tests | Every component test file covers: ARIA/roles, keyboard, sync action, async action with `data-pending`, optimistic + rollback, overlapping actions, suspending content, controlled/uncontrolled parity, `render`/function props. Shared helpers in `src/__tests__/helpers.tsx`. |

---

## 1. Composition model

### 1.1 Compound parts under a namespace

Multi-part components are exported as one namespace object whose members are the parts. The
namespace itself is not a component.

```tsx
import { Tabs } from "@funstack/ui/tabs";

<Tabs.Root defaultValue="general">
  <Tabs.List aria-label="Settings">
    <Tabs.Tab value="general">General</Tabs.Tab>
    <Tabs.Tab value="billing">Billing</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel value="general"><GeneralSettings /></Tabs.Panel>
  <Tabs.Panel value="billing"><BillingSettings /></Tabs.Panel>
</Tabs.Root>
```

Single-element components are plain components, no `.Root`:

```tsx
import { Toggle } from "@funstack/ui/toggle";

<Toggle pressedChangeAction={setFavorite}>Favorite</Toggle>
```

Part vocabulary (reuse these names; invent a new one only when none fits):

| Part | Meaning | Default element |
| --- | --- | --- |
| `Root` | Owns state, context and the transition. May render no DOM (overlays) or a wrapper. | `div` or none |
| `List` | Groups triggers; owns keyboard navigation between them. | `div` |
| `Item` | One entry in a multi-item component (Accordion, Menu). | `div` / `details` |
| `Trigger` / `Tab` | The interactive element the user acts on. | `button` |
| `Panel` | Content region whose visibility is driven by library state (Tabs, Accordion). | `div` |
| `Popup` | Content that lives in the top layer (Tooltip, Popover, Menu). | `div[popover]` |
| `Indicator` | Purely visual element that tracks state (active tab marker). | `span` |
| `Header`, `Group`, `Label`, `Separator`, `Arrow` | Structural or decorative. | as named |

There is deliberately **no `Portal` and no `Positioner` part**: the Popover API puts content in the
top layer and CSS Anchor Positioning places it, so the platform does both jobs (see
`docs/research/popover-anchor-tooltip.md`).

Each part renders at most one DOM element. Parts never render wrapper elements the consumer did
not ask for; this is also what keeps `<ViewTransition>` "before any DOM node" (section 5).

### 1.2 Element polymorphism: `render`

Every part that renders an element accepts `render`. Element form replaces the default element;
the library merges its props into it. Function form hands the props and the part's state to the
consumer, who spreads them.

```tsx
// Element form: a Tab that is a router link.
<Tabs.Tab value="docs" render={<Link href="/docs" />}>Docs</Tabs.Tab>

// Function form: full control over the element and its content.
<Toggle
  render={(props, state) => (
    <button {...props}>{state.pressed ? <StarFilled /> : <StarOutline />}</button>
  )}
/>
```

Rules for the element passed to `render` (same as Base UI):

- A custom component must accept `ref` as a prop (React 19; no `forwardRef`) and spread the
  received props onto its DOM node.
- `className`: the library's and the element's are concatenated. `style`: merged, element wins.
- Event handlers the library installs (for example `onClick` on a `Tab`): both run, the element's
  first, then the library's. v0 provides no way to cancel the library's handler from there.
- Library-controlled attributes (`role`, `aria-*` *state* the part computes such as
  `aria-pressed` / `aria-selected`, `id` wiring, `data-*` state) win over the element's, with one
  carve-out: ARIA id-reference lists (`aria-labelledby`, `aria-describedby`, `aria-controls`,
  `aria-owns`) are **merged as token lists**, the element's tokens first, so a trigger can be
  described by more than its tooltip. **Everything else, the element wins**, including `aria-*`
  and `data-*` props that merely pass through the part from its own props: a `render` element's
  `aria-label` beats `<Tabs.Tab aria-label>`; only attributes the part itself computes are
  library-controlled. Merge order is therefore: part pass-through props, then the `render`
  element's props, then library-controlled attributes on top.

Rejected alternatives:

- `asChild` (Radix, Ark): relies on `cloneElement`, hides the prop merge, and the "single child"
  constraint fights `children`-as-function. `render` is explicit about which props land where.
- `as` (Headless UI): cannot carry props for the substituted element and makes the prop type a
  generic that every consumer pays for in inference time.

### 1.3 `className`, `style`, `children` as functions of state

Each part has a `State` object (section 4). `className`, `style` and `children` accept either a
plain value or a function of that state.

```tsx
<Toggle
  className={({ pressed, pending }) => clsx("fav", pressed && "fav-on", pending && "fav-busy")}
  style={({ pending }) => ({ opacity: pending ? 0.6 : 1 })}
>
  {({ pending }) => (pending ? <Spinner /> : "Favorite")}
</Toggle>
```

Data attributes (section 4) are the primary styling hook; function props exist for the cases CSS
cannot express (swapping content, computing a class from several states). Three function-capable
props is a wider surface than Base UI's `render`-only approach; the cost is accepted because
`{({ pending }) => ...}` is the shortest possible spelling of the library's defining feature.

### 1.4 Refs

`ref` is an ordinary prop on every DOM-rendering part and is attached to the rendered element.
The library merges it with its own internal ref. Callback refs may return a cleanup function (React
19) and the library's own callback refs always do.

```tsx
const tabRef = useRef<HTMLButtonElement>(null);
<Tabs.Tab ref={tabRef} value="general">General</Tabs.Tab>
```

Parts that render no DOM (`Tooltip.Root`) do not accept `ref`.

### 1.5 Native prop pass-through

A part's props type is the rendered element's props (`ComponentPropsWithRef<"button">`) minus the
props the part owns. The library's own **prop-form** event handlers are **omitted from the type**
so that a consumer cannot silently clobber them. A part that attaches its listeners through
`addEventListener` on its ref instead (section 7.4; Tooltip does this because its hover/focus
handlers are feature-detected away when `interestfor` is native) omits nothing, and the consumer's
`on*` props for those events pass through and run independently:

```ts
export interface TabsTabProps
  extends Omit<ComponentPropsWithRef<"button">, "onClick" | "onKeyDown" | "onFocus" | "className" | "style" | "children"> {
  value: string;
  disabled?: boolean;
  className?: string | ((state: TabsTabState) => string | undefined);
  style?: CSSProperties | ((state: TabsTabState) => CSSProperties | undefined);
  children?: ReactNode | ((state: TabsTabState) => ReactNode);
  render?: RenderProp<ComponentPropsWithRef<"button">, TabsTabState>;
}
```

DOM event props the part does *not* use (say `onPointerEnter` on a `Tab`) pass through untouched.
They are the platform's API, not the library's; the library neither documents nor wraps them. See
section 2.6 for what this means for the "no handlers" rule.

---

## 2. Action props

### 2.1 Naming

| Kind | Name | Receives | Examples |
| --- | --- | --- | --- |
| State change | `<state>ChangeAction` | `(next, details)` | `pressedChangeAction`, `valueChangeAction`, `openChangeAction` |
| Pure trigger (nothing to change) | `action` | `(details)` | `<Button action>`, `<Menu.Item action>` |
| Other notification | `<event>Action` | `(details)` | reserved; add only when a component needs one |

The state name in `<state>ChangeAction` is exactly the controlled prop's name, so the three props
of a controllable state always read as a set: `pressed` / `defaultPressed` /
`pressedChangeAction`. This mirrors the `on<State>Change` convention consumers already know from
Radix and Base UI, with the React docs' `Action` suffix.

Every component has **no `on*` props of its own**. The library never names a prop `onClick`,
`onChange`, `onOpenChange`, or any `on*`.

### 2.2 Signature and shared types

```ts
// packages/ui/src/internal/types.ts (re-exported from the root entry)

/** A callback the library runs inside a Transition. May be sync or async. */
export type Action<Args extends readonly unknown[] = []> = (...args: Args) => unknown;

export interface ActionDetails {
  /** The DOM event that caused the action, or undefined for programmatic changes. */
  readonly event: Event | undefined;
}

export type ChangeAction<T, Details extends ActionDetails = ActionDetails> = Action<[next: T, details: Details]>;
```

`details` is the native DOM event (not React's synthetic one) plus component-specific fields,
typed per component as `<Component><State>ChangeDetails` (for example `TabsValueChangeDetails`
may add `reason: "activate" | "fallback"`). The first argument is always the next value, so the
common case stays short:

```tsx
<Toggle pressedChangeAction={(pressed) => save(pressed)}>Favorite</Toggle>
<Tabs.Root valueChangeAction={setTab}>...</Tabs.Root>
```

The return type is `unknown`, not `void | Promise<void>`: TypeScript's void-return leniency does
not apply to unions, so `(next) => save(next)` with `save` returning `Promise<Response>` would be
a type error, and Server Functions usually return data. The library `await`s whatever comes back
(a thenable is awaited; anything else is ignored). v0 has no `cancel()` on `details`.

**`details` is serialisable; `event` is virtual.** Decided from issue #17
(`docs/research/server-function-action-props.md`): React's reply serialiser rejects a DOM `Event`
as an own property (throws without a temporary-reference set, opaque `$T` reference with one), a
non-enumerable `event` triggers a misleading dev warning on every call, and a Server Function
cannot be detected on the client. So:

1. `details` is always a **plain, extensible object of serialisable fields** (strings, numbers,
   booleans, `undefined`). Component-specific fields such as `reason` are ordinary own
   properties.
2. `event` is a **virtual, non-own property** served by a `Proxy` `get`/`has` trap. The internal
   helper `createActionDetails(event, fields)` is the only way the library builds `details`:
   ```ts
   // packages/ui/src/internal/action-details.ts (directive-free: no client-only API, section 7.1)
   export function createActionDetails<T extends object>(event: Event | undefined, fields: T): T & ActionDetails {
     return new Proxy(fields, {
       get: (target, key, receiver) => (key === "event" ? event : Reflect.get(target, key, receiver)),
       has: (target, key) => key === "event" || Reflect.has(target, key),
     }) as T & ActionDetails;
   }
   ```
   `details.event` and `"event" in details` work; `Object.keys(details)`, `{ ...details }`,
   `JSON.stringify(details)` and React's serialiser see only the real fields. The
   `ActionDetails` type and the `(next, details)` signature are unchanged.
3. Therefore **a Server Function may be passed directly to any action prop**, from a Server
   Component or a Client Component, in every RSC framework surveyed, with no dev warning. It
   receives `(next, details)` with `details.event === undefined` and every other field intact.
   A thin client wrapper is optional, useful only to drop or reshape arguments.

```tsx
// Server Component
import { Toggle } from "@funstack/ui/toggle";
import { setFavorite } from "./actions"; // "use server"; (id, next, details) => Promise<void>

<Toggle defaultPressed={post.favorited} pressedChangeAction={setFavorite.bind(null, post.id)}>
  Favorite
</Toggle>
```

Costs, documented wherever `details` is: devtools shows `Proxy(Object) { reason: "click" }`
without `event`; `expect(details).toEqual({ event })` fails, so tests assert `details.event`
directly; `structuredClone(details)` throws `DataCloneError`; and the library must not rely on
Next.js's unused-argument omission, which is bundler-specific. The target should stay an
extensible plain object (readonly-ness comes from the type, not `Object.freeze`); this is a
recommendation, not an invariant: a frozen target still answers `"event" in details` with `true`
(verified), because the Proxy invariants only constrain `has` returning `false` for
non-configurable properties and the `getOwnPropertyDescriptor` / `ownKeys` traps. The helper also
installs `set` and `defineProperty` traps that reject `"event"`, so `details.event = x` cannot
create an own enumerable property that would then be serialised.

### 2.3 Execution contract

The library wraps every action like this (shared hook, section 3.4):

```ts
startTransition(async () => {
  addTransitionType("fsui-toggle");   // section 5
  setOptimistic(next);                 // immediate feedback
  await pressedChangeAction?.(next, details);
  // commit uncontrolled state (section 3)
});
```

What a consumer can rely on:

1. **The action runs inside the component's own `useTransition`.** Never the standalone
   `startTransition` import: that would route errors to `reportError` and bypass boundaries.
2. **The action is awaited**, so it may be sync or async. Pending state lasts until the returned
   promise settles *and* the resulting render has committed (including any Suspense wait on
   already-visible content).
3. **The synchronous prefix runs during the DOM event dispatch.** `details.event.preventDefault()`
   works there, and any `setState` in the prefix is a Transition update.
4. **`setState` after the consumer's own `await` is not a Transition** (React limitation). Wrap it:
   ```tsx
   valueChangeAction={async (next) => {
     await saveSelection(next);
     startTransition(() => setTab(next)); // required after an await
   }}
   ```
   This rule is repeated in every component's docs. The library cannot paper over it.
5. **Await only what the UI must wait for.** Transition-lane updates inside an async action are
   held until the action settles, and (verified on React 19.3.1) *every* transition started
   anywhere in the app while an async action is pending is entangled with it. A two-second awaited
   save in one Toggle delays an unrelated router navigation. Background work that the UI need not
   wait for should not be awaited:
   ```tsx
   // Panel switches immediately; the save runs in the background.
   valueChangeAction={(next) => { void saveSelection(next); }}
   // Panel switches when the save succeeds; the tab shows pending meanwhile.
   valueChangeAction={async (next) => { await saveSelection(next); }}
   ```
6. **Disabled parts never dispatch.** A disabled Tab does not call `valueChangeAction`.
7. **No-op interactions do not dispatch** unless the component says otherwise. "No-op" is judged
   against the **optimistic** value, not the committed one: clicking the Tab that is already
   optimistically selected calls nothing, but clicking back to the committed tab while another is
   pending is a real dispatch that replaces the in-flight intent (section 2.5).
8. **Parts are never disabled while pending.** See section 3.6.

### 2.4 Errors

An action that throws or rejects reaches the **nearest Error Boundary above the library
component that owns the transition** (the `Root`, or the component itself). The library never
swallows an error. There is no `errorAction` prop in v0.

React alone does not guarantee this when dispatches overlap. `useTransition` stores one thenable
per `startTransition` call as a state update and only the newest is ever unwrapped, so an older
action's rejection is dropped entirely: no boundary, no `reportError`, no `unhandledrejection`
(verified by the reviewer on 19.3.1, both resolution orders, both modes). The library closes that
gap (product-owner decision): the shared hook attaches a rejection handler to every dispatch it
is not the latest for, stores the first such error in state, and **throws it from render** on the
next commit, so a superseded action's failure reaches the same nearest boundary as a latest one.
Contract:

- The latest dispatch's rejection propagates through React's own path (nothing is caught).
- A superseded dispatch's rejection is caught by the hook, stored, and rethrown from render inside
  a transition-free update so the boundary sees it on the next render of the owner.
- Only the first superseded error is kept; later ones are reported through `reportError` to avoid
  a cascade of boundary resets. Which error wins when both the latest and a superseded dispatch
  reject is not defined.
- A consumer who catches inside the action is unaffected, as before.

Optimistic state reverts automatically. Uncontrolled committed state is written only after the
action resolves, so a rejected action leaves it untouched (section 3.3). A controlled parent gets
the same by updating its state on success only.

A consumer who wants inline error UI instead of a boundary catches inside the action. Note that a
caught error makes the action *resolve*, which the library treats as success:

```tsx
<Toggle
  pressed={favorite}
  pressedChangeAction={async (next) => {
    try {
      await api.setFavorite(id, next);
      startTransition(() => setFavorite(next));
    } catch (e) {
      startTransition(() => setError(e)); // `favorite` unchanged, optimistic reverts
    }
  }}
/>
```

In uncontrolled mode a swallowed error therefore commits the new value. Use controlled mode when
the parent needs to veto.

### 2.5 Overlapping actions

React neither cancels nor orders overlapping actions. The library's stance:

- **Single-shot components (Toggle, Tabs, Accordion): latest intent wins.** The optimistic reducer
  already shows the most recent dispatch; the library commits uncontrolled state only for the most
  recently dispatched action, ignoring earlier ones that resolve later. (Verified: without this
  guard the slowest promise wins.) An earlier action's *rejection* is not ignored: the hook
  surfaces it to the boundary itself, because React would drop it (section 2.4).
- **No queueing in the library.** Components that need ordered, result-threaded actions (forms,
  counters) use `useActionState` internally and document that. None of the initial four do.
- Consumers who need abort semantics implement them in the action (`AbortController` captured in
  a ref); the library passes no signal in v0.

### 2.6 The "no handlers" rule and urgent updates

The library offers **only action props**. There is no `onClick`, no `onPress`, no `onChange`.

What is still reachable, and why it is not a contradiction:

- Native DOM event props the part does not itself use pass through to the element (section 1.5).
  They are the platform's, not ours, and are typed as the element's props.
- `ref` gives the element for `addEventListener` when a component needs an event React does not
  synthesize (`command`, `beforematch`).

**Urgent (non-transition) updates: not provided in v0.** The vision defers this until a component
genuinely needs it (text input in Combobox). Until then the stance is: a consumer who needs an
urgent update from a FUNSTACK interaction attaches a native handler through pass-through or `ref`,
and that path is unsupported and undocumented. Flagged for the product owner (open question 2).

---

## 3. State model

### 3.1 Controlled / uncontrolled

Every controllable state `x` of type `T` comes as a triple:

| Prop | Type | Meaning |
| --- | --- | --- |
| `x` | `T \| undefined` | Controlled value. `undefined` means uncontrolled. |
| `defaultX` | `T` | Initial value in uncontrolled mode. |
| `xChangeAction` | `ChangeAction<T, ...>` | Called on every user-initiated change (and automatic fallbacks, with `details.event === undefined`). |

"None selected" is `null`, never `undefined`, so that `undefined` always means uncontrolled.
Switching between modes after mount is unsupported (dev warning).

```tsx
// Uncontrolled
<Tabs.Root defaultValue="general" valueChangeAction={(v) => analytics.track(v)}>

// Controlled, local state: update in the sync prefix (a Transition update).
<Tabs.Root value={tab} valueChangeAction={(v) => { setTab(v); }}>

// Controlled, server-backed: update on success, re-wrapped after the await.
<Tabs.Root value={tab} valueChangeAction={async (v) => { await save(v); startTransition(() => setTab(v)); }}>
```

### 3.2 Three values, two audiences

The state owner (`Root` or the single component) holds:

| Value | Source | Lane | Shown by |
| --- | --- | --- | --- |
| `committed` | `x ?? internal` | transition | content regions (`Panel`, `Popup`), everything that may suspend |
| `optimistic` | `useOptimistic(committed, reducer)` | sync | trigger parts (`Tab`, `Trigger`, `Toggle`): `aria-pressed`, `aria-selected`, `data-selected`, state passed to their function props |
| `pending` | `useTransition()` | sync | `data-pending` on the owner and on the trigger that initiated the change |

**Trigger parts render optimistic state; content regions render committed state.** This is the
load-bearing rule of the whole design and it follows from React, not taste: optimistic updates
render at sync priority (verified: `dispatchOptimisticSetState` uses `SyncLane`), and a sync
render that suspends shows the Suspense fallback. Keying a panel off optimistic state would flash
the fallback whenever the new panel loads data. Keying it off committed state keeps the old panel
visible, marks the tab `data-pending`, and swaps when the data is ready. That is the
Suspense-native behaviour the vision asks for.

Two consequences to document on every trigger part: content rendered from a trigger's state (its
`children` function) must not suspend, or must have its own Suspense boundary; and the optimistic
flip never gets a view transition (section 5.1), so trigger visuals animate with CSS transitions
on the data attribute, not with the `transition` prop.

One platform-forced exception: where the platform owns the ARIA state and forbids overriding it
(`<summary>` may not carry `aria-expanded`; its expanded state comes from `<details open>`),
optimistic state is **visual only** (`data-open`, `state.open`) and assistive technology hears
the committed state when it lands. The component doc says so explicitly.

### 3.3 When uncontrolled state is committed

After the action resolves, inside a re-wrapped `startTransition`, and only if no later action has
been dispatched since (latest intent wins). This gives:

- Rollback on rejection for free (nothing was written).
- Identical observable timing to writing before the `await`: transition-lane writes inside an
  async action are held until it settles anyway (verified), so there is no cost to waiting.
- Controlled/uncontrolled parity when the controlled parent follows the "update on success"
  pattern.

Matches implication #4 of `docs/research/react-async-apis.md` (updated 2026-10-15 to this rule
after the probes in `memo/architect/conventions-notes.md`).

### 3.4 The shared hook

All of section 3 lives in one internal hook so that every component behaves identically. Sketch
(final signature belongs to the implementation):

```ts
"use client";
import { addTransitionType, startTransition, useOptimistic, useRef, useState, useTransition } from "react";

export function useControllableAction<T>(options: {
  controlled: T | undefined;
  defaultValue: T;
  action: ChangeAction<T> | undefined;
  transitionTypes?: (next: T, prev: T, details: ActionDetails) => readonly string[];
}) {
  const [internal, setInternal] = useState(options.defaultValue);
  const isControlled = options.controlled !== undefined;
  const committed = isControlled ? (options.controlled as T) : internal;
  const [optimistic, setOptimistic] = useOptimistic(committed, (_prev: T, next: T) => next);
  const [pending, startOwnTransition] = useTransition();
  const latest = useRef(0);
  const [supersededError, setSupersededError] = useState<unknown>(undefined);
  if (supersededError !== undefined) throw supersededError; // reaches the same boundary

  function dispatch(next: T, details: ActionDetails): void {
    const prev = committed;
    const id = ++latest.current;
    startOwnTransition(async () => {
      for (const type of options.transitionTypes?.(next, prev, details) ?? []) addTransitionType(type);
      setOptimistic(next);
      try {
        await options.action?.(next, details);
      } catch (error) {
        if (id === latest.current) throw error;   // React routes the latest dispatch's error
        setSupersededError((prev) => prev ?? error); // React would drop this one (section 2.4)
        return;
      }
      if (!isControlled && id === latest.current) {
        startTransition(() => setInternal(next));
      }
    });
  }

  return { committed, optimistic, pending, dispatch };
}
```

`transitionTypes` receives `details` so a component can derive direction from the dispatching
element (Tabs computes `fsui-tabs-next` / `fsui-tabs-prev` from the DOM order of
`details.event.currentTarget` relative to the previously selected tab). `prev` is the committed
value at dispatch time, not the optimistic one.

The reducer form of `useOptimistic` is mandatory so that stacked optimistic updates are re-based
onto a changed `committed` value. For single-value states the reducer is `(_, next) => next`;
multi-item states (Accordion's expanded set) use a real reducer keyed by item.

Library state never lives in `useSyncExternalStore`: a store mutation during a transition forces a
blocking re-render and defeats both fallback avoidance and ViewTransition. Reading
`matchMedia` for display only is fine.

### 3.5 Library-owned vs. browser-owned state

"Transition by default" is a statement about **library-owned state**: state that lives in React
and that the library changes in response to the user. Some state is **browser-owned** instead: a
popover's open state (top layer), `<details open>`, `<dialog open>`, a `<select>`'s value picked
through the native picker. The browser changes it before React hears about it, and no transition
can delay or roll it back. The boundary:

| | Library-owned | Browser-owned |
| --- | --- | --- |
| Examples | Toggle `pressed`, Tabs `value`, Accordion `value` in the JS variant | Tooltip/Popover `open`, `<details open>` in Accordion's static (JS-free) mode, `<dialog open>` |
| Who changes it | The library, inside its transition | The browser (top layer, light dismiss, `interestfor`, find-in-page) |
| Optimistic source | `useOptimistic` | The DOM itself |
| `xChangeAction` | Can be awaited; the UI waits for it | Notification: dispatched from the platform event (`toggle`) inside a transition, after the fact |
| Controlled mode | React value is the source of truth | React value is re-applied to the DOM after the action resolves (`showPopover()` / `hidePopover()`, `open` attribute); it follows the browser, it does not gate it |
| Pending | `data-pending` while the action runs | `data-pending` while the notification action runs; the open/close itself is already done |
| Server Components | Only through Server Functions as actions | Uncontrolled form needs no behaviour JS; the part may still be a client module (section 7.3) |
| Residual browser path | A library-owned state the browser can also change (find-in-page revealing `<details>` or `hidden="until-found"`, pre-hydration clicks on `<summary>`) is reconciled by dispatching the change with `details.reason: "platform"` and `event` set to the platform event, then re-applying committed state to the DOM after the action settles | n/a |

Rules:

- A component prefers browser-owned state when the platform offers it (Popover API over a React
  `open` boolean, `<details>` over a JS disclosure). That is principle 5 of the vision, and it is
  the only way a primitive can be JS-free.
- A component never mirrors browser-owned state into React state as the source of truth. It reads
  the DOM (`matches(":popover-open")`, `details.open`) when it needs the value for attributes.
- `<ViewTransition>` does not apply to browser-owned open/close (the browser performs it outside
  a React transition). Those parts animate with `@starting-style` and
  `transition-behavior: allow-discrete` in CSS, and the component docs show the CSS.
- Per-component designs list every state and label it library-owned or browser-owned.

### 3.6 `disabled`

`disabled` is a boolean prop on the owner and on individual triggers. Native `disabled` is used
where the APG pattern allows it; where the pattern wants a focusable disabled control (Tabs), the
part sets `aria-disabled` instead. In both cases the part emits `data-disabled` and never
dispatches.

**A part is never disabled while pending** (product-owner decision, library-wide). The library
does not set `disabled`, `aria-disabled` or `inert` on a trigger because its action is in flight:
native `disabled` drops keyboard focus, and the latest-intent rule (section 2.5) already makes
repeated activation safe. Consumers who want to block re-activation do it with CSS
(`[data-pending] { pointer-events: none }`) or announce it with `aria-busy` through pass-through;
the library emits `data-pending` and nothing else.

### 3.7 `keepMounted` on content regions

Content regions whose visibility is driven by library state (`Tabs.Panel`, `Accordion.Panel`)
share one prop shape:

```ts
keepMounted?: boolean | "until-found";
```

| Value | Hidden panel is | Notes |
| --- | --- | --- |
| `false` (default) | not rendered | Matches ecosystem expectations; no hidden `<video>` surprises. |
| `true` | rendered inside `<Activity mode="hidden">` | DOM and state preserved, effects torn down, pre-rendered at low priority. The mode change happens inside the library's transition so nested `<ViewTransition>` boundaries get enter/exit. |
| `"until-found"` | rendered with `hidden="until-found"` | Find-in-page and text fragments reveal it; the `beforematch` event dispatches the matching change action. Uses the ref-based upgrade from section 7.4 because react-dom serialises `hidden` as a boolean. Incompatible with `<Activity>` on the same element, hence a separate value rather than a second boolean. |

Tabs defines the semantics first; Accordion reuses the prop unchanged.

---

## 4. Pending and state exposure

### 4.1 One vocabulary, three forms

A state has one name. It appears as `data-<name>` on the element, as `state.<name>` in the
function props and `render`, and under that name in docs. No `is` prefix (`pressed`, not
`isPressed`), matching the prop names.

| Name | Kind | Where | Meaning |
| --- | --- | --- | --- |
| `pending` | boolean | owner + initiating trigger | An action dispatched through this component is in flight (including the Suspense wait of the resulting render). |
| `disabled` | boolean | any | Disabled by prop or inherited from the owner. |
| `pressed` | boolean | Toggle | Optimistic pressed state. |
| `selected` | boolean | Tab, Item | Optimistic selection on triggers; committed on panels. |
| `open` | boolean | Popup, Trigger, Accordion item/trigger/panel | Disclosure and open state, following the platform's word (`<details open>`, `:open`, `ToggleEvent.newState`); `expanded` is not used. Emitted for library-owned open state; purely browser-owned open state (Tooltip in the top layer) is styled with `:popover-open` / `:open` and emits no attribute (section 7.4). |
| `checked` | boolean | future Checkbox/Switch | |
| `orientation` | `"horizontal" \| "vertical"` | Root, List, Tab | Enum attribute with value. |

Booleans are emitted by **presence**: `data-pending=""` when true, absent when false. Enums carry
their value. Negative pairs (`data-closed`, `data-unchecked`) are not emitted; use `:not([data-open])`.
React stringifies a boolean `true` on `data-*` attributes as `"true"`, so the value must be `""`
(never `pending || undefined`); the internal `dataAttr(flag)` helper is the only place this is
spelled out.

```tsx
<button data-pending={pending ? "" : undefined} data-selected={selected ? "" : undefined}>
```

```css
.tab[data-selected] { font-weight: 600; }
.tab[data-pending] { cursor: progress; }
.tab[data-pending]::after { content: ""; animation: spin 1s linear infinite; }
.panel:not([data-selected]) { display: none; }
```

Tailwind works unchanged: `data-selected:font-semibold data-pending:animate-pulse`.

### 4.2 What is *not* exposed

Hover, focus, focus-visible, active/pressed-down, and focus-within come from the platform:
`:hover`, `:focus-visible`, `:active`, `:focus-within`. React Aria's normalised `data-hovered`
exists to smooth over device differences; the library's browser policy (latest engines only) makes
that unnecessary, and leaving it out keeps every part free of pointer tracking code. Platform
pseudo-classes for state (`:open`, `:popover-open`, `:disabled`) are documented next to the
equivalent data attribute where both apply.

### 4.3 Where `data-pending` lands

- The **owner** (`Root`, or the single component): while its transition is pending.
- The **trigger the user acted on**: while the owner is pending and this trigger is the optimistic
  target (for Tabs: `optimistic === tab.value`; for Toggle: always the element).
- **Panels** do not get `data-pending`; a panel is either committed-visible or not. Consumers who
  want to dim the old panel while the next one loads select on the root:
  `.root[data-pending] .panel { opacity: .6 }`.

The state object given to function props on the owner includes `pending`; on triggers it includes
`pending` with the trigger-local meaning above.

---

## 5. ViewTransition integration

### 5.1 Default wiring

Every part whose mount, unmount or content is driven by library state (Panel, Popup, Indicator,
Toggle's own element when its children can change) renders a `<ViewTransition>` as the **outermost
node of its output**, before any DOM element, with `default="none"`. Nothing animates unless the
consumer opts in, and when it is `"none"` React does not even assign a name, so the cost is nil.

Parts whose visibility is **browser-owned** (section 3.5: Tooltip's `Popup` in the top layer, the
Accordion's `<details>` in static mode) render no `<ViewTransition>` and have **no `transition` prop**;
their open/close happens outside any React transition and animates with `@starting-style` and
`transition-behavior: allow-discrete` in CSS. "Every animatable part has `transition`" means every
part whose mount, unmount or content is driven by library state.

```tsx
// inside Tabs.Panel
return (
  <ViewTransition default={transition ?? "none"}>
    <div role="tabpanel" hidden={!selected} ...>{children}</div>
  </ViewTransition>
);
```

Because library state changes are transitions, the commit that ends the action and any rollback
animate through this boundary with no extra code. **The optimistic commit does not animate**: it
is a sync-lane render, and react-dom starts a view transition only when every committed lane is a
transition, retry or idle lane (verified on 19.3.1; see `design/components/toggle.md` section 7.2).
What this means per kind of part:

| Part renders | Animate with | Why |
| --- | --- | --- |
| Optimistic state (Toggle's element, `Tabs.Tab`, `Accordion.Trigger`, a `Tabs.Indicator` that follows optimistic selection) | CSS `transition` on the data attribute (`[data-pressed]`, `[data-selected]`, `--active-tab-left` style variables) | The flip lands in a sync-lane commit; `<ViewTransition>` never fires for it, on click or on rollback. |
| Committed state (`Tabs.Panel`, `Accordion.Panel`, `Popup` content driven by library state) | `transition` prop (`<ViewTransition>`) | The swap lands in the transition-lane commit that settles the action. |
| `pending` leaving, a controlled snap-back, content the parent changes in the same transition | `transition` prop | Same commit as above (snap-backs carry no `fsui-*` types, section 5.3). |

A `Tabs.Indicator` therefore gets two documented modes: follow optimistic selection and animate
with CSS (moves on click, snaps back on rejection), or follow committed selection and animate with
`<ViewTransition>` (moves when the panel does). The component design picks the default. Any part
that keys a `<ViewTransition>` on optimistic state is a bug, not a style choice.

Product-owner decision: `transition` stays on Toggle in v0 even though its own flip cannot use it,
documented honestly (it animates the end of the action and content keyed on `pending`), so the
"every animatable part has `transition`" rule has no exceptions.

### 5.2 Consumer API: the `transition` prop

One prop, `transition`, with exactly the type of React's `default` prop on `<ViewTransition>`:
`"auto"`, `"none"`, a View Transition Class string, or a map from transition type to class. It is
forwarded as `default`, so React's documented resolution rules apply unchanged.

```tsx
<Tabs.Panel value="billing" transition="fade" />

<Tabs.Panel
  value="billing"
  transition={{ "fsui-tabs-next": "slide-left", "fsui-tabs-prev": "slide-right", default: "none" }}
/>
```

```css
::view-transition-old(.slide-left) { animation: 160ms ease-in both slide-out-left; }
::view-transition-new(.slide-left) { animation: 160ms ease-out both slide-in-right; }
```

Per-trigger props (`enter`, `exit`, `update`, `share`) and `name` are not exposed in v0; a single
class already distinguishes old/new in CSS. A component that needs shared-element transitions
(Tabs.Indicator) documents its own `transitionName` prop. A future `viewTransition` prop could
pass the full props object through; it is not designed now.

### 5.3 Library-emitted transition types

Each dispatch adds `fsui-<component>` and, when the change has a direction or kind,
`fsui-<component>-<change>`:

| Component | Types |
| --- | --- |
| Toggle | `fsui-toggle`, `fsui-toggle-press`, `fsui-toggle-release` |
| Tabs | `fsui-tabs`, `fsui-tabs-next`, `fsui-tabs-prev` (by index order) |
| Accordion | `fsui-accordion`, `fsui-accordion-expand`, `fsui-accordion-collapse` |

Hyphens only: types are also exposed as `:active-view-transition-type(fsui-tabs-next)` and a
colon would need escaping there. Consumers' own `addTransitionType` calls in the action's sync
prefix are collected into the same transition.

Types are attached only to the commit that ends a dispatched action. A controlled snap-back (the
parent did not adopt the value) and a boundary swap after a rejection carry **no** `fsui-*` types,
so a type-map `transition` needs a `default` entry if rollbacks should animate; with
`default: "none"` they do not. Overlapping dispatches contribute all of their types to the single
commit that ends them.

### 5.4 Reduced motion

The library ships no animation by default, so there is nothing to disable. Any CSS preset the
library ships later (`@funstack/ui/transitions.css`) must include:

```css
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; }
}
```

Every `transition` example in the docs carries this block. No JS-level `matchMedia` check in v0.

### 5.5 Rules for implementers

- Never call `document.startViewTransition`; never use `flushSync` in a component that contains a
  `<ViewTransition>`.
- `<ViewTransition>` renders no DOM and is safe in server-rendered trees; hydration is not a
  transition, so there is no enter animation on first paint. Streamed Suspense reveals inside a
  boundary may animate; this is unverified and not documented as a feature until a demo confirms it.
- `<Activity>` (for `keepMounted` panels) must change mode inside the library's transition so that
  nested boundaries get enter/exit.

---

## 6. Suspense stance

- **Consumers own Suspense boundaries.** The library never wraps `children` in `<Suspense>` and
  has no `fallback` props in v0. Boundary placement decides where fallbacks appear and whether
  first-mount state is discarded; that is a layout decision.
- **Suspending children are the normal case**, handled by sections 2 and 3: the update is a
  transition, content regions key off committed state, so the previous content stays and the owner
  and trigger show `data-pending` until the new content is ready.
- **Newly mounted boundaries show their fallback immediately** (React rule). A panel that mounts
  its own `<Suspense>` shows that fallback right away; this is the consumer's choice and the way to
  opt into "show a skeleton instead of waiting".
- **Keying**: when the consumer wants a fresh fallback for a different item rather than a wait,
  they key their boundary (`<Suspense key={tab}>`). Component docs show this.
- **The library's own `use()` calls** (`use(browser())` for client-only sub-parts) require a
  Suspense boundary above the component during SSR; a component that does this says so in its
  design doc.

---

## 7. Server/client boundaries and packaging

### 7.1 Per-file directive

`"use client"` goes at the top of **each source file that uses a client-only API** (hooks other
than `use`/`useId`, `createContext`, `startTransition`, DOM access, event props) and nowhere
else. Files without the directive must not import from files with it, with two exceptions:
`index.ts` files, which only re-export, and the React 19.3 pattern of a directive-free file
*rendering* a context provider imported from a client module (`<TabsContext value={...}>`), which
is allowed because Server Components may render client-created contexts. No initial component
needs the second exception; a component that does says so in its design doc.

```
src/tabs/
  index.ts          # no directive: assembles the namespace, re-exports types
  tabs-context.ts   # "use client" (createContext)
  tabs-root.tsx     # "use client"
  tabs-tab.tsx      # "use client"
  tabs-panel.tsx    # "use client"
src/accordion/
  index.ts
  accordion-context.ts   # "use client": Item/Trigger/Panel read Root's context
  accordion-root.tsx     # "use client": renders <details>/<summary>; no behaviour JS for the
  ...                    # uncontrolled toggle, but context makes every part a client module
```

A Server Component may render any part: the namespace object is a plain object of client
references. It may pass only serializable props, so **a Server Component cannot pass a plain
function as an action**; it passes a Server Function (`"use server"`) or renders the component
from its own client component. Because `details.event` is virtual (section 2.2), the Server
Function receives `(next, details)` with `event` absent and every serialisable field intact;
no wrapper is needed.

### 7.2 Build: unbundled, directive-preserving

`tsdown` with `unbundle: true` emits one output file per source file and keeps the directive at
the top of each (verified against tsdown 0.23.1; the default bundled build strips it with a
warning). `sideEffects: false` stays.

```ts
// packages/ui/tsdown.config.ts
export default defineConfig({
  entry: ["src/index.ts", "src/toggle/index.ts", "src/tabs/index.ts", "src/accordion/index.ts", "src/tooltip/index.ts"],
  format: ["esm"],
  unbundle: true,
  dts: true,
  exports: true,            // generates the exports map from entries
  external: ["react", "react-dom", "react/jsx-runtime"],
});
```

### 7.3 JS-free primitives

"JS-free" is a statement about **behaviour**, not about module boundaries: no JavaScript runs for
the interaction, and the markup is complete and functional before hydration. Whether a part's
source file carries `"use client"` is a separate, per-component fact recorded in the component's
design doc; the Directive test row (section 10.1) asserts whatever that doc says.

The two are separate because of a Flight constraint, verified while designing Accordion: a Server
Component cannot read context ("Cannot read a Client Context from a Server Component"), and the
parts of a compound component need context to find their Root (there is no HTML inheritance for
`<details name>`). So every part of Accordion is a client module even though the uncontrolled
accordion toggles with zero behaviour JS:

```tsx
// app/faq.tsx — a Server Component. Renders client parts; the toggle works before hydration.
import { Accordion } from "@funstack/ui/accordion";

export function Faq({ items }) {
  return (
    <Accordion.Root exclusive>
      {items.map((item) => (
        <Accordion.Item key={item.id} value={item.id}>
          <Accordion.Trigger>{item.question}</Accordion.Trigger>
          <Accordion.Panel>{item.answer}</Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
```

What a consumer gets from this: `<details>`/`<summary>` markup in the HTML, native open/close,
find-in-page reveal and exclusive groups via `name` with no hydration required; the part code is
in the client bundle and hydrates to add the action props, controlled mode and animation. What
they do not get: a directive-free module. Truly directive-free variants (parts that take their
wiring as props instead of context) are tracked in issue #19 and are not part of the initial
four. Passing any action prop to a part from a Server Component is a type error unless the action
is a Server Function (section 2.2).

---

### 7.4 Attributes and events React cannot express

The platform moves faster than react-dom and `@types/react`. Conventions for the gap, with the
cases known on 2026-10-15 (`docs/research/modern-platform-survey.md`, "React 19.3 integration
notes"):

| Gap | Convention |
| --- | --- |
| Attribute unknown to react-dom (`command`, `commandfor`, `interestfor`, `focusgroup`, `closedby`, `switch`, `name` on `<details>`) | Write it **lowercase** in JSX; react-dom passes unknown lowercase attributes through verbatim on client and server. Never camelCase (`interestFor` renders the wrong attribute and warns). |
| Attribute untyped in `@types/react` (`command`, `commandfor`, `interestfor`, `focusgroup`, `switch`) | One module augmentation file, `src/internal/platform-attributes.d.ts`, augmenting `React.HTMLAttributes` / `ButtonHTMLAttributes` / `AnchorHTMLAttributes` with the typed values from the research docs. The file is shipped in `dist` and referenced from the root `.d.mts` so consumers get the same types. Each entry carries a comment with the DefinitelyTyped issue so it can be deleted when upstream lands. |
| Attribute react-dom serialises wrongly (`hidden="until-found"` becomes `hidden=""` on both client and server) | Render the boolean form so SSR output is correct, then upgrade in a layout effect through the part's ref (`el.setAttribute("hidden", "until-found")`), and listen to the platform event that the browser uses to undo it (`beforematch`) to dispatch the matching change action. Encapsulate each such case in one internal hook (`use-until-found.ts`) so the workaround has exactly one home. |
| Event React does not synthesize (`command`, `interest`, `loseinterest`, `beforematch`, `scrollsnapchange`) | `addEventListener` through the part's ref (or a Fragment ref for sibling groups), inside an effect that uses `useEffectEvent` for the handler body, dispatching into the component's transition like any other interaction. Never expose these as `on*` props (section 2.6). |
| Event React does synthesize, but the handler must be feature-detected away (Tooltip's `pointerenter` / `focus` when `interestfor` is native) | Same `addEventListener`-in-effect pattern: the effect subscribes only when the JS path is needed, so markup is identical on server and client. Because no prop-form handler is installed, none is omitted from the part's type and the consumer's `on*` props pass through (section 1.5). |
| Pseudo-class the platform already provides (`:open`, `:popover-open`, `:disabled`) | Document it next to the equivalent data attribute; do not emit a duplicate attribute when the pseudo-class carries the same meaning and the state is browser-owned. |

Rules of thumb: platform attribute names in source are the HTML spelling; the augmentation file
is the only place any `declare module` appears (`"react"` for attributes, `"csstype"` for
properties such as `interest-delay-start` / `interest-delay-end`); and every workaround for a react-dom
limitation links the upstream issue (filed by us if none exists, as the survey recommends for
`hidden="until-found"`).

---

## 8. Experimental flag mechanism

Platform features that are not in the latest stable of all three engines may be used only behind
a flag (`docs/vision.md`). Mechanism:

1. **Feature inside an existing component: an `experimental_<feature>` prop** on the part that
   uses it, defaulting to off.

   ```tsx
   <Tooltip.Trigger experimental_interestFor>Save</Tooltip.Trigger>
   <Tabs.List experimental_focusgroup>...</Tabs.List>
   <Accordion.Root experimental_interpolateSize>...</Accordion.Root>
   ```

   The prefix follows React's own naming for unstable APIs. It is greppable, visible at the call
   site where the browser-support decision is made, typed, and tree-shakeable. When the feature
   reaches all engines the prop is removed and the behaviour becomes default; the removal is a type
   error that tells every consumer exactly where to delete it.

   First customers, per the research docs:

   | Feature | Missing in | Likely prop | Effect when on |
   | --- | --- | --- | --- |
   | `popover="hint"` | Safari 27.0 (TP only) | `Tooltip.Popup experimental_hint` | Popup renders `popover="hint"` instead of the baseline type plus JS Escape/outside-click handling. |
   | `interestfor` | Gecko, WebKit | `Tooltip.Trigger experimental_interestFor` | Trigger renders `interestfor`; JS hover/focus handlers are skipped where the browser supports it. |
   | `focusgroup` | Gecko, WebKit | `Tabs.List experimental_focusgroup` | Native roving focus; JS arrow-key handling skipped where supported. |
   | `interpolate-size` / `calc-size()` | Gecko, WebKit (TP) | `Accordion.Root experimental_interpolateSize` | Inherited property set on the root; `::details-content` height animates to `auto` natively. |
   | `<dialog closedby>` | WebKit (TP) | `Dialog.Root experimental_closedby` | Native light dismiss instead of JS. |
   | Customizable `<select>` | Gecko (pref) | `Select.Root experimental_baseAppearance` | `appearance: base-select` markup; degrades to the native picker elsewhere. |

   Two flags with the same graduation path go on the same part as separate props, not one
   object, so each can be removed independently.

2. **Whole component that cannot exist without a flagged feature: the `@funstack/ui/experimental`
   subpath**, same namespace shape, documented as unstable. Nothing in the initial four needs this
   (each has a non-flagged baseline per the research docs).

3. **No provider / global config in v0.** A global switch hides a per-site browser decision in a
   place far from the markup, and Server Components cannot create context anyway.

When the flagged path is a strict superset of the baseline (Chromium's `interestfor` tooltip
versus the JS fallback), the component may feature-detect at runtime *only when the flag is on*;
with the flag off it runs the baseline everywhere. Feature detection reads a prototype property
(`"interestForElement" in HTMLButtonElement.prototype`, `"focusgroup" in HTMLElement.prototype`)
inside an effect or `use(browser())`, never during render, so flags never change markup between
server and client renders. A flagged feature that silently does nothing in unsupported engines
(`interestfor`) must keep the baseline JS path active underneath unless the flag's docs say the
consumer has accepted Chromium-only behaviour.

---

## 9. Naming, file layout, and TypeScript

### 9.1 Layout

```
packages/ui/src/
  index.ts                  # root entry: re-exports every component namespace and shared types
  internal/                 # not exported
    types.ts                # Action, ActionDetails, ChangeAction, RenderProp, StateValue
    use-controllable-action.ts
    use-render.tsx          # resolves render / className / style / children against state
    merge-props.ts
  __tests__/
    vitest.setup.ts
    helpers.tsx             # section 10
  toggle/
    index.ts
    toggle.tsx
    toggle.test.tsx
  tabs/
    index.ts
    tabs-context.ts
    tabs-root.tsx
    tabs-list.tsx
    tabs-tab.tsx
    tabs-panel.tsx
    tabs.test.tsx
```

- Folders and files: kebab-case. Components and types: PascalCase. Hooks: `use-*.ts`.
- One part per file. Tests are colocated; a multi-part component has one test file per namespace
  (`tabs.test.tsx`), split only when it grows past a few hundred lines.
- Relative imports carry `.js` extensions (repo convention).

### 9.2 Exports

Both a root entry and per-component subpaths; the subpath is the documented form:

```tsx
import { Tabs } from "@funstack/ui/tabs";      // documented
import { Tabs, Toggle } from "@funstack/ui";   // also works
```

With an unbundled build both resolve to the same files, so there is no duplication. The exports
map is generated by tsdown from the entry list (section 7.2); adding a component means adding its
`index.ts` to `entry`.

### 9.3 Namespace object

```ts
// src/tabs/index.ts
import { TabsRoot } from "./tabs-root.js";
import { TabsList } from "./tabs-list.js";
import { TabsTab } from "./tabs-tab.js";
import { TabsPanel } from "./tabs-panel.js";

export const Tabs = { Root: TabsRoot, List: TabsList, Tab: TabsTab, Panel: TabsPanel } as const;

export type { TabsRootProps, TabsRootState, TabsValueChangeDetails } from "./tabs-root.js";
export type { TabsTabProps, TabsTabState } from "./tabs-tab.js";
// ...
```

The part components keep their long names (`TabsRoot`) as `displayName` and in stack traces.

### 9.4 Public types

- `<Component><Part>Props`, `<Component><Part>State`; single-part components drop the part:
  `ToggleProps`, `ToggleState`.
- `<Component><State>ChangeDetails` extends `ActionDetails`.
- Shared: `Action`, `ActionDetails`, `ChangeAction`, `RenderProp<Props, State>`,
  `StateValue<T, State> = T | ((state: State) => T)`.
- Props interfaces are `interface`s extending the element props (section 1.5); state objects are
  `interface`s with readonly members.
- Everything public is exported with `export type`; nothing from `internal/` is public.

---

## 10. Testing conventions

### 10.1 Required coverage per component

Every component's test file has, at minimum, one test for each row. Rows marked "both" run
against controlled and uncontrolled mode via `describe.each`. Rows that cannot apply to a
component with no action props (sync action, async action, rejection, overlap, post-await rule,
controlled/uncontrolled parity) are listed as N/A in a comment at the top of the test file, with
the reason (for example: "Tooltip: open state is browser-owned, no action props").

| Area | What the test proves |
| --- | --- |
| Roles and ARIA | Default elements, roles, `aria-*` wiring between parts, ids resolve. |
| Keyboard | Every APG interaction for the pattern (arrows, Home/End, Space/Enter, Escape as applicable). |
| Sync action (both) | Action receives `(next, details)`; `details.event` is the native event; disabled parts never dispatch; no-op interactions never dispatch. |
| Async action (both) | While the promise is unresolved: `data-pending` on owner and trigger, optimistic state on the trigger, committed state unchanged on content. After resolve: `data-pending` gone, content updated. |
| Rejection (both) | Rejected action reaches an Error Boundary around the component; optimistic state reverts; uncontrolled committed state unchanged. Caught-inside variant: resolves, commits. |
| Overlap | Two actions in flight, resolved out of order: optimistic shows the latest, final committed state is the latest dispatched (uncontrolled). |
| Superseded rejection (both) | Two dispatches; the older rejects **after** the newer resolved, and separately **while** the newer is still pending. In both cases the error reaches an Error Boundary around the component (React alone drops it, section 2.4); the newer action's outcome is unaffected. |
| Suspending content (both) | Content keyed on the new value suspends: old content stays, no fallback shown by a boundary above the component, `data-pending` on; after resolve, new content. |
| Function props | `className`, `style`, `children`, `render` receive the documented state and the attributes agree with it. |
| `render` element | Element form replaces the default element, merges `className`/`style`, keeps the library's handler working, forwards `ref`. |
| Post-await rule | A controlled parent updating after its own `await` inside `startTransition` works end to end (guards the documented pattern). |
| Directive | Each built part file starts with `"use client"` or not, exactly as the component's design doc records (script over `dist`, run in `test:run` after `build`). |

ViewTransition cannot be observed in jsdom (`document.startViewTransition` is absent and React
falls back silently). Tests only assert that components render with and without `transition`
set; animation behaviour is checked in the example app. When a component depends on platform APIs
jsdom lacks (Popover, anchor positioning), its test file notes which rows need browser mode;
adding vitest browser mode is a separate decision.

### 10.2 Shared helpers (`src/__tests__/helpers.tsx`)

| Helper | Purpose |
| --- | --- |
| `deferred<T>()` | `{ promise, resolve, reject }` for actions whose settlement the test controls. |
| `createSuspender<T>()` | A cached promise resource with `resolve(value)`; `<Suspender />` renders it via `use()` so tests can make content suspend deterministically. |
| `<ErrorCatcher>` | Error Boundary that records the error and renders a marker element. |
| `renderBoth(renderFn)` | Runs a test body against uncontrolled and controlled wrappers; the controlled wrapper follows the "update on success" pattern. |
| `expectPending(el)` / `expectNotPending(el)` | `toHaveAttribute("data-pending", "")` wrappers so the attribute form is asserted in one place. |
| `setupUser()` | `@testing-library/user-event` instance (to be added as a devDependency) for keyboard tests. |

Tests interact through `user-event`, await `act`, and assert on the DOM (attributes, roles, text),
never on internal hook state.

---

## Resolved questions (2026-10-15)

Decided by the product owner, items 1, 2 and 5 confirmed with the user:

1. **Action naming**: keep the `x` / `defaultX` / `xChangeAction` triple (`pressedChangeAction`,
   `valueChangeAction`, `openChangeAction`). No bare `changeAction`.
2. **Urgent opt-out placeholder**: v0 provides no mechanism. Native `on*` props the library does not
   use pass through to the element as an unsupported escape hatch; library-used handlers are removed
   from part prop types.
3. **Swallowed errors count as success** in uncontrolled mode. No veto mechanism until a real case
   appears.
4. **Root entry plus per-component subpaths.**
5. **`experimental_<feature>` props** per part; `@funstack/ui/experimental` subpath only for whole
   components that cannot exist without a flagged feature.
6. **Transition entanglement**: being re-verified by the React researcher and recorded in
   `docs/research/react-async-apis.md`. Guidance "await only what the UI must wait for" stands.
7. **No hover/focus data attributes**; consumers use CSS pseudo-classes.
8. **Never natively disabled while pending** (section 3.6): the library emits `data-pending` only;
   latest-intent covers repeated activation; CSS or `aria-busy` are the consumer's escape hatches.
9. **`transition` stays on Toggle in v0** (section 5.1), documented as animating the settling of
   the action, not the optimistic flip.
10. **`Arrow` part held for v0** (from the Tooltip design). Popups ship without an `Arrow` part
    until a component shows it cannot be done in CSS on the popup itself.
11. **`provides="description" | "name"`** is the convention for any part whose content labels or
    describes another element (Tooltip's `Popup`, future `Label`/`Description` parts):
    `"description"` wires `aria-describedby`, `"name"` wires `aria-labelledby`. The component picks
    the default (Tooltip: `"description"`, switching to `"name"` when the trigger has no accessible
    name of its own), and the prop name is shared across components.
12. **All Accordion parts are client modules** (section 7.3). Server Components render them and
    the native toggle works before hydration; directive-free variants are a later concern (#19).

13. **`details.event` is a virtual Proxy-served property** (raised by the Toggle design, #6;
    resolved by research #17, `docs/research/server-function-action-props.md`, option (e), see
    section 2.2). Server Functions may be passed directly to any action prop; the thin client
    wrapper is optional.

## Open questions

None at present.
