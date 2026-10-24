# CheckboxGroup

Status: **accepted** (2026-10-17, GitHub issue #33; the product owner accepted all eight questions
as recommended, see the end of this document; the implementation-review corrections of
`memo/reviewer/checkbox-group.md` and the product owner's decision on disabled Items under a
Parent (decision 9) were folded in the same day from the landed fix, a58143a). Follows
`design/conventions.md` (accepted);
where this document and the conventions disagree, the conventions win. **Read
`design/components/radio-group.md` first**: it specifies the `<fieldset>` Root + `Label`
(`<legend>`) + native-input `Item` anatomy, the one-dispatch-per-group residual browser paths
(mount reconciliation, form reset) through `useNativeGroupReconciliation`, and the
`checked={optimistic}` rule for controlled native inputs. Then `design/components/checkbox.md`
for `indeterminate`. This document repeats only what differs and adds the multi-value state, the
`Parent` part and group-level `required`.

Inputs: `docs/vision.md`, `design/conventions.md` (3.8 in particular), `docs/research/form-controls.md`
§4 ("Mixed state and CheckboxGroup", binding), `design/components/checkbox.md` §10 (what Checkbox
left room for), `design/components/accordion.md` 2.2 and 4.1 (the set-valued reducer and the
functional-update recipe), the implemented `packages/ui/src/radio-group/*` and
`packages/ui/src/internal/use-native-*.ts`, the WAI-ARIA APG Checkbox pattern and its
"Checkbox Example (Mixed-State)", prior art (Base UI `CheckboxGroup` with `allValues` and
`Checkbox.Root parent`, React Aria `CheckboxGroup`, Ark UI `CheckboxGroup`), react-dom 19.3.1
source (`restoreControlledInputState`), and working notes in
`memo/architect/checkbox-group-notes.md`.

CheckboxGroup is RadioGroup with a set instead of a single value, plus two things the platform
does not have: a mixed-state checkbox that controls a subset of the group (the APG tri-state
"select all"), and an "at least one" constraint. Everything native stays native: each box is a
real `<input type="checkbox">` with the group's `name`, so `FormData.getAll(name)` is the value,
labels and `required` validation are the browser's, and an action-less group works before
hydration.

