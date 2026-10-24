# @funstack/ui API conventions

Status: **accepted** (2026-10-15, GitHub issue #5; open questions resolved by the product owner
with the user, see the end of this document; amended 2026-10-15 after the Toggle design, #6, with
the ViewTransition correction in 5.1, the pending-is-never-disabled rule in 3.6, and the Server
Function note in 2.4; amended 2026-10-17 after the CheckboxGroup design, #33, see resolved
question 20; amended 2026-10-17 with the Popover design, #38: the top-layer rule in 3.5 and 5.1,
and the `focusGroup` detection in 8, issue #43; Popover and Menu accepted the same day, see
resolved questions 24 and 25; amended 2026-10-17 with the Select design, #50, see resolved
question 26; amended 2026-10-17 with the Combobox design, #50: the urgent lane in 2.6 and 3.2,
the built-in strings rule in section 11, see resolved question 27; amended 2026-10-17 with the
Dialog close amendment, #46: the "cancelable step" rule for part-initiated closes in 3.5; amended 2026-10-18 with the Toast
design, #54, see resolved question 28: `"timeout"` in 2.2, the urgent queue in 2.6, the registry
and the library-driven region in 3.5, the `ending` / `paused` / `type` rows in 4.1, the third
no-`transition` category in 5.1, the Suspense guard in 6, the function export in 1.1 and 9.3,
the strings in 11, the Lanes row in 10.1; amended 2026-10-18 with the Slider design, #54, see resolved
question 29: the commit action in 2.1, the hidden-control exception in 1.1, the continuous-control
corollary in 2.3, the gesture value in 3.2 and 3.3, the controlled value input's reset in 3.5 and 3.8,
`dragging` in 4.1, the no-`transition` note in 5.1, the types in 5.3, generic props in 9.4, the
continuous-control row in 10.1; amended 2026-10-18 with the Field and Form design, #54, see resolved
question 30: `Control` / `Description` / `Error` / `Submit` in 1.1 and the element rules in 1.2, the
validity mirror in 2.6, the form-channel amendments in 2.7, the reset and settle notes in 3.5, the
owned custom-validity slot in 3.6, `useFieldControl` and `useFormOwnerEvent` in 3.8, `invalid` /
`required` in 4.1 and 4.2, the no-`transition` note and the CSS-exit rule (#46) in 5.1, the types in
5.3, the shared context location in 7.1, the shared state type in 9.4, the three rows in 10.1, the
platform-string note in 11; amended 2026-10-18 with the ToggleGroup and Toolbar design, #66, **accepted
2026-10-18**: the `Button` row and the `Item` / `Separator` notes in 1.1, the roving tab stop in 3.2 and
7.4, `aria-disabled` in 3.6, the rows in 4.1 and 5.3, the shared context in 7.1, the flag row in 8, the
files in 9.1; amended 2026-10-18 with the Progress and Meter design, #68, see resolved question 32: the
`Track` / `Indicator` / `Label` / `Value` notes in 1.1, the consumer-side lane rule in 2.6, the mirrored-state
examples in 3.5, `complete` / `region` / `indeterminate` in 4.1, the fourth no-`transition` category in 5.1
and the types in 5.3, the `react-server` hook list and the first use of the provider exception in 7.1 and
7.3, the shared state types in 9.4, the two rows and the directive-free note in 10.1, the platform-string
note in 11; amended 2026-10-18 with the NumberField design, #67, see resolved question 33: `Increment` /
`Decrement` and the widened `Root` / `Input` / `Label` in 1.1 with the hidden-sibling exception, the draft text
and the held value in 2.6 and 3.2, the uncontrolled hidden input in 3.5 and 3.8 rule 6, the surface /
validity-element mirror in 3.6, `validityElement` in 3.8, the `pending` / `disabled` rows in 4.1, the
no-`transition` note in 5.1 and the types in 5.3, the directive-free modules in 7.1, the `announce` helper
in 8, the three rows in 10.1, the two static strings in 11; amended 2026-10-18 with the Button design,
#79, **accepted 2026-10-22**, see resolved question 34: the `Button` row in 1.1, the cancelled-click note and item 9 in 2.3, the
re-entry rule in 2.5, the own-`formAction` reading in 2.7, the hook option in 3.4, `aria-disabled` while
pending in 3.6, the `pending` row in 4.1, the row in 5.3, the folder in 9.1, the Re-entry row in 10.1;
review fold 2026-10-22: the component-`render` `type` rule and the non-host-button `disabled` rule
in 1.2, the counter-only guard in 2.5, 3.4 and 10.1; wave 9 amendments #81 and #83, 2026-10-22,
`design/components/button.md` 16 and 17: the guard as the hook's default in 2.5 and 3.4, the
library-wide `disabled` sweep in 1.2; amended 2026-10-22 with the Context menu design, #45,
`design/components/context-menu.md`, **accepted 2026-10-22**, see resolved question 35: the
`ContextTrigger` row in 1.1, the outside right-click example in 2.2, the move note in 3.5, the
`context` row in 4.1, and section 12, shipped functional CSS, a user decision; amended 2026-10-23 with
the urgent-handler rename, #96, **user decision**, see resolved question 39: `fooAction` always means
a transition, the urgent lane is `on<State>Change: UrgentChangeHandler` in 2.1, 2.6, 3.2, 9.4 and
10.1, the type guard in 10.1; `docs/vision.md` principle 3 names the exception; amended
2026-10-24 with the wave 16 refactoring fold, #100: `disabledButton` in 1.2, the two-channel
capture in 2.4 and 3.4, the production-bundle rule for development text in 7.2, the shared
control hooks in 3.8, the `internal/` layout in 9.1, the cross-channel row in 10.1, the
shipped-CSS modules in 12).
Binding for every component design in
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
| 2 | Action props | `<state>ChangeAction` for state changes (`pressedChangeAction`, `valueChangeAction`), bare `action` for pure triggers. Signature `(next, details)`; sync or async; the library `await`s it inside the state owner's `useTransition`. Errors go to the nearest Error Boundary. A pure trigger ignores activation while its own action is pending and renders `aria-disabled="true"` meanwhile (#79). **`fooAction` always means a handler the component runs in a transition**; no `on*` handlers in the library API except the urgent lane's `on<State>Change` (row 11, #96). A continuous control adds `<state>CommitAction` once per gesture (Slider). A component whose input is a command rather than an interaction (Toast) exports a function next to its namespace (`toast`), never a handler. |
| 3 | State model | `x` / `defaultX` / `xChangeAction`. The state owner holds committed state, optimistic state (`useOptimistic`, reducer form) and the transition. **Trigger parts render optimistic state; content regions render committed state.** Uncontrolled state is committed after the action resolves; the latest dispatched action wins. "Transition by default" applies to library-owned state; browser-owned state (top layer, `<details open>`) is observed, not driven. |
| 4 | Exposure | One vocabulary in three forms: `data-pending` / `state.pending` / docs. Booleans by attribute presence. Hover/focus/active come from CSS pseudo-classes, not attributes. |
| 5 | ViewTransition | An animatable part renders `<ViewTransition default={transition}>` as its outermost node **only when `transition` is given**; with the prop absent it renders no boundary, because react-dom starts a document view transition for any boundary that mounts or is revealed in a transition commit, whatever `"none"` says (#35). `transition` forwards React's own `default` shape and is static. For a top-layer part the boundary wraps **the top-layer element itself**, so a library-driven `showPopover()` / `hidePopover()` in a layout effect animates enter and exit in every engine (#38). Library adds `fsui-<component>[-<change>]` transition types. Reduced motion handled in CSS. |
| 6 | Suspense | Consumers own Suspense boundaries. Library content regions are keyed off committed state so suspending children keep the old UI and show as `data-pending`. |
| 7 | RSC and platform attributes | `"use client"` per source file; unbundled build (`tsdown` `unbundle: true`, verified to keep the directive); "JS-free" means no behaviour JS runs for the interaction and the markup works before hydration (the `<details>` Accordion); whether a part file is directive-free is a per-component fact recorded in its design doc, and none of the initial four has one. **#19 resolved 2026-10-23 (user decision, option A of `docs/research/zero-js-variants.md` 5): no second, directive-free anatomy; "JS-free" means no behaviour JS on the native path and works before and without hydration, never "no client bundle"** (7.3; resolved question 38). Attributes react-dom cannot express use lowercase pass-through, one module augmentation file, and a ref-based upgrade for `hidden="until-found"`. |
| 8 | Experimental | `experimental_<feature>` props on the part that uses the feature (first customers: `popover="hint"`, `interestfor`, `focusgroup`, `interpolate-size`, `closedby`, customizable `<select>`); whole components that cannot exist without a flagged feature ship from `@funstack/ui/experimental`. No provider. |
| 9 | Layout | `src/<component>/` folders, kebab-case files, `index.ts` per component without a directive. Root entry plus per-component subpaths (`@funstack/ui/tabs`). Flat public type names (`TabsTabProps`, `TabsTabState`). |
| 10 | Tests | Every component test file covers: ARIA/roles, keyboard, sync action, async action with `data-pending`, optimistic + rollback, overlapping actions, suspending content, controlled/uncontrolled parity, `render`/function props. Shared helpers in `src/__tests__/helpers.tsx`. |
| 11 | Urgent lane and strings | An urgent state React requires (a controlled text input) keeps `x` / `defaultX` and takes a **handler**, `on<State>Change: UrgentChangeHandler` (sync, outside any transition, not awaited; Combobox's `onInputValueChange`): the one `on*` prop form in the library, named as a handler precisely because it is not an action (#96, **user decision 2026-10-23**; before that `inputValueChangeAction: UrgentChangeAction`). A state that is urgent **by design** (the Toast queue) is written through an imperative command dispatched from a microtask (section 2.6); a **mirror of a browser-owned validity fact** (`:user-invalid`, `validity`, Field) is urgent as well, with no consumer-facing action. Built-in UI strings are English defaults, always overridable through a function prop (section 11). |
| 12 | Anchored placement | Top-layer popups are placed by CSS Anchor Positioning through one shared helper (`internal/anchor-position.ts`): `side` is physical (`top` / `bottom` / `left` / `right`) or inline-logical (`inline-start` / `inline-end`, through `self-x-*`), `align` `start` / `end` is **inline-relative** on a horizontal side (`span-self-x-*`) and physical on a vertical one; **never a plain logical keyword** (it resolves against the root, not the popup's container) and **never a JS direction read to pick keywords**. `data-side` / `data-align` / `state.side` / `state.align` are the **resolved** placement while the popup is shown, read from `getComputedStyle(popup).positionArea` by a shared observer (`internal/use-resolved-placement.ts`), and the requested values otherwise. A point-placed popup (no anchor) reads the popup's computed `direction` once per open to mirror its insets (section 13, wave 11: #20, #53, #88). |
| 13 | Shipped CSS and CSP | Shipped functional CSS (section 12) may, besides selector-less at-rules, carry a rule whose selector matches only elements the library marks (`[data-fsui-…]`) and that sets only a `--fsui-` custom property (Tooltip's skip-delay, #21; **user decision 2026-10-23**: shipped CSS widens from "positioning only" to "placement and interaction timing, never visuals"). A client-inserted `<style>` is **not** covered by the directive that allows inline `style` attributes: the library exports the SHA-256 of every shipped stylesheet (`@funstack/ui/csp`, `STYLE_SHA256`) for hash-based policies and one provider, `<CSPProvider nonce>`, for nonce-based ones, read by every part that renders a hoisted `<style>` (wave 11, #88). |

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

A component whose **input is a command rather than an interaction** exports a plain function
next to its namespace, from the same subpath: `toast()` and `createToastManager()` beside
`Toast.Viewport` / `Toast.Root` / … (Toast, #54). The namespace object stays parts-only, and the
function is never a handler: it enqueues, and the parts render what was enqueued.

Single-element components are plain components, no `.Root`:

```tsx
import { Toggle } from "@funstack/ui/toggle";

<Toggle pressedChangeAction={setFavorite}>Favorite</Toggle>
```

Part vocabulary (reuse these names; invent a new one only when none fits):

| Part | Meaning | Default element |
| --- | --- | --- |
| `Root` | Owns state, context and the transition. May render no DOM (overlays) or a wrapper; a Root that owns a form value but no visible element may render exactly one `<input type="hidden">` when `name` is given (Combobox); a Form's Root is the `<form>` itself; NumberField's is a `div[role=group]` (#67). | `div` / `form` or none |
| `List` | Groups triggers; owns keyboard navigation between them. In Combobox it is the ARIA `listbox` inside the `Popup` (the Popup is the container, because a listbox may contain only options and groups). | `div` |
| `Item` | One entry in a multi-item component (Accordion, Menu). Menu's is a `button[role=menuitem]` with an `action`; ToggleGroup's is a `button[aria-pressed]`, the Toggle element, whose pressed state is the Root's (#66). | `div` / `details` / `button` |
| `Trigger` / `Tab` | The interactive element the user acts on. | `button` |
| `ContextTrigger` | A region whose `contextmenu` (right-click, Ctrl+click, Shift+F10 / the ContextMenu key at a focused descendant, a library long-press for touch) opens the owner's `Popup` at the pointer (Menu, #45). A plain element with **no role and no ARIA** (`aria-haspopup` is not allowed on generic roles and ARIA has no attribute for "has a context menu"); `data-open` / `data-pending` / `data-disabled`. May share a Root with a `Trigger` (a "More" button and a right-click region opening one popup). | `div` |
| `Panel` | Content region whose visibility is driven by library state (Tabs, Accordion). | `div` |
| `Popup` | Content that lives in the top layer (Tooltip, Popover, Menu). | `div[popover]` (Tooltip, Menu) or `dialog[popover]` (Popover) |
| `Indicator` | Purely visual element that tracks state (active tab marker; the fill of a Slider, placed by the consumer's CSS from the Root's `--slider-start` / `--slider-end`; the fill of a Progress / Meter, sized by the consumer's CSS from the Root's `--progress-value` / `--meter-value`, #68). | `span` |
| `Label` | Names the owner. For `<fieldset>`-based groups (RadioGroup, CheckboxGroup) it renders `<legend>` and must be the Root's first child; for a component whose owner surface is an `Input` part (Combobox) it renders `<label for>`; for Slider it renders `label[for]` naming the only Thumb's input, or `label[id]` naming a multi-thumb Root (`role="group"`); for Field it renders `label[for]` naming the field's control, or `label[id]` that a group control (a `<fieldset>` Root) is `aria-labelledby` (the `for` is dropped once such a control registers); for NumberField it renders `label[for]` naming the visible input and its id names the Root group (#67); for an output role that is not labelable (Progress, Meter) it renders `span[id]` and the Root references the id through `aria-labelledby` unconditionally, dangling when no Label is rendered (#68). | `label` / `legend` / `span` |
| `Input` | The text field of a combobox-like component: `input[role=combobox]`, the owner's surface for `data-pending`, with the urgent `inputValue` state (section 2.6); or the visible text field of a NumberField (`input[type=text][inputmode]`, the owner surface for `data-pending`, with the urgent draft text), which renders the hidden native number input right after it (#67). | `input` |
| `Parent` | A mixed-state checkbox that controls a subset of a CheckboxGroup (`values`): its checked/mixed state is derived from the group's optimistic set and its click dispatches for the whole subset. Never submitted (no `name`). | `input[type=checkbox]` |
| `Option` | One choice in a native `<select>` (Select; renders optimistic `data-selected`, equal to the platform's `:checked`) or in a listbox (Combobox: `div[role=option]`, never focused, `data-active` for virtual focus). | `option` / `div` |
| `Clear` | A `tabindex="-1"` button that empties a text field and dispatches the empty selection (Combobox). | `button` |
| `Empty` | Content the **library** shows only when a list has no mounted options and its results are neither stale nor loading (Combobox). | `div` |
| `Status` | A loading fallback or hint inside a popup (Combobox). Outside the `List` it is `role="status"`; **inside** the `List` it is the Suspense fallback, renders `role="none"` (a listbox may own only options and groups) and marks the list as loading: `aria-busy="true"` on the listbox, `Empty` hidden, nothing announced. | `div` |
| `Value` | The element that shows the current value. Select: the element the browser fills with the selected option's content; it has **no `children` prop**, since the parser and the browser write its content, so the part renders it with the hydration pattern of section 7.4. Slider: a `span` rendering the shown value (`children(state)`, or one thumb's value by `index`). Progress / Meter: a `span`, `aria-hidden` by default (the same text is in `aria-valuetext`), showing `formattedValue` (#68). | `selectedcontent` / `span` |
| `Track` | The rail a slider's thumbs move along; owns pointer interaction (a press moves the nearest thumb) and is the geometry reference for pointer math. For Progress / Meter: the rail of the bar, with no interaction (#68). | `div` |
| `Thumb` | A draggable value handle (Slider, one per value, explicit `index`): a styled element **containing** a visually hidden native `<input type="range">`, which is the focusable, labelled, form-participating `slider`. | `span` + `input[type=range]` |
| `Increment` / `Decrement` | `button[type=button][tabindex=-1]` that steps a numeric value, with press-and-hold (NumberField); `aria-controls` → the field's input; natively `disabled` when the next step would change nothing (#67). | `button` |
| `Form` | A form whose successful submission completes the component's interaction (Dialog). | `form` |
| `Control` | The native form control a Field labels and describes: an `input`, or a `textarea` / `select` through `render`; must stay a native control. Any FUNSTACK form control inside a `Field.Root` plays the same role through `useFieldControl` (section 3.8). | `input` |
| `Description` | Describes the owner through `aria-describedby`: a `p[id]` the control (Field) or the `<dialog>` (Dialog) always references, mounted or not (a dangling reference is skipped). | `p` |
| `Error` | The message for a Field's current constraint violation: `div[id]`, rendered only while an error is shown, referenced through `aria-describedby` while it is; no live region, no `role`. | `div` |
| `Submit` | A form's submit button with the form channel's `data-pending` (`useFormStatus`). | `button[type=submit]` |
| `GroupLabel` | Names a `Group` (or a `RadioGroup` in Menu): an element with an id the group references through `aria-labelledby`. Not `Label`, which names the component's owner. | `div` |
| `Button` | A pure-trigger `button` with a bare `action` and its own `data-pending` (`useActionTrigger`). The general one is the single-element `Button` (`@funstack/ui/button`, #79): `type="button"` by default (`"submit"` with `formAction`), ignores activation while its own action is pending (`aria-disabled="true"` meanwhile), and reads `ToolbarContext` so that inside a Toolbar `disabled` renders `aria-disabled` and keeps the button focusable, as the APG Toolbar example wants (#66). It **replaces `Toolbar.Button`** (removed with #79, user decision): a Toolbar's command button is a `Button`. | `button` |
| `Header`, `Group`, `Separator`, `Arrow` | Structural or decorative. `Separator` is an `<hr>` by default (implicit `separator` role); inside a Toolbar it carries `aria-orientation` perpendicular to the toolbar's (`Toolbar.Separator`, #66). | as named |

There is deliberately **no `Portal` and no `Positioner` part**: the Popover API puts content in the
top layer and CSS Anchor Positioning places it, so the platform does both jobs (see
`docs/research/popover-anchor-tooltip.md`).

Each part renders at most one DOM element. Parts never render wrapper elements the consumer did
not ask for; this is also what keeps `<ViewTransition>` "before any DOM node" (section 5).
One exception (Slider, #54): a part whose platform control cannot be its styled element renders
the control as a **visually hidden child** of its one styled element (`Slider.Thumb`): `ref`
goes to the styled element, a documented `inputRef` to the control, and the props the control
needs (`name`, `form`, the `aria-label` / `aria-labelledby` / `aria-describedby` trio) are
listed as forwarded to it rather than landing on the styled element.
A second exception (NumberField, #67): a part whose user surface is itself a native input and
whose form control must be a different element renders the control as a **visually hidden
sibling immediately after it** (`NumberField.Input`): `ref` goes to the visible input, a
documented `hiddenInputRef` to the control, and the props the control needs (`name`, `form`,
`min`, `max`, `step`, `required`) are listed as forwarded to it.

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
  `.form` depend on it), and Select's parts must keep their native elements (`Root` a
  `<select>`, `Trigger` a `<button>`, `Value` a `<selectedcontent>`, `Option` an `<option>`,
  `Group` an `<optgroup>`; the parser, the picker and `<selectedcontent>` cloning key on the
  element): `render` may substitute a styled element or a wrapper component that
  renders one, never a `<button>` or `<div>`. The shared hook warns in development when the
  mounted node has the wrong tag or `type`. The input is a void element, so it
  has no children; visual indicators are **sibling parts** (`Indicator`) that receive the same
  state attributes. Replacing the element would lose form participation, validation, reset, label
  activation, native radio keyboard handling and RTL mirroring (`docs/research/form-controls.md`).
- Field and Form (#54): `Field.Control` must stay a native form control (`input`, `textarea`,
  `select`), `Field.Label` a `<label>`, `Form.Root` a `<form>`, `Form.Submit` a submitter (a
  `<button>` or `<input type="submit">`). Inside a `Field.Root`, a control's `id` is **owned by
  the Field** (the Label's `for` must point at it; a consumer `id` on the control warns).
- `className`: the library's and the element's are concatenated. `style`: merged, element wins.
- Event handlers the library installs (for example `onClick` on a `Tab`): both run, the element's
  first, then the library's. v0 provides no way to cancel the library's handler from there.
- Element-type-specific attributes are set only when they apply to the rendered element:
  `type="button"` is emitted for a `<button>` and omitted for `render={<a href />}` or any other
  **host** element, rather than landing as a meaningless attribute on an anchor. A **component**
  `render` element (`render={<MyButton />}`) receives `type` too (Button review, #79): the part
  cannot see what it renders, a missing `type` on a component that renders a `<button>` inside a
  form is a silent submit, and an ignored `type` on one that renders a link is harmless. The
  shared predicate is `rendersButton(render)` (`internal/render-element.ts`): `true` for no
  `render`, the function form, a host `"button"` and any component element. The same rule the
  other way for `disabled`: a part whose rendered element is not a **host** `<button>` (link or
  component; `isHostButton(render)`) renders `aria-disabled="true"` instead of native `disabled`,
  which means nothing on a link and would expose an enabled link to assistive technology
  (`Button`, #79; with #83, wave 9, every part that owns `disabled`, accepts an arbitrary
  `render` **and installs its own click handler**: Toggle, ToggleGroup.Item, Menu.Trigger,
  Combobox.Trigger / Clear, NumberField.Increment / Decrement, and the Close and Trigger parts of
  Dialog and Popover in the modes where they handle the click; `design/components/button.md`
  17.1). The handler is what makes `aria-disabled` safe (it returns before dispatch and
  `preventDefault()`s), so a part that relies on the browser (`Form.Submit`, a JS-free command
  Trigger / Close) keeps native `disabled`. In that `aria-disabled` branch an **invoker also
  owns `commandfor` and `command` as `undefined`** (wave 9 review M1): `aria-disabled` has no
  behaviour, and a disabled component render spreading onto a real `<button commandfor
  command>` would otherwise be a live invoker in the server HTML before hydration. The part owns
  `aria-disabled` only where it computes it (that branch, or a pending pure trigger); on a host
  button outside it the consumer's own `aria-disabled` passes through. When the element is
  unknown, each attribute takes the choice that is harmless if the guess is wrong.
  One helper implements the rule for every such part: `disabledButton(render, disabled, {
  handlesClick?, alwaysFocusable? })` in `internal/render-element.ts` returns `props`, the
  owned `disabled` / `aria-disabled` keys of the branch it chose, and `invoker`, whether
  `commandfor` / `command` may render; `handlesClick: false` is the browser-handled case
  above and `alwaysFocusable` the APG focusable-disabled case (`SubmenuTrigger` through
  `usePopoverTrigger`'s `disabledAs: "aria"`). `Button` keeps its own expression because
  `focusableWhenDisabled` and a Toolbar widen its focusable branch.
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
| Commit of a continuous state | `<state>CommitAction` | `(next, details)` | `valueCommitAction` (Slider): once per gesture (pointer release, key press, platform change), awaited in the owner's transition like a change action; the step action `<state>ChangeAction` runs per step. For a continuous control the commit action is the state owner's dispatch (section 3.3). |
| Other notification | `<event>Action` | `(details)` | reserved; add only when a component needs one |
| Urgent handler (React forbids a transition) | `on<State>Change` | `(next, details) => void` | `onInputValueChange` (Combobox): a controlled text input's text. **Not an action**: called synchronously in the DOM event, outside any transition, not awaited (section 2.6). The only `on*` form the library defines. |

The state name in `<state>ChangeAction` is exactly the controlled prop's name, so the three props
of a controllable state always read as a set: `pressed` / `defaultPressed` /
`pressedChangeAction`. This mirrors the `on<State>Change` convention consumers already know from
Radix and Base UI, with the React docs' `Action` suffix.

**The suffix is the contract** (#96): a prop named `action` or `<anything>Action` is **always**
a handler the component runs in a transition, sync or async, awaited, with pending state. A
reader who sees `Action` may rely on that without opening the type. The converse holds too:
the rare handler React requires to be synchronous (a controlled text input's text) is **not**
an action and is therefore not named like one; it takes the ordinary handler name
`on<State>Change`, so the name itself says "this runs in the event". `x` / `defaultX` are
unchanged for such a state, so the triple reads `inputValue` / `defaultInputValue` /
`onInputValueChange`.

Every component has **no `on*` props of its own** beyond that urgent handler. The library never
names a prop `onClick`, `onChange`, `onOpenChange`, or any other `on*`; a new `on<State>Change`
needs a React-imposed urgency the component's design doc cites, and a conventions amendment.

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
export type ChangeReason = "activate" | "platform" | "dismiss" | "timeout";
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
| `"dismiss"` | The user closed the component **without acting on one of its parts**: Escape, Android back, an assistive-technology dismiss gesture, light dismiss (outside click); also a close no user caused through this component: script calling `hidePopover()`, another top-layer element (an unrelated `auto` popover, a modal dialog) hiding the popover, focus leaving the component (Tab out of a menu), a right- or middle-click outside a menu (the library's own immediate close, since click-based light dismiss ignores those buttons; Menu #45), the pointer leaving a hover-opened submenu, or a parent overlay closing (a submenu when its menu closes). A close through a part **that carries a decision** (`Dialog.Close`, a Form submit) is `"activate"`; `Toast.Close`, which only ever means "go away" (the same as Escape), is `"dismiss"`, so a toast's `closeAction` can tell "acted on the content" (its Action part, `"activate"`) from everything else. | The platform's `close` or `toggle` event; the click or keydown for Toast. |
| `"timeout"` | The library's own timer closed the component: no user gesture and no platform event. Toast's auto-dismiss is the only user; the Undo-window pattern (`design/components/toast.md` 9.3) relies on it being distinct from `"dismiss"`. | `undefined` |

Components whose close carries a platform result add it as a serialisable field next to
`reason`: Dialog's `details.returnValue` is `dialog.returnValue` (the `value` of the Close button
or form submitter, or the string passed to `requestClose()`), `undefined` on open.

Components with a **set-valued state** describe what changed as a diff, `added: readonly
string[]` and `removed: readonly string[]` (CheckboxGroup), so that one shape covers a single
item, a multi-item trigger and a platform path, and a controlled "update on success" parent can
apply it as a functional update instead of writing the whole set (section 2.5). Accordion's
earlier `item` / `open` pair stays as is; a new set-valued component uses the diff form.

Adding a value is a change to this document, not to one component (`"dismiss"` was added
2026-10-16 for Dialog; Popover and Menu reuse it; `"timeout"` was added 2026-10-18 for Toast). The first argument is always the next value, so the
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
   `command`) keys the warning on its own flag, not on `defaultPrevented`. A **pure trigger**
   (`Button`, #79) does not read `defaultPrevented` at all: an outer part that renders it
   (`Dialog.Trigger render={<Button />}`) cancels the click as part of its own mechanism before the
   trigger's handler runs, there is no DOM state a cancelled click reverts, and the action must
   still run. Vetoing is done with
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
   A continuous control (Slider) produces many steps per gesture, so its design says which of
   its actions may be slow (the commit, `valueCommitAction`) and which must stay cheap (the
   step, `valueChangeAction`: adopt the value, start a deferred render); a network call per
   step would start dozens of entangled actions.
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
9. **Parts are never natively disabled while pending.** A pure trigger ignores re-entry while its
   own action is pending and says so with `aria-disabled="true"` (sections 2.5 and 3.6, #79).

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
- The catch-store-throw lives in one hook, `useSupersededRejection()`
  (`internal/use-superseded-rejection.ts`), which `useControllableAction` and
  `useActionTrigger` call themselves. A component with **two transition channels** (Slider
  and NumberField: steps through `useActionTrigger`, commits through
  `useControllableAction`) calls it once, **before both hooks**, and passes the result as
  `captureSuperseded` to both. React retries an errored render with every pending lane, and in
  that retry a `useTransition` whose action still pends suspends; a rejection thrown after the
  other channel's `useTransition` would therefore wait for that channel's action to settle.
  One capture ahead of both transitions reaches the boundary promptly whichever channel
  rejected (pinned per component, section 10.1).

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
- **Pure triggers ignore re-entry** (product-owner decision with Button, #79). A part with a bare
  `action` and no value has nothing for "latest intent wins" to protect: a second activation
  while its action is pending would run the side effect twice (every component library with a
  pending button blocks it; only React's primitives run concurrently, and React points to
  `useActionState` for ordering). So a click, Enter or Space on a pure trigger whose own action
  is in flight starts nothing and is `preventDefault()`ed (a `render`ed link does not navigate
  again, a `formAction` does not submit again, a `command` does not run again); other listeners
  (focus, hover, the consumer's pass-through handlers) are untouched. The guard reads **only** a
  synchronous in-flight counter in `useActionTrigger` (so two activations in one task are caught),
  never the last render's `pending`: after the action settled, React may hold the commit that
  clears `pending` for as long as any other async action is pending (entanglement, 2.3 item 5)
  or while the resulting render suspends, and a click in that window starts a new run rather
  than being dropped (the review's probe showed a rendered-`pending` guard losing two of three
  clicks on a non-awaiting action; `design/components/button.md` 5.2). The trigger renders
  `aria-disabled="true"` while it is pending (section 3.6), which may outlast the guard by the
  held window. A consumer who wants every activation
  to count does not await the work (`action={() => { void inc(); }}`, item 5 of 2.3), which ends
  `pending` at once; an ordered sequence is `useActionState`. No opt-out prop. **Rollout**: the
  guard is `useActionTrigger`'s `ignoreWhilePending` option (3.4), on for `Button` in #79;
  with wave 9 (#81, `design/components/button.md` 16) `Dialog.Close`, `Popover.Close`,
  `Menu.Item` and `Toast.Action` are guarded too and the guard is the hook's **default**; the
  two continuous controls that run their *steps* through the hook (`Slider.Root`,
  `NumberField.Root`) opt out explicitly, because every step must run. `Form.Submit` is not a
  pure trigger (its pending is the form's, 2.7) and is never guarded. A state owner (Toggle,
  Tabs, the Menu checkbox / radio items) is not a pure trigger either: latest intent wins there.
- Consumers who need abort semantics implement them in the action (`AbortController` captured in
  a ref); the library passes no signal in v0.
- **Overlap never includes user input.** An action that awaits a promise another user action is
  supposed to resolve cannot overlap with it: the second action's transition is held by the
  first (section 2.3 item 6). Design flows as independent dispatches.

### 2.6 The "no handlers" rule and urgent updates

The library offers **action props**, which are always transitions. There is no `onClick`, no
`onPress`, no `onChange`; the one handler-shaped prop is the urgent lane's `on<State>Change`
below, and it is the one *because* it is not a transition.

What is still reachable, and why it is not a contradiction:

- Native DOM event props the part does not itself use pass through to the element (section 1.5).
  They are the platform's, not ours, and are typed as the element's props.
- `ref` gives the element for `addEventListener` when a component needs an event React does not
  synthesize (`command`, `beforematch`).

**Urgent (non-transition) updates: the urgent lane** (designed with Combobox, #50, resolved
question 27; renamed by the user, #96, resolved question 39; the vision's documented opt-out).
A state that React requires to be urgent, which today means the text of a controlled text input
("Transition updates can't be used to control text inputs"), keeps `x` / `defaultX` and takes
a **handler** instead of an action: `inputValue` / `defaultInputValue` / `onInputValueChange`.
The handler is named with the ordinary React `on<State>Change` form, and the type says the same
thing:

```ts
/** Called synchronously, outside any Transition, and not awaited: the urgent lane. Not an action. */
export type UrgentChangeHandler<T, Details extends ActionDetails = ActionDetails> = (next: T, details: Details) => void;
```

Why a handler name and not `inputValueChangeAction: UrgentChangeAction` (the v1 shape, #50):
`Action` is the library's promise that the component wraps the prop in a transition, awaits it
and exposes pending state. A prop that does none of that and carries the suffix anyway makes
the suffix mean "some callback", and the one thing the vision's principle 3 cannot afford is a
reader having to open the type to learn whether an action is a transition. The urgent lane is
exactly the thing an action is not, so it gets exactly the name an action does not: the `on*`
form the rest of the library reserves. The cost, one `on*` prop in the whole API that a
consumer might copy, is bounded by the rule that a new `on<State>Change` needs a React-imposed
urgency the design doc cites (2.1) and by the type guard (10.1, "Action naming").

Rules: the library sets its own `useState` for the value and calls the handler synchronously
from the DOM event (and from its own documented writes), never inside `startTransition`, so a
controlled parent's `setState` in the body is an urgent update; nothing is awaited, pending or
optimistic for it (the DOM already holds the value; a returned thenable is a dev warning,
because the author probably wanted an action);
a controlled urgent prop follows the DOM and does not gate it; everything the urgent value
drives (a deferred query through `useDeferredValue`, an open, a selection) leaves the urgent
lane at once and is a transition or a deferred render. A library write to an urgent state that
follows a **rejected transition action** (Combobox's text rollback) leaves the transition before
writing: an action that throws *synchronously* makes the wrapper's `catch` run inside the
`startTransition` callback, so the wrapper yields once (`await undefined`) before the write and
the rethrow (Combobox review, M2). The library uses the lane only where React requires it;
"transition by default" is unchanged for every other state. Component docs name each urgent
state. Consumers who need an urgent update from an interaction that has no urgent handler still
use pass-through or `ref`, unsupported as before.

**A state that is urgent by design: the Toast queue** (third urgent state, Toast #54). A toast
reports on an action that is pending elsewhere; a transition push would be held by that very
action (2.3 item 5), so every queue mutation (add, update, dismiss, drop after exit) is a normal
update. Its input is not a prop at all: the imperative `toast()` builds a command and dispatches
it from a `queueMicrotask` callback, so a call made inside a `startTransition` scope (an action's
sync prefix) escapes the scope while order is preserved; the Viewport applies the command with
`useState`. Everything the toast *drives* (its Action part's action, its `closeAction`) is a
transition as usual. Such a state has no `UrgentChangeHandler` prop and no `x` / `defaultX`
pair, and its commits never run a view transition (5.1).

The same rule holds for **consumer state that reports on a pending action** (a progress value,
Progress #68): it is written with a plain `setState`, which after an `await` inside the action is
urgent anyway; wrapping it in `startTransition` holds it until the very action it reports on
settles (2.3 item 5), so the bar would sit at 0% and jump to 100%. It is the one place the
library's "wrap it in `startTransition`" advice inverts, and component docs that display such a
value (Progress) say so.

**A mirror of a browser-owned validity fact** (fourth urgent state, Field #54). `Field.Root`
reads `:user-invalid`, `validity` and `validationMessage` from its control on `input`, `change`,
`focusout`, `invalid` and after `reset`, and writes them with `useState` from the DOM event,
never inside `startTransition`: the DOM already holds the fact, nothing is awaited or optimistic,
and the error element and its `aria-describedby` token must be in the DOM when the library
focuses the first invalid control a microtask later (a transition commit would land after the
focus move, and later still while any async action is pending). No consumer-facing urgent
action, no `x` / `defaultX` triple, no `transition` prop (`design/components/field-form.md` 2.4).

**The draft text of a NumberField** (fifth urgent state, #67) is internal: written from the
`input` event with `useState`, with no `UrgentChangeHandler` and no `x` / `defaultX` pair,
because the text is not a value until it is parsed at commit (blur, Enter, or before a step).
The value under a held `Increment` / `Decrement` button follows Slider's `live` rule (3.2).

### 2.7 Form-level actions are a separate channel

`<form action>`, `useFormStatus` and React's automatic form reset are React's form channel. A
control's `<state>ChangeAction` is per-control and runs in the control's own transition. The two
are independent and the library does not couple them:

- A control inside `<form action={serverFn}>` with no change action is an uncontrolled native
  input that posts `name=value` with the form; `useFormStatus().pending` covers the submit.
- A control **must not** fold `useFormStatus` into its own `pending`: that would mark every
  control in the form pending during a submit. A consumer who wants that reads `useFormStatus`
  in their own `className` function or styles `form:has(...)`. A part that **has no action of
  its own** may expose the form channel's pending as its `pending`: `Field.Root`, `Form.Root`
  and `Form.Submit` (#54) do, and a control inside a Field keeps its own `data-pending` for its
  own action, so the two meanings never share an element. A part with its **own** function
  `formAction` (`Button`, #79) may expose the channel's pending **for its own submissions only**:
  `useFormStatus().action` is the submitter's function, so `status.pending && status.action ===
  formAction` is this submitter's pending and no other's (the third and last allowed reading of
  the channel; a plain `type="submit"` button with no `formAction` reads nothing).
- A part may **observe** the form channel to perform a platform side effect after a successful
  action (`Dialog.Form` closes the dialog once the action's transition settles); it never wraps
  the action (so a Server Function keeps progressive enhancement) and never reports form pending
  as its own `pending`. `Form.Root` (#54) goes one step further while keeping both properties:
  it renders a function `action` **unwrapped** on the element and, after hydration, runs it
  itself from `onSubmit` (`preventDefault()` + its own `useTransition`); react-dom then skips its
  own action run and its automatic reset but still starts the form's pending status, so
  `useFormStatus` readers are unaffected, and the reset becomes `autoReset` (a settle with no
  errors). A submitter with its own `formaction` and a string `action` stay on React's / the
  browser's path.
- Field errors an action returns reach fields through `Form.Root errors`, keyed by field `name`
  (`useActionState`'s result in the common case). The library never interprets an action's
  return value, so a result is visible to Fields only through that prop.
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

One accepted exception (Select, #50): `Select.Root`'s `value` is `string`, with `""` for the
placeholder option. A single `<select>` has no empty state other than an option (`select.value`
is always a string) and `""` is what `required` validates against, so `null` would be a second
spelling of the same DOM state. With neither `value` nor `defaultValue` the Select adopts the
browser's own default (the first enabled option) at mount without a dispatch and without a
warning (`design/components/select.md` 5).

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
| urgent (`inputValue`, the active option of a listbox) | `useState`, written from the DOM event; reported through an `on<State>Change` handler, not an action (section 2.6) | sync, urgent | the controlled text input; `aria-activedescendant` and `data-active` |
| urgent, internal (the value a slider gesture has reached, `live`; NumberField's draft text and the value under its held button, #67) | `useState`, written from the pointer or `input` event; no consumer-facing urgent action | sync, urgent | the thumbs, while a pointer is captured or a step or commit is in flight (`held`); otherwise they render `optimistic` (Slider 2.2) |

**Virtual focus is urgent library state.** Where a pattern keeps DOM focus on one element and
moves focus virtually with `aria-activedescendant` (Combobox), the active item is a plain
`useState`, never a transition and never a dispatch: it is focus, which is immediate and
browser-owned everywhere else in the library, and a transition would freeze it while any async
action is pending (entanglement, section 2.3 item 5).

**A roving Tab stop over children the library did not render is urgent library state that lives
outside React** (Toolbar and a standalone ToggleGroup, #66): which item carries `tabindex="0"` is a
focus fact, not a value, so it is a ref updated from `focusin` / `focusout` / `pointerdown` and
re-derived in layout effects, and the attribute is written through the DOM by the container's engine (section
7.4), never rendered by the items. No `useState`, no transition, no `data-*` attribute.

**The position under a captured pointer is urgent library state** (Slider, #54), for the same
reason: `useOptimistic` holds a value only while a transition is pending, and a step whose
action is synchronous settles in a microtask, so between two pointer moves the thumb would
revert to the committed value. The component keeps the gesture's value in a plain `useState`
and renders it while a pointer is captured or any of its dispatches is in flight, else the
optimistic value; the consumer-facing actions stay transitions.

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

For a continuous control (Slider) "the action" is the gesture's **commit** action: steps
(`valueChangeAction`) write no uncontrolled state, the commit's resolution does, so a rejected
save rolls the whole gesture back, and a controlled parent gets the same by adopting on commit
success. The step channel is told of the revert with one `"dismiss"` dispatch in uncontrolled
mode (Slider 2.4).

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

The sketch's `supersededError` state is `useSupersededRejection()` in the implementation
(section 2.4). The hook calls it itself unless the component passes its own through the
`captureSuperseded` option, which Slider and NumberField do with one capture ahead of both
their channels.

The reducer form of `useOptimistic` is mandatory so that stacked optimistic updates are re-based
onto a changed `committed` value. For single-value states the reducer is `(_, next) => next`;
multi-item states (Accordion's expanded set) use a real reducer keyed by item.

Library state never lives in `useSyncExternalStore`: a store mutation during a transition forces a
blocking re-render and defeats both fallback avoidance and ViewTransition. Reading
`matchMedia` for display only is fine.

**Pure-trigger parts share `useActionTrigger`** (decided with Menu, #39; landed with #41 in
`packages/ui/src/internal/use-action-trigger.ts`): a part with a bare `action` and its own
transition but no state (`Dialog.Close`, `Popover.Close`, `Menu.Item`) runs the action through
this hook instead of calling `useTransition` itself:

```ts
const { pending, run } = useActionTrigger({ openGeneration, ignoreWhilePending }); // both optional
const started = run(() => action?.(details), () => close()); // `then` runs inside the same transition once `work` resolved
if (!started) event.preventDefault();                        // ignored while pending (2.5)
```

- `pending` is the part's own transition (`data-pending` on the button or item).
- `ignoreWhilePending` (#79): `run` returns `false` and starts nothing while a run is in flight,
  judged by the hook's synchronous in-flight counter alone, not the last render's `pending`
  (section 2.5). **Default `true`** since #81 (`design/components/button.md` 16.2); a continuous
  control that runs steps through the hook passes `ignoreWhilePending: false` (Slider,
  NumberField). The options object is the only form (`{ openGeneration?, ignoreWhilePending?,
  captureSuperseded? }`; the last is section 2.4's two-channel capture).
- A rejection skips `then`. The latest run's rejection takes React's route to the boundary above
  the part; an older run's rejection (the part was clicked again before the first settled) is
  caught, kept and thrown from the part's render before `useTransition` (the superseded-rejection
  surfacing of section 2.4), later ones go to `reportError`, and a rejection after the part
  unmounted is dropped.
- `then` still runs when the part unmounted meanwhile (an overlay's close must happen even though
  the part left with the content), so the only thing that cancels it is the **open-generation
  guard**: with `openGeneration` given, the hook reads the counter when `run` is called and skips
  `then` when it has changed by the time `work` resolved, which means the user dismissed and
  re-opened the overlay while the action ran and the close belongs to the earlier open (Popover
  3.4; product-owner decision). `Popover.Root`, `Dialog.Root` and `Menu.Root` all carry the
  counter.
- React entangles transitions with a pending async action: a re-open dispatched while a run is
  still pending commits only when the run settles. Documented per component (Popover 3.4, Menu
  12), not worked around.

### 3.5 Library-owned vs. browser-owned state

"Transition by default" is a statement about **library-owned state**: state that lives in React
and that the library changes in response to the user. Some state is **browser-owned** instead: a
popover's open state (top layer), `<details open>`, `<dialog open>`, a `<select>`'s value picked
through the native picker. The browser changes it before React hears about it, and no transition
can delay or roll it back. The boundary:

| | Library-owned | Browser-owned |
| --- | --- | --- |
| Examples | Toggle `pressed`, Tabs `value`, Accordion `value` in the JS variant | Tooltip/Popover `open`, `<details open>` in Accordion's static (JS-free) mode, `<dialog open>`; the Toast region (`popover="manual"`), which the library shows and hides in both directions, driven by the urgent queue, and never notifies: it has no `openChangeAction` because nothing a consumer could do with "the region opened" exists |
| Who changes it | The library, inside its transition | The browser (top layer, light dismiss, `interestfor`, find-in-page) |
| Optimistic source | `useOptimistic` | The DOM itself |
| `xChangeAction` | Can be awaited; the UI waits for it | Notification: dispatched from the platform event (`toggle`) inside a transition, after the fact |
| Controlled mode | React value is the source of truth | React value is re-applied to the DOM after the action resolves (`showPopover()` / `hidePopover()`, `open` attribute); it follows the browser, it does not gate it |
| Pending | `data-pending` while the action runs | `data-pending` while the notification action runs; the open/close itself is already done |
| Server Components | Only through Server Functions as actions | Uncontrolled form needs no behaviour JS; the part may still be a client module (section 7.3) |
| Residual browser path | A library-owned state the browser can also change is reconciled by dispatching the change with `details.reason: "platform"` and `event` set to the platform event (or `undefined` at mount), then re-applying committed state to the DOM after the action settles. Known paths: find-in-page revealing `<details>` or `hidden="until-found"`; **mount reconciliation** for pre-hydration clicks on `<summary>` or a native input, and for Firefox's form-state restoration of `checked` across reloads (react-dom keeps the DOM value when hydrating and fires no `onChange`), one dispatch per component or group; **form reset**, both an external `form.reset()` and React's automatic reset after a successful `<form action>` (`requestFormReset`), which restores controlled inputs to their mount-time default without telling React. Each native-input component listens to `reset` on `input.form` through its ref and, in a microtask after the reset, dispatches the new DOM value with `reason: "platform"` and `event` set to the `reset` event; **late-mounting options** in a `<select>` (Select) are never selected by React (`updateOptions` runs only in the select's own commit), so the Root re-applies the intended option when an Option reports its mount: an option that **hydrated** is reconciled first (a user may have picked it before hydration) and one React **created** is only re-applied (the browser's automatic first-option selection on insertion is not an intent), told apart by `useSyncExternalStore`'s server snapshot; and a platform dispatch on a `<select>` requires the **intended option to exist in the DOM**, so a value whose option is still loading is never "reconciled" to the fallback; **text typed into a controlled text input before hydration** (Combobox) is adopted at mount through the urgent action with `reason: "platform"` (react-dom keeps a hydrated text input's DOM value and fires no `onChange`), and **a value stepped into a native range before hydration** (Slider) the same way through its step + commit dispatch; **a controlled value input** (`type=text`, `type=range`, …) has no reset target of its own, because react-dom keeps its `value` attribute equal to the current value after every update, so the component writes the reset target into `defaultValue` synchronously in the `reset` event (`useFormReset`'s `onResetEvent`) and dispatches the JS-computed target (uncontrolled: the latest `defaultX`; controlled: the mount-time value) from the microtask (Combobox's text, Slider's thumbs); and a component that owns a form value with no visible form element of its own **mirrors the optimistic value into a hidden input** and listens to `reset` on it; a hidden input has **no reset behaviour** (its `.value` is the `value` attribute, which React keeps equal to the optimistic value), so the reset target is computed in JS (uncontrolled: the latest `defaultX`; controlled: the mount-time value) and dispatched from the `reset` microtask, while the visible text input's `defaultValue` mirror is written synchronously in the `reset` event itself, because react-dom syncs a text input's `defaultValue` attribute to its value after every keystroke (Combobox, `useFormReset`'s `onResetEvent`); a form `reset` also **clears the user-validity flag (`:user-invalid`) but not custom validity**, so `Field.Root` re-reads its validity mirror and recomputes its custom-validity slot in the reset microtask (Field #54); and **the settle of a form submission** (the `useFormStatus` `true → false` edge) is a form-channel event the library observes without owning: `Dialog.Form` closes on it, `Form.Root` advances its settle generation, focuses the first errored field and applies `autoReset` on it; **text typed into a NumberField's visible input before hydration** (#67) is parsed and dispatched as a `"platform"` step + commit at mount, or adopted as the draft when the input is still focused; and **a library-owned native input that is not the user's surface may be uncontrolled** (NumberField's hidden number input): its `defaultValue` prop is the reset target (uncontrolled: the latest `defaultX`; controlled: the mount-time value), which react-dom keeps in the `value` attribute and updates when the prop changes, its `.value` is written through the ref at every change and re-applied after every commit, so the platform's own reset applies to it and it needs no `onResetEvent` mirror (a controlled `value` would make react-dom rewrite the attribute on every update) | n/a |

Rules:

- A component prefers browser-owned state when the platform offers it (Popover API over a React
  `open` boolean, `<details>` over a JS disclosure). That is principle 5 of the vision, and it is
  the only way a primitive can be JS-free.
- A component never mirrors browser-owned state into React state as the source of truth. It reads
  the DOM (`matches(":popover-open")`, `details.open`) when it needs the value for attributes.
- `<ViewTransition>` does not apply to browser-owned open/close (the browser performs it outside
  a React transition). Those parts animate with `@starting-style` and
  `transition-behavior: allow-discrete` in CSS, and the component docs show the CSS. It **does**
  apply to a **library-driven** open or close of a top-layer element: when the part calls
  `showPopover()` / `hidePopover()` (or `showModal()` / `close()`) in a layout effect of a
  transition commit and the boundary wraps the top-layer element itself (section 5.1), both the
  enter and the exit are captured, in Firefox too, where CSS cannot animate a popover's exit
  (`docs/research/popover-menu.md`, "ViewTransition"). Popover was the first component to use
  this for its part-initiated closes (`design/components/popover.md` 2.3, 10.2); Dialog follows
  for its Close part, Form and controlled close (`design/components/dialog.md` 2.3, 10.3,
  amended for issue #46).
- Per-component designs list every state and label it library-owned or browser-owned.
- A library-driven **move** of a shown top-layer element (Menu's context menu re-opened at a
  new point, #45) is not a state change: no dispatch, the part re-shows the popover under its
  own "opening" flag so the coalesced `toggle` (`open` → `open`) notifies nothing, and the
  component doc says what else the move does (focus, pointer capture).
- **Resolved placement is browser-owned geometry, observed** (wave 11, #20, section 13). Which
  `position-try-fallbacks` option the browser applied is read from the computed style of the
  shown popup (`position-area`) and mirrored into a plain `useState` in the part, written
  **urgently** from platform events (`toggle`, a `ResizeObserver`, `scroll`, `resize`) and
  only when the value changed, so a popup that did not flip costs no render. It is exposed as
  `data-side` / `data-align` / `state.side` / `state.align` (section 4.1) and is never the
  source of anything: the browser keeps placing the popup; the library only reports where.
  Same lane as the context menu's placement (#45): a transition write would wait for an
  unrelated pending action and the arrow would point the wrong way meanwhile.
- Dispatches on the residual browser path use `details.reason: "platform"` (section 2.2); user
  dispatches use `"activate"`.
- A **module-level registry** is an allowed shape for a cross-component fact the DOM does not
  expose: `src/internal/modal-registry.ts` (directive-free) holds the stack of open modal
  `<dialog>` elements; `Dialog.Popup` pushes after `showModal()` and removes on `close` and
  unmount, and a reader (Toast's Viewport, which portals its region into the topmost modal so
  it is not inert) subscribes through `useSyncExternalStore` with a server snapshot of `null`.
  Writes happen in layout effects or platform event listeners, never during render; the
  registry is never the source of truth for a component's own state (Toast #54).
- **Relocating a portal without a remount**: `createPortal` remounts its subtree when the
  container changes, so a region that must follow something (Toast's region, into and out of
  the topmost modal) portals once into a **library-owned `display: contents` host element** and
  the library moves that host with a DOM `append` (between an inline anchor rendered where the
  component is and the current target); React never sees the move and in-flight state
  (`useActionTrigger`, timers) survives it. The hydration render stays inline to match the server
  HTML and switches to the portal on the first client render (Toast 4.3, review M2).
- A fourth kind of state, **consumer-owned, mirrored**: a controlled-only prop that the library
  writes to a DOM property it does not own (`Checkbox`'s `indeterminate` or Dialog
  `returnValue`; not Progress's `value`, which is rendered as attributes on a `div` with no DOM
  property to mirror and is simply a prop, #68). It has no `defaultX` and no action; the library re-applies it
  after every commit and may suspend it while an action is pending (section 4.1).
- A state may be **library-owned in one direction and browser-owned in the other**, or
  **library-owned for some causes of a change and browser-owned for others** (Dialog's `open`:
  opening and the closes a part asks for are transitions the library drives and awaits; a
  dismissal is performed by the browser and reaches the library as a notification with
  `reason: "dismiss"` and `details.returnValue`). The component doc says which, and the
  `xChangeAction` doc comment says so per value.
- Where the platform step a part's close goes through is **cancelable without an anti-abuse
  rule**, a component may **own the closes its parts initiate and leave dismissals to the
  browser**. The cancelable steps are the invoker's `command` event (popovers and dialogs
  alike), a form's `submit` event, and the part's own `click` (cancelling it cancels the
  command); the steps that are not are a dialog's close request (`cancel` is honoured once per
  user activation) and the `close()` a `method="dialog"` form performs once its `submit` was
  allowed, which is why a dialog's **Escape** is never library-owned while its **Close part**
  is. Popover: Trigger toggle, `Close` and a controlled `open={false}` are awaited and hidden
  in the apply effect; Escape and light dismiss are notified. Dialog (#46): `Close`, `Form`
  (a `method="dialog"` submit, or the settle after a function action), a foreign close command
  and a controlled `open={false}` are awaited and closed in the apply effect; Escape, Android
  back, AT dismiss and light dismiss are notified. The component doc lists which close is
  which.
- **A part's library-owned close is the single source of that close** (Menu #110). Whatever the
  press does on the way to the `click` must not trip one of the component's immediate,
  browser-shaped closes first; otherwise the popup is gone before the action runs, the reason is
  wrong (the notification's `"dismiss"` lands first and the click's dispatch is a no-op) and the
  outcome depends on the engine. The known trap is the focus move of a `mousedown`: Chromium and
  Firefox focus a button on press, WebKit does not. A component that closes on focus leaving
  (Menu's Tab-out, Combobox's focus loss) therefore has the parts outside its popup
  `preventDefault()` the `mousedown` while the popup is open (Combobox: always, the input must
  keep focus; Menu's Trigger: while `intended()` is `true`, because an opening click must focus
  the Trigger for the platform's focus return). Focus then stays inside through the pending close
  in every engine and the popup hides in the close commit. jsdom cannot catch this class of bug
  (user-event fires mousedown, mouseup and click in one task, so a `toggle` queued by the press
  lands after the click); a browser row that asserts the reason and `document.activeElement`
  across the click is required. The second known trap is **light dismiss** (Combobox's Trigger,
  #112; engine-independent): a press on a part outside the popup that is neither the popover's
  `source` nor a button naming it hides the popup at `pointerup`, a task before the `click`. The
  exemption is the invoker relationship of HTML's "topmost clicked popover": the element the
  popover was shown with (`source`) and a `<button>` whose `commandfor` (with a popover
  `command`) or `popovertarget` names the shown popover count as part of it; Chromium, Firefox
  and WebKit all implement both attributes there (a custom `command` does not qualify). A part
  that closes through its action therefore names the popup with `commandfor` +
  `command="toggle-popover"` and cancels its click so the command never runs (`usePopoverTrigger`
  does both for Popover and Menu; Combobox's Trigger writes the pair through its ref after
  hydration, section 7.4, because a pre-hydration command would open an empty, mis-anchored
  popup). A part whose close is browser-owned by design (Combobox's Clear) needs none of this.
  The browser-row requirement is the same: assert `:popover-open` across the click's pending
  window.

### 3.6 `disabled`

`disabled` is a boolean prop on the owner and on individual triggers. Native `disabled` is used
where the APG pattern allows it; where the pattern wants a focusable disabled control (Tabs; a `Button` inside a Toolbar, formerly `Toolbar.Button`, whose APG example
keeps disabled commands focusable so screen-reader users still find them, #66), the
part sets `aria-disabled` instead. In both cases the part emits `data-disabled` and never
dispatches for user interaction (platform dispatches from the form owner are the exception,
section 2.3 item 7).

**A part is never natively disabled while pending** (product-owner decision, library-wide;
amended with Button, #79). The library does not set `disabled` or `inert` on a trigger because its
action is in flight: native `disabled` drops keyboard focus to `<body>` in Chromium and Firefox
and leaves it on a dead element in WebKit (`docs/research/button.md` 1.2), so the user's place is
lost either way. A **pure trigger** that ignores re-entry (section 2.5) renders
`aria-disabled="true"` while its own action is pending, the honest state of a control that will
not act (React Aria does the same): focus stays, every listener keeps working (a Tooltip still
opens), and a user who presses again or returns hears "unavailable" rather than nothing.
`data-disabled` and `state.disabled` stay the consumer's `disabled` only, so `[data-pending]` and
`[data-disabled]` never need to look alike. A state owner (Toggle, Tabs, …) sets nothing: the
latest-intent rule covers it. No `aria-busy` (its meaning is "my content is being modified",
NVDA and VoiceOver ignore it and JAWS may hide the element's content; pass-through for consumers
who want it) and no built-in announcement of pending (the outcome is the consumer's).
`focusableWhenDisabled` (`Button`) joins Tabs and the Toolbar as a source of `aria-disabled` for a
consumer-disabled control, as does a `render` element that is not a host `<button>` (section 1.2).

**Computed native validity attributes.** A part may render a native constraint attribute from
library state when the platform has no constraint for the component's semantic: CheckboxGroup
renders `required` on every Item only while the group's **optimistic** set is empty ("at least
one"), so validation, `:user-invalid` and the localised browser message stay native. Such an
attribute is owned by the part, follows optimistic state (it appears during a pending uncheck of
the last box and leaves on rollback), and is static before hydration (the server-rendered value),
which the component doc records as its pre-hydration behaviour. The **custom-validity slot**
(`setCustomValidity`) of a control inside a `Field.Root` is **owned by the Field** (#54): it
holds the Field's `validate` result or the server error for the field, recomputed on the
control's next `input`; a control never calls `setCustomValidity` itself, and attribute-based
constraints such as CheckboxGroup's `required` are unaffected. A control whose **user surface**
and **validity element** differ (NumberField, #67: the visible text input and the hidden number
input) keeps the Field's slot on the validity element, and both the Field (after each slot write)
and the control (after each value write) mirror `validityElement.validationMessage` into the
surface's own slot (`setCustomValidity`), so the surface is invalid exactly when the control is,
with the platform's message, and the platform's report UI, `:user-invalid` and the Field's focus
land on the surface. The surface carries no native constraint of its own.

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
they share three internal hooks, so that one dispatch model covers single controls and groups;
every form control's owner part additionally calls `useFieldControl` (last rows), which is how
a control becomes a Field's control (#54).
This is the one contract both designs implement (reconciled 2026-10-16 from
`design/components/switch.md` §7 and `design/components/radio-group.md` Cross-component item 2).

| Hook | Called by | Does |
| --- | --- | --- |
| `useFormReset(ref, onReset, onResetEvent?)` (`internal/use-form-reset.ts`) | the other two, Combobox | **Stable** `reset` subscription on the form owner (`ref.current.form`; the element may be an `<input>`, a `<select>` or a `<fieldset>`, both form-associated and honouring `form=`). Re-reads the owner after every commit but re-subscribes only when it changed; the handler body is a `useEffectEvent`. On `reset` it calls the optional `onResetEvent(event)` synchronously (before the reset algorithm: where a text input's `defaultValue` mirror must be written, rule 6), then queues a microtask and, unless `event.defaultPrevented`, calls `onReset(event)`. |
| `useNativeChecked(options)` (`internal/use-native-checked.ts`) | every `<input type="checkbox" \| "radio">` part: Switch, Checkbox, `RadioGroup.Item` | Per element: the ref callback with the dev tag/`type` check; a layout effect after **every** commit that re-applies, in this order, `defaultChecked` (if given), then `checked` (optimistic), then `indeterminate` (if given). The order matters in exactly one case: react-dom's `updateInput` writes `el.checked` on every update of the input (setting the dirty-checkedness flag), and React's automatic form reset runs in the form's mutation effects, after the inputs' updates and before layout effects; after that reset the dirty flag is clear, so writing `defaultChecked` (the `checked` content attribute) would move `checked` too, and writing `checked` afterwards settles it. `indeterminate` is independent of both; and, **unless `group: true`**, the two residual paths for a single control: mount reconciliation and `useFormReset`, both reporting `onPlatformChange(next: boolean, event)`. With `group: true` it reports nothing; the group adapter does. |
| `useNativeGroupReconciliation<T>({ element, readCurrent, readDefault, base, onPlatformChange })` (`internal/use-native-group-reconciliation.ts`) | a group Root (`RadioGroup.Root`, `CheckboxGroup.Root`) with `element` = its `<fieldset>` ref | Mount reconciliation once (`readCurrent()` vs `base()`) and `useFormReset` on the fieldset (`readDefault()` vs `base()`), each producing **one dispatch per group** through `onPlatformChange(next: T, event)`. Returns a stable `{ onItemMounted }`, which the Root passes down through context and `group: true` items call from their mount layout effect (`useNativeChecked` takes `onItemMounted` and `component` options). The adapter **ignores calls made before its own mount reconciliation has run** (members rendered in the Root's commit run their effects first, so they are covered by that reconciliation; the flag is reset in the effect cleanup so StrictMode's re-run behaves the same); any later call queues **one microtask per commit** that compares `readCurrent()` with `base()` and dispatches `"platform"` with `event: undefined`. Comparison is `equals` (option, default `Object.is`); a group with a set value (`CheckboxGroup.Root`) passes set equality, because two sets are never `Object.is`-equal. `element` accepts any `FormAssociatedElement`: Slider subscribes through its first Thumb's input (a Root `div` has no `.form`), with `readCurrent` reading every registered input and `readDefault` returning the JS-computed reset target; the optional `onResetEvent` option is passed through to `useFormReset` for the `defaultValue` mirror of a controlled value input (rule 6). |
| `useNativeSelectValue(options)` (`internal/use-native-select-value.ts`) | `Select.Root` with its `<select>` ref | The select analogue of `useNativeChecked`, built on `useNativeGroupReconciliation`. After every commit, and for each late Option's mount report, it mirrors the reset target into `option.defaultSelected` (uncontrolled: the latest `defaultValue`, nothing when absent; controlled: the Root's mount-time value; react-dom writes `defaultSelected` only for an uncontrolled `defaultValue`) **and then** re-applies the intended option's `selected`, in that order in one synchronous step, because `defaultSelected = true` on an option the user or script never selected moves the selection. Mount reconciliation reads `select.value`; the reset path reads the spec's reset result (the last `defaultSelected` option, else the first enabled option, else `""`); both dispatch once per Select and only when the intended option exists. With neither `value` nor `defaultValue` the uncontrolled value is **adopted** from the browser's choice without a dispatch (`adopt(next)` on `useControllableAction`, uncontrolled only). |
| `useFormOwnerEvent(ref, type, handler, options?)` (`internal/use-form-owner-event.ts`) | `useFormReset` (now a thin wrapper), `Field.Root` (`input` / `change` on the form owner for cross-field `validate`, `submit` and `reset` for its flags) | The stable form-owner subscription of rule 4 generalised to any event type: re-reads `ref.current.form` after every commit, re-subscribes only when the owner changed, handler body through `useEffectEvent`. |
| `useFieldControl({ labelable, name?, disabled?, required?, id?, component, validityElement? })` (`internal/use-field-control.ts`) | `Field.Control` and the owner part of every FUNSTACK form control: `Checkbox`, `Switch`, `RadioGroup.Root` and `CheckboxGroup.Root` (their `<fieldset>`, `labelable: false`), `Select.Root`, `Combobox.Input`, `Slider` (#60; one thumb: the thumb's input; several: the group element, `labelable: false`), `NumberField.Input` (#67; registers the visible input, `labelable: true`, with the hidden number input as `validityElement`) | Outside a `Field.Root`: `inField: false`, nothing to merge. Inside: returns a **ref callback** the part merges into its library ref (`useMergedRefs`, `internal/use-merged-refs.ts`), which registers `{ element, labelable, required, disabled }` with the Field and returns the cleanup (no extra render; a `required` / `disabled` change re-registers without re-attaching listeners); the **Field** attaches its native listeners (`input`, `change`, `focusout`, `invalid`, capture) to the registered element and resolves the **validity element** (the element itself when it is a form control, else the first named `willValidate` member of a `<fieldset>`'s `elements`, else the first control inside) where `validity` / `validationMessage` / `:user-invalid` are read and `setCustomValidity` is written. Returns `name` / `disabled` / `required` (own, else the Field's), `id` (labelable: the Field's control id) and `attributes`, the owned layer the part spreads: `id` (labelable only), `aria-labelledby` (groups: the Label id), `aria-describedby` (token-merged by the part), `aria-invalid` (`"true"` / `"false"`; a `group` such as CheckboxGroup moves it to its items, ARIA 1.2), `data-invalid`. **No `data-pending`**: a control inside a Field keeps its own, for its own action (2.7); only `Field.Control` carries the form's. **`validityElement?: () => ValidatableElement \| null`** (#67): where `validity`, `validationMessage` and the custom-validity slot are read and written when that is not the registered element; `:user-invalid`, the listeners and the focus target stay on the registered element, and the Field mirrors `validityElement.validationMessage` into the registered element's slot after writing its own (3.6). Controls that pass none are unchanged. Two registrations in one Field warn (`design/components/field-form.md` 7). |
| `useFieldValueChange(value, takeEdit?)` (`internal/use-field-control.ts`) | every owner part that calls `useFieldControl` and whose DOM value can change **without** an `input` / `change` event the Field hears: `Combobox.Root` (a pick; `takeEdit` returns `true` for its own dispatches), `CheckboxGroup.Root` (a Parent click, the derived `required`), `Checkbox`, `Switch`, `RadioGroup.Root`, `Select.Root` (a controlled change from outside, a rollback), `Slider` (#60; a pointer gesture), `NumberField.Root` (#67; `useFieldValueChange(optimistic, edit = "activate")`: a step or commit writes the hidden input through the ref with no event the Field hears) | A layout effect with no deps that compares `value` with the last committed one and, when it changed (never at mount), calls the Field's `notifyChange(edit)` with `edit = takeEdit?.() ?? false`: the Field re-reads validity and recomputes its slot (dismissing a shown server error when `edit`, as an `input` event would) and asks the `Form.Root` to refresh its other Fields (cross-field `validate`); outside a `Form.Root` only the control's own Field is refreshed. Not a synthetic event: the consumer's handlers and other `useFormOwnerEvent` subscribers do not see it (`design/components/field-form.md` 7.1). |
| `useCheckableInput(options)` (`internal/use-checkable-input.ts`) | `Checkbox`, `Switch` | The single-input machinery the two share, in this hook order: `useFieldControl` (`labelable: true`, the own `name` / `required` / `id`), `useControllableAction<boolean>` (the component passes `transitionTypes` and its warning tag), `useFieldValueChange`, `useNativeChecked` (with `indeterminate` when the component has one), `useMergedRefs`. Returns `{ optimistic, pending, disabled, shownIndeterminate, ref, libraryProps }`: the input's owned layer in the component's key order (Switch's `role`; Checkbox's `indeterminate` / `data-indeterminate` only when the option is given). The components keep their props, state, `useRender` call and transition boundary. |
| `useFieldsetGroup({ component, name, disabled, required })` (`internal/use-fieldset-group.ts`) | `RadioGroup.Root`, `CheckboxGroup.Root` | The `<fieldset>` wiring of a group Root: `useFieldControl` (`labelable: false`), the fallback `name` (own, else the Field's, else `useId()`), "own or the Field's" `disabled` / `required`, the fieldset ref with its element check, and `rootRef`, the merged library ref (fieldset ref, element check, Field registration). |
| `groupMemberProps(options)` (`internal/group-member.ts`) | `RadioGroup.Item`, `CheckboxGroup.Item` | The owned layer of a group member's `<input>`: `type`, the group's `name` / `form`, `value`, optimistic `checked`, `defaultChecked` never rendered, a checkbox's `aria-checked` removed, the member's own `disabled` (the Root's reaches it through `<fieldset disabled>`), `required`, `aria-invalid` only when given (CheckboxGroup inside a Field), the state `data-*` attributes and the guarded `onChange`. The hydration-time attribute sync next to it is `syncPresences` (`internal/sync-presence.ts`). |
| `useItemOrder({ optimistic, initial, read, changed?, duplicateMessage })` (`internal/use-item-order.ts`) | `CheckboxGroup.Root`, `ToggleGroup.Root` | The Items' document order kept in state for the Root state's `value`: a deps-less layout effect re-reads the layout after each Root commit and re-renders only when what renders from it changed; returns `{ layout, renderedValue }` (the optimistic set in document order, values with no Item last). The set and order arithmetic is `internal/value-set.ts` (`toSet`, `setsEqual`, `applyPatch`, `sortByOrder`, `firstDuplicate`, `EMPTY_SET`; Accordion uses it too) and document order `internal/dom-order.ts` (`compareDocumentOrder`, `sortByDocumentOrder`). |
| `resolveFieldDefaults(field, own)` (`internal/use-field-control.ts`) | `useFieldControl` itself; `NumberField.Root` (whose owner part is the Input but whose `name` / `disabled` the Root resolves) | The one "own or the Field's" rule: `name` falls back to the Field's, `disabled` and `required` are either's; the own props outside a Field. `FieldControlBinding.fieldName` is the Field's own `name` for a control that must tell the two apart (Slider). |
| `intendedValue(latestInFlight, optimistic)` (`internal/use-controllable-action.ts`) | the group Roots' residual paths | Rule 1's base with the explicit null check, in one place. |

Rules the three hooks implement, which component docs may cite instead of restating:

1. **Base comparison.** A residual path dispatches only when the DOM value differs from what the
   user already intends: the latest in-flight dispatch's `next` if there is one, else the
   optimistic value (`latestInFlight` comes from `useControllableAction`). Spell it with an
   explicit null check on the *dispatch*, never with `??` on `next`:
   `const f = latestInFlight(); const base = f === null ? optimistic : f.next;`
   (`intendedValue(latestInFlight, optimistic)` in `use-controllable-action.ts` is that spelling;
   the group Roots call it). For a nullable
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
   user intends. **The members' DOM value must be recorded in the layout phase** of the commit
   the late members mount in, and the microtask read must use that snapshot (CheckboxGroup 8.1):
   any re-render between a late member's mount and the adapter's microtask (a registration state
   write, a parent re-render) makes `useNativeChecked` re-apply the optimistic value and overwrite
   DOM state that has not been read yet, erasing a click made before the member hydrated. The
   group adapter's `onItemMounted` wrapper takes the snapshot once per commit and clears it in a
   microtask. A programmatic value change while members are still dehydrated is not a problem
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
   (product-owner decision), and after settle the DOM follows the parent's decision. Two
   inputs cannot carry the mirror the usual way (Combobox): a **text input's** `defaultValue`
   attribute is rewritten by react-dom after every value change, so its mirror is written in
   the `reset` event itself (`onResetEvent`), and a **hidden input** has no reset behaviour at
   all, so a Root with a hidden form input computes its reset target in JS (section 3.5). The
   text-input rule holds for **every controlled value input**: Slider writes each thumb's
   `defaultValue` in the `reset` event through `useNativeGroupReconciliation`'s `onResetEvent`
   and dispatches the JS-computed target, never a DOM read (a render between the event and the
   microtask could re-apply the shown value). A library-owned native input that is **not the
   user's surface** (NumberField's hidden number input, #67) is uncontrolled instead, with
   `defaultValue` as the reset target and its `.value` written through the ref (section 3.5).
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
| `pending` | boolean | owner + initiating trigger; Toast `Root` and `Action`; `Slider.Thumb` (the thumb the latest step or commit moved); `ToggleGroup.Root` and each `ToggleGroup.Item` whose optimistic pressed state differs from its committed one; `Button` (its own `action`, or a submission it started through its own function `formAction`, #79; it replaced `Toolbar.Button`, #66); `NumberField.Root`, `NumberField.Input` and the `Increment` / `Decrement` button the latest step or commit came from (#67); `Field.Root` and every Field part, `Form.Root`, `Form.Submit` (the enclosing form's submission, `useFormStatus`: the form channel, section 2.7) | An action dispatched through this component is in flight (including the Suspense wait of the resulting render). For a toast: the promise given to `toast.promise` is unsettled, or an action dispatched through its `Action` part runs; not set while the toast's content is merely suspended. |
| `disabled` | boolean | any | Disabled by prop or inherited from the owner; also a NumberField `Increment` / `Decrement` button whose next step would change nothing (at its bound, `readOnly`, #67). Emitted in **every mode** in which the part renders `disabled` or `aria-disabled` (wave 9, 5fc05d5: the JS-free Dialog and Popover Triggers included), so the styling hook and the ARIA state never disagree. |
| `pressed` | boolean | Toggle, `ToggleGroup.Item` | Optimistic pressed state. |
| `selected` | boolean | Tab, Item, `Select.Option` (optimistic; identical to the platform's `:checked` on the option, since the `<select>` renders `value={optimistic}`), `Combobox.Option` (optimistic `aria-selected`; distinct from `active`), `Combobox.Input` (a non-null optimistic value) | Optimistic selection on triggers; committed on panels. |
| `active` | boolean | `Combobox.Option` | Virtual focus: `aria-activedescendant` points here. Urgent (section 3.2), never a transition. |
| `stale` | boolean | `Combobox.Popup`, `Combobox.List` (with `aria-busy="true"` on the listbox while stale **or loading**: a `Status` mounted inside the List; loading itself is not a data attribute in v1) | The results shown are for an older text (`inputValue !== useDeferredValue(inputValue)`); the previous results stay visible meanwhile. |
| `empty` | boolean | `Combobox.List` | No mounted options, not stale and not loading; the same condition under which `Empty` renders. |
| `open` | boolean | Popup, Trigger, Accordion `Item` and `Trigger` (the Accordion `Panel` emits only `data-disabled`; its visibility is the native `<details open>` / `:open`); Dialog `Trigger` (optimistic, library mode) while the `<dialog>` itself emits none because `:open` / `:modal` are exact and written by the same commit; Popover `Trigger` (optimistic `data-open` and `aria-expanded` in library mode; in JS-free mode only `aria-expanded`, kept current by a DOM write from the popup's `toggle` listener, section 7.4) while its Popup emits none (`:popover-open`); Menu `Trigger` and `SubmenuTrigger` likewise (optimistic `data-open` and `aria-expanded`), Menu `ContextTrigger` (optimistic `data-open`, no ARIA, #45); Combobox `Input` and `Trigger` likewise, its Popup none | Disclosure and open state, following the platform's word (`<details open>`, `:open`, `ToggleEvent.newState`); `expanded` is not used. Emitted for library-owned open state; purely browser-owned open state (Tooltip in the top layer) is styled with `:popover-open` / `:open` and emits no attribute (section 7.4); `Select.Root` emits none at all, because a native select's picker has no open event and is styled with `:open` only. |
| `checked` | boolean | Checkbox, Switch, `RadioGroup.Item` (radio items use `checked`, the platform word, not `selected`), sibling `Indicator` parts; `Menu.CheckboxItem` and `Menu.RadioItem` (optimistic, as `aria-checked` and `data-checked` on a `button`) | Optimistic checked state. On the input itself the DOM holds the optimistic value (section 3.2), so `:checked` matches it, with the caveats in section 4.2 (`preventDefault()` misuse; Chromium's checked+indeterminate quirk). |
| `indeterminate` | boolean | Checkbox (controlled-only prop, "consumer-owned, mirrored" in section 3.5's terms; never Switch); Progress, every part (`value` is `null`: derived, not a DOM property, never suspended, #68) | Mixed state. Emitted from render as `data-indeterminate` because the DOM property cannot be server-rendered and `aria-checked` is forbidden on native inputs: the attribute is what lets CSS draw the dash before hydration. The property is set through the ref and re-applied after every commit; it is **suspended while an action is pending** (`state.indeterminate = indeterminate && !pending`, product-owner decision) so the attribute, the DOM property and `:indeterminate` agree in every phase, since the browser clears it on the click and the parent may not have recomputed yet. `CheckboxGroup.Parent` also emits it, but there the value is **library-derived** from the group's optimistic set (`some && !all` over the Parent's `values`) in the same sync render that follows a click, so it is **not** suspended while pending; the suspension rule is specific to the consumer-owned prop. |
| `orientation` | `"horizontal" \| "vertical"` | Root, List, Tab; every Slider part; `ToggleGroup.Root` and `Item` (the enclosing Toolbar's when inside one); `Toolbar.Root` and `Toolbar.Separator` (the separator's own, perpendicular to the toolbar's) | Enum attribute with value. |
| `invalid` | boolean | every Field part | An error is shown for the field: the control matches `:user-invalid`, or a server error for it is shown (Field 2.2). The control also carries an explicit `aria-invalid="true" \| "false"`. |
| `required` | boolean | every Field part | `Field.Root required` or the control's own `required` (reported through its registration). |
| `dragging` | boolean | Slider `Root` and the captured `Thumb` | A pointer is captured on a thumb (urgent state; keyboard never sets it). Style motion off under it (`[data-dragging] { transition: none }`). |
| `ending` | boolean | Toast `Root` | Closed, kept mounted (and `inert`) until the animations the ending state started finish (`exitAnimations` filtered by a baseline of the animations already running before the close, Toast 10.2; a paused progress bar does not hold the exit); CSS animates on it. |
| `paused` | boolean | Toast `Viewport` | A viewport-wide timer pause holds (pointer over the region, focus inside, hidden document, blurred window), so a visual progress indicator can pause with the real timer. |
| `type` | string | Toast `Root` | The toast's consumer-defined `type` (`"error"`, `"success"`, …), an enum whose vocabulary is the consumer's. |
| `complete` | boolean | Progress, every part | The clamped value reached `max` (#68). |
| `context` | boolean | `Menu.Popup` | The current open came from a `Menu.ContextTrigger` and the popup is placed at a point: `--menu-point-x` / `--menu-point-y` are set inline and `data-side` / `data-align` are absent (#45). Written urgently with the placement (geometry, not a dispatch): present from the point open's request until the popup is hidden and its exit is over (`design/components/context-menu.md` 3.1). |
| `region` | `"optimum" \| "suboptimum" \| "even-less-good"` | Meter, every part | HTML's meter region for the value against `low` / `high` / `optimum`, the platform's words (#68). |
| `side` | `"top" \| "bottom" \| "left" \| "right"` while shown; the requested `side` (which may be `"inline-start"` / `"inline-end"`) otherwise | Tooltip, Popover and Menu `Popup`; Tooltip `Arrow` | **The resolved side** (#20, section 13): while the popup is shown, the side of the anchor the browser actually placed it on, read from the computed `position-area` after `position-try-fallbacks` chose an option, so it changes after a flip (on open, on scroll, on resize); on the server, while closed, and when the computed value cannot be read (a vertical writing mode, a consumer `position-area` the parser does not know), the value of the `side` prop. Absent with `side={null}` and on a point-placed menu (`context`). Written urgently (geometry, observed; conventions 3.5). |
| `align` | `"start" \| "center" \| "end"` | same parts | The resolved alignment along that side, same rules. `start` / `end` are **inline-relative** on a top / bottom side (`start`: the popup's inline-start edge meets the anchor's; mirrored under `direction: rtl`) and block-relative on a left / right / inline side (`start`: top edges meet). |
| `instant` | boolean | `Tooltip.Popup` | The tooltip is shown by an open that began while another `[role="tooltip"]:popover-open` existed in the document (the skip-delay condition, `design/components/tooltip.md` 6), so a stylesheet can skip the entry animation of a warm open and keep a cold one's (#93). **Attribute only, no `state.instant`**: browser-owned, like the open state it qualifies (no `state.open` exists), written by a DOM write from the popup's synchronous `beforetoggle` on both paths, before the open's first style recalc, and removed at the close's (section 7.4). Never server-rendered. |

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
| `:user-invalid`, `:required` | none on the input; `data-invalid` / `data-required` on Field parts | On a bare control: platform only. Inside a `Field.Root` the Field parts emit `data-invalid` (which also covers server errors, where no pseudo-class exists) and `data-required`; `:user-invalid` / `:user-valid` on the control and `:has(:user-invalid)` on the Root remain the zero-JS, pre-hydration styling hooks for the native half. |

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
part whose mount, unmount or **committed** library state. A part whose only library-driven
change is an optimistic flip that never animates (Menu's items, whose `aria-checked` lands in a
sync render and whose settle shows nothing; every Select part, since the picker is a UA
pseudo-element, `<selectedcontent>` is written by the browser and every library attribute is
optimistic; every Slider part, whose thumb position is urgent or optimistic and whose rollback
animates with a CSS transition on a registered custom property; every NumberField part, whose text is urgent and whose value is urgent or optimistic, #67) has no `transition` prop; Toggle keeps its own
because its element's content can change with the settled action. A third category without the
prop: parts whose **every commit is on the urgent lane by design** (Toast, section 2.6): react-dom
never starts a view transition for an urgent commit, so a boundary could animate nothing and
would still pay the page cross-fade whenever the part happened to mount inside another
component's transition commit; such parts animate enter and exit in CSS (`@starting-style`,
`data-ending`). Field and Form (#54) are in this category too: a Field's state is an urgent
mirror of browser-owned validity (2.6) and a Form's own commits change nothing the form element
displays, so no Field or Form part has `transition`; `Field.Error` enters with
`@starting-style`. A fourth category (Progress and Meter, #68): a part that displays a
**consumer-owned value** with no library state or dispatch, whose changes arrive in the consumer's
lane (usually urgent, 2.6) and animate through a CSS transition on a registered custom property;
no such part has `transition`.

**Top-layer parts: the boundary wraps the top-layer element itself, never only its children**
(decision for Popover, #38, from the `vt-popover` probe in `docs/research/popover-menu.md`). A
boundary placed inside a `[popover]` or `<dialog>` around content mounted on open has no box
while the element is `display: none`, so it gets no enter; wrapping the element captures the
popup's own box on a library-driven open (`::view-transition-new`) and on a library-driven close
(`::view-transition-old`), in all three engines. `Dialog.Popup` already wraps the `<dialog>`;
`Popover.Popup` and `Menu.Popup` wrap the `[popover]` element. The rule only matters for opens
and closes the library performs in a layout effect of a transition commit; browser-initiated
ones (Escape, light dismiss) happen outside React and animate with CSS, as above. A CSS exit
kept next to `transition` must be **cut while a view transition runs**
(`html:active-view-transition .dialog { transition: none; }`), otherwise Chromium keeps the
fading element rendered and the close's view transition captures it as a live
`::view-transition-new` next to the old image (a double image); the rule is untyped on purpose,
because a controlled close carries no types (#46; Dialog 10.3, Popover 10.2).

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

**Deferred renders animate too.** An update from `useDeferredValue` activates a boundary like a
transition does (React rule). A part whose content re-renders from a deferred value inside an
open boundary (Combobox's results inside `Combobox.Popup`) would run a document view transition
per result change, so its docs recommend the type-map form with `default: "none"` and name the
cost of a class on `default`.

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
| Popover | `fsui-popover`, `fsui-popover-open`, `fsui-popover-close` |
| Menu | `fsui-menu`, `fsui-menu-open`, `fsui-menu-close` (Root); `fsui-menu-check` / `fsui-menu-uncheck` (CheckboxItem); `fsui-menu-select` (RadioGroup) |
| Select | `fsui-select` (no direction variants) |
| Combobox | `fsui-combobox`, `fsui-combobox-open`, `fsui-combobox-close` (Root open state); `fsui-combobox-select` (every value dispatch) |
| Toast | none (no `transition` prop; every commit is urgent, section 5.1) |
| Field, Form | none (no `transition` prop: an urgent validity mirror and a form whose own commits display nothing, section 5.1) |
| Slider | `fsui-slider`, `fsui-slider-change` (each step), `fsui-slider-commit` (each gesture's commit); no `transition` prop on any part, the types serve consumers' own boundaries |
| ToggleGroup | `fsui-toggle-group`, `fsui-toggle-group-press` (when `details.added` is non-empty), `fsui-toggle-group-release` (when `details.removed` is non-empty; an exclusive switch carries both) |
| Toolbar | none |
| Button | none (`useActionTrigger`; `transition` animates the commit that ends the action, #79; `Toolbar.Button` was the same) |
| Progress, Meter | none (no `transition` prop: a consumer-owned value in the consumer's lane, section 5.1) |
| NumberField | `fsui-number-field`, `fsui-number-field-change` (each step), `fsui-number-field-commit` (each gesture's commit); no `transition` prop on any part |

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
  has no `fallback` props, with the one exception in the last bullet. Boundary placement decides
  where fallbacks appear and whether first-mount state is discarded; that is a layout decision.
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
- **The one library-owned boundary: Toast's guard** (#54). `Toast.Root` wraps its children in a
  `<Suspense>` whose fallback renders nothing visible. The reason is specific and not to be
  generalised: a toast is mounted in an **urgent** commit from outside the consumer's tree, so a
  suspending toast would reveal the fallback of the nearest boundary *above the Viewport* (the
  app shell in the common layout) instead of keeping old content as a transition would. The
  guard gates the toast's timer and announcement. **`fallback` exists only where the library
  owns the boundary, which is Toast alone** (`Toast.Root fallback`, accepted 2026-10-18, #63):
  the prop does not move a boundary, it lets the consumer style the one the library already
  has, so the skeleton the guard can see replaces a consumer `<Suspense>` inside the Root, which
  catches first and is invisible to the guard (its reveal is announced, but the timer runs
  under the skeleton). The precedent risk is named so it is not taken by analogy: Dialog,
  Popover, Tabs and every other content region are transition-mounted and keep their old UI
  under `data-pending`, so they own no boundary and get no `fallback` prop; a request for one
  elsewhere is a request to own a boundary, which needs the urgent-mount reason above.

---

## 7. Server/client boundaries and packaging

### 7.1 Per-file directive

`"use client"` goes at the top of **each source file that uses a client-only API** (hooks other
than those React's `react-server` build exports, which are `use`, `useId`, `useCallback`, `useMemo`
and `useDebugValue`, plus `cache` and `cacheSignal` (React 19.3.1 `react.react-server.js`; #68 relaxed
the earlier `use` / `useId`-only list to React's own, so a module whose only hook is `useMemo`, such as
`use-render.tsx`, may drop its directive); `createContext`, `useState`, `useRef`, effects,
`startTransition`, DOM access, event props) and nowhere
else. Files without the directive must not import from files with it, with two exceptions:
`index.ts` files, which only re-export, and the React 19.3 pattern of a directive-free file
*rendering* a context provider imported from a client module (`<TabsContext value={...}>`), which
is allowed because Server Components may render client-created contexts. No initial component
needed the second exception; `Progress.Root` and `Meter.Root` (#68) are its first users: a
directive-free Root renders `<ProgressContext value>` imported from its `"use client"` context
module and imports no other client module (the Server render row in 10.1 guards the import graph);
a component that does this says so in its design doc. Pure modules are
directive-free: arithmetic and formatting (`slider/slider-arithmetic.ts`; NumberField's
`number-field-format.ts`, `number-field-arithmetic.ts` and `internal/decimal.ts`, #67), pure
DOM reads, prop builders and listener installers (`internal/popover-open.ts`, `dom-order.ts`,
`arrow-keys.ts`, `render-element.ts`, `value-set.ts`, `shipped-styles.ts`; `menu/menu-dom.ts`,
`menu-hover.ts`, `menu-gestures.ts`, `menu-outside.ts`, `menu-point.ts`) and the Toast
Viewport's queue, hotkey and timer models (`toast/toast-queue.ts`, `toast-hotkey.ts`,
`toast-timers.ts`); `directives.test.ts` lists them. A context shared
by **several component folders** lives in `internal/` (`internal/field-context.ts`, read by the
Field parts, `Form.Root` and `useFieldControl` from every form control's folder; `internal/toolbar-context.ts`, read by
`ToggleGroup.Root`, `Toolbar.Separator` and `Menu.Trigger` to find an enclosing Toolbar, #66); the one-way
rule above is unchanged, and `internal/` stays unexported.

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

**Development text never reaches a consumer's production bundle.** The build is unbundled, so
`dist` legitimately keeps every warning string; it is the consumer's bundler that folds them
away, and it can only do so when the text sits behind a `NODE_ENV` test it can evaluate. Every
module that warns declares its own `const isDev = process.env.NODE_ENV !== "production"` and
passes each message as `isDev && "..."` (or `isDev && ((element) => ...)`) to `useDevWarning`,
`useElementCheck`, `useNameWarning` and `useShownNameWarning`, which accept `false`; a direct
`console.error` sits inside `if (isDev)`. The hooks themselves are exported as `isDev ? hook :
noop`, so a production render runs no warning hook at all. A dev check fires **once per
instance** (`useDevWarning`: the first time its condition holds; the element and name checks:
the first failing check). `src/__tests__/production-bundle.test.ts` bundles `src/index.ts` as a
consumer would (`NODE_ENV` `"production"`, minified) and fails on any string from those call
sites that survives, naming the file and the text.

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
they do not get: a directive-free module.

**Directive-free variants: resolved, none (#19, user decision 2026-10-23, option A of
`docs/research/zero-js-variants.md` 5, whose measurements are binding).** The guarantee the
library makes is the one above: **no behaviour JS on the native path, and the markup works
before and without hydration**. It does not promise "no client bundle", and the docs must not
either: on FUNSTACK Static a page with no client components still ships about 76 KB gzip of
runtime and hydrates, and the library parts add 2 to 5 KB gzip per family on top (Accordion
+5.1, Tooltip +5.0, Switch +3.8, Progress +1.9); where a page really ships zero JS (plain SSR or
`react-dom/static` prerender without hydration) today's parts already render complete, working
HTML, directive or not. So no second anatomy ships. Per component:

- **Form controls** (Switch, Checkbox, RadioGroup, Slider, NumberField; Select likewise): the
  JS-free form control from a Server Component is the **native element** (`<input
  type="checkbox" role="switch">`, same-`name` radios in a `<fieldset>`, `<input type="range">`,
  `<input type="number">`, a real `<select>`), shown as a **recipe on each component's docs
  page**, not a part: a directive-free part would add nothing over the element and would lose
  Field integration, the action and the optimistic attributes.
- **Tooltip**: not viable natively. `interestfor` exists only in Chromium (Firefox bug 1984699,
  WebKit bug 297786, no position), so a directive-free Tooltip would show nothing at all in two
  of three engines; `design/components/tooltip.md` 2.4 and 14 stand (every part is a client
  module; "zero-JS" there means the native path runs no behaviour JS).
- **Popover**: possible in principle (`commandfor` + `toggle-popover` in all engines) but a
  static Trigger could not keep a server-rendered `aria-expanded` current and only Chromium maps
  the invoker's expanded state natively; that accessibility gap must close first. Not scheduled.
- **Accordion**: the one real candidate (no behaviour loss in any engine, about 5 KB gzip
  saved). **Option B, `@funstack/ui/accordion/native`** (Root `div`, Item `details` with a
  required `name`, Trigger `summary`, Panel `div`; usable from Server and Client Components,
  function props allowed), is recorded as a **ready plan, not scheduled**; revisit if an RSC host
  learns to skip the runtime for pages with no client references, or if users ask.
- **Progress / Meter**: the Root is already directive-free (below); a variant would save
  +1.9 KB and is not worth a second surface.

Two findings from the same research hold library-wide: a `React.cache()`-scoped mutable "server
context" is unsafe (an async child resumes after a sibling Root overwrote the value; rejected as a
way for a Root to pass data to its parts), and server `useId` ids collide across separately
rendered Flight payloads unless the host gives each payload its own `identifierPrefix` (#94,
below; FUNSTACK Static does from 1.3.4). Passing any action prop to a part from a Server
Component is a type error unless the action is a Server Function (section 2.2).

Progress and Meter (#68) are the first components whose **Root is itself a Server Component**:
`Progress.Root` / `Meter.Root` are directive-free (only `useId`, arithmetic and `Intl`), render the
client-created context provider (7.1), and their parts are client modules that read it. "JS-free"
and "a Server Component" coincide at the Root, so function props (`getAriaValueText`,
`children(state)`, `render`) may be passed from a Server Component and run on the server, next to
the JS-free Accordion whose parts are all client modules. **Host requirement (#94, resolved):**
a server `useId` restarts at `_S_1_` for each Flight render, so a host that renders more than one
Flight payload into one document must give each payload its own `identifierPrefix`, or a
`Progress.Root` / `Meter.Root` in one payload gets the same `${id}-label` as one in another and
`aria-labelledby` breaks (client `useId`, `_R_…`, is unaffected). FUNSTACK Static's `defer()`
used to render deferred payloads without a prefix; **fixed in `@funstack/static` 1.3.4**
(uhyo/funstack-static#198 / #199, prefix `_Deferred_<n>` or `_d<n>` per payload), verified by
`docs/research/zero-js-variants.md` ("#94 re-check"): no duplicate ids, three distinct accessible
names, no hydration errors. Consequences: a Server-rendered Progress / Meter Root inside
`defer()` requires `@funstack/static >= 1.3.4` (the docs site is on it; the per-page notes that
flagged the gap were removed), the library adds no id override for this (the fallback the gap
had reserved; `id` stays an owned key of `Progress.Label` / `Meter.Label`, and nothing in the
library parses ids, so the prefixed form has no API impact), and the one-line host note lives on
the Server Components docs page rather than on each component. Any other RSC host with
multi-payload pages has the same requirement; the library cannot detect it.

A third configuration, decided with Menu (#39): a component whose baseline **cannot** be JS-free
(a menu needs arrow keys, typeahead and focus management that only Chromium's flagged
`focusgroup` provides natively) runs in library mode always, with no three-prop mode switch, and
still renders the declarative Invoker Command on its Trigger for the implicit anchor, the
platform's `aria-expanded` mapping and a pre-hydration open that mount reconciliation fills.
That open shows an empty popup until hydration, as Dialog's and Popover's library mode do; it
is progressive enhancement, not a supported JS-free mode, and the component doc says so.
Combobox is the second such component: its Trigger renders no command at all (the popup must be
anchored to the input, not the button), and its progressive enhancement is that the text input
works before hydration and the typed text is adopted at mount (section 3.5).

---

### 7.4 Attributes and events React cannot express

The platform moves faster than react-dom and `@types/react`. Conventions for the gap, with the
cases known on 2026-10-15 (`docs/research/modern-platform-survey.md`, "React 19.3 integration
notes"):

| Gap | Convention |
| --- | --- |
| Attribute unknown to react-dom (`command`, `commandfor`, `interestfor`, `focusgroup`, `closedby`, `switch`, `name` on `<details>`) | Write it **lowercase** in JSX; react-dom passes unknown lowercase attributes through verbatim on client and server. Never camelCase (`interestFor` renders the wrong attribute and warns). |
| Attribute or element untyped in `@types/react` (`command`, `commandfor`, `interestfor`, `focusgroup`, `switch`; the `selectedcontent` element) | One module augmentation module, `src/internal/platform-attributes.ts` (`declare module "react" { ... }` plus `export {}` so it is a module), augmenting `React.HTMLAttributes` / `ButtonHTMLAttributes` / `AnchorHTMLAttributes` with the typed values from the research docs, and `JSX.IntrinsicElements` with `selectedcontent`. It is imported **for side effects** (`import "./internal/platform-attributes.js"`) from the package entry and from every subpath `index.ts`, so each public entry carries it. Mechanism verified by the reviewer: tsdown emits `dist/internal/platform-attributes.d.mts` and an `import` of it in each entry's `.d.mts`, with no runtime import in the JS. A `.d.ts` source would not work: it is typecheck-only and never reaches `dist`. Each entry carries a comment with the DefinitelyTyped issue so it can be deleted when upstream lands. |
| Attribute react-dom serialises wrongly (`hidden="until-found"` becomes `hidden=""` on both client and server) | Render the boolean form so SSR output is correct, then upgrade in a layout effect through the part's ref (`el.setAttribute("hidden", "until-found")`), and listen to the platform event that the browser uses to undo it (`beforematch`) to dispatch the matching change action. Encapsulate each such case in one internal hook (`use-until-found.ts`) so the workaround has exactly one home. |
| Attribute that must act on the client but must not be in the server HTML (Combobox Trigger's `commandfor` / `command`, #112: the invoker relationship exempts its press from light dismiss, but a pre-hydration command would open an empty, button-anchored popup) | Not rendered; written with `setAttribute` from the part's ref callback once the element is known to be a `<button>` (removed in the cleanup), so hydration never sees it and the click handler that cancels the command is installed before the attribute exists. The key is still owned (omitted from the props type). Named in the component design (section 3.5 lists the parts that use it). |
| Event React does not synthesize (`command`, `interest`, `loseinterest`, `beforematch`, `scrollsnapchange`) | `addEventListener` through the part's ref (or a Fragment ref for sibling groups), inside an effect that uses `useEffectEvent` for the handler body, dispatching into the component's transition like any other interaction. Never expose these as `on*` props (section 2.6: `on*` is reserved for the urgent lane, and these are interactions, not an urgent state). |
| Event React does synthesize, but the handler must be feature-detected away (Tooltip's `pointerenter` / `focus` when `interestfor` is native) | Same `addEventListener`-in-effect pattern: the effect subscribes only when the JS path is needed, so markup is identical on server and client. Because no prop-form handler is installed, none is omitted from the part's type and the consumer's `on*` props pass through (section 1.5). |
| Element whose children the **parser writes before hydration** (`<selectedcontent>`: Chromium and Safari clone the selected option's children into it at parse time, so a plain element fails hydration and client-renders the whole root) | Render it with `suppressHydrationWarning` and `dangerouslySetInnerHTML={{ __html: "" }}`, so React treats the children as opaque and the attribute mismatch is silenced (verified in `docs/research/select-combobox.md` §4: hydrates with no recoverable error, later browser writes keep working); the part has no `children` prop. One such element per component at most, named in its design doc (`Select.Value`). |
| Pseudo-class the platform already provides (`:open`, `:popover-open`, `:disabled`) | Document it next to the equivalent data attribute; do not emit a duplicate attribute when the pseudo-class carries the same meaning and the state is browser-owned. |
| ARIA state the platform changes for browser-owned state and assistive technology needs explicitly (`aria-expanded` on a Popover Trigger in JS-free mode, where no React state exists) | Render the initial value and keep it current with a DOM write from the platform event through the ref (`toggle`, reading `:popover-open`), never React state. The attribute is owned, so React's value for it never changes in that mode and the DOM write is never overwritten. One attribute per component at most, named in its design doc. |
| Styling state for a browser-owned open that CSS must see **at the open's first style recalc** and no pseudo-class carries (Tooltip's `data-instant`, a warm open, #93) | A DOM write from the platform's **synchronous** `beforetoggle` through the ref (`syncPresence`), on every path that can open the element (the native `interestfor` path included, as the interaction hook's only listener there; the placement observer's `toggle`, section 13.2, is separate), never from `toggle` (a task later: the entry transition has started and the write cancels it mid-flight, probe in `design/components/tooltip.md`'s #93 amendment) and never React state (a render cannot be placed before that recalc short of `flushSync` inside the show algorithm). Classified from the DOM at that moment (`beforetoggle` precedes the `auto` / `hint` stacking that hides other popovers), cleared at the close's `beforetoggle`, never rendered by the part (so never in server markup), no `state.<name>` counterpart. One attribute per component at most, named in its design doc. |
| Roving `tabindex` over children the library did not render (`Toolbar.Root`; a standalone `ToggleGroup.Root`, #66) | The container's engine (`internal/use-roving-focus.ts`) finds the focusable descendants in the DOM and writes `tabindex` (`0` on the current stop, `-1` elsewhere) from a layout effect after each of its commits, a `MutationObserver` on its subtree and its `focusin` / `pointerdown` handlers. Items render no `tabindex` (library item parts omit the prop from their types; a consumer's `tabIndex` on a toolbar item is unsupported), an element whose own `tabindex="-1"` the engine did not write is not an item, the engine records each element's original `tabindex` and restores it when it lets go (the native path after hydration, an element that left the container), and on the native `focusgroup` path nothing is written. Server HTML carries no `tabindex`, so before hydration every item is a Tab stop; after the first layout effect, one. |

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
   | `focusgroup` | Gecko, WebKit | `Tabs.List experimental_focusgroup`, `Menu.Popup experimental_focusgroup` (renders `focusgroup="menu wrap\|nowrap"`; items render no `tabindex` on the native path; typeahead, activation, submenu keys and Tab stay JS), `Toolbar.Root experimental_focusgroup` (`focusgroup="toolbar inline\|block wrap\|nowrap"`; the engine writes no `tabindex` and handles no navigation key where native), standalone `ToggleGroup.Root experimental_focusgroup` (the `toolbar` token under an explicit `role="group"`, plus `nomemory` and `focusgroupstart` on the first pressed Item; a ToggleGroup **inside** a Toolbar renders no `focusgroup` whatever its prop says, with a dev warning, because a nested focusgroup splits the Toolbar's single Tab stop, #66) | The List renders `focusgroup="tablist inline\|block wrap\|nowrap nomemory"` and the selected Tab `focusgroupstart`; where `focusGroup` is implemented the JS arrow-key handling steps aside and unselected Tabs render no `tabindex` (#43). |
   | `interpolate-size` / `calc-size()` | Gecko, WebKit (TP) | `Accordion.Root experimental_interpolateSize` | Inherited property set on the root; `::details-content` height animates to `auto` natively. |
   | `<dialog closedby>` | WebKit (TP) | `Dialog.Popup experimental_closedBy` (the part that renders the attribute; camelCase like `experimental_interestFor`) | Native light dismiss instead of JS. |
   | Customizable `<select>` | Gecko (pref) | **none** (withdrawn 2026-10-17, Select design #50) | The markup (`<button>` + `<selectedcontent>`, rich options, `<legend>` in `<optgroup>`) is parsed everywhere and degrades to the native select; the opt-in is the consumer's CSS (`appearance: base-select`), so no library flag exists. |
   | `<input type="checkbox" switch>` | Blink (proposed), Gecko | `Switch experimental_switch` (future; not added while WebKit-only) | Native switch rendering and semantics; `role="switch"` already gives the semantics everywhere. |

   Two flags with the same graduation path go on the same part as separate props, not one
   object, so each can be removed independently.

   Adopted without a flag because every stable engine has it: `Element.ariaNotify()` (Chrome
   141, Firefox 150, Safari 27; Combobox announcements; NumberField's step announcements, #67,
   through `internal/announce.ts`, which speaks through `ariaNotify()` where it exists and
   otherwise through one module-level `role="status"` live region in `document.body`; a
   component announcing through it renders no live region of its own). Recorded as a future `experimental_`
   rendering candidate: the Open UI customizable combobox (`<input list>` + `<datalist>` with
   `appearance: base`), Chromium `experimental` only.

2. **Whole component that cannot exist without a flagged feature: the `@funstack/ui/experimental`
   subpath**, same namespace shape, documented as unstable. Nothing in the initial four needs this
   (each has a non-flagged baseline per the research docs).

3. **No provider / global config in v0.** A global switch hides a per-site browser decision in a
   place far from the markup, and Server Components cannot create context anyway.

When the flagged path is a strict superset of the baseline (Chromium's `interestfor` tooltip
versus the JS fallback), the component may feature-detect at runtime *only when the flag is on*;
with the flag off it runs the baseline everywhere. Feature detection reads a prototype property
(`"interestForElement" in HTMLButtonElement.prototype`, `"focusGroup" in HTMLElement.prototype`;
IDL attributes are camel-cased, and `"focusgroup" in HTMLElement.prototype` is always false,
issue #43) inside an effect, through `useSyncExternalStore` with a server snapshot of `false`, or
`use(browser())`, never during a server render or hydration, so flags never change markup between
server and client renders. When the detected answer has to change markup (Tabs renders no
`tabindex` on unselected tabs on the native `focusgroup` path, because Chromium leaves
`tabindex="-1"` elements out of the group), `useSyncExternalStore` is the form to use: hydration
renders the server answer and React re-renders with the client answer afterwards. A flagged feature that silently does nothing in unsupported engines
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
    use-controllable-action.ts  # section 3.4; also intendedValue (3.8 rule 1)
    use-action-trigger.ts   # section 3.4: pure triggers
    use-superseded-rejection.ts  # section 2.4: the catch-store-throw both hooks share
    use-render.tsx          # resolves render / className / style / children against state
    render-element.ts       # the directive-free half of use-render: renderElement, rendersButton, isHostButton, disabledButton (1.2)
    merge-props.ts          # mergeProps, mergeRefs, mergeTokenLists; directive-free
    use-merged-refs.ts      # useMergedRefs(...refs): the memoised ref merge of every part with a library ref (1.4)
    use-latest.ts           # useLatest(value): a ref written in an insertion effect
    use-dev-warning.ts      # useDevWarning(condition, isDev && message) (7.2)
    use-element-check.ts    # useElementCheck(isDev && (el) => ...): the rendered-element dev check, once per instance (7.2)
    use-name-warning.ts     # useNameWarning / useShownNameWarning: the accessible-name dev checks; BUTTON_NAME / TEXT_NAME (7.2)
    dev-warn.ts             # warnOnce for directive-free parts (progress.md 14)
    use-form-reset.ts       # section 3.8
    use-form-owner-event.ts # section 3.8; declares FormAssociatedElement
    use-native-checked.ts   # section 3.8; also exports guardCheckableChange
    use-native-group-reconciliation.ts  # section 3.8
    use-native-select-value.ts  # section 3.8 (Select)
    use-checkable-input.ts  # section 3.8: Checkbox / Switch
    use-fieldset-group.ts   # section 3.8: RadioGroup.Root / CheckboxGroup.Root
    group-member.ts         # section 3.8: a group Item's owned input layer
    sync-presence.ts        # hydration-time attribute presence sync (3.8)
    use-item-order.ts       # section 3.8: the Items' document order in state (CheckboxGroup, ToggleGroup)
    value-set.ts            # set / order arithmetic of the set-valued components; directive-free
    dom-order.ts            # compareDocumentOrder, sortByDocumentOrder; directive-free
    field-context.ts        # FieldContext, FormContext, fieldDataAttributes (7.1)
    use-field-control.ts    # useFieldControl, useFieldValueChange, fieldInputProps, resolveFieldDefaults (3.8)
    validity.ts, focus-first-invalid.ts  # Field helpers; directive-free
    toolbar-context.ts      # section 7.1: ToolbarContext, read across folders (#66)
    use-roving-focus.ts     # section 7.4: DOM-written roving tabindex (#66)
    arrow-keys.ts           # resolveArrowKey, focusWithRing (Tabs.List, the roving engine); directive-free
    use-native-focusgroup.ts  # useNativeFocusgroup(flag): the native `focusgroup` detection (section 8)
    use-overlay-root.ts     # useOverlayRoot, popoverDetails, OverlayRootValue (popover.md 14.1): Popover, Menu, Combobox, Dialog
    use-popover-popup.ts, use-popover-trigger.ts  # popover.md 14.2 / 14.3
    overlay-popup.tsx       # renderOverlayContent, useCloseHold, useInitialFocusTarget, returnFocusToTrigger, commandOf, useJsFreePropWarnings (popover.md 14.2)
    use-overlay-close.ts    # useOverlayClose: the one Close part of Popover and Dialog
    content-focus-probe.tsx # useContentFocusProbe (popover.md 6.2)
    use-exit-animation.ts   # held content while an exit animates (popover.md 4.4)
    popover-open.ts         # isPopoverOpen(element); directive-free
    anchor-position.ts      # positionArea, parsePositionArea, POSITION_TRY_FALLBACKS (section 13); directive-free
    use-resolved-placement.ts  # useResolvedPlacement, useAnchoredPlacement (13.2)
    shipped-styles.ts       # FSUI_PRECEDENCE (section 12); directive-free
    use-hydrated-mount.ts, use-register-count.ts, use-delayed-pair.ts, use-until-found.ts, use-modal-registration.ts, modal-registry.ts, announce.ts, decimal.ts, range-value.ts, csp-context.ts, tooltip-warm.ts, form-status-watcher.tsx
  __tests__/
    vitest.setup.ts
    helpers.tsx             # section 10
  toggle/
    index.ts
    toggle.tsx
    toggle.test.tsx
  button/                   # #79; replaced toolbar/toolbar-button.tsx
    index.ts
    button.tsx
    button.test.tsx
    button.browser.test.tsx
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
- Shared helpers live in `internal/`; a helper only one component's parts use lives in that
  component's folder (`menu/menu-point.ts`, `toast/toast-queue.ts`, `slider/slider-arithmetic.ts`,
  `number-field/use-step-button.ts`). A pure module (no hook, no DOM write) carries no directive
  and says so in its header comment (7.1); a model worth testing on its own gets a colocated
  unit test (`toast-queue.test.ts`, `slider-arithmetic.test.ts`).

### 9.2 Exports

Both a root entry and per-component subpaths; the subpath is the documented form:

```tsx
import { Tabs } from "@funstack/ui/tabs";      // documented
import { Tabs, Toggle } from "@funstack/ui";   // also works
```

With an unbundled build both resolve to the same files, so there is no duplication. The exports
map is generated by tsdown from the entry list (section 7.2); adding a component means adding its
`index.ts` to `entry`. One subpath is not a component: `@funstack/ui/csp` (`CSPProvider`,
`STYLE_SHA256`; section 12, wave 11).

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
A command-input component also exports its function(s) by name from the same `index.ts`
(`export { toast, createToastManager } from "./toast.js"`; section 1.1), and the root entry
re-exports them.

### 9.4 Public types

- `<Component><Part>Props`, `<Component><Part>State`; single-part components drop the part:
  `ToggleProps`, `ToggleState`.
- `<Component><State>ChangeDetails` extends `ActionDetails`; when it exposes `reason`, the
  member is `readonly reason: ChangeReason` (never a local union). The urgent handler's details
  type keeps the same name (`ComboboxInputValueChangeDetails`): it describes the change, not
  the lane.
- Shared: `Action`, `ActionDetails`, `ChangeAction`, `UrgentChangeHandler` (section 2.6; was
  `UrgentChangeAction` before #96),
  `ChangeReason`, `RenderProp<Props, State>`, `StateValue<T, State> = T | ((state: State) => T)`,
  `ViewTransitionClass` (the `transition` prop's type, section 5.2).
- Props interfaces are `interface`s extending the element props (section 1.5); state objects are
  `interface`s with readonly members. A component whose parts **all share one state object**
  may export a single `<Component>State` (`FieldState`; `ProgressState` / `MeterState`, with
  `MeterRegion` exported, #68) instead of one alias per part (#54).
- A component whose value has two shapes may be **generic** with a default
  (`SliderRootProps<T extends SliderValue = number>`, inferred from `value` / `defaultValue`);
  the shape is fixed at mount (a switch warns in development, like a mode switch).
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
| Superseded rejection (both) | Two dispatches; the older rejects **after** the newer resolved, and separately **while** the newer is still pending. In both cases the error reaches an Error Boundary around the component (React alone drops it, section 2.4); the newer action's outcome is unaffected. Required in every component's test file, once per mode, even though the shared hook has its own tests: the component decides how dispatches are wired (which part owns the transition, platform-initiated dispatches), and that wiring is what these rows guard. A pure trigger that ignores re-entry (#79; every pure trigger since #81) declares this row and the Overlap row N/A with that reason: it never has two of its own runs in flight. The rows stay required for state owners and for the step actions of continuous controls. A component with two channels (Slider, NumberField) also pins the **cross-channel** case: a superseded rejection on one channel while the other channel's action pends reaches the boundary without waiting for it (section 2.4), in both directions. |
| Re-entry (pure trigger) | Required for every pure trigger with the guard on (section 2.5; `Button`, #79): while a deferred action pends, a second click, an Enter and a Space each leave the action at one call and are `defaultPrevented`; two synchronous clicks in one `act` call it once (the in-flight counter); a click after the action resolved but before its commit (held by an unrelated pending action) **runs again** while the element still shows `data-pending` (the guard is the counter only; a non-awaiting action clicked three times under that hold is called three times); after settle the next activation runs; `aria-disabled="true"` is present exactly while `data-pending` is and `data-disabled` is not; focus stays on the element throughout; a pass-through `onFocus` / `onPointerEnter` still fires while pending; a `render`ed link's second click is cancelled. |
| Suspending content (both) | Content keyed on the new value suspends: old content stays, no fallback shown by a boundary above the component, `data-pending` on; after resolve, new content. |
| Function props | `className`, `style`, `children`, `render` receive the documented state and the attributes agree with it. |
| `render` element | Element form replaces the default element, merges `className`/`style`, keeps the library's handler working, forwards `ref`. |
| Post-await rule | A controlled parent updating after its own `await` inside `startTransition` works end to end (guards the documented pattern). |
| Directive | Each built part file starts with `"use client"` or not, exactly as the component's design doc records (script over `dist`, run in `test:run` after `build`). A design may record a **directive-free Root** (Progress, Meter, #68). |
| Platform path (both) | Required for every component with a residual browser path (section 3.5): mount reconciliation (`renderToString`, change the DOM before `hydrateRoot`, exactly one dispatch with `reason: "platform"` and `event === undefined`, StrictMode still one) and, for native form controls, form reset through `<button type="reset">`, `form.reset()` and React's automatic reset after a successful `<form action>` (one dispatch per state owner with the `reset` event; a cancelled `reset` dispatches nothing; a controlled parent that refuses gets the DOM re-synced after settle); for a control with a hidden native input (NumberField, #67), every path leaves the hidden value equal to the shown value. |
| Lanes | Required for a state that is urgent by design (section 2.6, Toast): with an unrelated `useTransition` action pending (a deferred), the command called inside that action's sync prefix, inside a consumer `startTransition`, and plainly, all commit before the action settles; several commands in one tick keep their order. The component also lists the rows it declares N/A for lacking an `x` / `defaultX` triple (controlled parity, post-await, optimistic, platform path, urgent handler) in its top-of-file comment. |
| Continuous control (both) | Required for a component with a step / commit pair (section 2.1, Slider; NumberField's press-and-hold, #67): between two steps the shown value never reverts to the committed value (with a synchronous step action that has settled); a rejected commit reverts the whole gesture to its start value; a gesture that returns to its start value dispatches steps and no commit; a trailing platform `change` with an unchanged value dispatches nothing. |
| Form channel | Required for every part that exposes `useFormStatus` as its `pending` (`Field.Root`, `Form.Root`, `Form.Submit`): `data-pending` appears while a deferred form action is unresolved and disappears after it settles (also through a portal); a control inside keeps its own `data-pending` for its own action. |
| Inside a Field | Required for every form control (Switch, Checkbox, RadioGroup, CheckboxGroup, Select, Combobox, Slider, NumberField): rendered inside a `Field.Root`, the part's element (or group element) receives the Field's `id` (or `aria-labelledby`), `name`, `aria-describedby`, `aria-invalid`, and `disabled` / `required` from the Field; its own `data-pending` is unaffected by the form's. |
| Validity display | Required for Field: a submission attempt with an invalid control shows the message, cancels the native bubble (the `invalid` event is `defaultPrevented`) and focuses the first invalid control in document order; a `form.reset()` clears it. The `:user-invalid` half (changed-then-blurred, live updates, `checkValidity()` showing nothing) runs in browser mode. |
| Urgent handler (both) | Required for every component with an urgent state (section 2.6): the handler is called synchronously once per DOM event, outside any transition (a `useTransition` probe in the parent never reports pending for it), with the native event; a controlled parent that sets state in the body keeps the DOM in sync per keystroke; a returned thenable warns once; a library rollback write after a **synchronously throwing** transition action is outside a transition as well (section 2.6). |
| Lanes (consumer) | Required for a component that displays a value a pending action reports (Progress, #68): a post-`await` urgent `setState` renders before the action settles, and a `startTransition`-wrapped one does not. |
| Action naming (type, library-wide) | One file, `src/__tests__/action-naming.test.ts` (#96): for **every public `*Props` type** exported from `src/index.ts`, every key named `action` or ending in `Action` is a transition action, and every library-defined `on*` key is on an allow-list that names its type (`ComboboxRootProps.onInputValueChange: UrgentChangeHandler<string, ComboboxInputValueChangeDetails>`). "Is a transition action" is checked on the **function members** of the prop's type (`Extract<NonNullable<P[K]>, (...args: never[]) => unknown>`): that part must exist and return `unknown` (an `Action` / `ChangeAction`; `UrgentChangeHandler` returns `void` and fails; a key with no function member, say a `string`, fails too). Checking the function part rather than the whole type is what lets `Form.Root`'s `action: string \| ((formData) => unknown)`, React's form channel, pass on its function member instead of failing on the URL string. **DOM pass-through keys are excluded from both checks**, by name, as the union `keyof DOMAttributes<Element> \| keyof DialogHTMLAttributes<HTMLDialogElement> \| keyof ButtonHTMLAttributes<HTMLButtonElement> \| keyof InputHTMLAttributes<HTMLInputElement>`: `DOMAttributes` alone is not enough, because `<dialog>`'s `onCancel` / `onClose` (passed through by `Dialog.Popup` and `Popover.Popup`) live in `DialogHTMLAttributes`, and `<button>` / `<input>`'s `formAction` (`string \| (formData) => void \| Promise<void>`) would otherwise be flagged as a non-transition action. These are React's names, not the library's, and cannot be told apart from library props by type, so the design doc is the guard for them. The helper types have a self-test (a planted `inputValueChangeAction?: UrgentChangeHandler<string>` and a `labelAction?: string` are caught, `action` and `formAction` are not; `onClick` / `onClose` are excluded, `onValueChange` is not). A new public Props type is added to the list in the same commit that exports it (a type-level and a runtime completeness check against `src/index.ts` fail until it is). |
| Server render | Required for a directive-free Root (Progress, Meter, #68): `renderToString` equals the client markup, and the Root module's import graph reaches no `"use client"` module but its own context. |
| Placement | Required for every part that renders an anchored `position-area` (Tooltip, Popover and Menu `Popup`; Combobox `Popup` for the RTL half). jsdom: the `side` / `align` matrix produces the section 13 keywords; `data-side` / `data-align` equal the requested values with no layout; with `getComputedStyle` stubbed to a flipped `position-area` and the shim's `toggle`, they become the resolved values, return to the requested ones on close, and an unchanged value causes no render (render counter); a logical `side` costs exactly one render per show and one per hide (render counter, review M1); the scroll path deterministically (review M2): with `requestAnimationFrame` replaced by a manual queue and `document.addEventListener` spied, a show installs the `scroll` / `resize` listeners, a dispatched `scroll` with the stub changed reads the old value at once and in frame 1 and the new one in frame 2, a scroll between the frames re-runs the pair, a scroll **before** the first frame of a pending pair costs at most one extra pair at the end (it sets the same restart flag), and a hide or an unmount removes both listeners, cancels the pending frame and reads nothing after. Browser (`*.browser.test.tsx`, all three engines): `data-side` after an edge flip on open, back on close; after a scroll that moves the trigger to an edge, `data-side` equals the side the popup box actually sits on (the geometry invariant: Chromium keeps the option chosen at show, #92; Firefox and WebKit re-choose, section 13.2), never "flips to X", with the engine outcome pinned behind a runtime probe so the Chromium row fails the day the bug is fixed (review L5); `align="start"` and `side="inline-end"` under `<html dir="rtl">` (mirrored in every engine); the same inside a `dir="rtl"` **container** branching on `anchorPositionHonoursParentDirection` (`src/__tests__/engine.ts`, a runtime probe of Mozilla 2019601): mirrored where it holds, and where it does not (Firefox) the documented misplacement is asserted, never skipped. |

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

## 11. Built-in strings

The library ships no CSS and, until Combobox, shipped no text. It now ships **one kind of
text**: strings assistive technology needs that a consumer could forget to supply (Combobox's
result-count announcement through `ariaNotify`). Rules (user decision, Combobox #50, resolved
question 27):

- A built-in string exists only where its absence is an accessibility gap, never for visible
  UI (no "Loading…" labels, no placeholder text, no button captions).
- The default is **English**, written in the component's design doc and its props table, so a
  consumer can see what will be announced.
- It is **always overridable** through a prop that takes a **function** of the relevant state
  (`announce(count, state)`), never a plain string, so a localised message can depend on
  pluralisation and state; returning `null` announces nothing.
- The library ships **no locale mechanism** (no provider, no `lang` detection): localisation is
  the consumer passing the function, and the docs show the one-liner next to every example.
- Toast (#54) adds two: the announcement default (the `textContent` of `Toast.Title` and
  `Toast.Description`, a function of the toast, overridable through `announce(toast)` per toast
  or per Viewport, `null` for silence) and the region's accessible name `"Notifications (F8)"`
  (following `hotkey`). The name is **static**, so its override is the ordinary `aria-label`
  pass-through rather than a function prop: the function form exists for strings that depend on
  state, and a label with no state would only add a prop.
- Field (#54) adds **no** string: `Field.Error`'s default text is the browser's own localised
  `validationMessage` (a platform string, not a library one), and the override is the function
  form of `children` (`({ validity, messages }) => …`), per `ValidityState` key.
- Progress and Meter (#68) add **no** string either: the default `aria-valuetext` is
  `Intl.NumberFormat`'s localised output (a platform string, like Field's `validationMessage`),
  there is no default text while indeterminate, and the override is `getAriaValueText(value,
  state)` (function of state), with `format` / `locale` as the serialisable path.
- NumberField (#67) adds two **static** strings, `"Increase"` and `"Decrease"` (the buttons'
  default `aria-label`s), overridden through the ordinary `aria-label` / `aria-labelledby`
  pass-through (Toast's region-name rule); the announced stepped value is the formatted text,
  not a library string, overridable through `announce(value, state)`; no `aria-roledescription`
  and no string for it.

---

## 12. Shipped functional CSS

**User decision, 2026-10-22** (Context menu, #45, resolved question 35): a component may ship a
**minimal functional stylesheet, positioning only and nothing visual**, through React
`<style href precedence>`, where inline styles cannot express the rule; it must be documented
and overridable.

The library ships no visual CSS: no reset, no theme, no colours, sizes or motion (section 11's
"ships no CSS" stands for everything a stylesheet could do to the look of a part). A component
may ship **functional at-rules** it needs and cannot express inline, under these rules:

- **Only at-rules with no selectors** (`@position-try` options for placement are the first
  case, `Menu.Popup`'s point placement, `design/components/context-menu.md` 4.2: eight options
  since wave 11, mirrored for a right-to-left menu and offset for a touch open, #88). Nothing
  cascades onto any element; the inline `style` the part renders is what references the rules.
  **Exception, user decision 2026-10-23 ("allow it"; wave 11, #21):** a rule whose selector
  matches only elements the library itself marks with a `data-fsui-<component>-<part>`
  attribute, and whose declaration sets only a `--fsui-` registered custom property that the
  part's own inline `style` consumes (`@property` plus `:root:has([role="tooltip"]:popover-open)
  [data-fsui-tooltip-trigger] { --fsui-tooltip-warm: 1 }`, Tooltip's skip-delay on the native
  `interestfor` path, `design/components/tooltip.md` 6). Still nothing visual and nothing on a
  consumer's element; the selector exists because the inline value it feeds cannot see other
  elements. The scope of shipped CSS is thereby **"placement and interaction timing, never
  visuals"** (the user's wording), superseding "positioning only" above.
- **Rendered by the part that needs them**, as a React 19 hoisted style, never as a stylesheet
  file the consumer imports: `<style href="@funstack/ui/<name>" precedence="fsui">`. React moves
  it into `<head>` in the commit (before layout effects), deduplicates it by `href` across
  roots, and nothing lands in place, so the part still renders one DOM element and a
  `<ViewTransition>` boundary around that element is unaffected. Rendered only while the part
  uses the rules (a point-placed menu), so a page that never does never gets them.
- **Names are prefixed** `--fsui-<component>-…` so they cannot clash with a consumer's.
- **Opt-out through the part's existing switch** for stylesheet-owned placement (`side={null}`
  on a Popup): then the part renders neither the inline reference nor the style, and hands the
  consumer the data (custom properties) their own rules need.
- **CSP** (corrected in wave 11, #88, `docs/research/interaction-wave11.md` 2.4; the earlier
  text here said a hoisted `<style>` needs nothing an inline `style` attribute does not, which
  is wrong). Under a nonce- or hash-based `style-src`, a **client-set inline style is exempt**
  (react-dom writes the `style` prop through the CSSOM) but a **script-inserted `<style>` is
  blocked** unless its text matches a `'sha256-…'` source or it carries the nonce; a
  **server-rendered `style` attribute** is blocked too without `style-src-attr 'unsafe-inline'`
  (so the SSR'd `position-area` of an anchored popup and Tooltip's inline `interest-delay-*`
  need that directive, as every inline-style library does; documented, not worked around).
  The library therefore: (1) exports the **SHA-256 (base64) of every shipped stylesheet** as
  `STYLE_SHA256` from `@funstack/ui/csp`, a committed constant whose jsdom row recomputes it
  from the exported CSS strings so it cannot drift, and the docs' "Content Security Policy"
  page prints the `style-src` sources; this serves hash-based policies and FUNSTACK Static's
  static output with no API; (2) ships **one provider**, `<CSPProvider nonce>` from
  `@funstack/ui/csp` (a client module with a serialisable prop, so a Server Component layout
  renders it once; the library's only provider, decision 8's "no provider" being about
  experimental flags), whose context every part that renders a hoisted `<style>` reads and
  forwards as the element's `nonce`; the docs say "pass the same value as React's `nonce:
  { style }` render option". Fizz's behaviour (react-dom 19.3.1, probed in the Part B review,
  L1): with no `nonce` render option or the string form, a provider's nonce is **stripped**
  and the rules are kept (a nonce policy then blocks them in the browser); with the object form
  and a matching provider they carry the nonce; with the object form and a **different** nonce
  **or no provider at all**, the rules are **dropped** (an empty `<style>`), which is the case an
  app hits when it already passes `nonce.style` for its own CSS, so the docs say in one line:
  "if you pass `nonce.style`, render `<CSPProvider>` with the same value". This matters for
  the first stylesheet that renders during SSR (Tooltip's skip-delay, rendered by a Trigger
  with `experimental_interestFor`); Menu's point rules render only after a client interaction.
  **At most one shipped stylesheet may render during SSR per precedence bucket** (review L2):
  Fizz writes every `<style href precedence="fsui">` of one flush as a single element
  (`data-href="a b"`, texts concatenated), whose hash is in no `STYLE_SHA256` entry; a second
  server-rendered stylesheet gets its own precedence, and a guard row (`csp.test.tsx`, landed
  in a02e316) renders Tooltip and a context menu on the server and asserts exactly one `fsui`
  `<style>` in the head whose text hashes to its `STYLE_SHA256` entry; the constraint is
  commented on `FSUI_PRECEDENCE`. No implicit `<meta property="csp-nonce">`
  read. A blocked stylesheet degrades: the point menu opens at the point but never flips; the
  skip-delay inline value carries an explicit `var(--fsui-tooltip-warm, 0)` fallback so it
  computes to the Root's `delay` (without the fallback an unregistered property makes the
  `var()` invalid and `interest-delay-start` falls to the UA's `normal`, 500 ms in Chromium;
  review M1).
  Human items: FUNSTACK Static's SSR entry passes a string `nonce` (scripts only) and would
  need the object form for styles; React could emit the render nonce instead of dropping the
  rules (`docs/research/interaction-wave11.md`, "Upstream issues"; tracked with Firefox's `overscroll-behavior` gap as issue #91).
- The CSS text lives in a directive-free module of the component that ships it
  (`menu/menu-point.ts` for the point rules, `internal/tooltip-warm.ts` for the skip-delay
  rule; the precedence name `FSUI_PRECEDENCE` in `internal/shipped-styles.ts`), as a string
  constant, and is covered by a jsdom row (one
  `<style>` in `document.head` after use, none without) and a browser row (the computed
  property names the option).

---

## 13. Anchored placement

**Accepted 2026-10-23** (product owner; wave 11: #20 resolved side, #53 container RTL, #88 RTL
point placement; `docs/research/positioning-wave11.md`, whose verdicts are binding; the
decisions are recorded in the component amendments, resolved question 36). Applies to every
part that places a top-layer element against an anchor: Tooltip, Popover and Menu `Popup` (the
`side` / `align` matrix), Combobox `Popup` (fixed keywords) and the Select docs recipe for
`::picker(select)`; and to the one part placed at a point (Menu's context open). The per-part
details and migration notes are in the component documents' wave 11 amendments.

### 13.1 Keyword policy

The browser places the popup (vision principle 5); the library emits `position-area` and
`position-try-fallbacks` inline and reads nothing to choose them. Three rules follow from how
the spec resolves keywords on a top-layer element (css-anchor-position-1 §3.1.2: a **plain**
logical keyword refers to the writing mode of the **containing block**, which for a popover in
the top layer is the initial containing block, so the root's direction; a **`self-*`** keyword
refers to the popup's **own** writing mode, which it inherits from its DOM parent):

1. **Never a plain logical keyword** (`block-end`, `span-inline-end`, `end`) on a top-layer
   popup. It ignores a `dir="rtl"` container (#53) and the CSSWG resolved this is intended
   (w3c/csswg-drafts#13734; #13738 moved the customizable-select picker to `self-*` for the
   same reason). The physical keywords (`top`, `span-right`) and the `self-*` group are the
   library's whole vocabulary.
2. **Direction-following placement uses `self-*` keywords, never a JS read of `direction` to
   pick physical ones.** The popup inherits `direction` from the DOM parent the consumer
   rendered it in, so `self-x-end` is "the popup's inline-end" with no script, no stale value
   when `dir` changes, and the right answer on the server. (The exception is a popup with no
   anchor, 13.4: insets have no `self-*` form.)
3. **Keyword groups cannot be mixed.** `block-end span-self-inline-end` and `bottom span-end`
   are invalid and dropped at parse time. Valid pairs are one group each: physical with
   `self-x-*` / `self-y-*` (`bottom span-self-x-end`, `self-x-end span-bottom`), or
   `self-block-*` with `span-self-inline-*` (`self-block-end span-self-inline-end`). The
   combobox note "Firefox lacks `span-self-inline-end`" was this trap, not an engine gap: BCD
   lists every `self-*` keyword in Chrome 129+, Firefox 147+, Safari 26+.

The matrix the shared helper (`internal/anchor-position.ts`, directive-free) emits, assuming
`horizontal-tb` (the library does not design for vertical writing modes; `block-start` /
`block-end` would add nothing over `top` / `bottom` there):

```ts
export type AnchorSide = "top" | "bottom" | "left" | "right" | "inline-start" | "inline-end";
export type PhysicalSide = "top" | "bottom" | "left" | "right";
export type AnchorAlign = "start" | "center" | "end";
export function positionArea(side: AnchorSide, align: AnchorAlign): string;
```

| `side` \ `align` | `start` | `center` | `end` |
| --- | --- | --- | --- |
| `top` | `top span-self-x-end` | `top` | `top span-self-x-start` |
| `bottom` | `bottom span-self-x-end` | `bottom` | `bottom span-self-x-start` |
| `left` | `left span-bottom` | `left` | `left span-top` |
| `right` | `right span-bottom` | `right` | `right span-top` |
| `inline-start` | `self-x-start span-bottom` | `self-x-start` | `self-x-start span-top` |
| `inline-end` | `self-x-end span-bottom` | `self-x-end` | `self-x-end span-top` |

- **`side`**: `top` / `bottom` / `left` / `right` are physical, as before. `inline-start` /
  `inline-end` (new) follow the popup's direction: `inline-end` is the right of the anchor in
  LTR and its left in RTL. Menu's submenu default is `inline-end`, so the submenu opens on the
  side the already-mirrored ArrowRight / ArrowLeft keys point to. Vertical logical sides are
  not offered (see above).
- **`align`** on a horizontal side (`top` / `bottom`) is **inline-relative**: `start` aligns
  the popup's inline-start edge with the anchor's (`span-self-x-end`: the popup spans toward
  the popup's inline-end), `end` the inline-end edges. On a vertical or inline side it is
  block-relative and physical: `start` aligns the top edges (`span-bottom`), `end` the bottom
  edges. In an LTR document nothing changes from the previous physical matrix; under RTL,
  `start` / `end` are now mirrored, as a reader of "start" expects and as React Aria and the
  direction-aware Floating UI libraries do.
- **`center`** stays the single-keyword form (the span-all cell is `anchor-center` aligned).
- `position-try-fallbacks` is unchanged (`flip-block, flip-inline, flip-block flip-inline`;
  `flip-inline` for a submenu). The `flip-*` tactics flip the containing block's axes, which in
  `horizontal-tb` are the x and y axes whatever the direction, so they apply to `self-x-*`
  tokens too (verified: `self-x-end span-bottom` flips to `self-x-start span-top`).
- **Combobox** uses the fixed `self-block-end span-self-inline-end` with `flip-block` (no
  `side` / `align`); **Select**'s docs recipe for `::picker(select)` uses the same spelling.

### 13.2 Resolved placement: `data-side` is where the popup is

Every engine reports the **applied** `position-try-fallbacks` option in
`getComputedStyle(popup).positionArea`, synchronously after `showPopover()`, in the `toggle`
event and inside a `scroll` handler (research 1; Chromium and Firefox probed, WebKit by source:
the chosen option is a full style resolution). So the library can tell where the popup landed
with no geometry: parse the computed value, map it to a physical side and an alignment. This
replaces the requested-value echo that made an arrow point the wrong way after a flip (#20)
and answers tooltip.md's "a resolved `data-side` is exactly the positioning JS the design
avoids": it is observation, the browser still places.

**One vocabulary, one meaning.** `data-side` / `data-align` and `state.side` / `state.align`
**are the resolved placement while the popup is shown** and the requested values otherwise (on
the server, while closed, and when the computed value cannot be mapped). No second attribute
(`data-resolved-side`): a CSS recipe for an arrow or a gap would otherwise need two selectors,
and nobody needs "the side I asked for" as an attribute, since they asked for it. Floating
UI-based libraries (Radix, Base UI) expose the resolved side under the same name.

The parser (`parsePositionArea(value, selfDirection, rootDirection, writingMode)` in
`internal/anchor-position.ts`, pure, total: it returns `null` rather than throwing;
`rootDirection` may be a function, read lazily; `writingMode` other than `horizontal-tb` gives
`null`) maps the full keyword grammar in `horizontal-tb`:

- The side token is the one that is neither `center`, `span-all` nor `span-*`. Physical tokens
  map directly; `self-x-*` / `self-inline-*` through the popup's computed `direction`;
  `x-*` / `inline-*` through the root's (read lazily, only when such a token appears: a
  consumer `style` override may use them); `y-*` / `block-*` / `self-block-*` and a bare
  `start` / `end` / `self-start` / `self-end` in first position are the block axis (`top` /
  `bottom`).
- The align token is the `span-*` token, mapped to a physical direction the same way, then to
  `start` / `end` relative to the side's cross axis (inline-relative on a horizontal side: the
  popup's inline-end is `start`; block-relative on a vertical side: bottom is `start`). No
  span token, `center` or `span-all` is `center`.
- Engines serialise in grammar order and in short logical forms: `span-left top`, `top`,
  `self-end span-self-end`, `span-self-x-end bottom`, `self-x-start span-top`; Firefox writes a
  flipped single keyword as `span-all bottom` where Chromium writes `bottom`
  (`computed-serialization.mjs`). The jsdom row feeds the parser exactly these strings.
- `none`, an empty value, a vertical `writing-mode` on the popup, or any token the table does
  not know → `null`: the part keeps the requested values. The parser is only ever run on a
  shown popup.

The observer (`internal/use-resolved-placement.ts`, `"use client"`, shared by Tooltip, Popover
and Menu) is a hook: `useResolvedPlacement({ side, align }) → { side, align, ref }`. The part
merges `ref` into its popup element's ref and renders the returned values.

- **Sources.** A `ResizeObserver` on the popup from mount: a popover going from hidden to
  shown is a resize (`0 × 0` to its size), delivered after layout and **before paint**, so the
  first painted frame already carries the resolved side; a content resize while shown can
  change the fit, so it reads again; hidden again is a reset. `toggle` on the popup (open:
  read, and install the two listeners below; closed: remove them and reset); it is also what
  drives the jsdom row, which has no `ResizeObserver`. While shown: `scroll` on the document
  (capture, passive: nested scrollers included) and `resize` on the window. **Each `scroll` /
  `resize` reads at once and again in the next two animation frames** (coalesced; a scroll
  during a pending pair re-runs it at the end). **Both engines apply scroll-dependent
  anchoring one frame after the `scroll` event**, geometry included: in the handler, after a
  forced layout and in a frame registered from the handler the computed `position-area` and
  the popup's rect are still the old ones; they are current at the second frame. The timing is
  unspecified (css-anchor-position-1 §3.3 leaves the snapshot timing open), so the frame reads
  are the mechanism, not a Firefox special case (review M3). **Chromium 156 additionally does
  not re-run position-try fallback for a top-layer popover** once a few frames have passed
  since the show: an option that now overflows is kept and the popup is scroll-compensated
  off screen, while a non-top-layer `position-anchor` element in the same layout re-chooses
  on every scroll; that is non-conformant (§6.5 re-chooses whenever the box overflows and
  another option fits) and is the human upstream task **#92**, cited from the scroll rows.
  The research probe scrolled in the same task as the show, the one case Chromium re-chooses.
  Either way `data-side` reports what is applied; the library does not try to force a
  re-choice (a later fallback-sensitive change does not trigger one either).
- **Write.** A plain `useState` in the part (`flushSync` from the observer and event paths so
  the attribute lands before paint; a plain `setState` from the layout effect that re-reads
  when the request changes), written only when `side` or `align` changed (section 3.5);
  `null` while not shown **and when the parsed pair equals the request**, so the comparison is
  against what was last written. Returned value: the resolved pair, else the requested one. A
  popup **with a physical `side`** that opens without flipping costs **no render**, which keeps
  Tooltip's "no React work per hover" (tooltip.md 4.1); a flip costs one render on open and one
  on close. **A logical `side` (`inline-start` / `inline-end`) always costs that one render on
  open and one on close**, since the physical `data-side` never equals the logical request
  (review M1; inherent: the attribute must turn physical while shown). Menu's submenus pay it
  by default; a jsdom render-count row pins "exactly one per show and one per hide". The "only
  when changed" rule also terminates the `ResizeObserver` loop a consumer's `[data-side]`
  padding rule could otherwise start. A popup hidden but still rendered (exit animation) keeps
  the resolved value until its box goes.
- **Gap recipes must be symmetric.** `flip-block` / `flip-inline` swap the popup's **own
  margins** along the flipped axis, so a one-sided gap keyed on the resolved side
  (`[data-side="top"] { margin-block-end: 6px }`) is applied as `margin-block-start` once the
  flipped option is in force: gap 0 against the trigger (measured in both engines; with v0's
  requested-value `data-side` the swap was what put the gap right). Two correct recipes
  (review L4), both documented:
  1. **A static margin on the requested edge, not keyed on `data-side`** (the preferred form
     when a class knows its `side`): `margin-block-start: 6px` for a popover below its
     trigger, `margin-inline-start: 2px` for a submenu. The flip swaps it to the right edge by
     itself, it is present at the first layout (no gap-less first frame), and it changes with
     nothing, so it never triggers a re-choice. The Combobox example already does this.
  2. **A symmetric margin along the side's axis keyed on `data-side`**, when one class serves
     several sides: `margin-block: 6px` for `top` / `bottom`, `margin-inline: 2px` for `left`
     / `right` **and for the closed values `inline-start` / `inline-end`**, which a logical
     side carries until the observer writes; without those keys the first layout of every
     submenu open has no gap, and the write is then a margin change, a fallback-sensitive
     change (§6.5.1) that re-runs the choice and, in a width-constrained cell, can trip a
     "ResizeObserver loop" error. The symmetric form also flips a few pixels early (the far
     margin is part of the overflow test).
  A one-sided margin keyed on the resolved `data-side` is the one wrong form. An **Arrow** is
  unaffected: the insets of a child are not part of the option.
- **Idle** with `side={null}` (the stylesheet owns placement; the parser cannot interpret
  consumer `@position-try` rules that set insets) and for a point-placed menu (no anchor): no
  reads, nothing emitted, as today.
- **Not covered.** An anchor that moves through a layout shift with no scroll or resize; the
  next scroll corrects it. After a scroll-driven flip, **one frame is painted with the old
  `data-side`** (the engine applies the option a frame after the event, and the write follows
  the second-frame read), so an arrow points the wrong way for that frame; the show path has
  no such frame (ResizeObserver plus `flushSync` before paint). Chromium's anchored container queries
  (`@container anchored(fallback: …)`) would give a pure-CSS signal but are Chromium-only
  (BCD 143; Gecko and WebKit have no position), so they are a documented consumer recipe for
  `side={null}`, not library code.
- **Known cosmetic limit.** `@starting-style` is computed at the first style resolution after
  the show, before the observer's write lands, so an entry animation keyed on `data-side`
  (`[data-side="top"] { @starting-style { translate: 0 4px } }`) starts from the **requested**
  side's starting values when a flip occurred, then transitions to the resolved side's. Key
  entry animations on something direction-neutral (opacity, scale), or accept a reversed
  4 px slide on the rare flipped open. The exit uses the resolved values throughout.
- The hook attaches native listeners through the ref (section 7.4) and is independent of the
  trigger mechanism: it runs on Tooltip's native `interestfor` path as well, where the
  interaction effect attaches nothing. The research-era reading of "attach nothing" was about
  interaction; this is observation. (Product-owner question in tooltip.md.)

### 13.3 The Firefox parent-direction bug (Mozilla 2019601)

When the popup's **parent box** has a different `direction` from the root (an RTL island in an
LTR page, or an LTR island in an RTL page; `display: contents` ancestors do not count), Firefox
applies the inline-axis alignment offset of any `position-area` cell mirrored, **physical
keywords included**: `bottom span-right` under a 300..500 px anchor lands at −80 instead of
300. Every anchored FUNSTACK popup rendered inside such an island is misplaced in Firefox
today, independently of the keyword change above; the block axis and `anchor()` insets (the
point-placed menu) are unaffected.

- **No workaround ships.** `anchor()` insets fix `start` / `end` but not `center`
  (`anchor-center` is broken too), and a wrapper box with the root's direction changes layout
  and cannot be chosen on the server. One engine's bug does not earn a fallback (vision, browser
  support policy).
- **Tests assert the degradation.** `src/__tests__/engine.ts` gains
  `anchorPositionHonoursParentDirection`, a synchronous runtime probe (an RTL `div` holding a
  physical-keyword popover shown against an anchor inside it; `true` when the inline edge lands
  where the keyword says). Container-RTL browser rows branch on it, assert the mirrored
  placement where it is `true` and the documented misplacement where it is `false`, with a
  comment naming the bug, so the day Firefox fixes it the row fails and the branch is deleted.
  `browserName === "firefox"` is not used: Playwright's Firefox may be ahead of the release.
- **Human task** (never filed from an agent): comment on Mozilla 2019601 with the reduction
  in `docs/research/positioning-wave11.md` ("Upstream reports"), and suggest duplicating
  2050071 into it. Tracked as this repository's issue **#89**; cite it from tests and docs.

### 13.4 Placement at a point and direction

A popup with **no anchor** (Menu's context open, `design/components/context-menu.md` 4) is
placed with insets, which have no `self-*` form, so this is the one place the library reads
`direction` in JS: `getComputedStyle(popup).direction` (`isRtl(popup)` in `menu-dom.ts`), read
**once per open and per move** by the region's `openAt` and stored in the placement record,
so the Popup's inline style stays a pure function of state and the server never reads anything.
The popup's direction, not the region's or the OS locale's: a native RTL context menu opens to
the left of the pointer because the **UI** is RTL (Chromium Views `base::i18n::IsRTL()`, Gecko's
chrome document, GTK's `default:RTL`, AppKit's layout direction; no platform reads the page's
`dir`), and for an in-page menu the content direction is the counterpart, since it governs how
the items read. In RTL the menu's **right** edge sits at the point (`right: calc(100% -
var(--menu-point-x)); left: auto`) and the shipped `@position-try` options are mirrored
(`--fsui-menu-right`, `--fsui-menu-up-right`, section 12: five options in all). The Firefox bug
of 13.3 does not apply to insets.

### 13.5 Migration (0.1.0-alpha.9)

- `data-side` / `data-align` / `state.side` / `state.align` change meaning while shown:
  resolved, not requested. CSS that used them for an arrow or a gap now follows flips (the
  intent); code that wanted the requested value reads its own prop.
- `align="start"` / `"end"` on a `top` / `bottom` side are inline-relative: unchanged in LTR,
  mirrored under `direction: rtl`.
- `side` gains `"inline-start"` / `"inline-end"` (Tooltip, Popover, Menu). The state types
  widen accordingly: an exhaustive switch over `TooltipSide` / `PopoverSide` / `MenuSide` gains
  two cases, and `state.side` is physical only while shown.
- Menu's submenu default side is `inline-end`: in RTL the submenu opens on the left and its
  `data-side` is `left` while shown; the docs' gap rule covers both sides.
- Combobox's listbox follows a `dir="rtl"` container (Chromium, WebKit; Firefox under 13.3).
- A context menu in an RTL popup opens to the left of the point; the shipped stylesheet has
  five options instead of three.
- The Tooltip docs sentence "`data-side` is the side you asked for" and the Popover / Menu
  props tables are updated by hand (CLAUDE.md, docs site).

---

## Resolved questions (2026-10-15)

Decided by the product owner, items 1, 2 and 5 confirmed with the user:

1. **Action naming**: keep the `x` / `defaultX` / `xChangeAction` triple (`pressedChangeAction`,
   `valueChangeAction`, `openChangeAction`). No bare `changeAction`.
2. **Urgent opt-out placeholder**: v0 provides no mechanism. Native `on*` props the library does not
   use pass through to the element as an unsupported escape hatch; library-used handlers are removed
   from part prop types. **Superseded 2026-10-17** by the urgent lane of section 2.6 (resolved
   question 27; renamed to `on<State>Change: UrgentChangeHandler` 2026-10-23, resolved question
   39); the pass-through escape hatch remains for interactions with no urgent handler.
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
    until a component shows it cannot be done in CSS on the popup itself. **Superseded
    2026-10-23 (wave 11, #20):** the user chose the Tooltip arrow for wave 11, so
    `Tooltip.Arrow` ships, echoing the resolved `data-side` / `data-align` (section 13.2,
    `design/components/tooltip.md`); the pseudo-element recipe stays documented as the
    zero-markup alternative. Popover and Menu still have no `Arrow`.
11. **`provides="description" | "name"`** is the convention for any part whose content labels or
    describes another element (Tooltip's `Popup`, future `Label`/`Description` parts):
    `"description"` wires `aria-describedby`, `"name"` wires `aria-labelledby`. It is an
    **explicit prop with a fixed default** (`"description"`); there is no automatic switch to
    `"name"` based on whether the trigger already has an accessible name (clarified 2026-10-16
    after the Tooltip implementation; the design wins). The prop name is shared across components.
12. **All Accordion parts are client modules** (section 7.3). Server Components render them and
    the native toggle works before hydration; directive-free variants were a later concern (#19,
    resolved as none: question 38).

13. **`details.event` is a virtual Proxy-served property** (raised by the Toggle design, #6;
    resolved by research #17, `docs/research/server-function-action-props.md`, option (e), see
    section 2.2). Server Functions may be passed directly to any action prop; the thin client
    wrapper is optional.
14. **`details.reason` vocabulary unified** to `"activate"` | `"platform"` (section 2.2); Tabs'
    `"find"` and Accordion's `"trigger"` are renamed. Their public details types declare
    `reason: ChangeReason` as 2.2 requires; the implementation had kept narrower local unions
    until #100 (after 0.1.0-alpha.11), a breaking type change for a consumer who annotated the
    narrower type.
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
24. **Popover (#38)** accepted 2026-10-17 with all eight questions as recommended
    (`design/components/popover.md`): `<dialog popover="auto" aria-modal="false">` with focus
    moving in and `render={<div />}` for the disclosure variant; part-initiated closes
    library-owned, dismissals notified; JS-free `aria-expanded` by DOM write; no `Form` /
    `lightDismiss`; `role` an overridable default; the nested focus-return rule; placement
    `bottom` / `center`; Trigger-less popovers unanchored. Dialog's view-transition close is
    issue #46. The conventions changes it asked for (the top-layer boundary rule in 3.5 / 5.1,
    the part-initiated close shape in 3.5, the `"dismiss"` examples in 2.2, the `Popup` element
    in 1.1, the `open` row in 4.1, the types in 5.3, the DOM-written ARIA row in 7.4) are
    applied.
25. **Menu (#39)** accepted 2026-10-17 with all eleven questions as recommended
    (`design/components/menu.md`): item activation closes the whole stack after the item's
    action settles, with `data-pending` on the item and a view-transition exit; checkbox and
    radio items keep the menu open by default (`closeOnActivate`); always library mode; hover
    intent by timers (100 / 150 ms) on the submenu Root and pointer-move focus on items; Tab
    closes the stack with an immediate `hidePopover()`; submenu `flip-inline` fallback kept
    despite WebKit 302008; a nested `Menu.Root` is the submenu with `SubmenuTrigger` the only
    new part; `GroupLabel` and `<hr>`; `experimental_focusgroup` on `Menu.Popup`; the shared
    `useActionTrigger` (landed with #41, before Menu merged). The conventions changes it asked for
    (`GroupLabel` / `Separator` / `Item` in 1.1, `useActionTrigger` in 3.4, the always-library
    configuration in 7.3, the committed-state wording in 5.1, the types in 5.3, the flag row in
    8, the `checked` and `open` rows in 4.1, the `"dismiss"` examples in 2.2) are applied.
26. **Select (#50)** accepted 2026-10-17 (`design/components/select.md`), questions 1 to 3 and
    5 to 8 as recommended and question 4 decided the other way: a real `<select>` rendering
    `value={optimistic}` with no open state; `value: string` with `""` for the placeholder;
    `Select.Value` as `<selectedcontent>` with the hydration workaround and an automatic
    `MutationObserver` refresh (WebKit contingency recorded); late options re-applied with the
    `useSyncExternalStore` hydration tell; the reset target mirrored into `defaultSelected`;
    **no dev warning** with neither `value` nor `defaultValue`, the Select adopting the
    browser's first-option default (native-first, RadioGroup precedent); no `transition` on any
    part; `Group label` required with optional `GroupLabel`; the WebKit 302008 test row with a
    consumer CSS mitigation; the `experimental_baseAppearance` flag row withdrawn. The
    conventions changes it asked for (`Option` / `Value` in 1.1, the element rule in 1.2, the
    `string` exception in 3.1, the late-option path in 3.5, `useNativeSelectValue` and
    `HTMLSelectElement` in 3.8, the `selected` / `open` rows in 4.1, the no-transition note in
    5.1, `fsui-select` in 5.3, the `selectedcontent` rows in 7.4, the flag row in 8) are applied.
27. **Combobox (#50)** accepted 2026-10-17 (`design/components/combobox.md`), questions 1 to 5
    and 7 to 11 as recommended and question 6 **overridden by the user**: one `Combobox` with
    `allowCustomValue` (no separate Autocomplete); the urgent lane as `inputValueChangeAction:
    UrgentChangeAction` (section 2.6; **renamed** `onInputValueChange: UrgentChangeHandler` by
    the user 2026-10-23, #96, resolved question 39); two explicit states (`value`, `inputValue`) with no
    `itemToString`; accepting an option keeps the listbox open with `data-pending` on the
    option and closes on settle (Menu's rule); Tab does not accept; `multiple` deferred; no
    `commandfor` on the Trigger and no JS-free mode; Escape left to the platform; the WebKit
    302008 row with a `positionTryFallbacks` escape hatch; and, by the user's decision, a
    **default English announcement** (`"No results"`, `"1 result"`, `"N results"`) through
    `ariaNotify`, overridable through `announce(count, state)`, which sets the built-in-strings
    rule of section 11. The conventions changes it asked for (2.6 and 3.2 urgent lane and
    virtual focus, `UrgentChangeAction` in 9.4, the residual paths in 3.5, `Input` / `Clear` /
    `Empty` / `Status` and the `Root` / `List` / `Label` / `Option` notes in 1.1, the `active` /
    `stale` / `empty` / `selected` / `open` rows in 4.1, the deferred-render note in 5.1, the
    types in 5.3, the always-library note in 7.3, the `ariaNotify` note in 8, the urgent test
    row in 10.1, section 11) are applied. **Revised after review** (2026-10-17, "Review
    revisions" in the design): the sync-throw rollback rule in 2.6 and 10.1; `Status` inside a
    `List` is the role-less loading fallback and the listbox is `aria-busy` while loading (1.1,
    4.1); the hidden-input pattern in 3.5 and 3.8 rule 6 has no `defaultValue` mirror (the
    reset target is computed in JS; a text input's mirror is written in the `reset` event
    through `useFormReset`'s `onResetEvent`).

28. **Toast (#54)** accepted 2026-10-18 (`design/components/toast.md`), all nine product-owner
    questions as recommended (module-level `toast` singleton with `createToastManager` for
    isolation; `"timeout"` in `ChangeReason` and `Toast.Close` as `"dismiss"`; action toasts
    persistent by default; swipe deferred; focusable `dialog` / `alertdialog` Roots; F8; foreign
    modal dialogs undetected in v1; the library-owned Suspense guard; `limit` 3 with queueing),
    with one amendment: a `toast()` call on the server is a no-op with a dev warning and is
    never buffered (the module-level manager would share a queue between requests). The
    conventions changes it asked for (the function export in 1.1 and 9.3, `"timeout"` and the
    "part that carries a decision" wording in 2.2, the urgent-by-design queue in 2.6, the Toast
    region row and the module-level registry in 3.5, the `pending` / `ending` / `paused` /
    `type` rows in 4.1, the third no-`transition` category in 5.1 and the Toast row in 5.3, the
    Suspense guard in 6, the Lanes row in 10.1, the two strings in 11) are applied.
29. **Slider (#54)** accepted 2026-10-18 (`design/components/slider.md`), all twelve
    product-owner items as recommended: two actions with the gesture's `valueCommitAction`
    committing uncontrolled state (rollback on a failed save); steps as transitions driven by an
    internal urgent `live` value, no `UrgentChangeAction`; `<state>CommitAction` as an action
    kind; `Slider.Indicator` (not `Range`); the two-element `Thumb`; the platform midpoint
    default; an unreachable `max` stays unreachable; no synthetic `input` / `change` for pointer
    gestures; the `"dismiss"` revert step in uncontrolled mode; explicit `index`; no
    `transition` prop. Decisions 1, 2 and 8 were made autonomously for wave 5 and are to be
    reported to the user. The conventions changes it asked for (the commit action in 2.1 and
    decision 2, `Track` / `Thumb` and the widened `Indicator` / `Label` / `Value` plus the
    hidden-control exception in 1.1, the continuous-control corollary in 2.3, the gesture value
    in 3.2 and 3.3, the controlled value input's reset and pre-hydration path in 3.5 and 3.8,
    `dragging` and the `pending` / `orientation` rows in 4.1, the no-`transition` note in 5.1,
    the types in 5.3, generic props in 9.4, the continuous-control row in 10.1) are applied.
30. **Field and Form (#54)** accepted 2026-10-18 (`design/components/field-form.md`), all
    eleven product-owner items as recommended: `Form.Root` runs a function `action` itself on
    the client (`onSubmit` `preventDefault()` + its own transition, the element's `action`
    unwrapped for progressive enhancement) with `autoReset` defaulting to `true` (reset on a
    settle with no errors); `Field.Root` exposes the form's pending; no `aria-errormessage` in
    v1; server errors written into `setCustomValidity` with the stale-value suppression;
    repeat submissions not dropped; the validity display urgent with no `transition`;
    `Dialog.Form` `errors` / `autoReset` as a follow-up; `Field.Label` for group controls by
    registration (`for` dropped, `aria-labelledby` on the group); sync `validate(value,
    formData)`. Items 1 and 4 are reported to the user as the most visible. The conventions
    changes it asked for (`Control` / `Description` / `Error` / `Submit` and the widened `Label`
    / `Root` in 1.1, the element rules and the Field-owned `id` in 1.2, the validity mirror in
    2.6 and decision 11, the three form-channel amendments in 2.7, the reset and settle notes in
    3.5, the owned custom-validity slot in 3.6, `useFieldControl` / `useFormOwnerEvent` in 3.8,
    `invalid` / `required` and the `pending` row in 4.1 and the `:user-invalid` row in 4.2, the
    no-`transition` note in 5.1 and the types in 5.3, the shared context in 7.1, the shared
    state type in 9.4, the three rows in 10.1, the platform-string note in 11) are applied,
    together with the #46 fold's CSS-exit rule in 5.1.

31. **ToggleGroup and Toolbar (#66)** accepted 2026-10-18 (`design/components/toggle-group.md`),
    all twelve recommendations as recommended: the `exclusive` discriminant with multiple as the
    default; exclusive mode deselectable by default with `deselectable={false}`; Toolbar `loop`
    default `true` with the native `wrap` token; `Menu.Trigger` opening on the inline-end arrow in
    a vertical Toolbar; a nested ToggleGroup transparent to the arrows; one DOM-written roving
    `tabindex` engine shared by Toolbar and a standalone ToggleGroup; Tab from a text-entry item
    to the next item; `Toolbar.Button` and `Toolbar.Separator` only; `Toggle` unchanged;
    `experimental_focusgroup` on both Roots; no Label parts; no form participation and no
    `details.reason`. The conventions changes it asked for (1.1, 3.2, 3.6, 4.1, 5.3, 7.1, 7.4, 8,
    9.1) are applied.
32. **Progress and Meter (#68)** accepted 2026-10-18 (`design/components/progress.md`), all eleven
    product-owner items as recommended (optional `value` with `null` meaning indeterminate; `max`
    100; directive-free Roots rendering the client context provider; always-referenced
    `aria-labelledby`; no Field registration, no native variant and no English indeterminate text;
    `getAriaValueText(value, state)`; an `aria-hidden` Value; no `transition`, types,
    `useFormStatus` or `pending`; two pages and two subpaths) and all nine conventions proposals,
    applied: the part notes in 1.1, the consumer-side lane rule in 2.6, the mirrored-state
    examples in 3.5, `complete` / `region` / `indeterminate` in 4.1, the fourth no-`transition`
    category in 5.1 and the types in 5.3, the hook list in 7.1 relaxed to React's `react-server`
    exports (proposal 6a, the architect's choice: `use-render.tsx` may drop its directive instead
    of the `render-element.ts` split) and the provider exception's first use in 7.1 and 7.3, the
    shared state types in 9.4, the two rows and the directive-free note in 10.1, the
    platform-string note in 11.
33. **NumberField (#67)** accepted 2026-10-18 (`design/components/number-field.md`), all fourteen
    product-owner items as recommended (two actions with Slider's semantics; typed text committed
    on blur / Enter with an internal draft; typed values neither clamped nor snapped; unparsable
    text reverting silently; strict grouping; rounding on commit; the runtime `locale` with a
    `lang` warning; no `aria-roledescription`, `role="group"`, static `"Increase"` / `"Decrease"`;
    opt-in wheel and the 400 / 60 ms hold; `validityElement` in the Field contract; the
    uncontrolled hidden input; the live-region fallback; the v1 scope) and conventions proposals
    1 to 12, applied: `Increment` / `Decrement`, the widened `Root` / `Input` / `Label` and the
    hidden-sibling exception in 1.1, the draft text and held value in 2.6 and 3.2, the
    pre-hydration text and the uncontrolled hidden input in 3.5 and 3.8 rule 6, the surface /
    validity-element mirror in 3.6, `validityElement` and the hook rows in 3.8, `pending` /
    `disabled` in 4.1, the no-`transition` note in 5.1 and the types in 5.3, the directive-free
    modules in 7.1, `internal/announce.ts` in 8, the three rows in 10.1, the two static strings
    in 11. `validityElement` also amends the accepted Field design
    (`design/components/field-form.md` 7.1 and its "Amendment: `validityElement`" section).
34. **Button (#79)** accepted 2026-10-22 (`design/components/button.md`), every recommendation
    as recommended: the single-element `Button` with a bare `action`; the re-entry guard (ignore
    while pending, `aria-disabled="true"` meanwhile, never native `disabled`, no `aria-busy`, no
    announcement, no opt-out prop), library-wide as a rule and landed for Button only, with the
    follow-up for `Dialog.Close`, `Popover.Close` and `Menu.Item` filed as #81; `type="button"`
    by default and `"submit"` with `formAction`; `formAction` with per-submitter pending from
    `useFormStatus().action`; `Form.Submit` unchanged and unguarded; a cancelled click is not a
    veto for a pure trigger; `Button` reads `ToolbarContext`; `focusableWhenDisabled` in v1;
    `"use client"`. User decisions: **`Toolbar.Button` is removed** (a breaking change; `Button`
    replaces it inside a Toolbar) and `focusableWhenDisabled` ships. The conventions changes
    (decisions row 2, 1.1, 2.3, 2.5, 2.7, 3.4, 3.6, 4.1, 5.3, 9.1, 10.1) are applied.
35. **Context menu (#45)** accepted 2026-10-22 (`design/components/context-menu.md`), every
    decision as proposed: `Menu.ContextTrigger` in the Menu namespace (a plain region with no
    ARIA; a Root may hold a `Trigger` and a `ContextTrigger` sharing one Popup); placement at
    the point with no anchor (research S4: inline `--menu-point-x` / `-y` and three shipped
    `@position-try` options, `side={null}` to opt out); a move on a second right-click (no
    dispatch); the outside right- / middle-click close for **every** menu; editable targets
    keep the native menu by default (`editableTargets="menu"`); long-press for touch and pen;
    the names `data-context` / `state.context`, `--menu-point-x` / `-y`, `editableTargets`,
    `longPressDelay`; press-drag-release, a touch offset, close-on-scroll, RTL placement and a
    `nonce` deferred. **User decision:** positioning-only shipped CSS is allowed through React
    `<style href precedence>`, documented and overridable (section 12); the virtual-anchor
    alternative is rejected. The conventions changes (1.1, 2.2, 3.5, 4.1, 12) are applied.

36. **Wave 11 Part A, positioning (#20, #53, #88 RTL)** accepted 2026-10-23
    (`design/components/tooltip.md`, `popover.md`, `menu.md`, `context-menu.md` Part A,
    `combobox.md` amendments; section 13), every recommendation as recommended: the resolved
    `data-side` / `data-align` under the same names, observed on Tooltip's native path too;
    inline-relative `align`, the `inline-start` / `inline-end` sides, `inline-end` as the
    submenu default; no workaround for Mozilla 2019601 (asserted through the probe; human task
    #89); the context-menu direction from the popup's computed `direction`; no `data-side` on
    Combobox (possible follow-up). **User decision:** `Tooltip.Arrow` ships, superseding
    resolved question 10. **Part B (#21 skip-delay, #88 press-drag-release, touch offset,
    close-on-scroll, CSP) accepted 2026-10-23** (`tooltip.md` Part B, `context-menu.md` Part B,
    `menu.md` note; section 12), as recommended: global provider-less skip-delay with no
    opt-out and no cooldown; touch press-drag-release ships, with the iOS / Android device
    check a human task (#90; upstream items #91); the wheel guard on every menu; no
    scroll lock, close-on-scroll for point opens only; `nativeMenu` rejected; `<CSPProvider
    nonce>` and `STYLE_SHA256` from `@funstack/ui/csp`. **User decision:** the skip-delay
    stylesheet's selector rule is allowed; shipped CSS is "placement and interaction timing,
    never visuals" (section 12).

37. **Wave 12, Tooltip warm opens (#93)** accepted 2026-10-23 (`design/components/tooltip.md`
    amendment for #93; sections 4.1 and 7.4), every recommendation as recommended:
    `data-instant` on `Tooltip.Popup`, attribute only with no `state.instant`, written from the
    popup's synchronous `beforetoggle` on both paths (the native path's one passive listener)
    and cleared at the close's, so exits always animate; no prop, no CSS-only route.

38. **Wave 13, directive-free ("zero-JS") variants (#19)** resolved 2026-10-23, **user
    decision, option A** of `docs/research/zero-js-variants.md` 5 (section 7.3): no new
    components; "JS-free" means no behaviour JS on the native path and works before and without
    hydration, not "no client bundle"; native-HTML recipes on the form-control docs pages
    (Switch, Checkbox, RadioGroup, Slider, NumberField, Select); Tooltip not viable natively
    outside Chromium; Popover blocked on the `aria-expanded` gap; option B
    (`@funstack/ui/accordion/native`) recorded as a ready plan, not scheduled. Supersedes the
    "tracked in #19" notes in the component documents (Accordion feedback 1, Tooltip 14.1,
    RadioGroup, CheckboxGroup, Switch, Select, Slider, NumberField). The server `useId`
    collision found by the research is #94 (upstream uhyo/funstack-static#198, fixed in
    `@funstack/static` 1.3.4 and re-verified; section 7.3 records the host requirement).

39. **Urgent handler naming (#96, from the docs feedback #95)** decided by the user 2026-10-23:
    `fooAction` **always** means a handler the component wraps in a transition; the urgent lane
    is a plain synchronous handler and is named like one. Combobox's `inputValueChangeAction`
    becomes **`onInputValueChange`** and the type `UrgentChangeAction` becomes
    **`UrgentChangeHandler`** (same signature, `(next, details) => void`; the details type
    `ComboboxInputValueChangeDetails` is unchanged). This reverses Combobox question 2 (resolved
    question 27), which had kept the `Action` suffix so that the no-`on*` rule had no exception;
    the user judged the suffix's meaning more valuable than the rule's purity. Breaking, with
    **no deprecated alias** (alpha). Applied: `docs/vision.md` principles 2 and 3; sections 2.1
    (the new table row and "the suffix is the contract"), 2.6, 3.2, 7.4, 9.4, 10.1 (the renamed
    row and the new "Action naming" type guard); decisions 2 and 11; resolved question 2;
    `design/components/combobox.md` (edited in place, plus the amendment with the migration and
    the implementation checklist); the type-name mentions in `slider.md`, `number-field.md`,
    `toast.md`. Guard: a type-level test, not a lint rule (oxlint as configured has no custom
    naming rule and the repo has no ESLint; a lint rule could not see the type anyway, and the
    rule is about types: "a prop ending in `Action` returns `unknown`"). **Implemented** on
    `wave14-rename` (`feat(ui)!: rename Combobox inputValueChangeAction to onInputValueChange`);
    two deviations from the design's guard snippet were folded back into 10.1 and the Combobox
    checklist: the DOM pass-through exclusion needs `DialogHTMLAttributes` / `ButtonHTMLAttributes`
    / `InputHTMLAttributes` besides `DOMAttributes` (`onCancel` / `onClose`, `formAction`), and
    the transition check applies to the function members of the prop type only, since
    `Form.Root`'s `action` is `string | fn` and the snippet's `NonNullable<P[K]> extends fn`
    failed it (the design's claim that it "passes" was wrong as written).

## Open questions

None at present.
