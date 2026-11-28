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

Each component has a design document in `design/components/`, except two that are designed in
another's: Toolbar in `toggle-group.md` and Meter in `progress.md`.

Inputs: `docs/vision.md`, `docs/research/react-async-apis.md`, `docs/research/popover-anchor-tooltip.md`,
`docs/research/modern-platform-survey.md`, `docs/research/form-controls.md` prior art (Base UI, React Aria Components, Radix,
Ark UI, Headless UI), and a handful of React 19.3.1 behaviour probes recorded in
`memo/architect/conventions-notes.md`.

## Decisions

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Composition | Compound parts under a namespace (`Tabs.Root`, `Tabs.Tab`); single-element components are plain (`Toggle`). Element polymorphism via a `render` prop (element or `(props, state) => node`), never `asChild` or `as`. `ref` is a normal prop. `className`, `style`, `children` accept a value or a function of the part's state. |
| 2 | Action props | `<state>ChangeAction` for state changes (`pressedChangeAction`, `valueChangeAction`), bare `action` for pure triggers. Signature `(next, details)`; sync or async; the library `await`s it inside the state owner's `useTransition`. Errors go to the nearest Error Boundary; an action that handled its own failure calls `details.reject()` instead, which has every effect of a rejection except the boundary (2.4.1). What a pure trigger does with an activation that arrives while its own action is pending is the prop `whilePending` (`"run"` | `"ignore"`); the default follows who owns the action: `"run"` for a user-owned trigger (`Button`), `"ignore"` for a part whose activation the library owns (a Close part); an ignoring part renders `aria-disabled="true"` while pending (2.5.1). **`fooAction` always means a handler the component runs in a transition**, and a **request**: a change the library can still roll back. A change the library cannot hold is reported to an `on*` handler instead (row 11): `on<State>Change` or `on<Event>`, never an action. A continuous control adds `<state>CommitAction` once per gesture (Slider). A component whose input is a command rather than an interaction (Toast) exports a function next to its namespace (`toast`), not an event prop. |
| 3 | State model | `x` / `defaultX` / `xChangeAction`. The state owner holds committed state, optimistic state (`useOptimistic`, reducer form) and the transition. **Trigger parts render optimistic state; content regions render committed state.** Uncontrolled state is committed after the action resolves; the latest dispatched action wins, and set-valued state without `exclusive` commits the changes whose actions resolved (3.3). "Transition by default" applies to library-owned state; browser-owned state (top layer, `<details open>`) is observed, not driven. An overlay's `open` has both: requests through `openChangeAction`, and facts (a dismissal) adopted urgently and reported to `onOpenChange`, which supersede every request in flight (3.4 `adoptFact`, 3.9). |
| 4 | Exposure | One vocabulary in three forms: `data-pending` / `state.pending` / docs. Every data attribute a part emits has a same-named member in that part's state (4.1). Booleans by attribute presence. Hover/focus/active come from CSS pseudo-classes, not attributes. |
| 5 | ViewTransition | An animatable part renders `<ViewTransition default={transition}>` as its outermost node **only when `transition` is given**; with the prop absent it renders no boundary, because react-dom starts a document view transition for any boundary that mounts or is revealed in a transition commit, whatever `"none"` says. `transition` forwards React's own `default` shape and is static. For a top-layer part the boundary wraps **the top-layer element itself**, so a library-driven `showPopover()` / `hidePopover()` in a layout effect animates enter and exit in every engine. Library adds `fsui-<component>[-<change>]` transition types. Reduced motion handled in CSS. |
| 6 | Suspense | Consumers own Suspense boundaries. Library content regions are keyed off committed state so suspending children keep the old UI and show as `data-pending`. |
| 7 | RSC and platform attributes | `"use client"` per source file; unbundled build (`tsdown` `unbundle: true`, verified to keep the directive); "JS-free" means no behaviour JS runs for the interaction and the markup works before hydration (the `<details>` Accordion); whether a part file is directive-free is a per-component fact recorded in its design doc. **There is no second, directive-free anatomy; "JS-free" means no behaviour JS on the native path and works before and without hydration, never "no client bundle"** (7.3). Attributes react-dom cannot express use lowercase pass-through, one module augmentation file, and a ref-based upgrade for `hidden="until-found"`. **Overlay Triggers render `popoverTarget`** (typed by `@types/react`, serialised camelCase by react-dom and lowercased by the DOM), not `commandfor` / `command`, **and no `aria-expanded` on an invoker**; JS-free mode DOM-writes `data-open`. |
| 8 | Experimental | `experimental_<feature>` props on the part that uses the feature (first customers: `popover="hint"`, `interestfor`, `focusgroup`, `interpolate-size`, `closedby`), spelled camelCase after the prefix (`experimental_focusGroup`); whole components that cannot exist without a flagged feature ship from `@funstack/ui/experimental`. No provider. |
| 9 | Layout | `src/<component>/` folders, kebab-case files, `index.ts` per component without a directive. Root entry plus per-component subpaths (`@funstack/ui/tabs`). Flat public type names (`TabsTabProps`, `TabsTabState`). |
| 10 | Tests | Every component test file covers: ARIA/roles, keyboard, sync action, async action with `data-pending`, optimistic + rollback, overlapping actions, suspending content, controlled/uncontrolled parity, `render`/function props. Shared helpers in `src/__tests__/helpers.tsx`. |
| 11 | Handlers (facts) and strings | A change the library cannot hold (the browser performed it before the library heard: a keystroke in a controlled text input, a dismissed popup, a toast that left) is reported to a **handler**, `on<State>Change: UrgentChangeHandler` or `on<Event>: UrgentHandler`, named as a handler precisely because it is not an action. **One rule for every `on*` handler the library defines**: called synchronously, outside any transition, not awaited, no pending state; it may return a promise; a returned promise's rejection and a synchronous throw go to `reportError`; no dev warning for a returned promise. The handlers: `onInputValueChange` (Combobox), `onValueChange` (OTPField), `onOpenChange` (the owners of an overlay's `open`, listed in 2.1), `onClose` (a toast). A state that is urgent **by design** (the Toast queue) is written through an imperative command dispatched from a microtask (section 2.6); a **mirror of a browser-owned validity fact** (`:user-invalid`, `validity`, Field) is urgent as well, with no consumer-facing action. Built-in UI strings are English defaults, always overridable through a function prop (section 11). |
| 12 | Anchored placement | Top-layer popups are placed by CSS Anchor Positioning through one shared helper (`internal/overlay/anchor-position.ts`): `side` is physical (`top` / `bottom` / `left` / `right`) or inline-logical (`inline-start` / `inline-end`, through `self-x-*`), `align` `start` / `end` is **inline-relative** on a horizontal side (`span-self-x-*`) and physical on a vertical one; **never a plain logical keyword** (it resolves against the root, not the popup's container) and **never a JS direction read to pick keywords**. `data-side` / `data-align` / `state.side` / `state.align` are the **resolved** placement while the popup is shown, read from `getComputedStyle(popup).positionArea` by a shared observer (`internal/overlay/use-resolved-placement.ts`), and the requested values otherwise. A point-placed popup (no anchor) reads the popup's computed `direction` once per open to mirror its insets (section 13). |
| 13 | Shipped CSS and CSP | Shipped functional CSS (section 12) may, besides selector-less at-rules, carry a rule whose selector matches only elements the library marks (`[data-fsui-…]`) and that sets only a `--fsui-` custom property (Tooltip's skip-delay): shipped CSS covers placement and interaction timing, never visuals. A client-inserted `<style>` is **not** covered by the directive that allows inline `style` attributes: the library exports the SHA-256 of every shipped stylesheet (`@funstack/ui/csp`, `STYLE_SHA256`) for hash-based policies and one provider, `<CSPProvider nonce>`, for nonce-based ones, read by every part that renders a hoisted `<style>`. |
| 14 | Direction and locale | **Direction is the computed CSS `direction` of an element, read at the event**: no direction provider, no library `dir` prop (the native `dir` attribute passes through), no default. Only ArrowLeft / ArrowRight of a horizontal orientation mirror. Keys the browser handles on a native control stay native, engine differences included (RadioGroup in WebKit); Slider is the recorded exception. **Locale is a `locale` prop on the Root** of a component that formats or parses, `string \| readonly string[]`, default the runtime's locale: no locale provider, no `lang` or `navigator.language` detection. Locale never sets direction. The first date or time component reopens the locale rule (section 14). |

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
| `Root` | Owns state, context and the transition. May render no DOM (overlays), a wrapper, the `<form>` itself (Form), the `<details>` itself (Collapsible) or a `div[role=group]` (NumberField); a Root that owns a form value but no visible form element renders exactly one `<input type="hidden">` when `name` is given (Combobox; one per value for a set: Combobox `multiple`, MultiSelect). | `div` / `form` or none |
| `List` | Groups triggers and owns keyboard navigation between them. In Combobox and MultiSelect it is the ARIA `listbox` inside the `Popup` (a listbox may contain only options and groups, so the Popup is the container; MultiSelect's is `aria-multiselectable`). | `div` |
| `Item` | One entry in a multi-item component: Accordion's `details`, Menu's `button[role=menuitem]` with an `action`, ToggleGroup's `button[aria-pressed]` whose pressed state is the Root's. | `div` / `details` / `button` |
| `Trigger` / `Tab` | The interactive element the user acts on. MultiSelect's is the combobox itself, `button[role=combobox]`: the one Tab stop, the owner surface for `data-pending`, DOM focus with `aria-activedescendant` while the listbox is open. | `button` |
| `ContextTrigger` | A region whose `contextmenu` (right-click, the keyboard's context-menu keys, a library long-press for touch) opens the owner's `Popup` at the pointer (Menu). A plain element with **no role and no ARIA**; may share a Root with a `Trigger`. | `div` |
| `Panel` | Content region whose visibility is driven by library state (Tabs, Accordion, Collapsible). | `div` |
| `Popup` | Content that lives in the top layer. An overlay's content region: its children render from committed state in library mode. | `div[popover]` (Tooltip, HoverCard, Menu, NavigationMenu, Combobox, MultiSelect), `dialog[popover]` (Popover) or `dialog` (Dialog, AlertDialog, Drawer) |
| `Title` | Names a popup through `aria-labelledby` while it is mounted (1.1.1): an `h2[id]` whose level `render` changes (Dialog, AlertDialog, Drawer, Popover). Toast's is a `div[id]`, not a heading: a transient notification stays out of heading navigation. | `h2` / `div` |
| `Close` | A button that asks its owner to close. In an overlay (Dialog, Drawer, Popover) it is a pure trigger: an optional `action` runs first, and the close is `"activate"` (2.5.1). Toast's has no `action`, and its close is `"dismiss"` (2.2). | `button` |
| `Viewport` | The owner of a queue that a command fills (Toast): the region the queued entries render into. It plays the Root's role for the component, whose `Root` is one entry. | `section[popover=manual]` |
| `Link` | A navigation link the component knows about (NavigationMenu): inside a `Popup`, following it closes the panel (`closeOnActivate`, 2.5.1); anywhere else it is a plain link. | `a` |
| `SubmenuTrigger` | An `Item` of one menu that is also the `Trigger` of a nested Root (Menu). | `button[role=menuitem]` |
| `CheckboxItem` / `RadioItem` / `RadioGroup` | Checkable entries of a menu: a `CheckboxItem` owns a `checked` state, a `RadioGroup` owns a `value` that its `RadioItem`s select (Menu). State owners, not pure triggers: no `whilePending` (2.5.1). | `button[role=menuitemcheckbox]` / `button[role=menuitemradio]` / `div[role=group]` |
| `Chips` / `Chip` / `ChipRemove` | The selected values of a set-valued text control shown as removable entries (Combobox `multiple`): the list, one entry per value (`value` required), and the button inside an entry that removes it. | `div` / `div` / `button` |
| `Indicator` | Purely visual element that tracks state: the active tab marker; the fill of a Slider, Progress or Meter, sized by the consumer's CSS from the Root's custom properties. | `span` |
| `Label` | Names the owner, in the form the owner's element needs: `<legend>` as the first child of a `<fieldset>` Root (RadioGroup, CheckboxGroup); `label[for]` for an input surface (Combobox, NumberField, a one-thumb Slider, Field's control) or a button surface whose forwarded click it turns into focus (MultiSelect's Trigger, as a label on a `<select>` focuses it); `label[id]` or `span[id]` referenced through `aria-labelledby` where the owner is a group or is not labelable (a multi-thumb Slider, a Field's group control, Progress, Meter). | `label` / `legend` / `span` |
| `Input` | A text field that is the owner's surface for `data-pending` and holds an urgent state (2.6): Combobox's `input[role=combobox]` (`inputValue`), NumberField's visible `input[type=text][inputmode]` (the draft text), which renders the hidden native number input right after it; OTPField's one `input[type=text][autocomplete=one-time-code]` (the code's text), which is also the form control and covers its Root with transparent text. | `input` |
| `Parent` | A mixed-state checkbox that controls a subset of a CheckboxGroup (`values`): its state is derived from the group's optimistic set and its click dispatches for the whole subset. Never submitted (no `name`). | `input[type=checkbox]` |
| `Option` | One choice: in a native `<select>` (optimistic `data-selected`, equal to the platform's `:checked`) or in a listbox (Combobox, MultiSelect: `div[role=option]`, never focused, `data-active` for virtual focus). | `option` / `div` |
| `Clear` | A `tabindex="-1"` button that empties a text field and dispatches the empty selection (Combobox). | `button` |
| `Empty` | Content the **library** shows only when a list has no mounted options and its results are neither stale nor loading (Combobox, MultiSelect). | `div` |
| `Status` | A loading fallback or hint inside a popup (Combobox, MultiSelect). Outside the `List` it is `role="status"`; **inside** the `List` it is the Suspense fallback, renders `role="none"` and marks the list as loading (`aria-busy="true"`, `Empty` hidden, nothing announced). | `div` |
| `Value` | The element that shows the current value. Select: the `<selectedcontent>` the browser fills, with **no `children` prop** (7.4). MultiSelect: a `span` inside the Trigger that renders the selection from function `children` (the consumer's names; the library knows only the labels of options it has seen) or a `placeholder`. Slider, Progress, Meter: a `span` (Progress / Meter: `aria-hidden` by default, the same text is in `aria-valuetext`). | `selectedcontent` / `span` |
| `Track` | The rail of a Slider (owns pointer interaction and is the geometry reference for pointer math) or of a Progress / Meter bar (no interaction). | `div` |
| `Slot` | One character position of a code drawn from the owner's single input (OTPField, explicit `index`): `aria-hidden`, never focusable and never the pointer's target. Not a separate input. | `span` |
| `Thumb` | A draggable value handle (Slider, one per value, explicit `index`): a styled element **containing** a visually hidden native `<input type="range">`, which is the focusable, labelled, form-participating `slider`. | `span` + `input[type=range]` |
| `Increment` / `Decrement` | `button[type=button][tabindex=-1]` that steps a numeric value, with press-and-hold (NumberField); natively `disabled` when the next step would change nothing. | `button` |
| `Form` | A form whose successful submission completes the component's interaction (Dialog, AlertDialog). | `form` |
| `Cancel` | The safe answer of an AlertDialog: a close button that is the default initial focus target (`Dialog.Close` under another name). | `button` |
| `Action` | The confirm button of an AlertDialog: a close button whose `action` runs first in its own transition and that, with `action`, is no native close invoker. Not Toast's `Action`, which is a toast's own button. | `button` |
| `Control` | The native form control a Field labels and describes (`input`, or `textarea` / `select` through `render`), inside a Field or alone (outside a `Field.Root` it is the plain control, nothing added). Any FUNSTACK form control inside a `Field.Root` plays the same role through `useFieldControl` (3.8). | `input` |
| `Description` | Describes the owner through `aria-describedby`: a `p[id]` the owner (Dialog, AlertDialog, Drawer, Popover, Toast; a Field's control) references only while it is mounted (1.1.1; field-form.md 4.2). | `p` |
| `Error` | The message for a Field's current constraint violation: `div[id]`, rendered only while an error is shown and referenced through `aria-describedby` while it is; no live region, no `role`. | `div` |
| `Submit` | A form's submit button with the form channel's `data-pending` (`useFormStatus`). | `button[type=submit]` |
| `GroupLabel` | Names a `Group` (or a `RadioGroup` in Menu) through `aria-labelledby`, while it is mounted (1.1.1). Not `Label`, which names the component's owner. | `div` |
| `Button` | A pure-trigger `button` with a bare `action` and its own `data-pending`. The general one is the single-element `Button` (`@funstack/ui/button`; `whilePending`, 2.5.1), which is also a Toolbar's command button: the Toolbar has no button part, and every library button-like part reads `ToolbarContext` so that a disabled one stays focusable there (3.6). | `button` |
| `Image` | A picture the owner shows while it is available, mirrored as a load `status` (Avatar): an `<img alt="">` rendered from the server render on, unmounted once its source failed; the owner carries the name. Never an `onLoad` prop of the library's (react-dom's commit wait, `design/components/avatar.md` 5). | `img` |
| `Fallback` | What the owner shows in an `Image`'s place: rendered until the image has loaded, **under** it (the consumer's CSS stacks them), so nothing is swapped while it loads (Avatar). | `span` |
| `Group`, `Separator`, `Arrow` | Structural or decorative. There is no `Header` part: a heading goes inside the `Trigger` (Accordion). `Separator` is an `<hr>` by default and renders `role="separator"` itself, so a `render` element of another tag is a separator too (`Select.Separator` is the exception: it must stay an `<hr>` and writes no role); inside a Toolbar it carries `aria-orientation` perpendicular to the toolbar's. The standalone single-element `Separator` (`@funstack/ui/separator`, directive-free) takes `orientation` and `decorative` (`role="none"`, no `aria-orientation`, `data-decorative`; the one spelling allowed inside a listbox). | as named |

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
A second exception (NumberField): a part whose user surface is itself a native input and
whose form control must be a different element renders the control as a **visually hidden
sibling immediately after it** (`NumberField.Input`): `ref` goes to the visible input, a
documented `hiddenInputRef` to the control, and the props the control needs (`name`, `form`,
`min`, `max`, `step`, `required`) are listed as forwarded to it.
MultiSelect uses the same exception for constraint validation only: `MultiSelect.Trigger`
renders a visually hidden one-option `<select>` immediately after its button while `required`
is set (the **validity element**, `design/components/multi-select.md` B.10), with no `name`,
no props and no `ref` of its own, because neither a button nor a hidden input can hold
validity.
A third exception (Combobox): a `Root` that has no element of its own renders the form
value as hidden inputs, one for a single selection and **one per value** with `multiple`
(`design/components/combobox.md` 15.8); they are form plumbing, take no `ref`, `className` or
`render`, and sit before the children, outside every `<ViewTransition>`. MultiSelect's Root
does the same, one per value (`design/components/multi-select.md` B.10).

#### 1.1.1 Referenced only while mounted

An owner references an optional part's id (`aria-labelledby`, `aria-describedby`) **only
while that part is mounted**, so no IDREF names a missing element (#217, #218). The rule covers:
the Popup of Dialog, AlertDialog, Drawer and Popover and the Toast Root → `Title` and
`Description` (a Toast Description that renders nothing is not mounted); `Menu.Group`,
`Menu.RadioGroup`, `Combobox.Group`, `MultiSelect.Group` → `GroupLabel`; a `Menu.Popup` → its
`Menu.Trigger` or `Menu.SubmenuTrigger` (a menu opened only from a `Menu.ContextTrigger` has
none); a Field's control → `Field.Label`, `Field.Description`, `Field.Error`
(`design/components/field-form.md` 4.2).

- **Mechanism.** The part registers with its owner from a layout effect (`usePartPresence`,
  `internal/use-part-presence.ts`); the owner emits the token while one is registered. A key
  with nothing to reference is **omitted** from the owned layer, never set to `undefined`
  (which would remove the consumer's own tokens, 1.2).
- **Server HTML and hydration.** Until the owner's first commit every part counts as mounted:
  the server cannot know whether a part rendered after the reader exists, and the hydration
  render must match the server HTML. The server HTML therefore references every part (a
  Title rendered with a JS-free Dialog keeps its token for no-JS pages); the owner's layout
  effect settles the real presence before the first paint, and the drop is a post-hydration
  render (no mismatch, no warning). A page without the part references a missing id until
  hydration.
- **Hidden content.** A part hidden by `<Activity mode="hidden">` or by a Suspense boundary
  that suspends again loses its token while hidden (its layout effects disconnect) and gets it
  back when shown. An owner that itself first mounts inside a hidden `<Activity>` (a group in a
  closed `keepMounted` popup) runs no effects there, so it keeps the server-HTML assumption until
  it is first shown; the content is hidden, so nothing is exposed meanwhile.
- **Cost.** An owner mounted on the client without one of its parts renders once more in the
  mount commit (the presence settling), synchronously and before paint.
- **Kept as they are**, each with its reason:
  - Progress and Meter Root → `${id}-label` (`design/components/progress.md` 8): Server
    Components, which cannot register without becoming client modules; the dangling token is
    skipped by accname and falls through to `aria-label`.
  - `aria-controls` of a combobox (Combobox Input and Trigger, MultiSelect Trigger) → the List,
    which is not rendered while the popup is closed: ARIA 1.2 requires `aria-controls` on
    `combobox`, and the reference names the popup the element controls whether or not it is
    rendered.
  - Tabs: a Tab's `aria-controls` → its Panel (`design/components/tabs.md`): the APG tab pattern
    references the panel, and a lazily rendered panel is ignored by assistive technology until
    it exists.
  - `aria-controls` of the NumberField step buttons names the Input, which is always rendered.

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
    the pattern or the consumer asks for a focusable disabled control (`alwaysFocusable`:
    every library button-like part inside a Toolbar, 3.6; a `Button` with
    `focusableWhenDisabled`; a menu item; `SubmenuTrigger` through `usePopoverTrigger`'s
    `submenuItem`). The handler is what makes `aria-disabled` safe: it
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
props the part owns. **An event the part listens to in prop form is the part's: its `on*` key is
omitted from the type.** One test decides it, with no judgement about what the handler does:
the part passes that `on*` key to its element in at least one mode. So the key is omitted

- **in every mode**, also where the handler is installed in one mode or context only (the
  roving handlers of a standalone `ToggleGroup.Root`, `Menu.Trigger`'s `onPointerMove` inside a
  Menubar, `Dialog.Trigger`'s `onPointerDown` in non-modal JS-free mode, a cancelled click that
  exists only while the part is disabled, as on `Form.Submit`);
- **whatever the handler does**: it dispatches the action, moves focus, cancels the default, or
  only records a fact for a later event. There is no "chained" kind of handler that stays.

The reason is the "no handlers" rule (2.6), not the merge: `mergeProps` runs every handler it
is given, so a consumer handler would not be lost. But the part's API for the event is its
action prop or its documented behaviour, what a consumer's handler may cancel or rely on
there is in no part's contract, and a key that is typed in one part and not in its neighbour
for a reason only the source shows is the inconsistency this rule removes. A consumer who
needs the raw event has two supported routes: a handler on the `render` **element**
(`render={<button onPointerDown={…} />}`; 1.2: both run, the element's first), or `ref` and
`addEventListener`.

A part that attaches its listeners through `addEventListener` on its ref instead (section 7.4;
Tooltip does this because its hover/focus handlers are feature-detected away when
`interestfor` is native) omits nothing, and the consumer's `on*` props for those events pass
through and run independently. That route is for the cases of 7.4, not a way to keep a key in
the type.

```ts
// `onClick`, `onKeyDown` and `onFocus` are the Tab's: it passes them to its element.
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

**Owned keys are omitted from the props type, in every part.** A key the part writes itself in
at least one mode (1.2: its `role`, the ARIA state it computes such as `aria-selected`,
`aria-pressed`, `aria-expanded`, `aria-orientation`, `aria-disabled` on a part that takes
`disabled`, `aria-readonly` on a part that carries the read-only mark (3.6.1 rule 9), `type`, a roving `tabIndex`, the invoker attributes `commandfor` / `command` /
`popoverTarget` / `popoverTargetAction` of a Trigger or Close part, `popover` and `open` on a
Popup, `name` and `open` on a `<details>`, `focusgroup` on a container that takes
`experimental_focusGroup` and `focusgroupstart` on its items) is removed from the type **in
every mode**, so passing it is a type error rather than a prop that is silently overwritten or
removed. One props type per part: a key owned in one mode only is still omitted, and the part
then owns it **in the other modes too, as `undefined`**, wherever a consumer's value would
work against the part (`focusgroup` with the flag off: it would put the browser's arrow-key
handling beside the JS engine's on one container). Three kinds of key stay in the type:

- an ARIA id-reference list the part **token-merges** (`aria-labelledby`, `aria-describedby`,
  `aria-controls`, `aria-owns`; 1.2), because the consumer's tokens take effect;
- a key the part only **removes** in one branch and otherwise passes through (`Button`'s
  `commandfor` / `popoverTarget`, which are the consumer's own and are dropped while disabled);
- a key owned only in a context the type cannot see (a control's `id` inside a `Field.Root`,
  which warns in development instead).

A part never omits a key it does not own (`Avatar.Root` owns `aria-labelledby`, always absent:
the name is `alt`). What a `render` **element** carries is not the part's props and follows
1.2. Each part's JSDoc has an "Owned keys" line, and the list equals the `Omit` of its props
type plus the `data-*` attributes and the three kinds above.

**What the type error covers.** TypeScript checks a JSX attribute against the props type only
when its name is an identifier. A **hyphenated** attribute (`aria-*`, `data-*`) that the props
type does not declare is accepted in JSX without an error, so:

| Where the key is written | Identifier key (`role`, `tabIndex`, `type`, `onClick`, `focusgroup`) | Hyphenated key (`aria-selected`, `aria-disabled`, `aria-orientation`) |
| --- | --- | --- |
| A JSX attribute (`<Tabs.Tab role="link">`) | type error | **compiles** |
| An object literal typed as the props (`const p: TabsTabProps = { … }`) | type error | type error |

The omission is therefore complete for identifier keys and, for hyphenated keys, reaches
typed objects but not inline JSX. No type-level trick closes the gap without
giving up `data-*` and `aria-*` pass-through, so the rule does not depend on it: **at runtime
the library's value wins** (1.2). An owned key that slipped through is overwritten, or removed
where the part computes `undefined`, in every mode in which the part writes it; in a mode in
which the part does not write the key it reaches the element, which is unsupported and not
warned about. The library's type rows follow from this (`testing.md`, "Types"): an identifier
key is pinned with `@ts-expect-error` on a JSX attribute, a hyphenated key with
`@ts-expect-error` on an **object literal typed as the props** (a JSX row for a hyphenated key
would be an unused directive). The runtime half is `mergeProps`'s own rows (an owned key beats
the pass-through props and the `render` element, an owned `undefined` included); parts need no
row each.

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
| Pure trigger that carries a value, named after its event | `<event>Action` | `(value, details)` | `completeAction` (`OTPField.Root`): the code became complete. Nothing changes that could be rolled back (the value is already the state's, urgent); the action is a request about that value, run in the owner's transition, awaited, with `data-pending`. Used where a bare `action` would read as a form's `action` or where the trigger is not a part the user presses. No `whilePending` (2.5.1). |
| Commit of a continuous state | `<state>CommitAction` | `(next, details)` | `valueCommitAction` (Slider): once per gesture (pointer release, key press, platform change), awaited in the owner's transition like a change action; the step action `<state>ChangeAction` runs per step. For a continuous control the commit action is the state owner's dispatch (section 3.3). **A text control has the commit alone** (`TextField`): one edit, from the first keystroke to the blur or the commit key (Enter in an `<input>`, Ctrl+Enter or Cmd+Enter in a `<textarea>`), is the gesture; its steps are keystrokes, which are facts and have no action, so there is no `valueChangeAction` there. |
| Fact about a state (the library cannot hold the change) | `on<State>Change` | `(next, details) => void` | `onInputValueChange` (Combobox), `onValueChange` (OTPField): a controlled text input's text, which React requires to be urgent. `onOpenChange` (the owners of an overlay's `open`, listed below): the popup was closed without the library performing the close. **Not an action** (the handler rule below). Type `UrgentChangeHandler`. |
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
| `onValueChange` | `OTPField.Root` | the text of its input changed (2.6): an edit, a reset, text adopted at hydration, a WebOTP fill. The state is called `value` because it is the field's only state and its form value |
| `onOpenChange` | the nine owners of an overlay's `open`: `Popover.Root`, `Menu.Root`, `Combobox.Root`, `MultiSelect.Root`, `Dialog.Root`, `AlertDialog.Root`, `Drawer.Root`, `HoverCard.Root`, `NavigationMenu.Item` | the popup was closed by something other than a request: Escape, light dismiss, focus leaving, script, … (always `false`; 3.9) |
| `onClose` | a toast (`ToastOptions`) | the toast left, with `details.reason` |

For a state with a handler the triple reads `inputValue` / `defaultInputValue` /
`onInputValueChange`; a state that has both requests and facts (an overlay's `open`) has four
props: `open` / `defaultOpen` / `openChangeAction` / `onOpenChange`. The pair exists **only on
the owner of an overlay's `open`**: a Root, or `NavigationMenu.Item`, which owns one flyout. No
form control gets a second prop for its value.

**This table is the one list of `onOpenChange` owners.** It equals the allow-list of the type
guard (10.1, "Action naming": the nine props types `PopoverRootProps`, `MenuRootProps`,
`ComboboxRootProps`, `MultiSelectRootProps`, `DialogRootProps`, `AlertDialogRootProps`,
`DrawerRootProps`, `HoverCardRootProps`, `NavigationMenuItemProps`). Every other document, the
docs site and the agent skill included, says "the owners listed in conventions 2.1" or copies
this row whole; none keeps a shorter list of its own. Tooltip has no `open` prop and no
handler; a toast's fact is `onClose`; Collapsible and Accordion have no `onOpenChange`, because
a `<details>` toggle is a request the library can still roll back (`reason: "platform"`).

A new `on*` prop needs the component's design doc to show who performs the change and why the
library cannot hold it, and a conventions amendment adding it to the list above. The type guard
(10.1, "Action naming") holds the allow-list.

### 2.2 Signature and shared types

```ts
// packages/ui/src/internal/types.ts (exported from @funstack/ui/types and the root entry, 9.2)

/** A callback the library runs inside a Transition. May be sync or async. */
export type Action<Args extends readonly unknown[] = []> = (...args: Args) => unknown;

export interface ActionDetails {
  /** The DOM event that caused the action, or undefined for programmatic changes. */
  readonly event: Event | undefined;
}

/** What an action's `details` has and a handler's does not: the action may refuse the request (2.4.1). */
export interface Rejectable {
  /** Call before the action returns or resolves: the request counts as rejected, and no error is thrown. */
  readonly reject: () => void;
}

export type ChangeAction<T, Details extends ActionDetails = ActionDetails> = Action<[next: T, details: Details & Rejectable]>;

/** Why a change action was dispatched; the full vocabulary (section 2.2, "reason" table). */
export type ChangeReason = "activate" | "platform" | "dismiss" | "timeout";
```

`ChangeReason` is **one public type**, exported from `@funstack/ui/types` and the root entry;
every change details type declares `readonly reason: ChangeReason` rather than a local union, so
the vocabulary cannot drift per component.

`details` is the native DOM event (not React's synthetic one) plus component-specific fields,
typed per component with a **named, exported type** (9.4 has the naming): no public action prop
is typed with the bare `ActionDetails`.

**Every change details type carries `reason`.** The details of a `<state>ChangeAction`, of a
`<state>CommitAction` and of an `on<State>Change` handler all have `reason`, including where
only one value can occur: Toggle, ToggleGroup, `Menu.CheckboxItem` and `Menu.RadioGroup` have no
platform path and always report `"activate"`. One consumer function
(`(next, { reason }) => …`) therefore types against every change action in the library. A pure
trigger's details (`action`, `completeAction`) carry `reason` only where the component defines
more than one cause (`OTPFieldCompleteDetails`).

**`details.reason` vocabulary is library-wide**: a component that
exposes `reason` uses exactly these values and no synonyms:

| `reason` | Meaning | `details.event` |
| --- | --- | --- |
| `"activate"` | The user acted on a trigger part: click, Enter/Space, or focus in an automatic-activation mode; or showed interest in it (hover or keyboard focus held for a delay: an interest-opened popover, a HoverCard). | The native `MouseEvent`, `KeyboardEvent` or `FocusEvent` (`type` is `"focusin"` for React's `onFocus`); for interest, the `pointerenter` / `focus` event or the `beforetoggle` of the platform's interest show. For native checkbox and radio inputs it is always the `click` `PointerEvent`, including Space and radio arrow keys, because React's `onChange` for them is click-driven. |
| `"platform"` | The browser changed the state: find-in-page or a text fragment (`beforematch`, `<details>` `toggle`), form reset, or interaction before hydration reconciled at mount. Never a user gesture. | The platform event, or `undefined` for mount reconciliation. |
| `"dismiss"` | The user closed the component **without acting on one of its parts**: Escape, Android back, an assistive-technology dismiss gesture, light dismiss (outside click); also a close no user caused through this component: script calling `hidePopover()`, another top-layer element (an unrelated `auto` popover, a modal dialog) hiding the popover, focus leaving the component (Tab out of a menu), a right- or middle-click outside a menu (the library's own immediate close, since click-based light dismiss ignores those buttons), the pointer leaving a hover-opened submenu, lost interest (the pointer or focus leaving a HoverCard or an interest-opened popover), or a parent overlay closing (a submenu when its menu closes). A close through a part **that carries a decision** (`Dialog.Close`, a Form submit) is `"activate"`; `Toast.Close`, which only ever means "go away" (the same as Escape), is `"dismiss"`, so a toast's `onClose` can tell "acted on the content" (its Action part, `"activate"`) from everything else. | The platform's `close` or `toggle` event; the click or keydown for Toast. |
| `"timeout"` | The library's own timer closed the component: no user gesture and no platform event. Toast's auto-dismiss is the only user; the Undo-window pattern (`design/components/toast.md` 9.3) relies on it being distinct from `"dismiss"`. | `undefined` |

**Channel and `reason` are independent** (3.9.2).
On an overlay Root the channel says whether the library held the change (`openChangeAction`, a
request) or not (`onOpenChange`, a fact); `reason` says what the user did. Most facts are
`"dismiss"` and most requests `"activate"`; `"platform"` is always a request. The crossovers:

| Channel | `reason` | Where |
| --- | --- | --- |
| `onOpenChange` | `"activate"` | A consumer's own invoker button (`popovertarget`, `commandfor` with a popover command) closes a popover, menu or listbox; a non-button Trigger pressed while open (light dismiss hid it at `pointerup`, the click names the cause). |
| `openChangeAction` | `"dismiss"` | A close the library does hold although no part asked: the pointer leaving a hover-opened submenu; lost interest while an interest open is still pending (nothing is shown yet); a HoverCard's Escape or press while its open is still pending. |

Components whose close carries a platform result add it as a serialisable field next to
`reason`: Dialog's `details.returnValue` is `dialog.returnValue` (the `value` of the Close button
or form submitter, or the string passed to `requestClose()`), `undefined` on open.

Components with a **set-valued state** describe what changed as a diff, `added: readonly
string[]` and `removed: readonly string[]`, so that one shape covers a single item, a
multi-item trigger and a platform path, and a controlled "update on success" parent can apply
it as a functional update instead of writing the whole set (section 2.5). **Every set-valued
component uses it, with no other shape**: CheckboxGroup, ToggleGroup, Accordion, MultiSelect,
Combobox with `multiple`. A component with an `exclusive` mode (ToggleGroup, Accordion) reports
the diff in that mode too, and there it names the item the change **implicitly** closed or
released: a switch from A to B is `added: ["b"]`, `removed: ["a"]`. A platform dispatch that
carries several changes at once (mount reconciliation, a form reset) lists them all.

**`details.valid`: every value action of a form control says whether the requested value passes
constraint validation.** A *form control* is a component that registers with a Field
(field-form.md 7.2) and has a value action: Checkbox and Switch (`checkedChangeAction`),
RadioGroup, CheckboxGroup, Select, MultiSelect and Combobox (`valueChangeAction`), TextField
(`valueCommitAction`), NumberField and Slider (`valueChangeAction` and `valueCommitAction`),
OTPField (`completeAction`). Their details types all carry

```ts
/** The control would be valid holding this value: its native constraints and, inside a Field, `validate`. */
readonly valid: boolean;
```

- **What it covers**: the control's native constraints (`required`, `pattern`, `minLength`,
  `min` / `max` / `step`, a group's "at least one") evaluated for the value the action is
  called with, and inside a Field the Field's `validate` for that value. Outside a Field it is
  the native constraints alone. It is `true` for a control with no constraint.
- **What it does not cover**: a server error (`Form.Root errors`). That is a statement about a
  value already submitted, and the change that is being dispatched is the edit that dismisses
  it.
- **It is information, not a gate.** The action is always called, also for an invalid value
  (the control holds what the user entered; validity is a separate fact that a Field shows and
  a form submission enforces). An action that saves checks it:
  `if (!details.valid) return;`. The control then keeps showing what the user entered, with
  the Field's error next to it, and nothing is saved.
- **One exception, for typed text: an invalid draft is not written to uncontrolled state**
  (3.3.1). In TextField and NumberField, text the user typed that is invalid at the commit
  stays a draft: the action runs, but the saved value does not change and remains what a later
  rollback returns to. Every other control, and controlled mode everywhere, writes or adopts
  an invalid value as it does a valid one.
- **Every reason**: `"activate"`, `"platform"` (a form reset, a value adopted at mount) and
  NumberField's `"dismiss"` notice all carry it, computed the same way.
- **Serialisable** (a boolean own property), so a Server Function passed directly receives it.
- **Not on handlers and not on other actions**: `onValueChange` (OTPField),
  `onInputValueChange` (Combobox), `onOpenChange` / `openChangeAction`, and the actions of
  components that are not form controls (Toggle, ToggleGroup, Tabs, Menu's checkable items)
  have no `valid`.
- A read-only or disabled control dispatches nothing (3.6, 3.6.1), so the field has no value to
  define there.

How each control computes it, and the one internal helper they share, is field-form.md 7.5.

Adding a value is a change to this document, not to one component. The first argument is always the next value, so the
common case stays short:

```tsx
<Toggle pressedChangeAction={(pressed) => save(pressed)}>Favorite</Toggle>
<Tabs.Root valueChangeAction={setTab}>...</Tabs.Root>
```

The return type is `unknown`, not `void | Promise<void>`: TypeScript's void-return leniency does
not apply to unions, so `(next) => save(next)` with `save` returning `Promise<Response>` would be
a type error, and Server Functions usually return data. The library `await`s whatever comes back
(a thenable is awaited; anything else is ignored). The one thing an action can tell the library
besides settling is `details.reject()` (2.4.1).

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
   `ActionDetails` type and the `(next, details)` signature are unchanged. `reject` (2.4.1) is
   the second virtual property, served the same way and only to actions.
3. Therefore **a Server Function may be passed directly to any action prop**, from a Server
   Component or a Client Component, in every RSC framework surveyed, with no dev warning. It
   receives `(next, details)` with `details.event === undefined` and every other field intact.
   It has no `details.reject` either (a function does not cross the wire): a Server Function
   refuses by throwing, or through a client wrapper that calls `reject()` (2.4.1).
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
7. **Disabled parts never dispatch for user interaction, and neither does a read-only control**
   (3.6.1). A disabled Tab does not call
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

A consumer who wants inline error UI instead of a boundary catches inside the action **and calls
`details.reject()`** (2.4.1). Without that call a caught error makes the action *resolve*, which
the library treats as success:

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

In uncontrolled mode a swallowed error therefore commits the new value. `details.reject()` is
how an action refuses in either mode.

#### 2.4.1 `details.reject()`: a rejection the action handled

```tsx
<Checkbox
  defaultChecked={task.done}
  checkedChangeAction={async (next, details) => {
    try {
      await setTaskDone(task.id, next);
    } catch (e) {
      toast({ title: "Could not update the task", type: "error" });
      details.reject();          // roll back; no Error Boundary
    }
  }}
/>

<AlertDialog.Action
  action={async (details) => {
    const result = await deleteProject(id);
    if (!result.ok) {
      setMessage(result.message);  // shown in the dialog
      details.reject();            // the dialog stays open
    }
  }}
>
  Delete
</AlertDialog.Action>
```

**One rule: an action that called `details.reject()` before it settled is treated as if it had
rejected, except that nothing is thrown and nothing is reported.** Everything this document and
the component documents say about "a rejection" applies, minus the Error Boundary and
`reportError`:

- the optimistic state reverts when the transition ends;
- uncontrolled state is not written (3.3); in a set-valued component the dispatch leaves no
  trace in the replay (2.5);
- a pure trigger's continuation does not run: `Menu.Item` and `Toast.Action` do not close their
  container (`closeOnActivate`), a Close part and `AlertDialog.Action` do not close the dialog;
- an overlay's `openChangeAction` leaves `open` as it was;
- the view-transition, Field-notification and focus consequences of a rollback are those of a
  rejection.

It exists on **every action's `details`** and nowhere else: state owners
(`<state>ChangeAction`, `<state>CommitAction`), pure triggers (`action`), event actions
(`completeAction`), and each action of a two-action part (Slider, NumberField) separately.
Where a rejection has nothing to undo (OTPField's `completeAction`: the code stays typed), the
call changes nothing.

The contract:

1. **When it is read.** Once, when the action settles: at its synchronous return, or when the
   thenable it returned resolves. A synchronous action calls it before returning; an async one
   at any point before its promise resolves. The request stays pending until then: `reject()`
   does not end `data-pending` early and does not interrupt the action.
2. **Called twice**: the same as once. There is no way to take it back.
3. **Called after the action settled** (from a promise the action did not await, a timer, a
   later event): no effect, and a development warning naming the mistake. The usual cause is
   `void save().catch(() => details.reject())`: return or await the promise.
4. **Called, and then the action throws or rejects anyway**: the throw wins. It is a real
   rejection and takes the route of 2.4.
5. **Overlaps and superseded dispatches.** `reject()` belongs to its own dispatch and has
   exactly the standing a rejection of that dispatch would have (2.5). Single-valued state: on
   the latest dispatch it rolls back; on a superseded one it changes nothing on screen (that
   dispatch's outcome was already irrelevant). Set-valued state: that one change is dropped,
   the others are kept. A pure trigger with `whilePending="run"`: the continuation runs once,
   when the last run settles, and only if the **latest** run resolved without `reject()`; an
   older run's `reject()` does not stop it (2.5.1).
6. **Owner gone** (unmounted or hidden when the action settles): no effect. Unlike a thrown
   rejection (2.4) nothing goes to `reportError`: the action handled its failure.
7. **Controlled mode.** The parent's prop is the truth, as always. `reject()` there equals
   "resolve without adopting" for the state, and it is still what keeps a trigger's container
   open. A parent that adopts the value and also calls `reject()` gets the value it adopted.
8. **Not on handlers.** An `on*` handler reports a fact (2.1) and its `details` has no
   `reject`: the type is `Details`, not `Details & Rejectable`, and the property is `undefined`
   at run time.
9. **Not on form actions.** `Form.Root action` and `Dialog.Form action` are React form actions:
   they receive `FormData` and no `details` (2.7). Their counterpart is the returned result:
   `Form.Root error` for a failed submission and `errors` for a wrong value keep the values
   and keep a dialog open (field-form.md 3.7), which is what `reject()` does for an action
   prop. The `openChangeAction(false)` that a settled `Dialog.Form` requests is an ordinary
   action and has `reject()`.
10. **Server Functions.** `reject` is a virtual, non-own property of `details`, like `event`
    (2.2): it is not serialised, so a Server Function passed directly receives no `reject`.
    It refuses by throwing (the boundary), or the consumer wraps it on the client:

    ```tsx
    checkedChangeAction={async (next, details) => {
      const result = await setTaskDoneOnServer(id, next);   // returns { ok, message }
      if (!result.ok) { toast({ title: result.message }); details.reject(); }
    }}
    ```

    A copy of `details` (`{ ...details }`) has no `reject`, as it has no `event`. The function
    does not depend on `this`: `({ reject }) => …` works.
11. **With `details.valid`** (2.2). The two compose into the two things an inline-save action
    can do with an invalid value: `if (!details.valid) return;` keeps what the user entered in
    the control and saves nothing (the Field shows why); `if (!details.valid) return
    details.reject();` puts the saved value back. For typed text the first keeps it as a draft
    and the second drops the draft (3.3.1).
12. **No state for it.** There is no `data-rejected`, no `state.error` and no error object held
    by the library: the action that calls `reject()` is the one that shows the message.

Typing: every action prop's `details` parameter is `<Details> & Rejectable`. `ChangeAction`
adds it; the props of pure triggers and event actions are typed the same way. The named details
types (9.4) do not contain `reject`, because handlers share them. A consumer who writes the
function apart from the JSX annotates `details: SwitchCheckedChangeDetails & Rejectable`
(`Rejectable` is exported from `@funstack/ui/types` and the root entry).

Why a method on `details` and not the alternatives: a return value is never interpreted (2.2:
Server Functions return data); a thrown sentinel would look like an error to everything between
the action and the library; an `onActionError` prop would put the handling away from the
`await` that failed and add a prop to every part. Why `reject` and not `cancel` or `fail`: the
effect is defined as "a rejection", the word this document already uses for it everywhere, and
`cancel` suggests stopping work that has in fact already run.

### 2.5 Overlapping actions

React neither cancels nor orders overlapping actions. The library's stance:

- **Single-valued state (Toggle, Tabs, Select, RadioGroup, an overlay's `open`, Collapsible's
  `open`, Accordion and ToggleGroup with `exclusive`): latest intent wins.** The optimistic value already shows the
  most recent dispatch; the library commits uncontrolled state only for the most recently
  dispatched action, ignoring earlier ones that resolve later. (Verified: without this guard the
  slowest promise wins.) An earlier action's *rejection* changes nothing on screen; it is
  reported through `reportError` (section 2.4).
- **Set-valued state (CheckboxGroup; ToggleGroup and Accordion without `exclusive`; Combobox
  with `multiple`; MultiSelect): every resolved change is kept**. Each dispatch is one change to the set (a patch: `added` /
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
  `details.removed` instead. Component docs say so.
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
values name what happens to the new activation. Every pure trigger **part** accepts both, so
the prop can be computed (`whilePending={saving ? "ignore" : "run"}`). A pure trigger that
carries a value and is not a part the user presses (`completeAction`, 2.1) has no
`whilePending` and always runs. **Not offered: `"queue"`.**
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
  library-owned step is switched off (`closeOnActivate={false}`), because the part is then a
  user-owned trigger that happens to live in a menu or a toast.

**One prop name for "activating this part closes its container": `closeOnActivate`.** It is the
prop of every button-like part whose activation the library follows with a close of the
container: `Menu.Item` and `Toast.Action` (default `true`), `Menu.CheckboxItem` and
`Menu.RadioItem` (default `false`), `NavigationMenu.Link` (default `true`; no action, the close
happens at the click). Where the part has an `action`, the close waits for it and happens only
if the latest run resolved (below); the name states which activation closes, not the moment.
**`closeOnSettle` is a different prop and exists on `Dialog.Form` (and its aliases) only**: a
form has no activation of a part, and "settled" there means more than "the action resolved"
(the submission did not throw **and** no `Form.Root` field error came back,
`design/components/dialog.md` 8.1). No other part takes `closeOnSettle`, and no part takes both.

| Part | What one activation does | Owner | Default |
| --- | --- | --- | --- |
| `Button` with `action` | runs the consumer's `action` | user | `"run"` |
| `Button` with a function `formAction` | React submits the form with the consumer's function | user (React runs it) | `"run"` |
| `Button` with neither (plain, URL `formAction`, `command`, link) | the native default action | – | nothing is ever pending: the prop has no effect |
| `Dialog.Close`, `Popover.Close`, `Drawer.Close`, `AlertDialog.Cancel`, `AlertDialog.Action` without `action` | the library closes the overlay | library | the prop has no effect: there is no run of the part's own to guard, and a repeated click is a no-op (2.3 item 8). The part still shows `data-pending` while the close it asked for waits (4.3), without `aria-disabled` |
| `Dialog.Close`, `Popover.Close`, `Drawer.Close`, `AlertDialog.Cancel`, `AlertDialog.Action` with `action` | the consumer's `action`, then the library's close | mixed | `"ignore"` |
| `Menu.Item` with `action`, `closeOnActivate` (default `true`) | the consumer's `action`, then the library closes the menu | mixed | `"ignore"` |
| `Menu.Item` with `action`, `closeOnActivate={false}` | the consumer's `action`; the menu stays | user | `"run"` |
| `Menu.Item` without `action` | the library closes the menu | library | no effect, as a Close part without `action`: `data-pending` while the close waits, no `aria-disabled` |
| `Toast.Action`, `closeOnActivate` (default `true`) | the consumer's `action` (the part's or the toast's), then the library closes the toast; the timer is paused meanwhile | mixed | `"ignore"` |
| `Toast.Action`, `closeOnActivate={false}` | the consumer's `action`; the toast stays | user | `"run"` |
| `Menu.CheckboxItem`, `Menu.RadioItem` | a state change (`useControllableAction`) | state owner | no prop: latest intent wins |
| `Slider.Root`, `NumberField.Root` steps (`valueChangeAction`; `NumberField.Increment` / `Decrement` request them) | a state change, one step of a gesture | state owner's second channel | no prop: every step runs |
| `Form.Submit`, `Dialog.Form`, `AlertDialog.Form` | the form channel (2.7) | React's form | no prop, never guarded |
| a toast's `onClose` | a handler, not an action (2.1): runs once when the toast leaves, by construction | – | no prop |
| `OTPField.Root` `completeAction` | a pure trigger that carries a value (2.1): each edit that leaves the code complete | user | no prop: every completion runs. A second completion while one is pending is a different code (or the same code entered again to retry); `"ignore"` would drop what the user typed |

A default that depends on another prop (`closeOnActivate`) is a cost each
page's props table has to spell out; it was chosen over a fixed `"ignore"` for every part of an
overlay, which would leave the counter case (a "Zoom in" item that stays open) needing the
prop. `toast({ action: { label, action } })` (`ToastActionOptions`) carries no `whilePending`:
the behaviour props live on the part, so the consumer sets it on `<Toast.Action>`.

**The effective value** is `whilePending ?? <the part's default>`, read when the activation
arrives (a change while a run is in flight applies to the next activation; the rendered
`aria-disabled` follows the current render). At runtime only the string `"ignore"` ignores; any
other value runs. No development warning for a part on which the prop has no effect. A closing
part without an `action` of its own resolves to `"run"` whatever the prop says: nothing of its
own is in flight to ignore, so it never renders the pending `aria-disabled`.

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
- **the continuation (a Close part's close, an item's menu close, a toast's close)
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

(`void` as the return type accepts a function that returns a promise.) The form has four
users (2.1): the text of a Combobox, the text of an OTPField, the dismissal of an overlay, a
toast that left. A new one
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
- **A mirror of an image's load state.** `Avatar.Root`'s `status` is written with `useState`
  from the image's native `load` / `error` events and from a layout effect that reads
  `img.complete` at mount and on a source change, never inside `startTransition`: the DOM
  already holds the fact, and a status held by an unrelated pending action would leave the
  fallback over a loaded picture. No `transition` prop (`design/components/avatar.md` 4, 7).
- **The draft text of a NumberField** is internal: written from the `input` event with
  `useState`, because the text is not a value until it is parsed at commit (blur, Enter, or
  before a step). The value under a held `Increment` / `Decrement` button follows Slider's
  `live` rule (3.2).
- **The draft text of a TextField** is the same state without the parse: the text being
  edited, written from the `input` event, shown instead of the saved value until a commit
  (blur, Enter), an Escape revert or a reset clears it (`design/components/text-field.md` 2).

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
Switching between modes after mount is unsupported (dev warning), and so is setting both `x`
and `defaultX`. **Every controllable state warns, the urgent ones included** (`OTPField.Root`'s
`value`, Combobox's `inputValue`): one helper in `internal/`, `useModeWarnings`, called by `useControllableAction`, `useStepCommit`
and the two urgent owners.

**A set-valued prop accepts a readonly array**: `value` / `defaultValue` (Accordion,
CheckboxGroup, ToggleGroup, MultiSelect, Combobox with `multiple`) and `CheckboxGroup.Parent`'s
`values` are typed `readonly string[]`, so an `as const` list or a value read from a `State`
type-checks. The action still receives a fresh, mutable `string[]`.

**Single or many: the flag names the non-default mode, in the platform's word.** A component
that holds either one value or a set has one boolean prop for the mode it does not default to,
and the value type is a union discriminated on it:

| Component | Default | Flag | The platform's word |
| --- | --- | --- | --- |
| `Accordion.Root`, `ToggleGroup.Root` | many (`string[]`) | `exclusive` → `string \| null` | exclusive `<details name>` groups |
| `Combobox.Root` | one (`string \| null`) | `multiple` → `string[]` | `<select multiple>` |

The flag is never inverted to make the components look alike (no `multiple` on Accordion, no
`exclusive` on Combobox): each keeps the default of its pattern. **A component whose two modes
need a different anatomy is two components** (`Select` and `MultiSelect`; `RadioGroup` and
`CheckboxGroup`), not a flag. The variants of such a union are named `<Component><Part><Mode>Props`
(9.4).

One accepted exception to the third name (TextField): its triple is `value` / `defaultValue` /
`valueCommitAction`. The saved text changes once per edit, at the commit, and
`valueChangeAction` on a text input would read as a per-keystroke prop, which does not exist
(2.1, the commit row; `design/components/text-field.md` 2.1).

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
| urgent, internal (the value a slider gesture has reached, `live`; NumberField's draft text and the value under its held button; TextField's draft text, shown by its input while one is open) | `useState`, written from the pointer or `input` event; no consumer-facing urgent action | sync, urgent | the thumbs, while a pointer is captured or a step or commit is in flight (`held`); otherwise they render `optimistic` (Slider 2.2) |
| urgent, internal (`shown`: the popup is in the top layer) | `useState` in `usePopoverRoot` (Popover, Menu, Combobox, MultiSelect; Dialog has none), written by the Popup from its `toggle` event (read from `:popover-open`, never `newState`), set at mount for a pre-hydration open, cleared when the Popup unmounts; never inside a transition, so neither a pending notification nor an action entangled with it can delay it | sync, urgent | `aria-expanded` on a non-button overlay Trigger render, on the Combobox Input and on MultiSelect's `button[role=combobox]` Trigger (library mode; any other `<button>` Trigger is a `popovertarget` invoker and renders none; MultiSelect's renders it because the `combobox` role requires the state and the button is no invoker before hydration, multi-select.md B.9); `false` on the server and at hydration |

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

#### 3.3.1 An invalid draft is not committed (TextField, NumberField)

The commit controls have a stage the others lack: the **draft**, the text the user is typing,
which is not yet the value. A draft that is invalid when the user commits it (`details.valid`
is `false`, 2.2) does not leave that stage in uncontrolled mode:

```tsx
<TextField
  defaultValue={doc.title}            // saved: "Untitled draft"
  required
  minLength={3}
  valueCommitAction={async (next, details) => {
    if (!details.valid) return;       // "ab": stays in the input as a draft, with its error
    try { await rename(doc.id, next); }
    catch { toast({ title: "Could not rename" }); details.reject(); }  // back to "Untitled draft"
  }}
/>
```

1. **The action still runs**, in the owner's transition, with `data-pending`, with the parsed
   `next` and `valid: false`. `valid` stays information for the consumer.
2. **Nothing is written.** No optimistic value, no uncontrolled value: the control's value
   (`state.value`, the saved one) is unchanged, and it is what a later rollback returns to.
3. **The draft is kept**, exactly as typed, also after a blur. The library does not write the
   text back, so the browser still counts it as the user's edit: `tooShort` and `tooLong`,
   which the platform flags only for text the user typed, keep flagging it, and the Field's
   error stays. It is what a form submission posts (and what the form's validation blocks).
4. **What ends a kept draft**: the user edits it (it is an ordinary draft again); Escape
   (reverts to the saved value, as for any draft); a later commit of valid text (the normal
   commit); a step (NumberField: the draft is its base, as always); a form reset; `disabled`
   or `readOnly` turning on; and a rejection of the invalid dispatch itself (rule 6).
5. **Not dispatched twice.** A commit (blur, the commit key) of a kept draft whose text has not
   changed and which is still invalid dispatches nothing: Enter followed by a blur is one
   request. If it has become valid meanwhile (another field changed, a prop changed) it is a
   normal commit.
6. **Rejection** (a throw, or `details.reject()`, 2.4.1) of the invalid dispatch: the draft is
   dropped, if it is still the text that was dispatched, and the control shows the saved value.
   That keeps item 11 of 2.4.1: a bare `return` keeps the user's text, `return
   details.reject()` discards it. A throw also takes its route of 2.4.
7. **Overlap.** An invalid dispatch is not a state request, so for the *value* it supersedes
   nothing: a valid commit still in flight when it is made commits when it resolves (it is the
   latest request for the value), and its rejection rolls back to the saved value. For
   *errors* it is a dispatch like any other: the latest dispatch's rejection goes to the
   boundary, an older one's to `reportError` (2.4).
8. **Only a typed draft, only `"activate"`.** A `"platform"` dispatch (a form reset, text
   adopted at mount) is a fact the browser performed and is committed as before, valid or not:
   a reset to an empty `required` field makes the empty text the value. NumberField's steps
   (keys, buttons, wheel) have no draft and are committed as before; they are clamped, so only
   a Field's `validate` can make one invalid.
9. **Controlled mode is unchanged.** The draft is cleared at the commit, the optimistic value
   shows during the action, and then the parent's `value` shows: adopted, or the previous one.
10. **No action prop**: the same. An invalid draft stays a draft; nothing observable depends on
    whether an action was passed.

**Why not the other controls.** Checkbox, Switch, RadioGroup, Select, Combobox, MultiSelect,
CheckboxGroup and Slider have no draft: what the user entered is already the control's native
or shown state. An invalid value that resolves is written as before and **stays** (a
`required` checkbox can be unchecked, a `required` select can return to its placeholder, as on
the platform; the error shows; a form does not submit). The rollback of the *next* request then
returns to that state, which is the right one: after "uncheck" (invalid, kept) a failed
"check" must show unchecked, not the saved "checked", and in a set-valued control a rejected
change has always been undone alone (2.5). The problem this rule fixes does not arise there:
their constraints (`required`, a range) do not depend on who wrote the value. OTPField's
`completeAction` writes no state at all.

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
| Examples | Toggle `pressed`, Tabs `value`, Accordion `value` in the JS variant, Collapsible `open` in library mode | Tooltip/Popover `open`, `<details open>` in the static (JS-free) mode of Accordion and Collapsible, `<dialog open>`; the Toast region (`popover="manual"`), which the library shows and hides in both directions, driven by the urgent queue, and never notifies: it has no `openChangeAction` because nothing a consumer could do with "the region opened" exists |
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

**The library's own write is recognised by its source, never by comparing state.** Where a
platform event also fires for a write the library made (`toggle` on a `<details>`, as on a
popover or dialog, 3.9.2), the library records the write and the listener consumes the record;
"the DOM equals committed" or "equals what is intended" is not the test, because the browser
can bring the DOM back to either value by itself while a request is in flight. For
`<details>` the record is the last `open` value the library wrote to or read from the element
(`design/components/accordion.md` 2.3).

- **Find-in-page** revealing `<details>` or `hidden="until-found"`.
- **Mount reconciliation**, one dispatch per component or group: pre-hydration clicks on
  `<summary>` or a native input, and Firefox's form-state restoration of `checked` across
  reloads (react-dom keeps the DOM value when hydrating and fires no `onChange`). Likewise for
  values: text typed into a controlled text input before hydration (Combobox) is adopted at
  mount through the urgent handler with `reason: "platform"`; a value stepped into a native
  range (Slider) through its step + commit dispatch; text typed into a NumberField's visible
  input is parsed and dispatched as a `"platform"` step + commit, or adopted as the draft when
  the input is still focused; text typed into a TextField is dispatched as a `"platform"`
  commit, or adopted as the draft when the input is still focused.
- **Form reset**, both an external `form.reset()` and React's automatic reset after a successful
  `<form action>` (`requestFormReset`), which restores controlled inputs to their mount-time
  default without telling React. Each native-input component listens to `reset` on `input.form`
  through its ref and, after the reset (3.8 rule 5), dispatches the new value with `event` set
  to the `reset` event. What the reset target is, and how it reaches each kind of input (a
  checkable input, a controlled value input, a hidden input, a hidden native input that is not
  the user's surface), is 3.8 rule 6. A component that owns a form value with no visible form
  element of its own **mirrors the optimistic value into a hidden input** and listens to
  `reset` on it (Combobox).
- A form `reset` also **clears the user-validity flag (`:user-invalid`) but not custom
  validity**, so `Field.Root` re-reads its validity mirror and recomputes its custom-validity
  slot after the reset, through the same hook (3.8 rule 5).
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
where the APG pattern allows it; where the pattern wants a focusable disabled control (Tabs,
Accordion, a menu, a Toolbar), the part sets `aria-disabled` instead.

**Inside a Toolbar every library button-like part stays focusable when disabled.** The APG
Toolbar keeps disabled commands in the arrow sequence so that screen-reader users still find
them, and that holds for whatever library part the control is: `Button`, `Toggle`,
`ToggleGroup.Item` (its own `disabled` or the group's), and the overlay Triggers (`Menu.Trigger`,
`Popover.Trigger`, `Dialog.Trigger`, `AlertDialog.Trigger`, `Drawer.Trigger`). Each reads
`ToolbarContext` and passes `alwaysFocusable` to `disabledButton` (1.2): inside a
`Toolbar.Root` a disabled one renders `aria-disabled="true"`, never native `disabled`, with its
click cancelled and its invoker attributes removed. Outside a Toolbar nothing changes: a
standalone `Toggle` or `ToggleGroup.Item` is natively disabled. A consumer's own natively
disabled element inside a Toolbar is the consumer's choice and is not an item (3.10).

**Disabled is not submitted.** A disabled form control contributes nothing to `FormData`, the
HTML rule, whatever element carries its value: a component that submits through hidden inputs
(Combobox, one per value with `multiple`; MultiSelect) renders them `disabled` while the owner
is disabled, by its own prop or by `Field.Root disabled`, as a hidden native input does
(NumberField). A disabled hidden input is still form-associated: it still receives `reset`
and still registers with the Field.

**`readOnly` is the other way to lock a value**: the control stays focusable and is still
submitted. It has its own section, 3.6.1.

However a part is disabled, natively or through `aria-disabled`, it emits `data-disabled` and
never dispatches for user interaction (platform dispatches from the form owner are the
exception, section 2.3 item 7).

**Inherited `disabled`** (an ancestor `<fieldset disabled>`) is a platform
fact that `data-disabled` and `state.disabled` do not see; where a part handles a pointer itself
(a Slider's Track and Thumb, NumberField's Increment / Decrement), the handler also bails when
the part's native control matches `:disabled`, read at the press: pointer events still reach a
styled `span` inside the fieldset and, in Chromium and Firefox, a natively disabled `<button>`
(only `click` is withheld). #180; `design/components/field-form.md` 7.4.

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
`focusableWhenDisabled` (`Button`) joins the composites of 3.10 and the Toolbar as a source of
`aria-disabled` for a consumer-disabled control, as does a `render` element that cannot be natively disabled or whose
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
land on the surface. The surface carries no native constraint of its own. A surface that
cannot hold validity at all (MultiSelect's `button[role=combobox]`) has no mirror: its validity
element is a hidden one-option `<select>` with a computed `required`, whose `invalid` is
cancelled; a submission attempt focuses the surface through the Field's first-invalid
collector, and the message is `Field.Error`'s (`design/components/multi-select.md` B.10).

#### 3.6.1 `readOnly`

**Every form value control takes `readOnly`, and nothing else does.** A form value control is
a component that joins a Field (`design/components/field-form.md` 7.2): TextField,
NumberField, OTPField, Checkbox, Switch, RadioGroup, CheckboxGroup, Select, Combobox,
MultiSelect and Slider. The prop has one meaning everywhere: **the user can reach, read and
submit the value, and cannot change it.**

| | `disabled` | `readOnly` |
| --- | --- | --- |
| Focusable, in the Tab order | no (or `aria-disabled` in a composite) | **yes** |
| Submitted with the form | no | **yes** |
| The user can change the value | no | no |
| Dispatches for user interaction | never | never |
| Constraint validation | barred | barred |
| Follows a form reset | yes | yes |
| Announced as | unavailable | read-only, where the role has the state |

The rules:

1. **The prop is on the value owner**: the Root, or the single element (`TextField`,
   `Checkbox`, `Switch`), and on `Field.Root`, which hands it to its control as it hands
   `disabled` and `required` (the control's `readOnly` is its own or the Field's). **Never on
   an item or an inner part**: `RadioGroup.Item`, `CheckboxGroup.Item` and `Parent`,
   `Select.Option`, `Slider.Thumb`, `Combobox.Input`, `NumberField.Input` and `OTPField.Input`
   keep `readOnly` out of their props types. Read-only is a fact about the value, and the
   owner holds the value; a single choice that cannot be picked is `disabled`. There is no
   inherited `readOnly`: `<fieldset>` has no such attribute, so a group of read-only Fields is
   the prop on each.
2. **Nothing is dispatched for user interaction**: no action, no urgent handler
   (`onInputValueChange`), no optimistic update, no pending state. `readOnly` is read at the
   event, as `disabled` is. What still changes the value is what changes a native read-only
   input: the parent's controlled prop, and a platform dispatch the form owner causes (a form
   reset, 2.3 item 7).
3. **The control stays in the Tab order and keeps every key that does not change the value**:
   Tab, the arrows that move focus between the radios of a group or the chips of a Combobox,
   the caret, selection and copy in a text input. `readOnly` never renders native `disabled`
   or `aria-disabled` on the control itself.
4. **It is submitted.** Native inputs keep their `name` and value; the hidden inputs of
   Combobox and MultiSelect are not `disabled`.
5. **It is barred from constraint validation**, as HTML bars a read-only text input: a value
   the user cannot change must not block a submission. On the text controls the platform does
   it. On the others the library does: the part does not render its native `required`
   (computed ones included: CheckboxGroup's and MultiSelect's "at least one") while read-only,
   and inside a Field the custom-validity slot stays empty, so `validate` and a server error
   never block. `aria-required`, `data-required` and `state.required` stay the prop's, and a
   server error is still **shown** (`data-invalid`, `Field.Error`): the server said it.
6. **A change is refused at its source, by the platform's own means where it has one.** No
   `input` or `change` event fires for a change that did not happen:

   | Control | How the change is refused |
   | --- | --- |
   | TextField, `NumberField.Input`, `OTPField.Input`, `Combobox.Input` | native `readonly` |
   | Checkbox, Switch, `CheckboxGroup.Item` / `Parent`, `RadioGroup.Item` | the part's `onChange`, which React runs inside the native `click`, cancels that click (`preventDefault()`) and dispatches nothing: the browser's cancelled-activation steps put `checked` back and fire neither `input` nor `change`. One path for the mouse, Space, a label and a radio group's arrows, which move focus and check nothing. No new `on*` key is owned (1.5) |
   | Select | every `Select.Option` other than the selected one renders native `disabled`: the picker opens and shows the list, and no pick, arrow or typeahead can leave the current option, in every engine and before hydration. `change` is not cancelable, so there is nothing to cancel |
   | Slider | the pointer handlers of Track and Thumb do nothing, as when disabled; the Thumb's `keydown` cancels the keys that move a range (the arrows, Home, End, Page Up, Page Down) |
   | Combobox, MultiSelect | the popup does not open (rule 8), and the parts of rule 7 are disabled |

   **The fallback** for a native change that arrives with no cancelable event before it (an
   assistive technology's increment action on a range, autofill): the part's change handler
   steps and dispatches nothing, and the controlled value is written back to the element
   before the event ends. The `input` / `change` this leaves behind is not an edit for an
   enclosing Field.
7. **A part whose only job is to change the value is disabled while its owner is read-only**,
   natively, with `data-disabled` and `state.disabled`: NumberField's `Increment` and
   `Decrement`, `Combobox.Trigger`, `Combobox.Clear`, `Combobox.ChipRemove`, and the
   unselected `Select.Option`s of rule 6. These are not the control: focus and the value stay
   where they were.
8. **A popup the library opens does not open while read-only** (Combobox, MultiSelect): the
   control already shows the value, and a list in which nothing can be picked is noise. The
   requests are not made: the Input's and the Trigger's keys and presses do nothing, and
   `aria-expanded` stays `"false"`. When `readOnly` turns on (or the control mounts read-only
   with its popup open), the owner makes a close request (`"dismiss"`), so an uncontrolled popup
   closes and a controlled `open` parent decides through `openChangeAction(false)` as for any
   other request; and a Combobox's edited text goes back to the committed value's text (the
   selection's label, a committed custom value's own text; with `multiple` the search is
   cleared), reported with `"dismiss"`, as TextField and NumberField drop their draft, and again
   when focus leaves while read-only. The closing keys stay live so that a popup a parent keeps
   open can still be closed: Escape is the platform's close watcher (15), and Alt+ArrowUp makes
   a close request without accepting anything. Select's picker is the browser's and has no
   open event (4.1): it opens, and rule 6 makes it inert.
9. **The mark for assistive technology** is the platform's where there is one, else
   `aria-readonly="true"` on the element whose role has the state (ARIA 1.2: `checkbox` and
   `switch`, `combobox`, `listbox`, `radiogroup`, `slider`, `spinbutton`, `textbox`; not
   `radio`, `option`, `button` or `group`):

   | Element | Mark |
   | --- | --- |
   | A text input or textarea (TextField, `NumberField.Input`, `OTPField.Input`, `Combobox.Input`) | native `readonly` only (ARIA in HTML: no `aria-readonly` next to it) |
   | `input[type=checkbox]` (Checkbox, Switch, `CheckboxGroup.Item` and `Parent`) | `aria-readonly="true"`; never the HTML attribute, which does not apply to the type |
   | RadioGroup | `aria-readonly="true"` on the Root (`radiogroup`); nothing on the radios |
   | CheckboxGroup | on each Item and Parent (the Root is a `group`, which has no such state) |
   | `<select>` (`Select.Root`) | `aria-readonly="true"` |
   | `input[type=range]` (each `Slider.Thumb`) | `aria-readonly="true"` |
   | `button[role=combobox]` (`MultiSelect.Trigger`) | `aria-readonly="true"` |

   `aria-readonly` is an owned key of those parts (1.5): absent while not read-only.
10. **Exposure**: `state.readOnly` and `data-readonly` (4.1), on the owner's element and on
    every part that carries the owner's `data-disabled`, `Label` parts included, and on every
    Field part under `Field.Root readOnly`. The attribute is the hook on every control, the
    text controls too: `:read-only` matches every element that is not editable (a checkbox, a
    `<select>`, a `div`), so it tells nothing outside a text input.
11. **`disabled` wins.** A control that is both is disabled: not focusable, not submitted.
    `state.readOnly` and `data-readonly` stay the prop's.
12. **Pending is untouched.** Turning `readOnly` on while an action is in flight cancels
    nothing: the action settles, the optimistic value stays or rolls back, `data-pending`
    leaves as usual; only new interaction is refused. A Slider gesture under way takes no
    further step and commits where it stopped (`design/components/slider.md` 4.1).
13. **Before hydration** the platform's means already hold (native `readonly`, the disabled
    options of a Select). A checkable input or a range can still be changed there, so **mount
    reconciliation of a read-only control writes the rendered value back to the DOM and
    dispatches nothing** (`design/internal-hooks.md` 3.8 rule 10), for every control.
14. **Not form controls, so no `readOnly`**: Toggle, ToggleGroup, Tabs, Accordion, the menu
    items. They submit nothing, and the `button` role has no read-only state: "shown,
    reachable, not changeable" is `disabled` there, which a composite keeps focusable (3.6,
    3.10). `Field.Control` renders native `readonly`: inside a Field the attribute is owned and
    is its own `readOnly` or the Field's (an explicit `false` does not override the Field, as for
    `disabled` and `required`); outside a Field it is ordinary pass-through. The platform
    honours it on text-like inputs and a textarea only, and the part warns in development on any
    other element (a `<select>`, a checkbox: use the library's component).

### 3.7 `keepMounted` on content regions

Content regions whose visibility is driven by library state share one prop: `Tabs.Panel` with
the full shape below, and every overlay `Popup` with a library mode (Dialog, AlertDialog,
Drawer, Popover, Menu, HoverCard, `NavigationMenu.Popup`) with `boolean` only.

```ts
keepMounted?: boolean | "until-found";
```

| Value | Hidden panel is | Notes |
| --- | --- | --- |
| `false` (default) | not rendered | Matches ecosystem expectations; no hidden `<video>` surprises. |
| `true` | rendered inside `<Activity mode="hidden">` | DOM and state preserved, effects torn down, pre-rendered at low priority. The mode change happens inside the library's transition so nested `<ViewTransition>` boundaries get enter/exit. |
| `"until-found"` | rendered with `hidden="until-found"` | Find-in-page and text fragments reveal it; the `beforematch` event dispatches the matching change action. Uses the ref-based upgrade from section 7.4 because react-dom serialises `hidden` as a boolean. Incompatible with `<Activity>` on the same element, hence a separate value rather than a second boolean. |

Tabs defines the semantics. Accordion and Collapsible have no `keepMounted`: their Panel is
always mounted because `<details>` keeps its content in the DOM and reveals it on find-in-page
natively (`design/components/accordion.md` 4.4, `design/components/collapsible.md` 4.3). Future content regions that hide content via library
state reuse the prop, narrowing the type where a value has no meaning: Dialog accepts `boolean`
only, because `"until-found"` cannot apply inside a closed `display: none` dialog.

### 3.8 Native checkable inputs: the shared machinery

Moved to `design/internal-hooks.md`, same number, with its numbered rules ("3.8 rule 1" to
"rule 10"). In one line: the residual browser paths of 3.5 (mount reconciliation, form reset)
dispatch once per state owner with `reason: "platform"`, through shared hooks, and a form
control joins a Field through `useFieldControl`.

### 3.9 Overlay open state: requests and facts

Moved to `design/overlay-open-state.md`, same numbers (3.9.1 to 3.9.13). In one line: an
overlay Root's `open` has two channels, requests through `openChangeAction` (a transition,
awaited, can be refused) and facts through `onOpenChange` (a dismissal the browser performed:
adopted urgently, never pending, superseding every request in flight).

### 3.10 Arrow keys between items

One set of rules for every component in which arrow keys move focus between items the library
knows (Tabs, Accordion, Toolbar, a standalone ToggleGroup, Menubar, a menu's items). The
roving engine (`internal/use-roving-focus.ts`) implements them for the components built on it;
Tabs and Accordion, which keep their own handler, follow the same rules through the same
helpers in `internal/arrow-keys.ts`.

1. **Which keys.** The arrows of the component's orientation, mirrored for a horizontal one
   under `rtl` (`resolveArrowKey`, 14.1), plus Home and End.
2. **A key with a modifier is the browser's.** The handler returns without acting when the
   event is `defaultPrevented` or has Alt, Ctrl or Meta held (`isPlainKey(event)`, next to
   `resolveArrowKey`): Ctrl+Home scrolls the page, Alt+ArrowLeft goes back, and a consumer's own
   `onKeyDown` on an item opts out with `preventDefault()`. Shift is not a modifier for this
   rule.
3. **An `aria-disabled` item is in the sequence.** Arrows, Home and End reach it like any
   other item, so a keyboard or screen-reader user finds it and hears "unavailable"; it never
   dispatches. Home goes to the first item and End to the last, disabled or not. A **natively
   disabled** element is not an item at all: it cannot hold focus.
4. **`loop`.** Every such component takes `loop?: boolean`, default `true`: at an end the
   arrow wraps to the other end; with `loop={false}` it stops. The prop is on the Root
   (`Tabs.Root`, `Accordion.Root`, `Toolbar.Root`, `ToggleGroup.Root`, `Menu.Root`; `Menubar`),
   as it is for a listbox's virtual focus (`Combobox.Root`, `MultiSelect.Root`).
5. **Focus moves with the focus ring.** The handler focuses through `focusWithRing`, so a
   keyboard move shows `:focus-visible` in every engine.
6. **`orientation`** is a prop only where the component has two (Tabs, Toolbar, ToggleGroup).
   A component with one orientation (Accordion: vertical; Menubar: horizontal) has no prop.
   Where the role has `aria-orientation` and the element is the keys' owner, the part renders
   it together with `data-orientation`, also for a fixed orientation (Menubar renders
   `aria-orientation="horizontal"`), so a stylesheet has one hook for every composite.

---

## 4. Pending and state exposure

### 4.1 One vocabulary, three forms

A state has one name. It appears as `data-<name>` on the element, as `state.<name>` in the
function props and `render`, and under that name in docs. No `is` prefix (`pressed`, not
`isPressed`), matching the prop names.

**The forms agree, part by part.**

1. **An attribute implies a state field.** Every `data-<name>` a part emits has a member of
   the same name in that part's `State`, with the same value: `data-invalid` and
   `state.invalid`, `data-empty` and `state.empty`, `data-side="top"` and
   `state.side === "top"`. Whatever a stylesheet can select, `className={(state) => …}` can
   read. The recorded exceptions are DOM writes with no React state behind them:
   `data-swiping` and `data-instant` (attribute only, in the table), and an overlay Trigger's
   `data-open` in JS-free mode (rule 3).
2. **A state field implies an attribute, where a stylesheet would select on it.** A boolean
   or enum member of a part's `State` is emitted as `data-<name>` on that part's element. Not
   required for: a member that is neither (`value`, `values`, `char`, `query`, `toast`); a part
   that renders no element (a Root without DOM shows its state through `children(state)` only);
   and a fact the component's **native control** already carries, which a stylesheet reaches
   with a pseudo-class on the control or `:has()` from a wrapper: `required` (`:required`) has
   no attribute on a component whose control is a native input or a group of them. A control
   with no such element emits `data-required` (`MultiSelect.Trigger`), as the Field parts do.
   `readOnly` is not such a fact: `:read-only` matches every element that is not editable, so
   every control emits `data-readonly`, the text controls included (3.6.1 rule 10).
3. **In JS-free mode `state.open` is `false`.** Where the browser owns an open state and React
   holds no value for it (Accordion and Collapsible without their state props; the JS-free
   mode of Popover, Dialog, AlertDialog, Drawer and `NavigationMenu.Item`, 3.9.11), every
   part's `state.open` is `false`, and the type is `boolean`, never `boolean | undefined`: the
   function props describe what React knows, which is the server-rendered closed state. The
   truth is the platform's (`:open`, `:popover-open`). An **overlay** Trigger's `data-open` is
   kept current there by a DOM write from the `toggle` event of its popup or `<dialog>` (7.4),
   in every overlay with a JS-free mode: that attribute is the one styling hook that works in
   both modes, the state field is not, and each such Trigger's docs row says so. A `<summary>`
   Trigger (Accordion, Collapsible) renders no `data-open` in JS-free mode and needs none: it
   is a child of the `<details>` the browser opens, so `details[open] > summary` selects it.
4. **A `Label` part carries its owner's `data-disabled` and `data-readonly`, and `data-pending`
   where the owner has one**, with the matching state fields, so a label can be dimmed or show progress without a
   wrapper selector. A `<legend>` Label (RadioGroup, CheckboxGroup) is the exception: it sits
   inside the `<fieldset>` that carries them, and CSS reaches it from there.
5. **`state.invalid` and `state.required` exist wherever the fact does.** Every control part
   that renders `data-invalid` inside a `Field.Root` has `state.invalid` (`false` outside a
   Field). Every part that takes or inherits `required` has `state.required` (its own prop or
   the Field's).

**This table fixes each name and its meaning.** It names a part only where the meaning is
specific to that part. Which parts emit an attribute is listed in each component's design doc
(the anatomy table) and on its docs page; a new emitter of an existing name needs no change
here, a new name or a new meaning does.

| Name | Kind | Meaning |
| --- | --- | --- |
| `pending` | boolean | An action dispatched through this part's owner is in flight, including the Suspense wait of the resulting render. Which parts carry it is 4.3. For a toast: the promise given to `toast.promise` is unsettled, or an action dispatched through its `Action` part runs; not set while the toast's content is merely suspended. For a form-channel part (every Field part, `Form.Root`, `Form.Submit`): the enclosing form's submission (`useFormStatus`, 2.7). |
| `disabled` | boolean | Disabled by prop or inherited from the owner; not by an ancestor `<fieldset disabled>` (3.6). Also a step button whose next step would change nothing (NumberField's `Increment` / `Decrement` at a bound), and a part whose only job is to change the value while its owner is read-only (3.6.1 rule 7: those two, `Combobox.Trigger`, `Clear` and `ChipRemove`, an unselected `Select.Option`). Emitted in **every mode** in which the part renders `disabled` or `aria-disabled` (the JS-free Triggers included), so the styling hook and the ARIA state never disagree. |
| `pressed` | boolean | Optimistic pressed state of a toggle button. |
| `selected` | boolean | This part is, or belongs to, the selected choice: optimistic on the element the user picks (a Tab; an option, with `aria-selected`; on a native `<option>` identical to `:checked`, since the `<select>` renders `value={optimistic}`) and on `Tabs.Indicator` (a tab is selected); committed on a content region (`Tabs.Panel`). Never "the owner has a value", which is `:not([data-empty])`. Radio-like and checkbox-like parts use `checked`. |
| `checked` | boolean | Optimistic checked state, the platform's word for a checkbox, a switch, a radio (not `selected`) and a menu's checkable items (there as `aria-checked` on a `button`). On a native input the DOM holds the optimistic value (3.2), so `:checked` matches it, with the caveats in 4.2. |
| `indeterminate` | boolean | Mixed state. On `Checkbox` it is a controlled-only prop ("consumer-owned, mirrored", 3.5; never Switch), emitted from render because the DOM property cannot be server-rendered and `aria-checked` is forbidden on native inputs: the attribute is what lets CSS draw the dash before hydration. The property is set through the ref and re-applied after every commit; it is **suspended while an action is pending** (`state.indeterminate = indeterminate && !pending`) so the attribute, the DOM property and `:indeterminate` agree in every phase. On `CheckboxGroup.Parent` the value is **library-derived** from the group's optimistic set (`some && !all`) and is not suspended. On Progress: `value` is `null` (derived, never suspended). |
| `open` | boolean | Disclosure and open state, in the platform's word (`<details open>`, `:open`, `ToggleEvent.newState`); `expanded` is not used. **Optimistic on the part the user acts on** (a Trigger, an Accordion `Item`, a Collapsible `Root`, `NavigationMenu.Item`, the Combobox `Input`), where it is the attribute to style. **Not emitted on the element the browser opens**: a Popup, a `<dialog>`, a `<details>` Panel are styled with `:popover-open` / `:open`, which are exact and written by the same commit (7.4); their `state.open` is the committed value. Tooltip, whose open state is purely browser-owned, and `Select.Root`, whose picker has no open event, emit none and have no `state.open`. In JS-free mode: rule 3. ARIA is separate: a `<button>` Trigger is a `popovertarget` invoker and renders **no `aria-expanded`**; a non-button `render` and the Combobox `Input` render it from the Root's urgent `shown` mirror (3.2). |
| `empty` | boolean | **The part's collection or value is empty**, the one word for it. A listbox (`Combobox.List`, `MultiSelect.List`): no mounted options, not stale and not loading, the condition under which `Empty` renders. A part that shows or holds the owner's value: nothing is selected (`MultiSelect.Value`, which shows its `placeholder` then; `Combobox.Input`: the optimistic value is `null`, or has no entries with `multiple`; `Combobox.Chips`: no chips). `Toast.Viewport`: no toasts in the queue, the `ending` ones kept mounted included (the region is hidden under it), so a layout can collapse the reserved space. There is no `data-placeholder` and no attribute for the inverse: "has a value" is `:not([data-empty])`. |
| `active` | boolean | Urgent (3.2), never a transition. Two recorded meanings: **virtual focus** in a listbox (`Combobox.Option`, `MultiSelect.Option`: `aria-activedescendant` points here), and **the caret is here** (`OTPField.Slot`: the input is focused and its caret, or part of its selection, is at this slot's position; the last slot for a caret at the end of a complete code). Not `:active` (4.2). |
| `filled` | boolean | A character is at this position of a code (`OTPField.Slot`, `state.char !== null`). |
| `complete` | boolean | The value reached its end: Progress, the clamped value reached `max`; OTPField, the text has `length` characters. |
| `stale` | boolean | The results shown are for an older text (`inputValue !== useDeferredValue(inputValue)`); the previous results stay visible meanwhile (Combobox `Popup`, `List`, `Input`). The listbox also has `aria-busy="true"` while stale **or loading** (a `Status` mounted inside the List); loading itself is not a data attribute. |
| `invalid` | boolean | An error is shown for the field: the control matches `:user-invalid`, or a server error for it is shown (Field 2.2). On every Field part and on every control part inside a `Field.Root` (rule 5); the control also carries an explicit `aria-invalid="true" \| "false"`. |
| `required` | boolean | `Field.Root required` or the control's own `required`. As an attribute: on every Field part, and on a control with no native element to carry `:required` (rule 2). |
| `readOnly` | boolean | The owner's `readOnly` prop or its Field's: the value is shown, focusable and submitted, and the user cannot change it (3.6.1). The attribute is **`data-readonly`**, in HTML's lower case, the one name whose two forms differ in case. On every form value control and its parts (3.6.1 rule 10) and on every Field part. A prop echo: also set while `disabled`. |
| `modal` | boolean | The Root's `modal` prop of a Dialog (default `true`), on its Popup: the dialog is opened with `showModal()` (library mode) or the invoker's `show-modal` command (JS-free). **A prop echo**, not a state: rendered in every mode, server HTML included, so a stylesheet can lay out a non-modal panel (`.dialog:not([data-modal])`) before hydration and while closed, where `:modal` is false either way. |
| `orientation` | `"horizontal" \| "vertical"` | The axis of a composite or a line, on the part that owns it and on each part laid out along it (3.10 rule 6). A `ToggleGroup` inside a Toolbar reports the Toolbar's; a `Toolbar.Separator` its own, perpendicular to the toolbar's. Enum attribute with value. |
| `decorative` | boolean | `Separator`'s `decorative` prop: a line with `role="none"`, not a thematic break. A prop echo. |
| `index` | number (stringified) | The part's `index` prop: which entry of the value array a `Slider.Thumb` edits (default `0`), which character position an `OTPField.Slot` shows (required). A consumer-chosen number, so a stylesheet can address a part by position (`[data-index="1"]`). |
| `dragging` | boolean | A pointer is captured on a thumb of this Slider (urgent state; keyboard never sets it), on every Slider part whose state has it and on the captured `Thumb`. Style motion off under it (`[data-dragging] { transition: none }`). |
| `swiping` | boolean | A pointer is dragging a Drawer toward its edge (from the drag's start to its release or abort), while `--drawer-swipe-x` / `-y` / `-progress` follow it. **Attribute only, no `state.swiping`**: a DOM write from the gesture's listeners in both modes (JS-free mode has no React state for it, and a render per gesture buys nothing), never server-rendered (`design/components/drawer.md` 4.3). Style motion off under it. |
| `instant` | boolean | A Tooltip shown by an open that began while another `[role="tooltip"]:popover-open` existed in the document (the skip-delay condition, `design/components/tooltip.md` 6), so a stylesheet can skip the entry animation of a warm open and keep a cold one's. **Attribute only, no `state.instant`**: browser-owned, like the open state it qualifies, written by a DOM write from the popup's synchronous `beforetoggle` on both paths and removed at the close's (7.4). Never server-rendered. |
| `context` | boolean | The current open of a `Menu.Popup` came from a `Menu.ContextTrigger` and the popup is placed at a point: `--menu-point-x` / `--menu-point-y` are set inline and `data-side` / `data-align` are absent. Written urgently with the placement (geometry, not a dispatch): present from the point open's request until the popup is hidden and its exit is over (`design/components/context-menu.md` 3.1). |
| `submenu` | boolean | This `Menu.Popup` belongs to a nested Root (a submenu), so a stylesheet can tell it from the top-level menu. |
| `side` | `"top" \| "bottom" \| "left" \| "right"` while shown; the requested `side` (which may be `"inline-start"` / `"inline-end"`) otherwise | On an anchored Popup (and `Tooltip.Arrow`): **the resolved side** (section 13). While the popup is shown, the side of the anchor the browser actually placed it on, read from the computed `position-area` after `position-try-fallbacks` chose an option, so it changes after a flip (on open, on scroll, on resize); on the server, while closed, and when the computed value cannot be read (a vertical writing mode, a consumer `position-area` the parser does not know), the value of the `side` prop. Absent with `side={null}` and on a point-placed menu (`context`). Written urgently (geometry, observed; 3.5). |
| `side` | `"top" \| "bottom" \| "left" \| "right" \| "inline-start" \| "inline-end"` | On `Drawer.Popup`: **a prop echo**, not a resolved side: the `side` prop (default `"bottom"`), the edge the drawer is attached to and swipes toward. Rendered in every mode, server HTML included; nothing flips a drawer and the library places nothing (`design/components/drawer.md` 2). |
| `align` | `"start" \| "center" \| "end"` | On an anchored Popup: the resolved alignment along that side, same rules. `start` / `end` are **inline-relative** on a top / bottom side (`start`: the popup's inline-start edge meets the anchor's; mirrored under `direction: rtl`) and block-relative on a left / right / inline side (`start`: top edges meet). |
| `region` | `"optimum" \| "suboptimum" \| "even-less-good"` | HTML's meter region for a Meter's value against `low` / `high` / `optimum`, the platform's words. |
| `status` | `"idle" \| "loading" \| "loaded" \| "error"` | The load state of an Avatar's image, an urgent mirror (2.6): `"idle"` until an image with a source reports (the server render and the hydration render too), `"loading"` while it is not complete, `"loaded"` once available, `"error"` when its current source failed (`design/components/avatar.md` 4). |
| `type` | string | A toast's consumer-defined `type` (`"error"`, `"success"`, …), an enum whose vocabulary is the consumer's. |
| `priority` | `"normal" \| "high"` | A toast's `priority`, which also decides its role (`alertdialog` when `"high"`). |
| `ending` | boolean | A toast that is closed and kept mounted (and `inert`) until the animations the ending state started finish (`exitAnimations` filtered by a baseline of the animations already running before the close, Toast 10.2; a paused progress bar does not hold the exit); CSS animates on it. |
| `paused` | boolean | A viewport-wide timer pause holds on the Toast `Viewport` (pointer over the region, focus inside, hidden document, blurred window), so a visual progress indicator can pause with the real timer. |

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
| `:user-invalid`, `:required` | `data-invalid` on the control and the Field parts inside a `Field.Root`; `data-required` on the Field parts | On a bare control: platform only (`state.invalid` is `false`). Inside a `Field.Root` the control and the Field parts emit `data-invalid` (which also covers server errors, where no pseudo-class exists) and the Field parts `data-required`; `:user-invalid` / `:user-valid` on the control and `:has(:user-invalid)` on the Root remain the zero-JS, pre-hydration styling hooks for the native half. |

The data attributes are still emitted, because sibling or wrapper parts (an `Indicator`, a label
Root) cannot use `:checked` on themselves; `:has(:checked)` on a wrapper is the zero-JS
alternative.

### 4.3 Where `data-pending` lands

- The **owner** (`Root`, or the single component): while its transition is pending. When the
  owner renders no element (Dialog's Root), `pending` is exposed through its `children` function
  and on the trigger part only. An owner that is not a Root follows the same rule:
  `NavigationMenu.Item` renders `data-open` (optimistic) and `data-pending` on its `li` in
  library mode, as `Accordion.Item` does.
- A **`Label`** part carries the owner's `data-pending` (4.1 rule 4).
- The **trigger the user acted on**: while the owner is pending and this trigger is the optimistic
  target (for Tabs: `optimistic === tab.value`; for Toggle: always the element).
- **A part that asks the owner for a change and is not its trigger** (an overlay's Close
  part: `Dialog.Close`, `Popover.Close`, `Drawer.Close`, `AlertDialog.Cancel`,
  `AlertDialog.Action`; a closing `Menu.Item`): from the activation until the close it asked
  for has committed, with or without an `action` of its own. The part is the element the user
  acted on, and the Trigger, which shows the owner's `data-pending`, may be out of sight
  (under a modal dialog's backdrop). Mechanism: every activation runs in the part's own
  transition (`useActionTrigger`, 3.4) and the Root's request is made inside it, so the part's
  `pending` covers its `action`, the Root's awaited `openChangeAction(false)`, and any pending
  async action the close is entangled with (2.3 item 5: a Cancel clicked while a confirm
  runs). A Close part without `action`, and a closing `Menu.Item` without `action`, makes
  the request synchronously in the click, so
  `openChangeAction`'s synchronous prefix still runs during the event dispatch (2.3 item 3). A
  close that ends up not happening (a controlled parent that does not adopt it, a fact that
  superseded it, 3.9.5) ends the part's `pending` when the request settles. JS-free mode
  without `action` has no pending state: the browser closes at once.
- **Panels** do not get `data-pending`; a panel is either committed-visible or not, and an
  overlay's Popup is a panel: a stylesheet that wants the whole popup to react selects on
  the part inside it (`.dialog:has([data-pending])`). Consumers who
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

Every part whose mount, unmount or content is driven by **committed** library state (a Panel,
a library-driven Popup) renders
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
2. **A part whose rendered state is all optimistic.** Nothing in it mounts from library
   state, and the flip lands in a sync render, so the settle commit shows nothing a boundary
   could animate. This is one rule, for value controls and triggers alike: the triggers of a
   content region (`Tabs.Tab`, `Accordion.Trigger`, `Collapsible.Trigger`; the Panel next to
   them, and the `<details>` of `Accordion.Item` and `Collapsible.Root`, render committed
   state and have the prop); the checkables (`Toggle`,
   `Checkbox`, `Switch`, `RadioGroup.Item`, `CheckboxGroup.Item` and `Parent`,
   `ToggleGroup.Item`); Menu's items (their `aria-checked` lands in a sync render); every Select
   part (the picker is a UA pseudo-element, `<selectedcontent>` is written by the browser);
   the options of a listbox (`Combobox.Option`, `MultiSelect.Option`); every Slider,
   NumberField, TextField and OTPField part (the value is urgent or optimistic; a Slider's
   rollback animates with a CSS transition on a registered custom property). Such a component
   still **emits its transition types** (5.3), so a consumer who wants the settle of one to
   animate something wraps that content in their own `<ViewTransition>` keyed on the type.
3. **Every commit on the urgent lane by design** (Toast, 2.6; Field and Form, whose state is an
   urgent mirror of browser-owned validity and whose own commits display nothing; Avatar, whose
   status is an urgent mirror of its image's load state): react-dom
   never starts a view transition for an urgent commit, so a boundary could animate nothing and
   would still pay the page cross-fade when the part mounted inside another component's
   transition commit. CSS: `@starting-style`, `data-ending`; `Field.Error` enters with
   `@starting-style`.
4. **A consumer-owned value with no library state or dispatch** (Progress, Meter): its changes
   arrive in the consumer's lane (usually urgent, 2.6) and animate through a CSS transition on
   a registered custom property.

`Button` keeps `transition`: it renders no optimistic state at all. Its only state is
`pending`, which is the transition's own, and content keyed on it changes in the commit that
ends the action. A part without the prop renders no boundary, so the prop costs nothing for
consumers who do not set it.

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
| Optimistic state (a checkable, `Tabs.Tab`, `Accordion.Trigger`, `Collapsible.Trigger`, `Tabs.Indicator`): no `transition` prop | CSS `transition` on the data attribute or on the anchored insets (`[data-pressed]`, `[data-selected]`, `position-anchor` following the optimistic tab) | The flip lands in a sync-lane commit; `<ViewTransition>` never fires for it, on click or on rollback. |
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
`fsui-<component>-<change>`.

**One change name per meaning.** The kind is derived from the name of the state that changed,
never from a synonym:

| State or event | Kinds | Used by |
| --- | --- | --- |
| `open` | `open` / `close` | every open state: the overlays, Collapsible, and Accordion (per item: `open` when `details.added` is non-empty, `close` when `details.removed` is) |
| `checked` | `check` / `uncheck` | Checkbox, Switch, CheckboxGroup, `Menu.CheckboxItem` |
| `pressed` | `press` / `release` | Toggle, ToggleGroup |
| a selection among options (`value`) | `select` / `deselect` | where the component has another dispatch to tell it from, or the value is a set: `Menu.RadioGroup`, Combobox, MultiSelect. A component whose only dispatch is a single selection has no kind (RadioGroup, Select) |
| a position among siblings | `next` / `prev` | Tabs |
| the step and the commit of a continuous or text control | `change` / `commit` | Slider, NumberField; TextField (commit only) |
| a pure trigger named after its event | the event | `complete` (OTPField) |

A set-valued dispatch carries one kind per non-empty side of its diff (`details.added`,
`details.removed`), so a reset or an exclusive switch may carry both.

Every component has a row:

| Component | Types |
| --- | --- |
| Button | none (`useActionTrigger`; `transition` animates the commit that ends the action) |
| Toggle | `fsui-toggle`, `fsui-toggle-press`, `fsui-toggle-release` |
| ToggleGroup | `fsui-toggle-group`, `fsui-toggle-group-press` (when `details.added` is non-empty), `fsui-toggle-group-release` (when `details.removed` is non-empty; an exclusive switch carries both) |
| Toolbar | none (no state) |
| Separator | none (no state) |
| Tabs | `fsui-tabs`, `fsui-tabs-next`, `fsui-tabs-prev` (by DOM order of the target tab relative to the committed tab) |
| Accordion | `fsui-accordion`, `fsui-accordion-open` (when `details.added` is non-empty), `fsui-accordion-close` (when `details.removed` is non-empty; an exclusive switch carries both) |
| Collapsible | `fsui-collapsible`, `fsui-collapsible-open`, `fsui-collapsible-close` |
| Switch | `fsui-switch`, `fsui-switch-check`, `fsui-switch-uncheck` |
| Checkbox | `fsui-checkbox`, `fsui-checkbox-check`, `fsui-checkbox-uncheck` |
| CheckboxGroup | `fsui-checkbox-group`, `fsui-checkbox-group-check` (when `details.added` is non-empty), `fsui-checkbox-group-uncheck` (when `details.removed` is non-empty; a reset may carry both) |
| RadioGroup | `fsui-radio-group` (no kind) |
| Select | `fsui-select` (no kind) |
| Combobox | `fsui-combobox`, `fsui-combobox-open`, `fsui-combobox-close` (Root open state); `fsui-combobox-select` (every value dispatch; with `multiple` only when `details.added` is non-empty) and, with `multiple`, `fsui-combobox-deselect` (when `details.removed` is non-empty) |
| MultiSelect | `fsui-multi-select`, `fsui-multi-select-open`, `fsui-multi-select-close` (Root open state); `fsui-multi-select-select` (a value dispatch whose `details.added` is non-empty), `fsui-multi-select-deselect` (`details.removed` non-empty; a reset may carry both) |
| Slider | `fsui-slider`, `fsui-slider-change` (each step), `fsui-slider-commit` (each gesture's commit) |
| NumberField | `fsui-number-field`, `fsui-number-field-change` (each step), `fsui-number-field-commit` (each gesture's commit) |
| TextField | `fsui-text-field`, `fsui-text-field-commit` (each `valueCommitAction` run) |
| OTPField | `fsui-otp-field`, `fsui-otp-field-complete` (each `completeAction` run) |
| Field, Form | none (an urgent validity mirror and a form whose own commits display nothing, section 5.1) |
| Dialog | `fsui-dialog`, `fsui-dialog-open`, `fsui-dialog-close` |
| AlertDialog | Dialog's: `fsui-dialog`, `fsui-dialog-open`, `fsui-dialog-close` (no types of its own, so one stylesheet styles both; `alert-dialog.md` 8) |
| Drawer | `fsui-drawer`, `fsui-drawer-open`, `fsui-drawer-close` (its own, not Dialog's: a drawer slides where a dialog fades; a swipe is a fact and carries none; `drawer.md` decision 14) |
| Popover | `fsui-popover`, `fsui-popover-open`, `fsui-popover-close` |
| HoverCard | `fsui-hover-card`, `fsui-hover-card-open`, `fsui-hover-card-close` (the close is only the cancel of a pending open; every close of a shown card is a fact) |
| Tooltip | none (browser-owned open state, no dispatch, section 5.1) |
| Menu | `fsui-menu`, `fsui-menu-open`, `fsui-menu-close` (Root); `fsui-menu-check` / `fsui-menu-uncheck` (CheckboxItem); `fsui-menu-select` (RadioGroup) |
| Menubar | none of its own (each menu emits Menu's) |
| NavigationMenu | `fsui-navigation-menu`, `fsui-navigation-menu-open`, `fsui-navigation-menu-close` (per `Item`, library mode: the Trigger and a followed Link; dismissals, the focus-leave close of a shown panel included, are facts and carry none) |
| Toast | none (every commit is urgent, section 5.1) |
| Progress, Meter | none (a consumer-owned value in the consumer's lane, section 5.1) |
| Avatar | none (the status is an urgent mirror, 2.6; a consumer `<ViewTransition>` around it gets react-dom's commit wait for the image, `design/components/avatar.md` 5) |

A component that emits types and has no `transition` prop on any part (the all-optimistic
parts of 5.1) emits them for consumers' own boundaries.

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
a component that does this says so in its design doc. The standalone `Separator`
(`separator/separator.tsx`) is the third directive-free component file and needs no exception:
it reads no context and imports no client module. `NavigationMenu.Root` and `NavigationMenu.List`
(`navigation-menu/navigation-menu-root.tsx`, `navigation-menu-list.tsx`) are directive-free the same
way. Pure modules are
directive-free: arithmetic and formatting (`slider/slider-arithmetic.ts`; NumberField's
`number-field-format.ts`, `number-field-arithmetic.ts` and `internal/decimal.ts`), pure
DOM reads, prop builders and listener installers (`internal/overlay/popover-open.ts`, `dom-order.ts`,
`arrow-keys.ts`, `render-element.ts`, `value-set.ts`, `shipped-styles.ts`; `menu/menu-dom.ts`,
`menu-hover.ts`, `menu-gestures.ts`, `menu-outside.ts`, `menu-point.ts`) and the Toast
Viewport's queue, hotkey and timer models (`toast/toast-queue.ts`, `toast-hotkey.ts`,
`toast-timers.ts`); `directives.test.ts` lists them. A context shared
by **several component folders** lives in `internal/` (`internal/form/field-context.ts`, read by the
Field parts, `Form.Root` and `useFieldControl` from every form control's folder; `internal/toolbar-context.ts`, read by
`ToggleGroup.Root`, `Toolbar.Separator` and `Menu.Trigger` to find an enclosing Toolbar;
`internal/menubar-context.ts`, provided by `Menubar` and read by `Menu.Trigger` and `Menu.Popup`); the one-way
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
every component's `src/<component>/index.ts`, `src/csp/index.ts`, the types entry (9.2) and the skill-installer bin
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
- **Collapsible**: as Accordion. All three parts are client modules (the Trigger and Panel read
  the Root's context); JS-free mode (none of `open`, `defaultOpen`, `openChangeAction`) runs no
  behaviour JS and works before and without hydration (`design/components/collapsible.md` 2.1).
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

**A closing part with an action is no native invoker** (#182). A part that runs a consumer
`action` and then closes its popup (`Dialog.Close`, `Popover.Close`, `Drawer.Close`,
`AlertDialog.Cancel` and `AlertDialog.Action` with `action`) renders no `commandfor` / `command` (and no
`popovertarget`): before hydration a native command would close the popup **without running
the action**, which reads as if the work had been done. Such a part is a plain
`<button type="button">` until hydration (a click does nothing) and its click handler is the
only thing that closes it, in both modes. The same part without `action` keeps the native
command, as there is nothing to skip. The JS-free way to run work and close is a form
(`Dialog.Form` / `AlertDialog.Form` with a Server Function). Parts that close with an action but
render no native command anyway (`Menu.Item`, `Toast.Action`) are not affected: they need
hydration in every case.

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
| Attribute or element untyped in `@types/react` (`command`, `commandfor`, `interestfor`, `focusgroup`, `switch`; the `selectedcontent` element) | One module augmentation module, `src/internal/platform-attributes.ts` (`declare module "react" { ... }` plus `export {}` so it is a module), augmenting `React.HTMLAttributes` / `ButtonHTMLAttributes` / `AnchorHTMLAttributes` with the typed values from the research docs, and `JSX.IntrinsicElements` with `selectedcontent`. It is imported **for side effects** (`import "./internal/platform-attributes.js"`) from the package entry and from **every** component's subpath `index.ts` (a component that uses none of the attributes included, so the rule needs no judgement), so each public entry carries it. tsdown emits `dist/internal/platform-attributes.d.mts` and an `import` of it in each entry's `.d.mts`, with no runtime import in the JS. A `.d.ts` source would not work: it is typecheck-only and never reaches `dist`. Each entry carries a comment with the DefinitelyTyped issue so it can be deleted when upstream lands. `popoverTarget` / `popoverTargetAction` are typed upstream, so the overlay Triggers are not in this row; `command` / `commandfor` are in it for `Popover.Close`, the Dialog parts and consumers' `Button`s. |
| Attribute react-dom serialises wrongly (`hidden="until-found"` becomes `hidden=""` on both client and server) | Render the boolean form so SSR output is correct, then upgrade in a layout effect through the part's ref (`el.setAttribute("hidden", "until-found")`), and listen to the platform event that the browser uses to undo it (`beforematch`) to dispatch the matching change action. Encapsulate each such case in one internal hook (`use-until-found.ts`) so the workaround has exactly one home. |
| Attribute that must act on the client but must not be in the server HTML (Combobox Trigger's and MultiSelect Trigger's `popovertarget`: the invoker relationship exempts its press from light dismiss, but a pre-hydration activation would open an empty, button-anchored popup) | Not rendered; written with `setAttribute` from the part's ref callback once the element is known to be a `<button>` (removed in the cleanup), so hydration never sees it and the click handler that cancels the activation is installed before the attribute exists. The key is still owned (omitted from the props type). Named in the component design (section 3.5 lists the parts that use it). |
| Event React does not synthesize (`command`, `interest`, `loseinterest`, `beforematch`, `scrollsnapchange`) | `addEventListener` through the part's ref (or a Fragment ref for sibling groups), inside an effect that uses `useEffectEvent` for the handler body, dispatching into the component's transition like any other interaction. Never expose these as `on*` props (section 2.6: `on*` is reserved for the urgent lane, and these are interactions, not an urgent state). |
| Event React does synthesize, but the handler must be feature-detected away (Tooltip's `pointerenter` / `focus` when `interestfor` is native) | Same `addEventListener`-in-effect pattern: the effect subscribes only when the JS path is needed, so markup is identical on server and client. Because no prop-form handler is installed, none is omitted from the part's type and the consumer's `on*` props pass through (section 1.5). |
| Element whose children the **parser writes before hydration** (`<selectedcontent>`: Chromium and Safari clone the selected option's children into it at parse time, so a plain element fails hydration and client-renders the whole root) | Render it with `suppressHydrationWarning` and `dangerouslySetInnerHTML={{ __html: "" }}`, so React treats the children as opaque and the attribute mismatch is silenced (verified in `docs/research/select-combobox.md` §4: hydrates with no recoverable error, later browser writes keep working); the part has no `children` prop. One such element per component at most, named in its design doc (`Select.Value`). |
| Pseudo-class the platform already provides (`:open`, `:popover-open`, `:disabled`) | Document it next to the equivalent data attribute; do not emit a duplicate attribute when the pseudo-class carries the same meaning and the state is browser-owned. |
| Styling state for a browser-owned open that a static part cannot render (`data-open` on a Trigger in JS-free mode, where no React state exists: Popover, `NavigationMenu.Trigger`, and the Dialog, AlertDialog and Drawer Triggers) | Keep it current with a DOM write from the platform event through the ref (the popup's or the `<dialog>`'s `toggle`, reading `:popover-open` / `dialog.open`), never React state. **Every Trigger with a JS-free mode does this**, so `[data-open]` on a Trigger is the styling hook in both modes of every overlay; `state.open` stays `false` there (4.1 rule 3). The attribute is owned and React renders no value for it in that mode, so the DOM write is never overwritten. A page that never hydrates has `:has(+ :popover-open)` / `:has(+ :open)` instead, shown on the docs page. One attribute per component at most, named in its design doc. |
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
   <Tabs.List experimental_focusGroup>...</Tabs.List>
   <Accordion.Root experimental_interpolateSize>...</Accordion.Root>
   ```

   The prefix follows React's own naming for unstable APIs. **After the prefix the name is
   camelCase, as React would spell the prop**, whatever the casing of the HTML attribute or CSS
   property behind it: `experimental_focusGroup` (`focusgroup`), `experimental_interestFor`
   (`interestfor`), `experimental_closedBy` (`closedby`), `experimental_interpolateSize`
   (`interpolate-size`), `experimental_webOTP`. It is greppable, visible at the call
   site where the browser-support decision is made, typed, and tree-shakeable. When the feature
   reaches all engines the prop is removed and the behaviour becomes default; the removal is a type
   error that tells every consumer exactly where to delete it.

   First customers, per the research docs:

   | Feature | Missing in | Likely prop | Effect when on |
   | --- | --- | --- | --- |
   | `popover="hint"` | Safari 27.0 (TP only) | `Tooltip.Popup experimental_hint`, `HoverCard.Popup experimental_hint` | Popup renders `popover="hint"` instead of the baseline type plus JS Escape/outside-click handling (HoverCard keeps its own Escape and outside-press listeners next to the native ones). |
   | `interestfor` | Gecko, WebKit | `Tooltip.Trigger experimental_interestFor`, `HoverCard.Trigger experimental_interestFor` (written through the ref after hydration; the browser supplies the interest signal, the library still owns the open, Escape and a press outside) | Trigger renders `interestfor`; JS hover/focus handlers are skipped where the browser supports it. |
   | `focusgroup` | Gecko, WebKit | `Tabs.List experimental_focusGroup`, `Menu.Popup experimental_focusGroup` (renders `focusgroup="menu wrap\|nowrap"`; items render no `tabindex` on the native path; typeahead, activation, submenu keys and Tab stay JS), `Toolbar.Root experimental_focusGroup` (`focusgroup="toolbar inline\|block wrap\|nowrap"`; the engine writes no `tabindex` and handles no navigation key where native), standalone `ToggleGroup.Root experimental_focusGroup` (the `toolbar` token under an explicit `role="group"`, plus `nomemory` and `focusgroupstart` on the first pressed Item; a ToggleGroup **inside** a Toolbar renders no `focusgroup` whatever its prop says, with a dev warning, because a nested focusgroup splits the Toolbar's single Tab stop) | The List renders `focusgroup="tablist inline\|block wrap\|nowrap nomemory"` and the selected Tab `focusgroupstart`; where `focusGroup` is implemented the JS arrow-key handling steps aside and unselected Tabs render no `tabindex`. |
   | `interpolate-size` / `calc-size()` | Gecko, WebKit (TP) | `Accordion.Root experimental_interpolateSize`, `Collapsible.Root experimental_interpolateSize` (the `<details>` itself) | Inherited property set on the root; `::details-content` height animates to `auto` natively. |
   | `<dialog closedby>` | WebKit (TP) | `Dialog.Popup experimental_closedBy` (the part that renders the attribute) | Native light dismiss instead of JS. |
   | Customizable `<select>` | Gecko (pref) | **none** (Select design) | The markup (`<button>` + `<selectedcontent>`, rich options, `<legend>` in `<optgroup>`) is parsed everywhere and degrades to the native select; the opt-in is the consumer's CSS (`appearance: base-select`), so no library flag exists. |
   | WebOTP (`navigator.credentials.get({ otp })`) | Gecko | `OTPField.Root experimental_webOTP` | The Input's mount effect requests the code of an origin-bound SMS; a resolved code of `length` characters fills the field (`"platform"`) and completes it. Where the API is missing the flag does nothing; `autocomplete="one-time-code"` is the baseline everywhere. |
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
  types/index.ts            # @funstack/ui/types: the shared types only (9.2)
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
- One part per file. Parts that exist only together and share their helpers may share one
  file, named after the first (`combobox-chips.tsx`: `Chips`, `Chip`, `ChipRemove`; the
  `*-group.tsx` files of Combobox, MultiSelect and Menu: `Group`, `GroupLabel` and the parts
  beside them). Tests are colocated; a multi-part component has one test file per namespace
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
`index.ts` to `entry`. Two subpaths are not components: `@funstack/ui/csp` (`CSPProvider`,
`STYLE_SHA256`; section 12) and `@funstack/ui/types` (below). Single-element components have their own subpath like any other
(`@funstack/ui/button`, `@funstack/ui/toggle`, `@funstack/ui/separator`). A multi-part
component's subpath is its kebab-case name (`@funstack/ui/number-field`,
`@funstack/ui/otp-field`).

**The shared types have one subpath, `@funstack/ui/types`** (`src/types/index.ts`):

```tsx
import { Tabs, type TabsValueChangeDetails } from "@funstack/ui/tabs";
import type { ChangeReason, ActionDetails } from "@funstack/ui/types";   // documented
import type { ChangeReason } from "@funstack/ui";                        // also works
```

- **What it exports**: the shared types of 9.4 (`Action`, `ActionDetails`, `ChangeAction`,
  `ChangeReason`, `UrgentChangeHandler`, `UrgentHandler`, `WhilePending`, `RenderProp`,
  `StateValue`), and nothing else: every type in it is used by more than one component and
  belongs to none. A type that names one component stays on that component's subpath.
- **Types only.** The entry has `export type` lines and no value, no directive and no
  platform-typings import (7.4 is for entries that render elements); its JavaScript output is
  an empty module, so an import that a compiler does not erase costs nothing.
- **A component subpath does not re-export them.** One home per name: an editor's auto-import
  offers `@funstack/ui/types` and the root, not one subpath per component, and a new shared
  type is added in one file. This is the one exception to "everything a public type names is
  exported from the component's `index.ts`" (9.4): a shared type that a component's props
  name is exported from the types subpath and the root entry.
- The root entry keeps exporting them, as it re-exports everything.

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
- **Every part has an exported `<Component><Part>State`.** A part that reuses another part's
  state object exports an alias (`AccordionTriggerState = AccordionItemState`,
  `SelectTriggerState = SelectRootState`), so a consumer can always name the state of the part
  they are styling. A state object shared by the Root and some parts may keep a
  `<Component>State` name next to the per-part aliases (`NumberFieldState` with
  `NumberFieldRootState`, `NumberFieldInputState`, `NumberFieldLabelState`; `OTPFieldState`). A
  component whose parts **all** share one state object exports the single `<Component>State`
  and no aliases (`FieldState`; `ProgressState` / `MeterState`, with `MeterRegion` exported;
  `AvatarState`). A state with no members is `Record<string, never>`, never an empty
  `interface`.
- **A details type is named after its prop**: `<Component>[<Part>]` followed by the prop's
  name with the `Action` suffix (or the `on` prefix) replaced by `Details`. The part is named
  when the prop is not on the Root or the single element.

  | Prop | Details type | Examples |
  | --- | --- | --- |
  | `<state>ChangeAction`, `on<State>Change` | `<Component>[<Part>]<State>ChangeDetails` | `TabsValueChangeDetails`, `TogglePressedChangeDetails`, `MenuCheckboxItemCheckedChangeDetails`, `MenuRadioGroupValueChangeDetails`, `ComboboxInputValueChangeDetails` (the urgent handler's type keeps the name: it describes the change, not the lane) |
  | `<state>CommitAction` | `<Component><State>CommitDetails` | `SliderValueCommitDetails`, `NumberFieldValueCommitDetails`, `TextFieldValueCommitDetails`. A commit action is never typed with the change details type; a component with the commit alone (TextField) has no `…ChangeDetails` |
  | `<event>Action`, `on<Event>` | `<Component><Event>Details` | `OTPFieldCompleteDetails`, `ToastCloseDetails` |
  | `action` (a pure trigger) | `<Component>[<Part>]ActionDetails` | `ButtonActionDetails`, `MenuItemActionDetails`, `DialogCloseActionDetails`, `PopoverCloseActionDetails`, `DrawerCloseActionDetails`, `AlertDialogCancelActionDetails`. A part that is itself named `Action` does not repeat the word: `AlertDialogActionDetails`, `ToastActionDetails` |

  Every one extends `ActionDetails` and is exported, also when it adds no field. A change or
  commit details type has `readonly reason: ChangeReason` (2.2; never a local union). A
  component that reuses another's parts re-exports the types under its own name
  (`DrawerCloseActionDetails = DialogCloseActionDetails`).
- **The variants of a props union** are `<Component><Part><Variant>Props`
  (`AccordionRootMultipleProps` / `AccordionRootExclusiveProps`,
  `ToggleGroupRootMultipleProps` / `ToggleGroupRootExclusiveProps`,
  `ComboboxRootSingleProps` / `ComboboxRootMultipleProps`), with the shared base as
  `<Component><Part>BaseProps`.
- Shared: `Action`, `ActionDetails`, `ChangeAction`, `UrgentChangeHandler` and `UrgentHandler`
  (section 2.6), `ChangeReason`, `RenderProp<Props, State>`,
  `StateValue<T, State> = T | ((state: State) => T)`,
  `WhilePending` (`"run" | "ignore"`, the pure triggers' `whilePending` prop, section 2.5.1,
  one shared union, never a per-part one, so a later mode is added in one place). They are
  exported from `@funstack/ui/types` and the root entry (9.2), not from the component
  subpaths. The `transition` prop's type is React's own
  `ViewTransitionClass` (section 5.2), which the library does not re-export.
- Props interfaces are `interface`s extending the element props (section 1.5); state objects are
  `interface`s with readonly members. A set-valued prop is a `readonly string[]` (3.1).
- A component whose value has two shapes may be **generic** with a default
  (`SliderRootProps<T extends SliderValue = number>`, inferred from `value` / `defaultValue`);
  the shape is fixed at mount (a switch warns in development, like a mode switch).
- **Everything a public type names is exported**, with `export type`, from the component's
  `index.ts` and the root entry: the base and variant interfaces of a props union, and the type
  of every member (`NumberFieldSource`). A shared type is exported from the types subpath
  instead of the component's `index.ts` (9.2). Nothing else from `internal/` is public.

### 9.5 Errors and development warnings

- **A missing owner throws; a misplaced part warns.** A part rendered outside its Root throws,
  in every build, one sentence: `` `<Component>.<Part> must be rendered inside a
  <Component>.Root.` `` (the owner's name where it is not a Root). A part inside its Root but in
  the wrong container (`MultiSelect.Option` outside the `List`, `Menu.Trigger` in a submenu)
  still renders and warns in development.
- **A warning names the part**: the prefix is `<Component>.<Part>: ` (the component alone for a
  single-element one), never the bare component name for a multi-part component.
- **A part the consumer must name warns when it has no accessible name** (`use-name-warning.ts`,
  resolving `aria-label`, `aria-labelledby`, a `<label for>` and a wrapping `<label>`): every
  form control and every group that has no `Label` part to do it (TextField, `NumberField.Input`
  without a `NumberField.Label`, Select, Checkbox, Switch, a RadioGroup or CheckboxGroup without
  a `Label` or `aria-label`, `ToggleGroup.Root`, an OTPField input, a Slider thumb, the
  Combobox and MultiSelect parts that need one).

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

## 14. Direction and locale

The audit, the options that were rejected and the prior art are in `design/direction-locale.md`.

### 14.1 Direction

1. **One source.** Direction is the computed CSS `direction` of an element. The library has no
   direction provider, no `dir` prop of its own and no default. A consumer sets direction the
   way the platform does: `dir` on `<html>`, on a container, or on a part through the native
   pass-through (1.5), and the library follows. A subtree with another direction (an RTL island
   in an LTR page) needs nothing more.
2. **Read at the event.** `getComputedStyle(element).direction` is read in the handler of the
   event it affects: each `keydown`, each press of a gesture (once per gesture), each open of a
   point-placed popup. Never during render and never stored between events: the direction may
   come from any ancestor and change at any time. Nothing in rendered markup depends on it.
3. **Which element.** The element whose inline axis orders what the key moves: the container
   for a move between items (the Tabs List, the ToggleGroup or Toolbar Root, a menu popup), the
   control for a move of a value (the Slider input), the surface for a gesture (the Slider
   Track, the Drawer dialog).
4. **Only the inline axis mirrors.** ArrowLeft / ArrowRight swap under `rtl` for a horizontal
   orientation. ArrowUp / ArrowDown, Home / End and vertical orientations do not.
   `internal/arrow-keys.ts` is the one mapping for navigation between items. `writing-mode` is
   not read.
5. **Placement is CSS.** Direction-following placement uses `self-*` keywords and logical
   properties, never a JS read that picks a physical side (13.1). The point-placed menu of 13.4
   is the one exception, because it has no anchor.
6. **Side names.** A prop that names a side or a swipe direction offers `inline-start` /
   `inline-end` next to the physical values (Popover and Drawer `side`), so a consumer writes
   RTL-safe code without knowing the direction.
7. **Native keys stay native.** Where the browser handles the keys of a native control and
   engines disagree under RTL, the component's design records the difference, the docs state
   it, and the tests assert it per engine; the library installs no handler to even it out.
   RadioGroup's arrows in WebKit, which neither mirror nor wrap, are the case
   (`design/components/radio-group.md` 8). Slider is the recorded exception
   (`design/components/slider.md` 7): there the value moved against the drawn track, and the
   component already handled those keys for the vertical orientation.
8. **A component whose content has a direction of its own sets it.** `OTPField.Root` renders
   `dir="ltr"` unless the consumer passes `dir`: a code is read left to right in every locale
   (`design/components/otp-field.md` 4.4). This is an attribute on the library's own element,
   so rules 1 and 2 hold: everything inside reads the direction the attribute produces.

### 14.2 Locale

1. **`locale` is a prop of the Root** of a component that formats or parses (NumberField,
   Progress, Meter): `locale?: string | readonly string[]`, what the `Intl` constructors take.
   Plain data, so a Server Component passes it and a directive-free Root (7.1) uses it. Parts
   get the formatter from the component's own context.
2. **The default is the runtime's locale** (`undefined` to `Intl`), on the server and on the
   client. It suits client-only rendering; the docs of every such component say to pass
   `locale` when the page is server-rendered, because the server's and the browser's locales
   can differ and the text would mismatch at hydration. A client Root warns in development when
   `<html lang>` names another language than the resolved locale and no `locale` was given
   (`design/components/number-field.md` 5.1); a directive-free Root has no effect to warn from.
3. **No locale provider, no `lang` detection, no `navigator.language`.** A context could not be
   read by a directive-free Root rendered by a Server Component, and an app that localises
   already has a locale source to pass. Section 11 states the same for built-in strings.
4. **Locale does not set direction.** They are independent: direction is CSS (14.1).
5. **Reopened by the first date or time component.** Its design must revisit rules 1 and 3 with
   the number of Roots that take `locale` and the cost of a provider to the directive-free
   Roots.

## 15. Escape handled in JS

Where the platform gives no close watcher (a non-modal dialog, a `manual` popover, the Toast
region, a held Menubar Trigger), the library's `keydown` listener acts on an Escape only when it
is a close request:

1. **`key === "Escape"`, not part of an IME composition**: `isComposing` is false **and**
   `keyCode !== 229` (WebKit fires `compositionend` before the key that ends a composition, so
   that keydown has `isComposing === false`; NumberField's and Combobox's guard). Escape during a
   composition cancels the composition only.
2. **Not already consumed**: not `defaultPrevented`, and not taken by another layer of the
   library (rule 3). Innermost first: a handler or layer inside that consumed the Escape (a
   Combobox chip, a Tooltip that closed on it, an input that clears itself, a TextField,
   NumberField or Combobox input that reverted its edited text) prevented it, and
   nothing outside acts on it. A prevented `keydown` is also no close request for a modal
   dialog's or an `auto` popover's close watcher.
3. **A listener that closes something shown on it, or consumes it, prevents it**
   (`consumeEscape(event)`: `preventDefault()` while the event is still being dispatched,
   plus a mark the other layers read; after the dispatch only the mark is set, and
   `defaultPrevented` stays as the page left it), so an enclosing layer stays open and a second
   Escape reaches it (a Combobox chip consumes its Escape: it moves focus to the Input). One
   that closes nothing shown (a Trigger cancelling a coming open, a HoverCard open nobody
   sees yet, the Menubar ending menu mode) leaves it alone.
4. **The signal is `preventDefault()`, never `stopPropagation()`**, as for a close watcher.
   So a layer does not act in the listener that hears the Escape. It **records** the event
   there, in the capture phase, and **decides last**:
   `decideEscapeLast(event, decide, options?)`.
   - *Record.* A layer the Escape must come from (the non-modal Dialog, a toast, a Trigger
     with a coming open) listens on its own element, in capture. A layer that closes on
     Escape wherever focus is (a shown or coming HoverCard, a shown Tooltip) listens on the
     window, in capture, while it is intended open, and records with `{ global: true }`.
     The record step runs `isEscapeRequest` and takes the **snapshot of what the layer
     stands down for**: a layer inside it with a close watcher (an `auto` / `hint` popover, a
     modal dialog), which closes after the dispatch and would look closed later
     (`internal/overlay/open-layer.ts` `containsOpenLayer`; Dialog's own check in
     `dialog.md` 2.6).
   - *Decide.* Once per event, for all its recorded layers together: in a bubble `keydown`
     listener added to the window for this event only (after every element, document and
     earlier window listener), or, when a `stopPropagation()` kept the event from the
     window, after the dispatch has ended (`afterDispatch`, 3.8 rule 5). Each layer's
     `decide` is called only while the Escape is still a request (rule 2), so one Escape
     closes one layer. A listener keeps its pending decisions in a holder
     (`createEscapeRecord()`: `record(event, decide, options?)` and `cancel()`): the same
     event recorded twice by one listener is one record, a new Escape does not cancel a
     record that is still pending, and the listener's cleanup cancels them all. When every
     layer of an event has cancelled, the window listener and the late path are removed at
     once.
   - *Earlier Escapes first.* On the late path a second Escape can be dispatched before the
     first one's task has decided. The first `isEscapeRequest` call on the new Escape (a
     layer's record step, or a part that acts on itself: TextField, NumberField, the
     Menubar) then decides the earlier pending Escapes whose dispatch is over, in the order they were recorded,
     each in the order below, as their tasks would have. So each Escape closes one layer,
     and the second one's record step (a layer's open state, its stand-down snapshot) reads
     the layers the first one closed: two quick Escapes close two layers, innermost first.
     An Escape dispatched from inside another's dispatch leaves that one pending.
   - *Order.* Three groups. First the **cancels**: a decider that closes nothing shown and
     never consumes (a Trigger cancelling its coming open), recorded with `{ cancel: true }`.
     Then the global layers, in the order they were recorded (the order they opened). Then
     the layers the Escape came from, **innermost first** (the reverse of the capture
     order). A cancel goes first because rule 3 leaves the event alone for it and so must
     the other layers leave it alone: a Tooltip that closes on the same Escape and consumes
     it must not keep the card on the focused Trigger coming. A page's `preventDefault()`
     still stops a cancel (rule 2 is checked before every decider). A hint that is showing
     goes before the surface under it, wherever it is; among surfaces the DOM decides. A global layer that contains the layer the Escape
     belongs to stands down by its snapshot (a HoverCard with a Tooltip, a popover or a
     dialog inside, `design/components/hover-card.md` 2.6).

   A part that handles a key **on itself** (the Combobox chip that has focus, the Menubar's
   held Trigger, a disabled button with nothing inside to stop the event, a TextField, the
   NumberField Input or the Combobox Input with edited text) acts in its own handler: it is the innermost by
   construction. So a draft is reverted before any recorded layer decides, a hint that is
   showing included: the Tooltip stays for that Escape and closes on the next.

**Edited text reverted on Escape** (TextField, NumberField, Combobox). An input whose text is
the user's unsaved edit of a value reverts it on an Escape request (rules 1 and 2) when the
text differs from the text of the shown value, and consumes the key (rule 3). With no edit, or
one that shows the same text, the Escape is not the input's: nothing is consumed and the
enclosing layer closes. The revert cancels nothing in flight.

- **TextField, NumberField**: the text is a library draft. The revert drops the draft and
  dispatches nothing.
- **Combobox**: the text is the urgent `inputValue`, and "the text of the shown value" is
  the committed value's text, in both modes. Single selection: the label of the optimistic
  selection, the committed custom value with `allowCustomValue`, or `""` with no selection.
  With `multiple`: `""`, since the values are the chips and the text is a search, so Escape
  clears leftover search text. It is not "what a blur would leave": with `allowCustomValue` a
  blur commits the typed text, while Escape goes back to the committed value, as a TextField's
  revert does. The rule applies **while the listbox is closed and no open is on its way**.
  While the listbox is open, Escape is the listbox's (its close watcher closes it and the text
  stays). **An open that is requested but not shown yet** (intended open, committed closed:
  the keystroke's own open still rendering, a slow `openChangeAction`) **counts as shown**:
  the Escape is the listbox's there too, it cancels the coming open with a close request
  (`openChangeAction(false)`, `reason: "activate"`, since nothing was shown and so nothing was
  dismissed), the text stays and the key is consumed (rule 3). Otherwise the text would
  revert and the listbox would then appear over it. So the sequence is the same either way:
  the first Escape closes the listbox or cancels its open, the second reverts the text, the
  next reaches the enclosing layer. The revert is an urgent write reported to
  `onInputValueChange` with `reason: "dismiss"`, the reason the blur revert uses, and no value
  is dispatched. It never clears the selection (`design/components/combobox.md` 8).

`internal/escape-key.ts` holds all of it: `isEscapeRequest` (rules 1 and 2),
`consumeEscape` (rule 3), `decideEscapeLast` and `createEscapeRecord` (rule 4), and
`isComposingKey` for rule 1
alone: the **one** IME guard of every key handler in the library (the listbox, chip, TextField
and NumberField keys). It covers `isComposing`, `keyCode === 229` and `key === "Process"`; no
handler spells the test itself.

Two limits, which a page cannot do better on without a close watcher. On the late path
(propagation was stopped) the event can no longer be prevented, so a layer **with a close
watcher** that encloses the one that closed (a modal dialog, an `auto` popover) closes on the
same Escape; the library's own layers still see the mark. And a **capture-phase**
`stopPropagation()` above a layer's element hides the event from its record step, as it hides
it from everything inside; the window listeners of the global layers run before any such
listener except another one on the window.

**Against the native close watchers** (a modal `<dialog>`, `auto` and `hint` popovers,
`closedby`), which are the engine's and which the library does not second-guess: rules 2 and
3 are theirs (a canceled `keydown` is no close request). Rule 1 is theirs for the Escape an
IME takes: Chromium, driven through CDP, delivers it as `keyCode` 229 with `isComposing` and
runs no close request (a modal dialog and an `auto` popover stay open). It is **deliberately
stricter** in one case: an Escape the IME did not take while a composition is active
(`keyCode` 27, `isComposing` true) ends the composition and, in Chromium, also closes the
modal dialog or popover; the library's listeners skip it, so text being composed is not lost
to a close, and the next Escape closes. Firefox and WebKit could not be driven with an IME
and are not recorded.

## Resolved questions (2026-10-15)

Moved to `design/CHANGELOG.md` (part "conventions.md: status, resolved questions, open questions"), numbers unchanged: "resolved question 44" in a design document or a source comment is entry 44 there. The rules they decided are stated in sections 1 to 13.

## Open questions

None. Questions are raised in GitHub issues; a decision is recorded in `design/CHANGELOG.md` when the rule it changes is edited.
