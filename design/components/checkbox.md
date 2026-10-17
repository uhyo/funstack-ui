# Checkbox

Status: **accepted** (2026-10-16, GitHub issue #27, closed; the implementation-review corrections
in `memo/developer/switch-checkbox.md` folded in: `disabled` is owned, section 7). Follows
`design/conventions.md` (accepted);
where this document and the conventions disagree, the conventions win. The platform facts come
from `docs/research/form-controls.md` (binding). **Read `design/components/switch.md` first**: it
specifies the native-input model (optimistic `checked` on a controlled input), the shared hook
`useNativeChecked` with both residual browser paths (mount reconciliation, form reset), the
`preventDefault()` rule and the Server Function / form independence. This document repeats only
what differs and adds `indeterminate`.

Inputs: as for Switch, plus WAI-ARIA APG "Checkbox" (dual- and tri-state), prior art (Base UI
`Checkbox` with `indeterminate`, React Aria `Checkbox`/`CheckboxGroup`, Radix `Checkbox`
`checked="indeterminate"`, Ark UI `Checkbox`), and the react-dom 19.3.1 reading in
`memo/architect/switch-checkbox-notes.md`.

## Decisions at a glance

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Anatomy | One plain component, `Checkbox`, rendering `<input type="checkbox">`. No `Root`/`Input`/`Indicator` parts; styling via `appearance: none` + `::before` on the input, or a sibling indicator through `:has()`. |
| 2 | State | `checked` / `defaultChecked` / `checkedChangeAction(next, details)` exactly as Switch, plus a **controlled-only** `indeterminate?: boolean` (no default, no action). `checked` stays `boolean`; mixed is never a third value of `checked`. |
| 3 | What the DOM shows | `checked={optimistic}`; `el.indeterminate` set through the ref (React has no prop for it and SSR cannot emit it). Both are re-applied after every commit by `useNativeChecked`. |
| 4 | Mixed while pending | `state.indeterminate = indeterminate && !pending`. The browser clears `indeterminate` on click (the platform's optimistic flip); the library keeps the attribute, the DOM property and `:indeterminate` in agreement by suspending mixed for the whole pending window and restoring it on settle if the parent still says mixed (rollback). |
| 5 | Click on a mixed box | Dispatches `next = !optimistic`, which is `true` for the conventional "unchecked + mixed" representation (APG: mixed → checked). The DOM and the library agree because the browser applies the same rule. |
| 6 | ARIA | Native `checkbox` role and state. `aria-checked` (including `"mixed"`) is **owned and removed**: forbidden on native inputs and ignored by Chromium. Before hydration a mixed box looks and is announced as unchecked; `data-indeterminate` is emitted from render so CSS can draw the dash from SSR output. |
| 7 | CheckboxGroup | **Deferred** to `design/components/checkbox-group.md`. Checkbox leaves room: `value` is a native string prop, `checked`/`indeterminate` can be driven from a future group context without new props, and the "select all" parent is already expressible in consumer code (section 2.4). |
| 8 | ViewTransition | `fsui-checkbox` plus `fsui-checkbox-check` / `fsui-checkbox-uncheck`; settle only. |
| 9 | Files | `src/checkbox/{index.ts,checkbox.tsx,checkbox.test.tsx,checkbox.browser.test.tsx}`; `checkbox.tsx` is `"use client"`. Exports `Checkbox`, `CheckboxProps`, `CheckboxState`, `CheckboxCheckedChangeDetails`. |

Everything not listed (next value, not disabled while pending, errors and rollback, overlap,
form reset semantics by mode, pre-hydration reconciliation, `render` rules, the two Server
Function channels, no `useFormStatus`) is identical to Switch and is not restated.

---

## 1. Anatomy

```
<ViewTransition default={transition}>                         only when `transition` is set (conventions 5.1)
  <input type="checkbox" checked … data-indeterminate?>     the only element
```

### Why a single input and no `Indicator` part

Checkbox is the component where the "input cannot have children" cost bites hardest: design
systems draw a check mark or a dash, often as an SVG. The three candidate anatomies:

| Anatomy | Check mark drawn by | Verdict |
| --- | --- | --- |
| A. `Checkbox` = the input (chosen) | CSS on the input: `appearance: none` and `::before` with `clip-path`, `mask-image` or a `background-image` SVG; `:checked` and `:indeterminate` select the glyph. Verified rendering in Blink and Gecko (research probe 08), long-standing in WebKit. | One element, no JS, SSR-complete, label and form semantics intact. Covers every design-system checkbox the author has seen; `mask-image` takes any SVG. |
| B. `Checkbox.Root` (`<label>`) + `Checkbox.Input` + `Checkbox.Indicator` (Base UI/Radix shape, adapted to a native input) | A React element next to the input, with `data-checked` / `data-indeterminate` / `data-pending` copied from the input's state through context. | Three parts and a context for one state. The wrapper `<label>` is often not where the consumer wants the label. The same result is reachable from A with `label:has(:checked) .indicator` (Baseline) and, when the indicator needs `pending` as a React value, with the `render` function form. |
| C. `<button role="checkbox" aria-checked>` + hidden input | Children of the button. | Rejected by the research (re-implements form participation, labels, validation, reset). |

A is chosen, with B's capabilities documented as recipes (2.6, 2.7). A `Checkbox.Indicator` can be
added later without changing A if the recipes prove insufficient: the input would stay the state
owner and the indicator would read it through context. The trade-off accepted: a consumer who
wants an `<svg>` React component as the glyph *and* does not want a wrapper writes the sibling
themselves.

No `Checkbox.Label` part; the consumer's `<label>` is the platform's label association.

## 2. Usage

### 2.1 Uncontrolled, autosave

```tsx
import { Checkbox } from "@funstack/ui/checkbox";

<label>
  <Checkbox defaultChecked={task.done} checkedChangeAction={(next) => api.setDone(task.id, next)} />
  {task.title}
</label>
```

### 2.2 Inside a form, no action

```tsx
// Server Component
<form action={updateProfile}>
  <label><Checkbox name="newsletter" defaultChecked={profile.newsletter} /> Newsletter</label>
  <label><Checkbox name="terms" required /> I accept the terms</label>
  <button type="submit">Save</button>
</form>
```

Posts `newsletter=on`; `terms` unchecked blocks submission natively and matches
`:user-invalid` after the attempt. Works before hydration.

### 2.3 Controlled, local state

```tsx
const [agreed, setAgreed] = useState(false);
<label>
  <Checkbox checked={agreed} checkedChangeAction={(next) => { setAgreed(next); }} />
  I agree
</label>
```

### 2.4 Tri-state "select all" parent (controlled `checked` + `indeterminate`)

The main use of `indeterminate`. Mixed is derived state, computed by the parent from the children;
that is why it is controlled-only and has no action of its own.

```tsx
const [selected, setSelected] = useState<Set<string>>(new Set());
const all = rows.length > 0 && selected.size === rows.length;
const some = selected.size > 0 && !all;

<label>
  <Checkbox
    checked={all}
    indeterminate={some}
    checkedChangeAction={(next) => { setSelected(next ? new Set(rows.map((r) => r.id)) : new Set()); }}
  />
  Select all
</label>
{rows.map((row) => (
  <label key={row.id}>
    <Checkbox
      checked={selected.has(row.id)}
      checkedChangeAction={(next) => {
        setSelected((prev) => { const s = new Set(prev); next ? s.add(row.id) : s.delete(row.id); return s; });
      }}
    />
    {row.title}
  </label>
))}
```

Clicking the mixed parent dispatches `true` (all rows become selected); the parent's `setSelected`
runs in the sync prefix, so `checked` becomes `true` and `indeterminate` `false` in the same
transition. With an async parent ("update on success"), the box shows checked and `data-pending`
without the dash until the save resolves; on rejection the optimistic flip reverts and the dash
returns (section 6.2). A future `CheckboxGroup` packages this pattern (section 10).

### 2.5 Server Function as the action

```tsx
// Server Component
<Checkbox defaultChecked={task.done} checkedChangeAction={setDone.bind(null, task.id)} aria-label={`Done: ${task.title}`} />
```

Receives `(task.id, next, { reason: "activate" })`; `details.event` is virtual (conventions 2.2).

### 2.6 Styling the input: check and dash in CSS

```css
.cb {
  appearance: none;
  inline-size: 1.25em; block-size: 1.25em;
  border: 2px solid var(--border); border-radius: .25em;
  display: inline-grid; place-content: center;
  transition: background-color 120ms, border-color 120ms;
}
.cb::before {
  content: ""; inline-size: .75em; block-size: .75em;
  background: currentColor;
  scale: 0; transition: scale 100ms;
  /* any SVG works through a mask */
  mask: url("check.svg") center / contain no-repeat;
}
.cb:checked { background: var(--accent); border-color: var(--accent); color: white; }
.cb:checked::before { scale: 1; }
.cb:indeterminate::before,
.cb[data-indeterminate]::before { scale: 1; mask-image: none; block-size: .2em; }  /* the dash */
.cb[data-pending] { cursor: progress; }
.cb:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.cb:disabled { opacity: .5; }
.cb:user-invalid { border-color: var(--danger); }
```

`[data-indeterminate]` is listed next to `:indeterminate` on purpose: before hydration only the
attribute exists (section 4). One engine caveat for the `.cb:checked` rules: Chromium 156 does
not match `:checked` on a box that is both checked and indeterminate (Firefox does), so a
stylesheet that must handle `checked={true} indeterminate` selects on `[data-checked]` instead
(conventions 4.2). For the minimal case, `accent-color` alone recolours the native check and dash
in every engine.

### 2.7 A sibling indicator without a library part

```tsx
<label className="row">
  <Checkbox name="done" className="sr-only-input" />
  <span className="box" aria-hidden><CheckIcon className="glyph" /><DashIcon className="dash" /></span>
  Done
</label>
```

```css
.row .glyph, .row .dash { display: none; }
.row:has(:checked) .glyph { display: block; }
.row:has([data-indeterminate]) .dash { display: block; }
.row:has([data-pending]) .box { opacity: .6; }
.row:has(:focus-visible) .box { outline: 2px solid var(--focus); }
```

The input is visually hidden with a clip, never `display: none` or `hidden`. When the indicator
must read `pending` as a React value, use the `render` function form and render the indicator
next to the input (Switch 2.6).

---

## 3. Props

```ts
// packages/ui/src/checkbox/checkbox.tsx
export interface CheckboxState {
  /** Optimistic checked state. */
  readonly checked: boolean;
  /**
   * The `indeterminate` prop, suspended while an action is in flight: `false` whenever `pending`
   * is true, so that the attribute, the DOM property and `:indeterminate` always agree.
   */
  readonly indeterminate: boolean;
  /** An action dispatched by this Checkbox is in flight. */
  readonly pending: boolean;
  /** The `disabled` prop. */
  readonly disabled: boolean;
}

/** Details passed as the second argument of `checkedChangeAction`. */
export interface CheckboxCheckedChangeDetails extends ActionDetails {
  /** `"activate"`: user click/Space/label; `"platform"`: form reset (`event` is the `reset` event) or a pre-hydration click found on mount (`event` undefined). */
  readonly reason: ChangeReason;
}

export interface CheckboxProps
  extends Omit<
    ComponentPropsWithRef<"input">,
    "type" | "checked" | "defaultChecked" | "onChange" | "aria-checked" | "className" | "style" | "children"
  > {
  /** Controlled checked state. `undefined` means uncontrolled. */
  checked?: boolean;
  /** Initial checked state in uncontrolled mode (default `false`); also the form-reset target (latest value). */
  defaultChecked?: boolean;
  /**
   * Controlled-only mixed state (APG tri-state checkbox). Derived by the parent from other state;
   * there is no `defaultIndeterminate` and no action. Rendered as `el.indeterminate`,
   * `data-indeterminate` and `:indeterminate`, except while an action is pending. Clicking a
   * mixed box dispatches `checked: true` (for the usual unchecked + mixed representation).
   * Does not affect what the form submits.
   */
  indeterminate?: boolean;
  /** See Switch. */
  checkedChangeAction?: ChangeAction<boolean, CheckboxCheckedChangeDetails>;
  disabled?: boolean;
  /** Submitted as the value when checked. Default `"on"`. In a future CheckboxGroup it identifies the item. */
  value?: string;
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, CheckboxState>;
  style?: StateValue<CSSProperties | undefined, CheckboxState>;
  /** Must keep an `<input type="checkbox">`. */
  render?: RenderProp<ComponentPropsWithRef<"input">, CheckboxState>;
}
```

Differences from `SwitchProps`: `indeterminate` is added; `role` is **not** omitted. ARIA in HTML
allows `menuitemcheckbox`, `option`, `switch` and `button` on a checkbox input, and a future Menu
may render `<Checkbox role="menuitemcheckbox">`; a role the part does not compute passes through
(conventions 1.2). The default is no `role` attribute (native `checkbox`).

`indeterminate` given on a Checkbox that is uncontrolled in `checked` is allowed (the two are
independent): a mixed box whose click commits `true` internally. Why `checked` stays boolean and
mixed is a separate prop rather than Radix's `checked="indeterminate"`: the platform keeps
`checked` boolean and `indeterminate` a separate property, form data ignores mixed, and the
controllable triple should not carry a value that `defaultChecked` and the DOM can never hold.

---

## 4. States

| State | Kind | Shown as | Source |
| --- | --- | --- | --- |
| `checked` | library-owned, residual browser paths | DOM `checked`, `:checked`, `data-checked`, `state.checked` | optimistic |
| `indeterminate` | **consumer-owned, mirrored** | `el.indeterminate` (DOM property, via the hook), `:indeterminate`, `data-indeterminate`, `state.indeterminate` | `indeterminate && !pending` |
| `pending` | library-owned | `data-pending`, `state.pending` | `useTransition()` |
| `disabled` | prop | `disabled`, `:disabled`, `data-disabled`, `state.disabled` | prop |

```tsx
<input
  type="checkbox"
  checked={optimistic}
  disabled={disabled}
  data-checked={optimistic ? "" : undefined}
  data-indeterminate={indeterminate && !pending ? "" : undefined}
  data-pending={pending ? "" : undefined}
  data-disabled={disabled ? "" : undefined}
/>
// plus, after every commit (useNativeChecked): el.indeterminate = indeterminate && !pending
```

**Why `indeterminate` is suspended while pending.** The browser clears `el.indeterminate` on the
click that flips the box (research section 4), before React runs: the platform performs the
optimistic transition from mixed to a boolean by itself. Three things could then disagree during
the pending window: the DOM property (cleared), the attribute (from the prop, still `true` for an
async parent), and the pseudo-class (follows the property). Re-applying the prop immediately would
put the dash back on a box the user just checked. Defining the shown value as
`indeterminate && !pending` makes all three agree in every phase: the user's boolean during the
action, and mixed again on settle only if the parent still says so (rejection, veto, or a parent
that did not recompute). The cost, accepted: a reset-triggered or pre-hydration `"platform"`
dispatch also hides the dash while it runs.

**SSR and the AT gap.** The server cannot emit the DOM property, `aria-checked="mixed"` is
forbidden on native inputs and ignored by Chromium, so until hydration a mixed box is announced as
unchecked. `data-indeterminate` is rendered from the start so CSS shows the dash (2.6). The
property is set in the hook's first layout effect, before paint, so there is no visual flash;
the announcement gap lasts until hydration and is documented.

Pseudo-class equivalents: `:checked` ↔ `data-checked`; `:indeterminate` ↔ `data-indeterminate`
(attribute only before hydration; note `:indeterminate` also matches radios in an empty group);
`:disabled` ↔ `data-disabled` (fieldset inheritance only in the pseudo-class).

---

## 5. Keyboard and ARIA

APG pattern: Checkbox (two-state and mixed-state).

| Interaction | Behaviour | Provided by |
| --- | --- | --- |
| Space | Toggles; a mixed box becomes checked (unchecked + mixed) | native |
| Enter | Nothing (APG does not list Enter for checkboxes) | native |
| Click, label click | Toggles | native |
| Tab | Focusable unless `disabled` | native |

ARIA:

- Native role and state; no `role` set by the library; `aria-checked` owned and removed
  (never `"mixed"`). AT reads the optimistic `checked` immediately.
- The mixed state reaches AT through the DOM property (HTML-AAM maps `indeterminate` to
  `aria-checked="mixed"`); after hydration only (section 4).
- Accessible name from the consumer's `<label>` / `aria-label`; must not change with state.
- `required`: one `required` checkbox is required on its own (there is no native "at least
  one" group constraint; section 10).
- Chromium flags unchecked `required` checkboxes invalid in the accessibility tree before any
  interaction (research section 3): platform behaviour.

---

## 6. Behaviour that differs from Switch

### 6.1 Dispatch

```ts
const next = !optimistic;   // a mixed box: unchecked + mixed → true; checked + mixed → false
dispatch(next, createActionDetails(event.nativeEvent, { reason: "activate" }));
```

`indeterminate` plays no part in `next`: the platform's rule is "flip `checked`, clear
`indeterminate`", and `!optimistic` is exactly the flip. For the conventional representation
(`checked={false} indeterminate`), this is APG's mixed → checked. A consumer who represents
partial as `checked={true} indeterminate` gets mixed → unchecked, as the browser would; the docs
recommend the former.

### 6.2 Sequences involving `indeterminate`

Setup: controlled "select all" parent from 2.4, async "update on success" variant
(`await save(next); startTransition(() => setSelected(...))`). Partial selection:
`checked={false} indeterminate`.

**Resolve:**
```
mount/commit:            el.checked=false el.indeterminate=true  data-indeterminate  :indeterminate
click (browser: checked=true, indeterminate=false) → onChange → dispatch(true)
  sync-lane commit:      checked=true data-checked data-pending; indeterminate && !pending → false:
                         no data-indeterminate; layout effect: el.indeterminate=false (already)
  resolve → parent sets all → indeterminate prop false, checked prop true
  settle commit:         checked=true data-checked; no dash; pending gone
```

**Reject (dash comes back):**
```
... same until the rejection
  optimistic reverts → checked=false; pending false → indeterminate && !pending → true
  settle commit:         checked={false} written by React; data-indeterminate; layout effect:
                         el.indeterminate = true → :indeterminate matches again
  error → nearest Error Boundary (or, caught inside, the box stays mounted and shows mixed)
```

**Parent recomputes in the sync prefix (local state):** `indeterminate` becomes `false` in the
same transition; nothing visible beyond the check appearing; the dash never returns.

**Parent sets `indeterminate` while an action is pending:** suspended until settle, then shown.

**Form reset while mixed:** the reset algorithm does not touch `indeterminate`. The reset
dispatch runs with `"platform"`; during it the dash is suspended; on settle the parent's
`indeterminate` is re-applied. The parent typically recomputes it from the reset `checked`.

**Overlapping clicks on a mixed box:** click 1 dispatches `true`, click 2 `false` (from
optimistic). The DOM follows each click; `indeterminate` stays suspended until both settle.

### 6.3 `indeterminate` and `render`

The hook sets the property on whatever input the merged ref lands on, so `render={<MyInput />}`
works as long as MyInput forwards `ref` to its `<input>`. A `render` element's own
`indeterminate` prop is meaningless to React (it is not a DOM attribute and logs a warning in
19.3.1), so the part owns the key with value `undefined` to strip it.

---

## 7. `useNativeChecked`, Checkbox usage

Identical to Switch 12.2 (a single control: no `group` option, the hook reports both residual
paths itself, conventions 3.8) with `indeterminate: indeterminate && !pending` passed to the
hook and `guardCheckableChange` around the dispatch.
Owned keys: `type`, `checked`, `defaultChecked`, `indeterminate` (stripped), `aria-checked`,
`disabled`, `data-checked`, `data-indeterminate`, `data-pending`, `data-disabled`. `disabled` is
owned as on Switch (12.2) and Toggle, per conventions 1.2 (every part that takes a `disabled`
prop owns it): native disabledness, `data-disabled` and the click guard always agree, and a
`render` element can neither re-enable nor disable the input. `onChange` (and `onClick`) are
merged rather than owned: a `render` element's own handler runs first, then the library's.
`role`, `name`, `value` are pass-through.

---

## 8. ViewTransition

`fsui-checkbox` plus `fsui-checkbox-check` / `fsui-checkbox-uncheck` on every dispatch. Same
settle-only semantics, the same conditional boundary (rendered only when `transition` is given,
conventions 5.1) and the same honest expectation as Switch section 8.

---

## 9. Server Components and forms

Identical to Switch section 9: `checkedChangeAction={serverFn}` and `<form action>` with `name`
are independent channels; React's automatic reset after a successful form action is followed
through the hook; no `useFormStatus` coupling. `indeterminate` never affects form data (a checked
mixed box still posts its value; research section 4).

---

## 10. CheckboxGroup: designed separately

**Designed and accepted 2026-10-17** as `design/components/checkbox-group.md` (issue #33). What
it settled, against the room this document had left: the group has its own `CheckboxGroup.Item`
part (a plain `Checkbox` inside a `CheckboxGroup.Root` is **not** a member, so item 2 below is
withdrawn and `Checkbox` reads no group context); the "select all" box is a library part,
`CheckboxGroup.Parent values={…}`, whose `indeterminate` is derived from the group's optimistic
set and is **not** suspended while pending (the `&& !pending` rule of section 4 is specific to
the consumer-owned prop here); group-level `required` is native `required` rendered on every
Item only while nothing is checked; the details shape is `{ reason, added, removed }`. The
consumer pattern in 2.4 remains valid for a select-all list built from plain Checkboxes.

The list below is kept as the record of the questions this design handed over:

- `CheckboxGroup.Root` = `<fieldset>` (role `group`) owning `value: string[]` /
  `defaultValue` / `valueChangeAction`, with a per-item optimistic reducer keyed by `value`
  (Accordion's multi-item reducer); `CheckboxGroup.Label` = `<legend>`; shared `name` applied to
  every item so `FormData.getAll(name)` yields the values.
- A "select all" parent whose `checked`/`indeterminate` derive from the group's **optimistic**
  set (so it is a trigger rendering optimistic state), and APG's optional "third click restores
  the previous partial selection", which belongs to the group's reducer.
- Group-level `required` ("at least one"): no native constraint exists; needs
  `setCustomValidity` on one member or a `required` prop on Root with a documented validity
  behaviour. Open design question, recorded here.
- Whether group `disabled` uses `<fieldset disabled>` (then `data-disabled` on items must be
  propagated through context, since the attribute does not reflect inheritance).

**What this design leaves room for**, so the group needs no breaking change to Checkbox:

1. `value?: string` is already a documented prop; in a group it identifies the item.
2. `checked` and `indeterminate` are plain props a group context can supply: Checkbox will read
   an optional `CheckboxGroupContext` (like `Accordion.Item` reads its Root) and, when present,
   derive `checked` from the group's optimistic set and route its dispatch to the Root. Adding a
   `use(Context)` to a file that is already `"use client"` changes nothing for consumers.
3. `CheckboxCheckedChangeDetails` is an interface, so a group can add fields (`item`) without a
   breaking change, and `reason` already has the vocabulary a group's mount reconciliation needs.
4. `name` stays pass-through on Checkbox; a group Root would own it on its items (as RadioGroup
   does), which is a per-mode ownership exactly like Accordion's `name`.

Items 1, 3 and 4 held; item 2 was replaced by the separate `Item` part (see above).

---

## 11. Test plan (`src/checkbox/checkbox.test.tsx`, `checkbox.browser.test.tsx`)

Every row of the Switch plan (its section 11) is repeated with `role` absent instead of
`"switch"` and the `fsui-checkbox-*` types; rows 1 to 25 there map one to one. Additional rows:

| # | Area | Env | Test |
| --- | --- | --- | --- |
| C1 | Roles and ARIA | jsdom | No `role` attribute by default; `role="menuitemcheckbox"` passes through; `aria-checked="mixed"` through props or a `render` element is removed. |
| C2 | Indeterminate | jsdom | `indeterminate` → after mount `el.indeterminate === true`, `data-indeterminate=""`, `el.checked === false`; `indeterminate={false}` → both absent; toggling the prop updates both. |
| C3 | Indeterminate, SSR | jsdom | `renderToString(<Checkbox indeterminate />)` contains `data-indeterminate=""` and no `aria-checked`; after `hydrateRoot`, `el.indeterminate === true` and no console error. |
| C4 | Indeterminate, click (both) | jsdom | Mixed box, deferred action: click dispatches `(true, …)`; while pending `el.checked === true`, `el.indeterminate === false`, no `data-indeterminate`, `data-pending`. Resolve with the parent setting `indeterminate={false}`: no dash, checked. |
| C5 | Indeterminate, rollback (both) | jsdom | Same, reject (caught inside, parent unchanged): after settle `el.checked === false`, `el.indeterminate === true`, `data-indeterminate=""`. Uncontrolled `checked` with `indeterminate`: commits `true`, dash returns (the prop is still true) — documents that the parent is expected to recompute. |
| C6 | Indeterminate, pseudo-class | browser | `:indeterminate` matches after mount, not while pending after a click, and again after a rollback, in Chromium, Firefox and WebKit (jsdom's selector engine support for `:indeterminate` is not relied on). |
| C7 | Indeterminate, forms | jsdom | A checked + indeterminate box still contributes `name=on` to `FormData`. |
| C8 | Indeterminate, reset | jsdom | Mixed box in a form, reset: dispatch `"platform"`; `el.indeterminate` false while pending and true after settle with the parent's prop unchanged. |
| C9 | Function props | jsdom | `className`/`style`/`render` receive `{ checked, indeterminate, pending, disabled }`; `indeterminate` is `false` in the pending render. |
| C10 | Directive | build | `dist/checkbox/checkbox.mjs` starts with `"use client"`; `dist/checkbox/index.mjs` does not. |

---

## 12. Implementation notes

```
packages/ui/src/checkbox/
  index.ts                 # no directive
  checkbox.tsx             # "use client"
  checkbox.test.tsx
  checkbox.browser.test.tsx
```

`checkbox.tsx` is Switch 12.2 with these edits: no `role` in `libraryProps`; `indeterminate`
destructured and passed to the hook as `indeterminate && !pending`; `data-indeterminate` emitted
from the same expression; `indeterminate: undefined` in `libraryProps` to strip a `render`
element's prop; `transitionTypes("checkbox", next ? "check" : "uncheck")`;
`warn: { component: "Checkbox", prop: "checked" }`. The shared hook is unchanged: its
`indeterminate` option is already specified in Switch section 7.

Dev warnings: the shared ones (both/mode switch, `preventDefault()`, wrong element) plus none
specific to `indeterminate` (an uncontrolled `checked` with `indeterminate` is allowed, see
section 3).

Example app: the select-all list of 2.4 against a fake 800 ms API with a failure toggle, so the
rollback-to-mixed path of 6.2 can be seen in real engines; the CSS of 2.6 and 2.7.

---

## Cross-component (resolved 2026-10-16)

As Switch's section: everything assumed here is now in conventions 3.8 and resolved questions 16
to 21. `CheckboxGroup` is deferred as issue #33 (section 10). RadioGroup has no `indeterminate`;
an empty radio group matching `:indeterminate` is the platform's business.

## Conventions feedback (applied 2026-10-16)

Both items were applied: "consumer-owned, mirrored" is named as the fourth kind of state in
conventions 3.5 and on the `indeterminate` row of 4.1; the `render` element-type restriction for
native inputs and fieldset Roots is in 1.2, with the dev warning in the shared hook.

## Questions for the product owner

1. **`state.indeterminate = indeterminate && !pending`** (section 4): resolved, suspended while
   pending (conventions resolved question 18).
2. **No `Checkbox.Indicator` in v0** (section 1): resolved, plain-input anatomy (conventions
   resolved question 16).
3. **CheckboxGroup deferred** (section 10): resolved, issue #33 (conventions resolved question
   20); designed and accepted 2026-10-17 in `design/components/checkbox-group.md`, which also
   answered the group-level `required` question (dynamic native `required` on the Items).
4. **`indeterminate` with uncontrolled `checked`** is allowed (no warning). Alternative: warn
   that mixed only makes sense when the parent controls `checked`. Recommendation: allow; the
   dash simply persists until the parent changes the prop, and a warning would be wrong for the
   "mixed until first interaction" use.
