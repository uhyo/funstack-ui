# Collapsible

Status: **decided** (#163), implemented in `packages/ui/src/collapsible/` (shared with Accordion:
`internal/details-summary.ts`). History and the test plan: `design/CHANGELOG.md`.
Follows `design/conventions.md`; where this document and the conventions disagree, the
conventions win.

Inputs: `docs/vision.md`, `design/conventions.md`, `design/components/accordion.md` (the
`<details>` base this component reuses), `docs/research/modern-platform-survey.md`
(details/summary, `::details-content`, `:open`, find-in-page, `interpolate-size`), prior art
(Radix and Base UI `Collapsible`, Headless UI `Disclosure`, React Aria `Disclosure`), notes in
`memo/architect/collapsible-notes.md`.

Collapsible is one disclosure on its own: an Accordion item without the Accordion. Every rule
that Accordion already has for a `<details>` applies unchanged; this document states the
Collapsible's own surface and names the Accordion section for the rest.

## Summary

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Primitive | `<details>` / `<summary>`. `Collapsible.Root` **is** the `<details>` and owns the state, `Collapsible.Trigger` is the `<summary>`, `Collapsible.Panel` a `<div>` inside. Three parts, no wrapper element. |
| 2 | State | One boolean: `open` / `defaultOpen` / `openChangeAction(next, details)`. Single-valued, no reducer, latest dispatch wins (as Toggle). |
| 3 | Two modes, one anatomy | **JS-free mode** (Root has none of `open`, `defaultOpen`, `openChangeAction`): the browser owns `open`, nothing runs on toggle. **Library mode** (any of the three): the summary click is intercepted, `open` follows committed state inside a transition, `data-open` is optimistic, the action is awaited. Same selection rule as Popover and Dialog (conventions 3.9.11), without `onOpenChange`. |
| 4 | No `onOpenChange` | Every way a `<details>` changes is one the library can roll back, so every change is a request (conventions 2.1). The browser's own changes (find-in-page, a click before hydration) go to `openChangeAction` with `reason: "platform"`. |
| 5 | Pending UI | Root and Trigger: `data-open` (optimistic) and `data-pending`. The `open` attribute, `:open`, `::details-content` and the Panel follow committed state. |
| 6 | Animation | CSS on `::details-content` in both modes; `transition` (`<ViewTransition>`) on Root, Trigger and Panel in library mode; `experimental_interpolateSize` on Root. No `keepMounted`. All as Accordion 8. |
| 7 | Keyboard | Native: Enter and Space on the summary. Nothing added. |
| 8 | RSC | All three parts are `"use client"` files. JS-free mode runs no behaviour JS and works before and without hydration (conventions 7.3). |

---

## 1. Anatomy

```tsx
import { Collapsible } from "@funstack/ui/collapsible";

<Collapsible.Root>            {/* details; owns state and the transition */}
  <Collapsible.Trigger>       {/* summary; MUST be the first child of Root */}
    Advanced options
  </Collapsible.Trigger>
  <Collapsible.Panel>         {/* div; the content region */}
    …
  </Collapsible.Panel>
</Collapsible.Root>
```

| Part | Element | Role (native) | Library state rendered |
| --- | --- | --- | --- |
| `Root` | `details` | `group` | `data-open` (optimistic), `data-pending`, `data-disabled`; `open` attribute (committed in library mode, initial only in JS-free mode) |
| `Trigger` | `summary` | disclosure button (expanded state derived from `details.open`) | `data-open` (optimistic), `data-pending`, `data-disabled`, `aria-disabled` |
| `Panel` | `div` | none | `data-disabled` |

- **`Root` is the `<details>`.** Accordion needs a `div` Root above its Items for the open set
  and arrow keys; a single disclosure has neither, so a wrapper would be an element the consumer
  did not ask for (conventions 1.1).
- **`Panel`, not `Content`**: the conventions' name for a content region whose visibility is
  library state, and the name Accordion uses. It exists for the same reasons as
  `Accordion.Panel`: committed `open` in its function props (lazy content, section 4.3), a place
  for the `<ViewTransition>`, and a real element to style.
