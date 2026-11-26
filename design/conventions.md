# @funstack/ui API conventions

Status: **accepted**. Binding for every component design in `design/components/`.
`docs/vision.md` wins over this document; this document wins over any individual component
design.

This document states the current rules only. How each rule came to be (amendments, the resolved
and open questions, review corrections) is in `design/CHANGELOG.md`, which is append-only: a rule
is changed by editing it here and adding a changelog entry in the same commit.

Some parts of the conventions are documents of their own, with the same status. Their sections
keep their numbers, and this document keeps each heading as a stub that names the file:

| Sections | Document |
| --- | --- |
| 3.9, and the light-dismiss traps that 3.5 points to | `design/overlay-open-state.md` |
| 3.4, 3.8, and the index of `internal/` that 9.1 points to | `design/internal-hooks.md` |
| 10 | `design/testing.md` |
| 12, 13 | `design/placement.md` |

Inputs: `docs/vision.md`, `docs/research/react-async-apis.md`, `docs/research/popover-anchor-tooltip.md`,
`docs/research/modern-platform-survey.md`, `docs/research/form-controls.md` prior art (Base UI, React Aria Components, Radix,
Ark UI, Headless UI), and a handful of React 19.3.1 behaviour probes recorded in
`memo/architect/conventions-notes.md`.

