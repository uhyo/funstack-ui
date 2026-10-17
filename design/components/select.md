# Select

Status: **accepted** (2026-10-17, GitHub issue #50; the product owner accepted questions 1 to 3
and 5 to 8 as recommended and decided question 4 against the warning, see "Decisions recorded"
at the end; **implemented** in 1114850 and reviewed the same day, `memo/reviewer/select.md`,
with the review's corrections and the accepted deviations folded in, see "Review corrections"
at the end). Follows `design/conventions.md`
(accepted); where this document and the conventions disagree, the conventions win. **Read
`design/components/radio-group.md` first**: it defines the model for a library-owned value held
in a controlled native form control (`value` / `defaultValue` / `valueChangeAction`, optimistic
DOM state, one dispatch per state owner on the residual browser paths, the form-reset listener).
This document repeats only what differs for a `<select>`.

Inputs: `docs/vision.md`, `design/conventions.md`, `docs/research/select-combobox.md` (binding:
the five React 19.3.1 problems, the engine support table, the stacking notes),
`docs/research/form-controls.md` §2 (controlled native inputs under transitions),
`design/components/radio-group.md`, `design/components/checkbox-group.md` (late-mounting members,
8.1), `design/components/menu.md` (parts vocabulary, WebKit 302008 handling), the product owner's
decisions on the researcher's open questions (recorded in "Decisions at a glance"), react-dom
19.3.1 source (`updateOptions`, `restoreControlledSelectState`, the select branch of
`setInitialProperties` / `updateProperties`), and one Chromium probe run for this design
(`memo/architect/select-notes.md`: `<selectedcontent>` refresh and late `option.selected` writes
while the picker is open, `defaultSelected` versus option dirtiness, MutationObserver records).

Select is a **real `<select>`**, progressively enhanced with customizable select. The platform
gives it form participation, `required` and constraint validation, autofill, typeahead,
`<optgroup>` and `<hr>`, the native `combobox` mapping, mobile pickers, and interaction before
hydration. Consumers opt into the styled picker with one CSS declaration
(`appearance: base-select`); the library ships the markup for it unconditionally and no
JavaScript for the picker at all. The library adds exactly what it adds to RadioGroup: the
selection is a library-owned state driven through `valueChangeAction` inside a transition, with
optimistic feedback and `data-pending`, plus three small fixes for things React 19.3.1 gets wrong
with a `<select>` (hydrating `<selectedcontent>`, options that mount late, a stale
`<selectedcontent>`).

