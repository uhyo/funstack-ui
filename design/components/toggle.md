# Toggle

Status: **proposed** (2026-10-15, GitHub issue #6). Follows `design/conventions.md` (accepted);
where this document and the conventions disagree, the conventions win.

Inputs: `docs/vision.md`, `design/conventions.md`, `docs/research/react-async-apis.md`,
`docs/research/modern-platform-survey.md` ("Toggle / Switch / Checkbox / Radio" and the Toggle
recommendation), WAI-ARIA APG "Button" pattern (toggle button variant), prior art (Base UI
`Toggle`, React Aria `ToggleButton`, Radix `Toggle`, Ark UI `Toggle`), and one jsdom probe on
React 19.3.1 recorded in `memo/architect/probes/toggle-viewtransition-optimistic.mjs` (notes in
`memo/architect/toggle-notes.md`).

Toggle is the first component and the proving ground for the action-prop + `useOptimistic` model.
Everything here should generalise to every later trigger part; where it does not, the deviation is
called out.

## Decisions at a glance

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Anatomy | One plain component, `Toggle`, rendering `<button type="button" aria-pressed>`. No `.Root`, no sub-parts. `ToggleGroup` is a separate future design. |
| 2 | State | One library-owned state, `pressed`: `pressed` / `defaultPressed` / `pressedChangeAction(next, details)`. |
| 3 | What the element shows | Optimistic `pressed` (Toggle is both owner and trigger). `pending` from the component's own `useTransition`. No committed value is exposed on the element. |
| 4 | Next value | `next = !optimistic`, not `!committed`, so a second click while pending reverses the first (verified). |
| 5 | Disabled while pending | **No.** The button stays enabled; repeated clicks are latest-wins. Consumers who want it use `render` or CSS (section 6.6). |
| 6 | Errors | Reach the nearest Error Boundary above the `Toggle`; for a superseded (non-latest) dispatch the shared hook rethrows from render because React would drop it (conventions 2.4). Optimistic state reverts; uncontrolled committed state untouched. |
| 7 | ViewTransition | `<ViewTransition default={transition ?? "none"}>` outermost; types `fsui-toggle` plus `fsui-toggle-press` / `fsui-toggle-release`. It animates the *settling* of an action and rollbacks, **not the optimistic flip** (section 7, verified). |
| 8 | ARIA | `aria-pressed="true" \| "false"` only; never `"mixed"`. Native Space/Enter. Accessible name must stay stable across states. |
| 9 | Forms | `type="button"` always; no `name`/`value` submission in v0. |
| 10 | Files | `src/toggle/{index.ts,toggle.tsx,toggle.test.tsx}`; `toggle.tsx` is `"use client"`. Exports `Toggle`, `ToggleProps`, `ToggleState`, `TogglePressedChangeDetails`. |

---

## 1. Anatomy

```
<ViewTransition default="none">          React boundary, no DOM
  <button type="button" aria-pressed>    the only element; consumer's children inside
```

Toggle renders exactly one DOM element. It is simultaneously the state owner, the trigger, and
the only thing that reflects the state, so every rule in the conventions that distinguishes
"owner", "trigger" and "content region" collapses onto this one element:

- owner: holds committed state, `useOptimistic`, `useTransition`;
- trigger: renders optimistic `pressed`, gets `data-pending` on every dispatch;
- content region: there is none. Toggle's `children` are rendered from the trigger's (optimistic)
  state and therefore **must not suspend** (conventions 3.2). Content elsewhere that depends on
  the toggle's value belongs to the consumer and reads the consumer's own committed state.

There is no `Toggle.Indicator` or icon part. An icon is just `children`.

## 2. Usage

The API is judged by how it reads at the call site, so examples come first.

### 2.1 Uncontrolled with an async action

```tsx
import { Toggle } from "@funstack/ui/toggle";

<Toggle
  defaultPressed={post.favorited}
  pressedChangeAction={async (next) => {
    await api.setFavorite(post.id, next);
  }}
>
  Favorite
</Toggle>
```

The button flips the instant it is clicked (`aria-pressed`, `data-pressed`), shows `data-pending`
until the save resolves, and then keeps the new value. If the save rejects, the button flips back
and the error reaches the Error Boundary around it.

### 2.2 Uncontrolled with a Server Function (from a Client Component)

```tsx
"use client";
import { Toggle } from "@funstack/ui/toggle";
import { setFavorite } from "./actions"; // "use server"

export function FavoriteButton({ id, favorited }: { id: string; favorited: boolean }) {
  return (
    <Toggle defaultPressed={favorited} pressedChangeAction={(next) => setFavorite(id, next)}>
      Favorite
    </Toggle>
  );
}
```

The wrapper is optional: it only drops `details` and binds `id`. Section 9 shows the direct form
from a Server Component.

### 2.3 Controlled, local state

```tsx
const [muted, setMuted] = useState(false);

<Toggle pressed={muted} pressedChangeAction={(next) => { setMuted(next); }}>
  <SpeakerIcon muted={muted} aria-hidden />
  <span className="sr-only">Mute</span>
</Toggle>
```

The `setMuted` call runs in the synchronous prefix of the library's transition, so it is a
Transition update and commits together with the end of the action.

### 2.4 Controlled, server-backed ("update on success")

```tsx
const [favorite, setFavorite] = useState(post.favorited);

<Toggle
  pressed={favorite}
  pressedChangeAction={async (next) => {
    await api.setFavorite(post.id, next);
    startTransition(() => setFavorite(next)); // required after an await (conventions 2.3 #4)
  }}
>
  Favorite
</Toggle>
```

The parent only writes on success, so a rejected save leaves `favorite` unchanged and the
optimistic flip reverts. This is the controlled twin of 2.1 and behaves identically from the
user's point of view (section 11 tests this parity).

### 2.5 Function props: content and class from state

```tsx
<Toggle
  pressedChangeAction={save}
  className={({ pressed, pending }) => clsx("chip", pressed && "chip-on", pending && "chip-busy")}
>
  {({ pressed, pending }) => (
    <>
      {pending ? <Spinner aria-hidden /> : pressed ? <StarFilled aria-hidden /> : <StarOutline aria-hidden />}
      <span>Favorite</span>
    </>
  )}
</Toggle>
```

Note the label text does not change with `pressed`. `aria-pressed` already conveys the state;
a label that flips ("Mute" / "Unmute") combined with `aria-pressed` double-announces and is the
APG anti-pattern for toggle buttons. Icons may change freely as long as they are `aria-hidden`.

### 2.6 `render`: a design-system button

```tsx
// MyButton must accept `ref` as a prop and spread the rest onto its <button>.
<Toggle pressedChangeAction={save} render={<MyButton variant="ghost" />}>
  Favorite
</Toggle>

// Function form when the element's content must depend on state:
<Toggle
  pressedChangeAction={save}
  render={(props, state) => (
    <MyButton {...props} variant={state.pressed ? "solid" : "ghost"}>
      Favorite
    </MyButton>
  )}
/>
```

The element passed to `render` must be, or render, a `<button>`. A Toggle is a button by
definition (APG); the library does not add `role="button"`, `tabIndex` or key handling to make
a `<div>` or `<a>` behave like one, and there is no legitimate "toggle link".

### 2.7 Styling with attribute selectors

```css
.chip { transition: background-color 120ms, color 120ms; }
.chip[data-pressed] { background: var(--accent); color: white; }
.chip[data-pending] { cursor: progress; }
.chip[data-pending]::after { content: ""; /* spinner */ }
.chip[data-disabled] { opacity: 0.5; }

/* Platform pseudo-classes, not data attributes, for interaction state: */
.chip:hover { filter: brightness(1.1); }
.chip:focus-visible { outline: 2px solid var(--focus); }
.chip:active { transform: scale(0.97); }
```

`[aria-pressed="true"]` and `[data-pressed]` always agree; `data-pressed` is the documented
form so that selectors look the same across components (`data-selected`, `data-expanded`).
Tailwind: `data-pressed:bg-accent data-pending:animate-pulse`.

### 2.8 `transition` and transition types

```tsx
<Toggle pressedChangeAction={save} transition="fsui-fade">
  {({ pending }) => (pending ? <Spinner aria-hidden /> : <StarIcon aria-hidden />)}
  Favorite
</Toggle>
```

```css
::view-transition-old(.fsui-fade) { animation: 120ms ease-in both fade-out; }
::view-transition-new(.fsui-fade) { animation: 120ms ease-out both fade-in; }

/* Key on the library's transition types (they are set on <html>): */
:root:active-view-transition-type(fsui-toggle-press) ::view-transition-new(.fsui-fade) {
  animation-name: pop-in;
}

@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; }
}
```

Read section 7 before reaching for this: on a Toggle, `<ViewTransition>` animates the commit
that ends the action (the spinner going away, a rollback), not the initial flip. The flip itself
is best animated with a plain CSS `transition` on `[data-pressed]` as in 2.7.

---

## 3. Props

```ts
// packages/ui/src/toggle/toggle.tsx
import type { ComponentPropsWithRef, CSSProperties, ReactNode, ViewTransitionClass } from "react";
import type { ActionDetails, ChangeAction, RenderProp, StateValue } from "../internal/types.js";

export interface ToggleState {
  /** Optimistic pressed state: what the user sees, including an in-flight change. */
  readonly pressed: boolean;
  /** An action dispatched by this Toggle is in flight (including the resulting render). */
  readonly pending: boolean;
  /** The `disabled` prop. */
  readonly disabled: boolean;
}

/** Details passed as the second argument of `pressedChangeAction`. */
export interface TogglePressedChangeDetails extends ActionDetails {
  // v0 adds nothing beyond `event`; the interface exists so fields can be added without a
  // breaking change (e.g. a `reason` if a ToggleGroup ever dispatches on an item's behalf).
}

export interface ToggleProps
  extends Omit<
    ComponentPropsWithRef<"button">,
    "onClick" | "type" | "aria-pressed" | "className" | "style" | "children"
  > {
  /** Controlled pressed state. `undefined` means uncontrolled. */
  pressed?: boolean;
  /** Initial pressed state in uncontrolled mode. Default `false`. */
  defaultPressed?: boolean;
  /**
   * Called with the next pressed state on every user-initiated change. Runs inside the Toggle's
   * transition; may be sync or async. Rejections reach the nearest Error Boundary.
   */
  pressedChangeAction?: ChangeAction<boolean, TogglePressedChangeDetails>;
  /** Renders a native disabled button; never dispatches. Default `false`. */
  disabled?: boolean;
  /** Forwarded as `default` to the Toggle's `<ViewTransition>`. Default `"none"`. */
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, ToggleState>;
  style?: StateValue<CSSProperties | undefined, ToggleState>;
  children?: StateValue<ReactNode, ToggleState>;
  /** Replace the rendered element (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"button">, ToggleState>;
}
```

Notes on the omissions from the native prop set:

| Omitted | Why |
| --- | --- |
| `onClick` | The library's own handler (conventions 1.5). Attach anything else through pass-through (`onPointerDown`, `onKeyDown`, ...) or `ref`; that path is unsupported for state changes. |
| `type` | `"button"` whenever the rendered element is a `<button>`; a `render` element of another type (`<a>`) gets no `type` attribute (conventions 1.2). A toggle that submits a form is not a toggle; the library does not expose the prop. |
| `aria-pressed` | Library-controlled state attribute. |
| `className`, `style`, `children` | Re-declared with the function-of-state form. |

Everything else on `<button>` passes through: `id`, `aria-label`, `aria-labelledby`,
`aria-describedby`, `form`, `name`, `autoFocus`, `title`, `onPointerDown`, `onKeyDown`,
`commandfor`/`command` (lowercase; a type error until the platform augmentation file lands with
Tooltip, conventions 7.4), and so on. `ref` is an
ordinary prop attached to the `<button>` and merged with the library's internal ref.

`pressed` and `defaultPressed` both set, or `pressed` flipping between `undefined` and a boolean
after mount, log a dev warning (conventions 3.1). `defaultPressed` is read once.

---

## 4. States

| State | Kind | Owner | Shown as | Source |
| --- | --- | --- | --- | --- |
| `pressed` | library-owned | Toggle | `aria-pressed`, `data-pressed`, `state.pressed` | **optimistic** (`useOptimistic(committed, (_, next) => next)`) |
| `pending` | library-owned | Toggle | `data-pending`, `state.pending` | `useTransition()` of this Toggle |
| `disabled` | prop | Toggle | `disabled` attribute, `data-disabled`, `state.disabled`, `:disabled` | prop |

There is no browser-owned state in Toggle; nothing here is observed from the DOM.

Why `pressed` is optimistic and nothing exposes the committed value: a Toggle has no content
region. The committed value matters only to whoever reacts to it (the consumer's own state in
controlled mode, or nobody in uncontrolled mode). Exposing `state.committedPressed` would invite
`children` functions to branch on it and render suspending content inside the button; the
conventions forbid exactly that. A consumer who needs the committed value is by definition in
controlled mode and already has it.

Attribute emission, exactly:

```tsx
<button
  type="button"
  aria-pressed={pressed}                       // "true" | "false"
  data-pressed={pressed ? "" : undefined}      // presence form (conventions 4.1)
  data-pending={pending ? "" : undefined}
  data-disabled={disabled ? "" : undefined}
  disabled={disabled}
/>
```

`""` rather than `true`: react-dom serialises `data-x={true}` as `data-x="true"`, which the
conventions' `expectPending` helper (`toHaveAttribute("data-pending", "")`) would reject. See
Conventions feedback #3.

---

## 5. Keyboard and ARIA

APG pattern: Button, toggle-button variant.

| Interaction | Behaviour | Provided by |
| --- | --- | --- |
| Space | Activates on key**up**; dispatches a change | native `<button>` |
| Enter | Activates on key**down**; dispatches a change | native `<button>` |
| Click / tap | Dispatches a change | native `<button>` |
| Tab | Focusable unless `disabled` | native `<button>` |

The library installs no `onKeyDown`. Every activation path arrives as a `click` event, so
`details.event` is always a `MouseEvent` (`PointerEvent` in current engines, `detail === 0` for
keyboard activation).

ARIA:

- `aria-pressed` is always present and always `"true"` or `"false"`. **Never `"mixed"`**: a
  Toggle is binary. A tri-state control is a different component (`Checkbox` with
  `indeterminate`), and a group whose items are partially pressed is `ToggleGroup`'s concern.
- The accessible name must not change with `pressed` (APG: "the label does not change when its
  state changes"). Documented on `children` (section 2.5). The library cannot enforce this; the
  docs and the example app model it.
- `disabled` uses the native attribute (APG allows an unfocusable disabled button; the
  focusable-disabled requirement is specific to composite widgets like Tabs). It therefore also
  matches `:disabled`, which is documented next to `data-disabled`.
- No `role` is set; the native button role is correct. In `render` element form the element must
  keep that role.

---

## 6. Behaviour

### 6.1 Dispatch

On `click`, unless `disabled`:

```ts
const next = !optimistic;
dispatch(next, { event: event.nativeEvent });
```

which, per conventions 3.4, runs:

```ts
startOwnTransition(async () => {
  addTransitionType("fsui-toggle");
  addTransitionType(next ? "fsui-toggle-press" : "fsui-toggle-release");
  setOptimistic(next);
  await pressedChangeAction?.(next, details);
  if (!isControlled && id === latest.current) startTransition(() => setInternal(next));
});
```

`next` is computed from the **optimistic** value, not the committed one. With a slow action,
committed is still the old value when the user clicks a second time; `!committed` would
dispatch the same value twice, while `!optimistic` reverses the first click, which is what the
user asked for (verified: two clicks on an unpressed toggle dispatch `true` then `false`).

There is no "no-op interaction" for Toggle: every click changes the value, so every click
dispatches. The one exception is `disabled`.

Owned keys (conventions 1.2): `type` (only when the rendered element is a `<button>`),
`aria-pressed`, `disabled`, `data-pressed`, `data-pending`, `data-disabled`, `onClick`. `disabled`
is owned like on every part that takes the prop: a `render` element can neither re-enable a
disabled Toggle nor disable an enabled one, so the prop, the native attribute, `data-disabled`
and the no-dispatch rule always agree. (The 12.2 sketch predates the `libraryProps` split in
`useRender`; these keys go in `libraryProps`, the rest of `rest` in `props`.)

### 6.2 Sequence: sync action

```
click
  ├─ transition starts; pending := true; optimistic := true; action(true, details) returns
  │  (microtask) sync-lane commit:  aria-pressed=true data-pressed data-pending
  └─ action resolved; setInternal(true) in a nested transition
     transition-lane commit:        aria-pressed=true data-pressed          (data-pending gone)
```

Two commits, both before the next paint, so the user sees one flip. `data-pending` exists for
a tick even for sync actions; tests assert on it only after `act` settles.

### 6.3 Sequence: async action that resolves

```
click
  ├─ sync-lane commit:             aria-pressed=true data-pressed data-pending   (immediately)
  │  ... promise pending; user sees the pressed state with a pending marker ...
  └─ resolve → setInternal(true)
     transition-lane commit:       aria-pressed=true data-pressed               (pending gone)
```

Optimistic and committed values converge in the same commit; there is no frame in which the
old value is shown again (React guarantee, research doc section 3).

### 6.4 Sequence: async action that rejects

```
click
  ├─ sync-lane commit:             aria-pressed=true data-pressed data-pending
  └─ reject
     ├─ optimistic reverts (nothing was committed in uncontrolled mode; in controlled mode the
     │  parent did not update), so the Toggle would render aria-pressed=false
     └─ the error propagates to the nearest Error Boundary above <Toggle>
```

What the user sees depends on where the boundary is. A boundary that wraps only the Toggle
**replaces the Toggle with its fallback** (verified: the subtree becomes the fallback). That is
the correct, documented behaviour for an uncaught error; it means the "flip back" render is
usually never seen because the button is gone. Consumers who want the button to stay and flip
back must catch inside the action, which turns the rejection into success for the library:

```tsx
// Controlled: parent vetoes by not updating. Button flips back, stays mounted, shows an error.
<Toggle
  pressed={favorite}
  pressedChangeAction={async (next) => {
    try {
      await api.setFavorite(id, next);
      startTransition(() => setFavorite(next));
    } catch (e) {
      startTransition(() => setError(e));
    }
  }}
/>
```

In **uncontrolled** mode a caught error commits `next` (conventions 2.4, resolved question 3).
The Toggle docs state this with the example above: "to veto, be controlled".

### 6.5 Sequence: two overlapping clicks (latest wins)

```
click 1 (optimistic false→true)   action(true)   id=1
click 2 (optimistic true→false)   action(false)  id=2      ← next computed from optimistic
   ...both promises pending; button shows aria-pressed=false data-pending...
action 2 resolves  → id === latest → setInternal(false) queued (held: action 1 still pending)
action 1 resolves  → id !== latest → write skipped
single transition-lane commit:     aria-pressed=false, pending gone
```

Verified in both resolution orders. Properties:

- The optimistic reducer always shows the most recent click.
- `data-pending` stays until **all** in-flight actions settle (React's `isPending` semantics), not
  just the latest.
- The consumer's action is called once per click, in click order, with alternating values. If
  the backend applies them out of order, that is the consumer's problem; the documented remedy is
  an `AbortController` held in a ref inside the action (conventions 2.5).
- Both dispatches' transition types are collected into the one final commit
  (`fsui-toggle`, `fsui-toggle-press`, `fsui-toggle-release` all present).
- **If action 1 rejects**, React drops the rejection: `useTransition` keeps only the newest
  thenable, so nothing reaches a boundary, `reportError` or `unhandledrejection` (verified by the
  reviewer, both orders, both modes). The shared hook catches rejections of non-latest dispatches,
  stores the first, and throws it from render so it reaches the boundary above the Toggle exactly
  as a latest-dispatch rejection would (conventions 2.4). Action 2's outcome is unaffected: if it
  resolved, `false` was committed and then the boundary fallback replaces the Toggle; if it is still
  pending, the boundary fallback appears while it is in flight.

### 6.6 Decision: not disabled while pending

The Toggle stays enabled and clickable while an action is in flight. Reasons:

1. Latest-wins already makes rapid clicks safe; disabling would be solving a problem the state
   model solved.
2. A natively disabled button drops keyboard focus (focus moves to `body` in all three engines).
   Disabling on press would throw a keyboard user out of the control they are operating.
3. Pending can be long and is entangled with every other transition in the app (conventions 2.3
   #5); freezing the control for that duration is worse than letting the user change their mind.

Consumers who want it anyway have two supported spellings:

```tsx
// CSS: still focusable, just not clickable.
.chip[data-pending] { pointer-events: none; }

// Function render, when the markup must say so:
<Toggle render={(props, { pending }) => <button {...props} aria-busy={pending || undefined} />} />
```

(`aria-busy` rather than `disabled` for the same focus reason.)

### 6.7 Other edge cases

| Case | Behaviour |
| --- | --- |
| `pressed` prop changes externally while an action is pending | The optimistic reducer rebases onto the new committed value and still returns `next`; after settle the Toggle shows whatever `pressed` is then. No error. |
| Controlled parent never updates `pressed` (veto, or forgot to) | After the action settles the button snaps back to `pressed`. This is the intended veto path. The snap-back commit is a transition commit and animates if `transition` is set (section 7). |
| Controlled parent updates after `await` **without** `startTransition` | The update still happens (it is an urgent update), so the value is right. Lost: ViewTransition for that commit, and the update is not held with the action, so it can commit one frame earlier than `data-pending` clears. Documented as the post-await rule. |
| Toggle unmounts while pending | The action keeps running; the post-await write targets an unmounted component and React ignores it. Nothing to clean up. |
| Action throws synchronously | Same path as a rejection (the async wrapper turns it into one). |
| StrictMode | No effects, no refs that need cleanup; nothing to double-invoke. |
| `details.event.preventDefault()` | Harmless; a `type="button"` click has no default action. |
| Click on a disabled button | Native buttons do not fire `click`; the handler additionally guards so that a `render` element that does not honour `disabled` still never dispatches. |

---

## 7. ViewTransition

### 7.1 Wiring

```tsx
return (
  <ViewTransition default={transition ?? "none"}>
    {element /* the <button> */}
  </ViewTransition>
);
```

Types added on every dispatch: `fsui-toggle` and `fsui-toggle-press` (`next === true`) or
`fsui-toggle-release` (`next === false`), per conventions 5.3.

### 7.2 What actually animates (verified, React 19.3.1)

The probe polyfills `document.startViewTransition` in jsdom and counts calls per commit:

| Commit | Lane | View transition started? | Types on it |
| --- | --- | --- | --- |
| Optimistic flip (`aria-pressed`, `data-pressed`, `data-pending` appear) | Sync | **No** | – |
| Action settles, uncontrolled (`data-pending` removed, committed written) | Transition | Yes | `fsui-toggle`, `fsui-toggle-press`/`-release` |
| Action settles, controlled, parent updated in the sync prefix | Transition | Yes | same |
| Action settles, controlled, parent did not update (snap back) | Transition | Yes | **none** (default entry applies) |
| Rejection caught by a boundary (Toggle replaced by fallback) | Transition | Yes | none |
| Two overlapping clicks, final commit | Transition | Yes, once | all types from both dispatches |

The reason is in react-dom: `useOptimistic` setters enqueue on `SyncLane`, and the commit only
calls `startViewTransition` when every committed lane is a transition, retry or idle lane
(`(committedLanes & 0x13FFFF00) === committedLanes` in 19.3.1). The optimistic render is
therefore an urgent commit with no view transition, and by the time the transition-lane commit
arrives the `aria-pressed` mutation has already happened. Conventions 5.1 and 3.2 record this
(updated 2026-10-15 from Conventions feedback #1 below).

Consequences for Toggle's docs:

- **The flip is a CSS-transition job.** `[data-pressed] { transition: ... }` animates it on the
  sync commit, and also on the rollback. This is the natural tool for a button's own visuals.
- **`transition` is for the end of the action**: the pending indicator disappearing, content
  rendered from `pending` swapping back, a snap-back after a veto, and any content change the
  parent makes in the same transition. Documented with 2.8's example, which keys the content on
  `pending`, not on `pressed`.
- Type-map users must supply a `default` entry if they want rollbacks animated, because the
  snap-back commit carries no types.
- With `transition` unset nothing changes: `default="none"` assigns no name and costs nothing.

### 7.3 Reduced motion

The library ships no animation; every `transition` example in the Toggle docs carries the
`prefers-reduced-motion` block from conventions 5.4.

---

## 8. Suspense

Toggle has no content region, so the Suspense story is entirely on the consumer's side:

- `children` (plain or function) render from optimistic state inside the trigger and must not
  suspend. If a consumer insists on suspending content inside the button, they wrap it in their
  own `<Suspense>`; the fallback will show on the sync optimistic commit.
- Content *outside* the Toggle that depends on its value is driven by the consumer's state. In
  the controlled "update in sync prefix" pattern that state changes inside the library's
  transition, so suspending content keeps the old UI and the Toggle shows `data-pending` until it
  is ready. This is the required-coverage "suspending content" row for Toggle (section 11).
- No `use()` inside Toggle; it does not require a Suspense boundary during SSR.

---

## 9. Server Components

`toggle.tsx` is a `"use client"` file. A Server Component may render `<Toggle>` with
serializable props (`defaultPressed`, `disabled`, `className` as a string, `children` as JSX,
`transition`) and a Server Function as `pressedChangeAction`:

```tsx
// Server Component
import { Toggle } from "@funstack/ui/toggle";
import { setFavorite } from "./actions"; // "use server"; signature (id, next, details)

<Toggle defaultPressed={post.favorited} pressedChangeAction={setFavorite.bind(null, post.id)}>
  Favorite
</Toggle>
```

The library calls the action as `(next, details)`. Per conventions 2.2 (decided by research #17,
`docs/research/server-function-action-props.md`), `details` is a plain serialisable object and
`details.event` is a virtual property served by a Proxy trap, so the Server Function receives
`(id, next, details)` with `details.event === undefined`, no dev warning, in every RSC framework.
The thin client wrapper of 2.2 is optional. Function-form `className`, `style`, `children` and
`render` are not serializable and are client-only by nature.

---

## 10. Out of scope (recorded, not designed)

- **`ToggleGroup`**: a separate design, `design/components/toggle-group.md`, once Tabs has
  settled the List/roving-focus conventions. Expected shape: `ToggleGroup.Root` owning
  `value: string[]` (multiple) or `string | null` (single, `exclusive`) with
  `valueChangeAction`, and `ToggleGroup.Item value="x"` reusing Toggle's element and states via
  context. Open point for that design: `aria-pressed` items in a `group` vs `role="radiogroup"`
  for exclusive mode. Nothing in Toggle's API should need to change; `Toggle` stays usable on its
  own.
- **Form participation** (`name`/`value` posted with a form): no hidden input in v0. `type` is
  fixed to `"button"`.
- **Tri-state / `aria-pressed="mixed"`**: never for Toggle.
- **`Switch`**: a different APG pattern (`role="switch"`, on/off semantics, label changes allowed);
  it is not a Toggle variant and gets its own design.
- **`errorAction`**: none in v0 (conventions 2.4).

---

## 11. Test plan (`src/toggle/toggle.test.tsx`)

Rows marked (both) run under `describe.each` over the uncontrolled wrapper and the controlled
"update on success" wrapper from `renderBoth`. Interactions go through `user-event`; assertions
are on the DOM only.

| # | Area | Test |
| --- | --- | --- |
| 1 | Roles and ARIA | Renders `<button type="button">` with `aria-pressed="false"`; `defaultPressed` gives `"true"`; `aria-pressed` is never `"mixed"` or absent. |
| 2 | Roles and ARIA | `data-pressed`, `data-pending`, `data-disabled` are absent when false and `""` when true; `disabled` renders the native attribute and `data-disabled`. |
| 3 | Roles and ARIA | Native pass-through: `aria-label`, `id`, `form`, `onPointerDown` land on the button; `type="submit"` and `aria-pressed="mixed"` passed through props are overridden at runtime (the library spreads its own attributes last). No type-level test: TypeScript skips excess-property checks for hyphenated JSX attributes, so `Omit` cannot exclude `aria-pressed`; the runtime override is the guarantee. |
| 4 | Keyboard | Focus the button, press Space: dispatches once with `next === true`. Press Enter: dispatches again with `false`. `details.event.type === "click"`. |
| 5 | Keyboard | Disabled button is not in the tab order and Space/Enter do not dispatch. |
| 6 | Sync action (both) | Click calls `pressedChangeAction` once with `(true, details)`; `details.event` is the native event (`instanceof window.Event`, asserted via `details.event`, never `toEqual`); after `act`, `aria-pressed="true"` and no `data-pending`. Second click dispatches `false`. |
| 7 | Sync action (both) | `disabled` never dispatches, even when clicked programmatically through `ref`. |
| 8 | Async action (both) | With a `deferred` action: immediately after click, `aria-pressed="true"`, `data-pressed=""`, `expectPending(button)`; a sibling element reading the wrapper's committed value still shows the old value. After `resolve()`: `expectNotPending`, `aria-pressed="true"`, sibling updated. |
| 9 | Rejection (both) | `reject(err)` inside `<ErrorCatcher>`: the catcher records `err`, the Toggle is replaced by the marker, the wrapper's committed value is unchanged. |
| 10 | Rejection (both) | Caught-inside variant: action resolves; uncontrolled commits `true`; the controlled "veto" wrapper ends with `aria-pressed="false"` and no `data-pending`. |
| 11 | Overlap | Two clicks with two deferreds; action receives `true` then `false`; during flight `aria-pressed="false"` and pending. Resolve 2 then 1: final `"false"`, not pending. Repeat resolving 1 then 2: same final state. |
| 12 | Overlap | After resolving only the second of two deferreds, `data-pending` is still present (pending covers all in-flight actions). |
| 12a | Superseded rejection (both) | Two clicks, two deferreds. Resolve 2, then reject 1: `<ErrorCatcher>` records the error (React alone would drop it) and the wrapper's committed value is `false`. |
| 12b | Superseded rejection (both) | Two clicks; reject 1 while 2 is still pending: the catcher records the error; resolving 2 afterwards does not throw again or change the recorded error. |
| 13 | Suspending content (both) | Wrapper renders `<Suspender key={value}>` under a `<Suspense fallback>` above the Toggle. Click: old content stays, fallback not shown, `data-pending` on. Resolve the suspender: new content, pending gone. |
| 14 | Function props | `className`, `style`, `children` each receive `{ pressed, pending, disabled }`; while a deferred action is pending they see `pressed: true, pending: true` and the attributes agree. |
| 15 | `render` element | `render={<MyButton className="x" style={{ color: "red" }} />}` renders MyButton's button, merges class (`"x"` plus the Toggle's), keeps the element's style, forwards `ref` to the real `<button>`, and clicking still dispatches. |
| 16 | `render` function | Function form receives `(props, state)`; spreading `props` yields a working, correctly attributed toggle. |
| 17 | Post-await rule | Controlled parent that `await`s then calls `startTransition(() => setPressed(next))`: `aria-pressed` and `data-pending` converge in one state (no intermediate `aria-pressed="false"` without pending after resolve). |
| 18 | `transition` prop | Renders identically with `transition` unset, `"fsui-fade"`, and a type map (jsdom has no `startViewTransition`; this only guards the wiring). |
| 19 | Dev warnings | `pressed` together with `defaultPressed` warns once; switching `pressed` from `undefined` to a boolean warns once. |
| 20 | Directive | `dist/toggle/toggle.mjs` starts with `"use client"`; `dist/toggle/index.mjs` does not (shared script over `dist`). |
| 21 | `details.event` is virtual | After a click, `details.event instanceof window.Event`, `"event" in details` is true, `Object.keys(details)` does not include `"event"`, `JSON.stringify(details)` equals the JSON of the real fields, and `{ ...details }` has no `event`. Asserts via `details.event`, never `toEqual({ event })`. A fake Server Function (plain async spy) receives `(true, details)` with the same shape. |

Rows 8, 9, 13 and 17 are the ones that prove the Async React model; if the shared hook changes,
these are the tests expected to break first.

---

## 12. Implementation notes

### 12.1 Files

```
packages/ui/src/toggle/
  index.ts          # no directive: export { Toggle } and the three types
  toggle.tsx        # "use client"
  toggle.test.tsx
```

`index.ts`:

```ts
export { Toggle } from "./toggle.js";
export type { ToggleProps, ToggleState, TogglePressedChangeDetails } from "./toggle.js";
```

Root `src/index.ts` re-exports the same; `tsdown.config.ts` gains `"src/toggle/index.ts"` in
`entry` (and `unbundle: true`, `exports: true` per conventions 7.2 if the scaffold has not
already switched).

### 12.2 Component sketch

```tsx
"use client";
import { ViewTransition } from "react";
import { useControllableAction } from "../internal/use-controllable-action.js";
import { useRender } from "../internal/use-render.js";

export function Toggle({
  pressed, defaultPressed = false, pressedChangeAction, disabled = false, transition,
  className, style, children, render, ...rest
}: ToggleProps) {
  const { optimistic, pending, dispatch } = useControllableAction<boolean, TogglePressedChangeDetails>({
    controlled: pressed,
    defaultValue: defaultPressed,
    action: pressedChangeAction,
    transitionTypes: (next) => ["fsui-toggle", next ? "fsui-toggle-press" : "fsui-toggle-release"],
  });

  const state: ToggleState = { pressed: optimistic, pending, disabled };

  const element = useRender({
    defaultElement: "button",
    render, state, className, style, children,
    props: {
      ...rest,
      type: "button",
      disabled,
      "aria-pressed": optimistic,
      "data-pressed": optimistic ? "" : undefined,
      "data-pending": pending ? "" : undefined,
      "data-disabled": disabled ? "" : undefined,
      onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
        if (disabled) return;
        dispatch(!optimistic, { event: event.nativeEvent });
      },
    },
  });

  return <ViewTransition default={transition ?? "none"}>{element}</ViewTransition>;
}
Toggle.displayName = "Toggle";
```

- **No `useToggle` hook**, internal or public. Toggle is `useControllableAction` plus
  `useRender`; a third layer would have nothing to hold. If a public headless hook is wanted
  later it can be extracted without changing the component.
- **`useTransition`, `useOptimistic`, the sequence guard** all live in
  `internal/use-controllable-action.ts` (conventions 3.4). Toggle must not call them directly,
  so that every component's async behaviour is the same code. Toggle is the first consumer of
  the hook and its tests (rows 8 to 13, 17) double as the hook's tests until a second component
  lands.
- **Hook signature detail**: Toggle needs two types per dispatch (`fsui-toggle` and the
  press/release one), so the hook takes `transitionTypes: (next, prev) => readonly string[]` as
  above (conventions 3.4 sketch, updated 2026-10-15).
- **`!optimistic` from the render closure** is correct because the optimistic update is a sync
  lane render: by the time a second click handler runs, the component has re-rendered with the
  new optimistic value. The hook's `latest` ref does the ordering; the component does not need a
  ref for `next`.
- **`useRender` responsibilities** (shared, conventions 9.1): resolve `className`/`style`/
  `children` against `state`; element-form merge rules (class concat, style merge with element
  winning, library `onClick` runs after the element's, library-controlled attributes win); merge
  `ref`s with a callback ref that returns a cleanup; set `displayName`. None of this is
  Toggle-specific.
- **Dev warnings** for mode switching and `pressed` + `defaultPressed` belong in the hook, not
  in Toggle.
- Nothing in Toggle needs `useEffect`, `useId`, `useRef`, or DOM access beyond the merged ref.

### 12.3 Example app

`packages/example` should get a Toggle page that exercises: a fake 800 ms async action with a
spinner from `children`, a rejecting action inside an Error Boundary, a controlled veto, and the
`transition` prop with the CSS from 2.8, so that the ViewTransition findings of section 7 can be
re-checked in real browsers. That page is the only place ViewTransition behaviour is observed.

---

## Conventions feedback

All five items below were applied to `design/conventions.md` on 2026-10-15 by the conventions
architect (uncommitted at the time of writing). They are kept here as the record of why.

1. **Optimistic updates do not activate `<ViewTransition>`** (section 7.2, verified). Conventions
   5.1 says "the optimistic feedback, the eventual commit, and a rollback all animate through the
   same boundary". Only the last two do. The sentence should become: "The optimistic commit is a
   sync-lane render and does not animate; the commit that ends the action, and any rollback,
   animate." This also affects Tabs: a `Tabs.Indicator` or `data-selected` style keyed on
   optimistic selection will not get a view transition on click; the `Tabs.Panel` swap (committed)
   will. Worth a line in 3.2 as well, since it is the second concrete cost of "triggers render
   optimistic state".
2. **`details.event` and Server Functions** (section 9). Resolved by research #17: `event` is a
   virtual Proxy-served property (conventions 2.2); Server Functions are passed directly.
3. **Boolean data attribute emission**: conventions 4.1's example `data-pending={pending ||
   undefined}` renders `data-pending="true"`, but the helper table and the prose specify
   `data-pending=""`. The example should read `data-pending={pending ? "" : undefined}`.
4. **Transition types on rollback commits are empty** (section 7.2 table). Conventions 5.3 could
   note that a snap-back or boundary-swap commit carries no `fsui-*` type, so type-map consumers
   need a `default` entry for rollbacks.
5. **Hook signature**: `transitionType` returning a single string cannot express
   `fsui-<component>` plus `fsui-<component>-<change>`; see 12.2.

## Questions for the product owner

1. Section 6.6: confirm "never disabled while pending" as the library-wide stance for triggers
   (it will come up again for Tabs and Accordion).
2. (Resolved by #17.) Server Functions are passed directly; see conventions 2.2.
3. Section 7: given that the flip itself cannot be view-transitioned, is a `transition` prop on
   Toggle worth keeping in v0 for consistency, or should Toggle ship without it until a component
   where it clearly pays off (Tabs.Panel) exists? Recommendation: keep it, documented honestly as
   in 2.8; it costs nothing when unset and keeps the "every animatable part" rule simple.