## Decisions at a glance

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Anatomy | `CheckboxGroup.Root` (`<fieldset>`, native role `group`), `CheckboxGroup.Label` (`<legend>`, optional, first child), `CheckboxGroup.Item` (`<input type="checkbox">`, one per value), `CheckboxGroup.Parent` (`<input type="checkbox">` whose checked/mixed state is **derived** from the group and whose click sets a whole subset). No `Indicator` (conventions resolved question 16). A plain `Checkbox` rendered inside a `Root` is **not** a member; membership is explicit through `Item`. |
| 2 | State | One library-owned state, `value: string[]`, as `value` / `defaultValue` (default `[]`) / `valueChangeAction(next, details)`. Internally a `ReadonlySet<string>`; duplicates are dropped; `next` is a fresh array in **document order of the Items**. Equality everywhere (no-op rule, reconciliation) is set equality. |
| 3 | Details | `CheckboxGroupValueChangeDetails = { reason, added: string[], removed: string[] }`. An Item click has one entry in one of them; a Parent click has its whole subset; a platform path has the diff against what the user intends. The optimistic reducer applies `added` / `removed` as a **patch**, so stacked dispatches re-base (conventions 3.4). |
| 4 | Rendered DOM state | Every Item renders `checked={optimistic.has(value)}`; the Parent renders `checked={all}` and `el.indeterminate = some && !all` through `useNativeChecked`. Both are correctness requirements (`form-controls.md` §2). |
| 5 | Parent | Takes `values: string[]` (the subset it controls). `checked` = every value in the optimistic set; `indeterminate` = some but not all, **not suspended while pending** (it is derived from optimistic state, unlike Checkbox's consumer-owned prop). Click follows the APG mixed-state example: mixed → check all; checked → uncheck all; unchecked → restore the last partial combination of its values the group *committed* (the mount-time one counts), else check all. Renders no `name`, so it never posts. |
| 6 | Group `required` | `required` on Root means "at least one". No native group constraint exists, so the Root renders native `required` on every Item **only while the optimistic set is empty**. Validation, `:user-invalid` and the (localised) browser message stay native; after one box is checked nothing is required. No `aria-required` on the fieldset: ARIA does not allow it on role `group`. Before hydration the attribute is static (every box required while empty), the safe direction. |
| 7 | Per-item pending | `Item`: `pending && optimistic.has(value) !== committed.has(value)` (Accordion 4.2); `Parent`: `pending` and any of its values differs between optimistic and committed; `Root`: `useTransition`. |
| 8 | Residual browser paths | Mount reconciliation and form reset through `useNativeGroupReconciliation` on the fieldset, one dispatch per group, with a new `equals` option (set equality). A pre-hydration click on a `Parent` is folded into the Root's mount dispatch as that Parent's semantic (check all / uncheck all), never as "one box flipped". |
| 9 | Partial hydration | **Supported**, unlike RadioGroup: react-dom's same-`name` restore (and its "Mixing React and non-React radio inputs" throw) is radio-only (`restoreControlledInputState`, 19.3.1). Late-mounting Items and Parents report through `onItemMounted` and are reconciled; no dev warning. |
| 10 | Keyboard | Entirely native: every box is a tab stop, Space toggles, Enter is implicit form submission. No arrow navigation (APG has none for checkbox groups), no `focusgroup`, no `orientation`. |
| 11 | Disabled | `Root disabled` → `<fieldset disabled>`; `Item` / `Parent` `disabled` → native, owned. Disabled boxes are barred from constraint validation (platform). A form reset still resets a disabled group and the group follows it (RadioGroup 5.3). |
| 12 | Transition types | `fsui-checkbox-group`, plus `fsui-checkbox-group-check` when `added` is non-empty and `fsui-checkbox-group-uncheck` when `removed` is non-empty (a reset can carry both). `transition` on `Item` and `Parent` (settle only); none on `Root` / `Label`. |
| 13 | Files | `src/checkbox-group/`: `index.ts` (no directive), `checkbox-group-context.ts`, `-root.tsx`, `-label.tsx`, `-item.tsx`, `-parent.tsx` (all `"use client"`), tests. Exports `CheckboxGroup`, `CheckboxGroupRootProps/State`, `CheckboxGroupLabelProps`, `CheckboxGroupItemProps/State`, `CheckboxGroupParentProps/State`, `CheckboxGroupValueChangeDetails`. |

Everything not listed (not disabled while pending, errors and rollback, `preventDefault()` rules
and the shared click guard, `render` restrictions for inputs and fieldsets, reset target by mode,
no `useFormStatus` coupling, the two Server Function channels) is identical to RadioGroup and is
not restated.

---

## 1. Anatomy

```tsx
import { CheckboxGroup } from "@funstack/ui/checkbox-group";

<CheckboxGroup.Root name="toppings" defaultValue={["cheese"]} valueChangeAction={saveToppings}>
  <CheckboxGroup.Label>Toppings</CheckboxGroup.Label>
  <label className="option">
    <CheckboxGroup.Parent values={["cheese", "ham", "olives"]} /> All toppings
  </label>
  <label className="option"><CheckboxGroup.Item value="cheese" /> Cheese</label>
  <label className="option"><CheckboxGroup.Item value="ham" /> Ham</label>
  <label className="option"><CheckboxGroup.Item value="olives" disabled /> Olives</label>
</CheckboxGroup.Root>
```

Rendered DOM (the `name` falls back to `useId()` when omitted):

```html
<fieldset>
  <legend>Toppings</legend>
  <label class="option">
    <input type="checkbox" data-indeterminate=""> All toppings      <!-- el.indeterminate = true after mount; no name -->
  </label>
  <label class="option"><input type="checkbox" name="toppings" value="cheese" checked data-checked=""> Cheese</label>
  <label class="option"><input type="checkbox" name="toppings" value="ham"> Ham</label>
  <label class="option"><input type="checkbox" name="toppings" value="olives" disabled data-disabled=""> Olives</label>
</fieldset>
```

| Part | Element | Role | Renders from | Notes |
| --- | --- | --- | --- | --- |
| `Root` | `fieldset` | `group` (native; no `role` attribute set) | pending, disabled | Owns state, context, the transition, the shared `name`, the reset listener, mount reconciliation and the `required` computation. `disabled` renders `<fieldset disabled>`. |
| `Label` | `legend` | names the group (native) | Root state | Optional; must be the **first child** of Root. Function `children` receive Root state (group-level spinner goes here). |
| `Item` | `input[type=checkbox]` | `checkbox` (native) | **optimistic** membership | `checked`, `data-checked`, `data-pending`, `data-disabled`, `required` (computed). Void element: no `children`. |
| `Parent` | `input[type=checkbox]` | `checkbox` (native; mixed through `el.indeterminate`) | **optimistic** derivation over its `values` | `checked`, `data-checked`, `data-indeterminate`, `data-pending`, `data-disabled`. No `name`: never submitted, never `required`. Void element. |

Why these four:

- **`Root` is a `<fieldset>`**, for the same three reasons as RadioGroup (legend naming,
  `disabled` inheritance, `.form` for the reset listener). Its implicit role is already `group`,
  which is what the APG asks for a checkbox group, so no `role` is written and `role` passes
  through.
- **`Item` is a separate part, not `Checkbox` reading a context.** Checkbox §10 sketched the
  other option (a `Checkbox` that discovers an enclosing group through context). It was not
  chosen because a member has no `checked` / `defaultChecked` / `checkedChangeAction` of its own
  (the Root owns all three), and a props type that accepts them and ignores them inside a group
  is the kind of ambiguity the conventions avoid. It also keeps a plain `Checkbox` inside the
  fieldset ("Remember my choice" under a list of toppings) a plain checkbox. The two parts share
  everything below the props (`useNativeChecked`, `guardCheckableChange`, `useRender`), as
  `RadioGroup.Item` does. Trade-off accepted: a second input-rendering part to document, and the
  Checkbox `render` recipes apply unchanged. Flagged in the questions.
- **`Parent` is a library part** rather than the consumer recipe in Checkbox 2.4. The recipe works
  for a `useState` parent, but a stand-alone `Checkbox` has its *own* transition: its click
  cannot dispatch into the group's `useTransition`, so the group's optimistic set, `data-pending`
  and latest-intent guard would not see it. A Parent that dispatches through the Root makes
  "select all" one state owner, one transition, one `data-pending`, and lets the APG restore
  cycle live where the committed value is. `values` is a required prop because the Root cannot
  know its universe at render time without registration, and registration cannot be
  server-rendered (the Parent's `checked` must be right in the HTML). Giving the subset to the
  Parent rather than `allValues` to the Root (Base UI) also allows several Parents, one per
  section, in one group (2.5). Trade-off: the consumer repeats the ids they already map over.
- **No `Indicator`**: conventions resolved question 16; the Checkbox CSS recipes (2.6, 2.7) apply
  to Item and Parent alike.

`Item` and `Parent` render `<ViewTransition>` as their outermost node only when `transition` is
given (conventions 5.1); `Root` and `Label` never do.

## 2. Usage

### 2.1 Uncontrolled, autosave with a Server Function (Server Component)

```tsx
// actions.ts
"use server";
export async function saveToppings(next: string[], details: { added: readonly string[]; removed: readonly string[] }) {
  await db.order.update({ toppings: next });
}
```

```tsx
// toppings.tsx — a Server Component
import { CheckboxGroup } from "@funstack/ui/checkbox-group";
import { saveToppings } from "./actions";

export function Toppings({ order, all }: { order: string[]; all: { id: string; name: string }[] }) {
  return (
    <CheckboxGroup.Root defaultValue={order} valueChangeAction={saveToppings} className="group">
      <CheckboxGroup.Label>Toppings</CheckboxGroup.Label>
      {all.map((t) => (
        <label key={t.id} className="option">
          <CheckboxGroup.Item value={t.id} className="cb" /> {t.name}
        </label>
      ))}
    </CheckboxGroup.Root>
  );
}
```

Each click checks the box at once, marks it and the Root `data-pending` until the server
responds, and rolls it back on failure (the error reaches the nearest Error Boundary). `details`
is serialisable (`{ reason, added, removed }`; `event` is virtual, conventions 2.2), so the Server
Function is passed directly.

### 2.2 Inside a form, no action (native submission)

```tsx
<form action={createOrder}>
  <CheckboxGroup.Root name="toppings" required>
    <CheckboxGroup.Label>Toppings (choose at least one)</CheckboxGroup.Label>
    <label><CheckboxGroup.Item value="cheese" /> Cheese</label>
    <label><CheckboxGroup.Item value="ham" /> Ham</label>
  </CheckboxGroup.Root>
  <SubmitButton />  {/* useFormStatus().pending */}
</form>
```

Posts `toppings=cheese&toppings=ham` (`formData.getAll("toppings")`). With nothing checked,
`required` blocks submission natively and the boxes match `:user-invalid` after the attempt
(section 7). After a successful action React resets the form and the group follows the reset
(section 8.2). The group's own `data-pending` never appears: there is no change action.

### 2.3 Controlled, local state

```tsx
const [toppings, setToppings] = useState<string[]>([]);
<CheckboxGroup.Root value={toppings} valueChangeAction={(next) => { setToppings(next); }}>
```

The write is in the sync prefix, so it is a transition update; dependent content that suspends
keeps the old UI and the Root shows `data-pending` (RadioGroup 9.2 applies unchanged).

### 2.4 "Select all" with a Parent

```tsx
const ids = rows.map((r) => r.id);

<CheckboxGroup.Root value={selected} valueChangeAction={(next) => { setSelected(next); }}>
  <CheckboxGroup.Label className="sr-only">Rows</CheckboxGroup.Label>
  <label><CheckboxGroup.Parent values={ids} className="cb" /> Select all</label>
  {rows.map((row) => (
    <label key={row.id}><CheckboxGroup.Item value={row.id} className="cb" /> {row.title}</label>
  ))}
</CheckboxGroup.Root>
```

The Parent shows the dash as soon as any row is optimistically checked, checks itself when every
row is, and its click dispatches one `valueChangeAction` with `added` or `removed` listing every
affected row. Compared with Checkbox 2.4 (the consumer recipe): no `Set` juggling, one transition
for the whole group, and the Parent participates in `data-pending` and rollback.

### 2.5 Section parents (several Parents in one group)

```tsx
<CheckboxGroup.Root name="perm" defaultValue={user.permissions} valueChangeAction={savePermissions}>
  <CheckboxGroup.Label>Permissions</CheckboxGroup.Label>
  <label><CheckboxGroup.Parent values={["users:read", "users:write"]} /> Manage users</label>
  <label className="indent"><CheckboxGroup.Item value="users:read" /> Read</label>
  <label className="indent"><CheckboxGroup.Item value="users:write" /> Write</label>
  <label><CheckboxGroup.Parent values={["billing:read", "billing:write"]} /> Manage billing</label>
  <label className="indent"><CheckboxGroup.Item value="billing:read" /> Read</label>
  <label className="indent"><CheckboxGroup.Item value="billing:write" /> Write</label>
</CheckboxGroup.Root>
```

Each Parent derives from and dispatches for its own `values`; a Parent whose `values` is the
union of the sections is a grand-parent. Nesting is a matter of which values are listed, not of
DOM structure.

### 2.6 Controlled, server-backed ("update on success"): use the diff

```tsx
<CheckboxGroup.Root
  value={toppings}
  valueChangeAction={async (next, details) => {
    await save(details.added, details.removed);
    // Functional update keyed by what changed, never `setToppings(next)`: two overlapping
    // actions that complete out of order would otherwise land the older whole set last
    // (conventions 2.5; Accordion 2.2).
    startTransition(() =>
      setToppings((prev) => [
        ...prev.filter((v) => !details.removed.includes(v)),
        ...details.added.filter((v) => !prev.includes(v)),
      ]),
    );
  }}
>
```

This is the reason `details` carries `added` / `removed` rather than `item` / `checked`: the same
recipe covers an Item, a Parent and a reset without a branch. Uncontrolled mode needs none of
this (the latest-dispatch guard commits the latest `next`, which was computed from the optimistic
set and therefore already includes the earlier clicks).

### 2.7 Styling

The Checkbox recipes (2.6 for the input itself, 2.7 for a sibling indicator through `:has()`)
apply to `Item` and `Parent` as they are. Group-level hooks:

```css
.group[data-pending] { cursor: progress; }
.group:has(.cb:user-invalid) legend { color: var(--danger); }          /* empty required group after a submit attempt */
.option:has(.cb[data-pending]) .spinner { display: inline; }
.cb[data-indeterminate]::before, .cb:indeterminate::before { /* the dash; attribute works before hydration */ }
```

Tailwind: `checked:bg-accent indeterminate:bg-accent data-pending:animate-pulse` on an input,
`has-[:checked]:font-semibold` on a label.

---

## 3. Props and types

Shared types come from `packages/ui/src/internal/types.ts` (conventions 2.2, 9.4).

### 3.1 `CheckboxGroup.Root`

```ts
export interface CheckboxGroupValueChangeDetails extends ActionDetails {
  /**
   * Library-wide vocabulary (conventions 2.2). "activate": the user toggled an Item or a Parent
   * (click, Space, label click; `event` is the native `click`). "platform": the browser changed
   * the checked boxes: a form reset (`event` is the `reset` event), or clicks before hydration /
   * Firefox form-state restoration reconciled at mount (`event` is `undefined`).
   */
  readonly reason: ChangeReason;
  /** Values this dispatch checked, in document order of their Items (a Parent's values with no Item last). */
  readonly added: readonly string[];
  /** Values this dispatch unchecked, same order. */
  readonly removed: readonly string[];
}

export interface CheckboxGroupRootState {
  /**
   * Optimistic checked values, in document order of the Items **as of the Root's last render**
   * (values with no Item last). Items reordered by a component that re-renders without the Root
   * keep the previous order here until the Root renders again; `next` and `details` of
   * `valueChangeAction` always read the current DOM order. The server render and the first
   * client render use the value's own order. Content rendered from it must not suspend.
   */
  readonly value: readonly string[];
  /** An action dispatched through this group is in flight. */
  readonly pending: boolean;
  readonly disabled: boolean;
}

export interface CheckboxGroupRootProps
  extends Omit<
    ComponentPropsWithRef<"fieldset">,
    "className" | "style" | "children" | "defaultValue" | "defaultChecked" | "name" | "disabled" | "form"
  > {
  /** Controlled checked values. `[]` checks nothing; `undefined` means uncontrolled. Order is not significant; duplicates are ignored. */
  value?: string[];
  /** Initial values in uncontrolled mode. Defaults to `[]`. Also the form-reset target (latest value). */
  defaultValue?: string[];
  /**
   * Runs inside the Root's transition whenever the set of checked boxes changes. May be sync or
   * async (also a Server Function); rejections reach the nearest Error Boundary and roll the
   * change back. `next` is the whole set as a fresh array in document order; `details.added` /
   * `details.removed` say what changed. A `setState` after your own `await` is not a Transition
   * update; wrap it in `startTransition`. Prefer a functional update keyed by `added` / `removed`
   * when controlled (section 2.6).
   */
  valueChangeAction?: ChangeAction<string[], CheckboxGroupValueChangeDetails>;
  /** The `name` shared by every Item (form data key: `formData.getAll(name)`). Defaults to a `useId()` value. */
  name?: string;
  /** The `form` attribute, applied to the fieldset and to every Item. */
  form?: string;
  /**
   * "At least one Item must be checked." Rendered as native `required` on every Item while no
   * **enabled** Item's value is checked, and on none once one is (section 7): values with no
   * Item and checked disabled Items (neither is submitted) do not satisfy it. Until the Items
   * have registered (server HTML, hydration render) any checked value satisfies it. Not exposed
   * on the fieldset (ARIA allows `aria-required` on `checkbox` and `radiogroup`, not on `group`).
   */
  required?: boolean;
  /** Renders `<fieldset disabled>`: every Item and Parent is disabled and unfocusable. */
  disabled?: boolean;
  className?: StateValue<string | undefined, CheckboxGroupRootState>;
  style?: StateValue<CSSProperties | undefined, CheckboxGroupRootState>;
  children?: StateValue<ReactNode, CheckboxGroupRootState>;
  /** Must keep a `<fieldset>`. */
  render?: RenderProp<ComponentPropsWithRef<"fieldset">, CheckboxGroupRootState>;
}
```

`value` and `defaultValue` are `string[]` like Accordion's multiple mode, so a
`useState<string[]>` setter plugs into `valueChangeAction`. "None checked" is `[]`, never
`undefined` (conventions 3.1). No dev warning when neither `value` nor `defaultValue` is given:
an empty group is the HTML default (RadioGroup decision 2).

Owned keys on the fieldset: `disabled`, `form`, `data-pending`, `data-disabled`. `role` passes
through (the implicit role is already `group`); `aria-label` / `aria-labelledby` pass through for
groups without a `Label`. `onReset` is not omitted (the reset listener is attached through
`addEventListener`, RadioGroup 3.1).

### 3.2 `CheckboxGroup.Label`

Identical to `RadioGroupLabelProps` with `CheckboxGroupRootState`. Must be Root's first child.

### 3.3 `CheckboxGroup.Item`

```ts
export interface CheckboxGroupItemState {
  readonly value: string;
  /** Optimistic: true as soon as the user checks this box, before the action settles. */
  readonly checked: boolean;
  /** The Root is pending and this box's optimistic state differs from its committed state. */
  readonly pending: boolean;
  /** Disabled by its own prop or by `Root disabled`. */
  readonly disabled: boolean;
}

export interface CheckboxGroupItemProps
  extends Omit<
    ComponentPropsWithRef<"input">,
    | "type" | "name" | "value" | "checked" | "defaultChecked" | "defaultValue" | "form" | "required"
    | "aria-checked" | "onChange" | "className" | "style" | "children"
  > {
  /** The value this box contributes when checked. Must be unique within the Root. */
  value: string;
  /**
   * Native `disabled`: unfocusable, never dispatches, barred from validation. A `Parent` leaves
   * a disabled Item's value alone and derives its state without it (section 6.2); a checked
   * disabled Item does not satisfy the group's `required` (section 7).
   */
  disabled?: boolean;
  /** Forwarded to the Item's `<ViewTransition default>`; settle commit only (section 11). Same static rule as Checkbox. */
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, CheckboxGroupItemState>;
  style?: StateValue<CSSProperties | undefined, CheckboxGroupItemState>;
  /** Must keep an `<input>`; the library sets `type="checkbox"`. */
  render?: RenderProp<ComponentPropsWithRef<"input">, CheckboxGroupItemState>;
}
```

Owned keys: `type`, `name`, `value`, `checked`, `defaultChecked` (never rendered as a prop),
`disabled`, `form`, `required` (computed by the Root), `aria-checked` (removed),
`data-checked`, `data-pending`, `data-disabled`. `onChange` is merged (a `render` element's own
handler runs first). `role` passes through (`menuitemcheckbox` for a future Menu, as on
Checkbox). `required` is omitted from the Item's props on purpose: "this one box must be checked"
is a single-control constraint that belongs to a plain `Checkbox`, and inside a group it would
contradict the Root's "at least one".

### 3.4 `CheckboxGroup.Parent`

```ts
export interface CheckboxGroupParentState {
  readonly values: readonly string[];
  /** Every value in `values` is optimistically checked (`false` when `values` is empty). */
  readonly checked: boolean;
  /** Some but not all of `values` are optimistically checked. Never true together with `checked`. Not suspended while pending. */
  readonly indeterminate: boolean;
  /** The Root is pending and at least one of `values` differs between optimistic and committed. */
  readonly pending: boolean;
  readonly disabled: boolean;
}

export interface CheckboxGroupParentProps
  extends Omit<
    ComponentPropsWithRef<"input">,
    | "type" | "name" | "value" | "checked" | "defaultChecked" | "defaultValue" | "form" | "required"
    | "aria-checked" | "onChange" | "className" | "style" | "children"
  > {
  /**
   * The Item values this Parent controls (usually every Item of the group). Its checked and
   * mixed states are derived from them; its click checks or unchecks all of them (section 6).
   * Values with no Item are still added to / removed from the group's value.
   *
   * Values whose Items are disabled (their own `disabled` prop, not `Root disabled`) are left
   * alone: the click does not change them and the derivation ignores them, so the Parent shows
   * checked when every enabled Item is (section 6.2). When every value has only disabled Items
   * the Parent acts on all of them (disable the Parent to make it inert). Before hydration the
   * server-rendered state counts disabled Items too; it settles when the Items register.
   */
  values: string[];
  disabled?: boolean;
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, CheckboxGroupParentState>;
  style?: StateValue<CSSProperties | undefined, CheckboxGroupParentState>;
  /** Must keep an `<input>`; the library sets `type="checkbox"`. */
  render?: RenderProp<ComponentPropsWithRef<"input">, CheckboxGroupParentState>;
}
```

Owned keys: `type`, `name` (always removed: a Parent never posts), `value`, `checked`,
`defaultChecked`, `indeterminate` (stripped, the hook sets the property), `required` (always
removed), `form`, `autoComplete` (`"off"`, section 8.1), `disabled`, `aria-checked`,
`data-checked`, `data-indeterminate`, `data-pending`, `data-disabled`. `onChange` merged.

### 3.5 Namespace

```ts
export const CheckboxGroup = {
  Root: CheckboxGroupRoot,
  Label: CheckboxGroupLabel,
  Item: CheckboxGroupItem,
  Parent: CheckboxGroupParent,
} as const;
```

---

## 4. States

| State | Owner | Kind | Library-owned or browser-owned | Transition? |
| --- | --- | --- | --- | --- |
| `value` (set of checked values) | `Root` | `ReadonlySet<string>` internally, `string[]` at the API | **Library-owned** through controlled native inputs (`checked={optimistic.has(value)}` on every Item), with the two residual browser paths (section 8). | Yes: every Item or Parent click, every platform dispatch. |
| `pending` | `Root` | boolean | Library-owned (`useTransition`) | n/a |
| Parent `checked` / `indeterminate` | `Parent` | derived | **Derived from `value`**; written to the DOM (`checked` prop, `el.indeterminate` through `useNativeChecked`) and re-applied after every commit. Not a fourth state: it has no prop, no default, no action. | n/a |
| `required` on Items | `Root` | derived | Derived from the `required` prop and "no value of an enabled Item is in the optimistic set" (`optimistic.size === 0` until the Items have registered, which is what the server can compute); rendered as the native attribute (section 7). | n/a |
| Item registry | `Root` | `Map<value, hasEnabledItem>` | Library-owned, private: each Item registers its value and its own `disabled` from a layout effect (a ref for the residual-path reads, state for render, published only when the summary changes; `null` until an Item registered so the server and hydration renders agree). Feeds the Parent's effective values and `required`. | n/a |
| Parent restore memory | `Parent` | `readonly string[] \| null` | Library-owned, private (a ref): the last partial combination of its `values` that the group **committed**, seeded at mount. Not exposed. | n/a |
| focus, validity, `:user-invalid` | DOM | | Browser-owned | |

State exposure (conventions 4.1), all booleans by presence:

| Attribute | On | Source | Pseudo-class equivalent |
| --- | --- | --- | --- |
| `data-pending` | `Root` | `useTransition` | – |
| `data-pending` | `Item`, `Parent` | per-part rule (decision 7) | – |
| `data-checked` | `Item`, `Parent` | optimistic | `:checked` (identical; see Checkbox for the `preventDefault()` caveat) |
| `data-indeterminate` | `Parent` | `some && !all` | `:indeterminate` (property set after mount; the attribute works before hydration) |
| `data-disabled` | `Root`, `Item`, `Parent` | prop (own or inherited) | `:disabled` (also sees fieldset inheritance) |
| – | `Item` | | `:required`, `:user-invalid` (section 7) |

---

## 5. The value model

### 5.1 Set, order, equality

The Root normalises `value` / `defaultValue` to a `ReadonlySet<string>` at the prop boundary
(`useMemo` keyed on `JSON.stringify(value)`, as Accordion and ToggleGroup do, so an inline array
with the same contents is unchanged; #108) and calls `useControllableAction` with the
set. `next` handed to `valueChangeAction` is `fromSet(set)`: a fresh array sorted by the document
order of the Items currently in the fieldset (read once per dispatch with
`fieldset.querySelectorAll('input[type="checkbox"]')` filtered by `name === groupName`, which
excludes Parents and nested groups); values with no Item keep their insertion order after them.
Document order matches `formData.getAll(name)`, so a consumer who compares `next` with the form
data sees the same sequence. `RootState.value` uses the same order but **as of the Root's last
render**: render cannot read the DOM, so the Root keeps the Items' order in state, refreshed by a
layout effect after each of its own commits only when the rendered value would change. Items
moved by a child that re-renders alone are picked up at the Root's next render; the server and
the first client render use the value's own order. Every comparison the library makes (the no-op rule, mount
reconciliation, reset) is **set equality**; consumers should treat `next` as a set too.

A controlled `value` with values that have no Item is preserved through toggles (an Item click
adds or removes one value and leaves the rest alone) and not submitted (only inputs post).

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

`useOptimistic` gets this reducer (conventions 3.4); the patch is `details` itself. Stacked
dispatches re-base: click A then B while A's save is in flight shows both checked, and if A
rejects, B's patch re-applies on top of the reverted base. Platform dispatches use the same patch
form (the diff against `base()`), so one reducer covers every path. (Accordion replaces the whole
set for its mount dispatch; here the diff is computed anyway, so the patch is used.)

```ts
// Root: Item toggle
function toggle(value: string, checked: boolean, event: Event): void {
  if (optimistic.has(value) === checked) return;           // no-op against optimistic (conventions 2.3 item 8)
  const patch = checked ? { added: [value], removed: [] } : { added: [], removed: [value] };
  dispatchPatch(patch, "activate", event);
}

// Root: shared
function dispatchPatch(patch: Patch, reason: ChangeReason, event: Event | undefined): void {
  const next = reduce(optimistic, patch);                   // from what the user sees and intends
  dispatch(fromSet(next), createActionDetails(event, { reason, ...patch }));
}
```

`transitionTypes` returns `["fsui-checkbox-group", ...(added.length ? ["fsui-checkbox-group-check"] : []), ...(removed.length ? ["fsui-checkbox-group-uncheck"] : [])]`.

### 5.3 Per-part pending

`Item.pending = ctx.pending && ctx.optimistic.has(value) !== ctx.committed.has(value)` (Accordion
4.2). Clicking A then A again before the first save resolves makes A not pending (optimistic
equals committed) while the Root still is; the second dispatch is a real one (`removed: [a]`)
and, being the latest, commits "no change". `Parent.pending` is the same test over any of its
`values`. The context therefore carries both the optimistic and the committed set; no part
renders committed state in the DOM, but Items and the Parent compare against it.

### 5.4 Overlap

- **Uncontrolled**: the latest dispatch's `next` was computed from the optimistic set, so it
  already contains the earlier in-flight clicks; the latest-dispatch guard commits it and the
  earlier `next`s are ignored. Correct by construction.
- **Controlled, sync prefix** (`setToppings(next)`): writes land in dispatch order; correct.
- **Controlled, update on success**: whole-value writes land in *completion* order and can lose a
  change; use the functional update of 2.6. Documented next to every such example.
- A superseded dispatch's rejection reaches the boundary through the shared hook (conventions 2.4).

---

## 6. `Parent`: the mixed-state checkbox

### 6.1 Derivation

```ts
// `effective`: the values the Parent acts on and derives from (6.2). Hydration renders use
// every value, as the server did.
const effective = hydrating ? values : enabledValues(values, ctx.disabledItems);
const inSet = effective.filter((v) => ctx.optimistic.has(v));
const checked = effective.length > 0 && inSet.length === effective.length;
const indeterminate = inSet.length > 0 && !checked;
```

Both read the **optimistic** set: the Parent is a trigger part and must respond at once
(`form-controls.md` §4: "a select-all parent computes from the group's optimistic set"). The DOM
gets `checked={checked}` as a controlled prop and `el.indeterminate = indeterminate` through
`useNativeChecked`, re-applied after every commit.

**`indeterminate` is not suspended while pending**, unlike Checkbox (`indeterminate && !pending`,
conventions 4.1). Checkbox suspends because its `indeterminate` is a consumer-owned prop that the
browser clears on the click and the parent may not have recomputed yet, so attribute, property and
pseudo-class could disagree for the whole pending window. Here the Root recomputes the Parent's
derivation synchronously from the optimistic set in the same sync-lane render that follows the
click, so the three always agree: on an Item click the dash appears or disappears immediately; on
a Parent click from mixed the browser sets `checked=true, indeterminate=false` and the optimistic
set (now containing every value) derives exactly that; on rollback the optimistic set reverts, the
Parent re-renders mixed and the hook's re-apply restores `el.indeterminate`. Suspending would only
take the dash away from a correct immediate state.

Chromium's "checked and indeterminate do not match `:checked`" quirk (conventions 4.2) cannot
arise: the Parent never renders both.

### 6.2 Click cycle (APG "Checkbox Example (Mixed-State)")

| Parent shows | Click dispatches | `details` |
| --- | --- | --- |
| mixed | check every value | `added: values − optimistic`, `removed: []` |
| checked | uncheck every value | `added: []`, `removed: values` |
| unchecked, with a remembered partial combination | restore it | `added: memory`, `removed: []` |
| unchecked, no memory | check every value | `added: values`, `removed: []` |

"Every value" in the table means the Parent's **effective** values (below). The memory is the
last **committed** partial combination of them (strictly
between none and all), updated in an effect on the committed set and seeded from the committed set
at mount, which makes "the default combination of states they had when the page loaded" (APG) fall
out of the same rule. It is committed, not optimistic, so a partial state that was only ever
pending and then rolled back is never restored. `values` empty: the Parent is unchecked, not
mixed, and clicks dispatch nothing (no-op). Space and click are the same native `click`
(`form-controls.md` §2).

Why the restore step is in by default: it is what the APG example does, the vision puts the APG
first, and Base UI's two-state behaviour is a subset a consumer gets by never leaving a partial
state committed. The cost, documented: from "none", a user who wants "all" after a remembered
partial clicks twice. Flagged in the questions (a `cycle={false}` prop would be a one-line
addition if the product owner prefers two-state).

**Disabled Items under a Parent** (product-owner decision 9, review M2). A disabled box is one the
user may not change; a "select all" that changed it would make the action save a value the form
never posts (disabled inputs are not submitted), so `next` and `FormData` would disagree. The
Parent therefore **ignores disabled Items**:

- Each Item registers its value and its **own** `disabled` prop with the Root from a layout
  effect (`Root disabled` is not an Item's own `disabled`: it disables the Parent too, and the
  derivation is unchanged). The Root publishes `disabledItems`: the values whose every mounted
  Item is disabled.
- The Parent's effective values are `enabledValues(values, disabledItems)`: `values` minus
  `disabledItems`; **values with no Item count as enabled** (nothing disables them). The Parent's
  `pending` (3.4) is still computed over **all** of `values`: a disabled Item's value cannot
  differ between optimistic and committed through the Parent, so the distinction never shows. The click cycle, the derivation, the restore
  memory and the pre-hydration report (8.1) all use them. A click from mixed checks only the
  enabled missing values; "uncheck all" leaves a checked disabled Item checked, and the Parent
  then shows unchecked (it derives without that Item).
- **When every value has only disabled Items** the effective values are all of `values`: a Parent
  the consumer left enabled over disabled Items still shows and changes their state. Disable the
  Parent to make it inert.
- **Hydration renders count disabled Items**, as the server did (the server cannot know which
  Items are disabled: the registry is `null` until the Items registered). The hydrated DOM
  `checked` is therefore comparable with the derivation for the pre-hydration report, also when a
  Parent hydrates late, after the Items registered; the Parent settles to the enabled-only
  derivation in the render after registration, without a dispatch or a warning.
- An Item's `disabled` changing after mount re-registers and the Parent follows.

### 6.3 Keyboard, AT and the pre-hydration gap

Native: Space toggles, the browser clears `indeterminate` on the click. AT hears `checked` from the
DOM at once; the mixed state reaches AT through the property (HTML-AAM maps `indeterminate` to
`aria-checked="mixed"`) after the first layout effect, so until hydration a mixed Parent is
announced as unchecked and only `data-indeterminate` shows the dash, exactly as for Checkbox
(section 4 there). `aria-checked` is owned and removed. Before hydration the Parent's `checked`
and `data-indeterminate` are the server's derivation over **all** of its values, disabled Items
included (the server cannot know which Items are disabled, 6.2); the enabled-only derivation
replaces it in the first client render after the Items register.

---

## 7. Group-level `required`

HTML has no "at least one checkbox" constraint: `required` on a checkbox makes *that* box
mandatory. The library's options, and the choice:

| Mechanism | Native message, localised | Works before hydration | `:user-invalid` | AT announcement | Cost |
| --- | --- | --- | --- | --- | --- |
| A. `required` on every Item (RadioGroup's rule) | yes | yes | yes | each box "required" | **wrong semantics**: every box must be checked. Rejected. |
| B. `setCustomValidity("…")` on the first Item while empty | no (needs a `requiredMessage` prop, consumer-localised) | no | yes, first box only | first box "invalid" | property must be re-applied after every commit; one more prop. |
| C. **native `required` on every Item only while no enabled Item is checked** (chosen) | yes | partly (see below) | yes, every box while empty | engine-dependent: the native constraint is exposed differently per engine (Chromium's accessibility tree shows an unchecked required checkbox as `invalid` and has no `required` property for a checkbox, not even with `aria-required`); the reliable announcement is the `Label` text or `aria-describedby` | wording: the browser says "check this box", not "check at least one"; attribute flips with state. |

C is chosen: it keeps validation, the bubble, `:user-invalid` and the AT state native and
localised, needs no new prop and no imperative DOM write, and expresses "at least one" exactly in
the validity model (while nothing is checked, submitting is blocked; once something is, nothing
is required). The attribute is rendered by the Root through context as `required` and "no value
of an **enabled** Item is in the optimistic set" (review L1): a value with no Item and a checked
**disabled** Item are not submitted, so neither satisfies "at least one". Until the Items have
registered (the server render, the hydration render) the rule is `optimistic.size === 0`, which
is what the server can compute; hydration then corrects it in the first client render. It
follows optimistic state: unchecking the last enabled box while its action is pending already
marks every box required, and a rollback un-marks them.

What is **not** done: `aria-required` on the fieldset. ARIA 1.2 lists `aria-required` for
`checkbox`, `combobox`, `gridcell`, `listbox`, `radiogroup`, `spinbutton`, `textbox` and `tree`;
role `group` is not among them, so RadioGroup's `aria-required="true"` on its `radiogroup` has
no counterpart here. The group-level announcement is therefore the consumer's: put it in the
`Label` ("Toppings (choose at least one)") or `aria-describedby` on the Root. The docs say so.

Before hydration the attribute is whatever the server rendered: every Item `required` when the
default set is empty, none otherwise. A user who checks one box before hydration and submits is
blocked on the next box until hydration completes; that is over-blocking, only until hydration.
**Under-blocking** exists in one window: the server HTML counts any checked value, so a default
set that holds only a value with no Item or only a checked disabled Item renders no `required`
until hydration corrects it (the same window as the over-blocking case, in the other direction).
Documented as a limitation of an action-less required group in a Server Component form.

Disabled Items are barred from constraint validation (platform), so `Root disabled` or every Item
disabled never blocks a submit. A `Parent` is never `required` (it is not a value).

---

## 8. Residual browser paths

Both paths are the Root's single `useNativeGroupReconciliation` call on the fieldset (conventions
3.8), with one addition to the shared hook: an `equals` option (`setsEqual`), because `Object.is`
on two sets is always false. Recorded in the conventions feedback. `readCurrent()` lays the
Items' `checked` (by `name`) **over `base()`**, so values with no Item (a Parent's extra values, a
controlled extra) survive a read that has no DOM to see them; `readDefault()` lays the Items'
`defaultChecked` (rule 5) over `base()` in controlled mode and over **`defaultValue`** in
uncontrolled mode (8.2); `base()` is `latestInFlight()` with the explicit null check (rule 1),
else the optimistic set. `onPlatformChange(next, event)` computes the patch as the diff between
`next` and `base()` and dispatches it with `reason: "platform"`.

### 8.1 Mount reconciliation, including a pre-hydration Parent click

Items use `useNativeChecked({ type: "checkbox", group: true, onItemMounted })`: no `checked`
write in the mount commit, so the Root's layout effect still reads the hydrated DOM (rule 3).
One dispatch per group covers any number of pre-hydration clicks on Items.

A `Parent` is not a member, and its pre-hydration click must mean what a Parent click means.
In its mount layout effect (children before parent, so before the Root's reconciliation) the
Parent compares the DOM `checked` with its derived `checked`; if they differ it reports
`{ values, checked: el.checked }` to the Root through context and then calls `onItemMounted`.
The Root's `readCurrent()` folds pending reports into the member read before the comparison:
`checked: true` adds every **enabled** value of that Parent (`enabledValues` over the registry
ref, which the Items of the same commit have already filled), `false` removes them; reports are
consumed on read. A Parent checked before hydration therefore checks only the enabled values, and
one unchecked before hydration keeps a checked disabled Item (6.2). So "clicked All before hydration" becomes one `"platform"` dispatch with
`added: values`, and the Parent re-renders from the group rather than keeping a lone checked
box over unchecked Items. A Parent that mounts after the Root (a late Suspense boundary) reports
the same way and the adapter's late path (`onItemMounted` → microtask → `readCurrent()`) picks the
report up. The Parent's `data-indeterminate` on the server is the derived value; the DOM `checked`
is kept by hydration and never diffed (no `suppressHydrationWarning` needed, as for Checkbox).

**The Parent renders `autocomplete="off"`** (owned; review H1). Firefox restores a checkbox's
`checked` across a reload from its form state, and the Parent is not a value: a user who
unchecks one Item (Parent mixed, DOM `checked=false`) and reloads would otherwise have Firefox
restore the Items *and* a Parent `checked=false` that the mount read takes for a pre-hydration
"uncheck all", emptying the group. With `autocomplete="off"` Firefox restores the Items only
(verified with Playwright: a nameless checkbox is restored, one with `autocomplete="off"` is not;
Chromium restores nothing on reload) and the Items' restored state is reconciled as the ordinary
platform dispatch. Pre-hydration Item clicks made after a Parent click are overridden by the
Parent's semantic (the report is applied after the DOM read); accepted (review L9).

**Late members** (8.3): when a member mounts after the Root reconciled, the Root snapshots the
Items' `checked` in the first late member's mount layout effect and the adapter's microtask read
uses that snapshot. Without it the registration re-render that follows the layout effects would
re-apply each Item's `checked` before the microtask and erase a click made before the Item
hydrated.

### 8.2 Form reset

As RadioGroup 5.2 with a set, with one difference per mode (review M1): in **uncontrolled**
mode `readDefault()` starts from **`defaultValue`** and lays the Items' `defaultChecked` over it
(the Items mirror `defaultValue.has(value)` into `el.defaultChecked` after every commit, so the
overlay agrees with the start set), so that values with no Item return to `defaultValue` too: a
Parent over `["a", "ghost"]` clicked, then `form.reset()`, ends on `defaultValue`, not on
`{ghost}`. In **controlled** mode it starts from `base()` (values with no Item are the parent's)
and lays the Items' mount-time `defaultChecked` over it (the per-Item caveat for Items added later
applies); the reset is offered to the parent as `"platform"` with the `reset` event. The Parent
mirrors `defaultChecked` from the derivation over `defaultValue` (effective values) in
uncontrolled mode; in controlled mode its React reset target can be stale (its `values` changed,
or it mounted after the Items with another value), so the Parent has its own `useFormReset` that
writes its derivation back into `el.checked` in its reset microtask, which runs **before the
Root's** (the Parent subscribed first: children mount before the parent); if the Root's microtask
then dispatches, the re-render re-applies `checked` from the new derivation anyway (review L2). A reset that
checks some boxes and unchecks others carries both `added` and `removed`. A cancelled `reset`
dispatches nothing. A disabled group still follows a reset (RadioGroup 5.3).

### 8.3 Partial hydration is supported

RadioGroup documents "keep every Item in the Root's Suspense boundary" because react-dom's
controlled-input restore for a radio with a `name` walks every same-`name` radio in the root and
throws when one has no fiber (`restoreControlledInputState`, 19.3.1). That branch is guarded by
`"radio" === props.type`; for a checkbox the restore touches the target only. A click on a
hydrated Item while sibling Items are still dehydrated therefore works, and Items that hydrate
later are reconciled through `onItemMounted` (and sync their `data-*` presence on mount, as
`RadioGroup.Item` does, since hydration keeps server attributes). No partial-hydration dev
warning is emitted, and the docs recommend one boundary only for simplicity, not correctness.

---

## 9. Keyboard and ARIA

APG patterns: Checkbox (two-state for Items, mixed-state for the Parent). There is no APG
"checkbox group" widget pattern; a `<fieldset>` + `<legend>` (role `group`, named by the legend)
is the APG's own grouping advice.

| Key | Effect | Dispatches? |
| --- | --- | --- |
| `Tab` / `Shift+Tab` | Moves between boxes: every enabled Item and Parent is a tab stop (no roving; the platform has none for checkboxes). | No |
| `Space` | Toggles the focused box (Item: one value; Parent: section 6.2). | Yes |
| `Enter` | Inside a `<form>`, implicit submission (native). | No |
| Arrows, `Home`, `End` | Nothing. | – |

- No arrow navigation and no `experimental_focusgroup`: the APG does not define arrow movement
  for checkbox groups, and adding it would be the component's first keyboard JS. Can be added
  later without a breaking change.
- No `orientation` prop (nothing keyboard-related would honour it); layout is CSS.
- **No `aria-controls` on the Parent** (#113 A2, 2026-10-24). The APG mixed-state example sets
  `aria-controls` from its tri-state `div[role="checkbox"]` to the boxes it controls. Here the
  Parent and its Items are native checkboxes inside one `<fieldset>` named by the `<legend>`, so
  the relationship is already exposed as the group; assistive-technology support for
  `aria-controls` is thin (JAWS offers a jump to the controlled element, NVDA and VoiceOver
  announce nothing); and emitting it would need every Item to carry a library id and the Parent
  to learn the ids for its `values` through the registry after mount, written to the DOM because
  they are unknown at server render (conventions 7.4), a mechanism for an attribute nobody
  hears. The prop passes through: a consumer who wants it gives the Items `id`s and sets
  `aria-controls` on the Parent. Revisit if AT support improves.
- ARIA: native roles and states everywhere; `aria-checked` owned and removed on Item and Parent;
  the Root carries no `role`, no `aria-required`; `Label` names the fieldset natively. Optimistic
  state is heard by AT immediately (the DOM `checked` is optimistic); a rollback is silent
  (nothing is focused by the library), as for RadioGroup; consumers with slow, failure-prone
  actions can add an `aria-live` region.
- Chromium exposes unchecked `required` checkboxes as `invalid` in the AX tree before any
  interaction (`form-controls.md` §3): with group `required` and an empty group, every Item is
  reported so until one is checked. Platform behaviour, noted for AT testing.
- The library never moves focus.

---

## 10. Async walkthroughs

Notation: `C` committed set, `O` optimistic set, `P` Root pending, DOM = checked boxes.

### 10.1 Item click, async resolve (uncontrolled)

`defaultValue=["cheese"]`, `valueChangeAction={async (next) => { await save(next); }}`.

1. Click "Ham". Browser: DOM `{cheese, ham}`. Library `onChange` → `toggle("ham", true)`:
   types `fsui-checkbox-group`, `fsui-checkbox-group-check`; `setOptimistic({ added: ["ham"], removed: [] })`;
   `save(["cheese","ham"])` awaited.
2. Sync flush: `O={cheese,ham}`, `P=true`. "Ham" Item `data-checked data-pending`, Root
   `data-pending`; react-dom's post-event restore writes the same `checked`. A Parent over both
   values now derives `checked` (dash gone) in the same render.
3. Resolve: `C={cheese,ham}`, `P=false`.

### 10.2 Rejection (DOM rolls back, Parent returns to mixed)

Same, `save` rejects: the error reaches the nearest Error Boundary above the Root; `C` unchanged;
`O` reverts; every Item re-renders with `checked` from `C`, react-dom writes the DOM back; the
Parent re-renders mixed and the hook re-applies `el.indeterminate = true`. Focus stays on "Ham".
Controlled "update on success" is identical; a consumer who catches inside gets a resolved action
(uncontrolled commits).

### 10.3 Parent click from mixed, then rollback

`C=O={cheese}`, Parent over `{cheese, ham, olives}` shows mixed.

1. Click Parent. Browser: Parent DOM `checked=true, indeterminate=false`. Dispatch
   `added: ["ham","olives"]`: `O={cheese,ham,olives}`; Items "Ham" and "Olives" `data-checked
   data-pending`; Parent derives `checked`, not mixed; `data-pending` on the Parent (two of its
   values differ from `C`).
2. Reject: `O` reverts to `{cheese}`; Items roll back; Parent renders `checked={false}`,
   `data-indeterminate`; layout effect: `el.indeterminate = true`. Memory still `["cheese"]`.
3. Later click on the Parent (now mixed again) → check all, as in step 1.

### 10.4 The restore cycle

`C={cheese}` committed, Parent memory `["cheese"]`. Click: all three checked (commit). Click:
none (commit; memory unchanged, since neither all nor none is partial). Click: `added: ["cheese"]`
→ mixed again. A user who wants "all" from "none" clicks again.

### 10.5 Rapid clicks on two Items, resolved out of order

`C={}`. Click A (slow), click B (fast): dispatch 1 `added:[a]`, `next=[a]`; dispatch 2
`added:[b]`, `next=[a,b]` (from `O`). `O={a,b}` throughout. B resolves first: it is the latest
dispatch (id 2), so uncontrolled `C={a,b}` is written when its transition can commit, which is
only after A settles too (entanglement, conventions 2.3 item 5). A resolves: id 1 is not the
latest; nothing is written. Final `C={a,b}`. If A rejects after B resolved, the shared hook throws
A's error from render (conventions 2.4); `O` has already converged on `{a,b}` through B's commit.

### 10.6 Unchecking the last box in a required group, pending

`required`, `C=O={cheese}`, no Item `required`. Click "Cheese": `O={}` → every Item renders
`required` immediately; `data-pending` on "Cheese". Resolve: `C={}`, attributes unchanged.
Reject: `O` reverts, `required` leaves. A submit attempt during the pending window is blocked by
the browser (the attribute is already there).

### 10.7 Form reset, external and automatic

Uncontrolled, `defaultValue=[]`, inside `<form action={createOrder}>`, `name="toppings"`.

1. User checks "Cheese" and "Ham": `C={cheese,ham}`.
2. Submit: `useFormStatus().pending` inside the form; the group's `P` is false (independent
   channels). `FormData.getAll("toppings")` is `["cheese","ham"]` from the DOM.
3. Success: React calls `form.reset()` in the commit; the browser unchecks both (their
   `defaultChecked` is false). The Root's listener queues a microtask.
4. Microtask: `readDefault()` = `{}`, base `{cheese,ham}`, differ → dispatch
   `([], { reason: "platform", event: reset, added: [], removed: ["cheese","ham"] })`.
   Uncontrolled: `C={}`. The Parent, which the browser also reset, re-renders from the group.

A `<button type="reset">` is steps 3 and 4. Controlled with a parent that ignores the reset: `O`
reverts when the action settles, the Items re-render from the parent's value and the DOM
re-checks them; the reset is undone for this group only.

### 10.8 Clicks before hydration

SSR HTML: "Cheese" checked, Parent over three values mixed (`data-indeterminate`). Before
hydration the user clicks "Ham" and then the Parent (the browser checks the Parent box;
`indeterminate` was never set, so this is a plain unchecked → checked flip).

1. Hydration keeps every DOM `checked`. Parent mount layout effect: DOM `checked=true`, derived
   `checked=false` (committed `{cheese}` over three values) → report `{ values, checked: true }`.
2. Root mount layout effect: `readCurrent()` = DOM `{cheese,ham}` plus the report → `{cheese,ham,olives}`;
   base `{cheese}`; differ → one dispatch `"platform"`, `event: undefined`,
   `added: ["ham","olives"]`. `O` = all three; the Parent re-renders `checked`.
3. Uncontrolled: `C` = all three after the action resolves. Rejection: rollback to `{cheese}`,
   the Parent to mixed. Controlled: the parent follows or vetoes.

### 10.9 `values` of a Parent change, or `value` prop changes while pending

Both are ordinary re-renders: derivation runs against the current optimistic set; a controlled
`value` change re-bases the optimistic patches (reducer form). Memory is recomputed only when the
committed intersection is partial, so a `values` change that makes the old memory stale replaces
it on the next partial commit; a stale memory entry whose value is no longer in `values` is
dropped when restoring (`memory ∩ values`).

---

## 11. ViewTransition

As RadioGroup section 10: the optimistic flip (click, Space, Parent cascade) is a sync-lane
commit and never animates; the commit that settles, rolls back or follows a platform dispatch
does. `Item` and `Parent` take `transition` and render the boundary only when it is given
(conventions 5.1, #35): on a void element it animates `data-pending` leaving and the rollback
write; most consumers animate the check with CSS on `:checked` / `:indeterminate` instead.
Dependent content elsewhere keys a type map on `fsui-checkbox-group` (`-check` / `-uncheck` for
direction). `Root` and `Label` render no boundary.

---

## 12. Server Components and forms

Two independent channels, as for RadioGroup 11: `valueChangeAction` (per-group transition; a
Server Function may be passed directly, 2.1) and `<form action>` with the native `name` (2.2).
Both at once is fine ("autosave and also submit"). "Submit on change" is
`valueChangeAction={() => { formRef.current?.requestSubmit(); }}`. The library never reads
`useFormStatus`. React's automatic reset after a successful form action is followed through the
reset path (10.7). An action-less group is JS-free in behaviour: the boxes, labels, `name` and
(static) `required` work before hydration; the Parent's cascade and the dynamic `required` need
hydration. Every part file is `"use client"` (context). #19 resolved 2026-10-23, user decision, option A of `docs/research/zero-js-variants.md` 5: no directive-free variant (a parent "select all" needs JS anyway; conventions 7.3).

---

## 13. Test plan

`packages/ui/src/checkbox-group/checkbox-group.test.tsx` (jsdom, `user-event`, helpers from
`src/__tests__/helpers.tsx`) and `checkbox-group.browser.test.tsx` for what jsdom cannot observe
(Chromium, Firefox, WebKit; engine differences via `src/__tests__/engine.ts`). Rows marked (both)
run under `describe.each` with the uncontrolled and the "update on success" controlled wrapper
(the controlled wrapper uses the functional update of 2.6). A rejection unmounts the group
through the boundary, so DOM rollback is asserted where the group stays mounted (caught-inside,
controlled veto), as in the RadioGroup and Switch plans.

| # | Area | Env | Test |
| --- | --- | --- | --- |
| 1 | Roles and ARIA | jsdom | `fieldset` with no `role` attribute, accessible name from `Label` (`toHaveAccessibleName`), `aria-label` fallback; every Item `input[type=checkbox]` with the same `name` (`useId` fallback, prop when given) and its `value`; the Parent has **no** `name`, no `required`, no `aria-checked`; `form` attribute on fieldset and Items; `role="menuitemcheckbox"` passes through on an Item. |
| 2 | Keyboard | jsdom | Tab visits every enabled Item and Parent in order (no roving); Space toggles and dispatches once with a native `click`; arrows/Home/End do nothing (`fireEvent.keyDown`, no handler). |
| 3 | Sync action (both) | jsdom | `(next, details)` shape: `next` is a fresh array in document order; `details.reason === "activate"`, `details.added` / `removed` one element, `details.event.type === "click"`; clicking a disabled Item, any Item under `Root disabled`, or a click already `defaultPrevented` by a pass-through `onClick` never dispatches. |
| 4 | Async action (both) | jsdom | While unresolved: `data-pending` on Root and the clicked Item only; its DOM `checked` and `data-checked` flipped; other Items unchanged. After resolve: pending gone, value committed / parent updated. |
| 5 | Rejection (both) | jsdom | Uncaught: `ErrorCatcher` receives the error; uncontrolled internal value unchanged on remount. Controlled, caught inside without updating: DOM `checked` and `data-checked` reverted, no `data-pending`. Uncontrolled caught-inside: commits. |
| 6 | Overlap | jsdom | Click A then B (A slow): `O={a,b}` throughout; final committed `{a,b}` (uncontrolled); controlled functional-update wrapper ends on `{a,b}` with B resolving first; click A twice fast: A not `data-pending` after the second click while Root is, final committed `{}`. |
| 7 | Superseded rejection (both) | jsdom | A rejects after B resolved, and while B is pending: error reaches the boundary; B's outcome unaffected. |
| 8 | Suspending content (both) | jsdom | Dependent `<Suspender />` keyed on the consumer's state updated in the action: old content stays, no fallback, Root `data-pending`; after resolve, new content. |
| 9 | Value model | jsdom | Duplicates in `value` / `defaultValue` ignored; a value with no Item survives an Item toggle and is absent from `FormData`; `next` order follows DOM order after Items are reordered; set-equal controlled `value` in a different order does not re-base optimistic state. |
| 10 | Parent derivation | jsdom | Over three values: none → unchecked, no dash; one → `el.indeterminate === true`, `data-indeterminate=""`, `el.checked === false`; all → `checked`, no dash; `values={[]}` → unchecked, no dash, click dispatches nothing. Derivation follows an Item click **immediately** (while pending) and reverts on rollback. |
| 11 | Parent cycle (both) | jsdom | mixed → dispatch `added` = missing values; checked → `removed` = all values; unchecked with a committed partial history → `added` = that partial; unchecked without history → `added` = all; a partial state that only ever rolled back is not restored; memory seeded from `defaultValue` at mount. |
| 12 | Parent pending | jsdom | Parent `data-pending` while any of its values differs between optimistic and committed; not when an unrelated Item is pending. |
| 13 | Parent, SSR | jsdom | `renderToString` emits `data-indeterminate=""` and no `aria-checked`; after `hydrateRoot`, `el.indeterminate === true`, no console error. |
| 14 | Parent, pseudo-class | browser | `:indeterminate` matches after mount, flips with an Item click immediately, and matches again after a rollback, in all three engines. |
| 15 | Section parents | jsdom | Two Parents over disjoint subsets derive and dispatch independently; a Parent over the union behaves as a grand-parent. |
| 16 | Group `required` | jsdom | `required` on Root: every Item has `required` while nothing is checked, none once one is; follows optimistic state (pending uncheck of the last box adds it; rollback removes it); never on the Parent; no `aria-required` on the fieldset; `form.checkValidity()` false while empty, true after a check; a disabled group never blocks. |
| 17 | Group `required`, user-facing | browser | After a blocked `requestSubmit()`, every Item matches `:user-invalid` and `validationMessage` is non-empty; after checking one, none matches and the form submits; before hydration (`renderToString` only) a form with one box checked by the user is still blocked by another box. |
| 18 | Forms | jsdom | `FormData.getAll(name)` lists checked values in document order; a `form="ext"` Root posts and resets with the external form; the Parent contributes nothing. |
| 19 | Platform: mount reconciliation | jsdom | `renderToString` with `{a}`, set `.checked` on "c" before `hydrateRoot`: one dispatch `reason: "platform"`, `event === undefined`, `added: ["c"]`; StrictMode still one; a controlled parent that refuses → DOM back on `{a}` after settle; late-mounting Items under a Suspense boundary resolved after hydration: one additional dispatch for the boundary's Items; two such Items in one commit → one. |
| 20 | Platform: pre-hydration Parent click | jsdom | SSR mixed Parent, set its `.checked = true` before `hydrateRoot`: one dispatch with `added` = its missing values (never a dispatch for "one box"); DOM Items checked after the sync flush; SSR checked Parent set to `false` → `removed` = all its values; a Parent mounting late reports through the late path. |
| 21 | Platform: partial hydration works | jsdom | Suspense boundary between Root and some Items, Root hydrated, boundary dehydrated: a click on a hydrated Item dispatches normally and throws nothing; after the boundary hydrates its Items show the right `data-checked` (attribute sync) and no partial-hydration warning is logged. |
| 22 | Platform: form reset | jsdom | Check two, `form.reset()` → one dispatch `([], { reason: "platform", event: reset, added: [], removed: [both] })`; uncontrolled commits; controlled parent that ignores → DOM re-checks after settle; `<form action>` success auto-resets and dispatches the same way; a reset that both checks and unchecks carries `added` and `removed`; cancelled `reset` → nothing; `Root disabled` still dispatches; reset whose target set-equals the base → nothing. |
| 23 | Platform: base comparison and `equals` | jsdom | Two synchronous `form.reset()` while a reset is pending dispatch once; a reset whose `readDefault()` is a *new Set with the same members* as the base dispatches nothing (guards the `equals` option: `Object.is` would dispatch). |
| 24 | Platform: reset target by mode | jsdom | Uncontrolled: after a new `defaultValue` (inside a transition), reset returns to it and dispatches; controlled: reset returns to mount-time values and the parent is notified. |
| 25 | `preventDefault` warning | jsdom | `details.event.preventDefault()` inside the action logs the dev warning once per element (Item and Parent); the action still ran. |
| 26 | `details` is virtual | jsdom | `JSON.stringify(details) === '{"reason":"activate","added":["a"],"removed":[]}'`; `details.event` is the native event; a fake Server Function receives the same shape. |
| 27 | Function props | jsdom | `className` / `style` on Root, Label, Item, Parent receive the documented state (`value` optimistic on Root, `checked` / `indeterminate` / `pending` per part); `children` on Root and Label receive Root state; Item and Parent have no `children`. |
| 28 | `render` element | jsdom | `render={<input id="x" className="y" />}` on Item keeps `type="checkbox"`, `name`, `checked` and the handler, concatenates `className`, forwards `ref`; on Parent strips `name` / `required` / `indeterminate` / `aria-checked="mixed"`; `render={<fieldset />}` on Root; dev warning when the mounted tag is not `INPUT` / `FIELDSET`. |
| 29 | Post-await rule | jsdom | Controlled wrapper that awaits then `startTransition(setValue)` (functional) works end to end. |
| 30 | `transition` prop | jsdom + browser | Item and Parent render with and without `transition`; Root and Label have none. Browser: an Item mounted in a `startTransition` with `transition` absent calls `document.startViewTransition` zero times. |
| 31 | Transition types | jsdom | Observed through a consumer `<ViewTransition default={{ "fsui-checkbox-group-check": …, "fsui-checkbox-group-uncheck": … }}>` sentinel as in the Accordion tests, or by spying `addTransitionType`: check → `-check`, uncheck → `-uncheck`, mixed reset → both. |
| 32 | Directive | build | `dist/checkbox-group/*.mjs` for Root, Label, Item, Parent and context begin with `"use client"`; `index.mjs` does not. |
| 33 | Dev warnings | jsdom | `value` with `defaultValue`, mode switch (shared hook); Item / Parent / Label outside a Root throw; **no** warning when neither `value` nor `defaultValue` is given; **no** partial-hydration warning. |
| 34 | AX tree | browser (Chromium, CDP) | The fieldset is a `group` named by the legend; the Parent reports `checked: "mixed"` after mount; Items in an empty required group are exposed as `invalid` (Chromium has no `required` property for a checkbox, not even with `aria-required`), after a check not. |
| 36 | Parent and disabled Items (both) | jsdom | From mixed, the Parent checks only the enabled values and a disabled unchecked Item stays unchecked; "uncheck all" keeps a checked disabled Item and the Parent then shows unchecked; the restore memory is over the enabled values; every value disabled → the Parent acts on all; an Item's `disabled` prop changing re-registers; `Root disabled` leaves the derivation unchanged; SSR counts disabled Items and hydration settles without a dispatch or a warning; a Parent checked / unchecked before hydration checks only the enabled values / keeps a checked disabled Item; a late Parent hydrating after a disabled Item registered compares with the server's derivation. |
| 37 | `required` edge cases | jsdom | A checked disabled Item does not satisfy it; a value with no Item does not; the server HTML counts any checked value and hydration corrects it. |
| 38 | Parent `autocomplete` | jsdom | The Parent renders `autocomplete="off"` on the client and in `renderToString`; form-state restoration of the Items only (simulated before `hydrateRoot`) removes just them. |
| 39 | Reset by mode | jsdom | Uncontrolled: a value with no Item returns to `defaultValue` too (Parent over `["a", "ghost"]`, click, `form.reset()` → `removed: ["a", "ghost"]`); controlled: a Parent whose React reset target is stale shows its derivation after a reset. |
| 35 | Engines | browser | Tab order and Space across Chromium, Firefox, WebKit (WebKit: Option+Tab note); `:user-invalid` after a submit attempt in all three. |

jsdom facts to rely on (from the Checkbox and RadioGroup suites): `input.click()` on a checkbox
fires React's `onChange`; `form.reset()` fires `reset` and restores `defaultChecked`; React's
automatic reset after `<form action>` works; jsdom's cancelled activation for checkboxes is buggy
(`memo/developer/switch-checkbox.md`), so the pass-through-cancel row asserts "no dispatch" only
and the DOM state in browser mode.

---

## 14. Implementation notes

### 14.1 Files

```
packages/ui/src/checkbox-group/
  index.ts                     # no directive; namespace + type re-exports; imports platform-attributes
  checkbox-group-context.ts    # "use client"
  checkbox-group-root.tsx      # "use client": fieldset, state, reset listener, reconciliation, required
  checkbox-group-label.tsx     # "use client": <legend>
  checkbox-group-item.tsx      # "use client": <input type="checkbox">
  checkbox-group-parent.tsx    # "use client": the mixed-state <input type="checkbox">
  checkbox-group.test.tsx
  checkbox-group.browser.test.tsx
packages/ui/src/internal/
  use-native-group-reconciliation.ts   # add `equals?: (a: T, b: T) => boolean` (default Object.is)
  sync-presence.ts                     # attribute-presence sync on hydration; shared with RadioGroup (review L5)
  use-fieldset-group.ts                # "use client": the Root's fieldset wiring (conventions 3.8; shared with RadioGroup)
  group-member.ts                      # "use client": groupMemberProps, the Item's owned input layer (shared with RadioGroup)
  use-item-order.ts                    # "use client": the Items' document order in state (shared with ToggleGroup)
  value-set.ts                         # no directive: toSet / setsEqual / applyPatch / sortByOrder / EMPTY_SET (shared with Accordion and ToggleGroup)
```

Also: `src/index.ts` re-export, `tsdown.config.ts` entry, `package.json` `./checkbox-group`,
`directives.test.ts` rows, `transition-types.ts` accepts `"checkbox-group"`.

### 14.2 Context

```ts
interface CheckboxGroupContextValue {
  readonly name: string;
  readonly form: string | undefined;
  /** `required` while no enabled Item's value is checked (`optimistic.size === 0` until the Items registered): rendered as native `required` on every Item. */
  readonly required: boolean;
  /** Values whose every mounted Item has its own `disabled` prop (`Root disabled` not counted); a Parent leaves them alone (6.2). Empty until the Items registered. */
  readonly disabledItems: ReadonlySet<string>;
  /** Stable. Each Item calls it from a layout effect with its value and its own `disabled`; returns the unregister function. */
  readonly registerItem: (value: string, disabled: boolean) => () => void;
  readonly optimistic: ReadonlySet<string>;
  /** For per-part pending only; no part renders it. */
  readonly committed: ReadonlySet<string>;
  readonly pending: boolean;
  readonly disabled: boolean;
  /** The Root state (`CheckboxGroup.Label`'s function props read it). */
  readonly state: CheckboxGroupRootState;
  /** Uncontrolled: the latest `defaultValue` as a set (Items mirror `has(value)` into `defaultChecked`); `undefined` when controlled. */
  readonly defaultValue: ReadonlySet<string> | undefined;
  /** Item click. No-op if `optimistic.has(value) === checked`. Neither checks `disabled` nor `defaultPrevented` (the Item's guard does). */
  readonly toggle: (value: string, checked: boolean, event: Event) => void;
  /** Parent click: a whole patch. No-op if it changes nothing against optimistic. */
  readonly apply: (patch: { added: readonly string[]; removed: readonly string[] }, event: Event) => void;
  /** Wraps `useNativeGroupReconciliation`'s (snapshots late members' `checked` first, 8.1); Items and Parents call it from their mount layout effect. */
  readonly onItemMounted: (element: HTMLInputElement | null) => void;
  /** Parent mount: the DOM differs from the derivation; folded into the next `readCurrent()` (8.1). Call before `onItemMounted`. */
  readonly reportParent: (values: readonly string[], checked: boolean) => void;
}
```

### 14.3 Root

- `useFieldsetGroup({ component: "CheckboxGroup.Root", name, disabled, required })` (conventions
  3.8: the fallback name, the Field defaults, the fieldset ref and `rootRef`); `useMemo` set
  normalisation of `value` and `defaultValue` (`toSet` from `internal/value-set.ts`).
- `useControllableAction<ReadonlySet<string>, CheckboxGroupValueChangeDetails>({ controlled,
  defaultValue, initialValue: EMPTY, action: action && ((next, details) => action(fromSet(next),
  details)), transitionTypes: (_n, _p, d) => […], reducer: (prev, _next, d) => reduce(prev, d),
  warn: { component: "CheckboxGroup.Root", prop: "value" } })`. `fromSet` sorts by the document
  order of the group's Items read from the fieldset at call time (5.1).
- `dispatchPatch` (5.2) and `base()` with the explicit null check.
- Item registry (6.2, 7; the document-order half is `useItemOrder`, `internal/use-item-order.ts`,
  conventions 3.8, shared with ToggleGroup): `registerItem(value, disabled)` (stable; each Item calls it from a
  layout effect, returns the unregister function) writes a `Map<token, { value, disabled }>` ref
  and publishes a `Map<value, hasEnabledItem>` state only when the summary changes; `null` until
  an Item registered. `disabledItems` (context) is the set of values with no enabled Item;
  `required` (context) is `required && (items === null ? optimistic.size === 0 :
  ![...optimistic].some((v) => items.get(v) === true))`.
- `useNativeGroupReconciliation<ReadonlySet<string>>({ element, readCurrent, readDefault, base,
  equals: setsEqual, onPlatformChange: (next, event) => dispatchPatch(diff(base(), next),
  "platform", event) })`. `readCurrent()` = Items' `checked` laid over `base()` (or over the
  late-member snapshot, 8.1), then apply and clear parent reports through `enabledValues(report.values,
  disabledOf(registry))`; `readDefault()` = Items' `defaultChecked` laid over `defaultValue`
  (uncontrolled) or `base()` (controlled). `onItemMounted` wraps the adapter's: when the Root
  has already reconciled, it snapshots `readDom("checked")` once per commit and clears it in a
  microtask.
- Renders `<fieldset disabled form data-pending data-disabled>` through `use-render`; tag warning.

### 14.4 Item

`RadioGroup.Item` with `type: "checkbox"`, `checked = ctx.optimistic.has(value)`, `pending` per
5.3, `required: ctx.required` in `libraryProps`, `aria-checked: undefined`,
`onChange: guardCheckableChange(e, () => ctx.toggle(value, !checked, e), "CheckboxGroup.Item")`,
`defaultChecked: ctx.defaultValue?.has(value)` to the hook, attribute presence sync in
`onItemMounted`. `transitionTypes` are the Root's. After `useNativeChecked`, a layout effect
registers the Item with the Root: `useLayoutEffect(() => registerItem(value, disabledProp),
[registerItem, value, disabledProp])`. Cost: the registrations publish the summary as state, so
a group pays **one extra layout-time render at mount** (one per group, not per Item: the
publish de-duplicates by comparing the summary), and one more whenever an Item's own `disabled`
changes or Items mount or unmount.

### 14.5 Parent

- `effective = hydrating ? values : enabledValues(values, ctx.disabledItems)` (`hydrating` from
  `useSyncExternalStore` with a server snapshot of `true`), memoised; derivation of 6.1 from
  `effective` and `ctx.optimistic`; `pending` from `ctx.committed` over `values`.
- `memory` in a `useRef<readonly string[] | null>`; `useLayoutEffect` on `[ctx.committed,
  effective]` updates it when the committed intersection is partial; initialised in the same
  effect at mount.
- Own `useFormReset(node, …)` on the input: after a reset, if `el.checked !== checked`, write the
  derivation back (8.2).
- `useNativeChecked({ type: "checkbox", component: "CheckboxGroup.Parent", checked, indeterminate,
  group: true, onItemMounted: (el) => { if (el && el.checked !== checked) ctx.reportParent(values, el.checked);
  syncPresence(...); ctx.onItemMounted(el); }, defaultChecked: ctx.defaultValue === undefined ? undefined : derivedOver(effective, ctx.defaultValue) })`.
- `onChange`: `guardCheckableChange(e, () => ctx.apply(cyclePatch(), e), "CheckboxGroup.Parent")`
  where `cyclePatch` is the table of 6.2 over `effective` (`memory ∩ effective` when restoring).
- `libraryProps`: `type: "checkbox"`, `name: undefined`, `value: undefined`, `required: undefined`,
  `autoComplete: "off"`, `checked`, `defaultChecked: undefined`, `indeterminate: undefined` (stripped),
  `aria-checked: undefined`, `disabled`, `form: undefined`, the four `data-*`.

### 14.6 Dev warnings

Shared ones (both props / mode switch, `preventDefault()`, wrong tag); parts outside a Root throw;
duplicate Item `value` within a Root (once, from the Root's layout effect that reads the Items,
dev only). Deliberately
absent: neither `value` nor `defaultValue`; a `value` with no matching Item; a Parent whose
`values` include values with no Item; partial hydration.

### 14.7 Example app and docs site

Example: the toppings group of 2.1 against a fake 800 ms API with a failure toggle, a Parent, and a
form section with group `required` and a submit button, so the restore cycle (10.4), the Parent
rollback to mixed (10.3), the dynamic `required` (10.6) and the automatic reset (10.7) can be seen
in real engines. Docs page: anatomy, props tables for the four parts, the two channels, the
`required` limitation before hydration, the "no `aria-required` on `group`" note with the Label
recipe, and the "`next` is a set" guidance.

---

## Conventions feedback

To apply to `design/conventions.md` if this design is accepted:

1. **3.8, `useNativeGroupReconciliation`**: add the `equals` option (default `Object.is`), as the
   table already anticipates for #33.
2. **3.8 rule 3, "Unsupported: partial hydration"**: scope it to **radio** groups; react-dom's
   same-`name` restore is radio-only, and CheckboxGroup supports late Items without a warning.
3. **1.1 part vocabulary**: add `Parent` ("a mixed-state checkbox that controls a subset of a
   CheckboxGroup; `input[type=checkbox]`").
4. **4.1 `indeterminate` row**: add `CheckboxGroup.Parent`, where the value is library-derived
   from optimistic state and **not** suspended while pending (the suspension rule is for the
   consumer-owned prop on Checkbox).
5. **4.1 / 3.6**: a note that a library may render a **computed native validity attribute**
   (`required` on CheckboxGroup Items) from optimistic state; it is owned on the part.
6. **5.3 transition types**: `fsui-checkbox-group`, `fsui-checkbox-group-check`,
   `fsui-checkbox-group-uncheck`.
7. **2.2 `details` fields**: `added` / `removed` as the shape for set-valued states (Accordion's
   `item` / `open` stays; a future set-valued component should prefer the diff form).

## Decisions recorded (product owner, 2026-10-17)

All eight questions raised by the proposal were accepted as recommended; the conventions
feedback above was applied to `design/conventions.md` the same day.

1. **`CheckboxGroup.Item` is its own part**; a plain `Checkbox` inside a `Root` is not a member
   (section 1). The context sketch in Checkbox §10 item 2 is withdrawn.
2. **`Parent` is the part name and `values` lives on the Parent** (several Parents per group);
   no `allValues` on the Root.
3. **APG restore cycle by default** (unchecked → last committed partial, section 6.2). No
   `cycle` prop for now; it can be added without a breaking change.
4. **Group `required` is dynamic native `required` on the Items** (section 7, option C), with the
   browser's wording and the pre-hydration over-blocking accepted, and **no `aria-required` on the
   fieldset** (not allowed on role `group`).
5. **`details.added` / `details.removed`** are the details shape (sections 2.6, 3.1).
6. **`next` is in document order of the Items**, set equality everywhere (section 5.1).
7. **No partial-hydration warning** for CheckboxGroup (section 8.3); one Suspense boundary is a
   docs recommendation for simplicity only.
8. **`transition` stays on `Item` and `Parent`** for parity with the other native-input parts.
9. **A Parent ignores disabled Items** (review M2, decided 2026-10-17 after the implementation
   review): a click toggles only the values of enabled Items, and the derived checked / mixed
   state is computed over enabled Items only; when every value has only disabled Items the Parent
   acts on all of them; hydration renders count disabled Items as the server does (section 6.2).
   Folded with the other review corrections: the Parent's `autocomplete="off"` (8.1), the
   uncontrolled reset reading from `defaultValue` (8.2), `required` over enabled Items (7), the
   engine-dependent AT exposure (7), `RootState.value` as of the Root's last render (3.1, 5.1),
   and the duplicate-value warning from the Root's layout effect (14.6).

## Amendment: `aria-controls` on the Parent (#113 A2, 2026-10-24)

Status: architect decision, recorded in section 9; no implementation. The library does not emit
`aria-controls` from `CheckboxGroup.Parent` to its Items. Reasons in section 9: the `<fieldset>` /
`<legend>` grouping already exposes the relationship, AT support for `aria-controls` is thin, and
the attribute would cost per-Item ids plus a post-mount DOM write on the Parent. The prop is not
owned, so a consumer can add it by hand. Nothing to add to the #113 implementation list.