- **The Trigger must be the first child of the Root**, and there is one Trigger. This is the
  cost of the `<details>` base: a trigger placed after the content, in a separate header row
  next to other controls, or outside the Root is not possible. A control elsewhere drives the
  Collapsible through controlled `open` (section 9.4); it is then a plain button of the
  consumer's, with its own `aria-expanded` and `aria-controls` if it needs them.
- A heading goes **inside** the Trigger (`<summary><h3>…</h3></summary>`), as in Accordion; it
  is optional here.

Element constraints for `render`: Root must render a `<details>` and Trigger a `<summary>`;
the library warns in development when the mounted element's `tagName` differs
(`internal/use-element-check.ts`).

---

## 2. The two modes

| | JS-free mode | Library mode |
| --- | --- | --- |
| Selected when | Root has none of `open`, `defaultOpen`, `openChangeAction` | Root has any of them (`defaultOpen={false}` included) |
| `open` owner | Browser | React committed state |
| Summary click | Native activation | `preventDefault`; dispatch inside the Root's transition |
| Initial state | closed | `defaultOpen` / `open` |
| `data-open`, `data-pending`, `state.open` | never emitted, `undefined` (use `:open`) | emitted |
| `openChangeAction` | n/a | awaited; may be a Server Function |
| Works before hydration | yes | yes, natively; reconciled at mount (2.2) |
| `transition` | accepted, does nothing (dev warning) | yes |

Switching modes after mount is unsupported (dev warning); the Root keeps the mode it mounted
with.

### 2.1 JS-free mode

```tsx
<Collapsible.Root className="more">
  <Collapsible.Trigger>Shipping details</Collapsible.Trigger>
  <Collapsible.Panel>We ship worldwide.</Collapsible.Panel>
</Collapsible.Root>
```

renders

```html
<details class="more">
  <summary>Shipping details</summary>
  <div>We ship worldwide.</div>
</details>
```

The browser handles click, Enter, Space, find-in-page, `::details-content` and `:open`. The one
JS behaviour left after hydration is `disabled` (section 6).

**A Collapsible that starts open is in library mode.** `defaultOpen` selects library mode, so
`<Collapsible.Root defaultOpen>` server-renders `<details open>`, toggles natively before and
without hydration, and after hydration runs the toggle through the Root's transition with no
action to wait for (the commit is immediate). What the consumer sees differs from JS-free mode
only by the extra hooks (`data-open`, `state.open`, `transition`). Trade-off: this differs from
`Accordion.Item`, whose `defaultOpen` is the JS-free spelling and whose library-mode initial
state is the Root's `defaultValue`. Collapsible has one element and one prop for both, and
follows the overlay Roots, where `defaultOpen` also selects library mode. The alternative
(`defaultOpen` alone stays JS-free) leaves no way to write an uncontrolled library-mode
Collapsible without an action, which lazy content needs (section 4.3).

### 2.2 Library mode

The Root runs on `useControllableAction` (`internal/action/use-controllable-action.ts`,
conventions 3.4) with `controlled: open`, `defaultValue: defaultOpen ?? false`,
`action: openChangeAction` and no reducer.

```tsx
// Uncontrolled, no action: transitions, optimistic hooks, lazy content.
<Collapsible.Root defaultOpen={false}>

// Uncontrolled, async: the panel opens when the action resolves.
<Collapsible.Root openChangeAction={async (open) => { await savePreference("filters", open); }}>

// Controlled, local state: sync prefix, a Transition update.
<Collapsible.Root open={open} openChangeAction={setOpen}>

// Controlled, server-backed: update on success, re-wrapped after the await.
<Collapsible.Root
  open={open}
  openChangeAction={async (next) => {
    await save(next);
    startTransition(() => setOpen(next)); // required after an await
  }}
>
```

**The click.** Exactly Accordion 2.2: one `click` handler on the `<summary>` covers mouse,
touch, Enter and Space. A click on an interactive element nested in the summary does not toggle
(the same nested-interactive rule); otherwise the handler calls `preventDefault()` and, unless
disabled, dispatches `!optimistic` with `reason: "activate"`. `next` is computed from the
**optimistic** value, so a second click while pending reverses the first.

