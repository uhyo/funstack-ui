# Accordion

Status: **proposed** (2026-10-15, GitHub issue #8). Follows `design/conventions.md` (accepted).
Deviations from it are listed in "Conventions feedback" at the end.

Inputs: `docs/vision.md`, `design/conventions.md`, `docs/research/react-async-apis.md`,
`docs/research/modern-platform-survey.md` (details/summary, `name`, `::details-content`, `:open`,
find-in-page, `interpolate-size`, `@starting-style`), probes in `memo/architect/accordion-notes.md`.

## Summary

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Primitive | `<details>`/`<summary>`. `Accordion.Item` is the `<details>`, `Accordion.Trigger` the `<summary>`, `Accordion.Panel` a `<div>` inside. No `Header` part: a heading goes *inside* the Trigger (`<summary><h3>`), the only valid place. |
| 2 | Two modes, one anatomy | **JS-free mode** (Root has none of `value`/`defaultValue`/`valueChangeAction`): the browser owns `open`, no handler runs on toggle, `exclusive` renders `name`. **Library mode** (any of the three present): the library intercepts the summary click (`preventDefault`), `open` is driven by React committed state inside a transition, triggers render optimistic `data-open`, `valueChangeAction` is awaited. |
| 3 | Value type | Discriminated on `exclusive`: `exclusive` → `string \| null`; otherwise `string[]`. |
| 4 | Pending UI | Trigger and Item: `data-open` (optimistic) and `data-pending`. The `<details open>` attribute, `:open`, `::details-content` and the native marker follow committed state. Consumers draw their own chevron from `data-open`. |
| 5 | Platform-initiated opens | Find-in-page and text fragments open a closed `<details>` natively in all engines. Library mode listens to `toggle`, dispatches `valueChangeAction` with `reason: "platform"`, and re-applies committed state to the DOM once the action settles. No `hidden="until-found"` needed. |
| 6 | Animation | CSS on `::details-content` (`@starting-style`, `transition-behavior: allow-discrete`, grid-rows or `interpolate-size`) in both modes. `transition` prop (`<ViewTransition>`) on Item, Trigger and Panel in library mode for layout/cross-fade of the whole list; not both on the same change. `experimental_interpolateSize` on Root. |
| 7 | Keyboard | Enter/Space native on `<summary>`. Up/Down/Home/End between triggers is implemented by Root in both modes (APG: optional; we ship it). No `focusgroup` flag (it would collapse the Tab stops). |
| 8 | RSC | All four parts are `"use client"` files (Flight cannot read context in a Server Component, see notes). A Server Component renders them freely; JS-free mode needs no interaction JS, works before hydration and with JS off, but the parts' code is in the client bundle. This contradicts the conventions' sketch of a directive-free `accordion-static.tsx`; escalated. |

---

## 1. Anatomy

```tsx
import { Accordion } from "@funstack/ui/accordion";

<Accordion.Root>                       {/* div; owns state, context, keyboard navigation */}
  <Accordion.Item value="shipping">    {/* details */}
    <Accordion.Trigger>               {/* summary; MUST be the first child of Item */}
      <h3>Shipping</h3>
    </Accordion.Trigger>
    <Accordion.Panel>                 {/* div; the content region */}
      We ship worldwide.
    </Accordion.Panel>
  </Accordion.Item>
</Accordion.Root>
```

| Part | Element | Role (native) | Library state rendered |
| --- | --- | --- | --- |
| `Root` | `div` | none | `data-pending`, `data-disabled` |
| `Item` | `details` | `group` | `data-open` (optimistic), `data-pending`, `data-disabled`; `open` attribute (committed, library mode) |
| `Trigger` | `summary` | disclosure button (engine-specific role; expanded state derived from `details.open`) | `data-open` (optimistic), `data-pending`, `data-disabled`, `aria-disabled` |
| `Panel` | `div` | none | `data-disabled` |

Why these four and not more:

- **`Panel` exists** even though `<details>` would accept bare content after the summary. It is
  the content region of the state model (committed `open` in its function props, which is how a
  consumer mounts content lazily, section 4.4), it carries the `<ViewTransition>` for content
  changes, and it is the element consumers style; `::details-content` is a pseudo-element with
  engine quirks (Safari cannot chain pseudo-elements after it).
- **No `Header` part.** The APG wants `<h3><button>`; with `<details>` the button is the
  `<summary>`, and `<summary>` must be the first child of `<details>`, so the only valid nesting is
  the heading *inside* the summary (`<summary><h3>…</h3></summary>`, allowed by the content model:
  phrasing content or one heading). A part that renders `<h3>` inside the summary would be a plain
  element with a long name. The Trigger docs recommend the heading; see section 7 for how AT
  exposes it.
- **`Root` renders a `div`** (not nothing): keyboard navigation and `interpolate-size`
  inheritance need an element, and consumers always want a wrapper to style anyway.

Element constraints for `render`: Item must render a `<details>` and Trigger a `<summary>`; any
other element breaks the platform semantics. The element form is accepted (so a consumer can pass
`<details className="card">`), the function form receives props to spread; the library warns in
development when the mounted element's `tagName` is not `DETAILS` / `SUMMARY`.

---

## 2. The two modes

The central tension: `<details>` toggles itself (browser-owned `open`), while the library wants
state changes to be transitions with optimistic feedback (library-owned). One anatomy, two modes,
chosen by the Root's props:

| | JS-free mode | Library mode |
| --- | --- | --- |
| Selected when | Root has none of `value`, `defaultValue`, `valueChangeAction` | Root has any of them |
| `open` owner | Browser | React committed state |
| Summary click | Native activation | `preventDefault`; dispatch inside the Root's transition |
| Initial open | `<Accordion.Item defaultOpen>` → `open` attribute | `defaultValue` / `value` on Root |
| Exclusivity | `exclusive` → `name` attribute on each `<details>` | `exclusive` → library computes a single value; **no `name`** (one writer only) |
| `data-open`, `data-pending` | never emitted (use `:open`) | emitted |
| `valueChangeAction` | n/a | awaited; may be a Server Function |
| Works before hydration | yes | yes, natively; the library reconciles on mount (2.3) |
| Transition / ViewTransition | none (browser performs the toggle) | yes |

Switching modes after mount is unsupported (dev warning), like controlled/uncontrolled.

### 2.1 JS-free mode

The parts render markup and nothing else runs on toggle. The browser handles click, Enter, Space,
`name` exclusivity, find-in-page, `::details-content`, `:open`.

```tsx
<Accordion.Root exclusive>
  <Accordion.Item value="a" defaultOpen>
    <Accordion.Trigger><h3>What is FUNSTACK?</h3></Accordion.Trigger>
    <Accordion.Panel>A family of libraries.</Accordion.Panel>
  </Accordion.Item>
  <Accordion.Item value="b">
    <Accordion.Trigger><h3>Is it free?</h3></Accordion.Trigger>
    <Accordion.Panel>Yes.</Accordion.Panel>
  </Accordion.Item>
</Accordion.Root>
```

renders

```html
<div>
  <details name="_r_1_" open>
    <summary><h3>What is FUNSTACK?</h3></summary>
    <div>A family of libraries.</div>
  </details>
  <details name="_r_1_">
    <summary><h3>Is it free?</h3></summary>
    <div>Yes.</div>
  </details>
</div>
```

What still runs JS in this mode, after hydration: `disabled` (a `preventDefault` on the summary
click, section 6) and arrow-key navigation (section 7). Neither changes state.

`exclusive` here is the platform's exclusive group. Trade-off (from the survey): single-open
accordions make the user lose context when another panel closes, and the APG does not require
exclusivity, so it is opt-in. A second, platform-level caveat: when several `<details>` in one
`name` group carry `open` in the HTML, the browser keeps only the first in source order.

### 2.2 Library mode

Any of `value`, `defaultValue`, `valueChangeAction` on Root turns the Accordion into a normal
FUNSTACK state owner: `useControllableAction` from the conventions with a set-valued reducer.

```tsx
// Uncontrolled, async: the panel opens when the action resolves.
<Accordion.Root defaultValue={[]} valueChangeAction={async (next) => { await savePrefs(next); }}>

// Controlled, local state: sync prefix, a Transition update.
<Accordion.Root exclusive value={open} valueChangeAction={(next) => { setOpen(next); }}>

// Controlled, server-backed: update on success, re-wrapped after the await.
<Accordion.Root
  exclusive
  value={open}
  valueChangeAction={async (next) => {
    await save(next);
    startTransition(() => setOpen(next)); // required after an await
  }}
>
```

How the click is intercepted. The `<summary>` activation behaviour (toggle `open`) runs after the
`click` event finishes dispatching and only if the event was not cancelled. Enter and Space on a
focused summary synthesize that same `click`. So one handler covers mouse, touch and keyboard, in
all three engines and in jsdom (verified):

```tsx
// inside AccordionTrigger (library mode)
onClick={(event) => {
  if (isNestedInteractive(event)) return;      // a link inside the summary: native rule, no toggle
  event.preventDefault();                       // the browser does not touch `open`
  if (disabled) return;
  item.dispatch(!item.optimisticOpen, { event: event.nativeEvent, reason: "trigger" });
}}
```

and the Root's dispatch is the conventions' shape:

```ts
startOwnTransition(async () => {
  addTransitionType("fsui-accordion");
  addTransitionType(open ? "fsui-accordion-expand" : "fsui-accordion-collapse");
  setOptimistic({ value: item, open });         // reducer: add/remove, or replace when exclusive
  await valueChangeAction?.(next, details);
  if (!isControlled && id === latest.current) startTransition(() => setInternal(next));
});
```

`next` is computed from the **optimistic** set, not the committed one: opening B while A is
optimistically open means "both open" in multiple mode and "B" in exclusive mode. That is what the
user sees and intends.

What the user sees while the action is pending (the precise answer the issue asks for):

| Surface | Reads | During pending (opening "a") |
| --- | --- | --- |
| `Trigger` `data-open`, `data-pending`, `state.open` | optimistic | present |
| `Item` `data-open`, `data-pending`, `state.open` | optimistic | present |
| `Item` `open` attribute, `:open`, `::details-content`, native `::marker` triangle | committed | unchanged (closed) |
| `Panel` `state.open`, visibility | committed | unchanged (closed) |
| AT expanded state (from `details.open`) | committed | unchanged |
| `Root` `data-pending` | transition | present |

So a consumer who styles the triangle with the UA marker sees it flip only on commit; a consumer
who hides the marker and draws a chevron from `[data-open]` (the documented way, section 8) gets
immediate feedback, plus a `[data-pending]` spinner if they want one. Content never appears before
the action resolves and its render commits. This is the same split as Tabs ("triggers optimistic,
content committed") and for the same reason: committed state is what may suspend.

The `open` attribute is written by React (`<details open={committedOpen}>`). React compares with
its previous *prop*, not the DOM, which matters in 2.3.

### 2.3 Platform-initiated changes in library mode

Three things change `details.open` without a click the library intercepted:

1. **Find-in-page / text fragments.** All three engines open a closed `<details>` whose content
   matches (Firefox before 148 and Safari 26.2 do not scroll to the match). No `hidden="until-found"`
   and no `beforematch` are involved for `<details>`; the browser flips `open` and fires `toggle`.
2. **Clicks before hydration.** SSR output is a working `<details>`; a click before React attaches
   handlers toggles natively.
3. **Consumer DOM access** (`ref.current.open = true`). Unsupported but handled the same way.

Handling, in `Item`:

```tsx
<details
  open={committedOpen}
  onToggle={(event) => {
    const el = event.currentTarget;
    if (el.open === committedOpen) return;                 // our own commit echoing back
    root.dispatchFromDom({ event: event.nativeEvent, reason: "platform", item: value, open: el.open });
  }}
/>
```

`dispatchFromDom` recomputes `next` from the DOM state of every registered item. Exclusive mode
takes the toggled item if it is now open, else the first open item in document order (so a
find-in-page reveal wins over an item that was already open; walkthrough 9.6). It skips the
dispatch if `next` already equals the optimistic value, and otherwise runs the normal dispatch
with `reason: "platform"`. A layout effect in Item
re-applies committed state once the Root is no longer pending:

```ts
useLayoutEffect(() => {
  if (!root.pending && ref.current && ref.current.open !== committedOpen) {
    ref.current.open = committedOpen;     // fires `toggle`; handler sees DOM === committed, no-op
  }
}, [committedOpen, root.pending]);
```

Observable behaviour: the content the browser revealed stays visible while the action runs
(the Trigger shows `data-pending`); if the parent accepts, the DOM already matches; if the parent
ignores or the action rejects, the panel closes again when the transition ends. This is the
conventions' browser-owned rule ("re-applied after the action resolves; it follows the browser, it
does not gate it") applied to the one browser-owned path that remains in library mode.

The same effect reconciles pre-hydration clicks on mount, so `valueChangeAction` can be called
once right after hydration with `reason: "platform"` and `details.event` being the `toggle` event
or `undefined` (mount reconciliation). Documented on the prop.

Read `details.open` in the handler, never `ToggleEvent.newState`: `toggle` is coalesced (two
flips in one task fire once with the final state) and jsdom dispatches a plain `Event`.

---

## 3. Props

### 3.1 `Accordion.Root`

```ts
interface AccordionRootBaseProps
  extends Omit<ComponentPropsWithRef<"div">, "onKeyDown" | "className" | "style" | "children"> {
  /** Disables every item. */
  disabled?: boolean;
  /** Renders `interpolate-size: allow-keywords` on the root so `::details-content` can animate to `height: auto`. Chromium only today. */
  experimental_interpolateSize?: boolean;
  className?: StateValue<string | undefined, AccordionRootState>;
  style?: StateValue<CSSProperties | undefined, AccordionRootState>;
  children?: StateValue<ReactNode, AccordionRootState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, AccordionRootState>;
}

interface AccordionRootMultipleProps extends AccordionRootBaseProps {
  exclusive?: false;
  value?: string[];
  defaultValue?: string[];
  valueChangeAction?: ChangeAction<string[], AccordionValueChangeDetails>;
}

interface AccordionRootExclusiveProps extends AccordionRootBaseProps {
  /** At most one item open. JS-free mode: `name` on each details. Library mode: value is a single id or null. */
  exclusive: true;
  value?: string | null;
  defaultValue?: string | null;
  valueChangeAction?: ChangeAction<string | null, AccordionValueChangeDetails>;
}

export type AccordionRootProps = AccordionRootMultipleProps | AccordionRootExclusiveProps;

export interface AccordionRootState {
  readonly pending: boolean;
  readonly disabled: boolean;
}

export interface AccordionValueChangeDetails extends ActionDetails {
  /** "trigger": the user activated a Trigger. "platform": the browser changed `open` (find-in-page, pre-hydration click). */
  readonly reason: "trigger" | "platform";
  /** The item whose open state changed. */
  readonly item: string;
  /** That item's new open state. */
  readonly open: boolean;
}
```

Value type decision. The alternative, `string[]` always with `exclusive` restricting the length,
is simpler internally (Base UI does this) but reads worse at the call site for the most common
accordion (a FAQ): `value={[open]}` / `value[0] ?? null`. The discriminated union costs one
internal normalisation (`string | null` ⇄ one-element array) and gives `useState<string | null>`
setters that plug straight into `valueChangeAction`. "None open" is `[]` or `null`, never
`undefined` (conventions 3.1).

### 3.2 `Accordion.Item`

```ts
export interface AccordionItemProps
  extends Omit<ComponentPropsWithRef<"details">, "open" | "name" | "onToggle" | "className" | "style" | "children"> {
  /** Identifies the item in `value`. Required in both modes for one markup shape. */
  value: string;
  /** JS-free mode only: initial `open` attribute. Ignored (dev warning) in library mode; use Root `defaultValue`. */
  defaultOpen?: boolean;
  disabled?: boolean;
  /** Library mode only. Forwarded to `<ViewTransition default>` around the details. */
  transition?: ViewTransitionProps["default"];
  className?: StateValue<string | undefined, AccordionItemState>;
  style?: StateValue<CSSProperties | undefined, AccordionItemState>;
  children?: StateValue<ReactNode, AccordionItemState>;
  render?: RenderProp<ComponentPropsWithRef<"details">, AccordionItemState>;
}

export interface AccordionItemState {
  readonly value: string;
  /** Optimistic open state. `undefined` in JS-free mode (browser-owned, unknown to React). */
  readonly open: boolean | undefined;
  readonly pending: boolean;
  readonly disabled: boolean;
}
```

`open`, `name` and `onToggle` are owned by the library in at least one mode, so they are removed
from the type in both (conventions 1.5). `defaultOpen` is the JS-free spelling of initial state
because `open` would read as controlled to a React developer.

### 3.3 `Accordion.Trigger`

```ts
export interface AccordionTriggerProps
  extends Omit<ComponentPropsWithRef<"summary">, "onClick" | "className" | "style" | "children"> {
  transition?: ViewTransitionProps["default"];
  className?: StateValue<string | undefined, AccordionTriggerState>;
  style?: StateValue<CSSProperties | undefined, AccordionTriggerState>;
  children?: StateValue<ReactNode, AccordionTriggerState>;
  render?: RenderProp<ComponentPropsWithRef<"summary">, AccordionTriggerState>;
}

export type AccordionTriggerState = AccordionItemState; // same object: the trigger is the item's control
```

No `disabled` on Trigger: an item is disabled, not its summary (Item or Root carry the prop).
Content rendered from `children(state)` must not suspend (conventions 3.2).

### 3.4 `Accordion.Panel`

```ts
export interface AccordionPanelProps
  extends Omit<ComponentPropsWithRef<"div">, "className" | "style" | "children"> {
  transition?: ViewTransitionProps["default"];
  className?: StateValue<string | undefined, AccordionPanelState>;
  style?: StateValue<CSSProperties | undefined, AccordionPanelState>;
  children?: StateValue<ReactNode, AccordionPanelState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, AccordionPanelState>;
}

export interface AccordionPanelState {
  readonly value: string;
  /** Committed open state. `undefined` in JS-free mode. */
  readonly open: boolean | undefined;
  readonly disabled: boolean;
}
```

Panel has no `pending` (conventions 4.3) and no `data-open`: its visibility is the parent's
`open` attribute, selectable as `details:open > .panel` in both modes.

---

## 4. State model

| State | Owner | Library-owned or browser-owned | Where it shows |
| --- | --- | --- | --- |
| `value` (set of open items) | Root | **Library-owned** in library mode; **browser-owned** (`details.open` per item) in JS-free mode | committed: `open` attribute, Panel state; optimistic: Trigger/Item `data-open` |
| `pending` | Root `useTransition` | library | `data-pending` on Root, on Items/Triggers whose optimistic open differs from committed |
| `disabled` | Root / Item prop | library (prop) | `data-disabled`, `aria-disabled` on Trigger |
| focus position | browser | browser | `:focus-visible` |

### 4.1 Reducer

`useOptimistic` in reducer form, keyed by item (conventions 3.4):

```ts
type Patch = { value: string; open: boolean };
function reduce(set: ReadonlySet<string>, patch: Patch, exclusive: boolean): ReadonlySet<string> {
  if (!patch.open) { const next = new Set(set); next.delete(patch.value); return next; }
  return exclusive ? new Set([patch.value]) : new Set(set).add(patch.value);
}
```

Stacked patches re-base onto a changed committed set. The order problem one might expect (A then
B dispatched, B commits first, A's older patch re-applies on top of B's commit) does not occur:
B's post-await commit is a transition update inside an async-action scope and is held until A
settles too (`react-async-apis.md` §2, entanglement case 2), so patches are reverted together.
Worth one browser check during implementation (`memo/architect/accordion-notes.md`).

### 4.2 Per-item pending

`item.pending = root.pending && item.optimisticOpen !== item.committedOpen`. Consequences:

- Opening A: A pending. Exclusive mode, A open, click B: A (closing) and B (opening) both pending.
- Click A to open, click A again before it resolves: optimistic equals committed, A is no longer
  pending though Root still is. Latest intent ("no change") wins when the second action commits.

### 4.3 Error, rollback, veto

Unchanged from the conventions: a rejected action reaches the Error Boundary nearest the Root;
optimistic state reverts; uncontrolled committed state was never written. In both cases the
`open` attribute never changed, so there is nothing to revert in the DOM. The one DOM-side
rollback is the platform path (2.3): a find-in-page open that the parent refuses is closed by the
layout effect when the transition ends.

### 4.4 Content and Suspense

`<details>` keeps closed content in the DOM (`::details-content` is `content-visibility: hidden`).
That is the point of the primitive: closed answers are server-rendered, indexable, and found by
find-in-page. So **Panel children are always mounted** and the library adds no `<Activity>` or
unmount prop in v0.

The Suspense-native path is the Panel's function form on committed state:

```tsx
<Accordion.Panel>{({ open }) => open && <Comments postId={id} />}</Accordion.Panel>
```

Click → optimistic `data-open` on the trigger → committed `open` flips inside the transition →
`<Comments>` mounts and suspends → because the update is a transition and the boundary above is
already revealed, React keeps the panel closed and the trigger `data-pending` until the data
arrives, then commits `open` and the content in one paint. A `<Suspense>` placed *inside* the
Panel shows its fallback immediately instead (the consumer's choice, conventions 6). The
trade-off of lazy mounting is explicit: that content is not in the HTML and not searchable until
opened.

---

## 5. Keyboard and focus

| Key | Behaviour | Who |
| --- | --- | --- |
| Enter, Space on Trigger | toggle (JS-free: native; library: synthesized click → intercepted) | browser |
| Tab / Shift+Tab | moves between triggers and any focusable content; every trigger is a Tab stop (APG) | browser |
| ArrowDown / ArrowUp | focus next / previous trigger in the same Root, wrapping; skips disabled triggers | Root |
| Home / End | first / last enabled trigger | Root |

Arrow navigation is optional in the APG; the library ships it because every prior-art accordion
does and consumers expect it. It is implemented once, on the Root's `div` `onKeyDown`, against a
registry of Trigger elements that Items register through context (sorted by
`compareDocumentPosition` on use, so wrappers between Root and Item and nested accordions are
fine; a nested Root stops propagation for the keys it handles). Vertical only in v0; an
`orientation` prop can be added when a horizontal accordion is designed.

`experimental_focusgroup` is **not** offered. `focusgroup` collapses its participants to a single
Tab stop with arrow keys inside, which is the Tabs/Toolbar model; the APG accordion wants each
header to be a Tab stop. The two are incompatible, so the flag has no correct meaning here.

Focus never moves on open/close. Disabled triggers stay focusable (`aria-disabled`), matching the
Tabs convention and keeping them perceivable to AT.

---

## 6. `disabled`

`<details>` and `<summary>` have no native `disabled`. The design:

- `Root disabled` or `Item disabled` → Trigger renders `aria-disabled="true"` (allowed on
  `<summary>` by ARIA in HTML) and `data-disabled`; Item and Panel render `data-disabled`.
- The Trigger's click handler calls `preventDefault()` and does not dispatch. This is the one JS
  behaviour that also runs in JS-free mode, and the one thing in JS-free mode that does not work
  before hydration or with JS off (a disabled item can then be toggled). Documented on the prop.
  Alternatives considered: `inert` (hides the header from AT, unacceptable), `tabindex="-1"` plus
  `pointer-events: none` (still toggles via focus from a nested element; not a real guard).
- In library mode the platform path (2.3) ignores a disabled item: a find-in-page reveal of a
  disabled item's content is re-closed when the transition ends, without dispatching.
  Trade-off accepted: the user searched for text they cannot open; the alternative (letting the
  browser override `disabled`) makes `disabled` meaningless.

---

## 7. Accessibility

- `<details>` → role `group`; `<summary>` → the engine's disclosure control with expanded/collapsed
  state derived from `open`. No ARIA is added except `aria-disabled` (section 6). No `id` wiring:
  the summary/content relationship is native, so the library does not need `aria-controls`,
  `aria-labelledby` or `useId` for the panel. `useId` is used only for the `name` group in
  JS-free exclusive mode.
- **Optimistic state is not exposed to AT.** ARIA in HTML forbids `aria-expanded` on a summary
  (allowed: global attributes, `aria-disabled`, `aria-haspopup`), so the trigger cannot announce
  the optimistic value the way Toggle's `aria-pressed` does. AT hears the committed state. For a
  fast action that is a non-issue; for a slow one the user hears nothing until the content lands,
  and `data-pending` styling is visual only. Consumers who need an audible pending state can add
  an `aria-live` region in the Trigger's `children` function. Deviation from conventions 3.2,
  forced by the platform; recorded in "Conventions feedback".
- **Heading inside the Trigger.** `<summary><h3>…</h3></summary>` is valid HTML. Exposure varies:
  VoiceOver exposes and navigates to the heading, JAWS historically did not (2018 test), and the
  2026 state is unverified. Because the disclosure semantics are native regardless, the heading is
  an enhancement for heading navigation, recommended in the docs, and must be checked with NVDA,
  JAWS and VoiceOver in the example app before the component leaves "proposed".
- `<details>` accepts no `role` override, so an APG "region" per panel is not available; the
  APG lists it as optional.
- Reduced motion: every CSS example below carries the `prefers-reduced-motion` block.

---

## 8. Styling and animation

The library ships no CSS. The hooks are, in both modes:

```css
.item { border-block-end: 1px solid var(--line); }
.trigger { list-style: none; cursor: pointer; }      /* hides the UA marker */
.trigger::-webkit-details-marker { display: none; }  /* older WebKit; harmless elsewhere */
.trigger::after { content: "▸"; }
.item:open > .trigger::after { content: "▾"; }       /* committed, both modes */
```

Library mode adds optimistic and pending hooks:

```css
.trigger[data-open]::after { content: "▾"; }         /* flips immediately on click */
.trigger[data-pending] { cursor: progress; }
.root[data-pending] .panel { opacity: 0.6; }
.trigger[data-disabled] { color: GrayText; }
```

### 8.1 Open/close animation in CSS (both modes)

```css
.item::details-content {
  display: grid;                       /* grid-rows trick: animates to the content's height */
  grid-template-rows: 0fr;
  transition: grid-template-rows 200ms ease, content-visibility 200ms allow-discrete;
}
.item:open::details-content { grid-template-rows: 1fr; }
.panel { min-height: 0; overflow: hidden; }   /* the grid item */

@media (prefers-reduced-motion: reduce) {
  .item::details-content { transition: none; }
}
```

This runs whether `open` was flipped by the browser (JS-free) or by React (library mode); CSS
does not care who set the attribute. `@starting-style` is not needed for the grid form because
the element is never inserted, only shown; it is needed if the consumer animates `opacity` from a
closed state on first open in the same way popovers do:

```css
.item::details-content { opacity: 1; transition: opacity 200ms, content-visibility 200ms allow-discrete; }
.item:not(:open)::details-content { opacity: 0; }
@starting-style { .item:open::details-content { opacity: 0; } }
```

Safari cannot chain pseudo-elements after `::details-content` (WebKit bug 283446), which is one
more reason the Panel is a real element.

### 8.2 `experimental_interpolateSize` (Root)

```tsx
<Accordion.Root experimental_interpolateSize>
```

renders `style="interpolate-size: allow-keywords"` on the Root `div` (merged with the consumer's
`style`, consumer wins on conflict). The property is inherited, so every `::details-content`
below can then transition `height` to `auto`:

```css
.item::details-content { height: 0; overflow: hidden; transition: height 200ms, content-visibility 200ms allow-discrete; }
.item:open::details-content { height: auto; }
```

Chromium only (Safari TP 254 has it, Firefox has a positive position and no implementation). In
other engines the declaration is ignored and the height jumps, so the flag is documented as
"Chromium-only polish; use the grid form above for a cross-engine animation". The flag is on Root
rather than Panel (where the conventions' table sketched it) because `::details-content` is a
pseudo-element of the `<details>`; a declaration on its child Panel can never reach it, and one
inherited declaration on the Root covers every item.

### 8.3 `transition` (ViewTransition, library mode only)

Item, Trigger and Panel each render `<ViewTransition default={transition ?? "none"}>` as the
outermost node of their output (so the Item's boundary wraps the `<details>`, the Trigger's wraps
the `<summary>`, the Panel's wraps its `<div>`; none of them adds DOM, so the summary stays the
first child of the details). Transition types per the conventions: `fsui-accordion`,
`fsui-accordion-expand`, `fsui-accordion-collapse`.

```tsx
<Accordion.Item value="a" transition="fsui-grow">
```

```css
::view-transition-group(.fsui-grow) { animation-duration: 200ms; }   /* size + position of the item box */
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; }
}
```

What `<ViewTransition>` adds over the CSS in 8.1, and when to use which:

- CSS on `::details-content` animates the **panel's own height** and runs in both modes. It is the
  default recommendation.
- `transition` on Items animates **each item's box as a whole**, so the items below the opening one
  slide instead of jumping, and (exclusive mode) the closing and opening items animate in the same
  snapshot. A rollback after a rejected action animates back through the same boundary. CSS cannot
  move siblings.
- Do not combine both for the same change: the ViewTransition snapshots the "new" state at the
  moment the attribute flips, which is the start of the CSS transition, so the panel would appear
  collapsed in the new snapshot and then pop. Either `::details-content` transitions **or**
  `transition` on the Item, per project.
- In JS-free mode the prop is accepted and does nothing (the browser performs the toggle outside
  any React transition, conventions 3.5); a dev warning says so.

Whether React fires `update` on a sibling Item's boundary purely because its position changed
("due to an immediate sibling" in the docs) is unverified; the example app must confirm before the
docs promise sliding siblings.

---

## 9. Async walkthroughs (library mode)

Setup: exclusive, uncontrolled, `defaultValue={null}`, `valueChangeAction={async (next) => { await save(next); }}`.

1. **Action resolves.** Click A → `preventDefault` → dispatch: types added, optimistic `{a}`,
   `save("a")` awaited. Same tick: A's Trigger/Item get `data-open` + `data-pending`, Root
   `data-pending`; `<details>` still closed. Resolve → `startTransition(() => setInternal("a"))`
   → commit: `open` attribute set, `::details-content` CSS transition runs (or the ViewTransition
   animates), `data-pending` gone, Panel `state.open` true.
2. **Action rejects.** Same as 1 until the rejection. The error propagates to the Error Boundary
   nearest the Root; optimistic `{a}` reverts; `setInternal` never ran; the `<details>` never
   opened, so there is no DOM to roll back. Caught-inside variant: resolves, commits `"a"`.
3. **Overlapping clicks on two items, exclusive.** A open (committed). Click B: `next = "b"`,
   optimistic `{b}`; A and B both `data-pending`, A loses `data-open`, B gains it. Before B's
   action settles, click C: `next = "c"` from the optimistic set, optimistic `{c}`; B loses
   `data-open`. B resolves first: not the latest dispatch, no commit (its post-await write is also
   held by the async-action scope). C resolves: commit `"c"`, DOM: A closes, C opens in one commit.
   `valueChangeAction` was called twice (`"b"`, `"c"`), as it must be; consumers who need the
   stale call to be harmless make it idempotent or abort it (conventions 2.5).
4. **Controlled parent ignores the change.** `value={null}` fixed, action resolves without
   `setOpen`. Optimistic shows A open while pending; on settle, optimistic reverts to `null`, the
   `<details>` never opened. The trigger flips back; nothing else moves.
5. **Panel content suspends.** `<Accordion.Panel>{({open}) => open && <Comments/>}</Accordion.Panel>`,
   sync action. Click → optimistic `data-open` → committed flips inside the transition → Comments
   suspends → the already-revealed boundary above does not show its fallback; the `<details>`
   stays closed (the committed render has not committed) and Root/Trigger stay `data-pending` →
   data arrives → `open` and content commit together.
6. **Find-in-page opens B while A is open (exclusive, controlled, parent accepts).** Browser sets
   `B.open = true` (no `name`, so A stays open in the DOM) → `toggle` on B → `dispatchFromDom`:
   DOM shows A and B open. Picking the first open item in document order would give A, equal to
   the current value → no dispatch, and the layout effect would close what the user just searched
   for. Hence the rule in 2.3: the **toggled** item wins when it is open (`next = "b"`), otherwise
   the first open item. Dispatch `"b"` with `reason: "platform"`,
   `item: "b"`, `open: true` → parent sets `"b"` → commit: A closes, B stays open. Parent refuses
   → B is re-closed by the layout effect when the transition ends.

---

## 10. Call-site examples

### 10.1 Server Component, JS-free, exclusive

```tsx
// app/faq.tsx — a Server Component. No interaction JS runs; the parts hydrate as small client components.
import { Accordion } from "@funstack/ui/accordion";

export async function Faq() {
  const items = await loadFaq();
  return (
    <Accordion.Root exclusive className="faq">
      {items.map((item) => (
        <Accordion.Item key={item.id} value={item.id} className="faq-item">
          <Accordion.Trigger className="faq-q"><h3>{item.question}</h3></Accordion.Trigger>
          <Accordion.Panel className="faq-a"><Markdown source={item.answer} /></Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
```

`Markdown` stays a Server Component: its output is passed to the client Panel as `children`.
Function-valued `className`/`style`/`children`/`render` cannot be passed from a Server Component
(not serializable); use plain values there.

### 10.2 Server Component, library mode with a Server Function

```tsx
// app/settings-sections.tsx — Server Component
import { Accordion } from "@funstack/ui/accordion";
import { rememberOpenSections } from "./actions"; // "use server"

export function SettingsSections({ open }: { open: string[] }) {
  return (
    <Accordion.Root value={open} valueChangeAction={rememberOpenSections}>
      …
    </Accordion.Root>
  );
}
```

Every open waits for the server round trip and the trigger shows `data-pending` meanwhile; the
`value` updates when the Server Function's revalidation re-renders the page. Right for persisted
preferences, wrong for a FAQ (use 10.1).

### 10.3 Client Component, controlled, lazy content, ViewTransition

```tsx
"use client";
import { startTransition, useState } from "react";
import { Accordion } from "@funstack/ui/accordion";

export function Threads({ threads }) {
  const [open, setOpen] = useState<string[]>([]);
  return (
    <Accordion.Root value={open} valueChangeAction={(next) => { setOpen(next); }}>
      {threads.map((t) => (
        <Accordion.Item key={t.id} value={t.id} transition="fsui-grow">
          <Accordion.Trigger>
            {({ open, pending }) => (
              <>
                <h3>{t.title}</h3>
                <Chevron open={open} />
                {pending && <Spinner aria-hidden />}
              </>
            )}
          </Accordion.Trigger>
          <Accordion.Panel>{({ open }) => open && <Replies threadId={t.id} />}</Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
```

`Replies` reads a cached promise with `use()`; the trigger spins until the replies are ready,
then the item grows. No `Suspense` fallback flashes because the update is a transition.

### 10.4 Disabled item and Tailwind

```tsx
<Accordion.Item value="billing" disabled className="data-disabled:opacity-50">
  <Accordion.Trigger className="data-open:font-semibold data-pending:animate-pulse">Billing</Accordion.Trigger>
  <Accordion.Panel>Unavailable on this plan.</Accordion.Panel>
</Accordion.Item>
```

---

## 11. Test plan

Mapped to the conventions' required-coverage table. "both" = `describe.each` over uncontrolled
and controlled wrappers (controlled follows update-on-success). Library mode unless stated.

| Row | Accordion tests |
| --- | --- |
| Roles and ARIA | Default elements are `div > details > summary + div`; no ARIA added except `aria-disabled`; `exclusive` in JS-free mode renders the same `name` on every details and none in library mode; `defaultOpen` renders `open` in JS-free mode and warns in library mode. |
| Keyboard | ArrowDown/ArrowUp wrap, Home/End, disabled triggers skipped, nested Root does not steal keys. Enter/Space toggling is **not** testable in jsdom (no synthesized click on summary; see below); covered by the click path plus a browser-mode note. |
| Sync action (both) | Click dispatches `(next, { event, reason: "trigger", item, open })`; `event` is the native `MouseEvent`; disabled items never dispatch and the click is default-prevented; clicking a link inside the summary neither toggles nor dispatches; multiple vs exclusive compute `next` correctly. |
| Async action (both) | While unresolved: `data-pending` on Root, Item, Trigger; `data-open` on Trigger/Item; `details.open` false; Panel `state.open` false. After resolve: `open` true, `data-pending` gone. |
| Rejection (both) | `ErrorCatcher` receives the error; `data-open` gone; `details.open` still false; uncontrolled value unchanged. Caught-inside: commits. |
| Overlap | Walkthrough 9.3 with `deferred()` resolved out of order; final `open` attributes match the latest dispatch; action called twice. |
| Suspending content (both) | Panel function child mounts `<Suspender>` when open; old state stays, no fallback from the boundary above, `data-pending` on; after resolve, open and content present. |
| Function props | `className`/`style`/`children`/`render` on all four parts receive the documented state; JS-free mode passes `open: undefined`. |
| `render` element | `render={<details className="x" />}` on Item and `render={<summary />}` on Trigger keep the library's handlers and `ref`; dev warning when the mounted tag is wrong. |
| Post-await rule | Controlled parent updating after `await` inside `startTransition`. |
| Directive | Every file under `src/accordion/` except `index.ts` begins with `"use client"` (there is no directive-free part; see Conventions feedback). |
| Platform path | `details.setAttribute("open", "")` (jsdom fires `toggle`) dispatches with `reason: "platform"`; controlled parent that ignores it → attribute removed after settle; parent that accepts → stays open; walkthrough 9.6; disabled item re-closes without dispatching. |
| Mode guard | Changing Root from JS-free to library mode after mount warns. |

jsdom facts the tests rely on (verified against jsdom 29.1.1, the version `packages/ui` resolves
today; the manifest asks for `^30.1.3`, re-check after the lockfile moves):

- `summary.click()` toggles `details.open` synchronously and a `preventDefault`ed click does not.
- `toggle` is dispatched asynchronously as a plain `Event` (no `newState`) on any change of the
  `open` attribute, including `setAttribute`; tests `await act(async () => {})` after triggering.
- `:open` works in `matches()`.
- `name` exclusivity is **not** implemented; JS-free exclusive tests assert the attribute only,
  and the exclusive *library* mode (which does not use `name`) is tested fully.
- Enter/Space on a summary do not synthesize a click; `user-event`'s Enter clicks buttons, links
  and inputs only. Keyboard toggling is therefore a browser-mode (or example-app) check, noted at
  the top of `accordion.test.tsx`.
- Find-in-page cannot be simulated; the platform path is tested through `setAttribute("open")`.

---

## 12. Implementation notes

```
packages/ui/src/accordion/
  index.ts                 # no directive: namespace + type re-exports
  accordion-context.ts     # "use client": RootContext, ItemContext
  accordion-root.tsx       # "use client": state owner, keyboard navigation, registry
  accordion-item.tsx       # "use client": <details>, open/onToggle, DOM reconciliation
  accordion-trigger.tsx    # "use client": <summary>, click interception, aria-disabled
  accordion-panel.tsx      # "use client": <div>, committed open in state
  accordion.test.tsx
```

- **Every part file is `"use client"`.** Item, Trigger and Panel read context (`use(Context)`),
  which Flight refuses in a Server Component; Root creates context. The build test asserts the
  directive on all five modules. There is no `accordion-static.tsx`.
- **Context.** `RootContext`: `{ mode: "static" | "library", exclusive, name (static+exclusive),
  disabled, pending, committed: ReadonlySet<string>, optimistic: ReadonlySet<string>, dispatch,
  dispatchFromDom, registerTrigger }`. `ItemContext`: `{ value, disabled, committedOpen,
  optimisticOpen, pending }` (all `undefined`-open in static mode). Root recomputes the context
  value with `useMemo`; the sets are new objects only when they change.
- **Mode detection** once, from the first render's props (`value !== undefined ||
  defaultValue !== undefined || valueChangeAction !== undefined`), stored in a ref; warn if it
  changes.
- **Normalisation.** Root converts `string | null` ⇄ `Set<string>` at the prop boundary and calls
  `useControllableAction` with the set; the reducer in 4.1 is passed in. `next` for the action is
  converted back before the call.
- **Registry.** `registerTrigger(el) => cleanup` through a callback ref in Trigger; Root keeps a
  `Set<HTMLElement>` in a ref and sorts by `compareDocumentPosition` inside the keydown handler
  (`useEffectEvent` is unnecessary; the handler reads refs).
- **Item.** Renders `<ViewTransition default={transition ?? "none"}><details open={committedOpen}
  name={staticExclusiveName} onToggle={…} data-open={optimisticOpen || undefined} …>`. In static
  mode the `open` prop is the value of `defaultOpen` captured on the first render (`useState(() =>
  defaultOpen)`), so later re-renders pass the same prop and React never rewrites the attribute the
  browser now owns. The layout effect from 2.3 exists only in library mode.
- **Trigger.** `onClick` per 2.2; `isNestedInteractive` = `event.target` has an ancestor matching
  `a[href], button, input, select, textarea, [contenteditable]` below the summary. Renders
  `aria-disabled` and `data-*`. Registers with Root.
- **Panel.** Reads `ItemContext`, renders `<ViewTransition><div data-disabled …>`.
- **Ids.** `useId()` only in Root, only consumed for `name` in static exclusive mode.
- **Transition types** added in Root's dispatch, before `setOptimistic`.
- **Dev warnings:** mode change after mount; `defaultOpen` in library mode; `transition` in static
  mode; wrong `tagName` behind `render`; Item without Root (Item works standalone as a disclosure
  in static mode, so this one is informational only if the consumer passed `transition` or
  expected `exclusive`).

Standalone Items: an `Accordion.Item` outside any Root is a valid JS-free disclosure (no context,
static mode). This is intentional and documented as the library's Disclosure until one is designed.

---

## Conventions feedback

1. **7.3 / 7.1, directive-free Accordion.** The sketch `accordion-static.tsx` (no directive) cannot
   be built: a Server Component cannot read context (Flight: "Cannot read a Client Context from a
   Server Component"), HTML offers no inheritance for `name`, so Item/Trigger/Panel need either
   context (client) or per-item props from the consumer. This design keeps one anatomy and makes
   all parts client. Suggested rewording for 7.3: "JS-free primitive" means *no JS runs for the
   interaction and the markup is complete and functional before hydration*; whether a part file is
   directive-free is a per-component fact recorded in its design doc. The Directive test row then
   asserts whatever the design doc says. Decision for the product owner (see report).
2. **4.1 vocabulary.** Both `expanded` ("Accordion trigger/panel") and `open` ("Popup, Trigger:
   platform or library open state") claim the Accordion trigger. This design uses `open` because
   the platform says `open` everywhere (`<details open>`, `:open`, `ToggleEvent.newState`).
   Suggest removing the `expanded` row or reserving it for a future non-details Disclosure.
3. **3.2 "triggers render optimistic state" and ARIA.** On `<summary>` the optimistic value cannot
   be exposed to AT (`aria-expanded` is disallowed). Suggest a sentence in 3.2: "where the platform
   owns the ARIA state (`<details>`), optimistic state is visual (`data-*`) only."
4. **8, `experimental_interpolateSize` on Panel.** Should be on Root (inherited property; the
   animated box is a pseudo-element of `<details>`). Update the "first customers" table.
5. **8, `focusgroup` list.** Accordion should not be listed as a `focusgroup` customer: it
   collapses Tab stops, which the APG accordion forbids.
6. **3.5 browser-owned table.** Add the row this design needed: a library-owned state with a
   residual browser-owned path (find-in-page on `<details>`, pre-hydration clicks) is reconciled
   by dispatching with `reason: "platform"` and re-applying committed state after settle. Tabs
   with `hidden="until-found"` will need the same rule.
