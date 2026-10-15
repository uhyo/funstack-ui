# @funstack/ui API conventions

Status: **proposed** (2026-10-15, GitHub issue #5). Binding for every component design in
`design/components/` once accepted. `docs/vision.md` wins over this document; this document wins
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
| 3 | State model | `x` / `defaultX` / `xChangeAction`. The state owner holds committed state, optimistic state (`useOptimistic`, reducer form) and the transition. **Trigger parts render optimistic state; content regions render committed state.** Uncontrolled state is committed after the action resolves; the latest dispatched action wins. |
| 4 | Exposure | One vocabulary in three forms: `data-pending` / `state.pending` / docs. Booleans by attribute presence. Hover/focus/active come from CSS pseudo-classes, not attributes. |
| 5 | ViewTransition | Every animatable part wraps its output in `<ViewTransition default="none">`; a `transition` prop forwards React's own `default` shape. Library adds `fsui-<component>[-<change>]` transition types. Reduced motion handled in CSS. |
| 6 | Suspense | Consumers own Suspense boundaries. Library content regions are keyed off committed state so suspending children keep the old UI and show as `data-pending`. |
| 7 | RSC | `"use client"` per source file; unbundled build (`tsdown` `unbundle: true`, verified to keep the directive); JS-free primitives live in directive-free files and are exported from the same namespaces. |
| 8 | Experimental | `experimental_<feature>` props on the part that uses the feature; whole components that cannot exist without a flagged feature ship from `@funstack/ui/experimental`. No provider. |
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
- Library-controlled attributes (`role`, `aria-*` state, `id` wiring, `data-*` state) win over the
  element's. Everything else, the element wins.

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
props the part owns. The library's own event handlers are **omitted from the type** so that a
consumer cannot silently clobber them:

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
export type Action<Args extends readonly unknown[] = []> = (...args: Args) => void | Promise<void>;

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

Return values are ignored; only the promise is awaited. v0 has no `cancel()` on `details`.

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
7. **No-op interactions do not dispatch** unless the component says otherwise (clicking the
   already-selected Tab calls nothing).

### 2.4 Errors

An action that throws or rejects propagates to the **nearest Error Boundary above the library
component that owns the transition** (the `Root`, or the component itself). The library does not
catch, log, or swallow. There is no `errorAction` prop in v0.

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
  guard the slowest promise wins.)
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

Consequence to document on every trigger part: content rendered from a trigger's state (its
`children` function) must not suspend, or must have its own Suspense boundary.

### 3.3 When uncontrolled state is committed

After the action resolves, inside a re-wrapped `startTransition`, and only if no later action has
been dispatched since (latest intent wins). This gives:

- Rollback on rejection for free (nothing was written).
- Identical observable timing to writing before the `await`: transition-lane writes inside an
  async action are held until it settles anyway (verified), so there is no cost to waiting.
- Controlled/uncontrolled parity when the controlled parent follows the "update on success"
  pattern.