**What the user sees while an open is pending:**

| Surface | Reads | During pending |
| --- | --- | --- |
| Root and Trigger `data-open`, `state.open` | optimistic | present |
| Root and Trigger `data-pending`, `state.pending` | the Root's transition | present |
| Root `open` attribute, `:open`, `::details-content`, the native marker | committed | unchanged (closed) |
| Panel `state.open`, visibility | committed | unchanged (closed) |
| AT expanded state (from `details.open`) | committed | unchanged |

Triggers render optimistic state, content regions committed state (conventions 3.2). `pending`
is the Root's own transition on both Root and Trigger: the Root is the owner and the Trigger is
always the part the user acted on (conventions 4.3). After "open, then close before the first
settles" the optimistic value equals the committed one and `data-pending` stays until both
actions have settled.

**Platform-initiated changes.** Accordion 2.3 for one element. The browser changes
`details.open` without a click the library intercepted in three cases: find-in-page or a text
fragment matching closed content, a click before hydration, and a consumer's DOM write.

- The Root listens to `toggle`. If `details.open` equals the **known value** (the last `open`
  the library wrote to the element or read from it; Accordion 2.3, conventions 3.5) it is the
  library's own write echoing back. Otherwise it is a platform change: the Root records it as
  the known value and, unless it equals the intended (last dispatched) value, dispatches
  `details.open` with `reason: "platform"` and the `toggle` event. So a browser re-open while a
  close is pending (the element was closed by a script, then revealed by find-in-page) is
  dispatched, although the DOM is back at the committed value. Read `details.open`, never
  `ToggleEvent.newState` (`toggle` is coalesced).
- **Mount reconciliation**: a Root layout effect at mount, and again when an `<Activity>`
  re-shows the Root, compares `details.open` with the committed value and, if they differ,
  dispatches once with `reason: "platform"` and `event: undefined`. The value read becomes the
  known value. The `<details>` carries
  `suppressHydrationWarning` in both modes.
- Once the Root is no longer pending, a layout effect re-applies the committed value to
  `details.open` (a recorded write). So the content the browser revealed stays visible while the action runs; a
  controlled parent that does not adopt it closes it again when the transition ends. A rejection
  of the latest dispatch goes to the Error Boundary (which replaces the Root); a superseded
  rejection goes to `reportError` and the DOM follows the later dispatch.

These are requests, not facts: the DOM is the optimistic state and restoring it is cheap
(conventions 2.1, 3.5 "residual browser paths"). The Collapsible therefore has **no
`onOpenChange`**, and conventions 3.9 (overlay open state) does not apply to it: nothing in
the top layer, no dismissal, no light dismiss.

---

## 3. Props

### 3.1 `Collapsible.Root`

```ts
export interface CollapsibleRootProps
  extends Omit<
    ComponentPropsWithRef<"details">,
    "open" | "name" | "onToggle" | "className" | "style" | "children"
  > {
  /** Controlled open state. Selects library mode. */
  open?: boolean;
  /** Initial open state, uncontrolled. Selects library mode, `false` included. */
  defaultOpen?: boolean;
  /** A request to open or close: run in the Root's transition and awaited. Selects library mode. */
  openChangeAction?: ChangeAction<boolean, CollapsibleOpenChangeDetails>;
  /** The Trigger renders `aria-disabled` and never toggles. */
  disabled?: boolean;
  /** Renders `interpolate-size: allow-keywords` on the `<details>` so `::details-content` can animate to `height: auto`. Chromium only today. */
  experimental_interpolateSize?: boolean;
  /** Library mode only. Forwarded to `<ViewTransition default>` around the `<details>`. */
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, CollapsibleRootState>;
  style?: StateValue<CSSProperties | undefined, CollapsibleRootState>;
  children?: StateValue<ReactNode, CollapsibleRootState>;
  /** Must render a `<details>` element. */
  render?: RenderProp<ComponentPropsWithRef<"details">, CollapsibleRootState>;
}

export interface CollapsibleRootState {
  /** Optimistic open state. `undefined` in JS-free mode (browser-owned, unknown to React). */
  readonly open: boolean | undefined;
  readonly pending: boolean;
  readonly disabled: boolean;
}

export interface CollapsibleOpenChangeDetails extends ActionDetails {
  /** "activate": the user activated the Trigger. "platform": the browser changed `open` (find-in-page, a click before hydration; `event` is the `toggle` event, or `undefined` at mount). */
  readonly reason: ChangeReason;
}
```

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `open` | `boolean` | none | Controlled. `undefined` means uncontrolled. |
| `defaultOpen` | `boolean` | none (JS-free mode) | Read once. Its presence selects library mode; library mode without it starts as `false`. |
| `openChangeAction` | `ChangeAction<boolean, CollapsibleOpenChangeDetails>` | none | Requests only; there are no facts (2.2). |
| `disabled` | `boolean` | `false` | Section 6. |
| `experimental_interpolateSize` | `boolean` | `false` | Section 8.2. Both modes. |
| `transition` | `ViewTransitionClass` | none | Section 8.3. Static. |

