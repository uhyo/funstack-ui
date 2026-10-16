# RadioGroup

Status: **proposed** (2026-10-16, GitHub issue #28). Follows `design/conventions.md` (accepted);
where this document and the conventions disagree, the conventions win. Deviations and additions
are listed under "Conventions feedback" at the end.

Inputs: `docs/vision.md`, `design/conventions.md`, `docs/research/form-controls.md` (binding
findings on native inputs), `docs/research/react-async-apis.md`, `design/components/tabs.md`
(sibling single-selection design), `design/components/accordion.md` (mount reconciliation
precedent), the WAI-ARIA APG Radio Group pattern, the researcher's probes under
`memo/platform-researcher/probes/04-*` to `08-*`, and react-dom 19.3.1 source reads recorded in
`memo/architect/radio-group-notes.md`.

RadioGroup is the first component built on a **native checkable input**. The platform gives it
form participation, validation, labels, a single tab stop, arrow-key selection with wrapping and
RTL mirroring, and pre-hydration interactivity. The library adds exactly one thing on top: the
selection is a library-owned state driven through `valueChangeAction` inside a transition, with
optimistic feedback and `data-pending`. Everything below is arranged so that the native behaviour
stays native and the Async React model stays the conventions' model.

## Decisions at a glance

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Anatomy | `RadioGroup.Root` (`fieldset[role=radiogroup]`), `RadioGroup.Label` (`legend`, optional), `RadioGroup.Item` (`input[type=radio]`). **No `Indicator` part**: the input is the visible control and is styled with `appearance: none` plus pseudo-elements, or with `accent-color`. Confirmed by the product owner for Switch, Checkbox and RadioGroup together (conventions resolved question 16); the alternative anatomy in section 14 is kept for the record only. |
| 2 | State | One library-owned state, `value: string \| null`, as `value` / `defaultValue` / `valueChangeAction(next, details)`. `null` means no radio checked. `defaultValue` defaults to `null` and **no dev warning fires** when neither prop is given: an unchecked group is the HTML default and the normal form case. |
| 3 | Rendered DOM state | Every Item renders `checked={optimistic === value}`. This is a correctness requirement, not a style: react-dom restores a controlled input's DOM `checked` to its props after every event, and only sync-lane (optimistic) state survives that restore (`form-controls.md` section 2). |
| 4 | `next` type | `valueChangeAction` receives `string` for every user interaction. It receives `null` only on the platform paths that can empty the group (form reset to a mount-time "none checked"), with `details.reason: "platform"`. |
| 5 | Keyboard | Entirely native: single tab stop, Space checks, all four arrows select and wrap, RTL mirrored, disabled radios skipped. No `Home`/`End` (not in the APG Radio Group pattern; adding them would be the component's first keyboard JS). No `orientation` prop: native arrows ignore it and a prop that changed nothing would mislead. No `focusgroup` flag. |
| 6 | Pending and checked exposure | `data-pending` on Root and on the Item whose value is the optimistic one; `data-checked` (optimistic) on Items; `data-disabled` on Root and Items. The vocabulary word is **`checked`** (the platform's), not `selected`. |
| 7 | Residual browser paths (`reason: "platform"`) | Mount reconciliation (pre-hydration clicks, Firefox form-state restoration): one dispatch per group with `event: undefined`. Form reset (`<button type=reset>`, `form.reset()`, React's automatic reset after a successful `<form action>`): one dispatch per group with `event` set to the `reset` event. Both go through the Root's `useNativeGroupReconciliation` on the fieldset (conventions 3.8); Items call `useNativeChecked` with `group: true` and report nothing themselves. |
| 8 | `preventDefault` | Not a veto. A click cancelled **before** the library's handler runs (a pass-through `onClick`) is treated as "no change" and never dispatches, because the browser reverts the DOM. `details.event.preventDefault()` inside the action desyncs the DOM while pending and triggers a dev warning. A veto is controlled mode. |
| 9 | Disabled | Native: `disabled` on an Item, `<fieldset disabled>` for the group. Disabled radios are skipped by native arrow navigation and never dispatch. A form reset still resets a disabled group and the group follows it (section 5.3). |
| 10 | Transition types | `fsui-radio-group` only. Consumers' dependent content elsewhere in the tree can key a `<ViewTransition>` type map on it. |
| 11 | Forms and Server Functions | Two independent channels: `valueChangeAction` (per-group transition, may be a Server Function passed directly) and `<form action>` with native `name` (no action on the group needed). Both at once is fine. |
| 12 | Files | Every part file is `"use client"` (context). An action-less group is JS-free in behaviour (works before hydration); directive-free variants are tracked in #19. |

---

## 1. Anatomy

```tsx
import { RadioGroup } from "@funstack/ui/radio-group";

<RadioGroup.Root name="plan" defaultValue="free" valueChangeAction={savePlan}>
  <RadioGroup.Label>Plan</RadioGroup.Label>
  <label className="option">
    <RadioGroup.Item value="free" /> Free
  </label>
  <label className="option">
    <RadioGroup.Item value="pro" /> Pro
  </label>
  <label className="option">
    <RadioGroup.Item value="enterprise" disabled /> Enterprise
  </label>
</RadioGroup.Root>
```

Rendered DOM (the `name` falls back to `useId()` when omitted; see section 6):

```html
<fieldset role="radiogroup">
  <legend>Plan</legend>
  <label class="option">
    <input type="radio" name="plan" value="free" checked data-checked=""> Free
  </label>
  <label class="option">
    <input type="radio" name="plan" value="pro"> Pro
  </label>
  <label class="option">
    <input type="radio" name="plan" value="enterprise" disabled data-disabled=""> Enterprise
  </label>
</fieldset>
```

| Part | Element | Role | Renders from | Notes |
| --- | --- | --- | --- | --- |
| `Root` | `fieldset` | `radiogroup` (explicit, allowed by ARIA in HTML) | pending, disabled | Owns state, context, the transition, the group `name`, the reset listener and mount reconciliation. `disabled` renders the native `disabled` attribute, which disables every radio inside. |
| `Label` | `legend` | names the group (native) | Root state | Optional. Must be the **first child** of Root (HTML content model). Function `children` receive Root state, so a group-level pending indicator goes here. |
| `Item` | `input[type=radio]` | `radio` (native) | **optimistic** value | `checked`, `data-checked`, `data-pending`, `data-disabled`. A void element: no `children`. |

Why these three and nothing else:

- **No `Indicator`.** The input cannot contain children, and a *sibling* Indicator could only know
  which item it belongs to by repeating `value` (`<RadioGroup.Indicator value="pro" />`), which
  reads badly, or by DOM adjacency, which would mean writing attributes outside React. CSS already
  does the sibling job: `input:checked + .dot`, `input[data-pending] + .spinner`, and
  `.option:has(input:checked)` on the consumer's label. The input itself takes `appearance: none`
  and `::before` / `::after` in every engine (`form-controls.md` section 1, probe 08). This is
  research shape 1 ("the input is the visible control").
- **No per-item `Label` part.** A plain `<label>` wrapping the Item, or `<label htmlFor>` with an
  `id` passed through to the Item, is the platform's API and needs no library part.
- **`Root` is a `<fieldset>`, not a `div`.** Three native behaviours depend on it: `<legend>`
  naming, `disabled` inheritance to every radio (including `:disabled` on them), and `.form` on the
  fieldset for the reset listener (fieldset is a form-associated element and honours the `form`
  attribute). A `render` element must stay a `<fieldset>`; a `render` element on `Item` must stay
  an `<input>` whose `type` the library sets to `radio`. The library warns in development when the
  mounted element's `tagName` is wrong (Accordion precedent).

Every part renders exactly one element, with `<ViewTransition>` as the outermost node of `Item`
(section 10). `Root` and `Label` render no boundary: their content is not driven by library state.

## 2. States

| State | Owner | Kind | Library-owned or browser-owned | Transition? |
| --- | --- | --- | --- | --- |
| `value` | `Root` | `string \| null` | **Library-owned** through a controlled native input (`checked={optimistic === value}` on every Item), with two residual browser paths: mount reconciliation and form reset (section 5). | Yes: every click, Space, arrow press, and every platform dispatch. |
| `pending` | `Root` | boolean | Library-owned (`useTransition`) | n/a |
| focus position in the group | DOM | element | Browser-owned | The browser moves focus with arrows and keeps the checked radio as the tab stop. The library never calls `focus()`. |
| validity (`required`, `:user-invalid`) | DOM | | Browser-owned | Native constraint validation; not mirrored. |
| `name`, `form`, `required`, `disabled` | `Root` / `Item` | config | n/a | Plain props. |

There is no activation mode and no second library state. The native radio pattern *is* "selection
follows focus" (APG Radio Group: arrows check as they move), and there is no native way to move
focus without checking, so the Tabs `activationMode="manual"` escape hatch does not exist here.
Section 9.4 explains what that means for an awaited action.

## 3. Props and types

Shared types come from `packages/ui/src/internal/types.ts` (conventions 2.2 and 9.4).
`ViewTransitionClass` is React's own type for the `default` prop of `<ViewTransition>`.

### 3.1 `RadioGroup.Root`

```ts
export interface RadioGroupValueChangeDetails extends ActionDetails {
  /**
   * Library-wide vocabulary (conventions 2.2):
   * "activate": the user checked a radio (click, Space, or an arrow key, all of which arrive
   * as a native `click`).
   * "platform": the browser changed the checked radio: a form reset (`details.event` is the
   * `reset` event), or interaction before hydration / Firefox form-state restoration reconciled
   * at mount (`details.event` is `undefined`).
   */
  readonly reason: ChangeReason;
}

export interface RadioGroupRootState {
  /** Optimistic checked value, or `null`. Content rendered from it must not suspend. */
  readonly value: string | null;
  /** An action dispatched through this group is in flight. */
  readonly pending: boolean;
  readonly disabled: boolean;
}

export interface RadioGroupRootProps
  extends Omit<
    ComponentPropsWithRef<"fieldset">,
    "className" | "style" | "children" | "defaultValue" | "defaultChecked" | "name" | "disabled" | "form"
  > {
  /** Controlled checked value. `null` checks nothing; `undefined` means uncontrolled. */
  value?: string | null;
  /** Initial value in uncontrolled mode. Defaults to `null` (nothing checked). */
  defaultValue?: string | null;
  /**
   * Runs inside the Root's transition whenever the checked radio changes. May be sync or async;
   * rejections reach the nearest Error Boundary and roll the selection back.
   *
   * `next` is a string for every user interaction. It is `null` only with
   * `details.reason === "platform"`, when a form reset returned the group to "nothing checked".
   * Every arrow key press dispatches; the latest dispatch wins (section 9.4).
   * A `setState` after your own `await` is not a Transition update; wrap it in `startTransition`.
   */
  valueChangeAction?: ChangeAction<string | null, RadioGroupValueChangeDetails>;
  /**
   * The `name` shared by every radio in the group (form data key). Defaults to a `useId()`
   * value; pass a real name when the group is inside a `<form>` you submit. Must be unique
   * within the form: react-dom throws if a non-React radio shares it.
   */
  name?: string;
  /** The `form` attribute, applied to the fieldset and to every radio. */
  form?: string;
  /** Marks every radio `required`, which makes the group required (one checked radio satisfies it). */
  required?: boolean;
  /** Renders `<fieldset disabled>`: every radio is disabled, unfocusable and skipped by arrows. */
  disabled?: boolean;
  className?: StateValue<string | undefined, RadioGroupRootState>;
  style?: StateValue<CSSProperties | undefined, RadioGroupRootState>;
  children?: StateValue<ReactNode, RadioGroupRootState>;
  render?: RenderProp<ComponentPropsWithRef<"fieldset">, RadioGroupRootState>;
}
```

`onReset` is **not** omitted: the library listens to `reset` on the form owner through
`addEventListener` (conventions 7.4 pattern), never through a prop on the fieldset, so a consumer's
`onReset` on the fieldset (where it would not fire anyway) passes through untouched.

### 3.2 `RadioGroup.Label`

```ts
export interface RadioGroupLabelProps
  extends Omit<ComponentPropsWithRef<"legend">, "className" | "style" | "children"> {
  className?: StateValue<string | undefined, RadioGroupRootState>;
  style?: StateValue<CSSProperties | undefined, RadioGroupRootState>;
  children?: StateValue<ReactNode, RadioGroupRootState>;
  render?: RenderProp<ComponentPropsWithRef<"legend">, RadioGroupRootState>;
}
```

The Label's state is the Root's state (the legend is the group's own caption, as Accordion's
Trigger shares its Item's state). Its `children` function is where a group-level spinner goes:

```tsx
<RadioGroup.Label>{({ pending }) => <>Plan {pending && <Spinner aria-hidden />}</>}</RadioGroup.Label>
```

A group without a `Label` is named through `aria-label` or `aria-labelledby` on `Root` (both pass
through). The part does not take `provides` (conventions resolved question 11): a legend names its
fieldset natively and cannot describe it.

### 3.3 `RadioGroup.Item`

```ts
export interface RadioGroupItemState {
  readonly value: string;
  /** Optimistic: true as soon as the user checks this radio, before the action settles. */
  readonly checked: boolean;
  /** The Root is pending and this radio is the optimistic target. */
  readonly pending: boolean;
  /** Disabled by its own prop or by `Root disabled`. */
  readonly disabled: boolean;
}

export interface RadioGroupItemProps
  extends Omit<
    ComponentPropsWithRef<"input">,
    | "type" | "name" | "value" | "checked" | "defaultChecked" | "defaultValue" | "form" | "required"
    | "onChange" | "className" | "style" | "children"
  > {
  /** The value this radio checks. Must be unique within the Root. Submitted as the form value. */
  value: string;
  /** Native `disabled`: unfocusable, skipped by arrow keys, never dispatches. */
  disabled?: boolean;
  /**
   * Forwarded to the Item's `<ViewTransition default>`. Default "none". Fires only on the commit
   * that settles the action (or rolls it back), never on the optimistic check (section 10).
   */
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, RadioGroupItemState>;
  style?: StateValue<CSSProperties | undefined, RadioGroupItemState>;
  render?: RenderProp<ComponentPropsWithRef<"input">, RadioGroupItemState>;
}
```

There is no `children` (void element). `type`, `name`, `value`, `checked`, `form` and `required`
are owned by the library (from the Item's `value` and the Root's context); `onChange` is the
library's handler. `id`, `aria-*`, `autoFocus`, `onClick`, `onFocus` and every other input prop pass
through. `disabled` is the Item's own prop and renders natively; `Root disabled` reaches the radio
through the fieldset.

### 3.4 Namespace

```ts
export const RadioGroup = {
  Root: RadioGroupRoot,
  Label: RadioGroupLabel,
  Item: RadioGroupItem,
} as const;
```

## 4. Native inputs under transition-by-default

This section is the model; sections 5 and 9 apply it. All facts are from `form-controls.md`
section 2 and the react-dom 19.3.1 reads in `memo/architect/radio-group-notes.md`.

### 4.1 What the browser and React do on a check

1. The user clicks, presses Space, or presses an arrow (which the browser turns into a `click` on
   the newly focused radio). The browser flips `checked` on the target and unchecks the group's
   previous radio **before** any `click` listener runs.
2. React's root listener runs. For one native `click` it dispatches `onClick` listeners first,
   then `onChange` listeners, and `onChange` fires only if the tracked `checked` actually changed
   (clicking the already-checked radio produces no `onChange`). `details.event` is therefore the
   native `click` `PointerEvent` for mouse, Space and arrow keys alike.
3. The library's `onChange` dispatches inside the Root's `useTransition`: types are added,
   `setOptimistic(value)` runs, the action is awaited. The sync prefix of the consumer's action runs
   during this event dispatch.
4. At the end of the event batch react-dom flushes sync work (which includes the optimistic render,
   because `useOptimistic` updates are `SyncLane`) and then **restores** every radio with that
   `name` and form owner to its current `checked` prop. Because the props were just rendered from
   the optimistic value, the restore writes the new selection. The DOM and `data-checked` agree.
5. When the action settles, the transition commits: uncontrolled state is written (or the
   controlled parent's value arrives), optimistic converges, `data-pending` leaves. On rejection or
   a controlled veto, optimistic reverts; every Item re-renders with the old `checked` props, and
   react-dom's `updateInput` writes `element.checked` from the prop on every host update, so the
   DOM rolls back without any extra effect in the library.

Why step 4 forces decision 3: with `checked` driven by committed (transition) state the restore
writes the *old* value and the radio snaps back until the transition commits, which for an async
action means the whole pending time (verified in jsdom, Chromium 156 and Firefox 157).

### 4.2 No-op rule

A dispatch is skipped when the target equals the **optimistic** value (conventions 2.3 item 7).
Native radios make this almost moot (the browser fires no `onChange` for an already-checked radio),
but it matters for the platform paths: a reset whose target is what the user already intends does
nothing. Clicking back to the committed radio while another is pending is a real dispatch that
replaces the in-flight intent (section 9.6).

### 4.3 `preventDefault` is not a veto

Two cases, both verified by the researcher:

- **Cancelled before the library's handler.** A pass-through `onClick={(e) => e.preventDefault()}`
  runs before the library's `onChange` (step 2). The library sees `event.defaultPrevented` and
  **does not dispatch**: the browser will revert `checked` after dispatch (canceled activation
  fires neither `input` nor `change`), React's restore writes the unchanged props, and the DOM,
  optimistic state and committed state all agree on the old value. This is not a supported veto
  API (conventions 2.6: pass-through handlers are the platform's, not ours); it is the library
  declining to record a change the platform is about to undo.
- **Cancelled inside the action.** `details.event.preventDefault()` in the sync prefix runs after
  the optimistic update. React restores the new value, then the browser restores the old one, and
  the DOM shows the old radio while `data-checked` and `aria`/`:checked` disagree for as long as
  the action is pending. The library checks `defaultPrevented` right after `dispatch` returns and
  warns once in development: "preventDefault() on a radio is unsupported; use controlled mode to
  veto". Nothing else is done; the DOM resyncs when the transition commits.

A veto is controlled mode: keep `value` unchanged in the action and the group snaps back when the
action settles (section 9.5).

## 5. Residual browser paths

`value` is library-owned, but the browser can still change which radio is checked without a click
the library saw. Each path dispatches through the same `valueChangeAction` with
`details.reason: "platform"` (conventions 3.5, the "residual browser path" row), and the DOM
is then re-synced by React's normal `checked` prop writes once the action settles.

Both paths read the DOM the same way: the Root queries `input[type="radio"]` inside the fieldset,
keeps those whose `name` property equals the group name (nested groups have different names), and
takes the `value` of the checked one, else `null`; for a reset it reads `defaultChecked` instead
of `checked` (conventions 3.8 rule 5: by the time the microtask runs after React's own reset, the
Items' re-apply effect has already put the optimistic value back into `checked`). The result is
compared against **what the user already intends**: the latest in-flight dispatch's `next` if
any, else the optimistic value (`latestInFlight()` from `useControllableAction`, exactly as
Accordion's `dispatchFromDom` does). Reading the DOM alone would lose a pending optimistic check.
Both paths are the Root's single call to `useNativeGroupReconciliation` (conventions 3.8) with
`element` = the fieldset ref, `readCurrent` / `readDefault` as above, `base`, and
`onPlatformChange` = `dispatchFromDom`.

### 5.1 Mount reconciliation (pre-hydration clicks, Firefox form-state restoration)

Server-rendered radios work before hydration. react-dom's `initInput` keeps the DOM's `checked`
when hydrating and fires no `onChange`, so a user who picked a radio before hydration, or whose
Firefox restored the dynamic checked state on reload, leaves DOM ≠ React state silently. A Root
layout effect at mount reads the group, and if the checked value differs from the initial value,
dispatches it once with `reason: "platform"` and `event: undefined`. One dispatch per group, never
one per radio. The StrictMode re-run of the effect sees the dispatch already in flight and does
nothing. No `suppressHydrationWarning` is needed: the HTML `checked` attribute still matches the
server render and react-dom does not diff the `checked` property during hydration.

### 5.2 Form reset

`form.reset()` restores every radio to its `defaultChecked`. react-dom sets `defaultChecked` once
at mount to the initial `checked` prop and never updates it for a controlled input. The reset
target therefore follows conventions 3.8 rule 6: in **uncontrolled** mode it is the **latest
`defaultValue`** (the Root passes `defaultValue` through context and each Item's `useNativeChecked`
mirrors `defaultChecked: defaultValue === value` into the DOM after every commit, as Switch does
with `defaultChecked`); in **controlled** mode it is the mount-time `value`, and the reset is
offered to the parent (product-owner decision, conventions resolved question 17).

Reset arrives three ways and the library handles all of them the same: a `<button type="reset">`,
a programmatic `form.reset()`, and React's own `requestFormReset` after a successful
`<form action>` (which calls `form.reset()` during commit; this is the case that desyncs every
controlled input in an app that does not listen, `form-controls.md` section 2).

The Root's `useNativeGroupReconciliation` subscribes to `reset` on the fieldset's form owner
(`fieldset.form`, which honours the `form` attribute the Root also puts on the radios) through
`useFormReset`. The subscription is **stable** (re-subscribed only when the form owner changes,
`useEffectEvent` body): React's automatic reset runs in the commit's mutation phase, between an
effect's cleanup and its re-run, so a deps-less effect would miss it (conventions 3.8 rule 4).
`reset` fires before the values change and the reset runs synchronously after the event, so the
handler re-reads the group (`readDefault()`) in a microtask and dispatches the new value with
`reason: "platform"` and `event` set to the `reset` event. A reset that a consumer's own listener
cancelled changes nothing and dispatches nothing.

What the user sees: the radios already show the reset value (the browser did it). Uncontrolled
mode commits it. A controlled parent either follows (adopts `next`) or ignores it, in which case
optimistic reverts when the action settles and the Items re-render with the parent's value: the
group re-checks the parent's radio. That is the conventions' browser-owned rule ("re-applied after
the action resolves; it follows the browser, it does not gate it") applied to the one path where
the browser writes first.

### 5.3 Reset of a disabled group

`<fieldset disabled>` stops the user, not `form.reset()`: the browser resets disabled radios too.
The library dispatches the reset for a disabled group as well, so that state follows the DOM and
the group shows the right radio when it is re-enabled. "Disabled parts never dispatch"
(conventions 2.3 item 6) is a statement about user interaction; the form's author reset the form.
This differs from Accordion, which re-closes a disabled item that find-in-page opened: there the
browser acted on one user-targeted item, here it acted on the whole form. Flagged in the questions.

## 6. ARIA and DOM output

Per APG Radio Group, using the native pattern (APG lists an "HTML radio input" variant and notes
that native radios may focus the last radio on Shift+Tab when none is checked; both allowed).

| Part | Attributes |
| --- | --- |
| `Root` | `role="radiogroup"`, `disabled` (native, when `disabled`), `form` (pass-through of the prop), `data-pending`, `data-disabled`. `aria-label` / `aria-labelledby` pass through for groups without a `Label`. |
| `Label` | none added; `<legend>` names the fieldset natively. |
| `Item` | `type="radio"`, `name` (group), `value`, `checked` (optimistic), `form` (group), `required` (group), `disabled` (own prop), `data-checked`, `data-pending`, `data-disabled`. No `aria-checked` (forbidden on native inputs by ARIA in HTML and ignored by Chromium), no `tabindex` (native roving), no `id` wiring. |

- **Name.** `useId()` unless `name` is given. `useId` output (`_r_1_`) is a valid form control name;
  it simply makes a poor form-data key, hence the prop. react-dom's restore queries
  `input[name="…"][type="radio"]` across the root and throws when a non-React radio shares the
  name, so names must be unique per form.
- **Required.** `required` goes on every radio so that `:required` matches all of them and the
  group is required in every engine; one checked radio satisfies it. After a submit attempt every
  radio matches `:user-invalid` while nothing is checked. Chromium exposes unchecked required radios
  as `invalid` in the accessibility tree before any interaction (platform behaviour, noted for AT
  testing).
- **Empty group.** When nothing is checked every radio matches `:indeterminate` (both probed
  engines). The library emits no `data-indeterminate`: it is a group fact, not an item state, and
  `:not(:checked)` plus `.group:not(:has(:checked))` already express it.
- **Optimistic state is heard by AT.** Native `checked` is the ARIA state, and the DOM `checked`
  is the optimistic value (section 4.1), so a screen reader announces the new radio at once. This
  is the opposite of Accordion's `<summary>` exception (conventions 3.2): nothing is visual-only
  here. A rollback is silent: the radio that regains `checked` is not focused, so nothing is
  announced. Consumers with slow actions that may fail can add an `aria-live` region.
- **Disabled.** `Item disabled` renders native `disabled`; `Root disabled` renders
  `<fieldset disabled>`. Both make the radio `:disabled` and unfocusable; native arrow navigation
  skips them. The APG allows native disabled radios, and the pattern has no "focusable but inert"
  requirement (unlike Tabs), so conventions 3.6's native-when-allowed rule applies. `data-disabled`
  is emitted on the Item in both cases so a wrapper can style it, since only the pseudo-class sees
  fieldset inheritance.

## 7. State exposure and styling

| Attribute | On | Source | Pseudo-class equivalent | Meaning |
| --- | --- | --- | --- | --- |
| `data-pending` | `Root` | `useTransition` | – | A dispatch is in flight, including a suspending dependent render's wait. |
| `data-pending` | `Item` | `pending && optimistic === value` | – | This radio is the one the user is waiting on. |
| `data-checked` | `Item` | optimistic | `:checked` (identical, section 4.1) | Immediate. |
| `data-disabled` | `Root`, `Item` | prop (Item: own or inherited) | `:disabled` (also sees fieldset inheritance) | |
| – | `Item` | | `:required`, `:user-invalid`, `:indeterminate` | Platform only; no attribute. |
| – | `Item` | | `:focus-visible` | Conventions 4.2. A wrapping label uses `:has(:focus-visible)`. |

The library ships no CSS. The documented recipes:

```css
/* 1. Minimal: keep the UA radio, recolour it. */
.radio { accent-color: var(--accent); }

/* 2. Custom: the input is the visible control. */
.radio {
  appearance: none;
  inline-size: 1.25em; block-size: 1.25em;
  border: 2px solid GrayText; border-radius: 50%;
  display: inline-grid; place-content: center;
  transition: border-color 120ms;
}
.radio::before {
  content: ""; inline-size: 0.6em; block-size: 0.6em; border-radius: 50%;
  background: var(--accent); scale: 0; transition: scale 120ms;
}
.radio:checked { border-color: var(--accent); }
.radio:checked::before { scale: 1; }           /* optimistic: flips on click, reverts on rejection */
.radio[data-pending] { animation: fsui-pulse 1s infinite; }
.radio:disabled { opacity: 0.4; }
.radio:user-invalid { border-color: var(--danger); }
.radio:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* 3. The consumer's row and the group. */
.option:has(.radio:checked) { font-weight: 600; }
.option:has(.radio[data-pending]) .spinner { display: inline; }
.group[data-pending] { cursor: progress; }

@media (prefers-reduced-motion: reduce) {
  .radio, .radio::before { transition: none; animation: none; }
}
```

Tailwind: `checked:border-accent data-pending:animate-pulse` on the Item,
`has-[:checked]:font-semibold` on the label.

## 8. Keyboard interaction

Everything in this table is the browser's (probed in Chromium 156 and Firefox 157; WebKit per
documentation, with the macOS caveat that Safari needs Option+Tab or the "press Tab to highlight
each item" setting to tab into form controls at all):

| Key | Effect | Dispatches? |
| --- | --- | --- |
| `Tab` / `Shift+Tab` | Enter the group on the checked radio; leave it with the next press. With nothing checked, enter on the first radio (Shift+Tab may land on the last). | No |
| `Space` | Check the focused radio if it is unchecked. | Yes |
| `ArrowDown` / `ArrowRight` | Focus **and check** the next enabled radio, wrapping from last to first. Under `direction: rtl`, `ArrowRight` goes to the previous radio. | Yes, once per press |
| `ArrowUp` / `ArrowLeft` | Previous enabled radio, wrapping. Mirrored in RTL. | Yes, once per press |
| `Enter` | Inside a `<form>`, implicit submission (native). | No |
| `Home` / `End` | Nothing. | – |

Decisions:

- **No `Home`/`End`.** The APG Radio Group pattern lists Tab, Space and the four arrows only.
  Native radios match it exactly, and adding two keys would mean the component's first keyboard
  JS, which would also have to replicate "check on focus" to stay consistent with the arrows.
  Can be added later without a breaking change.
- **No `orientation` prop.** Radix, Base UI and React Aria have one because they implement roving
  focus in JS and can restrict the axis. Native radios honour all four arrows regardless, so a
  prop would either lie (if it only set `aria-orientation` / `data-orientation`) or re-implement
  the keyboard (if it filtered keys). Layout is the consumer's CSS. Flagged in the questions.
- **No `experimental_focusgroup`.** `focusgroup` would add what radios already have.
- **The library never moves focus**, not on rollback either: after a rejected or vetoed change
  focus stays on the radio the user reached, which is now unchecked, and the checked radio is the
  group's tab stop again. The next arrow press works from where focus is.

## 9. Async walkthroughs

Notation: `C` = committed value, `O` = optimistic value, `P` = Root pending, DOM = which radio is
checked in the DOM.

### 9.1 Sync action with local state (controlled)

`value={plan}`, `valueChangeAction={(next) => { setPlan(next); }}`, `C = O = DOM = "free"`.

1. Click "Pro". Browser: DOM `"pro"`. Library `onChange`: dispatch, `addTransitionType("fsui-radio-group")`,
   `setOptimistic("pro")`, then the consumer's `setPlan("pro")` runs in the sync prefix (a
   transition update).
2. Sync flush: `O="pro"`, `P=true` for this render. Items render `checked` from `O`; react-dom's
   restore after the event writes the same. `data-checked` moved, "Pro" Item and Root `data-pending`.
3. The transition commits in the same task: `plan="pro"`, `C="pro"`, `P=false`. Nothing visible
   changed in the group between steps 2 and 3.

### 9.2 Async action that resolves, with dependent content elsewhere that suspends

```tsx
const [plan, setPlan] = useState("free");
<RadioGroup.Root value={plan} valueChangeAction={(next) => { setPlan(next); }}>…</RadioGroup.Root>
<Suspense fallback={<Skeleton />}>
  <PlanDetails plan={plan} />   {/* use(fetchPlan(plan)) */}
</Suspense>
```

1. Click "Pro". `O="pro"`, DOM `"pro"`, `data-pending` on the "Pro" Item and the Root. `setPlan("pro")`
   is a transition update.
2. The transition render makes `PlanDetails` suspend. The boundary is already revealed and the
   update is a transition, so React keeps the old details on screen; `P` stays true.
3. The data arrives; the transition commits: `C="pro"`, new details, `P=false`.

The radio is checked immediately and announced immediately; the dependent content waits. With an
awaited round trip instead (`async (next) => { await save(next); startTransition(() => setPlan(next)); }`)
the same thing happens with the network wait added to step 2. Uncontrolled mode with dependent
content: mirror the value into your own state in the action (`valueChangeAction={(next) => setPlan(next)}`),
which is the same as controlled mode; Root's function `children` receive the **optimistic** value
and must not suspend.

### 9.3 Async action that rejects

Uncontrolled, `defaultValue="free"`, `valueChangeAction={async (next) => { await save(next); }}`.

1. Click "Pro": `O="pro"`, DOM `"pro"`, "Pro" and Root `data-pending`, focus on "Pro".
2. `save` rejects. The error reaches the nearest Error Boundary above `RadioGroup.Root`. The
   post-await `setInternal` is skipped, so `C="free"`; `O` reverts.
3. The settle commit re-renders every Item with `checked` from `C`: react-dom writes `checked`
   from the props, so **the DOM rolls back to "Free"**. `data-pending` leaves. Focus is still on
   "Pro" (now unchecked); nothing is announced. The Item's `transition` (if set) animates this
   commit.

Controlled with "update on success" is identical. A consumer who catches inside the action gets a
resolved action: in uncontrolled mode the new value commits (conventions 2.4).

### 9.4 Rapid arrow keys (and a keyboard user holding an arrow down)

`defaultValue="a"`, radios a..e, `valueChangeAction={async (next) => { await save(next); }}`
(300 ms each). The user presses ArrowDown three times quickly, or holds it so the key repeats.

1. Each press (or repeat) is native: the browser focuses the next radio and fires `click` on it;
   the library dispatches once per press (ids 1, 2, 3 for b, c, d). Focus never waits for anything.
2. The reducer re-bases: `O` is b, then c, then d. The `data-pending` Item is always the latest
   target; react-dom's post-event restore keeps the DOM on it.
3. Three `save` calls are in flight; `P` stays true until all three settle. The latest-dispatch
   guard commits only d. If b's promise rejects after d resolved, the shared hook still routes
   that error to the boundary (conventions 2.4).

Compared with Tabs' automatic activation: Tabs can switch to `activationMode="manual"` to avoid a
round trip per arrow press; radios have no manual mode because checking on arrow *is* the native
and APG behaviour. The guidance for round-trip actions is therefore the conventions' own: await
only what the UI must wait for (`(next) => { void save(next); }` for a preference), or let the
form submit carry the value and leave `valueChangeAction` off. Consumers who need to coalesce
can also debounce inside the action (the action is just a function).

### 9.5 Controlled parent that vetoes

`value="free"` fixed, `valueChangeAction={() => {}}`. Click "Pro": `O="pro"`, DOM `"pro"`,
`data-pending` for one tick; the action resolves; `O` reverts to `"free"`; the settle commit
writes `checked` back: DOM `"free"`. The user sees "Pro" flash checked and return. Focus stays on
"Pro". This is `useOptimistic`'s documented behaviour; a parent vetoes by not adopting the value.
`preventDefault()` is not the way (section 4.3).

### 9.6 Clicking back to the committed radio while another is pending

`C="free"`, click "Pro" (slow save): `O="pro"`. Click "Free": the browser checks it and fires
`onChange`; the no-op check is against `O`, so this is a real dispatch (id 2): `O="free"`, the
"Free" Item is `data-pending`. When "Pro"'s save resolves it is not the latest and does not
commit; "Free"'s commit is a no-change update. The user cancelled the switch without an abort
signal; `save("pro")` still ran to completion (conventions 2.5).

### 9.7 Form reset, external and automatic

Uncontrolled, `defaultValue={null}`, inside `<form action={submitPlan}>`, `name="plan"`.

1. User checks "Pro": `C="pro"` after the (absent) action resolves.
2. Submit. The form action runs in React's form transition; `useFormStatus().pending` is true
   inside the form, the group's own `P` is false (two independent channels). `FormData` carries
   `plan=pro` from the DOM.
3. The action succeeds; React calls `form.reset()` during commit. The browser restores every radio
   to `defaultChecked`: nothing checked. The Root's `reset` listener schedules a microtask.
4. Microtask: DOM reads `null`; the base (`latestInFlight()?.next ?? O`) is `"pro"`; dispatch
   `null` with `reason: "platform"`, `event` = the `reset` event. `valueChangeAction`, if given,
   is called with `(null, details)`. Uncontrolled: `C=null`. The group shows nothing checked, which
   is what the browser already showed.

A `<button type="reset">` is steps 3 and 4 without the submit. Controlled with a parent that
ignores the reset: `O` reverts to the parent's value when the action settles, the Items re-render,
and the DOM re-checks that radio; the reset is undone for this group only.

### 9.8 Click before hydration

SSR HTML has `checked` on "Free". The user clicks "Pro" before hydration: the browser checks it.

1. Hydration: `initInput` keeps the DOM `checked` and fires nothing. The first client render has
   `C="free"` props; the DOM says "Pro".
2. Root's mount layout effect reads `"pro"`, compares with the initial value, dispatches
   `("pro", { reason: "platform", event: undefined })`. `O="pro"`; the Items re-render with props
   that match the DOM.
3. Uncontrolled: `C="pro"` after the action resolves. Rejection: `O` reverts and the settle commit
   writes `checked` back to "Free", rolling back the pre-hydration click. Controlled: the parent
   follows or vetoes as in 9.5.

Firefox form-state restoration on reload arrives through the same effect.

### 9.9 `value` prop changes while pending

Controlled; the parent switches `value` from `"free"` to `"team"` (router navigation) while a
dispatch of `"pro"` is pending. The reducer re-runs against the new base, so `O` stays `"pro"`
(DOM "Pro") until the action settles, then converges to whatever the parent holds. No special code.

## 10. ViewTransition

What animates when, applying conventions 5.1 and the Tabs 10.1 table:

| Commit | Lane | `<ViewTransition>` fires? | What changes |
| --- | --- | --- | --- |
| Optimistic check (click, Space, arrow) | sync | **No** | Item `checked`, `data-checked`, `data-pending`; Root `data-pending` |
| Action settles (success) | transition | Yes | `data-pending` leaves; consumer content updated in the same transition |
| Action rejects or parent vetoes | transition | Yes | Items' `checked` revert (the DOM rollback) |
| Form reset / mount reconciliation dispatch settles | transition | Yes | As above |

- **The check itself is CSS.** `.radio:checked::before { scale: 1 }` with a CSS `transition`
  animates on click and back on rejection. Any `<ViewTransition>` keyed on optimistic state is a
  bug (conventions 5.1).
- **`Item` keeps a `<ViewTransition default={transition ?? "none"}>` and a `transition` prop** for
  parity with Toggle and Tabs (product-owner decision), documented as animating the settle commit
  only. On a radio with no children that is the `data-pending` attribute leaving and the rollback
  write; most consumers will never set it.
- **Dependent content is the consumer's boundary.** The library adds `fsui-radio-group` to every
  dispatch, so a consumer's own `<ViewTransition default={{ "fsui-radio-group": "fade", default: "none" }}>`
  around `<PlanDetails>` animates exactly the commits the group caused (walkthrough 9.2) and not
  unrelated ones. `Root` and `Label` render no boundary.

```css
::view-transition-old(.fade) { animation: 120ms ease-in both fsui-fade-out; }
::view-transition-new(.fade) { animation: 120ms ease-out both fsui-fade-in; }
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; }
}
```

## 11. Call-site examples

### 11.1 Settings page: autosave with a Server Function, passed directly

```tsx
// actions.ts
"use server";
export async function saveTheme(next: string | null) {
  if (next !== null) await db.user.update({ theme: next });
}
```

```tsx
// theme-picker.tsx — a Server Component; `details` is serialisable so no wrapper is needed
import { RadioGroup } from "@funstack/ui/radio-group";
import { saveTheme } from "./actions";

export function ThemePicker({ theme }: { theme: string }) {
  return (
    <RadioGroup.Root defaultValue={theme} valueChangeAction={saveTheme} className="group">
      <RadioGroup.Label>Theme</RadioGroup.Label>
      <label className="option"><RadioGroup.Item value="light" className="radio" /> Light</label>
      <label className="option"><RadioGroup.Item value="dark" className="radio" /> Dark</label>
      <label className="option"><RadioGroup.Item value="system" className="radio" /> System</label>
    </RadioGroup.Root>
  );
}
```

The clicked radio checks at once and shows `data-pending` until the server responds; a failure
rolls it back and reaches the Error Boundary. Function-valued props cannot be passed from a Server
Component (not serialisable); plain values are fine.

### 11.2 Form submission with native `name`, no change action

```tsx
<form action={createSubscription}>
  <RadioGroup.Root name="plan" required>
    <RadioGroup.Label>Plan</RadioGroup.Label>
    <label><RadioGroup.Item value="free" /> Free</label>
    <label><RadioGroup.Item value="pro" /> Pro</label>
  </RadioGroup.Root>
  <SubmitButton />   {/* useFormStatus().pending */}
</form>
```

The radios post `plan=pro` with the form; `required` blocks submission until one is checked and
`:user-invalid` styles them after the attempt. After a successful action React resets the form and
the group follows the reset (walkthrough 9.7). The group's own `data-pending` never appears: there
is no change action. "Submit on change" is
`valueChangeAction={() => { formRef.current?.requestSubmit(); }}`.

### 11.3 Controlled with dependent content that suspends

```tsx
"use client";
import { Suspense, useState } from "react";
import { RadioGroup } from "@funstack/ui/radio-group";

export function PlanChooser() {
  const [plan, setPlan] = useState("free");
  return (
    <>
      <RadioGroup.Root value={plan} valueChangeAction={(next) => { if (next !== null) setPlan(next); }}>
        <RadioGroup.Label>{({ pending }) => <>Plan {pending && <Spinner aria-hidden />}</>}</RadioGroup.Label>
        {PLANS.map((p) => (
          <label key={p.id} className="option">
            <RadioGroup.Item value={p.id} className="radio" /> {p.name}
          </label>
        ))}
      </RadioGroup.Root>
      <Suspense fallback={<PlanSkeleton />}>
        <PlanDetails plan={plan} />
      </Suspense>
    </>
  );
}
```

`PlanDetails` reads a cached promise with `use()`. Picking a plan checks the radio at once, keeps
the old details on screen with the legend's spinner showing, and swaps when the data is ready.
A `<Suspense key={plan}>` shows the skeleton immediately instead (consumer's choice, conventions 6).

### 11.4 Controlled by the URL

```tsx
const sort = useSearchParam("sort") ?? "newest";
<RadioGroup.Root value={sort} valueChangeAction={(next) => { navigate(`?sort=${next}`); }}>
```

The navigation is in the sync prefix, so it is a transition update; if the route's loader
suspends, the group shows `data-pending` until the navigation completes.

### 11.5 Disabled item, custom element, Tailwind

```tsx
<RadioGroup.Root defaultValue="card" className="data-pending:cursor-progress">
  <RadioGroup.Label className="font-medium">Payment</RadioGroup.Label>
  <label className="has-[:checked]:font-semibold">
    <RadioGroup.Item value="card" className="checked:border-blue-600 data-pending:animate-pulse" /> Card
  </label>
  <label className="has-[:disabled]:opacity-50">
    <RadioGroup.Item value="crypto" disabled /> Crypto (coming soon)
  </label>
  <label>
    <RadioGroup.Item value="bank" render={<input id="pay-bank" data-testid="bank" />} /> Bank transfer
  </label>
</RadioGroup.Root>
```

The `render` element stays an `<input>`; the library sets `type="radio"`, `name`, `value`,
`checked` and its handler on top of the element's own props.

## 12. Test plan

`packages/ui/src/radio-group/radio-group.test.tsx` (jsdom, `user-event`, helpers from
`src/__tests__/helpers.tsx`) plus `radio-group.browser.test.tsx` for what jsdom cannot do. Rows
marked (both) run under `describe.each` with the uncontrolled and the "update on success"
controlled wrapper.

| Area | Tests |
| --- | --- |
| Roles and ARIA | `fieldset[role=radiogroup]` with accessible name from `Label` (`toHaveAccessibleName`); `aria-label` fallback without `Label`; every Item is `input[type=radio]` with the same `name`; `useId` name when `name` omitted, prop when given; `value` attribute per Item; `required` on every Item when set on Root; `disabled` on the fieldset for `Root disabled`, on the input for `Item disabled`; `data-disabled` on Items in both cases; `form` attribute on fieldset and inputs. |
| Keyboard | Click, Space and arrow keys (user-event emulates native radio walking: next/previous, wrap, disabled skipped) each dispatch once with a native `click` event; Tab enters on the checked radio; `Home`/`End` do nothing. **Browser mode:** RTL mirroring, native wrap, Shift+Tab return, Safari note. |
| Sync action (both) | `(next, details)` shape; `details.reason === "activate"`; `details.event.type === "click"`; clicking the checked radio, a disabled radio, or any radio under `Root disabled` never dispatches; a click whose `defaultPrevented` is already true (pass-through `onClick`) never dispatches and leaves the DOM on the old radio. |
| Async action (both) | While unresolved: `data-pending` on Root and the clicked Item only; the clicked input is `checked` in the DOM; `data-checked` moved; other Items unchanged. After resolve: pending gone, value committed (uncontrolled) / parent updated (controlled). |
| Rejection (both) | `ErrorCatcher` receives the error; the previously checked input is `checked` again in the DOM; `data-checked` reverted; uncontrolled internal value unchanged. Caught-inside variant resolves and (uncontrolled) commits. |
| Overlap | Arrow to b then c, resolve b last: DOM and `data-checked` on c throughout, final committed c; walkthrough 9.6 (click back to committed while pending): final committed is the committed value, both actions called. |
| Superseded rejection (both) | b rejects after c resolved, and while c is pending: error reaches the boundary; c's outcome unaffected. |
| Suspending content (both) | Dependent `<Suspender />` keyed on the consumer's state updated in the action: old content stays, no fallback from the boundary above, Root `data-pending`; after resolve, new content. |
| Platform: mount reconciliation | `renderToString` with "a" checked, set `.checked` on "c" in the HTML before `hydrateRoot`: exactly one dispatch with `reason: "platform"`, `event === undefined`, `next === "c"`; DOM stays on "c"; rejection rolls the DOM back to "a". StrictMode: still one dispatch. |
| Platform: form reset | Inside a `<form>`: check "b", call `form.reset()` → one dispatch `(a-or-null, { reason: "platform", event: Event("reset") })`, uncontrolled commits it; controlled parent that ignores → DOM re-checks the parent's radio after settle; `<form action>` that succeeds auto-resets and dispatches the same way; a cancelled `reset` event dispatches nothing; `Root disabled` still dispatches on reset; reset whose target equals the optimistic value dispatches nothing. |
| `preventDefault` warning | `details.event.preventDefault()` inside the action logs the dev warning once; the action still ran. |
| Platform: reset target by mode | Uncontrolled: after the Root re-renders with a new `defaultValue` (inside a transition), `form.reset()` returns the group to the new default and dispatches it; controlled: reset returns to the mount-time `value` and the parent is notified. |
| `details.event` is virtual | Toggle row 21 verbatim on an Item click, plus `JSON.stringify(details) === '{"reason":"activate"}'`; a fake Server Function (plain async spy) receives `(next, details)` with the same shape. |
| Function props | `className` / `style` on Root, Label, Item receive the documented state (`checked` optimistic, `pending` per Item); `children` on Root and Label receive Root state; Item has no `children`. |
| `render` element | `render={<input id="x" className="y" />}` on Item keeps `type="radio"`, `name`, `checked` and the library's handler, concatenates `className`, forwards `ref`; `render={<fieldset />}` on Root; dev warning when the mounted tag is not `INPUT` / `FIELDSET`. |
| Post-await rule | Controlled wrapper that awaits then `startTransition(setValue)` works end to end. |
| `transition` prop | Item renders with and without `transition`; Root and Label have none. |
| Directive | Built `dist/radio-group/*.mjs` for Root, Label, Item and context begin with `"use client"`. |
| Dev warnings | `value` together with `defaultValue`, and switching `value` between `undefined` and a value, warn once each (shared hook). **No** warning when neither is given. |

jsdom facts the tests rely on (user-event 14.6.8, jsdom 30, react-dom 19.3.1): user-event's
`walkRadio` focuses and clicks the next same-`name` radio on arrow keys, wrapping and skipping
disabled radios, without RTL awareness; `input.click()` on a radio flips the group and React's
`onChange` fires; `form.reset()` fires `reset` and restores `defaultChecked` (probe 07); React's
automatic reset after `<form action>` works in jsdom (probe 07). Browser-only checks: RTL, the
accessibility tree (`radiogroup` named by the legend, probed via CDP), `:user-invalid` after a
submit attempt, `:indeterminate` on an empty group.

## 13. Implementation notes

### 13.1 Files

```
packages/ui/src/radio-group/
  index.ts                   # no directive; namespace + type re-exports; imports platform-attributes for side effects
  radio-group-context.ts     # "use client"; createContext<RadioGroupContextValue | null>
  radio-group-root.tsx       # "use client"; state owner, fieldset, reset listener, mount reconciliation
  radio-group-label.tsx      # "use client"; <legend>, reads context for state (function props)
  radio-group-item.tsx       # "use client"; <input type="radio">
  radio-group.test.tsx
  radio-group.browser.test.tsx
packages/ui/src/internal/
  use-form-reset.ts                    # "use client"; stable reset subscription (conventions 3.8)
  use-native-checked.ts                # "use client"; per input, `group: true` here (conventions 3.8)
  use-native-group-reconciliation.ts   # "use client"; the Root's one-dispatch-per-group adapter
```

### 13.2 Context

```ts
interface RadioGroupContextValue {
  readonly name: string;
  readonly form: string | undefined;
  readonly required: boolean;
  /** Optimistic value: Items render `checked` from it. */
  readonly optimistic: string | null;
  readonly pending: boolean;
  readonly disabled: boolean;
  /** No-op if `value === optimistic`, or if `event.defaultPrevented` (section 4.3). Never checks `disabled`; a disabled radio never fires. */
  readonly select: (value: string, event: Event) => void;
}
```

One context; every Item re-renders on a dispatch anyway (`checked` props change). Committed state
is not in the context: no part renders it.

### 13.3 Root

- `useId()` for the fallback `name`; `useRef` for the fieldset element.
- `useControllableAction<string | null, RadioGroupValueChangeDetails>({ controlled: value,
  defaultValue, initialValue: null, action: valueChangeAction, transitionTypes: () =>
  transitionTypes("radio-group"), warn: { component: "RadioGroup.Root", prop: "value" } })`.
  Default reducer (replace). No `useDevWarning` for the missing-both case (decision 2).
- `select(value, event)`: return if `event.defaultPrevented` or `value === optimistic`; else
  `dispatch(value, createActionDetails(event, { reason: "activate" }))`; then, in development,
  if `event.defaultPrevented` is now true, warn once (the action's sync prefix cancelled it).
- `dispatchFromDom(next, event | undefined)`: `base = latestInFlight()?.next ?? optimistic`;
  return if `next === base`; else `dispatch(next, createActionDetails(event, { reason: "platform" }))`.
- `readGroup()`: `fieldset.querySelectorAll('input[type="radio"]')`, filter by `.name === name`,
  return the checked one's `.value` or `null`.
- Residual paths: one call,
  `useNativeGroupReconciliation({ element: fieldsetRef, readCurrent: readGroup, readDefault: readGroupDefault, base: () => latestInFlight()?.next ?? optimistic, onPlatformChange: dispatchFromDom })`
  (conventions 3.8). It runs the mount reconciliation once in a layout effect and owns the
  stable `reset` subscription on `fieldsetRef.current.form` via `useFormReset`; a changed `form`
  prop or a moved fieldset re-subscribes because the owner is re-read after every commit.
  `readGroupDefault()` is `readGroup()` over `defaultChecked` instead of `checked`.
- Context additionally carries `defaultValue` (uncontrolled mode only) so each Item can mirror
  its reset target (13.5).
- Renders `<fieldset role="radiogroup" disabled={disabled} form={form} data-pending data-disabled>`
  through `use-render` with `RadioGroupRootState`; dev warning when the mounted `tagName` is not
  `FIELDSET`.
- Owned keys: `role`, `disabled`, `form`, `data-pending`, `data-disabled`.

### 13.4 Label

- Reads context for `{ value: optimistic, pending, disabled }`; renders `<legend>` through
  `use-render`. Owns no keys. Documented as "must be the first child of Root".

### 13.5 Item

- Reads context; `checked = ctx.optimistic === value`; `pending = ctx.pending && checked`;
  `disabled = ctx.disabled || disabledProp`.
- `useNativeChecked({ type: "radio", component: "RadioGroup.Item", checked, group: true,
  defaultChecked: ctx.defaultValue === undefined ? undefined : ctx.defaultValue === value })`
  (conventions 3.8): tag check, re-apply of `checked` and `defaultChecked` after every commit; no
  residual-path reporting (the Root does it once per group). `onChange` goes through
  `guardCheckableChange` before calling `ctx.select`.
- Renders through `use-render` with `defaultElement: "input"`; pass-through `props` are `rest`
  plus `disabled: disabledProp` (native, own prop only); `libraryProps`:
  `type: "radio"`, `name: ctx.name`, `value`, `checked`, `form: ctx.form`, `required: ctx.required`,
  `data-checked`, `data-pending`, `data-disabled`, `onChange: (e) => ctx.select(value, e.nativeEvent)`.
  Dev warning when the mounted `tagName` is not `INPUT`.
- Output: `<ViewTransition default={transition ?? "none"}>{element}</ViewTransition>`.
- Owned keys: `type`, `name`, `value`, `checked`, `form`, `required`, `data-checked`,
  `data-pending`, `data-disabled`, `onChange`.
- No `defaultChecked` is ever rendered as a prop (react-dom derives the mount-time value from the
  initial `checked` prop); in uncontrolled mode the hook keeps `el.defaultChecked` equal to
  `defaultValue === value` so the reset target follows the latest `defaultValue` (section 5.2).

### 13.6 Dev warnings

Wrong `tagName` behind `render` (Root, Item); `preventDefault()` inside the action; `Item` or
`Label` outside a Root (throw, as Tabs does); the shared hook's controlled/uncontrolled warnings.
Deliberately absent: neither `value` nor `defaultValue` given; a controlled `value` that matches no
Item (nothing checked is a valid, native state and the tab stop still works).

## 14. Alternative anatomy (not chosen): hidden input with a label Item and an Indicator

Kept for the record. The product owner confirmed shape 1 for Checkbox, Switch and RadioGroup
together (conventions resolved question 16); this shape would be a new design, not a switch.

```tsx
<RadioGroup.Root defaultValue="pro">
  <RadioGroup.Label>Plan</RadioGroup.Label>
  <RadioGroup.Item value="pro">          {/* <label data-checked data-pending data-disabled> */}
    <RadioGroup.Input />                 {/* <input type="radio">, visually hidden by the consumer's CSS */}
    <RadioGroup.Indicator />             {/* <span aria-hidden data-checked data-pending> */}
    {({ pending }) => <>Pro {pending && <Spinner />}</>}
  </RadioGroup.Item>
</RadioGroup.Root>
```

Deltas from the primary design:

- `Item` renders `<label>` and provides an item context `{ value, checked, pending, disabled }`;
  it takes `value`, `disabled`, function `className` / `style` / `children` of `RadioGroupItemState`,
  and `render` (must stay a `<label>` to keep click forwarding, or the consumer wires `htmlFor`).
- `Input` renders the `<input type="radio">` with everything section 13.5 lists; it reads the item
  context for `value` and `disabled`; must be rendered exactly once inside its Item (dev warning
  otherwise). The `transition` prop moves here.
- `Indicator` renders `<span aria-hidden="true">` with `data-checked`, `data-pending`,
  `data-disabled` and function props of the item state; no `<ViewTransition>` (optimistic part).
- The input must be hidden with a visually-hidden clip, never `display: none` or `hidden` (that
  removes it from focus and the accessibility tree); the focus ring moves to the Item with
  `:has(:focus-visible)`.
- Everything in sections 4, 5, 9 and 12 is unchanged: the input is still the one focusable,
  labelled, form-participating element, and it still renders `checked={optimistic === value}`.

Trade-off: three parts per option instead of one, and a required nesting invariant, in exchange
for function `children` per item and `data-*` on the row without `:has()`. Modern CSS makes the
second half of that exchange cheap, which is why shape 1 is the primary design.

---

## Cross-component (resolved 2026-10-16)

The six assumptions this design stated about Switch and Checkbox are settled in
`design/conventions.md` (section 3.8 and resolved questions 16 to 21): shape 1 anatomy on all
three; the shared machinery is `useFormReset` + `useNativeChecked` (with `group: true` in Items)
+ `useNativeGroupReconciliation` on the fieldset Root, giving one dispatch per group; the
`defaultPrevented` rules are the shared `guardCheckableChange`; `checked` is the vocabulary word
and `data-indeterminate` exists on Checkbox only; `details.reason` is the public `ChangeReason`;
form props are pass-through on single controls and Root-owned here.

## Conventions feedback (applied 2026-10-16)

All nine items were applied to `design/conventions.md`: `RadioGroup.Item` on the `checked` row
(4.1); the form-reset path (3.5, 3.8); the already-cancelled click rule (2.3 item 3); "disabled
never dispatches" scoped to user interaction (2.3 item 6, 3.6); `null` from platform paths (3.1);
`fsui-radio-group` (5.3); the `render` restriction for inputs and fieldset Roots (1.2); `Label`
as `<legend>` in the part vocabulary (1.1); and the #19 note (7.3).

## Questions for the product owner

1. **Anatomy.** Resolved: shape 1 (conventions resolved question 16).
2. **`next: string | null`.** Accept that `valueChangeAction` is typed `string | null` because a
   form reset can empty the group? The alternative (type `string`, never dispatch `null`) would
   leave `data-checked` stale after a reset to "nothing checked", which is the common
   `<form action>` case. Consumers with `string`-only saves write `if (next !== null)`.
3. **No `orientation` prop.** Radix, Base UI and React Aria have one; native arrows ignore it.
   Keep it off (recommended) or add a styling-only `data-orientation` with a documented "arrows
   are not restricted" caveat?
4. **No `Home`/`End`.** APG does not list them for radio groups; adding them means keyboard JS.
   Confirm.
5. **No `details.item`.** The issue sketch mentions it; for a single-value group `next` *is* the
   item, and Accordion needs `item` only because its `next` is a set. Omitted; confirm.
6. **Reset of a disabled group dispatches** (section 5.3). Confirm, or prefer Accordion's
   "re-apply committed state, no dispatch" for disabled groups.
7. **Root must be a `<fieldset>`.** No `div[role=radiogroup]` variant in v0 (it would lose legend
   naming, disabled inheritance and `.form`). Confirm.
8. **Part name `Label` vs `Legend`.** Resolved: `Label`, now in the conventions' part vocabulary
   (1.1) as the `<legend>` of fieldset-based groups.
9. **`transition` on `Item`.** Kept for parity with Toggle and Tabs; on a void element it animates
   only `data-pending` leaving and the rollback write. Keep, or drop as the first documented
   exception?