Supersedes implication #4 of `docs/research/react-async-apis.md` with the same outcome and a
more precise reason.

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
  transitionType?: (next: T, prev: T) => string | undefined;
}) {
  const [internal, setInternal] = useState(options.defaultValue);
  const isControlled = options.controlled !== undefined;
  const committed = isControlled ? (options.controlled as T) : internal;
  const [optimistic, setOptimistic] = useOptimistic(committed, (_prev: T, next: T) => next);
  const [pending, startOwnTransition] = useTransition();
  const latest = useRef(0);

  function dispatch(next: T, details: ActionDetails): void {
    const prev = committed;
    const id = ++latest.current;
    startOwnTransition(async () => {
      const type = options.transitionType?.(next, prev);
      if (type !== undefined) addTransitionType(type);
      setOptimistic(next);
      await options.action?.(next, details);
      if (!isControlled && id === latest.current) {
        startTransition(() => setInternal(next));
      }
    });
  }

  return { committed, optimistic, pending, dispatch };
}
```

The reducer form of `useOptimistic` is mandatory so that stacked optimistic updates are re-based
onto a changed `committed` value. For single-value states the reducer is `(_, next) => next`;
multi-item states (Accordion's expanded set) use a real reducer keyed by item.

Library state never lives in `useSyncExternalStore`: a store mutation during a transition forces a
blocking re-render and defeats both fallback avoidance and ViewTransition. Reading
`matchMedia` for display only is fine.

### 3.5 Platform-owned state

Some states are owned by the browser, not React: a popover's open state (top layer), `<details
open>`, `<dialog open>`. For these:

- The uncontrolled form is the platform's own and needs no JS; it can be a Server Component.
- The library *observes* the state through the platform event (`toggle`) and dispatches
  `xChangeAction` from it, inside a transition, with the DOM as the optimistic source.
- The controlled form re-syncs the DOM to React's value after the action resolves. `xChangeAction`
  cannot delay a platform-initiated open or close; it can only follow it.

Per-component designs say which of their states are platform-owned.

### 3.6 `disabled`

`disabled` is a boolean prop on the owner and on individual triggers. Native `disabled` is used
where the APG pattern allows it; where the pattern wants a focusable disabled control (Tabs), the
part sets `aria-disabled` instead. In both cases the part emits `data-disabled` and never
dispatches.

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
| `expanded` | boolean | Accordion trigger/panel | As above. |
| `open` | boolean | Popup, Trigger | Platform or library open state. |
| `checked` | boolean | future Checkbox/Switch | |
| `orientation` | `"horizontal" \| "vertical"` | Root, List, Tab | Enum attribute with value. |

Booleans are emitted by **presence**: `data-pending=""` when true, absent when false. Enums carry
their value. Negative pairs (`data-closed`, `data-unchecked`) are not emitted; use `:not([data-open])`.

```tsx
<button data-pending={pending || undefined} data-selected={selected || undefined}>
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

```tsx
// inside Tabs.Panel
return (
  <ViewTransition default={transition ?? "none"}>
    <div role="tabpanel" hidden={!selected} ...>{children}</div>
  </ViewTransition>
);
```

Because library state changes are transitions, the optimistic feedback, the eventual commit, and a
rollback all animate through the same boundary with no extra code.

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
else. Files without the directive must not import from files with it, except `index.ts` files,
which only re-export.

```
src/tabs/
  index.ts          # no directive: assembles the namespace, re-exports types
  tabs-context.ts   # "use client" (createContext)
  tabs-root.tsx     # "use client"
  tabs-tab.tsx      # "use client"
  tabs-panel.tsx    # "use client"
src/accordion/
  index.ts
  accordion-static.tsx   # no directive: <details>/<summary> markup only; Server Component capable
  accordion-root.tsx     # "use client": controlled / exclusive / animated variant
```

A Server Component may render any part: the namespace object is a plain object of client
references. It may pass only serializable props, so **a Server Component cannot pass a plain
function as an action**; it passes a Server Function (`"use server"`) or renders the component
from its own client component. Component docs state this.

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

A primitive that needs no JS (static Accordion on `<details>`, `commandfor`-driven triggers) lives
in a directive-free file and is exported from the same namespace as its client siblings (for
example `Accordion.Static` next to `Accordion.Root`), so consumers discover both in one place. Its
test asserts that the built file does not start with `"use client"` (section 10).

---

## 8. Experimental flag mechanism

Platform features that are not in the latest stable of all three engines may be used only behind
a flag (`docs/vision.md`). Mechanism:

1. **Feature inside an existing component: an `experimental_<feature>` prop** on the part that
   uses it, defaulting to off.

   ```tsx
   <Tooltip.Trigger experimental_interestFor>Save</Tooltip.Trigger>
   <Tabs.List experimental_focusgroup>...</Tabs.List>
   <Accordion.Panel experimental_interpolateSize>...</Accordion.Panel>
   ```

   The prefix follows React's own naming for unstable APIs. It is greppable, visible at the call
   site where the browser-support decision is made, typed, and tree-shakeable. When the feature
   reaches all engines the prop is removed and the behaviour becomes default; the removal is a type
   error that tells every consumer exactly where to delete it.