`open`, `name` and `onToggle` are owned by the library (conventions 1.5): `open` is the
controlled prop, `onToggle` is the platform path, and `name` would be a second, platform-level
writer of `open`. An exclusive group of disclosures is an `Accordion.Root exclusive`.

### 3.2 `Collapsible.Trigger`

```ts
export interface CollapsibleTriggerProps
  extends Omit<ComponentPropsWithRef<"summary">, "onClick" | "className" | "style" | "children"> {
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, CollapsibleTriggerState>;
  style?: StateValue<CSSProperties | undefined, CollapsibleTriggerState>;
  /** Rendered from optimistic state; must not suspend. */
  children?: StateValue<ReactNode, CollapsibleTriggerState>;
  /** Must render a `<summary>` element. */
  render?: RenderProp<ComponentPropsWithRef<"summary">, CollapsibleTriggerState>;
}

export type CollapsibleTriggerState = CollapsibleRootState; // the trigger is the Root's control
```

No `disabled` on the Trigger: the Root carries it.

### 3.3 `Collapsible.Panel`

```ts
export interface CollapsiblePanelProps
  extends Omit<ComponentPropsWithRef<"div">, "className" | "style" | "children"> {
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, CollapsiblePanelState>;
  style?: StateValue<CSSProperties | undefined, CollapsiblePanelState>;
  children?: StateValue<ReactNode, CollapsiblePanelState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, CollapsiblePanelState>;
}

export interface CollapsiblePanelState {
  /** Committed open state. `undefined` in JS-free mode. */
  readonly open: boolean | undefined;
  readonly disabled: boolean;
}
```

The Panel has no `pending` (conventions 4.3) and no `data-open`: its visibility is the Root's
`open` attribute, selectable as `details:open > .panel` in both modes.

---

## 4. State model

| State | Owner | Library-owned or browser-owned | Where it shows |
| --- | --- | --- | --- |
| `open` | Root | **Library-owned** in library mode; **browser-owned** (`details.open`) in JS-free mode | committed: `open` attribute, Panel state; optimistic: Root and Trigger `data-open` |
| `pending` | Root `useTransition` | library | `data-pending` on Root and Trigger |
| `disabled` | Root prop | library (prop) | `data-disabled` on all parts, `aria-disabled` on Trigger |

### 4.1 Overlap

Single-valued state without a reducer (conventions 3.3): the optimistic value is the latest
dispatched `next`, and in uncontrolled mode only the latest dispatch commits. Click (open),
click again before the first settles (close): the action was called with `true`, then `false`;
the Collapsible ends closed whatever order they resolve in. Consumers whose stale call must be
harmless make the action idempotent (conventions 2.5).

### 4.2 Error, rollback, veto

As the conventions say (2.4): the latest dispatch's rejection reaches the Error Boundary nearest
the Root, a superseded one goes to `reportError`; optimistic state reverts; uncontrolled
committed state was never written. The `open` attribute never changed for a click, so there is
no DOM to roll back. The one DOM-side rollback is the platform path (2.2). A controlled parent
that does not adopt is the same snap-back without an error.