## Decisions

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Composition | Compound parts under a namespace (`Tabs.Root`, `Tabs.Tab`); single-element components are plain (`Toggle`). Element polymorphism via a `render` prop (element or `(props, state) => node`), never `asChild` or `as`. `ref` is a normal prop. `className`, `style`, `children` accept a value or a function of the part's state. |
| 2 | Action props | `<state>ChangeAction` for state changes (`pressedChangeAction`, `valueChangeAction`), bare `action` for pure triggers. Signature `(next, details)`; sync or async; the library `await`s it inside the state owner's `useTransition`. Errors go to the nearest Error Boundary. What a pure trigger does with an activation that arrives while its own action is pending is the prop `whilePending` (`"run"` | `"ignore"`); the default follows who owns the action: `"run"` for a user-owned trigger (`Button`), `"ignore"` for a part whose activation the library owns (a Close part); an ignoring part renders `aria-disabled="true"` while pending (2.5.1). **`fooAction` always means a handler the component runs in a transition**, and a **request**: a change the library can still roll back. A change the library cannot hold is reported to an `on*` handler instead (row 11): `on<State>Change` or `on<Event>`, never an action. A continuous control adds `<state>CommitAction` once per gesture (Slider). A component whose input is a command rather than an interaction (Toast) exports a function next to its namespace (`toast`), not an event prop. |
| 3 | State model | `x` / `defaultX` / `xChangeAction`. The state owner holds committed state, optimistic state (`useOptimistic`, reducer form) and the transition. **Trigger parts render optimistic state; content regions render committed state.** Uncontrolled state is committed after the action resolves; the latest dispatched action wins, and set-valued state without `exclusive` commits the changes whose actions resolved (3.3). "Transition by default" applies to library-owned state; browser-owned state (top layer, `<details open>`) is observed, not driven. An overlay's `open` has both: requests through `openChangeAction`, and facts (a dismissal) adopted urgently and reported to `onOpenChange`, which supersede every request in flight (3.4 `adoptFact`, 3.9). |
| 4 | Exposure | One vocabulary in three forms: `data-pending` / `state.pending` / docs. Booleans by attribute presence. Hover/focus/active come from CSS pseudo-classes, not attributes. |
| 5 | ViewTransition | An animatable part renders `<ViewTransition default={transition}>` as its outermost node **only when `transition` is given**; with the prop absent it renders no boundary, because react-dom starts a document view transition for any boundary that mounts or is revealed in a transition commit, whatever `"none"` says. `transition` forwards React's own `default` shape and is static. For a top-layer part the boundary wraps **the top-layer element itself**, so a library-driven `showPopover()` / `hidePopover()` in a layout effect animates enter and exit in every engine. Library adds `fsui-<component>[-<change>]` transition types. Reduced motion handled in CSS. |
| 6 | Suspense | Consumers own Suspense boundaries. Library content regions are keyed off committed state so suspending children keep the old UI and show as `data-pending`. |
| 7 | RSC and platform attributes | `"use client"` per source file; unbundled build (`tsdown` `unbundle: true`, verified to keep the directive); "JS-free" means no behaviour JS runs for the interaction and the markup works before hydration (the `<details>` Accordion); whether a part file is directive-free is a per-component fact recorded in its design doc. **There is no second, directive-free anatomy; "JS-free" means no behaviour JS on the native path and works before and without hydration, never "no client bundle"** (7.3). Attributes react-dom cannot express use lowercase pass-through, one module augmentation file, and a ref-based upgrade for `hidden="until-found"`. **Overlay Triggers render `popoverTarget`** (typed by `@types/react`, serialised camelCase by react-dom and lowercased by the DOM), not `commandfor` / `command`, **and no `aria-expanded` on an invoker**; JS-free mode DOM-writes `data-open`. |
| 8 | Experimental | `experimental_<feature>` props on the part that uses the feature (first customers: `popover="hint"`, `interestfor`, `focusgroup`, `interpolate-size`, `closedby`, customizable `<select>`); whole components that cannot exist without a flagged feature ship from `@funstack/ui/experimental`. No provider. |
| 9 | Layout | `src/<component>/` folders, kebab-case files, `index.ts` per component without a directive. Root entry plus per-component subpaths (`@funstack/ui/tabs`). Flat public type names (`TabsTabProps`, `TabsTabState`). |
| 10 | Tests | Every component test file covers: ARIA/roles, keyboard, sync action, async action with `data-pending`, optimistic + rollback, overlapping actions, suspending content, controlled/uncontrolled parity, `render`/function props. Shared helpers in `src/__tests__/helpers.tsx`. |
| 11 | Handlers (facts) and strings | A change the library cannot hold (the browser performed it before the library heard: a keystroke in a controlled text input, a dismissed popup, a toast that left) is reported to a **handler**, `on<State>Change: UrgentChangeHandler` or `on<Event>: UrgentHandler`, named as a handler precisely because it is not an action. **One rule for every `on*` handler the library defines**: called synchronously, outside any transition, not awaited, no pending state; it may return a promise; a returned promise's rejection and a synchronous throw go to `reportError`; no dev warning for a returned promise. The handlers: `onInputValueChange` (Combobox), `onOpenChange` (Popover, Menu, Combobox, Dialog Roots), `onClose` (a toast). A state that is urgent **by design** (the Toast queue) is written through an imperative command dispatched from a microtask (section 2.6); a **mirror of a browser-owned validity fact** (`:user-invalid`, `validity`, Field) is urgent as well, with no consumer-facing action. Built-in UI strings are English defaults, always overridable through a function prop (section 11). |
| 12 | Anchored placement | Top-layer popups are placed by CSS Anchor Positioning through one shared helper (`internal/overlay/anchor-position.ts`): `side` is physical (`top` / `bottom` / `left` / `right`) or inline-logical (`inline-start` / `inline-end`, through `self-x-*`), `align` `start` / `end` is **inline-relative** on a horizontal side (`span-self-x-*`) and physical on a vertical one; **never a plain logical keyword** (it resolves against the root, not the popup's container) and **never a JS direction read to pick keywords**. `data-side` / `data-align` / `state.side` / `state.align` are the **resolved** placement while the popup is shown, read from `getComputedStyle(popup).positionArea` by a shared observer (`internal/overlay/use-resolved-placement.ts`), and the requested values otherwise. A point-placed popup (no anchor) reads the popup's computed `direction` once per open to mirror its insets (section 13). |
| 13 | Shipped CSS and CSP | Shipped functional CSS (section 12) may, besides selector-less at-rules, carry a rule whose selector matches only elements the library marks (`[data-fsui-…]`) and that sets only a `--fsui-` custom property (Tooltip's skip-delay): shipped CSS covers placement and interaction timing, never visuals. A client-inserted `<style>` is **not** covered by the directive that allows inline `style` attributes: the library exports the SHA-256 of every shipped stylesheet (`@funstack/ui/csp`, `STYLE_SHA256`) for hash-based policies and one provider, `<CSPProvider nonce>`, for nonce-based ones, read by every part that renders a hoisted `<style>`. |

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
`Toast.Viewport` / `Toast.Root` / … (Toast). The namespace object stays parts-only, and the
function is never a handler: it enqueues, and the parts render what was enqueued.

Single-element components are plain components, no `.Root`:

```tsx
import { Toggle } from "@funstack/ui/toggle";

<Toggle pressedChangeAction={setFavorite}>Favorite</Toggle>
```

Part vocabulary (reuse these names; invent a new one only when none fits). Each component's
anatomy section says what the part renders there; this table fixes what the name means.

| Part | Meaning | Default element |
| --- | --- | --- |
| `Root` | Owns state, context and the transition. May render no DOM (overlays), a wrapper, the `<form>` itself (Form) or a `div[role=group]` (NumberField); a Root that owns a form value but no visible form element renders exactly one `<input type="hidden">` when `name` is given (Combobox). | `div` / `form` or none |
| `List` | Groups triggers and owns keyboard navigation between them. In Combobox it is the ARIA `listbox` inside the `Popup` (a listbox may contain only options and groups, so the Popup is the container). | `div` |
| `Item` | One entry in a multi-item component: Accordion's `details`, Menu's `button[role=menuitem]` with an `action`, ToggleGroup's `button[aria-pressed]` whose pressed state is the Root's. | `div` / `details` / `button` |
| `Trigger` / `Tab` | The interactive element the user acts on. | `button` |
| `ContextTrigger` | A region whose `contextmenu` (right-click, the keyboard's context-menu keys, a library long-press for touch) opens the owner's `Popup` at the pointer (Menu). A plain element with **no role and no ARIA**; may share a Root with a `Trigger`. | `div` |
| `Panel` | Content region whose visibility is driven by library state (Tabs, Accordion). | `div` |
| `Popup` | Content that lives in the top layer. | `div[popover]` (Tooltip, Menu) or `dialog[popover]` (Popover) |
| `Indicator` | Purely visual element that tracks state: the active tab marker; the fill of a Slider, Progress or Meter, sized by the consumer's CSS from the Root's custom properties. | `span` |
| `Label` | Names the owner, in the form the owner's element needs: `<legend>` as the first child of a `<fieldset>` Root (RadioGroup, CheckboxGroup); `label[for]` for an input surface (Combobox, NumberField, a one-thumb Slider, Field's control); `label[id]` or `span[id]` referenced through `aria-labelledby` where the owner is a group or is not labelable (a multi-thumb Slider, a Field's group control, Progress, Meter). | `label` / `legend` / `span` |
| `Input` | A text field that is the owner's surface for `data-pending` and holds an urgent state (2.6): Combobox's `input[role=combobox]` (`inputValue`), NumberField's visible `input[type=text][inputmode]` (the draft text), which renders the hidden native number input right after it. | `input` |
| `Parent` | A mixed-state checkbox that controls a subset of a CheckboxGroup (`values`): its state is derived from the group's optimistic set and its click dispatches for the whole subset. Never submitted (no `name`). | `input[type=checkbox]` |
| `Option` | One choice: in a native `<select>` (optimistic `data-selected`, equal to the platform's `:checked`) or in a listbox (Combobox: `div[role=option]`, never focused, `data-active` for virtual focus). | `option` / `div` |
| `Clear` | A `tabindex="-1"` button that empties a text field and dispatches the empty selection (Combobox). | `button` |
| `Empty` | Content the **library** shows only when a list has no mounted options and its results are neither stale nor loading (Combobox). | `div` |
| `Status` | A loading fallback or hint inside a popup (Combobox). Outside the `List` it is `role="status"`; **inside** the `List` it is the Suspense fallback, renders `role="none"` and marks the list as loading (`aria-busy="true"`, `Empty` hidden, nothing announced). | `div` |
| `Value` | The element that shows the current value. Select: the `<selectedcontent>` the browser fills, with **no `children` prop** (7.4). Slider, Progress, Meter: a `span` (Progress / Meter: `aria-hidden` by default, the same text is in `aria-valuetext`). | `selectedcontent` / `span` |
| `Track` | The rail of a Slider (owns pointer interaction and is the geometry reference for pointer math) or of a Progress / Meter bar (no interaction). | `div` |
| `Thumb` | A draggable value handle (Slider, one per value, explicit `index`): a styled element **containing** a visually hidden native `<input type="range">`, which is the focusable, labelled, form-participating `slider`. | `span` + `input[type=range]` |
| `Increment` / `Decrement` | `button[type=button][tabindex=-1]` that steps a numeric value, with press-and-hold (NumberField); natively `disabled` when the next step would change nothing. | `button` |
| `Form` | A form whose successful submission completes the component's interaction (Dialog). | `form` |
| `Control` | The native form control a Field labels and describes (`input`, or `textarea` / `select` through `render`). Any FUNSTACK form control inside a `Field.Root` plays the same role through `useFieldControl` (3.8). | `input` |
| `Description` | Describes the owner through `aria-describedby`: a `p[id]` the control (Field) or the `<dialog>` (Dialog) always references, mounted or not. | `p` |
| `Error` | The message for a Field's current constraint violation: `div[id]`, rendered only while an error is shown and referenced through `aria-describedby` while it is; no live region, no `role`. | `div` |
| `Submit` | A form's submit button with the form channel's `data-pending` (`useFormStatus`). | `button[type=submit]` |
| `GroupLabel` | Names a `Group` (or a `RadioGroup` in Menu) through `aria-labelledby`. Not `Label`, which names the component's owner. | `div` |
| `Button` | A pure-trigger `button` with a bare `action` and its own `data-pending`. The general one is the single-element `Button` (`@funstack/ui/button`; `whilePending`, 2.5.1), which is also a Toolbar's command button: the Toolbar has no button part, and `Button` reads `ToolbarContext` so that a disabled one stays focusable there (3.6). | `button` |
| `Header`, `Group`, `Separator`, `Arrow` | Structural or decorative. `Separator` is an `<hr>` by default; inside a Toolbar it carries `aria-orientation` perpendicular to the toolbar's. | as named |

There is deliberately **no `Portal` and no `Positioner` part**: the Popover API puts content in the
top layer and CSS Anchor Positioning places it, so the platform does both jobs (see
`docs/research/popover-anchor-tooltip.md`).

Each part renders at most one DOM element. Parts never render wrapper elements the consumer did
not ask for; this is also what keeps `<ViewTransition>` "before any DOM node" (section 5).
One exception (Slider): a part whose platform control cannot be its styled element renders
the control as a **visually hidden child** of its one styled element (`Slider.Thumb`): `ref`
goes to the styled element, a documented `inputRef` to the control, and the props the control
needs (`name`, `form`, the `aria-label` / `aria-labelledby` / `aria-describedby` trio) are
listed as forwarded to it rather than landing on the styled element.
A second exception (Combobox): a `Root` that has no element of its own renders the form
value as hidden inputs, one for a single selection and **one per value** with `multiple`
(`design/components/combobox.md` 15.8); they are form plumbing, take no `ref`, `className` or
`render`, and sit before the children, outside every `<ViewTransition>`.
A second exception (NumberField): a part whose user surface is itself a native input and
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
- Field and Form: `Field.Control` must stay a native form control (`input`, `textarea`,
  `select`), `Field.Label` a `<label>`, `Form.Root` a `<form>`, `Form.Submit` a submitter (a
  `<button>` or `<input type="submit">`). Inside a `Field.Root`, a control's `id` is **owned by
  the Field** (the Label's `for` must point at it; a consumer `id` on the control warns).
- `className`: the library's and the element's are concatenated. `style`: merged, element wins.
- Event handlers the library installs (for example `onClick` on a `Tab`): both run, the element's
  first, then the library's. v0 provides no way to cancel the library's handler from there.
- **`type`** is set only where it applies: `type="button"` is emitted for a `<button>` and
  omitted for `render={<a href />}` or any other **host** element. A **component** `render`
  element (`render={<MyButton />}`) receives `type` too: the part cannot see what it renders, a
  missing `type` on a component that renders a `<button>` inside a form is a silent submit, and
  an ignored `type` on one that renders a link is harmless. The predicate is
  `rendersButton(render)` (`internal/render-element.ts`): `true` for no `render`, the function
  form, a host `"button"` and any component element.
- **`disabled` on a button-like part** depends on who acts on the click. One helper decides it
  for every such part, `Button` and `Form.Submit` included: `disabledButton(render, disabled,
  { handlesClick?, alwaysFocusable? })` in `internal/render-element.ts`, which returns the
  owned `disabled` / `aria-disabled` keys of the branch it chose (`props`) and whether invoker
  attributes may render (`invoker`). When the element is unknown, each attribute takes the
  choice that is harmless if the guess is wrong. The rule
  (`design/components/button.md` 17 lists the parts):
  - **Native `disabled`** on a host `<button>` (no `render`, the function form), and wherever
    the click's effect is the **browser's own** (`handlesClick: false`: a submit, a reset, a
    JS-free invoker command) and the element **may be a button** (a host `<button>` /
    `<input>`, or a component). Only native `disabled` stops a submission or a command before
    hydration and blocks implicit submission. The browser-run parts are `Form.Submit`, a
    JS-free command Trigger / Close, and a `Button` whose `type` is `"submit"` / `"reset"` (by
    default with `formAction`) or that carries `commandfor` / `popoverTarget`, with or without
    `action`.
  - **`aria-disabled="true"` with a cancelled click** in three cases only: the element
    certainly cannot be natively disabled (a host `<a>`, `<div>`: native `disabled` means
    nothing there and would expose an enabled link to assistive technology); the part's **own
    click handler is the action** and the element is not certainly a host `<button>` (a link
    or component render of `Button` with `action`, Toggle, ToggleGroup.Item, Menu.Trigger,
    Combobox.Trigger / Clear, NumberField.Increment / Decrement, Toast.Action / Close, and the
    Close and Trigger parts of Dialog and Popover in the modes where they handle the click); or
    the consumer **opts into** a focusable disabled control (`alwaysFocusable`: a `Button`
    inside a Toolbar or with `focusableWhenDisabled`, a menu item, `SubmenuTrigger` through
    `usePopoverTrigger`'s `submenuItem`). The handler is what makes `aria-disabled` safe: it
    returns before dispatch and `preventDefault()`s.
  - A part with no click handler of its own (`Form.Submit`, a JS-free command Trigger / Close)
    that lands in the `aria-disabled` branch on a host link installs one while disabled that
    only cancels the click (`cancelClick`), so a disabled link never navigates after hydration;
    before hydration nothing stops a link.
  - In the `aria-disabled` branch a disabled **invoker also owns its invoker attributes
    (`popoverTarget`, `commandfor`, `command`) as `undefined`**: `aria-disabled` has no
    behaviour, and a disabled component render spreading onto a real `<button commandfor
    command>` would otherwise be a live invoker in the server HTML before hydration.
  - The part owns `aria-disabled` only where it computes it (that branch, or a pending pure
    trigger); on a host button outside it the consumer's own `aria-disabled` passes through.
  - When `disabled` and a pending pure trigger's `aria-disabled` (3.6) meet on a natively
    disabled element, native `disabled` wins and no `aria-disabled` is rendered
    (`pendingAriaDisabled` in the same module).
- Library-controlled attributes (`role`, `aria-*` *state* the part computes such as
  `aria-pressed` / `aria-selected`, `id` wiring, `data-*` state) win over the element's, with one
  carve-out: ARIA id-reference lists (`aria-labelledby`, `aria-describedby`, `aria-controls`,
  `aria-owns`) are **merged as token lists**, the element's tokens first, so a trigger can be
  described by more than its tooltip. **Everything else, the element wins**, including `aria-*`
  and `data-*` props that merely pass through the part from its own props: a `render` element's
  `aria-label` beats `<Tabs.Tab aria-label>`; only attributes the part itself computes are
  library-controlled. Merge order is therefore: part pass-through props, then the `render`
  element's props, then library-controlled attributes on top.
- **Library-controlled keys are owned, not merely preferred**: a key the
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
| Fact about a state (the library cannot hold the change) | `on<State>Change` | `(next, details) => void` | `onInputValueChange` (Combobox): a controlled text input's text, which React requires to be urgent. `onOpenChange` (Popover, Menu, Combobox, Dialog Roots): the popup was closed without the library performing the close. **Not an action** (the handler rule below). Type `UrgentChangeHandler`. |
| Fact with no state | `on<Event>` | `(details) => void` | `onClose` (a toast, `toast({ onClose })`): the toast left. Same rule. Type `UrgentHandler`. A callback for something that already happened is never an action. |

The state name in `<state>ChangeAction` is exactly the controlled prop's name, so the three props
of a controllable state always read as a set: `pressed` / `defaultPressed` /
`pressedChangeAction`. This mirrors the `on<State>Change` convention consumers already know from
Radix and Base UI, with the React docs' `Action` suffix.

**The suffix is the contract**: a prop named `action` or
`<anything>Action` is **always** a handler the component runs in a transition, sync or async,
awaited, with pending state; and it is always a **request**: called before the change is
committed, its outcome decides the state, and a rejection or a controlled parent that does not
adopt rolls the UI back. A reader who sees `Action` may rely on that without opening the type.

The converse is the `on*` form. **An `on*` handler reports a fact**: a change that had already
happened when the library heard of it and that the library could not have held (the browser
performed it in front of the user). The test that separates the two: *if the callback rejects,
or the parent ignores it, can the library put the UI back without the user noticing?* If yes,
it is an action; that is why a form reset, a find-in-page reveal and input before hydration
stay actions with `reason: "platform"` (the DOM is the optimistic state there, and restoring it
is cheap and invisible; this includes a popup found open at hydration, which the library can
still hide). A popup the user dismissed, a keystroke and a toast that left fail the test.

**The handler rule** (one rule, for consistency and simplicity). Every `on*` handler the library defines:

1. is called **synchronously**, in the event that reports the fact, outside any transition (a
   `setState` in its body is an urgent update);
2. is **not awaited** and has **no pending or optimistic state**;
3. **may return a promise** (an `async` function, a Server Function): a returned promise's
   rejection is passed to `reportError`, and so is a synchronous throw (the library catches it
   so that its own bookkeeping after the call still runs). Nothing reaches an Error Boundary;
4. gets **no development warning for a returned promise**.

The complete list of such handlers (anything else named `on*` on a part is a DOM pass-through
prop, section 1.5):

| Handler | On | Reports |
| --- | --- | --- |
| `onInputValueChange` | `Combobox.Root` | the text of the input changed (2.6) |
| `onOpenChange` | `Popover.Root`, `Menu.Root`, `Combobox.Root`, `Dialog.Root` | the popup was closed by something other than a request: Escape, light dismiss, focus leaving, script, … (always `false`; `design/components/overlay-open-change.md`) |
| `onClose` | a toast (`ToastOptions`) | the toast left, with `details.reason` |

For a state with a handler the triple reads `inputValue` / `defaultInputValue` /
`onInputValueChange`; a state that has both requests and facts (an overlay's `open`) has four
props: `open` / `defaultOpen` / `openChangeAction` / `onOpenChange`. The pair exists **only on
overlay Roots**; no form control gets a second prop.

A new `on*` prop needs the component's design doc to show who performs the change and why the
library cannot hold it, and a conventions amendment adding it to the list above. The type guard
(10.1, "Action naming") holds the allow-list.

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

**`details.reason` vocabulary is library-wide**: a component that
exposes `reason` uses exactly these values and no synonyms:

| `reason` | Meaning | `details.event` |
| --- | --- | --- |
| `"activate"` | The user acted on a trigger part: click, Enter/Space, or focus in an automatic-activation mode. | The native `MouseEvent`, `KeyboardEvent` or `FocusEvent` (`type` is `"focusin"` for React's `onFocus`). For native checkbox and radio inputs it is always the `click` `PointerEvent`, including Space and radio arrow keys, because React's `onChange` for them is click-driven. |
| `"platform"` | The browser changed the state: find-in-page or a text fragment (`beforematch`, `<details>` `toggle`), form reset, or interaction before hydration reconciled at mount. Never a user gesture. | The platform event, or `undefined` for mount reconciliation. |
| `"dismiss"` | The user closed the component **without acting on one of its parts**: Escape, Android back, an assistive-technology dismiss gesture, light dismiss (outside click); also a close no user caused through this component: script calling `hidePopover()`, another top-layer element (an unrelated `auto` popover, a modal dialog) hiding the popover, focus leaving the component (Tab out of a menu), a right- or middle-click outside a menu (the library's own immediate close, since click-based light dismiss ignores those buttons), the pointer leaving a hover-opened submenu, or a parent overlay closing (a submenu when its menu closes). A close through a part **that carries a decision** (`Dialog.Close`, a Form submit) is `"activate"`; `Toast.Close`, which only ever means "go away" (the same as Escape), is `"dismiss"`, so a toast's `onClose` can tell "acted on the content" (its Action part, `"activate"`) from everything else. | The platform's `close` or `toggle` event; the click or keydown for Toast. |
| `"timeout"` | The library's own timer closed the component: no user gesture and no platform event. Toast's auto-dismiss is the only user; the Undo-window pattern (`design/components/toast.md` 9.3) relies on it being distinct from `"dismiss"`. | `undefined` |

**Channel and `reason` are independent** (3.9.2).
On an overlay Root the channel says whether the library held the change (`openChangeAction`, a
request) or not (`onOpenChange`, a fact); `reason` says what the user did. Most facts are
`"dismiss"` and most requests `"activate"`; `"platform"` is always a request. The crossovers:

| Channel | `reason` | Where |
| --- | --- | --- |
| `onOpenChange` | `"activate"` | A consumer's own invoker button (`popovertarget`, `commandfor` with a popover command) closes a popover, menu or listbox; a non-button Trigger pressed while open (light dismiss hid it at `pointerup`, the click names the cause). |
| `openChangeAction` | `"dismiss"` | A close the library does hold although no part asked: the pointer leaving a hover-opened submenu; lost interest while an interest open is still pending (nothing is shown yet). |

Components whose close carries a platform result add it as a serialisable field next to
`reason`: Dialog's `details.returnValue` is `dialog.returnValue` (the `value` of the Close button
or form submitter, or the string passed to `requestClose()`), `undefined` on open.

Components with a **set-valued state** describe what changed as a diff, `added: readonly
string[]` and `removed: readonly string[]` (CheckboxGroup), so that one shape covers a single
item, a multi-item trigger and a platform path, and a controlled "update on success" parent can
apply it as a functional update instead of writing the whole set (section 2.5). Accordion's
earlier `item` / `open` pair stays as is; a new set-valued component uses the diff form.

Adding a value is a change to this document, not to one component. The first argument is always the next value, so the
common case stays short:

```tsx
<Toggle pressedChangeAction={(pressed) => save(pressed)}>Favorite</Toggle>
<Tabs.Root valueChangeAction={setTab}>...</Tabs.Root>
```

The return type is `unknown`, not `void | Promise<void>`: TypeScript's void-return leniency does
not apply to unions, so `(next) => save(next)` with `save` returning `Promise<Response>` would be
a type error, and Server Functions usually return data. The library `await`s whatever comes back
(a thenable is awaited; anything else is ignored). v0 has no `cancel()` on `details`.

**`details` is serialisable; `event` is virtual**
(`docs/research/server-function-action-props.md`): React's reply serialiser rejects a DOM `Event`
as an own property (throws without a temporary-reference set, opaque `$T` reference with one), a
non-enumerable `event` triggers a misleading dev warning on every call, and a Server Function
cannot be detected on the client. So:

1. `details` is always a **plain, extensible object of serialisable fields** (strings, numbers,
   booleans, `undefined`). Component-specific fields such as `reason` are ordinary own
   properties.
2. `event` is a **virtual, non-own property** served by a `Proxy` `get`/`has` trap. The internal
   helper `createActionDetails(event, fields)` (`internal/action/action-details.ts`, directive-free) is
   the only way the library builds `details`.
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
   (`Button`) does not read `defaultPrevented` at all: an outer part that renders it
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
9. **Parts are never natively disabled while pending.** A pure trigger whose `whilePending` is
   `"ignore"` (by default or by prop, section 2.5.1) ignores activation while its own action is
   pending and says so with `aria-disabled="true"`; one whose `whilePending` is `"run"` runs
   every activation and renders `data-pending` only (sections 2.5.1 and 3.6).

### 2.4 Errors

An action that throws or rejects reaches the **nearest Error Boundary above the library
component that owns the transition** (the `Root`, or the component itself), with two exceptions,
both rejections React itself would drop, which are passed to the global `reportError` instead:
the rejection of a **superseded** action (an older one, when a newer action of the same owner was
dispatched before it settled), and the rejection of the latest action when its **owner is gone**
(unmounted, or hidden) by the time it arrives. The library never swallows an error. There is no
`errorAction` prop in v0.

Why the exceptions: `useTransition` keeps one thenable per `startTransition` call and only the
newest is ever unwrapped, and it routes a rejection only through a render of the component that
owns it; an older action's rejection, or one whose owner no longer renders, reaches no
boundary, no `reportError` and no `unhandledrejection`. Throwing a superseded rejection from
render instead would replace the whole UI because of an intent the user had already replaced.
So the library does what React's standalone `startTransition` does with a rejection it has no
boundary for: it reports it. The UI stays up and shows the latest intent; the failure reaches
`window.onerror`, monitoring tools and test runners.

Contract (implemented per instance by `useControllableAction`, `useActionTrigger` and
`Form.Root` for the submissions it runs in its own transition):

- The **latest** dispatch's rejection propagates through React's own path while its owner is
  mounted and visible: the hook rethrows it inside the transition. It reaches the boundary only
  **after every older overlapping dispatch has settled**, because React holds the boundary's
  commit while the entangled action lane is still pending (2.3 item 5); a test that rejects
  the newest of two dispatches must not expect the fallback before the older one resolves.
- "Latest" is judged **when the rejection arrives**: a dispatch is superseded when another
  dispatch of the same hook instance was made after it, whether that one is still pending or has
  already settled.
- A **superseded** dispatch's rejection is caught by the hook and passed to `reportDropped`
  (`internal/action/report-dropped.ts`): the global `reportError` (a window `error` event), or
  `console.error` in an environment without it. Nothing is thrown, no state is written, no
  boundary is involved, and the newer dispatch's outcome is unaffected. **Every** superseded
  rejection of a burst is reported, each once, in the order they arrive, also **after
  unmount**. When the latest dispatch rejects as well, it still goes to the boundary; the two
  routes are independent.
- **The latest rejection once the owner is gone is reported too.** The hook rethrows a latest
  rejection only while its component's effects are connected (`useConnected` in
  `internal/action/use-connected.ts`); otherwise it passes it to `reportDropped`. Effects are
  disconnected when the component is unmounted and when it is **hidden**: by an
  `<Activity mode="hidden">` (the consumer's, or the library's own for a closed overlay with
  `keepMounted`), or by a shown Suspense boundary that re-suspends and shows its fallback
  (Toast's Suspense guard is one). A rejection that arrives while hidden does **not** reach the
  boundary when the component is shown again, where React would deliver it: a deliberate
  deviation from React. Each rejection goes one route, exactly once. Reachable: a
  `Toast.Action` whose toast is closed while its action runs (toast.md walkthrough 6) or whose
  content an urgent `toast.update` made suspend; a `Menu.Item`, menu checkable item or Close
  part whose overlay is dismissed meanwhile (menu.md walkthrough 4); any state owner removed
  while its action is pending. Not handled (React behaviour): a latest rejection that arrives
  while the owner is connected is rethrown, and if the owner unmounts in that same commit React
  still drops it.
- **A request superseded by a fact**: a fact on an overlay Root (`adoptFact`, 3.4) makes every
  dispatch in flight superseded at once, so a later rejection of one of them is passed to
  `reportDropped` and its resolution commits nothing.
- **A fact handler's errors are not action errors**: an `on*` handler's synchronous throw and
  its returned promise's rejection go to `reportError` (the handler rule of 2.1,
  `internal/action/call-urgent-handler.ts`); nothing reaches an Error Boundary, and the library's own
  bookkeeping around the call (the committed `false` of a fact, a toast's queue write, a
  Combobox text write) stands.
- A component with **two transition channels** (Slider and NumberField: steps through
  `useActionTrigger`, commits through `useControllableAction`; `internal/action/use-step-commit.ts`)
  needs nothing extra: each channel judges "latest" among its own runs and reports its own
  superseded rejections, also while the other channel's action is pending. There is no
  hook-order constraint and no shared capture.
- For a **pure trigger** the superseded path is reachable exactly when its `whilePending` is
  `"run"` (2.5.1; the default of `Button`). With `"ignore"` it never has two runs in flight, so
  every rejection is a latest one.

Consequence for tests: in a real browser `reportError` dispatches a window `error` event, which
vitest browser mode counts as an unhandled error, and vitest's jsdom environment has no
`reportError` (the `console.error` fallback runs). A test that makes an older action reject stubs
the global (`vi.stubGlobal("reportError", vi.fn())`) and asserts on it (section 10.1).

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

- **Single-valued state (Toggle, Tabs, Select, RadioGroup, an overlay's `open`, Accordion and
  ToggleGroup with `exclusive`): latest intent wins.** The optimistic value already shows the
  most recent dispatch; the library commits uncontrolled state only for the most recently
  dispatched action, ignoring earlier ones that resolve later. (Verified: without this guard the
  slowest promise wins.) An earlier action's *rejection* changes nothing on screen; it is
  reported through `reportError` (section 2.4).
- **Set-valued state (CheckboxGroup; ToggleGroup and Accordion without `exclusive`; Combobox
  with `multiple`): every resolved change is kept**. Each dispatch is one change to the set (a patch: `added` /
  `removed`, or one item opened or closed), and the changes are independent intents, so "latest
  wins" would be wrong in both directions: the latest `next` is computed from the intended set
  and so contains earlier in-flight changes, including one whose action later rejects. The
  uncontrolled value is therefore committed from the dispatches that **resolved**: when the last
  overlapping dispatch settles, they are replayed with the component's reducer onto the
  committed value, in dispatch order (not resolution order); a rejected dispatch leaves no trace
  (section 3.3). Check A (its save rejects), check B (its save resolves): the group ends with B
  only. Consequence for the consumer: the `next` an action receives is the *intended* value
  (B's action is called with `[A, B]`), which may contain a change that fails later. An app that
  persists `next` whole can end out of step with the group; persist `details.added` /
  `details.removed` (or the one `details.item`) instead. Component docs say so.
- **Controlled parents are not guarded.** The latest-intent guard protects uncontrolled state
  only. A controlled "update on success" parent that writes the *whole value*
  (`startTransition(() => setChecked(next))` after its `await`) lands writes in completion order,
  so under overlap with differing completion order the slower, older intent wins, and a
  set-valued parent that adopts `next` whole also adopts a change whose action rejected (the
  replay above is uncontrolled only; `design/components/accordion.md` 2.2).
  Recommended: functional updates keyed by what changed, or a sequence check in the parent, or
  uncontrolled mode. Component docs show the pattern next to every "update on success" example.
- **No queueing in the library.** Components that need ordered, result-threaded actions (forms,
  counters) use `useActionState` internally and document that. None of the initial four do.
- **Pure triggers: `whilePending` decides.** A part with a bare `action` and no value has nothing for
  "latest intent wins" to protect. Whether an activation that arrives while the part's own
  action is pending **runs** (React's behaviour for `useTransition` and `<button formAction>`)
  or is **ignored** (what a Save button wants) is the part's `whilePending` prop, and the
  default follows who owns the action: section 2.5.1. `Form.Submit` is not a pure trigger (its
  pending is the form's, 2.7): it has no guard and no prop. A state owner (Toggle, Tabs, the
  Menu checkbox / radio items) is not a pure trigger either: latest intent wins there, no prop.
  The *steps* of a continuous control (`Slider.Root`, `NumberField.Root`, which run them through
  `useActionTrigger`) always run: a step is not a re-entry, no prop.
- Consumers who need abort semantics implement them in the action (`AbortController` captured in
  a ref); the library passes no signal in v0.
- **Overlap never includes user input.** An action that awaits a promise another user action is
  supposed to resolve cannot overlap with it: the second action's transition is held by the
  first (section 2.3 item 6). Design flows as independent dispatches.

#### 2.5.1 `whilePending` on pure triggers

```ts
/** What a pure trigger does with an activation that arrives while its own action is pending. */
export type WhilePending = "run" | "ignore";
```

```tsx
<Button action={async () => { await incrementOnServer(); }}>+1</Button>    // every click runs
<Button action={save} whilePending="ignore">Save</Button>                  // one save at a time
<Dialog.Close action={deleteItem}>Delete</Dialog.Close>                    // one run, then the close
<Dialog.Close action={log} whilePending="run">Close</Dialog.Close>         // every click runs
```

This section is the library-wide rule: the prop, the default of every part and what each value
guarantees. The mechanics (the click handler, the guard, the per-part behaviour) are in
`design/components/button.md` 5, 16 and 18, and in `internal/action/use-pure-trigger.ts` /
`use-action-trigger.ts` (3.4).

A string, not a boolean, so that a later mode can be added without a second prop; the two
values name what happens to the new activation. Every pure trigger accepts both, so the prop
can be computed (`whilePending={saving ? "ignore" : "run"}`). **Not offered: `"queue"`.**
Ordered, result-threaded runs are `useActionState`, passed as `formAction` or called from the
action (also the answer for a set-valued action whose `next` may contain still-pending
changes, 2.5).

**The default follows who owns the action:**

- **The user owns it**: the library does nothing on activation but run the consumer's function.
  Default **`"run"`**. Whether two overlapping runs are a bug (Save) or the point (a counter) is
  a fact about that function, which only its author knows; the library adds no policy, as React
  does not.
- **The library owns it**: activation does something of the library's own, with no user code
  needed (a Close part closes its dialog). Default **`"ignore"`**: the activation consumes the
  part, there is nothing to count, and a second run can only repeat a side effect.
- **Mixed** (the consumer's `action`, then a library-owned step): `"ignore"` exactly when a
  resolved run makes the library act on the part's container (close it), `"run"` when the
  library-owned step is switched off (`closeOnActivate={false}`, `closeOnSettle={false}`),
  because the part is then a user-owned trigger that happens to live in a menu or a toast.

| Part | What one activation does | Owner | Default |
| --- | --- | --- | --- |
| `Button` with `action` | runs the consumer's `action` | user | `"run"` |
| `Button` with a function `formAction` | React submits the form with the consumer's function | user (React runs it) | `"run"` |
| `Button` with neither (plain, URL `formAction`, `command`, link) | the native default action | – | nothing is ever pending: the prop has no effect |
| `Dialog.Close`, `Popover.Close` without `action` | the library closes the overlay | library | nothing pends in the part (the close is the Root's dispatch, and a repeat is a no-op, 2.3 item 8): the prop has no effect |
| `Dialog.Close`, `Popover.Close` with `action` | the consumer's `action`, then the library's close | mixed | `"ignore"` |
| `Menu.Item` with `action`, `closeOnActivate` (default `true`) | the consumer's `action`, then the library closes the menu | mixed | `"ignore"` |
| `Menu.Item` with `action`, `closeOnActivate={false}` | the consumer's `action`; the menu stays | user | `"run"` |
| `Menu.Item` without `action` | the library closes the menu, synchronously | library | nothing pends: no effect |
| `Toast.Action`, `closeOnSettle` (default `true`) | the consumer's `action` (the part's or the toast's), then the library closes the toast; the timer is paused meanwhile | mixed | `"ignore"` |
| `Toast.Action`, `closeOnSettle={false}` | the consumer's `action`; the toast stays | user | `"run"` |
| `Menu.CheckboxItem`, `Menu.RadioItem` | a state change (`useControllableAction`) | state owner | no prop: latest intent wins |
| `Slider.Root`, `NumberField.Root` steps (`valueChangeAction`; `NumberField.Increment` / `Decrement` request them) | a state change, one step of a gesture | state owner's second channel | no prop: every step runs |
| `Form.Submit`, `Dialog.Form` | the form channel (2.7) | React's form | no prop, never guarded |
| a toast's `onClose` | a handler, not an action (2.1): runs once when the toast leaves, by construction | – | no prop |

A default that depends on another prop (`closeOnActivate`, `closeOnSettle`) is a cost each
page's props table has to spell out; it was chosen over a fixed `"ignore"` for every part of an
overlay, which would leave the counter case (a "Zoom in" item that stays open) needing the
prop. `toast({ action: { label, action } })` (`ToastActionOptions`) carries no `whilePending`:
the behaviour props live on the part, so the consumer sets it on `<Toast.Action>`.

**The effective value** is `whilePending ?? <the part's default>`, read when the activation
arrives (a change while a run is in flight applies to the next activation; the rendered
`aria-disabled` follows the current render). At runtime only the string `"ignore"` ignores; any
other value runs. No development warning for a part on which the prop has no effect.

**`"ignore"`.** While the part's own run is in flight, a click, Enter or Space:

- starts nothing: no second run, no continuation;
- is `preventDefault()`ed, which cancels the click's **default action**: a `render`ed link does
  not navigate again, a function-`formAction` Button does not submit the form again (the
  implicit-submission click on the default button included), a `command` / `popoverTarget`
  does not run again. It is not `stopPropagation()`ed, and other listeners (focus, hover, the
  consumer's pass-through handlers) are untouched;
- finds the part rendering **`aria-disabled="true"`** for as long as it renders `data-pending`
  (3.6).

The guard reads **only** the synchronous in-flight counter of `useActionTrigger` (so two
activations in one task are caught), never the last render's `pending`: after the action
settled React may hold the commit that clears `pending` (entanglement, 2.3 item 5; a suspended
render), and a click in that window starts a new run rather than being dropped. So
`aria-disabled` may outlast the guard by the held window (`button.md` 5.2). The one exception
is `Button`'s function `formAction`, whose only source is React's form status, a render value.

**`"run"`.** Every activation starts a run in the part's own transition:

- the guard cancels nothing: each click also performs its default action (a link navigates, a
  `formAction` Button submits again, a command runs again). A part that cancels the click as
  its own mechanism (a Close part in library mode) keeps doing so; that is not the guard;
- **`data-pending` / `state.pending` only, no `aria-disabled`** from pending: the part still
  acts, and telling assistive technology it is unavailable would be false. `pending` stays true
  until every run has settled and the result has committed;
- **the continuation (a Close part's close, an item's menu close, a toast's close on settle)
  runs once, when the last run in flight settles, and only if the latest run resolved**, still
  under that run's open-generation guard (3.4). So "a rejection leaves the overlay / menu /
  toast open" holds in both modes, and the part stays (pending) until its last run is done. An
  older run that resolves runs nothing; an older run that rejects after the latest resolved is
  reported and the close still runs when it settles;
- errors follow 2.4 as for any owner: the **latest** run's rejection reaches the Error Boundary
  above the part, after every older run has settled; an **older** run's rejection is passed to
  `reportError`, each once. The owner-gone route is reached only when something else removes
  the part meanwhile (a dismissal, `toast.dismiss`), as in `"ignore"` mode. An ignored
  activation is not a run and reports nothing;
- a `Button` with a function `formAction` is React's form channel, not the library's
  transition: overlapping submissions behave as React's own submitter does, which includes
  React **dropping** the rejection of an older overlapping submission. The library cannot
  observe that rejection and does not report it; the Button page says so and points to
  `whilePending="ignore"` and to `useActionState`.

"Await nothing" (`action={() => { void inc(); }}`) stays valid for "the UI must not wait" (2.3
item 5); it is not needed to make every click count.

### 2.6 The "no handlers" rule and urgent updates

The library offers **action props**, which are always transitions. There is no `onClick`, no
`onPress`, no `onChange`; the only handler-shaped props are the fact handlers of 2.1
(`on<State>Change`, `on<Event>`), and they are handlers *because* they are not transitions.

What is still reachable, and why it is not a contradiction:

- Native DOM event props the part does not itself use pass through to the element (section 1.5).
  They are the platform's, not ours, and are typed as the element's props.
- `ref` gives the element for `addEventListener` when a component needs an event React does not
  synthesize (`command`, `beforematch`).

**The urgent lane** (the vision's documented opt-out). A state that React requires to be
urgent, which today means the text of a controlled text input ("Transition updates can't be
used to control text inputs"), keeps `x` / `defaultX` and takes a **handler** instead of an
action: `inputValue` / `defaultInputValue` / `onInputValueChange`. The name is the ordinary
React `on<State>Change` form because `Action` is the library's promise of a transition, an
await and pending state, and this prop is none of those. The type says the same:

```ts
/** Called synchronously, outside any Transition, and not awaited: the urgent lane. Not an action.
 *  May return a promise; a rejection or a synchronous throw is passed to reportError (2.1). */
export type UrgentChangeHandler<T, Details extends ActionDetails = ActionDetails> = (next: T, details: Details) => void;
/** The same for a fact that carries no state (a toast's `onClose`). */
export type UrgentHandler<Details extends ActionDetails = ActionDetails> = (details: Details) => void;
```

(`void` as the return type accepts a function that returns a promise.) The form has three
users (2.1): the text of a Combobox, the dismissal of an overlay, a toast that left. A new one
passes the gate of 2.1 and the type guard (10.1, "Action naming").

Rules for an urgent state:

- The library sets its own `useState` for the value and calls the handler synchronously from
  the DOM event (and from its own documented writes), never inside `startTransition`, so a
  controlled parent's `setState` in the body is an urgent update.
- Nothing is awaited, pending or optimistic for it (the DOM already holds the value); the
  handler rule of 2.1 covers a returned promise and a throw.
- A controlled urgent prop follows the DOM and does not gate it.
- Everything the urgent value drives (a deferred query through `useDeferredValue`, an open, a
  selection) leaves the urgent lane at once and is a transition or a deferred render.
- A library write to an urgent state that follows a **rejected transition action** (Combobox's
  text rollback) leaves the transition before writing: an action that throws *synchronously*
  makes the wrapper's `catch` run inside the `startTransition` callback, so the wrapper yields
  once (`await undefined`) before the write and the rethrow.
- The library uses the lane only where React requires it; "transition by default" is unchanged
  for every other state. Component docs name each urgent state. Consumers who need an urgent
  update from an interaction that has no urgent handler still use pass-through or `ref`,
  unsupported as before.

Other urgent states, none of which has an `UrgentChangeHandler` prop or an `x` / `defaultX`
pair:

- **A state that is urgent by design: the Toast queue.** A toast reports on an action that is
  pending elsewhere; a transition push would be held by that very action (2.3 item 5), so every
  queue mutation (add, update, dismiss, drop after exit) is a normal update. Its input is not a
  prop at all: the imperative `toast()` builds a command and dispatches it from a
  `queueMicrotask` callback, so a call made inside a `startTransition` scope (an action's sync
  prefix) escapes the scope while order is preserved; the Viewport applies the command with
  `useState`. What the toast *drives* through a request (its Action part's action) is a
  transition as usual; the report that it left is a handler, `onClose` (2.1). Its commits never
  run a view transition (5.1).
- **Consumer state that reports on a pending action** (a progress value, Progress) is written
  with a plain `setState`, which after an `await` inside the action is urgent anyway; wrapping
  it in `startTransition` holds it until the very action it reports on settles (2.3 item 5), so
  the bar would sit at 0% and jump to 100%. It is the one place the library's "wrap it in
  `startTransition`" advice inverts, and component docs that display such a value say so.
- **A mirror of a browser-owned validity fact.** `Field.Root` reads `:user-invalid`, `validity`
  and `validationMessage` from its control on `input`, `change`, `focusout`, `invalid` and
  after `reset`, and writes them with `useState` from the DOM event, never inside
  `startTransition`: the DOM already holds the fact, nothing is awaited or optimistic, and the
  error element and its `aria-describedby` token must be in the DOM when the library focuses
  the first invalid control a microtask later (a transition commit would land after the focus
  move, and later still while any async action is pending). No `transition` prop
  (`design/components/field-form.md` 2.4).
- **The draft text of a NumberField** is internal: written from the `input` event with
  `useState`, because the text is not a value until it is parsed at commit (blur, Enter, or
  before a step). The value under a held `Increment` / `Decrement` button follows Slider's
  `live` rule (3.2).

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
  and `Form.Submit` do, and a control inside a Field keeps its own `data-pending` for its
  own action, so the two meanings never share an element. A part with its **own** function
  `formAction` (`Button`) may expose the channel's pending **for its own submissions only**:
  `useFormStatus().action` is the latest submitter's function, so once `status.pending &&
  status.action === formAction` has been rendered the part latches it and stays pending until
  the channel is idle: pending from its own submission until the form's submissions have all
  finished, and never for another submitter's alone (`status.action` is overwritten by an
  overlapping submission, so a bare comparison would lose it). This is the third and last allowed
  reading of the channel; a plain `type="submit"` button with no `formAction` reads nothing.
- A part may **observe** the form channel to perform a platform side effect after a successful
  action (`Dialog.Form` closes the dialog once the action's transition settles); it never wraps
  the action (so a Server Function keeps progressive enhancement) and never reports form pending
  as its own `pending`. `Form.Root` goes one step further while keeping both properties:
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

One accepted exception (Select): `Select.Root`'s `value` is `string`, with `""` for the
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
| `optimistic` | `useOptimistic(committed, reducer)` | sync | trigger parts (`Tab`, `Trigger`, `Toggle`): `aria-pressed`, `aria-selected`, `data-selected`, state passed to their function props. ARIA state only where the optimistic value is what is displayed: a `<button>` overlay Trigger renders no `aria-expanded` at all (a `popovertarget` invoker: the browser exposes the popup's state), and where the attribute is still rendered (a non-button Trigger render, the Combobox Input) it follows the shown popup, the `shown` mirror below |
| `pending` | `useTransition()` | sync | `data-pending` on the owner and on the trigger that initiated the change |
| urgent (`inputValue`, the active option of a listbox) | `useState`, written from the DOM event; reported through an `on<State>Change` handler, not an action (section 2.6) | sync, urgent | the controlled text input; `aria-activedescendant` and `data-active` |
| urgent, internal (the value a slider gesture has reached, `live`; NumberField's draft text and the value under its held button) | `useState`, written from the pointer or `input` event; no consumer-facing urgent action | sync, urgent | the thumbs, while a pointer is captured or a step or commit is in flight (`held`); otherwise they render `optimistic` (Slider 2.2) |
| urgent, internal (`shown`: the popup is in the top layer) | `useState` in `usePopoverRoot` (Popover, Menu, Combobox; Dialog has none), written by the Popup from its `toggle` event (read from `:popover-open`, never `newState`), set at mount for a pre-hydration open, cleared when the Popup unmounts; never inside a transition, so neither a pending notification nor an action entangled with it can delay it | sync, urgent | `aria-expanded` on a non-button overlay Trigger render and on the Combobox Input (library mode; a `<button>` Trigger is a `popovertarget` invoker and renders none); `false` on the server and at hydration |

**Virtual focus is urgent library state.** Where a pattern keeps DOM focus on one element and
moves focus virtually with `aria-activedescendant` (Combobox), the active item is a plain
`useState`, never a transition and never a dispatch: it is focus, which is immediate and
browser-owned everywhere else in the library, and a transition would freeze it while any async
action is pending (entanglement, section 2.3 item 5).

**A roving Tab stop over children the library did not render is urgent library state that lives
outside React** (Toolbar and a standalone ToggleGroup): which item carries `tabindex="0"` is a
focus fact, not a value, so it is a ref updated from `focusin` / `focusout` / `pointerdown` and
re-derived in layout effects, and the attribute is written through the DOM by the container's engine (section
7.4), never rendered by the items. No `useState`, no transition, no `data-*` attribute.

**The position under a captured pointer is urgent library state** (Slider), for the same
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

One rule bounds this: an ARIA state attribute describes what the user agent shows, so it carries
the optimistic value only where that value is what is displayed (a pressed toggle, a selected
tab, a checked menu item). Where the platform owns the ARIA state and forbids overriding it
(`<summary>` may not carry `aria-expanded`; its expanded state comes from `<details open>`), or
where the attribute describes an element whose visibility follows committed state (`aria-expanded`
on a Popover, Menu or Combobox Trigger and on the Combobox Input: the Popup is shown from
`committed`, and every engine exposes a `popovertarget` invoker's shown state whatever an
attribute would say, `docs/research/invoker-aria-expanded.md`), optimistic state is **visual
only** (`data-open`, `state.open`) and assistive technology hears what is shown: `<details open>`
for the Accordion, the popover's own state for a `<button>` overlay Trigger (a `popovertarget`
invoker with no `aria-expanded`, ARIA in HTML #514), and the Root's `shown` mirror of the
popup's `toggle` (the urgent row above) where an attribute is
still rendered (a non-button Trigger render, the Combobox Input). The mirror, not `committed`,
because a transition entangled with an unrelated action can hold `committed` for that action's
whole duration (an open, a part's close), while the attribute must equal `:popover-open` within a
task in every phase. (A dismissal is a fact and commits `false` urgently in its own
event, so the two agree there; they differ during a request and for a refused fact's
re-show.) The component doc says so explicitly.

### 3.3 When uncontrolled state is committed

After the action resolves, inside a re-wrapped `startTransition`. Which value is written depends
on the shape of the state (section 2.5):

- **Without a reducer** (single-valued state): the dispatch's `next`, and only if no later action
  has been dispatched since (the latest-dispatch guard; latest intent wins).
- **With a reducer** (set-valued state: CheckboxGroup, and ToggleGroup and Accordion without
  `exclusive`): nothing is written while another dispatch of the same owner is in flight.
  When the last of the overlapping dispatches settles (resolved or rejected), the dispatches that
  **resolved** are replayed with the reducer onto the committed value, in dispatch order, in one
  functional update; the rejected ones are skipped. If none resolved, nothing is written. A
  single dispatch with no overlap is the degenerate case: its change is applied when it
  resolves.

Both give:

- Rollback on rejection for free (nothing was written for the rejected dispatch).
- Identical observable timing to writing before the `await`: transition-lane writes inside an
  async action are held until it settles anyway (verified), and React entangles overlapping
  actions, so waiting for the whole burst costs nothing visible either.
- Controlled/uncontrolled parity when the controlled parent follows the "update on success"
  pattern (for set-valued state: with functional updates keyed by what changed, section 2.5).

Details of the replay:

- **The reducer is the optimistic reducer.** One function does both jobs: it re-bases stacked
  optimistic patches onto a changed committed value (section 3.4), and it replays resolved
  changes at commit. It must therefore read the change from `details` (the patch or the item),
  not from `next`.
- **Absolute dispatches.** A dispatch that is not a change by the user but the whole value the
  browser left behind is made with the internal option `dispatch(next, details, { whole: true })`:
  its `next` bypasses the reducer, in the optimistic step and in the replay. The reducer itself
  never decides it. Two exist: CheckboxGroup's
  **form reset** (a reset replaces the value, so a change rejected after it cannot survive it),
  recognised from the path `useNativeGroupReconciliation` names in `onPlatformChange`'s third
  argument (`NativeGroupPath`: `"reset"` from its `reset` listener, `"mount"` from the mount and
  late-mount reconciliations, which stay patches); and Accordion's **mount reconciliation** in
  multiple mode (all pre-hydration clicks as one `next`), dispatched whole from the Root's mount
  layout effect. The option is internal and appears in no public details type.
- **Exclusive modes pass no reducer.** `exclusive` ToggleGroup and Accordion are single-valued:
  the optimistic value is `next` and the latest dispatch commits it, exactly like Tabs. (A patch
  reducer there would bring a replaced item back: a rejected press followed by a resolved
  release replays to the old item.)
- **When the latest dispatch rejects**, the earlier resolved changes are still committed, and
  the rejection then reaches the boundary (section 2.4).
- **Controlled mode writes nothing**, with or without a reducer; the reducer is then only the
  optimistic re-base.
- **An absolute reset joins a burst even with an empty diff**. A CheckboxGroup form reset
  whose target equals the intended value is still dispatched (with empty `added` / `removed`)
  while a dispatch is in flight, uncontrolled, unless the latest dispatch is itself a reset;
  otherwise it would not enter the burst and an earlier in-flight change that rejects later would
  roll the group back past the reset. With nothing in flight, or controlled, an equal reset
  dispatches nothing (`useNativeGroupReconciliation`'s `dispatchEqualReset` option).

For a continuous control (Slider) "the action" is the gesture's **commit** action: steps
(`valueChangeAction`) write no uncontrolled state, the commit's resolution does, so a rejected
save rolls the whole gesture back, and a controlled parent gets the same by adopting on commit
success. The step channel is told of the revert with one `"dismiss"` dispatch in uncontrolled
mode (Slider 2.4).

Matches implication #4 of `docs/research/react-async-apis.md` (probes in
`memo/architect/conventions-notes.md`).

### 3.4 The shared hook

Moved to `design/internal-hooks.md`, same number. In one line: every state owner runs on
`useControllableAction` (committed, optimistic and pending state, `dispatch`, `adoptFact`) and
every pure trigger on `useActionTrigger`, so that all components behave identically.

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
| Optimistic source | `useOptimistic` | The DOM itself. An ARIA attribute on another element that must report it to assistive technology (`aria-expanded` on a non-button overlay Trigger render or the Combobox Input; a `<button>` Trigger renders none, its `popovertarget` exposes the state) renders an urgent `useState` mirror written from the platform event (`toggle`, reading `:popover-open`), never transition state |
| `xChangeAction` | Can be awaited; the UI waits for it | Requests only (an overlay's opens and the closes its parts ask for). A change the browser performed is a **fact**, reported to the `on*` handler (`onOpenChange`) synchronously in the platform event (`toggle` / `close`), outside any transition, not awaited |
| Controlled mode | React value is the source of truth | React value is re-applied to the DOM after every commit once nothing is in flight (`showPopover()` / `hidePopover()`, `showModal()` / `close()`); a parent that keeps `open={true}` after a fact gets the popup re-shown in the fact's own commit. It follows the browser, it does not gate it |
| Pending | `data-pending` while the action runs | `data-pending` while a request runs; a fact never pends (the open/close itself is already done) |
| Server Components | Only through Server Functions as actions | Uncontrolled form needs no behaviour JS; the part may still be a client module (section 7.3) |

**Residual browser paths.** A library-owned state the browser can also change is reconciled by
dispatching the change with `details.reason: "platform"` (2.2; user dispatches use
`"activate"`) and `event` set to the platform event, or `undefined` at mount, then re-applying
committed state to the DOM after the action settles. The paths (the hooks are in 3.8):

- **Find-in-page** revealing `<details>` or `hidden="until-found"`.
- **Mount reconciliation**, one dispatch per component or group: pre-hydration clicks on
  `<summary>` or a native input, and Firefox's form-state restoration of `checked` across
  reloads (react-dom keeps the DOM value when hydrating and fires no `onChange`). Likewise for
  values: text typed into a controlled text input before hydration (Combobox) is adopted at
  mount through the urgent handler with `reason: "platform"`; a value stepped into a native
  range (Slider) through its step + commit dispatch; text typed into a NumberField's visible
  input is parsed and dispatched as a `"platform"` step + commit, or adopted as the draft when
  the input is still focused.
- **Form reset**, both an external `form.reset()` and React's automatic reset after a successful
  `<form action>` (`requestFormReset`), which restores controlled inputs to their mount-time
  default without telling React. Each native-input component listens to `reset` on `input.form`
  through its ref and, in a microtask after the reset, dispatches the new value with `event` set
  to the `reset` event. What the reset target is, and how it reaches each kind of input (a
  checkable input, a controlled value input, a hidden input, a hidden native input that is not
  the user's surface), is 3.8 rule 6. A component that owns a form value with no visible form
  element of its own **mirrors the optimistic value into a hidden input** and listens to
  `reset` on it (Combobox).
- A form `reset` also **clears the user-validity flag (`:user-invalid`) but not custom
  validity**, so `Field.Root` re-reads its validity mirror and recomputes its custom-validity
  slot in the reset microtask.
- **Late-mounting options in a `<select>`** are never selected by React (`updateOptions` runs
  only in the select's own commit), so the Root re-applies the intended option when an Option
  reports its mount: an option that **hydrated** is reconciled first (a user may have picked it
  before hydration), one React **created** is only re-applied (the browser's automatic
  first-option selection on insertion is not an intent); the two are told apart by
  `useSyncExternalStore`'s server snapshot. A platform dispatch on a `<select>` requires the
  **intended option to exist in the DOM**, so a value whose option is still loading is never
  "reconciled" to the fallback.
- **The settle of a form submission** (the `useFormStatus` `true → false` edge) is a
  form-channel event the library observes without owning: `Dialog.Form` closes on it;
  `Form.Root` advances its settle generation, focuses the first errored field and applies
  `autoReset` on it.

Rules:

- A component prefers browser-owned state when the platform offers it (Popover API over a React
  `open` boolean, `<details>` over a JS disclosure). That is principle 5 of the vision, and it is
  the only way a primitive can be JS-free.
- A component never mirrors browser-owned state into React state as the source of truth. It reads
  the DOM (`matches(":popover-open")`, `details.open`) when it needs the value for attributes.
- Per-component designs list every state and label it library-owned or browser-owned.
- `<ViewTransition>` does not apply to browser-owned open/close (the browser performs it outside
  a React transition): those parts animate with `@starting-style` and
  `transition-behavior: allow-discrete`, and the component docs show the CSS. It **does** apply
  to a **library-driven** open or close of a top-layer element: when the part calls
  `showPopover()` / `hidePopover()` (or `showModal()` / `close()`) in a layout effect of a
  transition commit and the boundary wraps the top-layer element itself (5.1), enter and exit
  are captured, in Firefox too, where CSS cannot animate a popover's exit. Popover uses this
  for its part-initiated closes (`design/components/popover.md` 2.3, 10.2), Dialog for its
  Close part, Form and controlled close (`design/components/dialog.md` 2.3, 10.3).
- A library-driven **move** of a shown top-layer element (Menu's context menu re-opened at a
  new point) is not a state change: no dispatch, the part re-shows the popover under its
  own "opening" flag so the coalesced `toggle` (`open` → `open`) notifies nothing, and the
  component doc says what else the move does (focus, pointer capture).
- **Resolved placement is browser-owned geometry, observed** (13.2): which
  `position-try-fallbacks` option the browser applied is read from the shown popup's computed
  `position-area` and mirrored into a plain `useState` in the part, written **urgently** from
  platform events and only when the value changed. It is exposed as `data-side` / `data-align`
  / `state.side` / `state.align` (4.1) and is never the source of anything. Urgent for the
  reason the context menu's placement is: a transition write would wait for an unrelated
  pending action and the arrow would point the wrong way meanwhile.
- A **module-level registry** is an allowed shape for a cross-component fact the DOM does not
  expose: `src/internal/overlay/modal-registry.ts` (directive-free) holds the stack of open modal
  `<dialog>` elements; `Dialog.Popup` pushes after `showModal()` and removes on `close` and
  unmount, and a reader (Toast's Viewport, which portals its region into the topmost modal so
  it is not inert) subscribes through `useSyncExternalStore` with a server snapshot of `null`.
  Writes happen in layout effects or platform event listeners, never during render; the
  registry is never the source of truth for a component's own state.
- **Relocating a portal without a remount**: `createPortal` remounts its subtree when the
  container changes, so a region that must follow something (Toast's region, into and out of
  the topmost modal) portals once into a **library-owned `display: contents` host element** and
  the library moves that host with a DOM `append` (between an inline anchor rendered where the
  component is and the current target); React never sees the move and in-flight state
  (`useActionTrigger`, timers) survives it. The hydration render stays inline to match the server
  HTML and switches to the portal on the first client render (Toast 4.3).
- A fourth kind of state, **consumer-owned, mirrored**: a controlled-only prop that the library
  writes to a DOM property it does not own (`Checkbox`'s `indeterminate`, Dialog's
  `returnValue`; not Progress's `value`, which is rendered as attributes and is simply a prop).
  It has no `defaultX` and no action; the library re-applies it after every commit and may
  suspend it while an action is pending (4.1).
- A state may be **library-owned for some causes of a change and browser-owned for others**
  (an overlay's `open`: opening and the closes a part asks for are transitions the library
  drives and awaits; a dismissal is performed by the browser and is a fact). Such a state has
  both props, `xChangeAction` for requests and `onXChange` for facts (2.1, 3.9), and the
  component doc lists which cause goes where.
- **Which closes a component may own.** Where the platform step a part's close goes through is
  **cancelable without an anti-abuse rule**, a component owns the closes its parts initiate and
  leaves dismissals to the browser. Cancelable: the invoker's `command` event (popovers and
  dialogs alike), a form's `submit` event, and the part's own `click` (cancelling it cancels
  the command). Not cancelable: a dialog's close request (`cancel` is honoured once per user
  activation) and the `close()` a `method="dialog"` form performs once its `submit` was
  allowed; that is why a dialog's **Escape** is never library-owned while its **Close part**
  is. Popover: Trigger toggle, `Close` and a controlled `open={false}` are awaited and hidden
  in the apply effect; Escape and light dismiss are facts. Dialog: `Close`, `Form` (a
  `method="dialog"` submit, or the settle after a function action), a foreign close command and
  a controlled `open={false}` are awaited and closed in the apply effect; Escape, Android back,
  AT dismiss and light dismiss are facts.

**A part's library-owned close is the single source of that close.** Whatever the press does on
the way to the `click` must not trip one of the component's immediate, browser-shaped closes
first. The three traps (the focus move of a `mousedown`, light dismiss, a non-button part that
must survive its own press) and the rule for each are in `design/overlay-open-state.md`, "The
light-dismiss traps".

### 3.6 `disabled`

`disabled` is a boolean prop on the owner and on individual triggers. Native `disabled` is used
where the APG pattern allows it; where the pattern wants a focusable disabled control (Tabs; a `Button` inside a Toolbar, whose APG example
keeps disabled commands focusable so screen-reader users still find them), the
part sets `aria-disabled` instead. In both cases the part emits `data-disabled` and never
dispatches for user interaction (platform dispatches from the form owner are the exception,
section 2.3 item 7).

**A part is never natively disabled while pending** (library-wide). The library does not set `disabled` or `inert` on a trigger because its
action is in flight: native `disabled` drops keyboard focus to `<body>` in Chromium and Firefox
and leaves it on a dead element in WebKit (`docs/research/button.md` 1.2), so the user's place is
lost either way. A **pure trigger** whose `whilePending` is `"ignore"` (by default or by prop,
section 2.5.1) renders
`aria-disabled="true"` while its own action is pending, the honest state of a control that will
not act (React Aria does the same): focus stays, every listener keeps working (a Tooltip still
opens), and a user who presses again or returns hears "unavailable" rather than nothing. A pure
trigger whose `whilePending` is `"run"` renders **no** `aria-disabled` because of pending: it
still acts on the next press, so "unavailable" would be false, and `data-pending` is its only
pending mark. The rule in one line: `aria-disabled` while pending if and only if the part is
ignoring; `data-pending` / `state.pending` always. A consumer who styles "pending and inert"
selects `[data-pending][aria-disabled="true"]`; no extra attribute or state field is added.
`data-disabled` and `state.disabled` stay the consumer's `disabled` only, so `[data-pending]` and
`[data-disabled]` never need to look alike. A state owner (Toggle, Tabs, …) sets nothing: the
latest-intent rule covers it. No `aria-busy` (its meaning is "my content is being modified",
NVDA and VoiceOver ignore it and JAWS may hide the element's content; pass-through for consumers
who want it) and no built-in announcement of pending (the outcome is the consumer's).
`focusableWhenDisabled` (`Button`) joins Tabs and the Toolbar as a source of `aria-disabled` for a
consumer-disabled control, as does a `render` element that cannot be natively disabled or whose
part handles the click itself (section 1.2). A natively disabled part that is also pending
renders no `aria-disabled`: native `disabled` wins (section 1.2).

**Computed native validity attributes.** A part may render a native constraint attribute from
library state when the platform has no constraint for the component's semantic: CheckboxGroup
renders `required` on every Item only while the group's **optimistic** set is empty ("at least
one"), so validation, `:user-invalid` and the localised browser message stay native. Such an
attribute is owned by the part, follows optimistic state (it appears during a pending uncheck of
the last box and leaves on rollback), and is static before hydration (the server-rendered value),
which the component doc records as its pre-hydration behaviour. The **custom-validity slot**
(`setCustomValidity`) of a control inside a `Field.Root` is **owned by the Field**: it
holds the Field's `validate` result or the server error for the field, recomputed on the
control's next `input`; a control never calls `setCustomValidity` itself, and attribute-based
constraints such as CheckboxGroup's `required` are unaffected. A control whose **user surface**
and **validity element** differ (NumberField: the visible text input and the hidden number
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

Moved to `design/internal-hooks.md`, same number, with its numbered rules ("3.8 rule 1" to
"rule 9"). In one line: the residual browser paths of 3.5 (mount reconciliation, form reset)
dispatch once per state owner with `reason: "platform"`, through shared hooks, and a form
control joins a Field through `useFieldControl`.

### 3.9 Overlay open state: requests and facts

Moved to `design/overlay-open-state.md`, same numbers (3.9.1 to 3.9.13). In one line: an
overlay Root's `open` has two channels, requests through `openChangeAction` (a transition,
awaited, can be refused) and facts through `onOpenChange` (a dismissal the browser performed:
adopted urgently, never pending, superseding every request in flight).

---

## 4. Pending and state exposure

### 4.1 One vocabulary, three forms

A state has one name. It appears as `data-<name>` on the element, as `state.<name>` in the
function props and `render`, and under that name in docs. No `is` prefix (`pressed`, not
`isPressed`), matching the prop names.

| Name | Kind | Where | Meaning |
| --- | --- | --- | --- |
| `pending` | boolean | owner + initiating trigger; Toast `Root` and `Action`; `Slider.Thumb` (the thumb the latest step or commit moved); `ToggleGroup.Root` and each `ToggleGroup.Item` whose optimistic pressed state differs from its committed one; `Button` (its own `action`, or a submission it started through its own function `formAction`); `NumberField.Root`, `NumberField.Input` and the `Increment` / `Decrement` button the latest step or commit came from; `Field.Root` and every Field part, `Form.Root`, `Form.Submit` (the enclosing form's submission, `useFormStatus`: the form channel, section 2.7) | An action dispatched through this component is in flight (including the Suspense wait of the resulting render). For a toast: the promise given to `toast.promise` is unsettled, or an action dispatched through its `Action` part runs; not set while the toast's content is merely suspended. |
| `disabled` | boolean | any | Disabled by prop or inherited from the owner; also a NumberField `Increment` / `Decrement` button whose next step would change nothing (at its bound, `readOnly`). Emitted in **every mode** in which the part renders `disabled` or `aria-disabled` (the JS-free Dialog and Popover Triggers included), so the styling hook and the ARIA state never disagree. |
| `pressed` | boolean | Toggle, `ToggleGroup.Item` | Optimistic pressed state. |
| `selected` | boolean | Tab, Item, `Select.Option` (optimistic; identical to the platform's `:checked` on the option, since the `<select>` renders `value={optimistic}`), `Combobox.Option` (optimistic `aria-selected`; distinct from `active`), `Combobox.Input` (a non-null optimistic value) | Optimistic selection on triggers; committed on panels. |
| `active` | boolean | `Combobox.Option` | Virtual focus: `aria-activedescendant` points here. Urgent (section 3.2), never a transition. |
| `stale` | boolean | `Combobox.Popup`, `Combobox.List` (with `aria-busy="true"` on the listbox while stale **or loading**: a `Status` mounted inside the List; loading itself is not a data attribute in v1) | The results shown are for an older text (`inputValue !== useDeferredValue(inputValue)`); the previous results stay visible meanwhile. |
| `empty` | boolean | `Combobox.List`; `Toast.Viewport` | List: no mounted options, not stale and not loading; the same condition under which `Empty` renders. Viewport: no toasts in the queue, the `ending` ones kept mounted included (the region is hidden under it; Toast decision 7), so a layout can collapse the region's reserved space. |
| `open` | boolean | Popup, Trigger, Accordion `Item` and `Trigger` (the Accordion `Panel` emits only `data-disabled`; its visibility is the native `<details open>` / `:open`); Dialog `Trigger` (optimistic, library mode) while the `<dialog>` itself emits no `data-open` (only `data-modal`, below) because `:open` / `:modal` are exact and written by the same commit; Popover `Trigger` (optimistic `data-open` in library mode; in JS-free mode `data-open` kept current by a DOM write from the popup's `toggle` listener, section 7.4; a `<button>` Trigger is a `popovertarget` invoker and renders **no `aria-expanded`**, only a non-button `render` renders it, from the Root's urgent `shown` mirror, section 3.2) while its Popup emits none (`:popover-open`); Menu `Trigger` and `SubmenuTrigger` likewise (optimistic `data-open`, no `aria-expanded` on the invoker), Menu `ContextTrigger` (optimistic `data-open`, no ARIA); Combobox `Trigger` likewise and Combobox `Input` (optimistic `data-open`, plus `aria-expanded` from `shown`: it is a `role="combobox"` input, not an invoker), its Popup none | Disclosure and open state, following the platform's word (`<details open>`, `:open`, `ToggleEvent.newState`); `expanded` is not used. Emitted for library-owned open state; purely browser-owned open state (Tooltip in the top layer) is styled with `:popover-open` / `:open` and emits no attribute (section 7.4); `Select.Root` emits none at all, because a native select's picker has no open event and is styled with `:open` only. |
| `checked` | boolean | Checkbox, Switch, `RadioGroup.Item` (radio items use `checked`, the platform word, not `selected`), sibling `Indicator` parts; `Menu.CheckboxItem` and `Menu.RadioItem` (optimistic, as `aria-checked` and `data-checked` on a `button`) | Optimistic checked state. On the input itself the DOM holds the optimistic value (section 3.2), so `:checked` matches it, with the caveats in section 4.2 (`preventDefault()` misuse; Chromium's checked+indeterminate quirk). |
| `indeterminate` | boolean | Checkbox (controlled-only prop, "consumer-owned, mirrored" in section 3.5's terms; never Switch); Progress, every part (`value` is `null`: derived, not a DOM property, never suspended) | Mixed state. Emitted from render as `data-indeterminate` because the DOM property cannot be server-rendered and `aria-checked` is forbidden on native inputs: the attribute is what lets CSS draw the dash before hydration. The property is set through the ref and re-applied after every commit; it is **suspended while an action is pending** (`state.indeterminate = indeterminate && !pending`) so the attribute, the DOM property and `:indeterminate` agree in every phase, since the browser clears it on the click and the parent may not have recomputed yet. `CheckboxGroup.Parent` also emits it, but there the value is **library-derived** from the group's optimistic set (`some && !all` over the Parent's `values`) in the same sync render that follows a click, so it is **not** suspended while pending; the suspension rule is specific to the consumer-owned prop. |
| `modal` | boolean | `Dialog.Popup` | The Root's `modal` prop (default `true`): the dialog is opened with `showModal()` (library mode) or the invoker's `show-modal` command (JS-free). A prop echo, not a state: rendered in every mode, server HTML included, so a stylesheet can lay out a non-modal panel (`.dialog:not([data-modal])`) before hydration and while closed, where `:modal` is false either way. |
| `index` | number (stringified) | `Slider.Thumb` | The thumb's `index` prop (default `0`): which entry of the value array this thumb edits. The one attribute whose value is a consumer-chosen number, so a stylesheet can address a thumb by position (`[data-index="1"]`); `state.index` is the same number. |
| `orientation` | `"horizontal" \| "vertical"` | Root, List, Tab; every Slider part; `ToggleGroup.Root` and `Item` (the enclosing Toolbar's when inside one); `Toolbar.Root` and `Toolbar.Separator` (the separator's own, perpendicular to the toolbar's) | Enum attribute with value. |
| `invalid` | boolean | every Field part | An error is shown for the field: the control matches `:user-invalid`, or a server error for it is shown (Field 2.2). The control also carries an explicit `aria-invalid="true" \| "false"`. |
| `required` | boolean | every Field part | `Field.Root required` or the control's own `required` (reported through its registration). |
| `dragging` | boolean | Slider `Root` and the captured `Thumb` | A pointer is captured on a thumb (urgent state; keyboard never sets it). Style motion off under it (`[data-dragging] { transition: none }`). |
| `ending` | boolean | Toast `Root` | Closed, kept mounted (and `inert`) until the animations the ending state started finish (`exitAnimations` filtered by a baseline of the animations already running before the close, Toast 10.2; a paused progress bar does not hold the exit); CSS animates on it. |
| `paused` | boolean | Toast `Viewport` | A viewport-wide timer pause holds (pointer over the region, focus inside, hidden document, blurred window), so a visual progress indicator can pause with the real timer. |
| `type` | string | Toast `Root` | The toast's consumer-defined `type` (`"error"`, `"success"`, …), an enum whose vocabulary is the consumer's. |
| `complete` | boolean | Progress, every part | The clamped value reached `max`. |
| `context` | boolean | `Menu.Popup` | The current open came from a `Menu.ContextTrigger` and the popup is placed at a point: `--menu-point-x` / `--menu-point-y` are set inline and `data-side` / `data-align` are absent. Written urgently with the placement (geometry, not a dispatch): present from the point open's request until the popup is hidden and its exit is over (`design/components/context-menu.md` 3.1). |
| `region` | `"optimum" \| "suboptimum" \| "even-less-good"` | Meter, every part | HTML's meter region for the value against `low` / `high` / `optimum`, the platform's words. |
| `side` | `"top" \| "bottom" \| "left" \| "right"` while shown; the requested `side` (which may be `"inline-start"` / `"inline-end"`) otherwise | Tooltip, Popover and Menu `Popup`; Tooltip `Arrow` | **The resolved side** (section 13): while the popup is shown, the side of the anchor the browser actually placed it on, read from the computed `position-area` after `position-try-fallbacks` chose an option, so it changes after a flip (on open, on scroll, on resize); on the server, while closed, and when the computed value cannot be read (a vertical writing mode, a consumer `position-area` the parser does not know), the value of the `side` prop. Absent with `side={null}` and on a point-placed menu (`context`). Written urgently (geometry, observed; conventions 3.5). |
| `align` | `"start" \| "center" \| "end"` | same parts | The resolved alignment along that side, same rules. `start` / `end` are **inline-relative** on a top / bottom side (`start`: the popup's inline-start edge meets the anchor's; mirrored under `direction: rtl`) and block-relative on a left / right / inline side (`start`: top edges meet). |
| `instant` | boolean | `Tooltip.Popup` | The tooltip is shown by an open that began while another `[role="tooltip"]:popover-open` existed in the document (the skip-delay condition, `design/components/tooltip.md` 6), so a stylesheet can skip the entry animation of a warm open and keep a cold one's. **Attribute only, no `state.instant`**: browser-owned, like the open state it qualifies (no `state.open` exists), written by a DOM write from the popup's synchronous `beforetoggle` on both paths, before the open's first style recalc, and removed at the close's (section 7.4). Never server-rendered. |

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
- **A fact never produces `data-pending`**: an overlay's dismissal is adopted urgently and
  reported to `onOpenChange`, which is not awaited. The Trigger shows `data-pending` after a
  dismissal only while a request the fact superseded is still running (it reports that request,
  3.9.5).

The state object given to function props on the owner includes `pending`; on triggers it includes
`pending` with the trigger-local meaning above.

---

## 5. ViewTransition integration

### 5.1 Default wiring

Every part whose mount, unmount or content is driven by library state (Panel, library-driven
Popup, Toggle's own element when its children can change) renders
`<ViewTransition default={transition}>` as the **outermost node of its output**, before any DOM
element, **only when `transition !== undefined`**. With the prop absent the part renders no
boundary at all (`internal/transition-boundary.tsx`).

Why: react-dom starts a document view transition whenever a `<ViewTransition>` **mounts** in a
transition-lane commit or is **revealed by `<Activity>`**, whatever `default`, `enter` or a type
map resolves to; the browser then plays its root cross-fade and React holds every later
transition-lane commit until it finishes (265 to 280 ms per tab switch or dialog open).
Exits and updates of a `"none"` boundary are free, and a boundary that mounts under a *new* DOM
element is shielded. So the only free "no animation" is no boundary
(`docs/research/view-transition-mount-cost.md` has the source reading and the measurements).

```tsx
// inside Tabs.Panel (mount strategy per `keepMounted`, section 3.7: not rendered, <Activity>,
// or hidden="until-found"; when present, the boundary is the outermost node in every strategy)
const panel = <div role="tabpanel" ...>{children}</div>;
return transition === undefined ? panel : <ViewTransition default={transition}>{panel}</ViewTransition>;
```

Rules:

- `transition` is **static**: toggling it between `undefined` and a value changes the element
  type at the root of the part, so React remounts the part's subtree (DOM and state lost).
  Development warns once when that happens.
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

**Parts without a `transition` prop.** "Every animatable part has `transition`" means every part
whose mount, unmount or **committed** library state changes what it shows. Four kinds of part
have none and animate in CSS instead:

1. **Browser-owned visibility** (3.5: Tooltip's `Popup`, the Accordion's `<details>` in static
   mode, which ignores the prop with a dev warning): the open/close happens outside any React
   transition; `@starting-style` and `transition-behavior: allow-discrete`.
2. **Only an optimistic flip that never animates**: Menu's items (their `aria-checked` lands in
   a sync render and the settle shows nothing); every Select part (the picker is a UA
   pseudo-element, `<selectedcontent>` is written by the browser, every library attribute is
   optimistic); every Slider and NumberField part (the value is urgent or optimistic; a
   Slider's rollback animates with a CSS transition on a registered custom property).
3. **Every commit on the urgent lane by design** (Toast, 2.6; Field and Form, whose state is an
   urgent mirror of browser-owned validity and whose own commits display nothing): react-dom
   never starts a view transition for an urgent commit, so a boundary could animate nothing and
   would still pay the page cross-fade when the part mounted inside another component's
   transition commit. CSS: `@starting-style`, `data-ending`; `Field.Error` enters with
   `@starting-style`.
4. **A consumer-owned value with no library state or dispatch** (Progress, Meter): its changes
   arrive in the consumer's lane (usually urgent, 2.6) and animate through a CSS transition on
   a registered custom property.

Toggle keeps the prop although its own flip cannot use it (product-owner decision): its
element's content can change with the settled action, and it animates the end of the action
and content keyed on `pending`. A part without the prop renders no boundary, so the prop costs
nothing for consumers who do not set it.

**Top-layer parts: the boundary wraps the top-layer element itself, never only its children**
(the `vt-popover` probe in `docs/research/popover-menu.md`). A boundary inside a `[popover]` or
`<dialog>` has no box while the element is `display: none`, so it gets no enter; wrapping the
element captures the popup's own box on a library-driven open and close, in all three engines
(`Dialog.Popup` wraps the `<dialog>`, `Popover.Popup` and `Menu.Popup` the `[popover]`
element). The rule matters only for opens and closes the library performs in a layout effect of
a transition commit. A dismissal (Escape, light dismiss) is a fact whose commit is **urgent**:
it starts no view transition, with or without `transition`, carries no `fsui-<component>-close`
type (3.9.8) and animates with CSS.

**The CSS transition cut.** A CSS transition on a popup next to `transition` needs no consumer
rule. When a Popup (Dialog, Popover, Menu, Combobox) has `transition` and
`html:active-view-transition` matches at the moment of the library's **own** `showPopover()` /
`hidePopover()` / `showModal()` / `show()` / `close()`, the library runs that call with the
popup's CSS transitions cut (`withCssTransitionCut` in `internal/overlay/css-transition-cut.ts`, whose
comment holds the steps), so only the view transition animates the show or hide. Without the
cut Chromium paints a double image on close and every engine runs the `@starting-style` enter
under the view transition's enter. What a consumer can rely on:

- **Dismissals (facts, 3.9) never go through it**: their CSS exit is the only thing that
  animates them, and an unrelated page view transition does not cut that fade.
- It is gated on the active view transition, not on the prop alone: a library close React
  batched into a non-transition commit keeps its CSS exit as the fallback.
- Every write goes through CSSOM, never the `style` attribute, so a CSP without
  `'unsafe-inline'` for styles does not block it; a `transition` a listener wrote during the
  call is kept.
- Only CSS transitions are cut: a `@keyframes` exit still runs during a library close and
  double-images in Chromium. The `::backdrop` is not cut (its enter fade runs on open).
- Trade-offs: an inline style on the consumer's element for the length of one synchronous call
  (a `MutationObserver` on `style` sees it; a functional write, not shipped CSS, section 12);
  one forced style recalculation per such call; no opt-out (a CSS transition and a view
  transition cannot run together on one popup's library show / hide).
- A nested popup that is **not** a DOM descendant of its parent keeps fading in Chromium when
  the parent's library close takes it down. No library composition produces that layout; a
  consumer rule `html:active-view-transition .popup { transition: none }` covers whoever
  builds one.

**The optimistic commit does not animate.** Library state changes are transitions, so the
commit that ends the action and any rollback animate through the boundary with no extra code.
The optimistic flip is a sync-lane render, and react-dom starts a view transition only when
every committed lane is a transition, retry or idle lane (`design/components/toggle.md` 7.2).
Per kind of part:

| Part renders | Animate with | Why |
| --- | --- | --- |
| Optimistic state (Toggle's element, `Tabs.Tab`, `Accordion.Trigger`, `Tabs.Indicator`) | CSS `transition` on the data attribute or on the anchored insets (`[data-pressed]`, `[data-selected]`, `position-anchor` following the optimistic tab) | The flip lands in a sync-lane commit; `<ViewTransition>` never fires for it, on click or on rollback. |
| Committed state (`Tabs.Panel`, `Accordion.Panel`, `Popup` content driven by library state) | `transition` prop | The swap lands in the transition-lane commit that settles the action. Mount-prone parts (a Panel with `keepMounted={false}` or `true`) pay the page cross-fade on every mount or reveal once `transition` is set; with `"until-found"` only updates happen. A boundary that mounts *under a new DOM element* is shielded: Dialog's children mount under the `<dialog>` element on a plain open, so a plain open starts no view transition even with `transition` set; only a nested Popup mounting together with outer content, or a Root inserted by a transition, pays. |
| `pending` leaving, a controlled snap-back, content the parent changes in the same transition | `transition` prop | Same commit as above (snap-backs carry no `fsui-*` types, section 5.3). |
| Any part with `transition` absent | nothing (no boundary rendered) | Baseline timing; a switch or open calls no `startViewTransition`. |

`Tabs.Indicator` therefore follows optimistic selection, renders no `<ViewTransition>` and has no
`transition` prop: it is positioned by CSS Anchor Positioning on the optimistic tab and slides via
a plain CSS `transition` on the anchored insets (moves on click, snaps back on rejection). Any
part that keys a `<ViewTransition>` on optimistic state is a bug, not a style choice.

**Deferred renders animate too.** An update from `useDeferredValue` activates a boundary like a
transition does (React rule). A part whose content re-renders from a deferred value inside an
open boundary (Combobox's results inside `Combobox.Popup`) would run a document view transition
per result change, so its docs recommend the type-map form with `default: "none"` and name the
cost of a class on `default`.

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
| Combobox | `fsui-combobox`, `fsui-combobox-open`, `fsui-combobox-close` (Root open state); `fsui-combobox-select` (every value dispatch; with `multiple` only when `details.added` is non-empty) and, with `multiple`, `fsui-combobox-deselect` (when `details.removed` is non-empty) |
| Toast | none (no `transition` prop; every commit is urgent, section 5.1) |
| Field, Form | none (no `transition` prop: an urgent validity mirror and a form whose own commits display nothing, section 5.1) |
| Slider | `fsui-slider`, `fsui-slider-change` (each step), `fsui-slider-commit` (each gesture's commit); no `transition` prop on any part, the types serve consumers' own boundaries |
| ToggleGroup | `fsui-toggle-group`, `fsui-toggle-group-press` (when `details.added` is non-empty), `fsui-toggle-group-release` (when `details.removed` is non-empty; an exclusive switch carries both) |
| Toolbar | none |
| Button | none (`useActionTrigger`; `transition` animates the commit that ends the action) |
| Progress, Meter | none (no `transition` prop: a consumer-owned value in the consumer's lane, section 5.1) |
| NumberField | `fsui-number-field`, `fsui-number-field-change` (each step), `fsui-number-field-commit` (each gesture's commit); no `transition` prop on any part |

Hyphens only: types are also exposed as `:active-view-transition-type(fsui-tabs-next)` and a
colon would need escaping there. Consumers' own `addTransitionType` calls in the action's sync
prefix are collected into the same transition.

Types are attached only to the commit that ends a dispatched action; an overlay's dismissal is a
fact, not a dispatch, and carries none. A controlled snap-back (the
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
- **The one library-owned boundary: Toast's guard**. `Toast.Root` wraps its children in a
  `<Suspense>` whose fallback renders nothing visible. The reason is specific and not to be
  generalised: a toast is mounted in an **urgent** commit from outside the consumer's tree, so a
  suspending toast would reveal the fallback of the nearest boundary *above the Viewport* (the
  app shell in the common layout) instead of keeping old content as a transition would. The
  guard gates the toast's timer and announcement. **`fallback` exists only where the library
  owns the boundary, which is Toast alone** (`Toast.Root fallback`):
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
and `useDebugValue`, plus `cache` and `cacheSignal` (React 19.3.1 `react.react-server.js`: the list is React's own, so a module whose only hook is `useMemo`, such as
`use-render.tsx`, may drop its directive); `createContext`, `useState`, `useRef`, effects,
`startTransition`, DOM access, event props) and nowhere
else. Files without the directive must not import from files with it, with two exceptions:
`index.ts` files, which only re-export, and the React 19.3 pattern of a directive-free file
*rendering* a context provider imported from a client module (`<TabsContext value={...}>`), which
is allowed because Server Components may render client-created contexts. No initial component
needed the second exception; `Progress.Root` and `Meter.Root` are its first users: a
directive-free Root renders `<ProgressContext value>` imported from its `"use client"` context
module and imports no other client module (the Server render row in 10.1 guards the import graph);
a component that does this says so in its design doc. Pure modules are
directive-free: arithmetic and formatting (`slider/slider-arithmetic.ts`; NumberField's
`number-field-format.ts`, `number-field-arithmetic.ts` and `internal/decimal.ts`), pure
DOM reads, prop builders and listener installers (`internal/overlay/popover-open.ts`, `dom-order.ts`,
`arrow-keys.ts`, `render-element.ts`, `value-set.ts`, `shipped-styles.ts`; `menu/menu-dom.ts`,
`menu-hover.ts`, `menu-gestures.ts`, `menu-outside.ts`, `menu-point.ts`) and the Toast
Viewport's queue, hotkey and timer models (`toast/toast-queue.ts`, `toast-hotkey.ts`,
`toast-timers.ts`); `directives.test.ts` lists them. A context shared
by **several component folders** lives in `internal/` (`internal/form/field-context.ts`, read by the
Field parts, `Form.Root` and `useFieldControl` from every form control's folder; `internal/toolbar-context.ts`, read by
`ToggleGroup.Root`, `Toolbar.Separator` and `Menu.Trigger` to find an enclosing Toolbar); the one-way
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

The configuration is `packages/ui/tsdown.config.ts`: `entry` lists the root `src/index.ts`,
every component's `src/<component>/index.ts`, `src/csp/index.ts` and the skill-installer bin
(`src/bin/skill-installer.ts`); `format` is ESM only; `unbundle` and `dts` are on; and
`exports` generates the package's exports map from the entry list (9.2), with the bin excluded
from the map and declared as the package's `bin`.

**Development text never reaches a consumer's production bundle.** The build is unbundled, so
`dist` legitimately keeps every warning string; it is the consumer's bundler that folds them
away, and it can only do so when the text sits behind a `NODE_ENV` test it can evaluate. Every
module that warns declares its own `const isDev = process.env.NODE_ENV !== "production"` and
passes each message as `isDev && "..."` (or `isDev && ((element) => ...)`) to `useDevWarning`,
`useMountFixed`, `useElementCheck`, `useNameWarning` and `useShownNameWarning`, which accept
`false`; a direct
`console.error` sits inside `if (isDev)`. The hooks themselves are exported as `isDev ? hook :
noop`, so a production render runs no warning hook at all. A dev check fires **once per
instance** (`useDevWarning`: the first time its condition holds; the element and name checks:
the first failing check). `src/__tests__/production-bundle.test.ts` bundles `src/index.ts` as a
consumer would (`NODE_ENV` `"production"`, minified) and fails on any string from those call
sites that survives, naming the file and the text; it also reads the declarations those call sites
name in the same file (module-level functions and constants, and functions declared inside a
component), so a message-building helper is passed as `isDev ? helper : undefined`. A helper
imported from another module is not followed; keep message helpers in the file that warns. A message starts with the public name of
the part that warns and a colon (`Tooltip.Trigger: the trigger is not focusable; ...`), or the
name of the function that warns (`toast(): ...`, `toast.update: ...`).

### 7.3 JS-free primitives

"JS-free" is a statement about **behaviour**, not about module boundaries: no JavaScript runs for
the interaction, and the markup is complete and functional before and without hydration. It
never means "no client bundle", and the docs must not promise that either. Whether a part's
source file carries `"use client"` is a separate, per-component fact recorded in the
component's design doc; the Directive test row (10.1) asserts whatever that doc says.

The two are separate because of a Flight constraint: a Server Component cannot read context,
and the parts of a compound component need context to find their Root. So every part of
Accordion is a client module even though the uncontrolled accordion toggles with no behaviour
JS:

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

The consumer gets `<details>` / `<summary>` markup in the HTML, native open/close, find-in-page
reveal and exclusive groups via `name` with no hydration required; the part code is in the
client bundle and hydrates to add the action props, controlled mode and animation.

**There is no second, directive-free anatomy** (option A of `docs/research/zero-js-variants.md`
5; that note holds the bundle measurements, which are binding). Per component:

- **Form controls** (Switch, Checkbox, RadioGroup, Slider, NumberField, Select): the JS-free
  form control from a Server Component is the **native element** (`<input type="checkbox"
  role="switch">`, same-`name` radios in a `<fieldset>`, `<input type="range">`,
  `<input type="number">`, a real `<select>`), shown as a **recipe on each component's docs
  page**, not a part: a directive-free part would add nothing over the element and would lose
  Field integration, the action and the optimistic attributes.
- **Tooltip**: not viable natively (`interestfor` exists only in Chromium, so a directive-free
  Tooltip would show nothing in two of three engines). Every part is a client module; "zero-JS"
  in `design/components/tooltip.md` 2.4 and 14 means the native path runs no behaviour JS.
- **Popover**: viable in principle (the Trigger is a `popoverTarget` invoker with no
  `aria-expanded` to keep current, `docs/research/invoker-aria-expanded.md`), but the parts
  stay client modules for Accordion's reasons (context for ids and the mode; nested focus
  return and `initialFocus` after hydration). Not scheduled.
- **Accordion**: the one real candidate. **Option B, `@funstack/ui/accordion/native`** (Root
  `div`, Item `details` with a required `name`, Trigger `summary`, Panel `div`; usable from
  Server and Client Components, function props allowed) is a **ready plan, not scheduled**;
  revisit if an RSC host learns to skip the runtime for pages with no client references, or if
  users ask.
- **Progress / Meter**: the Root is already directive-free (below); a variant is not worth a
  second surface.

Library-wide, from the same research:

- A `React.cache()`-scoped mutable "server context" is unsafe (an async child resumes after a
  sibling Root overwrote the value) and is rejected as a way for a Root to pass data to its
  parts.
- Passing an action prop to a part from a Server Component is a type error unless the action is
  a Server Function (2.2).
- **Host requirement for server `useId`.** A server `useId` restarts for each Flight render, so
  a host that renders more than one Flight payload into one document must give each payload its
  own `identifierPrefix`, or ids collide across payloads and `aria-labelledby` breaks (client
  `useId` is unaffected). `@funstack/static` does from 1.3.4 (required for a server-rendered
  Progress / Meter Root inside `defer()`); any other RSC host with multi-payload pages has the
  same requirement and the library cannot detect it. The library adds no id override for this
  (`id` stays an owned key of `Progress.Label` / `Meter.Label`; nothing in the library parses
  ids), and the one-line host note lives on the Server Components docs page, not on each
  component.

**A Root that is itself a Server Component** (Progress, Meter): `Progress.Root` / `Meter.Root`
are directive-free (only `useId`, arithmetic and `Intl`), render the client-created context
provider (7.1), and their parts are client modules that read it. "JS-free" and "a Server
Component" coincide at the Root, so function props (`getAriaValueText`, `children(state)`,
`render`) may be passed from a Server Component and run on the server.

**A component whose baseline cannot be JS-free** (Menu: arrow keys, typeahead and focus
management) runs in library mode always, with no mode switch, and still renders the declarative
invoker on its Trigger (`popovertarget`) for the implicit anchor, the platform's implicit
expanded state (no `aria-expanded` rendered) and a pre-hydration open that mount reconciliation
fills. That open shows an empty popup until hydration, as Dialog's and Popover's library mode
do; it is progressive enhancement, not a supported JS-free mode, and the component doc says so.
Combobox is the second such component: its Trigger server-renders no invoker attribute (the
popup must be anchored to the input; `popovertarget` is written after hydration, 7.4), and its
progressive enhancement is that the text input works before hydration and the typed text is
adopted at mount (3.5).

---

### 7.4 Attributes and events React cannot express

The platform moves faster than react-dom and `@types/react`. Conventions for the gap, with the
cases known on 2026-10-15 (`docs/research/modern-platform-survey.md`, "React 19.3 integration
notes"):

| Gap | Convention |
| --- | --- |
| Attribute unknown to react-dom (`command`, `commandfor`, `interestfor`, `focusgroup`, `closedby`, `switch`, `name` on `<details>`) | Write it **lowercase** in JSX; react-dom passes unknown lowercase attributes through verbatim on client and server. Never camelCase (`interestFor` renders the wrong attribute and warns). `popovertarget` / `popovertargetaction` are **not** in this row: react-dom 19.3 knows them as `popoverTarget` / `popoverTargetAction` (the lowercase spelling warns "Invalid DOM property"), serialises them camelCase in server HTML (HTML parses attribute names case-insensitively) and lowercases them through `setAttribute` on the client; write the camelCase prop. |
| Attribute or element untyped in `@types/react` (`command`, `commandfor`, `interestfor`, `focusgroup`, `switch`; the `selectedcontent` element) | One module augmentation module, `src/internal/platform-attributes.ts` (`declare module "react" { ... }` plus `export {}` so it is a module), augmenting `React.HTMLAttributes` / `ButtonHTMLAttributes` / `AnchorHTMLAttributes` with the typed values from the research docs, and `JSX.IntrinsicElements` with `selectedcontent`. It is imported **for side effects** (`import "./internal/platform-attributes.js"`) from the package entry and from every subpath `index.ts`, so each public entry carries it. tsdown emits `dist/internal/platform-attributes.d.mts` and an `import` of it in each entry's `.d.mts`, with no runtime import in the JS. A `.d.ts` source would not work: it is typecheck-only and never reaches `dist`. Each entry carries a comment with the DefinitelyTyped issue so it can be deleted when upstream lands. `popoverTarget` / `popoverTargetAction` are typed upstream, so the overlay Triggers are not in this row; `command` / `commandfor` are in it for `Popover.Close`, the Dialog parts and consumers' `Button`s. |
| Attribute react-dom serialises wrongly (`hidden="until-found"` becomes `hidden=""` on both client and server) | Render the boolean form so SSR output is correct, then upgrade in a layout effect through the part's ref (`el.setAttribute("hidden", "until-found")`), and listen to the platform event that the browser uses to undo it (`beforematch`) to dispatch the matching change action. Encapsulate each such case in one internal hook (`use-until-found.ts`) so the workaround has exactly one home. |
| Attribute that must act on the client but must not be in the server HTML (Combobox Trigger's `popovertarget`: the invoker relationship exempts its press from light dismiss, but a pre-hydration activation would open an empty, button-anchored popup) | Not rendered; written with `setAttribute` from the part's ref callback once the element is known to be a `<button>` (removed in the cleanup), so hydration never sees it and the click handler that cancels the activation is installed before the attribute exists. The key is still owned (omitted from the props type). Named in the component design (section 3.5 lists the parts that use it). |
| Event React does not synthesize (`command`, `interest`, `loseinterest`, `beforematch`, `scrollsnapchange`) | `addEventListener` through the part's ref (or a Fragment ref for sibling groups), inside an effect that uses `useEffectEvent` for the handler body, dispatching into the component's transition like any other interaction. Never expose these as `on*` props (section 2.6: `on*` is reserved for the urgent lane, and these are interactions, not an urgent state). |
| Event React does synthesize, but the handler must be feature-detected away (Tooltip's `pointerenter` / `focus` when `interestfor` is native) | Same `addEventListener`-in-effect pattern: the effect subscribes only when the JS path is needed, so markup is identical on server and client. Because no prop-form handler is installed, none is omitted from the part's type and the consumer's `on*` props pass through (section 1.5). |
| Element whose children the **parser writes before hydration** (`<selectedcontent>`: Chromium and Safari clone the selected option's children into it at parse time, so a plain element fails hydration and client-renders the whole root) | Render it with `suppressHydrationWarning` and `dangerouslySetInnerHTML={{ __html: "" }}`, so React treats the children as opaque and the attribute mismatch is silenced (verified in `docs/research/select-combobox.md` §4: hydrates with no recoverable error, later browser writes keep working); the part has no `children` prop. One such element per component at most, named in its design doc (`Select.Value`). |
| Pseudo-class the platform already provides (`:open`, `:popover-open`, `:disabled`) | Document it next to the equivalent data attribute; do not emit a duplicate attribute when the pseudo-class carries the same meaning and the state is browser-owned. |
| Styling state for a browser-owned open that a static part cannot render (`data-open` on a Popover Trigger in JS-free mode, where no React state exists) | Keep it current with a DOM write from the platform event through the ref (`toggle`, reading `:popover-open`), never React state. The attribute is owned and React renders no value for it in that mode, so the DOM write is never overwritten. A page that never hydrates has `:has(+ :popover-open)` instead, shown on the docs page. One attribute per component at most, named in its design doc. |
| Styling state for a browser-owned open that CSS must see **at the open's first style recalc** and no pseudo-class carries (Tooltip's `data-instant`, a warm open) | A DOM write from the platform's **synchronous** `beforetoggle` through the ref (`syncPresence`), on every path that can open the element (the native `interestfor` path included, as the interaction hook's only listener there; the placement observer's `toggle`, section 13.2, is separate), never from `toggle` (a task later: the entry transition has started and the write cancels it mid-flight, `design/components/tooltip.md` 6) and never React state (a render cannot be placed before that recalc short of `flushSync` inside the show algorithm). Classified from the DOM at that moment (`beforetoggle` precedes the `auto` / `hint` stacking that hides other popovers), cleared at the close's `beforetoggle`, never rendered by the part (so never in server markup), no `state.<name>` counterpart. One attribute per component at most, named in its design doc. |
| Roving `tabindex` over children the library did not render (`Toolbar.Root`; a standalone `ToggleGroup.Root`) | The container's engine (`internal/use-roving-focus.ts`) finds the focusable descendants in the DOM and writes `tabindex` (`0` on the current stop, `-1` elsewhere) from a layout effect after each of its commits, a `MutationObserver` on its subtree and its `focusin` / `pointerdown` handlers. Items render no `tabindex` (library item parts omit the prop from their types; a consumer's `tabIndex` on a toolbar item is unsupported), an element whose own `tabindex="-1"` the engine did not write is not an item, the engine records each element's original `tabindex` and restores it when it lets go (the native path after hydration, an element that left the container), and on the native `focusgroup` path nothing is written. Server HTML carries no `tabindex`, so before hydration every item is a Tab stop; after the first layout effect, one. |

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
   | `focusgroup` | Gecko, WebKit | `Tabs.List experimental_focusgroup`, `Menu.Popup experimental_focusgroup` (renders `focusgroup="menu wrap\|nowrap"`; items render no `tabindex` on the native path; typeahead, activation, submenu keys and Tab stay JS), `Toolbar.Root experimental_focusgroup` (`focusgroup="toolbar inline\|block wrap\|nowrap"`; the engine writes no `tabindex` and handles no navigation key where native), standalone `ToggleGroup.Root experimental_focusgroup` (the `toolbar` token under an explicit `role="group"`, plus `nomemory` and `focusgroupstart` on the first pressed Item; a ToggleGroup **inside** a Toolbar renders no `focusgroup` whatever its prop says, with a dev warning, because a nested focusgroup splits the Toolbar's single Tab stop) | The List renders `focusgroup="tablist inline\|block wrap\|nowrap nomemory"` and the selected Tab `focusgroupstart`; where `focusGroup` is implemented the JS arrow-key handling steps aside and unselected Tabs render no `tabindex`. |
   | `interpolate-size` / `calc-size()` | Gecko, WebKit (TP) | `Accordion.Root experimental_interpolateSize` | Inherited property set on the root; `::details-content` height animates to `auto` natively. |
   | `<dialog closedby>` | WebKit (TP) | `Dialog.Popup experimental_closedBy` (the part that renders the attribute; camelCase like `experimental_interestFor`) | Native light dismiss instead of JS. |
   | Customizable `<select>` | Gecko (pref) | **none** (Select design) | The markup (`<button>` + `<selectedcontent>`, rich options, `<legend>` in `<optgroup>`) is parsed everywhere and degrades to the native select; the opt-in is the consumer's CSS (`appearance: base-select`), so no library flag exists. |
   | `<input type="checkbox" switch>` | Blink (proposed), Gecko | `Switch experimental_switch` (future; not added while WebKit-only) | Native switch rendering and semantics; `role="switch"` already gives the semantics everywhere. |

   Two flags with the same graduation path go on the same part as separate props, not one
   object, so each can be removed independently.

   Adopted without a flag because every stable engine has it: `Element.ariaNotify()` (Chrome
   141, Firefox 150, Safari 27; Combobox announcements; NumberField's step announcements,
   through `internal/announce.ts`, which speaks through `ariaNotify()` only, with no
   `role="status"` fallback region (the no-fallbacks policy); a component announcing through
   it renders no live region). Recorded as a future `experimental_`
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
  internal/                 # not exported; one line per file in design/internal-hooks.md
  __tests__/
    vitest.setup.ts
    helpers.tsx             # section 10
  toggle/
    index.ts
    toggle.tsx
    toggle.test.tsx
  button/
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
- `internal/` is flat except for three subfolders, layered flat ← `action/` ← `form/` and
  `overlay/`: a flat module imports from no subfolder, `action/` imports only flat modules, and
  `form/` and `overlay/` import `action/` and flat modules but not each other (a helper goes in a
  subfolder only if it is about that subject; `scripts/check-internal-layers.mjs` enforces the
  direction).

### 9.2 Exports

Both a root entry and per-component subpaths; the subpath is the documented form:

```tsx
import { Tabs } from "@funstack/ui/tabs";      // documented
import { Tabs, Toggle } from "@funstack/ui";   // also works
```

With an unbundled build both resolve to the same files, so there is no duplication. The exports
map is generated by tsdown from the entry list (section 7.2); adding a component means adding its
`index.ts` to `entry`. One subpath is not a component: `@funstack/ui/csp` (`CSPProvider`,
`STYLE_SHA256`; section 12).

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
- Shared: `Action`, `ActionDetails`, `ChangeAction`, `UrgentChangeHandler` (section 2.6),
  `ChangeReason`, `RenderProp<Props, State>`, `StateValue<T, State> = T | ((state: State) => T)`,
  `ViewTransitionClass` (the `transition` prop's type, section 5.2),
  `WhilePending` (`"run" | "ignore"`, the pure triggers' `whilePending` prop, section 2.5.1,
  one shared union, never a per-part one, so a later mode is added in one place).
- Props interfaces are `interface`s extending the element props (section 1.5); state objects are
  `interface`s with readonly members. A component whose parts **all share one state object**
  may export a single `<Component>State` (`FieldState`; `ProgressState` / `MeterState`, with
  `MeterRegion` exported) instead of one alias per part.
- A component whose value has two shapes may be **generic** with a default
  (`SliderRootProps<T extends SliderValue = number>`, inferred from `value` / `defaultValue`);
  the shape is fixed at mount (a switch warns in development, like a mode switch).
- Everything public is exported with `export type`; nothing from `internal/` is public.

---

## 10. Testing conventions

Moved to `design/testing.md`, same numbers (10.1 required coverage per component, 10.2 shared
helpers). In one line: every component test file has one row per area of the coverage table,
in jsdom unless only a browser can observe it.

---

## 11. Built-in strings

The library ships no CSS and, until Combobox, shipped no text. It now ships **one kind of
text**: strings assistive technology needs that a consumer could forget to supply (Combobox's
result-count announcement through `ariaNotify`). Rules:

- A built-in string exists only where its absence is an accessibility gap, never for visible
  UI (no "Loading…" labels, no placeholder text, no button captions).
- The default is **English**, written in the component's design doc and its props table, so a
  consumer can see what will be announced.
- It is **always overridable** through a prop that takes a **function** of the relevant state
  (`announce(count, state)`), never a plain string, so a localised message can depend on
  pluralisation and state; returning `null` announces nothing.
- The library ships **no locale mechanism** (no provider, no `lang` detection): localisation is
  the consumer passing the function, and the docs show the one-liner next to every example.
- Toast adds two: the announcement default (the `textContent` of `Toast.Title` and
  `Toast.Description`, a function of the toast, overridable through `announce(toast)` per toast
  or per Viewport, `null` for silence) and the region's accessible name `"Notifications (F8)"`
  (following `hotkey`). The name is **static**, so its override is the ordinary `aria-label`
  pass-through rather than a function prop: the function form exists for strings that depend on
  state, and a label with no state would only add a prop.
- Combobox with `multiple` adds one: the removal announcement (`"Japan removed"`, the removed
  chips' labels joined with `", "`), overridable through `announceRemoved(labels, state)`,
  `null` for silence (`design/components/combobox.md` 15.7).
- Field adds **no** string: `Field.Error`'s default text is the browser's own localised
  `validationMessage` (a platform string, not a library one), and the override is the function
  form of `children` (`({ validity, messages }) => …`), per `ValidityState` key.
- Progress and Meter add **no** string either: the default `aria-valuetext` is
  `Intl.NumberFormat`'s localised output (a platform string, like Field's `validationMessage`),
  there is no default text while indeterminate, and the override is `getAriaValueText(value,
  state)` (function of state), with `format` / `locale` as the serialisable path.
- NumberField adds two **static** strings, `"Increase"` and `"Decrease"` (the buttons'
  default `aria-label`s), overridden through the ordinary `aria-label` / `aria-labelledby`
  pass-through (Toast's region-name rule); the announced stepped value is the formatted text,
  not a library string, overridable through `announce(value, state)`; no `aria-roledescription`
  and no string for it.

---

## 12. Shipped functional CSS

Moved to `design/placement.md`, same number. In one line: the library ships no visual CSS; a part
may render a hoisted `<style>` of selector-less at-rules for placement and interaction timing,
and `@funstack/ui/csp` exports the hashes and the nonce provider for it.

---

## 13. Anchored placement

Moved to `design/placement.md`, same numbers (13.1 keyword policy, 13.2 resolved placement,
13.3 the Firefox parent-direction bug, 13.4 placement at a point, 13.5). In one line: top-layer
popups are placed by CSS Anchor Positioning with physical and `self-*` keywords only, and
`data-side` / `data-align` report the resolved placement while the popup is shown.

## Resolved questions (2026-10-15)

Moved to `design/CHANGELOG.md` (part "conventions.md: status, resolved questions, open questions"), numbers unchanged: "resolved question 44" in a design document or a source comment is entry 44 there. The rules they decided are stated in sections 1 to 13.

## Open questions

None. Questions are raised in GitHub issues; a decision is recorded in `design/CHANGELOG.md` when the rule it changes is edited.