## Decisions at a glance

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Element | `Select.Root` renders `<select>` (product-owner decision 1). There is **no open state**: no `open`, `defaultOpen`, `openChangeAction`, `data-open`, `Popup` part or `transition` for open/close. The picker is the UA's `::picker(select)` pseudo-element, opened and closed by the browser with no events (`select-combobox.md` §5); `:open` and `::picker(select)` are the styling hooks and are documented (section 7). A best-effort `data-open` from focus heuristics is rejected: it would be wrong in Chromium (focus moves to the option while open) and could not be promised anywhere. |
| 2 | Anatomy | `Select.Root` (`select`), `Select.Trigger` (`button`, first child), `Select.Value` (`selectedcontent`), `Select.Option` (`option`), `Select.Group` (`optgroup`), `Select.GroupLabel` (`legend`), `Select.Separator` (`hr`). `Trigger` and `Value` are optional: without them an engine with customizable select renders its UA button with the selected option's text. `::picker-icon` and `::checkmark` are pseudo-elements, not parts. |
| 3 | State | One library-owned state, `value: string`, as `value` / `defaultValue` / `valueChangeAction(next, details)`. The value is **always a string** and never `null`: a single `<select>` always has a value (`select.value` is a string), and "nothing chosen" is the HTML idiom of a first `<Select.Option value="">` placeholder, which is also what `required` rejects (section 5). With neither `value` nor `defaultValue` the Select **follows the browser** (product-owner decision 4, native-first as RadioGroup): the initial value is the option the browser selects, the first enabled option (a first `value=""` placeholder counts), adopted silently at mount and while options are still loading, **until any dispatch has established the value**; after that, late options only get the re-apply (review H1); **no dev warning** (section 5). |
| 4 | Rendered DOM state | `Root` renders `value={optimistic}` (React problem 3). react-dom restores a controlled select's options to its props after every event (`restoreControlledSelectState` → `updateOptions`), and only the sync-lane optimistic update is flushed before that restore; a transition-only value snaps back, and `<selectedcontent>` with it, for the whole pending time (`select-combobox.md` §4, probe B). |
| 5 | `Select.Value` | Renders `<selectedcontent suppressHydrationWarning dangerouslySetInnerHTML={{ __html: "" }} />` (product-owner decision 2, the verified workaround for React problem 1). The browser fills it; it has **no `children` prop**. It works before hydration and in a Server Component tree. |
| 6 | Stale `<selectedcontent>` | **The library refreshes it automatically** (product-owner decision 3, my call): `Select.Value` observes the `<select>` subtree with a `MutationObserver` and, when a mutation lands inside the currently selected option, re-assigns `select.value = select.value`, which re-clones the option in Chromium and is spec-conformant for Safari. Verified cheap (one small clone per batch of mutations) and safe (no events, selection unchanged, the open picker and its focused option are untouched). Section 6.3 has the justification and the filter. |
| 7 | Late options | Options revealed inside the select by Suspense, `use()` or lazy loading are **re-applied** (React problem 2): the Root selects the option matching the intended value when it mounts, through the Option's mount report. An option that **hydrated** (its element came from the server) is reconciled first, because a user may have picked it before hydration; an option React **created** is only re-applied, because the browser's automatic first-option selection on insertion is not a user intent. The Option tells them apart with `useSyncExternalStore`'s server snapshot (section 6.2). |
| 8 | Residual browser paths (`reason: "platform"`) | Mount reconciliation (pre-hydration picks, Firefox form-state restoration) and form reset (`<button type=reset>`, `form.reset()`, React's automatic reset after `<form action>`, React problem 5) dispatch once per Select through `useNativeGroupReconciliation` on the `<select>` (conventions 3.8). A platform dispatch happens only when the **intended option exists in the DOM** and a different option is selected; a value that matches no option is never "reconciled" to the browser's fallback. |
| 9 | Reset target | The library mirrors the reset target into `option.defaultSelected` itself (uncontrolled: the latest `defaultValue`; controlled: the Root's mount-time `value`; adopt mode: the value adopted at mount, review M1), because react-dom writes `defaultSelected` only for an uncontrolled `defaultValue` (so a client-rendered controlled select would otherwise reset to its first option, while an SSR'd one resets to the server value). The mirror is written before the selection is re-applied in the same synchronous step, since `defaultSelected = true` on a non-dirty option moves the selection (probe, section 6.1). |
| 10 | Keyboard | Entirely engine-defined; the library installs no key handler. Chromium's customizable select, Firefox's native select and Safari differ (section 8); the library contract is "one dispatch per committed change, optimistic value", not a key map. |
| 11 | Pending and state exposure | `data-pending` on `Root` (the owner), on `Trigger` (the trigger the user acted on) and on the `Option` whose value is the optimistic target; `data-selected` (optimistic) on `Option`, equal to `:checked`; `data-disabled` on `Root` and `Option`. Never natively disabled while pending (and `disabled` would also drop the value from form submission). |
| 12 | Form props | `name`, `required`, `disabled`, `form`, `autoComplete` on `Root`, all native. `multiple` and `size` are **omitted from the type**: multi-select is deferred (product-owner decision 7, section 13). |
| 13 | ViewTransition | **No `transition` prop on any part in v1** (product-owner decision 4). The Select has no committed-state content region: the picker is a UA pseudo-element, `<selectedcontent>` is written by the browser, and every library attribute is optimistic. Same reasoning as Menu's items (conventions 5.1). The dispatch adds `fsui-select` so dependent content elsewhere can animate. A value-change `update` transition around the Trigger is possible future work (section 10). |
| 14 | Degradation | No flag. Firefox (default prefs) renders the native select from the same markup: the `<button>` is not rendered, `<selectedcontent>` stays empty, everything else (value, form, validation, reset, actions, pending) is identical (section 11). The conventions' section 8 row `Select.Root experimental_baseAppearance` is withdrawn. |
| 15 | Combobox boundary | Search, free text, filtering, load-on-open, controlled open, multi-select chips and virtualization are Combobox (its own design, later). Select never grows them. |
| 16 | Files | Every part file is `"use client"` (context, hooks). An action-less Select is JS-free in behaviour (pick, submit, validate and `<selectedcontent>` all work before hydration); directive-free variants are tracked in #19. |

Everything not listed (not disabled while pending, errors and rollback, overlap and latest-intent,
the post-`await` rule, `render` restrictions on native elements, no `useFormStatus` coupling, the
two Server Function channels, the reset-target-by-mode rule) is identical to RadioGroup and not
restated.

---

## 1. Anatomy

```tsx
import { Select } from "@funstack/ui/select";

<Select.Root name="fruit" defaultValue="" required valueChangeAction={saveFruit}>
  <Select.Trigger>
    <Select.Value />
  </Select.Trigger>
  <Select.Option value="">Choose a fruit</Select.Option>
  <Select.Group label="Citrus">
    <Select.GroupLabel>Citrus <em>fruits</em></Select.GroupLabel>
    <Select.Option value="orange"><Icon name="orange" aria-hidden /> Orange</Select.Option>
    <Select.Option value="lemon"><Icon name="lemon" aria-hidden /> Lemon</Select.Option>
  </Select.Group>
  <Select.Separator />
  <Select.Option value="apple" disabled>Apple (out of season)</Select.Option>
  <Select.Option value="banana">Banana</Select.Option>
</Select.Root>
```

Rendered DOM (value `""`, nothing pending):

```html
<select name="fruit" required>
  <button type="button"><selectedcontent>Choose a fruit</selectedcontent></button>
  <option value="" selected data-selected="">Choose a fruit</option>
  <optgroup label="Citrus">
    <legend>Citrus <em>fruits</em></legend>
    <option value="orange"><svg aria-hidden="true">…</svg> Orange</option>
    <option value="lemon"><svg aria-hidden="true">…</svg> Lemon</option>
  </optgroup>
  <hr>
  <option value="apple" disabled data-disabled="">Apple (out of season)</option>
  <option value="banana">Banana</option>
</select>
```

(`<selectedcontent>`'s content is written by the browser, not by React: the server sends it
empty and the parser fills it; see 3.3.)

| Part | Element | Role | Renders from | Notes |
| --- | --- | --- | --- | --- |
| `Root` | `select` | `combobox` (native) | pending, disabled | Owns state, context, the transition, the reset listener, mount reconciliation and the re-apply of late options. Form props are native. |
| `Trigger` | `button` (`type="button"`) | none added (not in the AX tree) | Root state | Optional. **Must be the first child** of Root (HTML content model; the parser otherwise treats it as a stray element). Not rendered by engines without customizable select. Content model forbids interactive content. |
| `Value` | `selectedcontent` | none | Root state (for `className` / `style`) | Optional, inside `Trigger`. The browser clones the selected option's children into it on every selection change. No `children`. |
| `Option` | `option` | `option` (native) | **optimistic** value | `value` required. `data-selected`, `data-pending`, `data-disabled`. Content must read as plain text (section 11). |
| `Group` | `optgroup` | `group` (native) | – | `label` required (the attribute is what engines without customizable select and assistive technology use). |
| `GroupLabel` | `legend` | names the group | – | Optional, **first child** of `Group`; rich rendered label in engines with customizable select. Keep its text equal to the Group's `label`. |
| `Separator` | `hr` | `separator` (Chromium customizable select; not exposed with native appearance) | – | Decorative. |

Why this shape:

- **`Root` is the `<select>` itself.** Everything the component is (form value, validation,
  picker, keyboard, AX mapping) lives on that element; a wrapper would be a part that renders an
  element the consumer did not ask for (conventions 1.1). A `render` element must stay a
  `<select>` (dev warning), as a RadioGroup Root must stay a `<fieldset>`.
- **`Trigger` and `Value` are optional, not generated.** A select with no `<button>` child gets
  the UA's button showing the selected option's text in Chromium and Safari. Consumers add the
  two parts when they want rich content in the button (an icon next to the name, a pending
  spinner from the Trigger's function `children`). Generating them would make the JS-free markup
  depend on hydration-sensitive content; keeping them explicit also keeps the hydration
  workaround in exactly one element the consumer can see.
- **`Value` has no `children`.** The browser writes the element's content; anything React put
  there would be replaced at the first selection change and would break hydration in Chromium
  and Safari (React problem 1). A placeholder is an `Option` with `value=""`, whose content the
  browser clones into `Value` like any other option's.
- **`Group` takes `label` and `GroupLabel` is separate.** HTML requires `label` on `<optgroup>`;
  Firefox's native picker shows only the attribute; `<legend>` is the rendered label for
  customizable select (the new parser keeps it, Chromium 135 / Firefox 150 / Safari 27). Two
  parts, two jobs, mirroring Menu's `Group` / `GroupLabel` naming.
- **No `Popup`, `Positioner`, `Portal`, `Indicator`, `Icon`.** The picker is `::picker(select)`,
  placed by the UA with anchor positioning (consumers override `position-area` on the
  pseudo-element); the arrow is `::picker-icon`; the check mark is `::checkmark`. None is an
  element, so none can be a part.

Every part renders exactly one element and none renders a `<ViewTransition>` (decision 13).

## 2. States

| State | Owner | Kind | Library-owned or browser-owned | Transition? |
| --- | --- | --- | --- | --- |
| `value` | `Root` | `string` | **Library-owned** through a controlled native `<select value={optimistic}>`, with residual browser paths: pre-hydration picks and Firefox form-state restoration (mount reconciliation), form reset, and late-mounting options (re-applied, never dispatched unless a hydrated option carried a pick). | Yes: every pick, every native keyboard step, every platform dispatch. |
| `pending` | `Root` | boolean | Library-owned (`useTransition`) | n/a |
| picker open | DOM | `:open` | **Browser-owned, unobservable.** No `toggle` event, no `hidePicker()`, `showPicker()` needs activation. Not mirrored. | n/a |
| focus (select or, in Chromium while open, the option) | DOM | element | Browser-owned. The library never calls `focus()`. | n/a |
| validity (`required`, `:user-invalid`) | DOM | | Browser-owned; not mirrored. | n/a |
| `name`, `form`, `required`, `disabled`, `autoComplete` | `Root` | config | n/a | Plain native props. |

There is no activation mode: the engine decides whether arrows commit (Firefox, native) or move
focus until Enter (Chromium customizable select). Section 9.4 covers what that means for an
awaited action.

## 3. Props and types

Shared types come from `packages/ui/src/internal/types.ts` (conventions 2.2, 9.4).

### 3.1 `Select.Root`

```ts
export interface SelectValueChangeDetails extends ActionDetails {
  /**
   * Library-wide vocabulary (conventions 2.2):
   * "activate": the user picked an option (pointer, keyboard, typeahead, or browser autofill,
   * which the library cannot tell from a pick); `details.event` is the native `change` event.
   * "platform": the browser changed the value without a pick the library saw: a form reset
   * (`details.event` is the `reset` event), or a pick before hydration / Firefox form-state
   * restoration reconciled at mount (`details.event` is `undefined`).
   */
  readonly reason: ChangeReason;
}

export interface SelectRootState {
  /** Optimistic value. Content rendered from it must not suspend. */
  readonly value: string;
  /** An action dispatched through this Select is in flight. */
  readonly pending: boolean;
  readonly disabled: boolean;
}

export interface SelectRootProps
  extends Omit<
    ComponentPropsWithRef<"select">,
    | "value" | "defaultValue" | "onChange" | "multiple" | "size" | "disabled"
    | "className" | "style" | "children"
  > {
  /** Controlled value. `undefined` means uncontrolled. Use `""` for the placeholder option. */
  value?: string;
  /** Initial value in uncontrolled mode. When omitted, the browser's choice (the first enabled option) is adopted at mount. */
  defaultValue?: string;
  /**
   * Runs inside the Root's transition whenever the selected option changes. May be sync or
   * async; rejections reach the nearest Error Boundary and roll the selection back.
   * In engines whose closed select changes the value on every arrow press (Firefox, Safari with
   * native appearance), every press dispatches; the latest dispatch wins (section 9.4).
   * A `setState` after your own `await` is not a Transition update; wrap it in `startTransition`.
   */
  valueChangeAction?: ChangeAction<string, SelectValueChangeDetails>;
  /** Native `disabled` (owned). Never set by the library while pending. */
  disabled?: boolean;
  className?: StateValue<string | undefined, SelectRootState>;
  style?: StateValue<CSSProperties | undefined, SelectRootState>;
  children?: StateValue<ReactNode, SelectRootState>;
  render?: RenderProp<ComponentPropsWithRef<"select">, SelectRootState>;
}
```

`name`, `required`, `form`, `autoComplete`, `autoFocus`, `id`, `aria-*`, `onInput`, `onFocus`,
`onBlur` and every other `<select>` prop pass through. `onChange` is the library's handler and
is omitted. `multiple` and `size` are omitted because listbox and multi-select rendering are not
part of v1 (section 13); passing them through a `render` element is unsupported. `onReset` is
not omitted (the reset listener is attached to the form owner through `addEventListener`, as in
RadioGroup).

### 3.2 `Select.Trigger`

```ts
export interface SelectTriggerProps
  extends Omit<ComponentPropsWithRef<"button">, "type" | "className" | "style" | "children"> {
  className?: StateValue<string | undefined, SelectRootState>;
  style?: StateValue<CSSProperties | undefined, SelectRootState>;
  /** Non-interactive content only (HTML content model of a select's button). */
  children?: StateValue<ReactNode, SelectRootState>;
  render?: RenderProp<ComponentPropsWithRef<"button">, SelectRootState>;
}
```

Renders `<button type="button" data-pending data-disabled>`; `type` is owned and written
explicitly because Chromium 156 reports `.type === "submit"` for a select's button (the spec and
Firefox say `"button"`; no submission happens either way). The Trigger's state is the Root's, so
a pending indicator next to the value is:

```tsx
<Select.Trigger>{({ pending }) => <><Select.Value /> {pending && <Spinner aria-hidden />}</>}</Select.Trigger>
```

Development warns once when the mounted button is not the first element child of its `<select>`.

### 3.3 `Select.Value`

```ts
export interface SelectValueProps
  extends Omit<ComponentPropsWithRef<"selectedcontent">, "children" | "dangerouslySetInnerHTML" | "className" | "style"> {
  className?: StateValue<string | undefined, SelectRootState>;
  style?: StateValue<CSSProperties | undefined, SelectRootState>;
  render?: RenderProp<ComponentPropsWithRef<"selectedcontent">, SelectRootState>;
}
```

Renders exactly:

```tsx
<selectedcontent suppressHydrationWarning dangerouslySetInnerHTML={{ __html: "" }} {...rest} />
```

Why each piece (React problem 1, `select-combobox.md` §4, hydration variant E2):

- The server sends `<selectedcontent></selectedcontent>`. Chromium's and Safari's parser clone
  the selected option's children into it **before React hydrates**, so hydration finds children
  React did not render. With a plain `<selectedcontent />` React throws a recoverable hydration
  error and **client-renders the whole root** (a new `<select>` element; pre-hydration picks and
  focus lost).
- `dangerouslySetInnerHTML={{ __html: "" }}` makes React treat the children as opaque, so it
  does not diff them (hydrates; dev-only "attributes didn't match" message).
- `suppressHydrationWarning` silences that message. Result: hydrates, no error in any engine,
  later picks still clone.
- `children` is omitted from the type (the browser owns the content, 1.); `render` must stay a
  `<selectedcontent>` (dev warning), because only that element is cloned into.
- `@types/react` has no `selectedcontent` intrinsic element yet; the library's
  `platform-attributes.ts` module augmentation adds it to `JSX.IntrinsicElements` as
  `React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>` with a
  DefinitelyTyped link (conventions 7.4). react-dom renders the unknown lowercase tag verbatim on
  both sides.

The part also owns the stale-content refresh (section 6.3).

### 3.4 `Select.Option`

```ts
export interface SelectOptionState {
  readonly value: string;
  /** Optimistic: true as soon as the user picks this option, before the action settles. */
  readonly selected: boolean;
  /** The Root is pending and this option is the optimistic target. */
  readonly pending: boolean;
  /** Disabled by its own prop, by an enclosing `Group disabled`, or by `Root disabled` (what `:disabled` matches). */
  readonly disabled: boolean;
}

export interface SelectOptionProps
  extends Omit<ComponentPropsWithRef<"option">, "value" | "selected" | "className" | "style" | "children"> {
  /** The option's value. Required: React cannot infer a value from rich children. */
  value: string;
  /** Native `disabled`: not pickable, skipped by keyboard navigation. */
  disabled?: boolean;
  className?: StateValue<string | undefined, SelectOptionState>;
  style?: StateValue<CSSProperties | undefined, SelectOptionState>;
  children?: StateValue<ReactNode, SelectOptionState>;
  render?: RenderProp<ComponentPropsWithRef<"option">, SelectOptionState>;
}
```

`value` and `selected` are owned (`selected` is never rendered: selection is the Root's
`value={optimistic}` plus the re-apply effect). `label` passes through but is **documented
against**: Chromium names the option from `label` while the combobox value and
`<selectedcontent>` show the content (`select-combobox.md` §2). `hidden` passes through but
WebKit ignores it on native-appearance selects; filtering is Combobox's job. The Option emits
`data-selected` (optimistic), `data-pending`, `data-disabled`. `disabled` includes a disabled
`Select.Group` (passed down through the Group's context), so `data-disabled` and `:disabled`
agree (review L6).

### 3.5 `Select.Group`, `Select.GroupLabel`, `Select.Separator`

```ts
export interface SelectGroupProps
  extends Omit<ComponentPropsWithRef<"optgroup">, "label" | "className" | "style" | "children"> {
  /** The `<optgroup label>`: shown by native pickers, read by assistive technology. Required. */
  label: string;
  disabled?: boolean;
  className?: StateValue<string | undefined, SelectRootState>;
  style?: StateValue<CSSProperties | undefined, SelectRootState>;
  children?: StateValue<ReactNode, SelectRootState>;
  render?: RenderProp<ComponentPropsWithRef<"optgroup">, SelectRootState>;
}
export interface SelectGroupLabelProps extends Omit<ComponentPropsWithRef<"legend">, "className" | "style"> { … }
export interface SelectSeparatorProps extends Omit<ComponentPropsWithRef<"hr">, "className" | "style"> { … }
```

`Group`'s `label` is owned (the attribute is load-bearing for Firefox and AT). `GroupLabel` must
be the first child of its `Group` (dev warning otherwise, like `RadioGroup.Label`). `Separator`
renders `<hr>` and takes no state.

### 3.6 Namespace

```ts
export const Select = {
  Root: SelectRoot,
  Trigger: SelectTrigger,
  Value: SelectValue,
  Option: SelectOption,
  Group: SelectGroup,
  GroupLabel: SelectGroupLabel,
  Separator: SelectSeparator,
} as const;
```

Exports: `SelectRootProps`, `SelectRootState`, `SelectTriggerProps`, `SelectValueProps`,
`SelectOptionProps`, `SelectOptionState`, `SelectGroupProps`, `SelectGroupLabelProps`,
`SelectSeparatorProps`, `SelectValueChangeDetails`.

## 4. A native `<select>` under transition-by-default

### 4.1 What the browser and React do on a pick

1. The user picks (click on an option, Enter / Space in the open picker, an arrow or typeahead
   on a closed native select, or autofill). The browser sets the option's selectedness and
   dirtiness, refreshes `<selectedcontent>`, and fires `input` then `change` on the `<select>`.
2. React's root listener turns `change` into the library's `onChange`. `details.event` is the
   native `change` `Event` (not a click: the ChangeEventPlugin for `<select>` is change-driven).
3. The library dispatches inside the Root's `useTransition`: `addTransitionType("fsui-select")`,
   `setOptimistic(next)`, the action awaited. The sync prefix of the consumer's action runs
   during the event dispatch.
4. At the end of the event react-dom flushes sync work (the optimistic render, `SyncLane`) and
   then **restores** the select: `restoreControlledSelectState` → `updateOptions(select,
   props.value)` writes `.selected` on the option matching the current `value` prop. Because the
   prop was just rendered from the optimistic value, the restore confirms the pick. DOM,
   `data-selected` and `<selectedcontent>` agree.
5. When the action settles the transition commits; optimistic converges; `data-pending` leaves.
   On rejection or a controlled veto, optimistic reverts, the Root re-renders with the old
   `value`, and react-dom's select update calls `updateOptions` with it: **the DOM rolls back
   and `<selectedcontent>` follows** (a selection change re-clones) without any library effect.

Why step 4 forces decision 4: with `value` driven by committed state the restore writes the old
option and the select (and its button) snap back until the transition commits, which for an
async action is the whole pending time (`select-combobox.md` §4, probe table, both engines).

### 4.2 No-op rule

A dispatch is skipped when `next === optimistic` (conventions 2.3 item 8). Browsers fire no
`change` for re-picking the selected option, so this matters only on the platform paths.

### 4.3 `preventDefault`

`change` is not cancelable; there is nothing to cancel and no warning to emit. A veto is
controlled mode (RadioGroup 9.5).

## 5. Value, placeholder, `required`

- **`value` is a string, never `null`.** A single `<select>` has a value whenever an option is
  selected, and `select.value` is `""` when none is (no option, or all disabled). The
  conventions' "none selected is `null`" (3.1) is written for components that have a real empty
  state; a select's empty state is an option. Flagged in the questions (1).
- **The placeholder is `<Select.Option value="">…</Select.Option>` as the first option**, a
  direct child of Root (after the Trigger). That is HTML's *placeholder label option*: with
  `required`, selecting it is `valueMissing`, the browser's own localised message appears on
  submit, and `:user-invalid` matches after interaction. It may be `disabled` so the user cannot
  return to it once a real option is chosen; React still selects a disabled option when `value`
  is `""` (`updateOptions` compares values, not disabledness), so `defaultValue=""` works with a
  disabled placeholder.
- **A value that matches no option** leaves the DOM on whatever the browser chose (the first
  enabled option; nothing, if none). `state.value` still reports the prop, so the form would
  post the browser's choice. This is a consumer error outside Suspense (section 6.2 covers the
  transient case); the library does not warn, because it cannot tell the two apart at commit
  time.
- **Neither `value` nor `defaultValue`: the browser's default.** Valid HTML selects its first
  enabled option, so the Select does the same (product-owner decision 4; no warning, the
  RadioGroup precedent). Until mount the state is `""`, so the server HTML carries no
  `selected` attribute and the parser selects the first enabled option, exactly what React's
  `updateOptions("")` does on a client mount. In the Root's mount layout effect the
  uncontrolled value **adopts** the DOM's selection without a dispatch, and the mount
  reconciliation compares the DOM against that implicit default (the first enabled option)
  rather than against the not-yet-adopted `""`, so a pre-hydration pick of another option is
  still dispatched with `reason: "platform"`. The same adoption runs when options mount later
  while the state's option does not exist (the fallback-only case), **but only until a dispatch
  of any reason has established the value** (review H1): once the user has picked, or a
  platform path has dispatched, late options get the re-apply of 6.1 only, so a boundary that
  re-suspends after a pick (a keyed `<Suspense>` reload, a refetch with `use()`) shows its
  fallback and then restores the pick instead of silently replacing it with the first option.
  **The reset target in adopt mode is the value adopted at mount** (review M1), mirrored into
  `defaultSelected` like a controlled mount-time value; when that value is `""` it is mirrored
  only when it came from a `""` option (a disabled placeholder that react-dom or Fizz selected),
  not from a select with nothing selectable. Without the mirror a client-rendered tree with a
  disabled `""` placeholder would reset to the first *enabled* option and dispatch `"platform"`
  for an untouched form, while an SSR'd tree (Fizz writes `selected` on the placeholder) would
  stay on `""`. Adoption is a layout-effect state write flushed before paint (`adopt(next)` on
  `useControllableAction`, uncontrolled mode only; it never calls the action).

## 6. The three React fixes

### 6.1 Re-apply and reset target: the Root's layout effect

After **every** Root commit, one internal routine runs on the `<select>` (the Select analogue of
`useNativeChecked`'s re-apply, conventions 3.8):

```ts
function applySelection(select: HTMLSelectElement, target: string, resetTarget: string | undefined): void {
  // 1. Mirror the reset target (uncontrolled: latest `defaultValue`; controlled: mount-time value).
  if (resetTarget !== undefined) {
    for (const option of select.options) {
      const want = option.value === resetTarget;
      if (option.defaultSelected !== want) option.defaultSelected = want; // may move the selection
    }
  }
  // 2. Apply the intended selection (the latest in-flight `next`, else the optimistic value).
  const option = findOption(select, target);
  if (option !== null && !option.selected) option.selected = true;
}
```

Facts the order relies on (Chromium probe, `memo/architect/select-notes.md`):

- Writing `defaultSelected = true` on an option whose **dirtiness** is false **selects it** (the
  spec's "selected attribute changed" steps), and writing `false` on a non-dirty selected option
  deselects it, after which the browser selects the first enabled option. A dirty option (one
  the user picked or script set `.selected` on) is not moved. React's `updateOptions` makes the
  matching option dirty, so React-selected options are safe, but a *new* reset target is
  non-dirty; step 2 restores the intended option in the same synchronous step, before any paint.
  Writes happen only when the property differs, so the common commit does nothing.
- `option.selected = true` on a different option updates `<selectedcontent>` and keeps an open
  picker open with its focused option untouched; on the already-selected option it is a no-op
  (it does not refresh content; that is 6.3's job).
- react-dom writes `defaultSelected` only when the select is uncontrolled (`defaultValue`), so a
  client-rendered controlled select has no reset target at all and `form.reset()` would select
  its first option, while an SSR'd one carries the server's `selected` attribute. The mirror
  makes both reset to the Root's mount-time `value` (conventions 3.8 rule 6), with one
  improvement over RadioGroup's controlled-mode caveat: the mount-time value is the **Root's**,
  so an Option added later never becomes a second reset target.

`resetTarget` is the latest `defaultValue` in uncontrolled mode (re-read every commit), the
value captured at the Root's mount in controlled mode, and in adopt mode (neither prop) the
value adopted at mount (section 5, review M1), so that an untouched form resets to what it
showed; `""` is mirrored only when a `""` option exists.

### 6.2 Late-mounting options (React problem 2)

React applies `value` to the options only in the select's own commit (`updateOptions` runs from
`setInitialProperties` / `updateProperties` / `restoreControlledState` of the `<select>`). An
option revealed later by a Suspense boundary, `use()` or lazy loading inside the select is never
selected by React; the browser's selectedness-setting algorithm selects the first enabled option
instead (`select-combobox.md` §4, probe C2: `"a"` in both engines, every fallback variant).

The fix: every `Select.Option` reports its mount to the Root (`ctx.optionMounted(el, hydrated)`
from its mount layout effect, the CheckboxGroup `onItemMounted` pattern), and the Root runs
`applySelection` (6.1) for it. Reports from Options rendered in the Root's own commit are
ignored, as in the shared adapter: the Root's effect covers them.

What `hydrated` is for. A late option can carry a **user pick made before hydration** only if
its element came from the server (streamed into the page, picked by the user, then hydrated
by React); an element React **created** cannot (the only "pick" on it is the browser's automatic
first-option selection on insertion, which is not an intent). Reconciling both the same way
would either dispatch the browser's automatic choice as a `"platform"` change on every client
render with Suspense-loaded options (wrong) or overwrite a real pre-hydration pick (wrong). So:

- `hydrated` is read from `useSyncExternalStore(noopSubscribe, () => false, () => true)` in
  the Option, captured in its mount effect: React uses the server snapshot for the render that
  hydrates a server-rendered subtree, including a Suspense boundary hydrated after the Root, and
  the client snapshot for a client-created subtree. Verified at implementation: the mount
  layout effect sees the server snapshot's render. The cost (review L8): every **hydrated**
  Option re-renders once more after hydration, when the two snapshots differ, one extra sync
  pass over N options for a long server-rendered list (countries); accepted, since it happens
  once per hydration and the Option's render is tiny.
- **Hydrated** option: the Root takes the DOM snapshot in the layout phase (the adapter's
  `onItemMounted` wrapper, conventions 3.8 rule 3), runs `applySelection` at once, and in the
  microtask compares the snapshot with the base; a difference dispatches `"platform"` with
  `event: undefined`, after which the optimistic render puts the pick back in the DOM before
  paint. No difference: nothing dispatched, the re-apply was a no-op.
- **Created** option: `applySelection` only. Never a dispatch.

The dispatch gate from decision 8 applies to both the Root's mount reconciliation and the late
path: a `"platform"` dispatch happens only when **an option with the base value exists in the
DOM** and a different option is selected. Without the gate, a controlled `value="c"` whose
options are still loading (DOM: fallback only) would dispatch the fallback at mount.

Async option patterns the docs show:

```tsx
// 1. Options inside the select, fallback is a disabled option (never pickable). Until the real
//    options arrive the DOM selects nothing and the button is empty; on reveal the library selects
//    `value`'s option and <selectedcontent> fills.
<Select.Root value={fruit} valueChangeAction={(next) => { setFruit(next); }}>
  <Select.Trigger><Select.Value /></Select.Trigger>
  <Suspense fallback={<Select.Option value="" disabled>Loading…</Select.Option>}>
    <FruitOptions />   {/* use(fruits) → <Select.Option> list */}
  </Suspense>
</Select.Root>

// 2. The whole Select inside the boundary: a skeleton instead of an empty select (consumer's layout choice).
```

"Load on open" is not possible (no open event); preload, or use Combobox.

### 6.3 Stale `<selectedcontent>` (React problem 4): the automatic refresh

The platform updates `<selectedcontent>` on selection changes, parser pops and insertion of the
element, **not** on mutations inside the selected option (spec-conformant; Chromium 156 verified).
So an option whose content React changes after it was selected leaves the button stale: a label
that switches language, a count that updates, children rendered from the Option's own state
function (`{({ selected }) => …}`), or a Suspense boundary inside the option resolving.

Decision: **the library refreshes automatically.** `Select.Value` installs, in a mount effect,
one `MutationObserver` on its `<select>` (`childList`, `characterData`, `attributes`,
`subtree`) and, when a batch contains a record whose target is **inside the currently selected
`<option>`** (the option itself for `childList`, a descendant for every type; records inside
`<selectedcontent>` and attribute records on the `<option>` element itself are ignored, since
option attributes are not cloned), runs once per batch:

```ts
if (select.selectedIndex !== -1) select.value = select.value;
```

Justification against "cheap and safe":

- **Cheap.** One observer per Value; the callback is a microtask after a commit that touched the
  select's subtree; the filter is a `closest("option")` per record; the refresh clones one
  option's children (a few nodes). Library writes of `data-selected` / `data-pending` on
  options are attribute records on the option element and are filtered out. The observer is not
  installed where `HTMLSelectedContentElement` is undefined (Firefox today, jsdom), because
  nothing is cloned there.
- **Safe.** `select.value = select.value` fires no `input` / `change`, changes no selection, and
  (Chromium probe, cases 1 to 3) leaves an open picker open with its focused option untouched,
  even when the user had moved focus to another option. The `selectedIndex` guard keeps it from
  selecting the placeholder when nothing is selected (case 7). Mutation records produced by the
  clone target `<selectedcontent>` and are filtered, so there is no loop. Setting `.value`
  **does set the matching option's dirtiness** (the spec's setter step; verified in Chromium,
  review P1b), which is benign and even helpful: a refreshed option is not moved by a later
  `defaultSelected` mirror, exactly as React's `updateOptions` already dirties it. It leaves
  `defaultSelected` alone and does **not** clear `:user-invalid` (verified, review P1), so
  validity styling survives a refresh.
- **Alternatives rejected.** (a) Document "option content is static once rendered; change the
  `key` to refresh": a remount of the selected option while the picker is open drops focus to
  `body` (probe case 10), and the rule is easy to break by accident with function `children`.
  (b) Refresh from the Option's own layout effect: misses a Suspense boundary resolving inside
  the option and any memoised subtree. (c) Re-insert `<selectedcontent>`: moves a React-owned
  node. The observer covers every case with one mechanism.

**Refresh after a form reset** (developer deviation 1, accepted; review P2). The spec's select
reset algorithm ends with "update a select's descendant selectedcontent elements"
unconditionally, but Chromium 156 re-clones only when no option carries `selected` /
`defaultSelected`; when the reset restores a `defaultSelected` option, which is the library's
normal case (both modes mirror the reset target), the value moves and the button stays on the
old option. Recorded as a Chromium bug for a human to report in #52. `Select.Value` therefore
also listens to `reset` on **`select.form`** (re-read per commit, as `useFormReset`; not on
`ownerDocument` with a target filter, which a consumer's `stopPropagation()` or a shadow root
would defeat, review L3) and, in a microtask after the reset, runs the same
`select.value = select.value` refresh.

What is not covered, documented: the clone is a snapshot, so CSS inside `<selectedcontent>` must
target the clone (`selectedcontent .icon`), not `option:checked .icon`; and event handlers on
option content are not cloned (interactive content is forbidden there anyway). Safari's
`<selectedcontent>` update timing (WebKit 325898) is unverified: the browser suite asserts the
refresh on every engine with customizable select; if WebKit misbehaves while the picker is open,
the contingency is to defer the refresh until `:open` is false (re-checked on the select's
`change` and `focus` events), recorded as a repo issue.

## 7. State exposure and styling

| Attribute | On | Source | Pseudo-class equivalent | Meaning |
| --- | --- | --- | --- | --- |
| `data-pending` | `Root` | `useTransition` | – | A dispatch is in flight, including a suspending dependent render's wait. |
| `data-pending` | `Trigger` | Root pending | – | Same value; on the element the user sees. |
| `data-pending` | `Option` | `pending && optimistic === value` | – | The option the user is waiting on. |
| `data-selected` | `Option` | optimistic | `:checked` (identical, 4.1) | Immediate. |
| `data-disabled` | `Root`, `Option`, `Trigger` | prop (Option: own, its Group's or Root's) | `:disabled` | |
| – | `Root` | | `:open` (Chromium 133, Firefox 154, Safari 26.5), `:focus-within` | Picker open. Browser-owned, no attribute. In Chromium focus is on the option while open, so `select:focus-within` is the robust "has focus" selector. |
| – | `Root` | | `:required`, `:user-invalid`, `:valid` | Platform only. |

The library ships no CSS. The documented opt-in and recipes:

```css
/* 1. Opt in to the customizable picker. Engines without it keep the native select. Two rules,
   not one selector list: Firefox drops a whole rule whose list names ::picker(select). */
.select { appearance: base-select; }
.select::picker(select) { appearance: base-select; }

/* 2. The button, its content, the arrow. */
.select { border: 1px solid GrayText; border-radius: 6px; padding: 0.4em 0.6em; }
.select::picker-icon { content: "▾"; transition: rotate 120ms; }
.select:open::picker-icon { rotate: 180deg; }
.select[data-pending] { cursor: progress; }
.select[data-pending] selectedcontent { opacity: 0.6; }
.select:user-invalid { border-color: var(--danger); }
selectedcontent .icon { inline-size: 1em; }          /* the clone, not the option */

/* 3. The picker and its options. */
.select::picker(select) { border: 1px solid GrayText; border-radius: 8px; padding: 4px; }
.select option { padding: 0.4em 0.6em; border-radius: 4px; }
.select option:hover, .select option:focus-visible { background: Highlight; color: HighlightText; }
.select option:checked { font-weight: 600; }          /* optimistic: flips on pick, reverts on rejection */
.select option::checkmark { content: "✓"; order: 1; margin-inline-start: auto; }
.select option[data-pending]::after { content: "…"; }
.select option:disabled { opacity: 0.4; }
.select optgroup legend { font-size: 0.85em; color: GrayText; }

/* 4. Open/close animation (Chromium; Safari 27.0 fails the picker @starting-style WPTs). */
.select::picker(select) {
  opacity: 0; transition: opacity 120ms, overlay 120ms allow-discrete, display 120ms allow-discrete;
}
.select:open::picker(select) { opacity: 1; @starting-style { opacity: 0; } }

/* 5. Placement: the UA anchors the picker to the select; override the UA's position. */
.select::picker(select) { position-area: block-end span-inline-end; position-try-fallbacks: flip-block; }

@media (prefers-reduced-motion: reduce) { .select::picker(select), .select::picker-icon { transition: none; } }
```

Tailwind: `data-pending:cursor-progress open:ring-2` on the Root, `checked:font-semibold
data-pending:animate-pulse` on an Option.

## 8. Keyboard interaction, per engine

Everything is the browser's; the library installs no key handler. Probed by the researcher
(Chromium 156; Firefox 157 default prefs and with the prefs on); Safari from WPT and release
notes:

| Key | Chromium, customizable select | Firefox (native), Safari native appearance | Dispatches? |
| --- | --- | --- | --- |
| `Tab` / `Shift+Tab` | Focus the select; while open, **closes without committing** and focus returns to the select | Focus the select; the native popup, if open, is closed by the engine | No |
| `Enter`, `Space`, `ArrowDown` (closed) | **Open** the picker; focus moves to the selected option (`document.activeElement` is the `<option>`) | `Space` / `Alt+Down` open the native popup; `Enter` does nothing (or submits the form); arrows **change the value** (`input` + `change` per step) | Chromium: no. Firefox / Safari native: yes, per arrow step |
| Arrows, `Home`, `End` (open) | Move focus between enabled options, no commit | Engine-defined inside the native popup | No (until commit) |
| `Enter`, `Space`, click (open) | **Commit** the focused option and close; `change` fires | Pick in the native popup | Yes, once |
| `Escape` (open) | Close without committing; focus returns to the select; with the picker inside an auto popover or modal dialog only the picker closes | Close the native popup | No |
| Typeahead (closed) | Selects the first match at once (`input` + `change` per match) | Same | Yes, per match |
| Typeahead (open) | Moves focus to the match; `Enter` commits | Engine-defined | No (until commit) |

Decisions:

- **No key handler, no `orientation`, no `focusgroup` flag.** The engines' models differ, and
  the component's value contract is engine-independent: one `valueChangeAction` per committed
  change, with the optimistic value in the DOM. Replicating Chromium's model in Firefox would
  mean re-implementing the native select's keyboard on top of the native select.
- **The library never moves focus**, not on rollback either. In Chromium, Escape and Tab return
  focus to the select natively; after a rejected action the select shows the old option and
  focus is where the engine left it.
- Firefox with the customizable-select prefs on keeps the *native* key model even with the
  styled picker (arrows commit while open, Tab leaves it open); not a target, noted for the
  future.

## 9. Async walkthroughs

Notation: `C` = committed, `O` = optimistic, `P` = Root pending, DOM = `select.value`.

### 9.1 Sync action with local state (controlled)

`value={fruit}`, `valueChangeAction={(next) => { setFruit(next); }}`, `C = O = DOM = ""`.

1. Pick "Banana". Browser: DOM `"banana"`, `<selectedcontent>` re-cloned, `change`. Library
   `onChange`: dispatch, `addTransitionType("fsui-select")`, `setOptimistic("banana")`,
   `setFruit("banana")` in the sync prefix (a transition update).
2. Sync flush: `O="banana"`, `P=true`. Root renders `value="banana"`; react-dom's restore after
   the event writes the same. `data-selected` moved; Root, Trigger and the Banana option
   `data-pending`.
3. The transition commits in the same task: `C="banana"`, `P=false`.

### 9.2 Async action with dependent content that suspends

```tsx
<Select.Root value={fruit} valueChangeAction={(next) => { setFruit(next); }}>…</Select.Root>
<Suspense fallback={<Skeleton />}><FruitDetails fruit={fruit} /></Suspense>
```

The pick shows at once (DOM, button, `data-selected`); `FruitDetails` suspends in the transition,
the old details stay, `data-pending` on Root and Trigger until the data arrives. With an awaited
save instead, the network wait is added. Root's function `children` receive the **optimistic**
value and must not suspend.

### 9.3 Rejection

Uncontrolled, `defaultValue="apple"`, `valueChangeAction={async (next) => { await save(next); }}`.
Pick "Banana": `O="banana"`, DOM `"banana"`, button shows Banana, `data-pending`. `save` rejects:
the error reaches the nearest Error Boundary above `Select.Root`; `C` stays `"apple"`; `O`
reverts; the settle commit renders `value="apple"` and react-dom's `updateOptions` selects Apple:
**the DOM and the button roll back**. Nothing is announced (no focus move); consumers with slow,
failure-prone saves add an `aria-live` region.

### 9.4 Native keyboard that commits per step (Firefox, Safari native appearance)

`defaultValue="a"`, options a…e, `valueChangeAction={async (next) => { await save(next); }}`.
`ArrowDown` three times on the closed select: three `change` events, three dispatches (b, c, d),
`O` re-based each time, the pending option always the latest, `P` true until all settle, the
latest-dispatch guard commits only d. In Chromium's customizable select the same presses open the
picker and move focus, and only `Enter` dispatches once. The guidance is the conventions' own:
await only what the UI must wait for (`(next) => { void save(next); }` for a preference), or
leave `valueChangeAction` off and let the form carry the value. There is no manual activation
mode to offer.

### 9.5 Controlled veto

`value="apple"` fixed, `valueChangeAction={() => {}}`. Pick "Banana": the button shows Banana for
one tick, the action resolves, `O` reverts, the settle commit re-selects Apple and the button
re-clones Apple. Vetoing is not adopting the value.

### 9.6 Picking the committed option back while another is pending

`C="apple"`, pick "Banana" (slow): `O="banana"`. Pick "Apple": a real dispatch (no-op is judged
against `O`): `O="apple"`, Apple `data-pending`. Banana's save resolves later and is not the
latest; Apple's commit is a no-change update. `save("banana")` still ran (conventions 2.5).

### 9.7 Form reset, external and automatic

Uncontrolled, `defaultValue=""`, placeholder first, inside `<form action={order}>`, `name="fruit"`.

1. Pick "Banana": `C="banana"`. Submit: the form action runs in React's form transition;
   `useFormStatus().pending` is true, the Select's own `P` is false; `FormData` has
   `fruit=banana` from the DOM.
2. Success: React calls `form.reset()` during commit. The browser restores selectedness from
   `defaultSelected` (the library's mirror: the placeholder); `<selectedcontent>` should
   re-clone the placeholder, and in Chromium 156 does not for a `defaultSelected` option (#52),
   so `Select.Value`'s own `reset` listener refreshes it in a microtask (6.3). The Root's
   `reset` listener schedules a microtask; by then the Root's layout
   effect has already re-applied `O="banana"` to the DOM, so the microtask reads the reset target
   from `defaultSelected` (6.1), not from `select.value` (conventions 3.8 rule 5).
3. Microtask: reset target `""`, base `"banana"`, the option `""` exists: dispatch `("", { reason:
   "platform", event: resetEvent })`. `O=""`; the sync render selects the placeholder; the button
   shows it. Uncontrolled: `C=""`.

A `<button type="reset">` is steps 2 and 3 without the submit. A cancelled `reset` dispatches
nothing. Controlled with a parent that ignores the reset: `O` reverts when the action settles and
the DOM re-selects the parent's option. A **disabled** Select still follows a reset (RadioGroup
5.3).

### 9.8 Pick before hydration

SSR HTML has `selected` on Apple and `<selectedcontent>` already cloned by the parser. The user
picks Banana before hydration: DOM `"banana"`, button Banana.

1. Hydration: react-dom validates the select and touches no option; `Select.Value` hydrates
   cleanly (3.3). The first client render has `value="apple"`; the DOM says Banana.
2. The Root's mount layout effect reads `"banana"`, finds the Apple option present and not
   selected, dispatches `("banana", { reason: "platform", event: undefined })`. `O="banana"`.
3. Uncontrolled: `C="banana"` after the action resolves. Rejection: `O` reverts and the settle
   commit re-selects Apple, rolling back the pre-hydration pick.

Firefox form-state restoration on reload arrives through the same effect. A pick on an option
that streamed in after the Root hydrated arrives through the late path of 6.2.

### 9.9 Options arrive after the pick (Suspense inside the select)

Controlled `value="c"`, options under `<Suspense fallback={<Select.Option value="" disabled>Loading…</Select.Option>}>`.
Mount: DOM has only the disabled fallback, nothing selected (`selectedIndex === -1`), the button
is empty; mount reconciliation finds no option `"c"` and dispatches nothing. The options resolve:
React inserts them, the browser auto-selects `"a"`, each Option reports its mount
(`hydrated: false`), the Root runs `applySelection`: `"c"` is selected, `<selectedcontent>`
clones "C", `data-selected` is already on the right option (it rendered from `O`). No dispatch.
If the picker was open meanwhile it stays open (probe, case 4).

### 9.10 Selected option's content changes while pending

`<Select.Option value="x">{({ pending }) => <>Express {pending && "(saving…)"}</>}</Select.Option>`.
Pick it: the browser clones "Express" at pick time; the sync render changes the option's text to
"Express (saving…)"; the observer sees a `characterData` record inside the selected option and
refreshes; the button shows "(saving…)". On settle the text changes back and the observer
refreshes again. With the picker open the same happens with no focus change.

### 9.11 `value` prop changes while pending

As RadioGroup 9.9: the reducer re-bases, `O` stays the in-flight pick until it settles, then
converges to the parent's value; react-dom applies the parent's value to the options.

## 10. ViewTransition

| Commit | Lane | Animates? | What changes |
| --- | --- | --- | --- |
| Pick (optimistic) | sync | No (never; sync lane) | DOM selection, `<selectedcontent>` (browser), `data-selected`, `data-pending` |
| Action settles | transition | Only through the consumer's own boundaries | `data-pending` leaves; dependent content |
| Rejection / veto | transition | Same | DOM and button roll back (react-dom's `updateOptions`) |

No part takes `transition` (decision 13). What the library gives instead: every dispatch adds
`fsui-select`, so `<ViewTransition default={{ "fsui-select": "fade", default: "none" }}>` around
dependent content animates exactly the commits the Select caused. The picker's open/close is
CSS (section 7, recipe 4).

**Future work, not v1** (product-owner decision 4): an `update` view transition on the Trigger
for the value change. The button's content is mutated by the browser inside the pick's event
dispatch, before React's sync render, so a React-driven `<ViewTransition>` around the Trigger
would capture the new content already; animating it would need either `startViewTransition`
from the `change` handler (forbidden by conventions 5.5) or a library-rendered mirror of the
value, which reintroduces the hydration problem `Select.Value` avoids. Record as an issue if a
consumer asks; `select-combobox.md` open question 4.

## 11. Degradation and engines

| | Chromium 135+ | Safari 27.0 | Firefox 158 (default prefs) |
| --- | --- | --- | --- |
| `appearance: base-select` | styled picker in page | styled picker (iOS presentation: human check, repo issue; see below) | ignored: native select |
| `Trigger` (`<button>`) | rendered, UA button replaced | rendered | parsed, **not rendered** |
| `Value` (`<selectedcontent>`) | filled by the browser, hydrates with the workaround | same | parsed as `HTMLElement`, **stays empty** |
| Rich option content, `<legend>` in `<optgroup>` | rendered | rendered | option **text** shown, legend not rendered |
| `hr` | rendered, `separator` | rendered | rendered as a line in the native popup |
| value, form, `required`, autofill, reset, actions, pending | identical | identical | identical |
| AX mapping | `combobox`, `hasPopup="menu"`, `expanded`; options named from content (`aria-hidden` icons excluded); `optgroup` → `group`; `required` + `""` exposed `invalid` before interaction; focus on the `<option>` while open | ships customizable select; **unverified** (no local WebKit; first CI runs) | native combobox mapping; customizable-select a11y unfinished (bug 2041789, pref-only anyway) |

Rules for consumers that follow from the Firefox column (WebKit's "golden rule"):

- **Option content must read as plain text.** Firefox shows `option.label`, which is the text
  content with icons' text included: give icons `aria-hidden` *and* no text (an SVG, or
  `alt=""`), never a glyph character. Do not use the `label` attribute to fix this (Chromium
  names the option from it but shows the content).
- The `Trigger`'s own content is invisible in Firefox, so a spinner there needs a second home
  (`select[data-pending]` styling on the select works in every engine).
- Placeholder, groups, separators and disabled options are native everywhere.

iOS (product-owner decision 6): whether Safari on iOS renders a base-select picker in page or
with the system wheel is a human device check. Nothing in this API depends on the answer: the
picker is the UA's in both cases, the value contract and events are the same, and the only thing
the result changes is a docs recommendation to wrap the opt-in CSS in `@media (pointer: fine)`
(or not).

## 12. Stacking: a Select inside Popover, Menu, Dialog

The picker is the spec's "select popover", shown with the select as invoker, so it is an **auto
popover nested under the select's popover ancestor** (`select-combobox.md` §7): inside an open
`Popover.Popup` or `Menu.Popup` the picker opens without closing them, Escape closes only the
picker and a second Escape the popover; inside a modal `Dialog` likewise; a Select *outside* an
open auto popover closes that popover when its picker opens (unrelated auto popovers). No portal
is involved, consistent with Dialog and Popover.

**WebKit 302008** (`position-try` on a nested popover hangs): the UA styles of
`::picker(select)` use anchor positioning with try fallbacks, so a Select inside a Popover or Menu
in WebKit is the exposure. The library cannot change UA pseudo-element styles for the consumer;
if the first WebKit CI runs hang, the documented mitigation is
`.select::picker(select) { position-try-fallbacks: none; }` on the consumer's side (the Menu
design's submenu row under the same bug passed on its first WebKit run, so the risk may be
theoretical). The browser suite carries a dedicated WebKit row (section 14.2).

## 13. Not in v1: `multiple`, listbox mode, `Select.Popup`

- **`multiple` / `size > 1`** are omitted from the type. A styled multi-select drop-down exists
  nowhere stable (Chromium `experimental` flag; Firefox pref; no WebKit work), listbox mode is
  Chrome 145 only, and the value would be `string[]` with `details.added` / `removed` (the
  CheckboxGroup diff shape). When it arrives it is `Select.Root multiple` with the set-valued
  conventions already written (2.2, 3.4), and `<selectedcontent>` inside `multiple` is still
  experimental. Chips, search and virtualization stay with Combobox regardless.
- **`Select.Popup`, controlled `open`, open/close `<ViewTransition>`**: impossible on a native
  select. A consumer who needs them needs Combobox.

## 14. Test plan

`packages/ui/src/select/select.test.tsx` (jsdom) and `select.browser.test.tsx` (Chromium,
Firefox, WebKit). Rows marked (both) run under `describe.each` with the uncontrolled and the
"update on success" controlled wrapper. jsdom has no customizable select and no
`HTMLSelectedContentElement`: there `Select.Value` renders its element and installs no observer,
`user.selectOptions()` sets the value and fires `change`, `form.reset()` restores
`defaultSelected`, and `renderToString` + `hydrateRoot` exercise the hydration path with the
jsdom parser (no clone, so the workaround is only asserted to be harmless; the real parser is
the browser row).

### 14.1 jsdom

| Area | Tests |
| --- | --- |
| Roles and ARIA | `Root` is a `select` with `role` resolving to `combobox`; `name`, `required`, `form`, `autoComplete`, `disabled` land on it; `Trigger` is `button[type=button]` as first child; `Value` is `selectedcontent` with empty content and no children warning; `Option` has `value`, `disabled`, `data-disabled`; `Group` has `label` and `GroupLabel` is its first child `legend`; `Separator` is `hr`; `multiple` / `size` are not accepted (type test). |
| Keyboard | Not asserted beyond `user.selectOptions()` (engine-defined, section 8); the jsdom file states this in its N/A comment. |
| Sync action (both) | `(next, details)` shape; `details.reason === "activate"`; `details.event.type === "change"`; selecting the already-selected option or any option under `Root disabled` never dispatches. |
| Async action (both) | While unresolved: `data-pending` on Root, Trigger and the picked Option only; `select.value` is the picked value in the DOM; `data-selected` moved. After resolve: pending gone, value committed / parent updated. |
| Rejection (both) | Uncaught: `ErrorCatcher` above the Root receives it; uncontrolled internal value unchanged. Where the Select stays mounted (caught inside, controlled veto): `select.value` and `data-selected` back on the old option, no `data-pending`. |
| Overlap | Two picks resolved out of order: DOM and `data-selected` on the latest throughout, final committed is the latest; 9.6 (pick back the committed value) calls both actions and commits the committed value. |
| Superseded rejection (both) | The older pick rejects after and while the newer is pending: the boundary gets it, the newer's outcome unaffected. |
| Suspending content (both) | Dependent `<Suspender />` keyed on the consumer's state: old content stays, no fallback above the component, Root `data-pending`; then new content. |
| Late options (6.2) | Controlled `value="c"` with options under `<Suspense>` + `createSuspender`: before resolve `selectedIndex === -1` and **no dispatch**; after resolve `select.value === "c"`, still no dispatch; the same with an enabled fallback option (DOM `""` before, no dispatch); uncontrolled likewise. |
| Platform: mount reconciliation | `renderToString` with `"a"` selected, set `select.value = "c"` before `hydrateRoot`: exactly one dispatch `("c", { reason: "platform", event: undefined })`; StrictMode still one; a controlled parent that refuses → DOM back on `"a"` after settle; **no dispatch** when the value matches no option (fallback-only DOM) at mount; a late hydrated option (Suspense boundary hydrating after the Root, DOM pick set before reveal) → one dispatch; a late created option → none. |
| Platform: form reset | `form.reset()` → one dispatch `(resetTarget, { reason: "platform", event: Event("reset") })`; `<form action>` success auto-resets the same way; cancelled `reset` dispatches nothing; `Root disabled` still dispatches; reset whose target equals the optimistic value dispatches nothing; two synchronous resets while one is pending dispatch once (base rule). |
| Reset target (6.1) | Uncontrolled: after `defaultValue` changes (in a transition), `form.reset()` returns the select to the new default and `defaultSelected` is on exactly that option; controlled client render: `defaultSelected` is on the mount-time option (react-dom alone would leave none), a reset returns to it and notifies the parent; an Option added later never gains `defaultSelected`. The mirror does not move the current selection (an option with a new default selected is re-applied in the same effect: assert `select.value` unchanged after the commit). |
| Placeholder and `required` | `defaultValue=""` with a disabled placeholder selects it; `required` + `""` is `validity.valueMissing`; picking clears it. With neither `value` nor `defaultValue`: `state.value` and `data-selected` adopt the first enabled option after mount with **no dispatch** (and no warning); a pre-hydration pick of another option dispatches once with `"platform"`; options arriving later while the state's option is absent are adopted with no dispatch **only before any dispatch**: pick "b", remount the options' keyed boundary with a disabled `""` fallback, resolve → state and DOM stay on "b", no dispatch (review E2); with a disabled `""` placeholder and no props, a pristine `form.reset()` stays on `""` and dispatches nothing, client-rendered and hydrated alike (review E1); with an enabled first option, reset returns to it. |
| `details.event` is virtual | Toggle row 21 on a pick, `JSON.stringify(details) === '{"reason":"activate"}'`; a fake Server Function receives the same shape. |
| Function props | `className` / `style` / `children` on Root, Trigger, Option receive the documented state (`selected` optimistic, per-Option `pending`); `Value` has no `children`; Group / GroupLabel / Separator render their elements. |
| `render` element | `render={<select id />}` on Root, `<button>` on Trigger, `<option>` on Option keep the owned attributes and handlers, concatenate `className`, forward `ref`; dev warning for a wrong tag (`SELECT`, `BUTTON`, `SELECTEDCONTENT`, `OPTION`, `OPTGROUP`); dev warning when the Trigger is not the first child. |
| Post-await rule | Controlled wrapper that awaits then `startTransition(setValue)` works end to end. |
| `transition` | No part accepts it (type test). |
| Directive | Every built `dist/select/*.mjs` except `index.mjs` begins with `"use client"`. |

### 14.2 Browser mode (`select.browser.test.tsx`)

Feature check: `supportsBaseSelect = CSS.supports("appearance", "base-select")` and
`supportsSelectedContent = typeof HTMLSelectedContentElement !== "undefined"`, added to
`src/__tests__/engine.ts`. The page injects `select, select::picker(select) { appearance: base-select }`.
**No row asserts `document.activeElement` or key sequences while the picker is open** (Chromium
focuses the option, native keeps the select, Safari's optional WPTs fail); rows assert `:open`,
`select.value`, `<selectedcontent>` content and dispatches. Firefox's native popup is not in the
page and a headless click does not even match `:open`, so Firefox rows never pointer-open the
select; value changes go through `selectOption` / `user.selectOptions()`.

| Row | Assertion | Engine branches |
| --- | --- | --- |
| Degradation | After mount: with `supportsBaseSelect`, `<selectedcontent>` has a box (`getBoundingClientRect().height > 0`) and contains the selected option's children; without it, it has no box and is empty. The `<button>` itself is `display: contents` in the UA styles, so it is never measured (developer deviation 2). Value, `FormData`, `validity`, `form.reset()` identical in both branches. | Firefox: degraded branch asserted, not skipped. |
| Hydration with the real parser | `renderToString` into an `iframe srcdoc` (the researcher's E2 harness), `hydrateRoot` with `onRecoverableError`: zero recoverable errors and the same `<select>` element kept, in every engine; a pre-hydration `select.value = "b"` plus `change` dispatched before hydration is reconciled with one `"platform"` dispatch. | Chromium and WebKit clone at parse (the row is the point); Firefox is the control. |
| Pick through the picker | Click the select → `:open`; click an option → `change`, one dispatch, `select.value`, `<selectedcontent>` updated, `:open` false. | `supportsBaseSelect` only; Firefox uses `selectOption` for the same value/dispatch assertions. |
| Optimistic under a pending action | After a pick with a deferred action: `select.value` and `<selectedcontent>` show the pick throughout (probe B); after rejection both roll back. | all three (`selectOption` in Firefox) |
| Refresh (6.3) | Change the selected Option's children through React (a state flip that changes the text, and a `createSuspender` resolving inside the option): `<selectedcontent>` matches the new children within a microtask; `change` not fired; `selectedIndex` unchanged; with the picker open (click first) it stays `:open` and the refresh still lands. | `supportsSelectedContent`: assert the refresh. Firefox: assert `<selectedcontent>` stays empty and no error. |
| Late options while open | Open the picker, resolve the options' suspender: picker still `:open`, `select.value` is the intended value, `<selectedcontent>` shows it. | `supportsBaseSelect` |
| Form reset | `form.reset()` after a pick: `<selectedcontent>` shows the reset target's content, one `"platform"` dispatch with the `reset` event. | all three (content assertion under `supportsSelectedContent`) |
| Validity | `required` with the placeholder selected: `:user-invalid` after a blocked `requestSubmit()`; valid after a pick. | all three |
| Inside Popover / Menu / Dialog | A Select inside an open `Popover.Popup`: opening the picker keeps the popover open (`:popover-open`); Escape closes only the picker; inside a modal `Dialog.Popup` likewise. **WebKit 302008 row:** `browserName === "webkit"`, open the picker inside a Popover twice under a 15 s timeout so a hang fails instead of stalling the job. | `supportsBaseSelect` for the picker; the WebKit row runs regardless. |
| Accessibility tree | CDP (Chromium only, as RadioGroup): `combobox` named by the consumer's `<label for>`, `hasPopup`, options named from content with `aria-hidden` icons excluded, `optgroup` as `group`, `hr` as `separator`, the disabled option `disabled`. | Chromium |
| ViewTransition | No part takes `transition`; a pick with `document.startViewTransition` spied calls it zero times. | all three |

## 15. Implementation notes

### 15.1 Files

```
packages/ui/src/select/
  index.ts                 # no directive; namespace + types; imports platform-attributes for side effects
  select-context.ts        # "use client"; SelectContext { optimistic, pending, disabled, optionMounted, selectRef }
  select-root.tsx          # "use client"; <select>, useControllableAction, useNativeSelectValue
  select-trigger.tsx       # "use client"; <button type="button">, first-child dev check
  select-value.tsx         # "use client"; <selectedcontent>, the MutationObserver refresh
  select-option.tsx        # "use client"; <option>, mount report with the hydration tell
  select-group.tsx         # "use client"; <optgroup label>
  select-group-label.tsx   # "use client"; <legend>, first-child dev check
  select-separator.tsx     # "use client"; <hr>
  select.test.tsx
  select.browser.test.tsx
packages/ui/src/internal/
  use-native-select-value.ts   # "use client"; applySelection, readResetValue, mount reconciliation, reset (on useNativeGroupReconciliation / useFormReset)
  use-hydrated-mount.ts        # "use client"; useSyncExternalStore server-snapshot tell (6.2)
  use-form-reset.ts            # widen FormAssociatedElement with HTMLSelectElement
  platform-attributes.ts       # add `selectedcontent` to JSX.IntrinsicElements
```

### 15.2 Root

- `useControllableAction<string, SelectValueChangeDetails>({ controlled: value, defaultValue,
  initialValue: "", action: valueChangeAction, transitionTypes: () => transitionTypes("select"),
  warn: { component: "Select.Root", prop: "value" } })`. With neither prop given, the Root
  calls `adopt(dom)` (a new uncontrolled-only method of the shared hook: writes the internal
  value, no action, no optimistic step) from the mount layout effect, using the first enabled
  option as the base of the mount reconciliation, and again on a late-option report whose
  target option is absent, **until any dispatch has run** (a ref cleared on every dispatch,
  user or platform; review H1); the adopted mount value is the reset target (M1). No warning.
- `onChange(e)`: `next = e.currentTarget.value`; return if `next === optimistic`; else
  `dispatch(next, createActionDetails(e.nativeEvent, { reason: "activate" }))`.
- `useNativeSelectValue({ ref, target: () => { const f = latestInFlight(); return f === null ? optimistic : f.next; }, resetTarget, onPlatformChange: dispatchFromDom })` which wires
  `useNativeGroupReconciliation` on the `<select>` with `readCurrent = () => hasOption(base) ? select.value : base` (the existence gate as a no-op compare), `readDefault = readResetValue` (last `defaultSelected` option in tree order, else the first enabled option, else `""`, the spec's reset result), `equals: Object.is`, and runs `applySelection` in a layout effect after every commit (not reading the DOM in the mount commit before the adapter's reconciliation, conventions 3.8 rule 3).
- `dispatchFromDom(next, event)`: base comparison as RadioGroup 13.3, `reason: "platform"`.
- Renders `<select value={optimistic} disabled={disabled} data-pending data-disabled onChange>`
  through `use-render`; dev warning when the mounted tag is not `SELECT`.
- Context: `{ optimistic, pending, disabled, selectRef, optionMounted(el, hydrated) }`.
- Owned keys: `value`, `disabled`, `data-pending`, `data-disabled`, `onChange`.

### 15.3 Option

- `selected = ctx.optimistic === value`; `pending = ctx.pending && selected`;
  `disabled = ctx.disabled || disabledProp`.
- `const hydrated = useHydratedMount()`; mount layout effect: `ctx.optionMounted(el, hydrated)`.
- Renders `<option value disabled data-selected data-pending data-disabled>`; never `selected`.
- Owned keys: `value`, `disabled`, `data-selected`, `data-pending`, `data-disabled`.

### 15.4 Value

- Renders the element of 3.3 through `use-render` with `SelectRootState`; dev warning when the
  tag is not `SELECTEDCONTENT`.
- Effect: if `typeof HTMLSelectedContentElement === "undefined"` return; `select = el.closest("select")`
  (dev warning if null); observe; callback filters records (6.3) and refreshes once per batch.
- `useFormReset`-style subscription to `reset` on `select.form` (re-read per commit); the
  handler refreshes in a microtask (6.3, #52).

### 15.5 Dev warnings

Wrong tag behind `render` (every part); Trigger not the first child; GroupLabel not the first
child of its Group; a part outside a Root (throw, as Tabs); the shared hook's
controlled/uncontrolled warnings. Deliberately absent: neither `value` nor `defaultValue` (the
browser's first-option default is valid HTML; product-owner decision 4); a value matching no
option (transient under Suspense); `label` on an Option (documented, not policed).

### 15.6 Example app and docs site

Playground: a fruit picker with icons, a group, a separator, a disabled option, a slow Server
Function-like action, an "options load late" variant and a "label changes while pending" variant,
with the opt-in CSS and a Firefox note. Docs page: the props tables from the declarations, the
CSS recipes of section 7, the per-engine keyboard table, the Firefox column of section 11.

## Conventions feedback (applied 2026-10-17)

1. **1.1 part vocabulary**: add `Value` ("the element the browser fills with the selected
   option's content; `<selectedcontent>`; no `children`") and `Option` (`<option>` in Select).
2. **1.2 `render` rules**: Select's `Root`, `Trigger`, `Value`, `Option`, `Group` must keep
   their element (`select`, `button`, `selectedcontent`, `option`, `optgroup`).
3. **3.1**: note that Select's `value` is `string` with `""` as the placeholder, an exception to
   "none selected is `null`" grounded in `select.value` (question 1).
4. **3.5 residual paths**: add "late-mounting options in a `<select>` are re-applied; a hydrated
   late option is reconciled, a created one is not (the `useSyncExternalStore` server-snapshot
   tell)", and "a platform dispatch requires the intended option to exist".
5. **3.8**: widen `FormAssociatedElement` with `HTMLSelectElement`; add `useNativeSelectValue`
   as the select analogue of `useNativeChecked` (mirror `defaultSelected` then re-apply, in that
   order, because `defaultSelected` moves a non-dirty option's selection); `adopt(next)` on
   `useControllableAction` for the no-default case.
6. **4.1**: `selected` row gains `Select.Option` (optimistic, equal to `:checked`); `open` row
   notes Select emits none (`:open` only).
7. **5.1**: Select's parts have no `transition` (the Menu-items reasoning).
8. **5.3**: `fsui-select`.
9. **7.4**: `selectedcontent` intrinsic element added to the augmentation; the
   `suppressHydrationWarning` + `dangerouslySetInnerHTML` pattern for a browser-filled element
   gets a row ("element whose children the parser writes before hydration").
10. **8**: withdraw the `Select.Root experimental_baseAppearance` row: the markup is
    unconditional and the opt-in is consumer CSS (progressive enhancement, no flag).

## Questions for the product owner (resolved 2026-10-17, see below)

1. **`value: string`, never `null`** (decision 3). Accept the deviation from conventions 3.1
   ("none selected is `null`"), on the grounds that a `<select>` has no empty state other than
   an option, that `""` is what `required` validates against, and that it keeps
   `valueChangeAction` free of a `null` branch? The alternative (`string | null` with `null`
   mapped to "no option selected") would make `null` and `""` two spellings of the same DOM
   state.
2. **Automatic `<selectedcontent>` refresh through a MutationObserver** (decision 6, 6.3), in
   `Select.Value`. Accept the mechanism, with the WebKit contingency recorded as an issue if the
   first CI runs show the picker closing or losing focus on refresh?
3. **The hydration tell for late options** (6.2): one `useSyncExternalStore` per Option so that
   a pick made before a late boundary hydrates is kept while a client-created option is never
   mis-reported. The simpler alternative, "late options are re-applied, never reconciled", would
   silently overwrite a pre-hydration pick on options that streamed in after the Root hydrated.
   Accept the extra hook, or accept the limitation?
4. **Dev warning when neither `value` nor `defaultValue` is given** (decision 3; Tabs
   precedent). RadioGroup chose no warning because "unchecked" is the HTML default; here the HTML
   default (first option) is not representable without a placeholder. Confirm the warning.
5. **No `transition` prop on any Select part** (decision 13): the first component where no part
   has one. The alternative is a `transition` on `Option` for parity with `RadioGroup.Item`,
   which would wrap an `<option>` inside the UA picker and animate nothing. Confirm the
   omission.
6. **`Group label` required, `GroupLabel` optional** (1.). Confirm, or make `GroupLabel`
   required and derive the attribute from its text (impossible for rich content, so rejected
   here).
7. **WebKit 302008 handling**: a dedicated WebKit row under a timeout, and a documented consumer
   CSS mitigation rather than any library CSS. Confirm (the Menu precedent).
8. **Conventions change 10**: withdraw the `experimental_baseAppearance` flag row. Confirm.

## Decisions recorded (product owner, 2026-10-17)

1. `value: string`, never `null`: accepted (conventions 3.1 carries the exception).
2. The `MutationObserver` refresh in `Select.Value`: accepted, with the WebKit contingency (defer
   the refresh while `:open` if the first CI runs show the picker closing or losing focus).
3. The per-Option `useSyncExternalStore` hydration tell: accepted. Correctness of a
   pre-hydration pick wins over the simpler limitation.
4. **No dev warning** when neither `value` nor `defaultValue` is given: a native select picks its
   first option, which is valid HTML (native-first; follows RadioGroup). Applied: decision 3,
   section 5, 6.1, 14.1, 15.2 and 15.5 now describe the adopted browser default.
5. No `transition` prop on any part: accepted.
6. `Group label` required, `GroupLabel` optional: accepted.
7. WebKit 302008: the dedicated test row and the consumer CSS mitigation: accepted.
8. The `experimental_baseAppearance` flag row withdrawn from conventions section 8: accepted.

---

## Review corrections (2026-10-17)

From `memo/reviewer/select.md` (review of 1114850 / f107022 / 4b1c94b / ba1f6e5; verdict
"acceptable with fixes") and the developer's deviations; decisions by the product owner. Each
item is folded into the section named; this list is the audit trail. The code fixes land on
master separately.

| Item | Correction | Section |
| --- | --- | --- |
| H1 | Adoption (neither `value` nor `defaultValue`) runs only until a dispatch of any reason has established the value; afterwards late options get the re-apply only, so a re-suspending boundary never replaces a pick (review E2). | 5, 14.1, 15.2, decision 3 |
| M1 | In adopt mode the reset target is the value adopted at mount, mirrored into `defaultSelected`; `""` is mirrored when it came from a `""` option. An untouched client-rendered form with a disabled placeholder no longer resets to the first enabled option (review E1). The docs page's "a reset returns to the first enabled option" is corrected with it. | 5, 6.1, 14.1, decision 9 |
| L1 | `select.value = select.value` does set the option's dirtiness (spec; Chromium P1b): benign, documented as such. It does not clear `:user-invalid` (P1). | 6.3 |
| L2 | CSS recipe 1 is two rules: Firefox drops a rule whose selector list names `::picker(select)`. | 7 |
| L3 | The reset refresh listens on `select.form`, not on `ownerDocument` with a target filter. | 6.3, 15.4 |
| L6 | `Option.disabled` / `data-disabled` include a disabled `Select.Group`, matching `:disabled`. | 3.4, 7 |
| L8 | Hydrated Options re-render once after hydration (the `useSyncExternalStore` snapshot difference); one extra sync pass over N options, accepted. | 6.2 |
| L4, L5, L7, L9 | Test and implementation hygiene (WebKit feature-check pinning, the `lateHandled` window, an `adopt` unit test, a `:user-invalid` refresh row): implementation-only, no design change. | |

Accepted deviations (developer, judged in the review):

1. **`Select.Value` refreshes `<selectedcontent>` after a form reset** (6.3): Chromium 156 does
   not re-clone when the reset restores a `defaultSelected` option, against the spec's reset
   algorithm; a Chromium bug recorded in #52 for a human to report upstream.
2. **The degradation row measures `<selectedcontent>`, not the `<button>`** (14.2): the UA
   styles make the select's button `display: contents`, so it has no box in any engine.
3. `Group`, `GroupLabel` and `Separator` receive the Root's state (the design elided it).
4. to 6. Accepted as implemented per the review memo (a RadioGroup-precedent detail, the
   cross-realm `iframe srcdoc` hydration row's helper, and one further test-side deviation);
   `memo/developer/` and `memo/reviewer/select.md` hold the detail. The code under
   `packages/ui/src/select/` and `src/internal/use-native-select-value.ts` is the ground truth
   where this document is silent.