### 4.3 Content and Suspense

Accordion 4.4 applies whole. **Panel children are always mounted**: closed `<details>` content
stays in the DOM under `content-visibility: hidden`, server-rendered, indexable, and opened by
the browser on a find-in-page match. That is the searchability `hidden="until-found"` gives a
plain element; `<details>` has it natively, so there is **no `keepMounted` prop** and
`tabs/use-until-found.ts` is not used.

Lazy, suspending content is the Panel's function form on committed state, in library mode:

```tsx
<Collapsible.Root defaultOpen={false}>
  <Collapsible.Trigger>Comments</Collapsible.Trigger>
  <Collapsible.Panel>{({ open }) => open && <Comments postId={id} />}</Collapsible.Panel>
</Collapsible.Root>
```

Click → optimistic `data-open` on the Trigger → committed `open` flips inside the transition →
`<Comments>` suspends → the `<details>` stays closed and Root and Trigger stay `data-pending`
until the data arrives, then `open` and the content commit in one paint. A `<Suspense>` inside
the Panel shows its fallback at once instead (the consumer's choice, conventions 6). Lazy
content is not in the HTML and not searchable until opened.

---

## 5. Keyboard and focus

| Key | Behaviour | Who |
| --- | --- | --- |
| Enter, Space on Trigger | toggle (JS-free: native; library: the synthesized click is intercepted) | browser |
| Tab / Shift+Tab | the Trigger is a Tab stop; closed content is skipped by the browser | browser |

The library adds no key handling and never moves focus on open or close. A disabled Trigger
stays focusable.

---

## 6. `disabled`

Accordion 6 with the prop on the Root: the Trigger renders `aria-disabled="true"` and
`data-disabled`, Root and Panel render `data-disabled`, and the Trigger's click handler calls
`preventDefault()` without dispatching. In JS-free mode this is the one behaviour that needs
hydration (a disabled Collapsible can be toggled before it, or with JS off). In library mode a
platform-initiated change of a disabled Collapsible is not dispatched and is undone when
nothing is in flight.

---

## 7. Accessibility

- Native semantics only: `<details>` is a `group`, `<summary>` the engine's disclosure control
  with its expanded state from `open`. No `id` wiring, no `aria-controls`, no `useId`. The only
  ARIA the library writes is `aria-disabled`.
- **Optimistic state is visual only.** ARIA in HTML forbids `aria-expanded` on a summary, so
  assistive technology hears the committed state (conventions 3.2). During a slow action the
  user hears nothing until the content lands; a consumer who needs an audible pending state
  renders a live region from the Trigger's `children` function.
- The accessible name is the Trigger's content. Keep it stable across states where possible; a
  label that changes ("Show more" / "Show less") is announced through the name, on top of the
  expanded state.
- Reduced motion: every CSS example below carries the `prefers-reduced-motion` block.

---

## 8. Styling and animation

The library ships no CSS. The hooks, with `.c` on the Root:

```css
.c > summary { list-style: none; cursor: pointer; }   /* hides the UA marker */
.c > summary::-webkit-details-marker { display: none; }
.c > summary::after { content: "▸"; }
.c:open > summary::after { content: "▾"; }             /* committed, both modes */

/* library mode: optimistic and pending */
.c:open > summary:not([data-pending])::after,
.c > summary[data-open]::after { content: "▾"; }
.c > summary[data-pending] { cursor: progress; }
.c > summary[data-disabled] { color: GrayText; }
```

### 8.1 Open/close animation in CSS (both modes)

Accordion 8.1, with the Root as the `<details>`:

```css
.c::details-content {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 200ms ease, content-visibility 200ms allow-discrete;
}
.c:open::details-content { grid-template-rows: 1fr; }
.c > .panel { min-height: 0; overflow: hidden; }

@media (prefers-reduced-motion: reduce) {
  .c::details-content { transition: none; }
}
```

It runs whoever flipped `open`, the browser or React.

### 8.2 `experimental_interpolateSize`

```tsx
<Collapsible.Root experimental_interpolateSize>
```

renders `style="interpolate-size: allow-keywords"` on the `<details>` (merged with the
consumer's `style`, consumer wins). `::details-content` inherits it from its originating
element, so it can transition `height` to `auto`:

```css
.c::details-content { height: 0; overflow: hidden; transition: height 200ms, content-visibility 200ms allow-discrete; }
.c:open::details-content { height: auto; }
```

Chromium only; elsewhere the height jumps. Same flag, same name and same meaning as on
`Accordion.Root` (conventions 8).

### 8.3 `transition` (ViewTransition, library mode only)

Root, Trigger and Panel each render `<ViewTransition default={transition}>` as the outermost
node **only when `transition` is given** (conventions 5.1, `internal/transition-boundary.tsx`).
Transition types: `fsui-collapsible`, plus `fsui-collapsible-expand` or
`fsui-collapsible-collapse` (the change names Accordion uses).

Accordion 8.3 applies: only the settling commit animates (the `open` attribute flip, the Panel
content that mounts in it); the optimistic `data-open` flip is a CSS transition. `transition`
on the Root animates the box of the `<details>` as a whole. Content after the Collapsible is
outside the library: it jumps unless the consumer gives it a `<ViewTransition>` of its own.
Do not combine `transition` on the Root with a
`::details-content` transition for the same change. In JS-free mode the prop is accepted and
does nothing, with a dev warning.

---

## 9. Call-site examples

### 9.1 Server Component, JS-free

```tsx
// A Server Component. No behaviour JS runs for the toggle; the parts hydrate as client components.
import { Collapsible } from "@funstack/ui/collapsible";

export function Spoiler({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Collapsible.Root className="spoiler">
      <Collapsible.Trigger>{title}</Collapsible.Trigger>
      <Collapsible.Panel>{children}</Collapsible.Panel>
    </Collapsible.Root>
  );
}
```

Function-valued `className` / `style` / `children` / `render` cannot be passed from a Server
Component; use plain values and `:open` there.

### 9.2 Server Component, a remembered preference

```tsx
import { rememberOpen } from "./actions"; // "use server"; (key, next, details) => Promise<void>

<Collapsible.Root defaultOpen={prefs.filtersOpen} openChangeAction={rememberOpen.bind(null, "filters")}>
  <Collapsible.Trigger>Filters</Collapsible.Trigger>
  <Collapsible.Panel><Filters /></Collapsible.Panel>
</Collapsible.Root>
```

Every toggle waits for the round trip, with `data-pending` on the Trigger meanwhile. For a
toggle that should not wait, pass a client function that calls the Server Function without
returning its promise.

### 9.3 Client Component, lazy content and a changing label

```tsx
"use client";
import { Collapsible } from "@funstack/ui/collapsible";

export function Replies({ threadId, count }: { threadId: string; count: number }) {
  return (
    <Collapsible.Root defaultOpen={false} transition="fsui-grow">
      <Collapsible.Trigger className="data-pending:animate-pulse">
        {({ open }) => (open ? "Hide replies" : `Show ${count} replies`)}
      </Collapsible.Trigger>
      <Collapsible.Panel>{({ open }) => open && <ReplyList threadId={threadId} />}</Collapsible.Panel>
    </Collapsible.Root>
  );
}
```

`ReplyList` reads a cached promise with `use()`; the Trigger pulses until the replies are
ready, then the box grows. No Suspense fallback flashes because the update is a transition.

### 9.4 Controlled from elsewhere

```tsx
"use client";
const [open, setOpen] = useState(false);

<Button action={() => setOpen(true)}>Show details</Button>

<Collapsible.Root open={open} openChangeAction={setOpen}>
  <Collapsible.Trigger>Details</Collapsible.Trigger>
  <Collapsible.Panel>…</Collapsible.Panel>
</Collapsible.Root>
```

One setter serves both: the Trigger's click and a find-in-page reveal arrive through
`openChangeAction`, and `Button`'s action is already a transition.