2. **Whole component that cannot exist without a flagged feature: the `@funstack/ui/experimental`
   subpath**, same namespace shape, documented as unstable. Nothing in the initial four needs this
   (each has a non-flagged baseline per the research docs).

3. **No provider / global config in v0.** A global switch hides a per-site browser decision in a
   place far from the markup, and Server Components cannot create context anyway.

When the flagged path is a strict superset of the baseline (Chromium's `interestfor` tooltip
versus the JS fallback), the component may feature-detect at runtime *only when the flag is on*;
with the flag off it runs the baseline everywhere. Flags never change markup between server and
client renders.

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
against controlled and uncontrolled mode via `describe.each`.

| Area | What the test proves |
| --- | --- |
| Roles and ARIA | Default elements, roles, `aria-*` wiring between parts, ids resolve. |
| Keyboard | Every APG interaction for the pattern (arrows, Home/End, Space/Enter, Escape as applicable). |
| Sync action (both) | Action receives `(next, details)`; `details.event` is the native event; disabled parts never dispatch; no-op interactions never dispatch. |
| Async action (both) | While the promise is unresolved: `data-pending` on owner and trigger, optimistic state on the trigger, committed state unchanged on content. After resolve: `data-pending` gone, content updated. |
| Rejection (both) | Rejected action reaches an Error Boundary around the component; optimistic state reverts; uncontrolled committed state unchanged. Caught-inside variant: resolves, commits. |
| Overlap | Two actions in flight, resolved out of order: optimistic shows the latest, final committed state is the latest dispatched (uncontrolled). |
| Suspending content (both) | Content keyed on the new value suspends: old content stays, no fallback shown by a boundary above the component, `data-pending` on; after resolve, new content. |
| Function props | `className`, `style`, `children`, `render` receive the documented state and the attributes agree with it. |
| `render` element | Element form replaces the default element, merges `className`/`style`, keeps the library's handler working, forwards `ref`. |
| Post-await rule | A controlled parent updating after its own `await` inside `startTransition` works end to end (guards the documented pattern). |
| Directive | The built file for each client part begins with `"use client"`; each JS-free part's file does not (script over `dist`, run in `test:run` after `build`). |

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

## Open questions for the product owner

1. **Action naming: `<state>ChangeAction` (chosen) vs. a bare `changeAction` for the primary
   state.** `changeAction` reads shorter at the call site (`<Toggle changeAction>`), and the vision
   lists it as an example, but it breaks the mechanical `x` / `defaultX` / `xChangeAction` triple
   the moment a component has two states (Combobox: value and open). I recommend keeping the
   triple; please confirm.
2. **Urgent opt-out placeholder.** v0 provides nothing and leaves native pass-through/`ref` as an
   unsupported path. Alternative: strip *all* `on*` props from part types so the only escape is
   `ref`. The stricter option is a cleaner story but makes harmless things (`onPointerEnter` for
   analytics) awkward. Decide which message the first release should send.
3. **Swallowed errors count as success in uncontrolled mode** (section 2.4). Accepting this keeps
   the action contract simple ("resolve = done"). The alternative is a `details.cancel()` or a
   `false` return value to veto; I recommend deferring until a real case appears.
4. **Root entry plus subpaths** (chosen) vs. subpaths only like Base UI. The root entry costs
   nothing with an unbundled build but gives bundlers without good tree-shaking a bigger graph.
5. **`experimental_` prop prefix** vs. a `experimental={{ interestFor: true }}` object prop per
   part. The prefix is uglier but each flag is independently typed and documented.
6. **Transition entanglement guidance** (section 2.3 item 5). The finding that any pending async
   action holds all transitions app-wide is React behaviour, not ours, but it affects what we tell
   consumers to `await`. Worth raising with the React researcher so `react-async-apis.md` records
   it, and worth a note in the FUNSTACK Router docs if the user agrees.
7. **Dropping hover/focus data attributes** (section 4.2) is a deliberate divergence from React
   Aria and Headless UI. Confirm that CSS pseudo-classes are an acceptable answer for the target
   audience.
