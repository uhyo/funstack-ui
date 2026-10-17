# @funstack/ui API conventions

Status: **accepted** (2026-10-15, GitHub issue #5; open questions resolved by the product owner
with the user, see the end of this document; amended 2026-10-15 after the Toggle design, #6, with
the ViewTransition correction in 5.1, the pending-is-never-disabled rule in 3.6, and the Server
Function note in 2.4; amended 2026-10-17 after the CheckboxGroup design, #33, see resolved
question 20). Binding for every component design in
`design/components/`. `docs/vision.md` wins over this document; this document wins
over any individual component design.

Inputs: `docs/vision.md`, `docs/research/react-async-apis.md`, `docs/research/popover-anchor-tooltip.md`,
`docs/research/modern-platform-survey.md`, `docs/research/form-controls.md` (wave 2), prior art (Base UI, React Aria Components, Radix,
Ark UI, Headless UI), and a handful of React 19.3.1 behaviour probes recorded in
`memo/architect/conventions-notes.md`.

## Decisions

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Composition | Compound parts under a namespace (`Tabs.Root`, `Tabs.Tab`); single-element components are plain (`Toggle`). Element polymorphism via a `render` prop (element or `(props, state) => node`), never `asChild` or `as`. `ref` is a normal prop. `className`, `style`, `children` accept a value or a function of the part's state. |
| 2 | Action props | `<state>ChangeAction` for state changes (`pressedChangeAction`, `valueChangeAction`), bare `action` for pure triggers. Signature `(next, details)`; sync or async; the library `await`s it inside the state owner's `useTransition`. Errors go to the nearest Error Boundary. No `on*` handlers in the library API. |
| 3 | State model | `x` / `defaultX` / `xChangeAction`. The state owner holds committed state, optimistic state (`useOptimistic`, reducer form) and the transition. **Trigger parts render optimistic state; content regions render committed state.** Uncontrolled state is committed after the action resolves; the latest dispatched action wins. "Transition by default" applies to library-owned state; browser-owned state (top layer, `<details open>`) is observed, not driven. |
| 4 | Exposure | One vocabulary in three forms: `data-pending` / `state.pending` / docs. Booleans by attribute presence. Hover/focus/active come from CSS pseudo-classes, not attributes. |
| 5 | ViewTransition | An animatable part renders `<ViewTransition default={transition}>` as its outermost node **only when `transition` is given**; with the prop absent it renders no boundary, because react-dom starts a document view transition for any boundary that mounts or is revealed in a transition commit, whatever `"none"` says (#35). `transition` forwards React's own `default` shape and is static. Library adds `fsui-<component>[-<change>]` transition types. Reduced motion handled in CSS. |
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
| `Label` | Names the owner. For `<fieldset>`-based groups (RadioGroup, CheckboxGroup) it renders `<legend>` and must be the Root's first child. | `label` / `legend` |
| `Parent` | A mixed-state checkbox that controls a subset of a CheckboxGroup (`values`): its checked/mixed state is derived from the group's optimistic set and its click dispatches for the whole subset. Never submitted (no `name`). | `input[type=checkbox]` |
| `Form` | A form whose successful submission completes the component's interaction (Dialog). | `form` |
| `Header`, `Group`, `Separator`, `Arrow` | Structural or decorative. | as named |

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
- A part whose default element is a **native input** (`Checkbox`, `Switch`, `RadioGroup.Item`)
  must stay an `<input>` of the same `type`, and a group Root that is a `<fieldset>`
  (`RadioGroup.Root`) must stay a `<fieldset>` (legend naming, `disabled` inheritance and
  `.form` depend on it): `render` may substitute a styled element or a wrapper component that
  renders one, never a `<button>` or `<div>`. The shared hook warns in development when the
  mounted node has the wrong tag or `type`. The input is a void element, so it
  has no children; visual indicators are **sibling parts** (`Indicator`) that receive the same
  state attributes. Replacing the element would lose form participation, validation, reset, label
  activation, native radio keyboard handling and RTL mirroring (`docs/research/form-controls.md`).
- `className`: the library's and the element's are concatenated. `style`: merged, element wins.
- Event handlers the library installs (for example `onClick` on a `Tab`): both run, the element's
  first, then the library's. v0 provides no way to cancel the library's handler from there.
- Element-type-specific attributes are set only when they apply to the rendered element:
  `type="button"` is emitted for a `<button>` and omitted for `render={<a href />}` or any other
  element, rather than landing as a meaningless attribute on an anchor.
- Library-controlled attributes (`role`, `aria-*` *state* the part computes such as
  `aria-pressed` / `aria-selected`, `id` wiring, `data-*` state) win over the element's, with one
  carve-out: ARIA id-reference lists (`aria-labelledby`, `aria-describedby`, `aria-controls`,
  `aria-owns`) are **merged as token lists**, the element's tokens first, so a trigger can be
  described by more than its tooltip. **Everything else, the element wins**, including `aria-*`
  and `data-*` props that merely pass through the part from its own props: a `render` element's
  `aria-label` beats `<Tabs.Tab aria-label>`; only attributes the part itself computes are
  library-controlled. Merge order is therefore: part pass-through props, then the `render`
  element's props, then library-controlled attributes on top.
- **Library-controlled keys are owned, not merely preferred** (product-owner decision): a key the
  part computes always wins *even when its computed value is `undefined`*, in which case the
  attribute is removed rather than falling back to the element's value. A `render` element can
  therefore never re-introduce `name`, `data-open`, `aria-disabled`, `aria-pressed` and the like.
  **`disabled` is owned by every part that takes a `disabled` prop**: a `render` element cannot
  re-enable a part the consumer disabled (nor disable one the library computed as enabled), so
  the prop, the native attribute, `data-disabled` and the no-dispatch rule always agree.
  Rationale: a second writer for a state attribute would leave stale ARIA that keyboard and AT
  navigation read (an `aria-disabled="true"` from the element outliving the library's
  `undefined`), and `name` on `<details>` would silently change exclusive-group membership.
  The part's documentation lists its owned keys.

Rejected alternatives:

- `asChild` (Radix, Ark): relies on `cloneElement`, hides the prop merge, and the "single child"
  constraint fights `children`-as-function. `render` is explicit about which props land where.
- `as` (Headless UI): cannot carry props for the substituted element and makes the prop type a
  generic that every consumer pays for in inference time.

### 1.3 `className`, `style`, `children` as functions of state

Each part has a `State` object (section 4). `className`, `style` and `children` accept either a
plain value or a function of that state. A part that renders a **void element** (`<input>`) has
no `children` prop at all: it is omitted from the props type rather than accepted and ignored.

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

/** Why a change action was dispatched; the full vocabulary (section 2.2, "reason" table). */
export type ChangeReason = "activate" | "platform" | "dismiss";
```

`ChangeReason` is **one public type**, exported from the root entry; every
`<Component><State>ChangeDetails` that exposes `reason` declares it as `readonly reason:
ChangeReason` rather than a local union, so the vocabulary cannot drift per component.

`details` is the native DOM event (not React's synthetic one) plus component-specific fields,
typed per component as `<Component><State>ChangeDetails` (for example `TabsValueChangeDetails`
adds `reason`).

**`details.reason` vocabulary is library-wide** (product-owner decision): a component that
exposes `reason` uses exactly these values and no synonyms:

| `reason` | Meaning | `details.event` |
| --- | --- | --- |
| `"activate"` | The user acted on a trigger part: click, Enter/Space, or focus in an automatic-activation mode. | The native `MouseEvent`, `KeyboardEvent` or `FocusEvent` (`type` is `"focusin"` for React's `onFocus`). For native checkbox and radio inputs it is always the `click` `PointerEvent`, including Space and radio arrow keys, because React's `onChange` for them is click-driven. |
| `"platform"` | The browser changed the state: find-in-page or a text fragment (`beforematch`, `<details>` `toggle`), form reset, or interaction before hydration reconciled at mount. Never a user gesture. | The platform event, or `undefined` for mount reconciliation. |
| `"dismiss"` | The user closed the component **without acting on one of its parts**: Escape, Android back, an assistive-technology dismiss gesture, light dismiss (outside click). A close through a part (`Dialog.Close`, a Form submit) is `"activate"`. | The platform's `close` or `toggle` event. |

Components whose close carries a platform result add it as a serialisable field next to
`reason`: Dialog's `details.returnValue` is `dialog.returnValue` (the `value` of the Close button
or form submitter, or the string passed to `requestClose()`), `undefined` on open.

Components with a **set-valued state** describe what changed as a diff, `added: readonly
string[]` and `removed: readonly string[]` (CheckboxGroup), so that one shape covers a single
item, a multi-item trigger and a platform path, and a controlled "update on success" parent can
apply it as a functional update instead of writing the whole set (section 2.5). Accordion's
earlier `item` / `open` pair stays as is; a new set-valued component uses the diff form.

Adding a value is a change to this document, not to one component (`"dismiss"` was added
2026-10-16 for Dialog; Popover and Menu reuse it). The first argument is always the next value, so the
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

Costs, documented wherever `details` is: devtools shows `Proxy(Object) { reason: "activate" }`
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
   works there, and any `setState` in the prefix is a Transition update. It is **not a veto**: the
   action still runs and still commits. On a checkable native input (`Checkbox`, `Switch`,
   `RadioGroup.Item`) it is **unsupported**: cancelling the `click` makes the browser restore the
   DOM `checked` *after* React has restored it to the optimistic value, and suppresses `input` and
   `change`, so the DOM shows the old value while `optimistic` and `data-checked` say the new one
   for as long as the action is pending (`docs/research/form-controls.md` §2). The library logs a
   dev warning when `details.event.defaultPrevented` is true after the sync prefix; the same check
   catches a `preventDefault()` in a pass-through `onClick`, which runs before the library's
   `onChange` for the same click. The complementary rule: a click that is **already cancelled**
   when the library's handler runs is not a change and does not dispatch, because the browser
   reverts the DOM after dispatch and React restores unchanged props. A part that itself cancels
   the event as part of its mechanism (Dialog's Trigger `preventDefault()`s the click to cancel the
   `command`) keys the warning on its own flag, not on `defaultPrevented`. Vetoing is done with
   controlled mode: the parent simply does not adopt the change (section 2.4).
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
6. **An action must never await user input.** Every transition started while an async action is
   pending is entangled with it (item 5), including the one that would show the user the thing
   they must respond to. An action that opens a confirmation dialog in a transition and awaits
   the user's answer therefore deadlocks: the confirmation never commits, so the answer never
   comes, so the action never resolves. Rule: user input arrives through its own dispatch, not
   through a promise an action awaits. The confirm-before-close shape is "the Close part's
   action opens the confirmation (sync prefix, or urgently outside the action scope) and
   returns; the confirmation's own Close action does the work" (`design/components/dialog.md`
   12.5). The same applies to any "ask then continue" flow: split it into two actions.
7. **Disabled parts never dispatch for user interaction.** A disabled Tab does not call
   `valueChangeAction`. Platform dispatches that the *form owner* causes are not blocked by
   `disabled`: `form.reset()` resets a `<fieldset disabled>` group too, and the group follows it
   with `reason: "platform"` (section 3.8), because the form's author acted on the whole form,
   not the user on one disabled control. Accordion's find-in-page rule (a disabled item re-closes
   without dispatching) stays: there the browser acted on one user-targeted item.
8. **No-op interactions do not dispatch** unless the component says otherwise. "No-op" is judged
   against the **optimistic** value, not the committed one: clicking the Tab that is already
   optimistically selected calls nothing, but clicking back to the committed tab while another is
   pending is a real dispatch that replaces the in-flight intent (section 2.5).
9. **Parts are never disabled while pending.** See section 3.6.

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

- The latest dispatch's rejection propagates through React's own path (nothing is caught). It
  reaches the boundary only **after every older overlapping dispatch has settled**: React holds
  the boundary's commit while the entangled action lane is still pending (section 2.3 item 5).
  React behaviour, documented so a test that rejects the newest of two dispatches does not expect
  the fallback before the older one resolves.
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
- **Controlled parents are not guarded.** The latest-intent guard protects uncontrolled state
  only. A controlled "update on success" parent that writes the *whole value*
  (`startTransition(() => setChecked(next))` after its `await`) lands writes in completion order,
  so under overlap with differing completion order the slower, older intent wins; this is the
  same class of problem as Accordion's multiple mode (`design/components/accordion.md` 2.2).
  Recommended: functional updates keyed by what changed, or a sequence check in the parent, or
  uncontrolled mode. Component docs show the pattern next to every "update on success" example.
- **No queueing in the library.** Components that need ordered, result-threaded actions (forms,
  counters) use `useActionState` internally and document that. None of the initial four do.
- Consumers who need abort semantics implement them in the action (`AbortController` captured in
  a ref); the library passes no signal in v0.
- **Overlap never includes user input.** An action that awaits a promise another user action is
  supposed to resolve cannot overlap with it: the second action's transition is held by the
  first (section 2.3 item 6). Design flows as independent dispatches.

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

### 2.7 Form-level actions are a separate channel

`<form action>`, `useFormStatus` and React's automatic form reset are React's form channel. A
control's `<state>ChangeAction` is per-control and runs in the control's own transition. The two
are independent and the library does not couple them:

- A control inside `<form action={serverFn}>` with no change action is an uncontrolled native
  input that posts `name=value` with the form; `useFormStatus().pending` covers the submit.
- A control **must not** fold `useFormStatus` into its own `pending`: that would mark every
  control in the form pending during a submit. A consumer who wants that reads `useFormStatus`
  in their own `className` function or styles `form:has(...)`.
- A part may **observe** the form channel to perform a platform side effect after a successful
  action (`Dialog.Form` closes the dialog once the action's transition settles); it never wraps
  the action (so a Server Function keeps progressive enhancement) and never reports form pending
  as its own `pending`.
- "Autosave on change" is `checkedChangeAction={saveSetting}` (a Server Function may be passed
  directly, section 2.2); "submit on change" is
  `checkedChangeAction={() => formRef.current?.requestSubmit()}`.
- Entanglement (item 5 above) applies across the channels: while a form action is pending a
  control's transition is entangled with it, and the reverse.
- React's reset after a successful form action is a residual browser path for controlled native
  inputs (section 3.5).

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

`defaultX` is read once for the initial value. **Native form controls additionally use the latest
`defaultX` as the form-reset target** in uncontrolled mode (the library mirrors it into
`el.defaultChecked` after every commit, which is React's own rule for a plain uncontrolled
input); in controlled mode the reset target is React's mount-time value (section 3.8).

A component whose UI cannot deselect may still receive `null` from a **platform path**: a form
reset can empty a radio group, so `RadioGroup`'s `valueChangeAction` is typed `string | null`
and receives `null` only with `reason: "platform"`. Tabs keeps `string` because it has no
platform path that empties it.

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

For **controlled native inputs** (`<input type="checkbox">` in Checkbox and Switch,
`<input type="radio">` in RadioGroup) rendering optimistic state on the trigger is a correctness
requirement, not a visual nicety. At the end of every event react-dom restores a controlled
input's DOM `checked` to its current prop after flushing sync work; only the SyncLane optimistic
update is flushed before that restore. `checked={optimistic}` (radios:
`checked={optimistic === item.value}`) therefore keeps the DOM, the attributes and the
accessibility tree in sync, and a rejection rolls the DOM back when optimistic reverts. A native
input driven by transition-lane state alone snaps back on click and stays stale until the action
settles (verified in jsdom, Chromium and Firefox; `docs/research/form-controls.md` §2).

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
  const [supersededError, setSupersededError] = useState<unknown>(undefined);
  // Throw BEFORE useTransition(): when a render throws, React retries with all pending lanes,
  // and in that retry useTransition would unwrap the still-pending newer action's thenable and
  // suspend, holding the boundary's fallback commit until that action settles (verified by the
  // developer). Throwing first lets the boundary commit immediately.
  if (supersededError !== undefined) throw supersededError; // reaches the same boundary
  const [pending, startOwnTransition] = useTransition();
  const latest = useRef(0);

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

`transitionTypes` receives `details` so a component can take the dispatch's origin into account.
Note that `details.event.currentTarget` is **not** the dispatching element (for a native event it
is React's root container by the time the action runs); Tabs derives `fsui-tabs-next` /
`fsui-tabs-prev` by looking the committed and target tabs up **by id** under the root and
comparing their DOM order. `prev` is the committed value at dispatch time, not the optimistic
one.

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
| Residual browser path | A library-owned state the browser can also change is reconciled by dispatching the change with `details.reason: "platform"` and `event` set to the platform event (or `undefined` at mount), then re-applying committed state to the DOM after the action settles. Known paths: find-in-page revealing `<details>` or `hidden="until-found"`; **mount reconciliation** for pre-hydration clicks on `<summary>` or a native input, and for Firefox's form-state restoration of `checked` across reloads (react-dom keeps the DOM value when hydrating and fires no `onChange`), one dispatch per component or group; **form reset**, both an external `form.reset()` and React's automatic reset after a successful `<form action>` (`requestFormReset`), which restores controlled inputs to their mount-time default without telling React. Each native-input component listens to `reset` on `input.form` through its ref and, in a microtask after the reset, dispatches the new DOM value with `reason: "platform"` and `event` set to the `reset` event | n/a |

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
- Dispatches on the residual browser path use `details.reason: "platform"` (section 2.2); user
  dispatches use `"activate"`.
- A fourth kind of state, **consumer-owned, mirrored**: a controlled-only prop that the library
  writes to a DOM property it does not own (`Checkbox`'s `indeterminate`, a future Progress
  `value` or Dialog `returnValue`). It has no `defaultX` and no action; the library re-applies it
  after every commit and may suspend it while an action is pending (section 4.1).
- A state may be **library-owned in one direction and browser-owned in the other** (Dialog's
  `open`: opening is a transition the library drives and awaits; closing is performed by the
  browser and reaches the library as a notification with `reason: "dismiss"` or `"activate"`
  and `details.returnValue`). The component doc says which, and the `xChangeAction` doc comment
  says so per value.

### 3.6 `disabled`

`disabled` is a boolean prop on the owner and on individual triggers. Native `disabled` is used
where the APG pattern allows it; where the pattern wants a focusable disabled control (Tabs), the
part sets `aria-disabled` instead. In both cases the part emits `data-disabled` and never
dispatches for user interaction (platform dispatches from the form owner are the exception,
section 2.3 item 7).

**A part is never disabled while pending** (product-owner decision, library-wide). The library
does not set `disabled`, `aria-disabled` or `inert` on a trigger because its action is in flight:
native `disabled` drops keyboard focus, and the latest-intent rule (section 2.5) already makes
repeated activation safe. Consumers who want to block re-activation do it with CSS
(`[data-pending] { pointer-events: none }`) or announce it with `aria-busy` through pass-through;
the library emits `data-pending` and nothing else.

**Computed native validity attributes.** A part may render a native constraint attribute from
library state when the platform has no constraint for the component's semantic: CheckboxGroup
renders `required` on every Item only while the group's **optimistic** set is empty ("at least
one"), so validation, `:user-invalid` and the localised browser message stay native. Such an
attribute is owned by the part, follows optimistic state (it appears during a pending uncheck of
the last box and leaves on rollback), and is static before hydration (the server-rendered value),
which the component doc records as its pre-hydration behaviour. It is never written through the
DOM (`setCustomValidity`) in v0.

### 3.7 `keepMounted` on content regions

Content regions whose visibility is driven by library state (`Tabs.Panel` today) share one prop
shape:

```ts
keepMounted?: boolean | "until-found";
```

| Value | Hidden panel is | Notes |
| --- | --- | --- |
| `false` (default) | not rendered | Matches ecosystem expectations; no hidden `<video>` surprises. |
| `true` | rendered inside `<Activity mode="hidden">` | DOM and state preserved, effects torn down, pre-rendered at low priority. The mode change happens inside the library's transition so nested `<ViewTransition>` boundaries get enter/exit. |
| `"until-found"` | rendered with `hidden="until-found"` | Find-in-page and text fragments reveal it; the `beforematch` event dispatches the matching change action. Uses the ref-based upgrade from section 7.4 because react-dom serialises `hidden` as a boolean. Incompatible with `<Activity>` on the same element, hence a separate value rather than a second boolean. |

Tabs defines the semantics. Accordion has no `keepMounted`: its Panel is always mounted because
`<details>` keeps its content in the DOM and reveals it on find-in-page natively
(`design/components/accordion.md` 4.4). Future content regions that hide content via library
state reuse the prop, narrowing the type where a value has no meaning: Dialog accepts `boolean`
only, because `"until-found"` cannot apply inside a closed `display: none` dialog.

### 3.8 Native checkable inputs: the shared machinery

Switch, Checkbox and RadioGroup render controlled native inputs. Beyond `useControllableAction`
they share three internal hooks, so that one dispatch model covers single controls and groups.
This is the one contract both designs implement (reconciled 2026-10-16 from
`design/components/switch.md` §7 and `design/components/radio-group.md` Cross-component item 2).

| Hook | Called by | Does |
| --- | --- | --- |
| `useFormReset(ref, onReset)` (`internal/use-form-reset.ts`) | the other two | **Stable** `reset` subscription on the form owner (`ref.current.form`; the element may be an `<input>` or a `<fieldset>`, both form-associated and honouring `form=`). Re-reads the owner after every commit but re-subscribes only when it changed; the handler body is a `useEffectEvent`. On `reset` it queues a microtask and, unless `event.defaultPrevented`, calls `onReset(event)`. |
| `useNativeChecked(options)` (`internal/use-native-checked.ts`) | every `<input type="checkbox" \| "radio">` part: Switch, Checkbox, `RadioGroup.Item` | Per element: the ref callback with the dev tag/`type` check; a layout effect after **every** commit that re-applies, in this order, `defaultChecked` (if given), then `checked` (optimistic), then `indeterminate` (if given). The order matters in exactly one case: react-dom's `updateInput` writes `el.checked` on every update of the input (setting the dirty-checkedness flag), and React's automatic form reset runs in the form's mutation effects, after the inputs' updates and before layout effects; after that reset the dirty flag is clear, so writing `defaultChecked` (the `checked` content attribute) would move `checked` too, and writing `checked` afterwards settles it. `indeterminate` is independent of both; and, **unless `group: true`**, the two residual paths for a single control: mount reconciliation and `useFormReset`, both reporting `onPlatformChange(next: boolean, event)`. With `group: true` it reports nothing; the group adapter does. |
| `useNativeGroupReconciliation<T>({ element, readCurrent, readDefault, base, onPlatformChange })` (`internal/use-native-group-reconciliation.ts`) | a group Root (`RadioGroup.Root`, future `CheckboxGroup.Root`) with `element` = its `<fieldset>` ref | Mount reconciliation once (`readCurrent()` vs `base()`) and `useFormReset` on the fieldset (`readDefault()` vs `base()`), each producing **one dispatch per group** through `onPlatformChange(next: T, event)`. Returns a stable `{ onItemMounted }`, which the Root passes down through context and `group: true` items call from their mount layout effect (`useNativeChecked` takes `onItemMounted` and `component` options). The adapter **ignores calls made before its own mount reconciliation has run** (members rendered in the Root's commit run their effects first, so they are covered by that reconciliation; the flag is reset in the effect cleanup so StrictMode's re-run behaves the same); any later call queues **one microtask per commit** that compares `readCurrent()` with `base()` and dispatches `"platform"` with `event: undefined`. Comparison is `equals` (option, default `Object.is`); a group with a set value (`CheckboxGroup.Root`) passes set equality, because two sets are never `Object.is`-equal. |

Rules the three hooks implement, which component docs may cite instead of restating:

1. **Base comparison.** A residual path dispatches only when the DOM value differs from what the
   user already intends: the latest in-flight dispatch's `next` if there is one, else the
   optimistic value (`latestInFlight` comes from `useControllableAction`). Spell it with an
   explicit null check on the *dispatch*, never with `??` on `next`:
   `const f = latestInFlight(); const base = f === null ? optimistic : f.next;`. For a nullable
   `T` (RadioGroup's `string | null`) `latestInFlight()?.next ?? optimistic` silently drops an
   in-flight dispatch *to* `null` (a pending reset to "nothing checked") and would re-dispatch
   against the stale optimistic value. Reading the DOM alone would lose a pending optimistic
   change. The comparison also makes the StrictMode double layout effect dispatch once.
2. **One dispatch per state owner.** A single control dispatches for itself; a group's Root
   dispatches once for the whole group, never once per radio.
3. **Mount reconciliation** runs in a layout effect at mount, before the re-apply effect, and
   dispatches with `reason: "platform"` and `event: undefined`. It covers clicks before hydration
   and Firefox's form-state restoration (react-dom keeps the DOM `checked` when hydrating, fires no
   `onChange` and logs no mismatch, so no `suppressHydrationWarning` is needed). **Ordering in a
   group:** React runs children's layout effects before the parent's, so an Item's re-apply
   effect would overwrite the hydrated DOM `checked` before the Root's `readCurrent()` sees it.
   `useNativeChecked` therefore does **not** re-apply `checked` in the mount commit, including
   StrictMode's re-run of the mount effects (detected with a per-render token rather than a
   `useRef` flag, which StrictMode would reuse); from the second commit on it re-applies after
   every commit. A single control is unaffected (its own mount reconciliation reads the DOM
   first), but the rule is uniform so the hook has one behaviour. **Late-mounting items**
   (product-owner decision): an item that mounts after the Root reconciled, for example inside a
   Suspense boundary that hydrates after the Root, is not covered by the Root's mount effect; its
   `useNativeChecked({ group: true, onItemMounted })` calls the adapter's `onItemMounted()` (from
   context) in its mount layout effect. Calls that arrive before the adapter's own mount
   reconciliation are ignored (those items are in the Root's commit and covered); later calls
   queue one microtask per commit that compares `readCurrent()` with `base()` and dispatches
   `"platform"` with `event: undefined` only when the late item's DOM value differs from what the
   user intends. A programmatic value change while members are still dehydrated is not a problem
   (a transition update is held until hydration, an urgent one client-renders the boundary; no
   dispatch either way, reviewer-verified). **Unsupported: partial hydration of a native radio
   group** (radios only). Clicking a hydrated radio while same-`name` siblings are inside a
   still-dehydrated Suspense boundary makes react-dom throw "Mixing React and non-React radio
   inputs with the same `name` is not supported" from its radio restore. This is a React
   limitation; RadioGroup emits a dev warning on the late-mount path, documents "keep all Items
   in the Root's Suspense boundary", and issue #34 tracks a human upstream report. The same-`name`
   walk in `restoreControlledInputState` is guarded by `type === "radio"`, so a **checkbox
   group** is not affected: CheckboxGroup supports late-mounting Items and Parents through the
   same `onItemMounted` path and emits no warning.
4. **The reset subscription must be stable.** React's automatic reset after a successful
   `<form action>` runs in the commit's mutation phase, between the previous effect cleanup and
   the next subscription, so a listener attached in a deps-less effect never sees it (verified,
   `memo/architect/switch-checkbox-notes.md`).
5. **Reset reads `defaultChecked`, not `checked`.** The `reset` event precedes the reset
   algorithm, so the hook waits a microtask; by then, for React's own reset, the re-apply effect
   has already put the optimistic value back into `checked`. `el.defaultChecked` is the value the
   browser reset to in every case. A group's `readDefault()` therefore returns the value of the
   radio whose `defaultChecked` is true, or `null`.
6. **Reset target by mode.** Uncontrolled: the latest `defaultX` prop, mirrored into
   `el.defaultChecked` by the re-apply effect (a group Root passes `defaultValue` down so each
   item mirrors `defaultValue === value`). Controlled: React's mount-time value; the reset is
   **offered to the parent** as a `"platform"` dispatch with `event.type === "reset"`
   (product-owner decision), and after settle the DOM follows the parent's decision.
7. **A cancelled `reset`** (`event.defaultPrevented` in the microtask) dispatches nothing.
8. **Re-apply after every commit** is belt-and-braces for `checked` (react-dom's `updateInput`
   rewrites it on every commit of the input) and load-bearing for `indeterminate` and
   `defaultChecked`, which React does not manage on a controlled input. It also ends the
   `preventDefault()` desync at the next commit.
9. **Click guard**, shared by every part's `onChange`
   (`guardCheckableChange(event, dispatch, componentName?)` in `use-native-checked.ts`): if
   `event.defaultPrevented` is already true, return without dispatching **and without warning**
   (section 2.3 item 3: an already-cancelled click is not a change); otherwise dispatch, then in
   development warn once per element, naming `componentName`, if the event is now
   `defaultPrevented`.

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
| `open` | boolean | Popup, Trigger, Accordion `Item` and `Trigger` (the Accordion `Panel` emits only `data-disabled`; its visibility is the native `<details open>` / `:open`); Dialog `Trigger` (optimistic, library mode) while the `<dialog>` itself emits none because `:open` / `:modal` are exact and written by the same commit | Disclosure and open state, following the platform's word (`<details open>`, `:open`, `ToggleEvent.newState`); `expanded` is not used. Emitted for library-owned open state; purely browser-owned open state (Tooltip in the top layer) is styled with `:popover-open` / `:open` and emits no attribute (section 7.4). |
| `checked` | boolean | Checkbox, Switch, `RadioGroup.Item` (radio items use `checked`, the platform word, not `selected`), sibling `Indicator` parts | Optimistic checked state. On the input itself the DOM holds the optimistic value (section 3.2), so `:checked` matches it, with the caveats in section 4.2 (`preventDefault()` misuse; Chromium's checked+indeterminate quirk). |
| `indeterminate` | boolean | Checkbox (controlled-only prop, "consumer-owned, mirrored" in section 3.5's terms; never Switch) | Mixed state. Emitted from render as `data-indeterminate` because the DOM property cannot be server-rendered and `aria-checked` is forbidden on native inputs: the attribute is what lets CSS draw the dash before hydration. The property is set through the ref and re-applied after every commit; it is **suspended while an action is pending** (`state.indeterminate = indeterminate && !pending`, product-owner decision) so the attribute, the DOM property and `:indeterminate` agree in every phase, since the browser clears it on the click and the parent may not have recomputed yet. `CheckboxGroup.Parent` also emits it, but there the value is **library-derived** from the group's optimistic set (`some && !all` over the Parent's `values`) in the same sync render that follows a click, so it is **not** suspended while pending; the suspension rule is specific to the consumer-owned prop. |
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

For native inputs the equivalence is exact, because the DOM holds the optimistic state:

| On the input | Data attribute | Note |
| --- | --- | --- |
| `:checked` | `data-checked` | Identical except under the unsupported `preventDefault()` misuse (2.3) and in one engine quirk: Chromium 156 does **not** match `:checked` on a checkbox that is both checked and indeterminate (Firefox does). Where `indeterminate` is in play, select on `[data-checked]`. |
| `:indeterminate` | `data-indeterminate` | Only the attribute works before hydration; `:indeterminate` also matches every radio in a group with no selection. |
| `:disabled` | `data-disabled` | Only the pseudo-class sees `<fieldset disabled>` inheritance. |
| `:user-invalid`, `:required` | none | Platform only; no attribute. |

The data attributes are still emitted, because sibling or wrapper parts (an `Indicator`, a label
Root) cannot use `:checked` on themselves; `:has(:checked)` on a wrapper is the zero-JS
alternative.

### 4.3 Where `data-pending` lands

- The **owner** (`Root`, or the single component): while its transition is pending. When the
  owner renders no element (Dialog's Root), `pending` is exposed through its `children` function
  and on the trigger part only.
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

Every part whose mount, unmount or content is driven by library state (Panel, library-driven
Popup, Toggle's own element when its children can change) renders
`<ViewTransition default={transition}>` as the **outermost node of its output**, before any DOM
element, **only when `transition !== undefined`**. With the prop absent the part renders no
boundary at all (decision for issue #35, `docs/research/view-transition-mount-cost.md`).

Why: react-dom 19.3.1 starts a document view transition whenever a `<ViewTransition>` **mounts**
in a transition-lane commit or is **revealed by `<Activity>`**, regardless of what `default`,
`enter`, or a type map resolves to (`trackEnterViewTransitions` checks only the fiber tag; the
`"none"` check runs inside the already-started transition and decides only whether a name is
assigned). The browser then plays its UA root cross-fade (`::view-transition-old(root)`, 250 ms)
and React holds every later transition-lane commit until it finishes: measured 265 to 280 ms of
added latency per tab switch or dialog open, in Chromium and Firefox. Exits and updates of a
`"none"` boundary are free; a boundary that mounts under a *new* DOM element is shielded. So the
only free "no animation" is no boundary.

Rules:

- `transition` is **static**: the part reads it as a render-time switch, and toggling it between
  `undefined` and a value changes the element type at the root of the part, so React remounts
  the part's subtree (DOM and state lost). Development warns once when that happens.
- An explicit `transition="none"` **keeps the boundary**, so a consumer who switches between
  `"none"` and a class at runtime does so without a remount, and accepts the mount cost.
- Server rendering is unaffected: the decision is a pure function of props on both sides.
- Any `transition` value, including a type map whose types do not match the commit, makes
  **mounts and reveals** of that part run the page cross-fade (rollbacks and snap-backs that carry
  no `fsui-*` types included). The consumer docs for `transition` say so and show the opt-in
  page-policy CSS, which is the consumer's choice, never shipped by the library:

  ```css
  /* No page-wide cross-fade for any view transition on this page. */
  ::view-transition-old(root), ::view-transition-new(root) { animation: none; }
  /* or */ :root { view-transition-name: none; }
  /* Keep clicks working during the transition in Firefox (hit testing is suppressed otherwise). */
  ::view-transition { pointer-events: none; }
  ```

Parts whose visibility is **browser-owned** (section 3.5: Tooltip's `Popup` in the top layer, the
Accordion's `<details>` in static mode) render no `<ViewTransition>` in any case and have **no
`transition` prop** (Accordion's static mode ignores it with a dev warning); their open/close
happens outside any React transition and animates with `@starting-style` and
`transition-behavior: allow-discrete` in CSS. "Every animatable part has `transition`" means every
part whose mount, unmount or content is driven by library state.

```tsx
// inside Tabs.Panel (mount strategy per `keepMounted`, section 3.7: not rendered, <Activity>,
// or hidden="until-found"; when present, the boundary is the outermost node in every strategy)
const panel = <div role="tabpanel" ...>{children}</div>;
return transition === undefined ? panel : <ViewTransition default={transition}>{panel}</ViewTransition>;
```

Because library state changes are transitions, the commit that ends the action and any rollback
animate through this boundary with no extra code. **The optimistic commit does not animate**: it
is a sync-lane render, and react-dom starts a view transition only when every committed lane is a
transition, retry or idle lane (verified on 19.3.1; see `design/components/toggle.md` section 7.2).
What this means per kind of part:

| Part renders | Animate with | Why |
| --- | --- | --- |
| Optimistic state (Toggle's element, `Tabs.Tab`, `Accordion.Trigger`, `Tabs.Indicator`) | CSS `transition` on the data attribute or on the anchored insets (`[data-pressed]`, `[data-selected]`, `position-anchor` following the optimistic tab) | The flip lands in a sync-lane commit; `<ViewTransition>` never fires for it, on click or on rollback. |
| Committed state (`Tabs.Panel`, `Accordion.Panel`, `Popup` content driven by library state) | `transition` prop (`<ViewTransition>`, rendered only because the prop is set) | The swap lands in the transition-lane commit that settles the action. Mount-prone parts (a Panel with `keepMounted={false}` or `true`) pay the page cross-fade on every mount or reveal once `transition` is set; with `"until-found"` only updates happen. A boundary that mounts *under a new DOM element* is shielded: Dialog's children mount under the `<dialog>` element on a plain open, so a plain open starts no view transition even with `transition` set; only a nested Popup mounting together with outer content, or a Root inserted by a transition, pays. |
| `pending` leaving, a controlled snap-back, content the parent changes in the same transition | `transition` prop | Same commit as above (snap-backs carry no `fsui-*` types, section 5.3). |
| Any part with `transition` absent | nothing (no boundary rendered) | Baseline timing; a switch or open calls no `startViewTransition`. |

`Tabs.Indicator` therefore follows optimistic selection, renders no `<ViewTransition>` and has no
`transition` prop: it is positioned by CSS Anchor Positioning on the optimistic tab and slides via
a plain CSS `transition` on the anchored insets (moves on click, snaps back on rejection). Any
part that keys a `<ViewTransition>` on optimistic state is a bug, not a style choice.

Product-owner decision: `transition` stays on Toggle in v0 even though its own flip cannot use it,
documented honestly (it animates the end of the action and content keyed on `pending`), so the
"every animatable part has `transition`" rule has no exceptions. Since a part without the prop
renders no boundary, keeping the prop on such parts costs nothing for consumers who do not set it.

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
class already distinguishes old/new in CSS. No initial component needs shared-element
transitions (the Indicator moves with CSS, above). A future `viewTransition` prop could pass the
full props object through; it is not designed now.

### 5.3 Library-emitted transition types

Each dispatch adds `fsui-<component>` and, when the change has a direction or kind,
`fsui-<component>-<change>`:

| Component | Types |
| --- | --- |
| Toggle | `fsui-toggle`, `fsui-toggle-press`, `fsui-toggle-release` |
| Tabs | `fsui-tabs`, `fsui-tabs-next`, `fsui-tabs-prev` (by DOM order of the target tab relative to the committed tab) |
| Accordion | `fsui-accordion`, `fsui-accordion-expand`, `fsui-accordion-collapse` |
| Switch | `fsui-switch`, `fsui-switch-on`, `fsui-switch-off` |
| Checkbox | `fsui-checkbox`, `fsui-checkbox-check`, `fsui-checkbox-uncheck` |
| RadioGroup | `fsui-radio-group` (no direction variants) |
| CheckboxGroup | `fsui-checkbox-group`, `fsui-checkbox-group-check` (when `details.added` is non-empty), `fsui-checkbox-group-uncheck` (when `details.removed` is non-empty; a reset may carry both) |

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
- Render the boundary conditionally on `transition !== undefined` (5.1); never render
  `<ViewTransition default="none">` as a fallback, and never wrap a part that mounts in a
  transition commit in a boundary the consumer did not ask for.
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
four; action-less Checkbox, Switch and RadioGroup are the strongest candidates there, since a
native input already works without JS. Passing any action prop to a part from a Server Component is a type error unless the action
is a Server Function (section 2.2).

---

### 7.4 Attributes and events React cannot express

The platform moves faster than react-dom and `@types/react`. Conventions for the gap, with the
cases known on 2026-10-15 (`docs/research/modern-platform-survey.md`, "React 19.3 integration
notes"):

| Gap | Convention |
| --- | --- |
| Attribute unknown to react-dom (`command`, `commandfor`, `interestfor`, `focusgroup`, `closedby`, `switch`, `name` on `<details>`) | Write it **lowercase** in JSX; react-dom passes unknown lowercase attributes through verbatim on client and server. Never camelCase (`interestFor` renders the wrong attribute and warns). |
| Attribute untyped in `@types/react` (`command`, `commandfor`, `interestfor`, `focusgroup`, `switch`) | One module augmentation module, `src/internal/platform-attributes.ts` (`declare module "react" { ... }` plus `export {}` so it is a module), augmenting `React.HTMLAttributes` / `ButtonHTMLAttributes` / `AnchorHTMLAttributes` with the typed values from the research docs. It is imported **for side effects** (`import "./internal/platform-attributes.js"`) from the package entry and from every subpath `index.ts`, so each public entry carries it. Mechanism verified by the reviewer: tsdown emits `dist/internal/platform-attributes.d.mts` and an `import` of it in each entry's `.d.mts`, with no runtime import in the JS. A `.d.ts` source would not work: it is typecheck-only and never reaches `dist`. Each entry carries a comment with the DefinitelyTyped issue so it can be deleted when upstream lands. |
| Attribute react-dom serialises wrongly (`hidden="until-found"` becomes `hidden=""` on both client and server) | Render the boolean form so SSR output is correct, then upgrade in a layout effect through the part's ref (`el.setAttribute("hidden", "until-found")`), and listen to the platform event that the browser uses to undo it (`beforematch`) to dispatch the matching change action. Encapsulate each such case in one internal hook (`use-until-found.ts`) so the workaround has exactly one home. |
| Event React does not synthesize (`command`, `interest`, `loseinterest`, `beforematch`, `scrollsnapchange`) | `addEventListener` through the part's ref (or a Fragment ref for sibling groups), inside an effect that uses `useEffectEvent` for the handler body, dispatching into the component's transition like any other interaction. Never expose these as `on*` props (section 2.6). |
| Event React does synthesize, but the handler must be feature-detected away (Tooltip's `pointerenter` / `focus` when `interestfor` is native) | Same `addEventListener`-in-effect pattern: the effect subscribes only when the JS path is needed, so markup is identical on server and client. Because no prop-form handler is installed, none is omitted from the part's type and the consumer's `on*` props pass through (section 1.5). |
| Pseudo-class the platform already provides (`:open`, `:popover-open`, `:disabled`) | Document it next to the equivalent data attribute; do not emit a duplicate attribute when the pseudo-class carries the same meaning and the state is browser-owned. |

Rules of thumb: platform attribute names in source are the HTML spelling; the augmentation file
is the only place any `declare module` appears, and that module is always `"react"`: HTML
attributes go on `React.HTMLAttributes` and friends, and CSS properties the installed `csstype`
lacks (`interest-delay`, `interest-delay-start`, `interest-delay-end`) go on
`React.CSSProperties`, which has the same effect for `style` props. Never `declare module
"csstype"`: `csstype` is not a dependency of this package, so under pnpm's strict layout the
augmentation fails with TS2664 and would not reach consumers even if it compiled here; and every workaround for a react-dom
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
   | `<dialog closedby>` | WebKit (TP) | `Dialog.Popup experimental_closedBy` (the part that renders the attribute; camelCase like `experimental_interestFor`) | Native light dismiss instead of JS. |
   | Customizable `<select>` | Gecko (pref) | `Select.Root experimental_baseAppearance` | `appearance: base-select` markup; degrades to the native picker elsewhere. |
   | `<input type="checkbox" switch>` | Blink (proposed), Gecko | `Switch experimental_switch` (future; not added while WebKit-only) | Native switch rendering and semantics; `role="switch"` already gives the semantics everywhere. |

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
    types.ts                # Action, ActionDetails, ChangeAction, ChangeReason, RenderProp, StateValue
    action-details.ts       # createActionDetails (section 2.2); directive-free
    data-attr.ts            # dataAttr(flag) -> "" | undefined (section 4.1)
    transition-types.ts     # transitionTypes(component, change?) -> string[] (section 5.3)
    platform-attributes.ts  # the one `declare module "react"` (section 7.4)
    use-controllable-action.ts
    use-render.tsx          # resolves render / className / style / children against state
    merge-props.ts
    use-form-reset.ts       # section 3.8
    use-native-checked.ts   # section 3.8; also exports guardCheckableChange
    use-native-group-reconciliation.ts  # section 3.8
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
- `<Component><State>ChangeDetails` extends `ActionDetails`; when it exposes `reason`, the
  member is `readonly reason: ChangeReason` (never a local union).
- Shared: `Action`, `ActionDetails`, `ChangeAction`, `ChangeReason`, `RenderProp<Props, State>`,
  `StateValue<T, State> = T | ((state: State) => T)`, `ViewTransitionClass` (the `transition`
  prop's type, section 5.2).
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
| Superseded rejection (both) | Two dispatches; the older rejects **after** the newer resolved, and separately **while** the newer is still pending. In both cases the error reaches an Error Boundary around the component (React alone drops it, section 2.4); the newer action's outcome is unaffected. Required in every component's test file, once per mode, even though the shared hook has its own tests: the component decides how dispatches are wired (which part owns the transition, platform-initiated dispatches), and that wiring is what these rows guard. |
| Suspending content (both) | Content keyed on the new value suspends: old content stays, no fallback shown by a boundary above the component, `data-pending` on; after resolve, new content. |
| Function props | `className`, `style`, `children`, `render` receive the documented state and the attributes agree with it. |
| `render` element | Element form replaces the default element, merges `className`/`style`, keeps the library's handler working, forwards `ref`. |
| Post-await rule | A controlled parent updating after its own `await` inside `startTransition` works end to end (guards the documented pattern). |
| Directive | Each built part file starts with `"use client"` or not, exactly as the component's design doc records (script over `dist`, run in `test:run` after `build`). |
| Platform path (both) | Required for every component with a residual browser path (section 3.5): mount reconciliation (`renderToString`, change the DOM before `hydrateRoot`, exactly one dispatch with `reason: "platform"` and `event === undefined`, StrictMode still one) and, for native form controls, form reset through `<button type="reset">`, `form.reset()` and React's automatic reset after a successful `<form action>` (one dispatch per state owner with the `reset` event; a cancelled `reset` dispatches nothing; a controlled parent that refuses gets the DOM re-synced after settle). |

ViewTransition cannot be observed in jsdom (`document.startViewTransition` is absent and React
falls back silently). jsdom tests assert that components render with and without `transition`
set; animation behaviour is checked in the example app. **Every mount-prone part** (a part whose
boundary mounts or is revealed as the top of an inserted subtree in a transition commit:
`Tabs.Panel`, `Accordion.Panel`, a Dialog Root inserted by a transition, and any single-element
part the test conditionally renders) also gets a **browser-mode row**: with `transition` absent,
a switch or open calls `document.startViewTransition` zero times (spy on it before the
interaction); with `transition="none"` it is called where the boundary is the top of the inserted
subtree. Where a new DOM element shields the boundary (Dialog's plain open: children mount under
the `<dialog>`), the row asserts zero calls in both cases. When a component depends on platform APIs
jsdom lacks (Popover, anchor positioning), the rows that need them go in a sibling
`foo.browser.test.tsx`, which vitest runs in headless Chromium (browser mode, see `CLAUDE.md`);
the jsdom file notes which rows moved there. Browser tests are slower, so they cover only what
jsdom cannot observe.

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
23. **Conditional `<ViewTransition>` boundary** (issue #35, 2026-10-16): a part renders the
    boundary only when `transition` is given; the prop is static; `"none"` keeps the boundary;
    static-mode Accordion renders none; page-policy CSS is the consumer's choice; mount-prone parts
    get a browser test row asserting no `startViewTransition` call without the prop.
10. **`Arrow` part held for v0** (from the Tooltip design). Popups ship without an `Arrow` part
    until a component shows it cannot be done in CSS on the popup itself.
11. **`provides="description" | "name"`** is the convention for any part whose content labels or
    describes another element (Tooltip's `Popup`, future `Label`/`Description` parts):
    `"description"` wires `aria-describedby`, `"name"` wires `aria-labelledby`. It is an
    **explicit prop with a fixed default** (`"description"`); there is no automatic switch to
    `"name"` based on whether the trigger already has an accessible name (clarified 2026-10-16
    after the Tooltip implementation; the design wins). The prop name is shared across components.
12. **All Accordion parts are client modules** (section 7.3). Server Components render them and
    the native toggle works before hydration; directive-free variants are a later concern (#19).

13. **`details.event` is a virtual Proxy-served property** (raised by the Toggle design, #6;
    resolved by research #17, `docs/research/server-function-action-props.md`, option (e), see
    section 2.2). Server Functions may be passed directly to any action prop; the thin client
    wrapper is optional.
14. **`details.reason` vocabulary unified** to `"activate"` | `"platform"` (section 2.2); Tabs'
    `"find"` and Accordion's `"trigger"` are renamed.
15. **Tabs warns in development** when neither `value` nor `defaultValue` is given.
16. **Plain-input anatomy for native form controls** (wave 2, 2026-10-16): `Switch` and
    `Checkbox` are single components rendering the input, with no `Indicator`, `Thumb` or
    `Label` parts; `RadioGroup` is `Root` (`<fieldset role="radiogroup">`) / `Label` (`<legend>`)
    / `Item` (`<input type="radio">`), the research's shape 1. Sibling indicators are consumer
    markup styled with `:has()`, or rendered through `render`'s function form.
17. **Form reset in controlled mode notifies the parent** with `reason: "platform"` and the
    `reset` event (section 3.8 rule 6); resets are never silently ignored.
18. **`indeterminate` is suspended while pending** (`state.indeterminate = indeterminate &&
    !pending`, section 4.1).
19. **One public `ChangeReason` type** (`"activate" | "platform" | "dismiss"`, section 2.2)
    replaces the per-component unions; `"dismiss"` was added with the Dialog design.
22. **Dialog (#26)**: the product owner accepted all nine questions as recommended (issue #26
    comment): `"dismiss"` reason; no Escape disabling in v0; the `open` attribute is never
    server-rendered; `state.open` is `false` in JS-free mode; `lightDismiss` defaults to `false`;
    both `Dialog.Close action` and `Dialog.Form` stay; a pre-hydration click opens an empty
    dialog that fills in after hydration; a refused close re-opens the dialog; the jsdom dialog
    shim is accepted.
20. **`CheckboxGroup`** was deferred to its own design (issue #33) and accepted 2026-10-17
    (`design/components/checkbox-group.md`): own `Item` part, `Parent` with `values`, APG restore
    cycle, dynamic native `required` on Items with no `aria-required` on the fieldset,
    `details.added` / `removed`, `next` in document order, no partial-hydration warning,
    `transition` on `Item` and `Parent`. The conventions changes it asked for (the `equals`
    option, rule 3.8.3 scoped to radios, `Parent` in 1.1, the derived `indeterminate` note in
    4.1, computed native validity attributes in 3.6, the diff shape in 2.2, the types in 5.3)
    are applied.
21. **Shared native-input machinery** is the three-hook contract of section 3.8: per-element
    `useNativeChecked` (with `group: true` inside a group), the group adapter
    `useNativeGroupReconciliation` on a fieldset Root, both on `useFormReset`; one dispatch per
    state owner.

## Open questions

None at present.
