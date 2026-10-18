# ToggleGroup and Toolbar

Status: **Draft — awaiting product owner acceptance** (2026-10-18, GitHub issue #66, wave 6).
Follows `design/conventions.md` (accepted); where this document and the conventions disagree, the
conventions win. The conventions amendments this design asks for are listed at the end and were
applied to `design/conventions.md` in the same commit, marked as pending this design's acceptance.

Inputs: `docs/vision.md`, `design/conventions.md`, `docs/research/wave6.md` section 1 (probes in
`memo/platform-researcher/probes/15-wave6/`), `design/components/toggle.md` (the element a
`ToggleGroup.Item` renders, and its section 10 forecast of this design), `design/components/tabs.md`
section 8 and `packages/ui/src/tabs/tabs-list.tsx` (the roving-focus and `experimental_focusgroup`
machinery), `design/components/menu.md` 3.2 and 5 (`Menu.Trigger`'s arrow keys),
`design/components/radio-group.md` 8 (why an exclusive form choice is a RadioGroup),
`design/components/checkbox-group.md` 3.1 and 5 (the set-valued `added` / `removed` contract), WAI-ARIA
APG Toolbar pattern and example, prior art (Radix `ToggleGroup` / `Toolbar` 1.2, Base UI 1.9
`ToggleGroup` / `Toolbar`, React Aria 3.53 `useToggleButtonGroup` / `useToolbar`, Ark UI). Working
notes in `memo/architect/toggle-group-notes.md`.

Product-owner decisions taken as given (issue #66): exclusive mode uses `aria-pressed` buttons inside
`role="group"`, not radio semantics; a ToggleGroup inside a Toolbar joins the Toolbar's single roving
sequence on both the native `focusgroup` path and the JS path; `Toggle` stays unchanged; the value
API is the `value` / `defaultValue` / `valueChangeAction` triple with optimistic pressed state on
the items and pending exposed.

## Decisions at a glance

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Anatomy | Two namespaces. `ToggleGroup.Root` (`div role="group"`) and `ToggleGroup.Item` (`button type="button" aria-pressed`, the same element and states as `Toggle`). `Toolbar.Root` (`div role="toolbar" aria-orientation`), `Toolbar.Button` (a pure-trigger `button` with `action`, focusable when disabled) and `Toolbar.Separator` (`hr aria-orientation`). No `Toolbar.Group`, `Toolbar.Link`, `Toolbar.Input` or `Toolbar.ToggleGroup`: a Toolbar's items are its focusable descendants, found in the DOM, so library parts and plain elements join without wrappers. |
| 2 | Value model | Discriminated on `exclusive`, as Accordion: `exclusive` → `value: string \| null`; otherwise `string[]` (the default, as `Toggle` 10 forecast). One `ToggleGroupValueChangeDetails = { added, removed }` for both modes (conventions 2.2, set-valued diff); `next` and `state.value` in document order. |
| 3 | Deselecting in exclusive mode | **Allowed by default**: pressing the pressed Item releases it (`null`). `deselectable={false}` keeps one Item pressed (a view switcher); it exists only on the `exclusive` props variant. An exclusive, required *form* choice is a RadioGroup, not a ToggleGroup (research 1.2). |
| 4 | Semantics | `aria-pressed` Items in `role="group"` in both modes; no `aria-orientation` on the group (not allowed on `group`), `data-orientation` only. Arrows move focus and never press. |
| 5 | Roving focus | One internal engine, `useRovingFocus` (`src/internal/use-roving-focus.ts`), shared by `Toolbar.Root` and a standalone `ToggleGroup.Root`. It finds its items in the DOM and **writes `tabindex` through the DOM** (the items render none), so arbitrary focusable children of a Toolbar join the sequence. Before hydration every item is a Tab stop; after it, one. |
| 6 | Entry item | Toolbar: the last focused item (APG "may restore the last focused control"), the first enabled item on first entry. Standalone ToggleGroup: the first pressed enabled Item (document order), else the first enabled Item, like radios. |
| 7 | Toolbar wrap | `loop` defaults to **`true`**, as Tabs and Menu (Base UI and Radix loop too). The native path renders the `wrap` token so both paths agree; the native default (`nowrap`) is overridden on purpose. |
| 8 | Text-entry items | An item that owns arrow keys (`input` other than button-like types, `textarea`, `select`, `[contenteditable]`, `role` `textbox` / `combobox` / `spinbutton` / `slider`) keeps its arrows, Home and End; **Tab / Shift+Tab from it move to the next / previous toolbar item while one exists**, which is what Chromium's `focusgroup="toolbar"` does. APG's advice (one such control, last) is in the docs. |
| 9 | `Menu.Trigger` in a Toolbar | Horizontal: unchanged (ArrowDown / ArrowUp open with the first / last item focused; Left / Right are the Toolbar's). **Vertical: the trigger opens on the inline-end arrow (ArrowRight; ArrowLeft under `direction: rtl`) with the first item focused**, and leaves ArrowDown / ArrowUp to the Toolbar, the way `Menu.SubmenuTrigger` opens on the perpendicular axis. Read from `ToolbarContext`. |
| 10 | ToggleGroup inside Toolbar | Detected through `ToolbarContext` (works under SSR). The group renders `role="group"` with no engine, no `focusgroup`, no `focusgroupstart`; its Items are plain members of the Toolbar's sequence (React Aria's `isInToolbar`). `orientation`, `loop` and `experimental_focusgroup` on such a group are ignored with a dev warning. The group is transparent to the arrow keys (no extra Up / Down within the group; see 7.3). |
| 11 | `experimental_focusgroup` | On `Toolbar.Root`: `focusgroup="toolbar inline\|block wrap\|nowrap"`. On a standalone `ToggleGroup.Root`: `focusgroup="toolbar inline\|block wrap\|nowrap nomemory"` with `focusgroupstart` on the first pressed Item (the `toolbar` token with an explicit `role="group"`, which wins over the inferred role). Detection as Tabs and Menu (`"focusGroup" in HTMLElement.prototype` through `useSyncExternalStore`, #43); where native, the engine writes no `tabindex` and handles no navigation key. |
| 12 | Pending and optimistic | `ToggleGroup.Root` owns `useControllableAction` with a patch reducer; `Item` renders optimistic `aria-pressed`; `data-pending` on the Root and on each Item whose optimistic pressed state differs from the committed one (CheckboxGroup 5.3). `Toolbar.Button` runs its `action` through `useActionTrigger` with its own `data-pending`. |
| 13 | Disabled | `ToggleGroup.Item` and `Root disabled`: native `disabled` (as `Toggle`), skipped by the roving sequence. `Toolbar.Button disabled`: `aria-disabled="true"`, focusable and in the sequence (APG Toolbar example: "so screen reader users are aware of their presence"), never dispatches. |
| 14 | ViewTransition | `transition` on `ToggleGroup.Item` and `Toolbar.Button` (their content can key on `pending`, the Toggle rule); none on the Roots or the Separator. Types `fsui-toggle-group`, `fsui-toggle-group-press` (`added` non-empty), `fsui-toggle-group-release` (`removed` non-empty); Toolbar emits none. |
| 15 | Files | `src/toggle-group/`, `src/toolbar/`, `src/internal/use-roving-focus.ts`, `src/internal/toolbar-context.ts`; every part file is `"use client"`. `Menu.Trigger` gains a context read; `Toggle` is untouched. |

---

## 1. Anatomy

```
ToggleGroup.Root        div role="group"                          state owner: value, optimistic, transition
  ToggleGroup.Item      button type="button" aria-pressed         optimistic pressed, data-pending; the Toggle element
  ToggleGroup.Item      …

Toolbar.Root            div role="toolbar" aria-orientation       roving-focus owner, ToolbarContext
  ToggleGroup.Root      div role="group"                          joins the Toolbar's sequence; no engine of its own
    ToggleGroup.Item    button aria-pressed
  Toolbar.Separator     hr aria-orientation
  Toolbar.Button        button type="button" [aria-disabled]      pure trigger: action, data-pending
  Menu.Root / Menu.Trigger, Popover.Trigger, Dialog.Trigger, Toggle, Tooltip.Trigger,
  a plain <button>, <a href>, <input>                              all items: found in the DOM
```

Every part renders exactly one element (conventions 1.1). `ToggleGroup.Item` renders the same element
with the same attributes as `Toggle`; `Toggle` itself is not changed and a `Toggle` rendered inside a
`ToggleGroup.Root` is an independent toggle, not a member of the group (it is a member of an
enclosing Toolbar's focus sequence, like any button).

Neither Root has a `Label` part: `role="group"` and `role="toolbar"` are named with `aria-label` or
`aria-labelledby`, both pass-through. Both should be named (the APG requires it for a toolbar; for
the group it is what gives screen-reader users the "exclusive choice" context that `aria-pressed`
alone does not convey, research 1.2). The docs say so next to every example.

## 2. Usage

### 2.1 A formatting group: multiple values, async save

```tsx
import { ToggleGroup } from "@funstack/ui/toggle-group";

<ToggleGroup.Root
  aria-label="Text style"
  defaultValue={doc.styles}                       // string[]
  valueChangeAction={async (next, { added, removed }) => {
    await api.setStyles(doc.id, next);           // or save(added, removed)
  }}
>
  <ToggleGroup.Item value="bold"><BoldIcon aria-hidden /><span className="sr-only">Bold</span></ToggleGroup.Item>
  <ToggleGroup.Item value="italic"><ItalicIcon aria-hidden /><span className="sr-only">Italic</span></ToggleGroup.Item>
  <ToggleGroup.Item value="underline"><UnderlineIcon aria-hidden /><span className="sr-only">Underline</span></ToggleGroup.Item>
</ToggleGroup.Root>
```

Each Item flips the instant it is clicked (`aria-pressed`, `data-pressed`), carries `data-pending`
until the save settles, and keeps the value afterwards. A rejection flips it back and reaches the
Error Boundary around the group. The group is one Tab stop; Left / Right move between the Items.

### 2.2 An exclusive group: one value or none

```tsx
<ToggleGroup.Root exclusive aria-label="Text alignment" defaultValue="left" valueChangeAction={setAlign}>
  <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
  <ToggleGroup.Item value="center">Center</ToggleGroup.Item>
  <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
</ToggleGroup.Root>
```

`next` is `"center"` after pressing Center, and `null` after pressing the pressed Left again. A view
switcher that must always show one value passes `deselectable={false}`:

```tsx
<ToggleGroup.Root exclusive deselectable={false} aria-label="Layout" value={layout} valueChangeAction={(next) => { setLayout(next); }}>
  <ToggleGroup.Item value="grid">Grid</ToggleGroup.Item>
  <ToggleGroup.Item value="list">List</ToggleGroup.Item>
</ToggleGroup.Root>
```

Here pressing the pressed Item dispatches nothing. `value` is still typed `string | null` (the group
can start with nothing pressed), but the action never receives `null`. If the choice is posted with a
form or must be announced as "1 of 2", use `RadioGroup` styled as a segmented control instead.

### 2.3 Controlled, server-backed ("update on success"): apply the diff

```tsx
const [styles, setStyles] = useState<string[]>(doc.styles);

<ToggleGroup.Root
  aria-label="Text style"
  value={styles}
  valueChangeAction={async (_next, { added, removed }) => {
    await api.patchStyles(doc.id, { added, removed });
    startTransition(() =>
      setStyles((prev) => [...prev.filter((v) => !removed.includes(v)), ...added.filter((v) => !prev.includes(v))]),
    ); // functional update: two overlapping saves that settle out of order cannot lose a change (conventions 2.5)
  }}
>
  …
</ToggleGroup.Root>
```

### 2.4 An editor toolbar: everything in one sequence

```tsx
import { Toolbar } from "@funstack/ui/toolbar";
import { ToggleGroup } from "@funstack/ui/toggle-group";
import { Menu } from "@funstack/ui/menu";

<Toolbar.Root aria-label="Formatting">
  <ToggleGroup.Root aria-label="Text style" value={styles} valueChangeAction={saveStyles}>
    <ToggleGroup.Item value="bold">B</ToggleGroup.Item>
    <ToggleGroup.Item value="italic">I</ToggleGroup.Item>
  </ToggleGroup.Root>
  <Toolbar.Separator />
  <ToggleGroup.Root exclusive aria-label="Text alignment" value={align} valueChangeAction={saveAlign}>
    <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
    <ToggleGroup.Item value="center">Center</ToggleGroup.Item>
  </ToggleGroup.Root>
  <Toolbar.Separator />
  <Menu.Root>
    <Menu.Trigger>Insert</Menu.Trigger>
    <Menu.Popup>
      <Menu.Item action={insertImage}>Image</Menu.Item>
      <Menu.Item action={insertTable}>Table</Menu.Item>
    </Menu.Popup>
  </Menu.Root>
  <Toolbar.Button action={cut}>Cut</Toolbar.Button>
  <Toolbar.Button action={copy} disabled={!hasSelection}>Copy</Toolbar.Button>
  <Toolbar.Button action={paste}>Paste</Toolbar.Button>
  {/* A text-entry control owns its arrow keys; put at most one in a toolbar, and last (APG). */}
  <input type="text" aria-label="Font size" inputMode="numeric" />
</Toolbar.Root>
```

Tab enters the toolbar on the last focused control (Bold the first time). Left / Right walk every
control in DOM order: the two groups, the menu button, the three buttons, the input. ArrowDown on
Insert opens the menu. Copy, disabled, stays focusable and is announced. In the input, Left / Right
move the caret and Tab leaves the toolbar (it is last). No wrapper parts anywhere; the Toolbar found
every control in the DOM.

### 2.5 A vertical toolbar with a menu

```tsx
<Toolbar.Root orientation="vertical" aria-label="Tools">
  <Toolbar.Button action={select}>Select</Toolbar.Button>
  <Toolbar.Button action={draw}>Draw</Toolbar.Button>
  <Menu.Root>
    <Menu.Trigger>Shapes</Menu.Trigger>
    <Menu.Popup side="right">…</Menu.Popup>
  </Menu.Root>
</Toolbar.Root>
```

Up / Down walk the tools; on Shapes, ArrowRight opens the menu with its first item focused
(ArrowLeft under `direction: rtl`); Enter and Space open it too. ArrowDown on Shapes moves on to the
next tool rather than opening the menu (decision 9).

### 2.6 From a Server Component, with a Server Function

```tsx
// Server Component
import { ToggleGroup } from "@funstack/ui/toggle-group";
import { setStyles } from "./actions"; // "use server"; (docId, next, details) => Promise<void>

<ToggleGroup.Root aria-label="Text style" defaultValue={doc.styles} valueChangeAction={setStyles.bind(null, doc.id)}>
  <ToggleGroup.Item value="bold">Bold</ToggleGroup.Item>
  <ToggleGroup.Item value="italic">Italic</ToggleGroup.Item>
</ToggleGroup.Root>
```

`details` is `{ added, removed }`, serialisable; `event` is virtual (conventions 2.2).

### 2.7 Styling

```css
.group { display: inline-flex; }
.group[data-orientation="vertical"] { flex-direction: column; }
.group[data-pending] { cursor: progress; }
.item[data-pressed] { background: var(--accent); color: white; }
.item[data-pending]::after { content: ""; /* spinner */ }
.item[data-disabled] { opacity: .5; }
.item:focus-visible { outline: 2px solid var(--focus); }

.toolbar { display: flex; gap: .25rem; }
.toolbar[data-orientation="vertical"] { flex-direction: column; }
/* <hr> is a block; in a horizontal toolbar it is a vertical rule. */
.toolbar-separator { margin: 0; border: 0; background: var(--line); }
.toolbar-separator[data-orientation="vertical"] { inline-size: 1px; align-self: stretch; }
.toolbar-separator[data-orientation="horizontal"] { block-size: 1px; }
.toolbar-button[aria-disabled="true"] { opacity: .5; }
.toolbar-button[data-pending] { cursor: progress; }
```

`[aria-pressed="true"]` and `[data-pressed]` always agree, as for `Toggle`. Tailwind:
`data-pressed:bg-accent data-pending:animate-pulse`.

---

## 3. Props and types

### 3.1 `ToggleGroup.Root`

```ts
// packages/ui/src/toggle-group/toggle-group-root.tsx
export type ToggleGroupOrientation = "horizontal" | "vertical";

/** Details passed as the second argument of `valueChangeAction`, in both modes. */
export interface ToggleGroupValueChangeDetails extends ActionDetails {
  /** Values this dispatch pressed (document order of their Items). Exclusive mode: `[next]` or `[]`. */
  readonly added: readonly string[];
  /** Values this dispatch released. Exclusive mode: `[previous]` or `[]`. */
  readonly removed: readonly string[];
}

export interface ToggleGroupRootState {
  /**
   * Optimistic pressed values in document order of the Items (exclusive mode: `[value]` or `[]`,
   * so one state shape serves both modes). Content rendered from it must not suspend.
   */
  readonly value: readonly string[];
  /** An action dispatched through this group is in flight. */
  readonly pending: boolean;
  readonly disabled: boolean;
  /** The effective orientation: the Toolbar's when inside one. */
  readonly orientation: ToggleGroupOrientation;
}

interface ToggleGroupRootBaseProps
  extends Omit<ComponentPropsWithRef<"div">, "role" | "onKeyDown" | "defaultValue" | "className" | "style" | "children"> {
  /** Axis of the arrow keys and `data-orientation`. Default `"horizontal"`. Ignored inside a Toolbar (dev warning). */
  orientation?: ToggleGroupOrientation;
  /** Whether arrows wrap from the last Item to the first. Default `true`. Ignored inside a Toolbar (dev warning). */
  loop?: boolean;
  /** Disables every Item (native `disabled`). */
  disabled?: boolean;
  /**
   * Render `focusgroup="toolbar …"` and, where the browser implements it, let the browser move
   * focus between the Items. Chromium 150+ only; elsewhere the JS path stays active. Ignored
   * inside a Toolbar (a nested focusgroup would split the Toolbar's sequence; dev warning).
   * Default `false`.
   */
  experimental_focusgroup?: boolean;
  className?: StateValue<string | undefined, ToggleGroupRootState>;
  style?: StateValue<CSSProperties | undefined, ToggleGroupRootState>;
  children?: StateValue<ReactNode, ToggleGroupRootState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, ToggleGroupRootState>;
}

export interface ToggleGroupMultipleProps extends ToggleGroupRootBaseProps {
  exclusive?: false;
  /** Controlled pressed values. `[]` presses nothing; `undefined` means uncontrolled. Order is not significant; duplicates ignored. */
  value?: string[];
  /** Initial pressed values in uncontrolled mode. Default `[]`. */
  defaultValue?: string[];
  /**
   * Runs inside the Root's transition whenever the set of pressed Items changes. Sync or async (a
   * Server Function may be passed directly); rejections reach the nearest Error Boundary and roll
   * the change back. `next` is the whole set as a fresh array in document order;
   * `details.added` / `details.removed` say what changed. A `setState` after your own `await` is
   * not a Transition update; wrap it in `startTransition`. Prefer a functional update keyed by
   * `added` / `removed` when controlled (2.3).
   */
  valueChangeAction?: ChangeAction<string[], ToggleGroupValueChangeDetails>;
}

export interface ToggleGroupExclusiveProps extends ToggleGroupRootBaseProps {
  /** At most one Item is pressed; `value` is `string | null`. */
  exclusive: true;
  /** Controlled pressed value. `null` presses nothing; `undefined` means uncontrolled. */
  value?: string | null;
  /** Initial pressed value in uncontrolled mode. Default `null`. */
  defaultValue?: string | null;
  /**
   * Whether pressing the pressed Item releases it (`next === null`). Default `true`. With
   * `false` that press is a no-op and dispatches nothing; `value` stays `string | null` because
   * the group may start with nothing pressed, but the action is then never called with `null`.
   */
  deselectable?: boolean;
  valueChangeAction?: ChangeAction<string | null, ToggleGroupValueChangeDetails>;
}

export type ToggleGroupRootProps = ToggleGroupMultipleProps | ToggleGroupExclusiveProps;
```

The discriminant is `exclusive`, as in Accordion (decisions table there, item 3) and as `Toggle`'s
section 10 forecast; the mode is fixed at mount (switching warns, like a controlled/uncontrolled
switch). `deselectable` exists only on the exclusive variant, so `exclusive={false} deselectable` is
a type error rather than a silently ignored prop. No dev warning when neither `value` nor
`defaultValue` is given: nothing pressed is the natural initial state (RadioGroup, CheckboxGroup).

Owned keys (conventions 1.2): `role`, `data-orientation`, `data-pending`, `data-disabled`,
`onKeyDown`, `onFocus`, `onPointerDown` (the roving engine's, standalone only), and `focusgroup`
while `experimental_focusgroup` is on and the group is standalone. `aria-label`, `aria-labelledby`
and everything else on `<div>` pass through.

### 3.2 `ToggleGroup.Item`

```ts
// packages/ui/src/toggle-group/toggle-group-item.tsx
export interface ToggleGroupItemState {
  /** Optimistic pressed state. */
  readonly pressed: boolean;
  /** The group's action is in flight and this Item's optimistic state differs from its committed one. */
  readonly pending: boolean;
  /** Own `disabled` or the Root's. */
  readonly disabled: boolean;
  readonly orientation: ToggleGroupOrientation;
}

export interface ToggleGroupItemProps
  extends Omit<ComponentPropsWithRef<"button">, "onClick" | "type" | "value" | "tabIndex" | "aria-pressed" | "className" | "style" | "children"> {
  /** The value this Item presses. Unique within the group. */
  value: string;
  /** Renders a native disabled button; never dispatches; skipped by arrow keys. */
  disabled?: boolean;
  /** As on Toggle: animates the commit that ends the action, not the optimistic flip. */
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, ToggleGroupItemState>;
  style?: StateValue<CSSProperties | undefined, ToggleGroupItemState>;
  /** Rendered from optimistic state; must not suspend. */
  children?: StateValue<ReactNode, ToggleGroupItemState>;
  /** Must be, or render, a `<button>` (a toggle is a button, Toggle 2.6). */
  render?: RenderProp<ComponentPropsWithRef<"button">, ToggleGroupItemState>;
}
```

`tabIndex` is omitted: the roving engine (its own group's standalone, or the enclosing Toolbar's)
owns the attribute through the DOM (section 6). `value` is omitted from the pass-through set because
it is the Item's own prop; it is not rendered as an HTML attribute (a `render={<a />}` element has no
`value`). Everything else is as `ToggleProps`: `onClick` and `type` are the library's, `aria-pressed`
is computed.

Owned keys: `type` (on a `<button>` only), `aria-pressed`, `disabled`, `data-pressed`,
`data-pending`, `data-disabled`, `data-orientation`, `onClick`, and the registration `ref`.

### 3.3 `Toolbar.Root`

```ts
// packages/ui/src/toolbar/toolbar-root.tsx
export type ToolbarOrientation = "horizontal" | "vertical";

export interface ToolbarRootState {
  readonly orientation: ToolbarOrientation;
}

export interface ToolbarRootProps
  extends Omit<ComponentPropsWithRef<"div">, "role" | "aria-orientation" | "onKeyDown" | "onFocus" | "onPointerDown" | "className" | "style" | "children"> {
  /** Axis of the arrow keys; also `aria-orientation`. Default `"horizontal"`. */
  orientation?: ToolbarOrientation;
  /** Whether arrows wrap from the last item to the first. Default `true`. */
  loop?: boolean;
  /**
   * Render `focusgroup="toolbar …"` and, where the browser implements it, let the browser handle
   * arrow keys, Home and End and the single Tab stop. Chromium 150+ only; elsewhere the JS path
   * stays active. Default `false`.
   */
  experimental_focusgroup?: boolean;
  className?: StateValue<string | undefined, ToolbarRootState>;
  style?: StateValue<CSSProperties | undefined, ToolbarRootState>;
  children?: StateValue<ReactNode, ToolbarRootState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, ToolbarRootState>;
}
```

No `disabled`: a Toolbar's items are arbitrary elements the Toolbar does not render, so it has
nothing to disable them with; consumers disable items individually (or wrap the toolbar in a
`<fieldset disabled>`, which the engine honours through `:disabled`). No value, no action, no
`transition`: a Toolbar has no library-owned state at all; its only state is the focus memory,
which is urgent and lives outside React (section 6).

Owned keys: `role`, `aria-orientation`, `data-orientation`, `onKeyDown`, `onFocus`,
`onPointerDown`, and `focusgroup` while the flag is on.

### 3.4 `Toolbar.Button`

```ts
// packages/ui/src/toolbar/toolbar-button.tsx
export interface ToolbarButtonActionDetails extends ActionDetails {}

export interface ToolbarButtonState {
  /** This button's action is in flight. */
  readonly pending: boolean;
  readonly disabled: boolean;
}

export interface ToolbarButtonProps
  extends Omit<ComponentPropsWithRef<"button">, "onClick" | "type" | "tabIndex" | "aria-disabled" | "className" | "style" | "children"> {
  /** Runs inside this button's own transition on click, Enter or Space. Sync or async; rejections reach the nearest Error Boundary. */
  action?: Action<[details: ToolbarButtonActionDetails]>;
  /**
   * `aria-disabled="true"`: the button stays focusable and in the arrow-key sequence so
   * assistive technology still finds it (APG Toolbar example), and never dispatches.
   */
  disabled?: boolean;
  /** Animates the commit that ends the action (content keyed on `pending`), not a click. */
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, ToolbarButtonState>;
  style?: StateValue<CSSProperties | undefined, ToolbarButtonState>;
  children?: StateValue<ReactNode, ToolbarButtonState>;
  render?: RenderProp<ComponentPropsWithRef<"button">, ToolbarButtonState>;
}
```

`Toolbar.Button` is the library's first plain action button. It is scoped to the Toolbar because its
one distinguishing behaviour, focusable-disabled, is the Toolbar pattern's; a general `Button` is a
separate design. It runs `action` through `useActionTrigger` (conventions 3.4) with no open
generation: `pending` is its own transition, a superseded run's rejection is surfaced from render,
and `data-pending` lands on the button. A plain `<button onClick>` is still a legitimate toolbar
item; `Toolbar.Button` is what a consumer reaches for when the click is a transition. Owned keys:
`type` (on a `<button>` only), `aria-disabled`, `data-pending`, `data-disabled`, `onClick`.

Before hydration a click on it does nothing (no command, no form): the part has no residual browser
path and no mount reconciliation. A `render={<a href />}` navigates natively before hydration and
dispatches `action` after it, as `Menu.Item` does.

### 3.5 `Toolbar.Separator`

```ts
// packages/ui/src/toolbar/toolbar-separator.tsx
export interface ToolbarSeparatorState {
  /** The separator's own orientation: perpendicular to the Toolbar's. */
  readonly orientation: ToolbarOrientation;
}

export interface ToolbarSeparatorProps
  extends Omit<ComponentPropsWithRef<"hr">, "aria-orientation" | "className" | "style" | "children"> {
  className?: StateValue<string | undefined, ToolbarSeparatorState>;
  style?: StateValue<CSSProperties | undefined, ToolbarSeparatorState>;
  render?: RenderProp<ComponentPropsWithRef<"hr">, ToolbarSeparatorState>;
}
```

An `<hr>` (implicit `separator`, conventions 1.1) with `aria-orientation="vertical"` in a horizontal
Toolbar and `"horizontal"` in a vertical one, mirrored in `data-orientation`. It is not focusable and
not an item. No `children` (an `hr` is void). Owned keys: `aria-orientation`, `data-orientation`.

### 3.6 Namespaces

```ts
// src/toggle-group/index.ts
export const ToggleGroup = { Root: ToggleGroupRoot, Item: ToggleGroupItem } as const;
export type { ToggleGroupRootProps, ToggleGroupMultipleProps, ToggleGroupExclusiveProps, ToggleGroupRootState,
  ToggleGroupValueChangeDetails, ToggleGroupOrientation } from "./toggle-group-root.js";
export type { ToggleGroupItemProps, ToggleGroupItemState } from "./toggle-group-item.js";

// src/toolbar/index.ts
export const Toolbar = { Root: ToolbarRoot, Button: ToolbarButton, Separator: ToolbarSeparator } as const;
export type { ToolbarRootProps, ToolbarRootState, ToolbarOrientation } from "./toolbar-root.js";
export type { ToolbarButtonProps, ToolbarButtonState, ToolbarButtonActionDetails } from "./toolbar-button.js";
export type { ToolbarSeparatorProps, ToolbarSeparatorState } from "./toolbar-separator.js";
```

Subpaths `@funstack/ui/toggle-group` and `@funstack/ui/toolbar`; both re-exported from the root entry.

---

## 4. States

| State | Kind | Owner | Shown as | Source |
| --- | --- | --- | --- | --- |
| ToggleGroup `value` | library-owned | `ToggleGroup.Root` | Items: `aria-pressed`, `data-pressed`, `state.pressed`; Root: `state.value` | **optimistic** (`useOptimistic`, patch reducer, 5.2) |
| ToggleGroup `pending` | library-owned | `ToggleGroup.Root` | `data-pending` on Root; on Items per 5.3 | `useTransition()` of the Root |
| `disabled` | prop | Root, Item | native `disabled`, `data-disabled`, `:disabled` | prop (Item's own or inherited) |
| `orientation` | prop | both Roots, Items, Separator | `data-orientation` (Toolbar also `aria-orientation`) | prop; inside a Toolbar the Toolbar's |
| Toolbar.Button `pending` | library-owned | `Toolbar.Button` | `data-pending`, `state.pending` | `useActionTrigger` |
| Roving tab stop (which item has `tabindex="0"`) | urgent, library-owned, **not React state** | the engine (Toolbar.Root; standalone ToggleGroup.Root) | `tabindex` written through the DOM | a ref updated on `focusin` / `pointerdown` and re-derived in layout effects (section 6) |

Nothing here is browser-owned in the conventions' sense (no top layer, no native form state).
ToggleGroup has **no residual browser path**: no `name`, no form participation, no reset, no
find-in-page; the platform-path test row is N/A. `details.reason` is therefore not exposed (every
dispatch is `"activate"`), and `ToggleGroupValueChangeDetails` can gain it later without a breaking
change.

---

## 5. The value model

### 5.1 Both modes as a set

Internally the Root holds a `ReadonlySet<string>` in both modes. Exclusive mode is the set with at
most one member: `value: string | null` maps to `new Set(value === null ? [] : [value])` on the way
in and to `set.values().next().value ?? null` on the way out. This is why one details shape and one
`state.value` shape serve both modes, and why the exclusive patch reducer needs no special case.

Equality for the controlled / uncontrolled machinery is set equality (the `equals` option of
`useControllableAction`'s callers, conventions 3.8; here only the no-op guard needs it).

### 5.2 Reducer and dispatch

```ts
type Patch = { added: readonly string[]; removed: readonly string[] };
function reduce(set: ReadonlySet<string>, patch: Patch): ReadonlySet<string> {
  const next = new Set(set);
  for (const v of patch.removed) next.delete(v);
  for (const v of patch.added) next.add(v);
  return next;
}
```

`useOptimistic` gets this reducer with `details` as the patch, exactly as CheckboxGroup 5.2, so
stacked dispatches re-base: press Bold then Italic while Bold's save is in flight shows both pressed;
if Bold's save rejects, Italic's patch re-applies on the reverted base and Italic stays pressed.

The Item's click asks the Root to toggle its value; the Root computes the patch against the
**optimistic** set (conventions 2.3 item 8):

| Mode | Pressed Item clicked | Unpressed Item clicked |
| --- | --- | --- |
| multiple | `{ added: [], removed: [v] }` | `{ added: [v], removed: [] }` |
| exclusive, `deselectable` (default) | `{ added: [], removed: [v] }` → `next === null` | `{ added: [v], removed: current ? [current] : [] }` |
| exclusive, `deselectable={false}` | **no dispatch** | same as above |

`next` is the reduced set as a fresh array in **document order of the Items**, values with no Item
last; `state.value` follows the same order. The Root knows the order without a registration render:
each Item registers `{ element, value }` in a Root-held `Map` through a callback ref (React 19
cleanup on unmount, no state write), and at dispatch the Root sorts the map by
`compareDocumentPosition`, keeps the order in a ref, and the reducer's output is sorted by that
order when `state.value` is derived. The server render and the first client render use the value's
own order (no DOM yet), as CheckboxGroup's `state.value` does.

Transition types: `fsui-toggle-group`, plus `fsui-toggle-group-press` when `added` is non-empty and
`fsui-toggle-group-release` when `removed` is non-empty (an exclusive switch carries both).

### 5.3 Per-Item pending

`Item.pending = ctx.pending && ctx.optimistic.has(value) !== ctx.committed.has(value)` (Accordion
4.2, CheckboxGroup 5.3). Pressing Bold and pressing it again before the first save resolves makes
Bold not pending (optimistic equals committed) while the Root still is; the second dispatch is a real
one (`removed: ["bold"]`) and, being the latest, commits "no change". The context carries the
optimistic and the committed set; no part renders the committed set in the DOM.

### 5.4 Overlap

- **Uncontrolled**: the latest dispatch's `next` was computed from the optimistic set, so it already
  contains the earlier in-flight presses; the latest-dispatch guard commits it. Correct by
  construction (conventions 2.5).
- **Controlled, sync prefix** (`setStyles(next)`): writes land in dispatch order; correct.
- **Controlled, update on success**: whole-value writes land in completion order and can lose a
  change; use the functional update of 2.3. Shown next to every such example in the docs.
- A superseded dispatch's rejection reaches the boundary through the shared hook (conventions 2.4).

---

## 6. Roving focus: one engine, DOM-written `tabindex`

### 6.1 The problem a Toolbar poses

A Toolbar's items are whatever the consumer puts in it: `ToggleGroup.Item`s, `Toggle`s,
`Menu.Trigger`, `Popover.Trigger`, `Dialog.Trigger`, `Tooltip.Trigger`, `Toolbar.Button`, a plain
`<button>`, an `<a href>`, an `<input>`. APG wants one Tab stop and arrow keys between them. Tabs
gets its single stop by rendering `tabindex` from state (`0` on the selected tab) because every tab is
a library part that reads the List's context and the "current" item is a *value*. A Toolbar has
neither: its items are arbitrary and its current item is a focus fact, not state.

Three ways to get one Tab stop over arbitrary children:

| Approach | Used by | Cost |
| --- | --- | --- |
| Explicit item parts (`Toolbar.Button`, `Toolbar.Link`, `Toolbar.ToggleGroup`, `asChild` / `render` to wrap anything else) that render `tabindex` from a context | Radix, Base UI | Every library trigger and every plain element needs a wrapper or a context read: `<Toolbar.Button render={<Menu.Trigger />}>`; `Toggle`, `Menu.Trigger`, `Popover.Trigger`, `Dialog.Trigger`, `Tooltip.Trigger` would each gain a context read (the PO asked that `Toggle` stay unchanged). The call site in 2.4 would roughly double in wrappers. |
| Natural `tabindex` on every item; the Toolbar intercepts Tab / Shift+Tab and moves focus to the element after / before the toolbar | React Aria `useToolbar` | Re-implements sequential focus navigation across the document (shadow DOM, `inert`, positive `tabindex`, iframes); re-entry lands on the last item under Shift+Tab (browser order), not the remembered one. |
| **The Toolbar finds its items in the DOM and writes `tabindex` on them** | this design | `tabindex` on items is written outside React. Before hydration every item is a Tab stop. An item that renders its own `tabIndex` prop fights the engine (documented; library item parts omit the prop). |

The third is chosen: it is the only one that keeps the call site free of wrappers and leaves
`Toggle` and the other triggers untouched, and the research already recommended DOM-based membership
("recompute from the DOM on keydown, as Tabs does"). The DOM write is of the kind conventions 7.4
already allows: an attribute the library owns, written from platform events and effects through a
ref, that React never writes a different value for (none of the library's trigger parts renders
`tabIndex`). The conventions amendment at the end records the rule.

### 6.2 The engine

`useRovingFocus(ref, options)` in `src/internal/use-roving-focus.ts` (`"use client"`), used by
`Toolbar.Root` always and by `ToggleGroup.Root` when standalone:

```ts
interface RovingFocusOptions {
  orientation: "horizontal" | "vertical";
  loop: boolean;
  /** The native `focusgroup` path is active: write no `tabindex`, handle no navigation key. */
  native: boolean;
  /** Which item is the Tab stop when there is no usable memory. */
  entry: (items: readonly HTMLElement[]) => HTMLElement | undefined;
  /** Remember the last focused item as the Tab stop (Toolbar) or always re-derive it from `entry` (ToggleGroup). */
  memory: boolean;
}
// returns { onKeyDown, onFocus, onPointerDown } for the container's libraryProps
```

- **Items** are the focusable descendants of the container, in DOM order: `button`, `a[href]`,
  `input` (not `hidden`), `select`, `textarea`, `summary`, `[contenteditable]`, `[tabindex]`;
  minus elements matching `:disabled`, elements inside `[inert]`, elements that fail
  `checkVisibility()`, elements inside a nested `[role="toolbar"]`, and elements inside a
  `[popover]` or `<dialog>` under the container (a `Menu.Popup` is rendered inside the Toolbar's
  subtree; its items are the menu's, not the toolbar's). An element whose `tabindex` is `-1` **and
  was not written by this engine** is not an item (`Combobox.Clear`, a consumer's own opt-out); the
  engine keeps the elements it manages in a `WeakSet` so it can tell its own `-1` apart.
  `aria-disabled="true"` elements are items (APG). Recomputed from the DOM on every keydown.
- **The Tab stop.** The engine keeps `current: HTMLElement | null` in a ref. In a layout effect
  after every commit of the container, and from a `MutationObserver` on the subtree (`childList`,
  and `attributeFilter: ["disabled", "hidden", "inert", "aria-disabled"]`), it recomputes the items;
  if `current` is not among them (unmounted, disabled, hidden) or `memory` is `false`, it sets
  `current = entry(items)`; then it writes `tabindex="0"` on `current` and `tabindex="-1"` on every
  other item. On `focusin` from an item it sets `current` to that item (memory) and re-applies;
  on `pointerdown` likewise, so Safari, which does not focus a button on click, keeps the sequence
  current. Removing an item restores nothing (the element is gone).
- **Entry.** Toolbar: `entry = first enabled item` with `memory: true`, so Tab re-enters on the
  last focused control and enters on the first one initially (APG). Standalone ToggleGroup:
  `entry = first [aria-pressed="true"] enabled item ?? first enabled item` with `memory: false`,
  so Tab always enters on the pressed Item (optimistic, since `aria-pressed` is), like a radio group.
- **Navigation** (JS path only), on the container's `onKeyDown`: ignore when `defaultPrevented`
  or `altKey` / `ctrlKey` / `metaKey`; ignore when the target is not an item of this container;
  resolve the key against `orientation` and `getComputedStyle(container).direction` as
  `tabs-list.tsx` `resolveKey` does (Home / End always); for a **text-entry target** (6.3) handle
  only Tab; move with `focus({ focusVisible: true })`; `preventDefault()` on a handled key; wrap per
  `loop`; disabled-skipping is implicit (native `disabled` elements are not items).
- **Native path** (`native: true`): no `tabindex` is written (Chromium leaves `tabindex="-1"`
  elements out of a focusgroup, Tabs 8) and the keydown handler returns before navigation; the
  `focusin` / `pointerdown` handlers still run but write nothing. Memory is the browser's.

### 6.3 Text-entry items

An item that owns the arrow keys — `input` other than `button`, `submit`, `reset`, `checkbox`,
`radio`, `image`, `color`, `file`; `textarea`; `select`; `[contenteditable]`; and any element with
`role` `textbox`, `combobox`, `spinbutton` or `slider` (a FUNSTACK `Combobox.Input`, `NumberField`,
`Slider.Thumb`'s input) — keeps ArrowLeft / ArrowRight / ArrowUp / ArrowDown / Home / End for itself
in both orientations: the engine does not handle them ("JavaScript does not interfere with text
editing", APG; the focusgroup "key conflict" rule). From such an item, **Tab moves to the next
toolbar item and Shift+Tab to the previous one while one exists**; at either end Tab leaves the
toolbar natively. That is what Chromium's native `focusgroup="toolbar"` does (research 1.3), and the
two paths must not disagree. It is the one place the library intercepts Tab, and it is bounded: the
target is always an item the engine already found; no document-wide walk.

APG's advice stands and the docs repeat it: a toolbar should contain at most one such control, placed
last, so the Tab interception is rarely even observable.

### 6.4 SSR, hydration and pre-hydration behaviour

The engine writes `tabindex` only in effects, so server HTML and the hydration render carry no
`tabindex` on items. Before hydration the toolbar is a run of natural Tab stops: every control is
reachable and operable (its own semantics are native), only the single-stop refinement is missing.
After the first layout effect there is one stop. This is the same shape as Tabs' flagged native path
(markup identical on both sides, behaviour upgraded after hydration), and it is the honest cost of
not requiring item parts. A standalone ToggleGroup has the same pre-hydration behaviour.

### 6.5 Edge cases

| Case | Behaviour |
| --- | --- |
| The current item is removed or becomes `disabled` | The next re-apply (its commit, the observer, the next keydown or focusin) moves the stop to `entry(items)`. If it was focused, focus goes to `body` as the browser does for a removed node; the library does not move it. |
| An item inside a `display: none` subtree toggled by CSS class alone | Not seen by the observer; excluded by `checkVisibility()` at the next keydown / focusin / commit re-apply. A hidden current stop makes the browser skip the toolbar on Tab until then; documented limitation. |
| An item renders its own `tabIndex` prop | Fights the engine (React rewrites it when the prop changes). Library item parts omit `tabIndex`; consumers are told not to pass it to toolbar items. `tabIndex={-1}` present at first sight opts the element out of the sequence. |
| Nested `Toolbar.Root` | Its subtree is excluded from the outer items; the inner toolbar is its own sequence with its own stop (a toolbar inside a toolbar is not APG-sanctioned; supported only to the extent of not breaking). |
| `ToggleGroup.Root` inside a Toolbar | No engine; the Toolbar's engine finds its Items (section 7.3). |
| A `Menu.Popup` rendered inside the Toolbar subtree | Excluded (`[popover]`); its items belong to the menu. Tab closes the menu and lands per the menu's rule; the Toolbar's `focusin` then records the trigger. |
| Two containers on one page | Independent engines; each writes only on its own items. |
| StrictMode | The layout effect's double run re-applies the same values; the observer is disconnected in cleanup. |
| `render={<ul />}` on `Toolbar.Root` | Fine: items are found by focusability, not by element type. |

---

## 7. Keyboard

### 7.1 Standalone `ToggleGroup`

| Key | Horizontal | Vertical | Effect |
| --- | --- | --- | --- |
| `ArrowRight` / `ArrowLeft` | next / previous enabled Item (swapped under `direction: rtl`) | ignored | Move focus only; wrap if `loop`. Never presses. |
| `ArrowDown` / `ArrowUp` | ignored | next / previous enabled Item | Same. |
| `Home` / `End` | first / last enabled Item | same | Same. |
| `Space` / `Enter` on an Item | | | Native button activation → `click` → dispatch (Toggle 5). |
| `Tab` / `Shift+Tab` | | | Enter on the first pressed enabled Item, else the first enabled Item; leave with the next press. |

Focus never changes the pressed state (research 1.4). Disabled Items are natively disabled and not in
the sequence (Toggle's choice; a disabled toggle has nothing to announce that `aria-pressed` would
add, unlike a toolbar command).

### 7.2 `Toolbar`

| Key | Horizontal | Vertical | Effect |
| --- | --- | --- | --- |
| `ArrowRight` / `ArrowLeft` | next / previous item (swapped under `direction: rtl`) | ignored | Move focus; wrap if `loop`. |
| `ArrowDown` / `ArrowUp` | ignored | next / previous item | Same. |
| `Home` / `End` | first / last item | same | Same (APG optional; implemented on both paths). |
| any of the above on a text-entry item | | | Not handled: the item keeps its caret / spin behaviour (6.3). |
| `Tab` / `Shift+Tab` on a text-entry item | | | Next / previous toolbar item while one exists; otherwise native (6.3). |
| `Tab` / `Shift+Tab` elsewhere | | | Native: leave the toolbar; re-enter on the remembered item. |
| `Enter` / `Space` on `Toolbar.Button` | | | Native click → `action`, unless `aria-disabled`. |
| a key the item handled (`event.defaultPrevented`) | | | Ignored by the Toolbar: a `Menu.Trigger`'s ArrowDown wins (horizontal), a `Dialog.Trigger`'s Enter is its own. |

### 7.3 `ToggleGroup` inside a `Toolbar`

The group is **transparent**: Left / Right (horizontal toolbar) or Up / Down (vertical) flow through
its Items as through any other items, and the perpendicular axis does nothing on an Item. APG's
Toolbar example gives its nested *radiogroup* Up / Down within the group because radios are expected
to answer all four arrows; a group of pressed buttons carries no such expectation, and adding a
second axis would make the same keys mean different things on different toolbar items. Trade-off
accepted for predictability; a consumer who wants a two-axis toolbar can nest a `Toolbar.Root`
(6.5), at the cost of a second Tab stop.

Everything else is the Toolbar's: entry by memory, `loop` and `orientation` from the Toolbar
(the group's own are ignored with a dev warning), `tabindex` from the Toolbar's engine. The group
still renders `role="group"` with its label, `data-orientation` (the Toolbar's), `data-pending` and
`data-disabled`, and its Items still render `aria-pressed` and friends; a disabled Item is skipped by
the Toolbar's engine like any `:disabled` element.

### 7.4 `Menu.Trigger` inside a `Toolbar` (research question 3, second half)

`Menu.Trigger` reads `ToolbarContext` (`null` outside a toolbar) and picks its opening arrows:

| Context | Opens with the first item focused | Opens with the last item focused | Left to the Toolbar |
| --- | --- | --- | --- |
| none (unchanged) | `ArrowDown` | `ArrowUp` | — |
| horizontal Toolbar (unchanged) | `ArrowDown` | `ArrowUp` | `ArrowLeft` / `ArrowRight` (never handled by the trigger) |
| vertical Toolbar | `ArrowRight` (`ArrowLeft` under `direction: rtl` on the trigger) | — | `ArrowDown` / `ArrowUp` |

Rationale: a menu button in a toolbar opens on the axis **perpendicular** to the toolbar's
navigation, which is what the APG Toolbar example does for its horizontal toolbar (Down opens, Left /
Right navigate) and what `Menu.SubmenuTrigger` does inside a vertical menu (ArrowRight opens). The
alternative, giving up arrow opening in a vertical toolbar and leaving Enter / Space, is APG-legal
(arrow opening is optional for a menu button) but makes the keyboard story differ between the two
orientations for no gain; the perpendicular key is discoverable by the same reasoning a submenu is.
`ArrowLeft` (the inline-start key) on the trigger does nothing. The docs show `side="right"` on the
`Menu.Popup` for this case. `Enter` and `Space` open in every case, as now.

The trigger's handled arrow calls `preventDefault()`, so the Toolbar's handler sees
`defaultPrevented` and the native `focusgroup` path suppresses its move (research table: "keydown
`preventDefault()` on an item suppresses the move"); the two paths agree. `Menu.SubmenuTrigger` is
unaffected (it is inside a menu, never a toolbar item).

`Popover.Trigger`, `Dialog.Trigger`, `Tooltip.Trigger`, `Combobox.Trigger` and `Select.Trigger`
handle no arrow keys and need no change.

---

## 8. `experimental_focusgroup`

Conventions 8: a prop on the part that renders the attribute, off by default, feature-detected only
when on, never changing server markup.

| Part | Renders (every engine, flag on) | Where native (Chromium 150+) |
| --- | --- | --- |
| `Toolbar.Root` | `focusgroup="toolbar inline\|block wrap\|nowrap"` (`block` for vertical; `nowrap` when `loop={false}`) | the engine writes no `tabindex` and handles no navigation key; the browser gives one Tab stop with memory, arrows (mirrored in RTL), Home / End, skips `disabled`, keeps `aria-disabled`, leaves arrows to text inputs and moves Tab between items after one (research 1.3 table) |
| standalone `ToggleGroup.Root` | `focusgroup="toolbar inline\|block wrap\|nowrap nomemory"`, plus `focusgroupstart` on the first pressed enabled Item (document order; none when nothing is pressed, so entry is the first Item) | same; `nomemory` + `focusgroupstart` make Tab enter on the pressed Item (Tabs' trick), not the last focused one |
| `ToggleGroup.Root` inside a Toolbar | **nothing**, whatever its prop says (dev warning when set) | the Items are plain members of the Toolbar's focusgroup; a nested `focusgroup` would opt out of the ancestor and add Tab stops (research finding 1) |

The `toolbar` token on a `role="group"` element is a behaviour choice, not a semantic one: Chromium
infers a role only on a role-less element and an explicit `role` wins (probed), and the scoped
grammar has no `group` token. It is recorded as a risk: should the grammar change before WHATWG
#11723 lands, the attribute value changes, the flag's consumers do not.

Detection as Tabs and Menu: `useSyncExternalStore(subscribeNever, () => flag && "focusGroup" in
HTMLElement.prototype, () => false)`, the IDL name camel-cased (#43). The answer is passed to the
engine as `native` and, for ToggleGroup, to Items through context for `focusgroupstart`. Where the
answer is `false` (Firefox, WebKit, Chromium without the flag) the attribute is inert and the JS path
runs unchanged. Divergences between the paths that remain (none known after decision 7 and 6.3) are
to be recorded in `memo/developer/cross-engine.md` by the implementer.

---

## 9. ARIA and DOM output

| Part | Attributes |
| --- | --- |
| `ToggleGroup.Root` | `role="group"`, `data-orientation`, `data-pending`, `data-disabled`; standalone with the flag: `focusgroup`; `aria-label` / `aria-labelledby` pass through. **No `aria-orientation`** (not supported on `group`, research 1.2). |
| `ToggleGroup.Item` | `type="button"` (on a `<button>`), `aria-pressed="true" \| "false"` (optimistic, never `"mixed"`), `disabled`, `data-pressed`, `data-pending`, `data-disabled`, `data-orientation`; `tabindex` written by the engine on the JS path; `focusgroupstart` on the first pressed Item when standalone with the flag and native |
| `Toolbar.Root` | `role="toolbar"`, `aria-orientation` (always emitted, as Tabs.List), `data-orientation`; with the flag: `focusgroup`; `aria-label` / `aria-labelledby` pass through (required by APG; docs) |
| `Toolbar.Button` | `type="button"` (on a `<button>`), `aria-disabled="true"` when disabled (no native `disabled`), `data-pending`, `data-disabled`; `tabindex` by the engine |
| `Toolbar.Separator` | `<hr aria-orientation="vertical" \| "horizontal">` (perpendicular to the Toolbar), `data-orientation` (the same value) |

Ids: none are needed (no `aria-controls`, no labelling between parts). Items are registered by
element, not id.

---

## 10. ViewTransition

| Part | `transition` | What it animates |
| --- | --- | --- |
| `ToggleGroup.Item` | yes | the commit that ends the group's action (a spinner keyed on `pending` leaving, a rollback, a snap-back); never the optimistic flip, which is a CSS-transition job on `[data-pressed]` (Toggle 7.2) |
| `Toolbar.Button` | yes | the commit that ends its own action (content keyed on `pending`) |
| `ToggleGroup.Root`, `Toolbar.Root`, `Toolbar.Separator` | no | nothing library-driven changes inside them; `data-pending` on the Root is a CSS job |

Types (conventions 5.3): `fsui-toggle-group`, `fsui-toggle-group-press`, `fsui-toggle-group-release`
on every ToggleGroup dispatch; Toolbar adds none (`useActionTrigger` carries no types). The boundary
is rendered only when `transition` is given, static, with the usual mount-cost note (#35). Reduced
motion: the conventions 5.4 block in every example.

---

## 11. Async walkthroughs

### 11.1 Press an Item, async resolve (uncontrolled, multiple)

```
click Bold (optimistic {} → {bold})
  ├─ Root transition starts: types fsui-toggle-group, -press; setOptimistic({added:[bold], removed:[]})
  │  sync-lane commit: Bold aria-pressed=true data-pressed data-pending; Root data-pending
  │  valueChangeAction(["bold"], { added:["bold"], removed:[] }) awaited
  └─ resolve → setInternal(new Set(["bold"])) in a nested transition
     transition-lane commit: pending gone on Bold and Root
```

### 11.2 Exclusive switch, rejection

```
Left pressed (committed). click Center
  ├─ optimistic {left} → {center}: Left aria-pressed=false, Center aria-pressed=true data-pending, Root data-pending
  │  valueChangeAction("center", { added:["center"], removed:["left"] })
  └─ reject → optimistic reverts: Left pressed again, Center released; the error reaches the boundary above the Root
```

Focus stays on Center (the library never moves focus on rollback, RadioGroup 8); the Tab stop is
Left again at the next re-apply (standalone: pressed-first entry).

### 11.3 Two Items pressed quickly, resolved out of order (multiple)

```
click Bold   → patch1 {added:[bold]};   next1 = [bold]
click Italic → patch2 {added:[italic]}; next2 = [bold, italic]   (computed from the optimistic set)
resolve 2 → latest: setInternal({bold, italic}) queued (held while 1 pends)
resolve 1 → not latest: write skipped
one commit: both pressed, no pending
```

Reversed order gives the same end state. If action 1 rejects after 2 resolved, the shared hook throws
it from the Root's render (conventions 2.4) and the committed value is `{bold, italic}` (2's `next`
included Bold). The docs say: an action that can fail should not be stacked faster than it settles,
or should be controlled with the functional update.

### 11.4 Press, then press again before settle

```
click Bold   → {added:[bold]}, Bold pending
click Bold   → optimistic has bold → {removed:[bold]}, next = []; Bold NOT pending (optimistic == committed), Root pending
both resolve → committed [] (latest wins)
```

### 11.5 `Toolbar.Button` with a slow action, clicked twice

`useActionTrigger`: both runs execute; `data-pending` stays until both settle; the second run's
rejection is React's route, the first's is surfaced from render if it rejects. No optimistic state
(nothing to show).

### 11.6 Dependent content that suspends

A controlled parent that sets state in the sync prefix and renders `<Suspense><Preview styles={styles} /></Suspense>` elsewhere:
the Items flip at once, the old preview stays, the Root and the pressed Item show `data-pending`
until the new preview's data is ready, then both land in one commit. The required-coverage row.

---

## 12. Suspense, overlap, errors

- ToggleGroup has no content region; Items render from optimistic state and must not suspend
  (conventions 3.2). Content elsewhere keyed on the value is the consumer's and follows 11.6.
- No `use()` inside either component; no Suspense boundary is required during SSR.
- Errors: a ToggleGroup rejection reaches the boundary above `ToggleGroup.Root` (the owner); a
  `Toolbar.Button` rejection reaches the boundary above that button (the part owns the transition).
  Uncontrolled committed state is untouched by a rejection; a controlled parent vetoes by not
  updating. Caught-inside counts as success (conventions 2.4).
- Overlap: 5.4 and 11.3; `Toolbar.Button` as `Menu.Item`.
- Entanglement (conventions 2.3 item 5): a slow `valueChangeAction` holds every other transition in
  the app; the docs show `void save(next)` for fire-and-forget.

---

## 13. Server Components and directives

Every part file is `"use client"` (`toggle-group-root.tsx`, `toggle-group-item.tsx`,
`toggle-group-context.ts`, `toolbar-root.tsx`, `toolbar-button.tsx`, `toolbar-separator.tsx`,
`internal/toolbar-context.ts`, `internal/use-roving-focus.ts`); the two `index.ts` files carry no
directive. A Server Component renders any part with serialisable props and a Server Function as
`valueChangeAction` or `action` (2.6). `Toolbar.Separator` could be directive-free (it reads
`ToolbarContext` for its orientation, which makes it a client module per conventions 7.3); a
`Toolbar.Root` without hydration is still a labelled `role="toolbar"` of natively focusable controls
(6.4).

---

## 14. Test plan

`src/toggle-group/toggle-group.test.tsx`, `src/toolbar/toolbar.test.tsx` and
`src/internal/use-roving-focus.test.tsx` in jsdom; `src/toggle-group/toggle-group.browser.test.tsx`
and `src/toolbar/toolbar.browser.test.tsx` in browser mode (Chromium, Firefox, WebKit). Rows marked
(both) run under `renderBoth`. N/A rows for ToggleGroup: platform path (no residual browser path),
urgent action, continuous control, form channel, inside a Field (not a form control). N/A for
Toolbar: every action-state row except `Toolbar.Button`'s own sync / async / rejection / overlap /
superseded rejection, which `useActionTrigger` gives it (tested as for `Menu.Item`).

| # | Area | Project | Test |
| --- | --- | --- | --- |
| 1 | Roles and ARIA | jsdom | `ToggleGroup.Root` is `div[role="group"]` with `data-orientation`, no `aria-orientation`; Items are `button[type="button"][aria-pressed]`, never `"mixed"`; `data-pressed` / `data-pending` / `data-disabled` by presence. `Toolbar.Root` is `div[role="toolbar"][aria-orientation]`; `Toolbar.Button disabled` renders `aria-disabled="true"` and no `disabled`; `Toolbar.Separator` is `hr[aria-orientation]` perpendicular to the toolbar in both orientations. |
| 2 | Value model (both) | jsdom | Multiple: click dispatches `(next, { added, removed })` with `next` in document order and a fresh array; exclusive: switch carries both `added` and `removed`, deselect gives `null` with `removed: [prev]`; `deselectable={false}` dispatches nothing on the pressed Item; disabled Items (own and Root) never dispatch; `details.event` is the native click (asserted via `details.event`). |
| 3 | Async action (both) | jsdom | Deferred action: Item `aria-pressed` flips at once, `data-pending` on Root and the Item, sibling committed content unchanged; after resolve pending gone, content updated. Per-Item pending: a second click on the same Item clears its `data-pending` while the Root keeps it. |
| 4 | Rejection (both) | jsdom | Rejected action reaches `<ErrorCatcher>` above the Root; optimistic reverts; uncontrolled committed unchanged. Caught-inside resolves and commits. |
| 5 | Overlap | jsdom | Bold then Italic with two deferreds, resolved 2 → 1 and 1 → 2: final committed `[bold, italic]`; stacked patches re-base when 1 rejects. |
| 6 | Superseded rejection (both) | jsdom | Reject 1 after 2 resolved, and while 2 pends: the catcher records it; 2's outcome unaffected. |
| 7 | Suspending content (both) | jsdom | 11.6 with `createSuspender`. |
| 8 | Function props, `render` | jsdom | Root and Item `className` / `style` / `children` / `render` receive the documented state; `render={<MyButton />}` keeps dispatch, class merge, `ref`. `Toolbar.Button render={<a href />}` gets no `type`. |
| 9 | Post-await rule | jsdom | Controlled parent updating after `await` inside `startTransition` converges in one state. |
| 10 | Keyboard, standalone group | jsdom | Matrix `{horizontal, vertical} × {ArrowRight, ArrowLeft, ArrowDown, ArrowUp, Home, End}` with `loop` on and off; RTL swaps horizontal arrows (`direction: rtl` via style); disabled Items are skipped; arrows never dispatch; `preventDefault` on handled keys; modifier keys ignored. |
| 11 | Roving tab stop, standalone group | jsdom | After mount exactly one Item has `tabindex="0"`: the first pressed enabled Item, else the first enabled; it follows the optimistic pressed Item after a click (and reverts on rollback); an Item mounted later (child-only re-render) gets `tabindex="-1"` through the observer; an Item with its own `tabIndex={-1}` is skipped by arrows. Before the layout effect (SSR string) no `tabindex` is rendered. |
| 12 | Keyboard, Toolbar | jsdom | Same matrix over mixed children (`Toolbar.Button`, `Toggle`, plain `<button>`, `<a href>`, a disabled button, an `aria-disabled` `Toolbar.Button`): `disabled` skipped, `aria-disabled` reachable; memory: Tab out and back (focus `body`, then `tab()`) lands on the last focused item; first entry on the first enabled item; the remembered item unmounting moves the stop to the first enabled. |
| 13 | Text-entry items | jsdom | An `<input type="text">`, a `textarea`, a `[contenteditable]` and a `role="spinbutton"` in the toolbar: arrows and Home / End are not `preventDefault`ed and move nothing; Tab from the input moves to the next item, Shift+Tab to the previous; Tab from a last-placed input leaves the toolbar (focus not inside). |
| 14 | ToggleGroup inside Toolbar | jsdom | One `tabindex="0"` in the whole toolbar; Left / Right flow through the group's Items and out the other side; the group renders no `focusgroup` even with `experimental_focusgroup` (warns once), and `orientation` / `loop` on it warn and are ignored; group `data-orientation` equals the Toolbar's; disabled Items skipped; the group's clicks still dispatch with correct `next`. |
| 15 | `Menu.Trigger` in a Toolbar | jsdom | Horizontal: ArrowDown opens with the first item focused and the toolbar does not move (`defaultPrevented`); ArrowRight moves to the next item without opening. Vertical: ArrowRight opens with the first item focused (ArrowLeft under RTL); ArrowDown moves to the next item without opening; Enter still opens. Outside a toolbar: unchanged. A `Menu.Popup`'s items are not toolbar items (arrow from the trigger after close lands on the next toolbar item). |
| 16 | `experimental_focusgroup` tokens | jsdom | `Toolbar.Root` renders `toolbar inline wrap`, `toolbar block nowrap` for vertical + `loop={false}`; standalone group adds `nomemory` and `focusgroupstart` on the first pressed Item, none when nothing is pressed; JS navigation still works in jsdom (no `focusGroup`); nested group renders none. |
| 17 | Dev warnings | jsdom | `value` + `defaultValue` warns once; `exclusive` switch after mount warns; nested group's ignored props warn once each. |
| 18 | Directive | script | Every part file in `dist/toggle-group/`, `dist/toolbar/`, `dist/internal/use-roving-focus.mjs` and `dist/internal/toolbar-context.mjs` starts with `"use client"`; the two `index.mjs` do not. |
| 19 | `details.event` is virtual | jsdom | As Toggle row 21, for `ToggleGroupValueChangeDetails` and `ToolbarButtonActionDetails`. |
| 20 | Native focusgroup path | browser | Chromium: with the flag, one Tab stop from outside (a `<button>` before and after the toolbar; `page.keyboard.press("Tab")` counts), items carry no `tabindex`, arrows and Home / End move (RTL mirrored), `disabled` skipped and `aria-disabled` reached, Tab from an `<input>` item goes to the next item, the nested `ToggleGroup` adds no Tab stop, Tab re-enters on the last focused item; standalone group: Tab enters on the pressed Item. Firefox and WebKit (`focusGroup` absent, `src/__tests__/engine.ts`): the same assertions hold through the JS path with the attribute inert. |
| 21 | JS path parity | browser | Without the flag, Chromium runs the JS path: the row-20 assertions hold identically (guards decision 7 and 6.3 across paths). |
| 22 | Safari click focus | browser | WebKit: clicking an item (which does not focus it) still makes it the Tab stop (`pointerdown` memory): Tab from outside lands on it. |
| 23 | ViewTransition | browser | `{show && <ToggleGroup.Item />}` and `{show && <Toolbar.Button />}` mounted in a `startTransition`: `document.startViewTransition` called zero times without `transition`, once with `transition="none"` (conventions 10.1). |
| 24 | Engine unit | jsdom | `use-roving-focus.test.tsx`: item discovery (focusable set, `[popover]` / `dialog` / nested toolbar / `inert` / `tabindex="-1"` exclusions), `entry` and `memory` modes, re-apply on observer records, `native: true` writes nothing. |

ViewTransition behaviour beyond row 23 is observed in the docs examples, as for every component.

---

## 15. Docs pages

- `packages/docs/src/pages/ToggleGroupPage.tsx` at `/components/toggle-group`: intro, the 2.1
  formatting example (`ToggleGroupStyles.tsx`, fake async save with a pending spinner, inside
  `DemoErrorBoundary`), the 2.2 alignment example with `exclusive` and the `deselectable={false}`
  variant (`ToggleGroupAlignment.tsx`), the controlled diff pattern of 2.3, anatomy, props tables for
  Root (both variants, with the `exclusive` discriminant explained), Item, state / data attributes,
  keyboard table 7.1, a "When to use RadioGroup instead" callout (research 1.2), the
  `experimental_focusgroup` note, the reduced-motion block.
- `packages/docs/src/pages/ToolbarPage.tsx` at `/components/toolbar`: intro, the 2.4 editor toolbar
  (`ToolbarEditor.tsx`: two groups, separators, a `Menu.Trigger`, `Toolbar.Button`s with a fake
  async action and an `aria-disabled` one, a text input last), the 2.5 vertical toolbar
  (`ToolbarVertical.tsx`), anatomy, props tables for Root / Button / Separator, keyboard tables 7.2
  to 7.4, the "one text-entry control, last" and "label the toolbar" callouts, a "before hydration
  every item is a Tab stop" note, CSS for the `<hr>` separator, the flag note.
- `packages/docs/src/navigation.ts`: `ToggleGroup` after `Toggle`, `Toolbar` after `Menu` in
  `componentNavItems`; routes in `App.tsx`.
- `ExperimentalPage.tsx`: two rows for `Toolbar.Root experimental_focusgroup` and
  `ToggleGroup.Root experimental_focusgroup`.
- `MenuPage.tsx`: a short "Inside a Toolbar" note with the 7.4 table.
- `TogglePage.tsx`: a cross-link ("several toggles that share a value: ToggleGroup").
- `RoadmapPage.tsx`: move ToggleGroup out of "more components" into the shipped list with Toolbar.
- `packages/example`: a page combining both with the Tooltip toolbar demo's icons, so the
  cross-engine behaviour of the Toolbar can be checked by hand.

---

## 16. Implementation notes

### 16.1 Files

```
packages/ui/src/internal/
  toolbar-context.ts          # "use client": ToolbarContext = createContext<{ orientation } | null>(null); useToolbarContext()
  use-roving-focus.ts         # "use client": the engine (6.2); exports isTextEntryItem for tests
  use-roving-focus.test.tsx
packages/ui/src/toggle-group/
  index.ts
  toggle-group-context.ts     # "use client": optimistic + committed sets, toggle(value, event), disabled, orientation, nativeFocusgroup, focusgroupStartValue, register(element, value)
  toggle-group-root.tsx       # "use client"
  toggle-group-item.tsx       # "use client"
  toggle-group.test.tsx
  toggle-group.browser.test.tsx
packages/ui/src/toolbar/
  index.ts
  toolbar-root.tsx            # "use client"
  toolbar-button.tsx          # "use client"
  toolbar-separator.tsx       # "use client"
  toolbar.test.tsx
  toolbar.browser.test.tsx
```

`tsdown.config.ts` gains `src/toggle-group/index.ts` and `src/toolbar/index.ts`; both `index.ts`
import `../internal/platform-attributes.js` for the `focusgroup` / `focusgroupstart` typing
(conventions 7.4; `focusgroupstart` is added to the augmentation if Tabs has not already).

### 16.2 `ToggleGroup.Root`

- `useControllableAction<ReadonlySet<string>, ToggleGroupValueChangeDetails>` over the internal
  set (`controlled` mapped from `value`, `defaultValue` mapped the same way, `initialValue` an
  empty set), `reducer` = `reduce` of 5.2, `transitionTypes` from `added` / `removed`,
  `warn: { component: "ToggleGroup", prop: "value" }`. The action wrapper converts `next` to the
  consumer's shape (`string[]` in document order, or `string | null`) before calling
  `valueChangeAction`.
- `toggle(value, event)` (context): computes the patch per the 5.2 table against `optimistic`,
  returns without dispatching for the no-op cases, else `dispatch(reduce(optimistic, patch),
  createActionDetails(event, patch))`.
- `const toolbar = useToolbarContext()`; `inToolbar = toolbar !== null`. Standalone:
  `useRovingFocus(rootRef, { orientation, loop, native, entry: pressedFirst, memory: false })` and
  its handlers in `libraryProps`; inside a Toolbar: no engine, no handlers, `orientation =
  toolbar.orientation`, and `useDevWarning` for each of `orientation`, `loop`,
  `experimental_focusgroup` when passed.
- Registration: `register(element, value)` adds to a `Map<HTMLElement, string>` in a ref and returns
  the cleanup; the Item merges it into its ref with `useMergedRef`. Document order at dispatch:
  `[...map].sort((a, b) => a[0].compareDocumentPosition(b[0]) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)`.
- `focusgroupStartValue` (standalone, flag on, native): the first pressed enabled value in the
  current order, or `null`.

### 16.3 `ToggleGroup.Item`

- Reads context; `pressed = optimistic.has(value)`; `pending` per 5.3; `disabled = ctx.disabled
  || props.disabled`.
- Renders exactly what `Toggle` renders (same `useRender` call shape, `rendersButton`, owned keys)
  with `onClick: (e) => { if (disabled) return; ctx.toggle(value, e.nativeEvent); }` and
  `focusgroupstart` when `ctx.focusgroupStartValue === value`. The implementer may lift Toggle's
  attribute block into an internal helper (`internal/toggle-button-props.ts`) used by both; the
  public `Toggle` is unchanged either way.
- `useTransitionBoundary("ToggleGroup.Item", transition, element)`.

### 16.4 `Toolbar.Root`

- `useRovingFocus(rootRef, { orientation, loop, native, entry: firstEnabled, memory: true })`;
  provides `ToolbarContext` `{ orientation }` (memoised).
- `focusgroup` token string as Tabs.List builds it, without `nomemory`.

### 16.5 `Toolbar.Button`

- `const { pending, run } = useActionTrigger();` `onClick: (e) => { if (disabled) return;
  run(() => action?.(createActionDetails(e.nativeEvent, {}))); }`. `aria-disabled` instead of
  `disabled`; `type="button"` through `rendersButton`.

### 16.6 `Menu.Trigger`

- `const toolbar = useToolbarContext();` In `onKeyDown`: `openKeys = toolbar?.orientation ===
  "vertical" ? { [rtl ? "ArrowLeft" : "ArrowRight"]: "first" } : { ArrowDown: "first", ArrowUp:
  "last" }` with `rtl` from `getComputedStyle(event.currentTarget).direction` at keydown. Nothing
  else in Menu changes; `menu.md` 3.2 and 5 get a one-line amendment on acceptance.

### 16.7 `useRovingFocus` sketch

```ts
"use client";
export function useRovingFocus(ref: RefObject<HTMLElement | null>, options: RovingFocusOptions) {
  const current = useRef<HTMLElement | null>(null);
  const managed = useRef(new WeakSet<HTMLElement>());
  const latest = useLatest(options);

  const apply = useEffectEvent(() => {
    const root = ref.current; if (root === null || latest.current.native) return;
    const items = itemsOf(root, managed.current);
    if (!latest.current.memory || current.current === null || !items.includes(current.current)) {
      current.current = latest.current.entry(items) ?? null;
    }
    for (const el of items) { managed.current.add(el); el.tabIndex = el === current.current ? 0 : -1; }
  });
  useLayoutEffect(() => { apply(); });                      // after every commit of the container
  useEffect(() => {                                          // children that change without the container
    const root = ref.current; if (root === null) return;
    const mo = new MutationObserver(apply);
    mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "hidden", "inert", "aria-disabled"] });
    return () => mo.disconnect();
  }, []);
  // onFocus / onPointerDown: if the target is an item of this root, current = item; apply().
  // onKeyDown: 6.2 and 6.3.
  return { onKeyDown, onFocus, onPointerDown };
}
```

`itemsOf` is the pure query of 6.2; `isTextEntryItem` the predicate of 6.3; both exported for the
unit test. `useEffectEvent` keeps `apply` stable for the observer.

---

## Conventions feedback (applied in this commit, pending acceptance of this design)

1. **1.1 part vocabulary**: `Item` row gains ToggleGroup's `button[aria-pressed]`; new `Button` row
   (`Toolbar.Button`: a pure-trigger `button` with `action`, focusable when disabled); `Separator`
   row notes the perpendicular `aria-orientation` inside a Toolbar.
2. **3.2 / 7.4**: a roving Tab stop over arbitrary children is urgent library state that lives
   outside React: the container writes `tabindex` through the DOM from layout effects, a
   `MutationObserver` and focus / pointer events, items render none, and library item parts omit
   `tabIndex` (new row in the 7.4 table; one sentence in 3.2 next to virtual focus).
3. **3.6**: `Toolbar.Button` joins Tabs as a part that uses `aria-disabled` because its pattern wants
   a focusable disabled control.
4. **4.1**: `pressed` row gains `ToggleGroup.Item`; `pending` row gains `ToggleGroup.Root` / `Item`
   and `Toolbar.Button`; `orientation` row gains both components' parts.
5. **5.3**: ToggleGroup's three types; Toolbar none.
6. **7.1**: `internal/toolbar-context.ts` as the second cross-folder context (read by
   `ToggleGroup.Root`, `Toolbar.Separator` and `Menu.Trigger`).
7. **8 flag table**: `Toolbar.Root experimental_focusgroup` and `ToggleGroup.Root
   experimental_focusgroup` on the `focusgroup` row, with the nested-group rule.
8. **9.1 layout**: `use-roving-focus.ts` and `toolbar-context.ts` under `internal/`.
9. **Header**: the amendment note for #66, marked as pending the design's acceptance.

Nothing in `ChangeReason`, the action signature, the state triple or the Suspense stance changes.

---

## Recommendations for the product owner

1. **Exclusive mode deselects by default.** A pressed `aria-pressed` button can always be released,
   and that is what the button announces; `deselectable={false}` (exclusive variant only) is the
   opt-out for view switchers, documented as "prefer RadioGroup for an exclusive form choice".
   Alternative: default `false` (React Aria's `disallowEmptySelection` is opt-in too, so this is the
   ecosystem's default as well).
2. **`exclusive` is the discriminant, multiple is the default** (`value: string[]`), as Accordion
   and as the Toggle design forecast, rather than Base UI's `multiple` flag with single as default.
3. **Toolbar `loop` defaults to `true`** (Tabs, Menu, Base UI, Radix), overriding the native
   `focusgroup="toolbar"` default with the `wrap` token so the two paths agree. Alternative:
   `false`, matching the platform and React Aria.
4. **`Menu.Trigger` in a vertical Toolbar opens on the inline-end arrow** (ArrowRight; ArrowLeft in
   RTL) with the first item focused and leaves Up / Down to the Toolbar; horizontal is unchanged
   (7.4). Alternative: no arrow opening in a vertical toolbar (Enter / Space only).
5. **A ToggleGroup inside a Toolbar is transparent to the arrows** (no second axis within the
   group, 7.3), diverging from the APG example's nested radiogroup on purpose.
6. **One roving engine that writes `tabindex` through the DOM** for both the Toolbar and a
   standalone ToggleGroup, instead of item wrapper parts (6.1). Consequences to accept: before
   hydration every item is a Tab stop; an item's own `tabIndex` prop is unsupported in a toolbar;
   a `MutationObserver` per container. This is the decision I would escalate to the user if any:
   it is the first library-written attribute on elements the library did not render.
7. **Text-entry items keep their arrows and Tab moves to the next item from them** (6.3), matching
   Chromium's native toolbar focusgroup; the docs carry APG's "one such control, last".
8. **`Toolbar.Button` ships as the library's first plain action button**, scoped to the Toolbar
   (focusable-disabled, `useActionTrigger`, `data-pending`); a general `Button` stays a separate
   design. `Toolbar.Separator` is an `<hr>` with perpendicular `aria-orientation`. No `Toolbar.Link`,
   `Toolbar.Group` or `Toolbar.Input`.
9. **`Toggle` is unchanged**; `ToggleGroup.Item` renders the same element through the same
   attribute block, and `Menu.Trigger` gains only a `ToolbarContext` read.
10. **`experimental_focusgroup` on both Roots** with the `toolbar` token under an explicit
    `role="group"` for the standalone ToggleGroup (`nomemory` + `focusgroupstart` on the first pressed
    Item), and a dev warning plus no attribute on a nested group.
11. **No `Label` parts and no missing-label warning**: both Roots are named through `aria-label` /
    `aria-labelledby` pass-through, with the docs insisting on it. Alternative: a dev warning on an
    unnamed `Toolbar.Root` (APG requires the name) — cheap to add if wanted.
12. **ToggleGroup has no form participation and no `details.reason`** (no residual browser path);
    `ToggleGroupValueChangeDetails` is `{ added, removed }` and can grow.
