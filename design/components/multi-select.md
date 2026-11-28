# MultiSelect (Select multiple)

Status: **decided** (#165; the user accepted the eight recommendations of A.5 on 2026-11-26,
recorded in `design/CHANGELOG.md`), implemented. The component is **`MultiSelect`**
(`@funstack/ui/multi-select`), and the part names of Part B are its parts: `MultiSelect.Root`,
`Label`, `Trigger`, `Value`, `Popup`, `List`, `Option`, `Group`, `GroupLabel`, `Status`, `Empty`.

- **Part A, the home**: where the API lives, the comparison that led to the dedicated
  component, and what would have changed under the other two homes (kept as the reasoning).
- **Part B, the behaviour**: what the component does.

Follows `design/conventions.md`; where this document and the conventions disagree, the
conventions win. **Read `design/components/combobox.md` first**, with its section 15
(multiple selection; on branch `design/164-combobox-multiple` until #164 lands, accepted by
the user on 2026-11-26). This component is that machinery with the text input taken out: the
same popover, the same listbox with virtual focus, the same set-valued `string[]` value. This
document repeats only what differs. Then `design/components/select.md` for what a native
`<select>` gives and this component does not.

Inputs: `docs/vision.md`, `docs/research/wave23-hovercard-select-multiple.md` part 2 (binding:
the engine table, option C), the user decision on #165 (build a JS multi-select listbox now, on
the Combobox multiple machinery), the WAI-ARIA APG patterns "Select-Only Combobox" and
"Listbox" (multi-select), prior art (Base UI `Select multiple`, React Aria `Select
selectionMode="multiple"`, Headless UI `Listbox multiple`, Ark UI `Select multiple`, Mantine /
PrimeReact / Carbon `MultiSelect`; Radix has none), and working notes in
`memo/architect/select-multiple-notes.md`.

What it is: a **select-only combobox with a multi-select listbox**. A button shows the
selection; pressing it opens a listbox in the top layer; a pick toggles one option and the
listbox stays open. The platform has no styleable multi-select drop-down in any stable engine
(research 2.1, 2.2), so this is library JavaScript, as Combobox is. The Async React half is the
same as everywhere: a pick is a transition with an optimistic selection, `data-pending` on the
option the user is waiting on, a rollback of exactly that pick on rejection, and options that
may suspend when the listbox opens.

---

# Part A: the home

## A.1 The three candidates at the call site

**(a) `Select.Root multiple`**

```tsx
<Select.Root multiple name="toppings" defaultValue={["ham"]} valueChangeAction={save}>
  <Select.Trigger><Select.Value>{…}</Select.Value></Select.Trigger>
  <Select.Popup>                                   {/* new part, needed only with `multiple` */}
    <Select.List>
      <Select.Option value="ham">Ham</Select.Option>
    </Select.List>
  </Select.Popup>
</Select.Root>
```

**(b) An input-less Combobox**

```tsx
<Combobox.Root multiple selectOnly name="toppings" defaultValue={["ham"]} valueChangeAction={save}>
  <Combobox.Trigger><Combobox.Value>{…}</Combobox.Value></Combobox.Trigger>   {/* now the combobox itself */}
  <Combobox.Popup>
    <Combobox.List>
      <Combobox.Option value="ham">Ham</Combobox.Option>
    </Combobox.List>
  </Combobox.Popup>
</Combobox.Root>
```

**(c) A dedicated component, `MultiSelect`** (`@funstack/ui/multi-select`)

```tsx
<MultiSelect.Root name="toppings" defaultValue={["ham"]} valueChangeAction={save}>
  <MultiSelect.Trigger><MultiSelect.Value>{…}</MultiSelect.Value></MultiSelect.Trigger>
  <MultiSelect.Popup>
    <MultiSelect.List>
      <MultiSelect.Option value="ham">Ham</MultiSelect.Option>
    </MultiSelect.List>
  </MultiSelect.Popup>
</MultiSelect.Root>
```

## A.2 Comparison

| | (a) `Select.Root multiple` | (b) input-less Combobox | (c) `MultiSelect` |
| --- | --- | --- | --- |
| **Elements** | Every existing part changes element with the flag: `Root` `select` → none, `Trigger` the select's child `button` → `button[role=combobox]`, `Value` `selectedcontent` → `span`, `Option` `option` → `div`, `Group` `optgroup` → `div`, `GroupLabel` `legend` → `div`; `Separator` (`hr`) is not allowed in a listbox. `Popup`, `List`, `Label`, `Status`, `Empty` exist only with the flag | Existing parts keep their elements. `Trigger` gets a second meaning: today an auxiliary `tabindex="-1"` button that focuses the Input, here the combobox itself (a Tab stop, `role`, keys). The server HTML must already differ, so the mode needs a Root prop (`selectOnly`) or a second trigger part | One element per part, one meaning per part |
| **Types** | The Root's props can be a union on `multiple`, but the **parts cannot see the flag**: `SelectOptionProps` extends `ComponentPropsWithRef<"option">` today and would have to become the common subset with `Ref<HTMLOptionElement \| HTMLDivElement>`; `Select.Value` has no `children` in one mode and needs them in the other; `Select.Group label` is required in one and meaningless in the other. `SelectRootProps` loses "every `<select>` prop passes through" in one variant | The Root's union grows a third variant that removes `inputValue`, `defaultInputValue`, `onInputValueChange`, `allowCustomValue`, `autoHighlight`, `openOnClick` and `announce`. The states keep dead fields (`inputValue`, `query`, `stale` on Root, Popup and List). `required` has no home: it is `Combobox.Input`'s | No union anywhere. `value` is `string[]`, every part's props extend one element's |
| **Docs** | The Select page states "a real `<select>`, no JavaScript for the picker, works before hydration, native mobile picker, style with `::picker(select)` and `option:checked`". Each sentence would need "except with `multiple`", and the page would hold two anatomies, two styling recipes and two keyboard tables | The Combobox page is about the text: two lanes, the urgent input, the deferred query. The select-only variant uses none of it. A reader who wants "a select with several values" does not look under Combobox | Its own page. The Select page gets one section, "Several values", that links to it and says why it is another component |
| **No JS, before hydration** | Single: everything works. Multiple: the button shows the default selection and nothing opens. One prop silently trades away the component's main property | As Combobox today (progressive enhancement, no JS-free mode): consistent | The same behaviour as (b), stated once on its own page. Select's promise stays unconditional |
| **Forms** | Single: the `<select>` posts, validates, resets and autofills natively. Multiple: hidden inputs, a reset computed in JS, a hidden validity element (B.10). Two form models behind one `name` prop | Combobox's hidden inputs, as with `multiple` there; `required` must move from the Input to the Root for this mode only | Combobox's hidden inputs; `required` on the Root, the one place |
| **What users look for** | Base UI, React Aria and Ark users: `Select multiple`. It works for those libraries because their single Select is already a JS listbox; there the flag changes the value type and nothing else. Here it would change every element | Nobody's first guess. Radix users, who have no multi-select, build one from Popover and Command, which is the nearest habit | Mantine, PrimeReact and Carbon name it `MultiSelect`; "multi-select" is the search term of Radix and shadcn users. Headless UI makes the same split: `Select` is the native element, the custom multi-capable one is another component (`Listbox`). `multiple` on `Select.Root` stays a type error and gains a development warning that names `MultiSelect` |
| **The native future** | `<select multiple size=1>` with base appearance is the platform's answer (research 2.1: Chromium flag, HTML PR open, no WebKit position). If the JS listbox takes the name `Select.Root multiple`, the native element must later replace it under the same API, so the API must be limited now to what a native select can do: no controlled `open`, no `Popup` props, no `<ViewTransition>` on the popup (research option D), and the keyboard and focus model change at the swap | No conflict | No conflict. `Select.Root multiple` stays free for the native element (select.md 13 already reserves it), and `MultiSelect` can keep what a native select cannot have (controlled open, options loaded on open, popup transitions) |
| **Maintenance** | One folder with two implementations and a branch on context in every part; the shared listbox code still has to move out of `combobox/` | The least new code: no new folder and no move. The cost is in `Combobox.Root` and `Combobox.Trigger`, which are already the largest parts and gain a third mode | One new folder of thin parts. The listbox hooks of `combobox/` (`use-option-registry.ts`, `use-active-option.ts`, `use-deferred-leave.ts`, the set selection of #164) move to `internal/` once, which (a) needs as well |

## A.3 Recommendation: (c), a dedicated `MultiSelect`

- **A flag that changes every element is not a flag.** In (a), turning `multiple` on forces the
  call site to add `Popup` and `List`, move the options, replace `Separator`, rewrite the CSS
  from `option:checked` and `::picker(select)` to `[role=option][data-selected]` and a popup
  class, and give `Value` children. The user rewrites the component either way; a second name
  says so, and the types then tell the truth about each part's element.
- **It keeps Select honest.** Select is the library's best case for vision principle 5: a real
  `<select>` that needs no JavaScript. select.md decision 15 says Select never grows a
  controlled open, chips or a library-owned popup. (a) reverses that for one prop.
- **It keeps the platform's seat free.** When the native multi drop-down ships in all three
  engines, it arrives as `Select.Root multiple`, with native forms and no behaviour JS, and
  nothing has to be swapped under an existing API.
- **(b) is the cheapest to build and the hardest to find and to type.** The machinery is
  shared in every option; sharing the *namespace* adds a mode to parts that are already the
  most complex in the library, and leaves text-only props and state fields to explain away.

Trade-offs of (c), stated plainly: one more name in the sidebar; a user who types
`<Select.Root multiple>` gets an error instead of a result (mitigated by the warning and the
docs link); and there are two "select" components whose difference must be explained in one
sentence: **Select is the browser's control; MultiSelect is the library's, because the browser
has none yet.**

**Name.** `MultiSelect` over `Listbox`: #162 already uses "Listbox" for the inline listbox
(the ARIA widget with no popup; React Aria's and Ark's meaning), and Headless UI's use of the
word for a button with a popup is the minority one. `MultiSelect` is multiple-only by name,
which is intended: single selection is `Select`, the native element, and a JS single select
would undercut it (decision 8 in A.5).

## A.4 Switching the home

Part B holds under all three homes. What differs:

| Neutral name (Part B) | (c) | (a) | (b) |
| --- | --- | --- | --- |
| `Root` | `MultiSelect.Root` | `Select.Root multiple` | `Combobox.Root multiple selectOnly` |
| `Label` | `MultiSelect.Label` | new `Select.Label` | `Combobox.Label` |
| `Trigger` | `MultiSelect.Trigger` | `Select.Trigger` (second element) | `Combobox.Trigger` (second meaning) |
| `Value` | `MultiSelect.Value` | `Select.Value` (second element, gains `children`) | new `Combobox.Value` |
| `Popup`, `List`, `Status`, `Empty` | `MultiSelect.*` | new `Select.*` | `Combobox.*` |
| `Option`, `Group`, `GroupLabel` | `MultiSelect.*` | `Select.*` (second element) | `Combobox.*` |
| Transition types (B.12) | `fsui-multi-select*` | `fsui-select*` | `fsui-combobox*` |
| B.3 types | as written | unions on the Root; common-subset props on the parts | a third Root variant |
| Open-state API (B.4) | as written | **removed** if a later swap to the native element is wanted (research option D) | as written |
| Document | this file | a section of select.md; select.md decisions 1, 2, 12, 15 and section 13 are rewritten | combobox.md section 16; `required` moves to the Root for this mode |

## A.5 The decisions

Accepted by the user on 2026-11-26: the recommended option of each.

1. **Home**: (c) `MultiSelect` (recommended) / (a) `Select.Root multiple` / (b) input-less
   Combobox.
2. **Name**, if (c): `MultiSelect` (recommended) / `Listbox` (Headless UI's word; collides with
   the inline listbox of #162).
3. **Showing the selection** (B.7): a `Value` part whose function `children` render the
   summary, default the labels joined with `", "`, and no chips (recommended) / chips with
   remove buttons, which cannot live inside a `<button>` and would need the Combobox `Chips`
   parts next to the Trigger.
4. **`required`** (B.10): a hidden validity element so the browser's own message and
   submit-blocking work (recommended; needs the browser checks of B.16) / no `required` in
   v1, validation through `Field`'s `validate` only.
5. **Order of the value** (B.6): pick order, as Combobox `multiple` and with its code
   (recommended) / document order, as a native `<select multiple>` and CheckboxGroup, which
   needs every option mounted while the listbox is closed.
6. **Open-state API** (B.4): the full overlay API (`open`, `defaultOpen`, `openChangeAction`,
   `onOpenChange`, `transition` on the Popup) (recommended under (b) and (c)) / none, to stay
   swappable with a native select (only relevant under (a)).
7. **Scope of v1** (B.14): no `Clear` part, no range selection (Shift+arrows, Ctrl+A), no
   chips (recommended) / add some now.
8. **Single selection in this component**: no; `Select` is the single select (recommended) /
   yes, a JS single select for a styled picker in Firefox and a controlled open. That would be
   a fallback for one engine, which the vision's browser policy rules out, and would give the
   library two single selects.

---

# Part B: the behaviour

## B.1 Anatomy

```tsx
import { MultiSelect } from "@funstack/ui/multi-select";

<MultiSelect.Root name="toppings" defaultValue={["ham"]} required valueChangeAction={saveToppings}>
  <MultiSelect.Label>Toppings</MultiSelect.Label>
  <MultiSelect.Trigger className="select">
    <MultiSelect.Value placeholder="Choose toppings">
      {({ value }) => value.map((v) => toppingNames[v]).join(", ")}
    </MultiSelect.Value>
  </MultiSelect.Trigger>
  <MultiSelect.Popup className="listbox">
    <MultiSelect.List>
      <Suspense fallback={<MultiSelect.Status>Loading…</MultiSelect.Status>}>
        <ToppingOptions />   {/* use(toppings) → <MultiSelect.Option> list */}
      </Suspense>
    </MultiSelect.List>
    <MultiSelect.Empty>No toppings today.</MultiSelect.Empty>
  </MultiSelect.Popup>
</MultiSelect.Root>
```

Rendered HTML (closed, the value is `["ham", "olive"]`; ids come from one `useId` in Root):

```html
<input type="hidden" name="toppings" value="ham" />
<input type="hidden" name="toppings" value="olive" />
<label for="_r_1_-trigger" id="_r_1_-label">Toppings</label>
<button id="_r_1_-trigger" type="button" role="combobox" aria-expanded="false"
        aria-controls="_r_1_-list" aria-required="true" class="select">
  <span>Ham, Olive</span>
</button>
<select tabindex="-1" aria-hidden="true"><option value=""></option></select>  <!-- validity element, only with `required` (B.10) -->
<div id="_r_1_-popup" popover="auto"
     style="position-area: self-block-end span-self-inline-end; position-try-fallbacks: flip-block; min-width: anchor-size(width)">
  <!-- children render while open -->
  <div id="_r_1_-list" role="listbox" aria-multiselectable="true" aria-labelledby="_r_1_-label">
    <div id="_r_1_-option-ham" role="option" aria-selected="true" data-selected="" data-active="">Ham</div>
    <div id="_r_1_-option-olive" role="option" aria-selected="true" data-selected="">Olive</div>
    <div id="_r_1_-option-corn" role="option" aria-selected="false">Corn</div>
  </div>
</div>
```

| Part | Element | Role | Renders from | Notes |
| --- | --- | --- | --- | --- |
| `Root` | none; one `input[type=hidden]` per value when `name` is given | | optimistic value | Owns `useId`, the value (set-valued `useControllableAction`), the open state (`usePopoverRoot`, library mode), the active option, the Option and Status registries, the label cache, the form-reset listener. No `ref`, `className`, `style`. Hidden inputs as combobox.md 15.8. |
| `Label` | `label` | | Root disabled and pending | `for` → the Trigger's id; `id` → the List's `aria-labelledby`. `data-disabled`, `data-pending` (the owner's, conventions 4.1 rule 4). Its click focuses the Trigger and does **not** open the listbox (B.8). |
| `Trigger` | `button` | `combobox` | optimistic value and open; shown open for `aria-expanded` | The one Tab stop and the owner surface. `type="button"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, `aria-required`, `popovertarget` after hydration, `data-open`, `data-pending`, `data-disabled`. Content must not be interactive. With `required` it renders the validity element right after itself (B.10). |
| `Value` | `span` | none | optimistic value, label cache | Inside `Trigger`. Shows the selection, or `placeholder` while it is empty (with or without `children`, B.7); `data-empty` (`state.empty`) while the selection is empty, with or without `children`; `data-disabled`. Optional: any Trigger content rendered from state works. |
| `Popup` | `div` | none | committed open | `popover="auto"`, inline placement; the content region; `keepMounted`, `transition`. As `Combobox.Popup`. |
| `List` | `div` | `listbox` | registries | `aria-multiselectable="true"`, `aria-labelledby`, `aria-busy="true"` while loading, `data-empty`. Owns only `Option`s and `Group`s. |
| `Option` | `div` | `option` | optimistic and committed value, urgent active | `value` required; `label` optional (typeahead text and the label cache; default the trimmed `textContent`); `disabled` → `aria-disabled`. `aria-selected` on every option, `data-selected`, `data-active`, `data-pending`, `data-disabled`. Never focused. |
| `Group` / `GroupLabel` | `div[role=group]` / `div` | group | | As Combobox. |
| `Status` | `div` | `status` in the Popup, none inside the List | | Inside the List it is the Suspense fallback and marks the list as loading (combobox.md 6.3). |
| `Empty` | `div` | none | registries | Renders its children only when the List has no mounted option and is not loading. |

Why this shape:

- **The Trigger is a `<button>` with `role="combobox"`.** ARIA in HTML allows the role on a
  button, and the element brings `disabled`, focus, `<label for>` and the `popovertarget`
  light-dismiss exemption. The APG's example uses a `div tabindex="0"`; a button is the same
  pattern with fewer attributes to keep right. A combobox's name does not come from its
  content, so the Label (or `aria-label`) names it and the content is its value.
- **`Popup` and `List` are separate**, as in Combobox: the "Loading…" and "nothing here" rows
  are not options, and a listbox may own only options and groups.
- **`Value` renders what the consumer says.** The library derives no label from a value
  (combobox.md 2.2) and, with the listbox closed, the options are not mounted, so it cannot
  write "Ham, Olive" by itself for a preselected value. B.7.
- **No `Chips`.** A chip with a remove button is interactive content, which a `<button>` may
  not contain. A field of removable chips is Combobox `multiple`.
- **No `Clear`, no `Separator`** in v1 (B.14). A visual line between options or groups is the
  standalone `<Separator decorative />` (`role="none"`, allowed in a listbox;
  `design/components/separator.md` 4).

Every part renders exactly one element, with the two documented exceptions: the Root's hidden
inputs (the Combobox exception of conventions 1.1 that #164 adds) and the Trigger's validity
element (the NumberField exception: a visually hidden sibling immediately after the part's
element). Only `Popup` renders a `<ViewTransition>`.

## B.2 States

| State | Owner | Kind | Lane | Library-owned or browser-owned |
| --- | --- | --- | --- | --- |
| `value` | Root | `string[]`, a set in pick order | transition, optimistic | Library-owned. Residual browser path: form reset (`"platform"`). `[]` is the empty state. |
| `open` | Root (`usePopoverRoot`, library mode) | the listbox is shown | transition | As Combobox: requests from parts (`openChangeAction`), dismissals as facts (`onOpenChange`). |
| `activeValue` | Root | the option `aria-activedescendant` points at | **urgent** | Library-owned virtual focus (combobox.md 2, 6.5). |
| `pending` | Root | a value or open transition is in flight | | On the Trigger; per option as B.5. |
| `loading` | Root, derived | a `Status` is mounted inside the List | | Internal: `aria-busy`, hides `Empty`, delays the initial active option. |
| typeahead buffer | Trigger (ref) | the typed prefix | | Internal, 500 ms. |
| focus | DOM | | | Stays on the Trigger while the listbox is open. |

There is no text, so there is no urgent `inputValue`, no `query`, no `stale` and no deferred
render: the lane table of combobox.md 2 loses its second and third rows.

## B.3 Props and types

Shared types come from `packages/ui/src/internal/types.ts`.

```ts
export interface MultiSelectValueChangeDetails extends ActionDetails {
  /** The control would be valid holding this value (conventions 2.2, field-form.md 7.5). */
  readonly valid: boolean;
  /**
   * "activate": the user toggled an option (Enter, Space, click; `details.event` is the
   * `keydown` or `click`).
   * "platform": a form reset (`details.event` is the `reset` event).
   */
  readonly reason: ChangeReason;
  /** Values this dispatch added, in the order they join the value. */
  readonly added: readonly string[];
  /** Values this dispatch removed, in value order. */
  readonly removed: readonly string[];
}

export interface MultiSelectOpenChangeDetails extends ActionDetails {
  /**
   * "activate": the Trigger (click, Enter, Space, arrows, Home, End, a typed character),
   * Alt+ArrowUp, a foreign invoker or `showPopover()`.
   * "dismiss": Escape, light dismiss, focus leaving, another top-layer element.
   * "platform": the popup was found open at mount.
   */
  readonly reason: ChangeReason;
}

export interface MultiSelectRootState {
  /** Optimistic selection, in pick order. Content rendered from it must not suspend. */
  readonly value: readonly string[];
  readonly activeValue: string | null;
  /** Optimistic open state. */
  readonly open: boolean;
  /** A `valueChangeAction` or `openChangeAction` dispatched through this Root is in flight. */
  readonly pending: boolean;
  readonly disabled: boolean;
}

export interface MultiSelectRootProps {
  /** Controlled selection. `[]`: nothing selected. `undefined`: uncontrolled. Duplicates are ignored. */
  value?: readonly string[];
  /** Initial selection in uncontrolled mode. Default `[]`. Also the form-reset target (latest value). */
  defaultValue?: readonly string[];
  /**
   * Runs inside the Root's transition for every change of the selection. `next` is the whole
   * intended selection as a fresh array; `details.added` / `details.removed` say what this
   * dispatch changed. Awaited; a rejection rolls this change back and nothing else. May be a
   * Server Function. Persist the diff, not `next` (B.6).
   */
  valueChangeAction?: ChangeAction<string[], MultiSelectValueChangeDetails>;

  open?: boolean;
  defaultOpen?: boolean;
  /** Requests only: awaited for opens and for the closes the parts ask for. Never called for a dismissal. */
  openChangeAction?: ChangeAction<boolean, MultiSelectOpenChangeDetails>;
  /** Facts only: a dismissal. Always `false`; synchronous, not awaited. */
  onOpenChange?: UrgentChangeHandler<boolean, MultiSelectOpenChangeDetails>;

  /** Wrap from the last option to the first and back with the arrow keys. Default `false`. */
  loop?: boolean;
  /** Form participation: one hidden input with this name per value. */
  name?: string;
  form?: string;
  /** At least one value must be selected for the form to submit (B.10). */
  required?: boolean;
  /** Disables the Trigger; nothing dispatches. */
  disabled?: boolean;
  children?: StateValue<ReactNode, MultiSelectRootState>;
}

export interface MultiSelectTriggerState {
  readonly value: readonly string[];
  readonly open: boolean;      // optimistic
  readonly pending: boolean;   // Root pending
  readonly disabled: boolean;
  readonly invalid: boolean;   // the Field shows an error (`data-invalid`); `false` outside a Field
  readonly required: boolean;  // own or the Field's (`data-required`: a button has no `:required`)
}
export interface MultiSelectTriggerProps
  extends Omit<
    ComponentPropsWithRef<"button">,
    | "type" | "role" | "onClick" | "onKeyDown" | "onFocus" | "onBlur"
    | "popoverTarget" | "popoverTargetAction" | "commandfor" | "command"
    | "aria-expanded" | "aria-controls" | "aria-activedescendant" | "aria-required"
    | "form" | "disabled" | "className" | "style" | "children"
  > {
  disabled?: boolean;
  className?: StateValue<string | undefined, MultiSelectTriggerState>;
  style?: StateValue<CSSProperties | undefined, MultiSelectTriggerState>;
  /** Non-interactive content only. */
  children?: StateValue<ReactNode, MultiSelectTriggerState>;
  render?: RenderProp<ComponentPropsWithRef<"button">, MultiSelectTriggerState>;
}

export interface MultiSelectValueState {
  readonly value: readonly string[];
  /** For each value, the text of its option as the library last saw it; `undefined` if it never saw one. */
  readonly labels: readonly (string | undefined)[];
  readonly empty: boolean;     // `value.length === 0` (`data-empty`)
  readonly disabled: boolean;  // `data-disabled`
}
export interface MultiSelectValueProps
  extends Omit<ComponentPropsWithRef<"span">, "className" | "style" | "children"> {
  /** Rendered while the selection is empty, instead of `children` (B.7). */
  placeholder?: ReactNode;
  className?: StateValue<string | undefined, MultiSelectValueState>;
  style?: StateValue<CSSProperties | undefined, MultiSelectValueState>;
  /** The summary. Not used while the selection is empty and `placeholder` is given. Default: each `labels[i] ?? value[i]` joined with ", ". */
  children?: StateValue<ReactNode, MultiSelectValueState>;
  render?: RenderProp<ComponentPropsWithRef<"span">, MultiSelectValueState>;
}
```

`Popup`, `List`, `Option`, `Group`, `GroupLabel`, `Status` and `Empty` take the props of their
Combobox namesakes (combobox.md 3.4, 3.5) with the text taken out: `PopupState` is `{ open }`,
`ListState` is `{ empty }`, `OptionState` is `{ value, selected, active, pending, disabled }`.
`Option`'s `label` is the typeahead text and the label-cache entry; it renders nothing.

- `Root` takes no `inputValue`, `allowCustomValue`, `autoHighlight`, `openOnClick` or
  `announce`: each is about the text or the results of a search.
- `required` is on the `Root` because no part's element can carry it natively (B.10).
- `Trigger` must stay a `<button>` (`render` dev warning): the `popovertarget` exemption of
  B.4 is defined for buttons only.
- Exports: every `MultiSelect<Part>Props` / `State`, `MultiSelectValueChangeDetails`,
  `MultiSelectOpenChangeDetails`.

## B.4 Open and close

`usePopoverRoot({ mode: "library" })`, shown in the apply effect with
`showPopover({ source: trigger })`: the Trigger is the implicit anchor and the popup nests
under the Trigger's popover ancestor. Everything in combobox.md 5.1, 5.4, 5.5 and 5.6 holds
with "the Trigger" for "the input", except the rows below.

| Cause | What happens | Channel, `reason` |
| --- | --- | --- |
| Trigger click while closed; Enter, Space, ArrowDown, ArrowUp, Alt+ArrowDown, Home, End, a printable character on the closed Trigger | `requestOpen`; the initial active option of B.8 | `openChangeAction(true)`, `"activate"` |
| Trigger click while open; Alt+ArrowUp | `requestClose`; `hidePopover()` in the apply effect of the close commit; the `<ViewTransition>` exit when `transition` is set | `openChangeAction(false)`, `"activate"` |
| Escape | the auto popover's close watcher; focus stays on the Trigger | `onOpenChange(false)`, `"dismiss"` |
| Light dismiss; another `auto` popover or modal dialog opening | browser | `onOpenChange(false)`, `"dismiss"` |
| Focus leaving the Trigger for anything outside the Popup (Tab, a click elsewhere) | the library's immediate `hidePopover()` (`useDeferredLeave`, combobox.md 5.4) | `onOpenChange(false)`, `"dismiss"` |
| **A pick** | **nothing: the listbox stays open** (combobox.md 15.3) | |

- **The Trigger is an invoker of the popup after hydration.** It writes `popovertarget`
  through its ref and cancels every click, exactly as `Combobox.Trigger` (combobox.md 3.3):
  the popup is always opened by the library, and a press on the Trigger while the listbox is
  shown is not a light dismiss, so the click toggles against the state the user saw. The
  attribute is never in the server HTML.
- **No pointer capture.** Combobox's Input needs it because an input can name no popover; the
  Trigger is a button and names it.
- **The Trigger focuses itself in its click handler.** WebKit does not focus a button on a
  mouse press, and everything after the open (keys, the leave rule) assumes focus is there.
- **A press in the Popup does not move focus**: `pointerdown` and `mousedown` are prevented on
  the Popup (combobox.md 3.4, 7.1).
- **Suspense on open** is the consumer's layout choice (conventions 6): with the boundary
  inside the List the popup opens at once showing `Status`; with the boundary outside the
  Popup, React holds the open and the Trigger shows `data-pending`.

## B.5 What a pick does

Enter or Space with an active option, or a click on an option, **toggles** it:

```ts
function toggle(option: { value: string }, event: Event): void {
  const patch = optimistic.has(option.value)
    ? { added: [], removed: [option.value] }
    : { added: [option.value], removed: [] };
  dispatch(next(patch), createActionDetails(event, { reason: "activate", ...patch }));
  // no close, no focus move; the active option stays where it is
}
```

- The option's `aria-selected` and `data-selected` flip at once (optimistic), the hidden
  inputs and the `Value` follow in the same sync render, and the option shows `data-pending`
  until its change is committed.
- There is no no-op pick: every accepted pick dispatches.
- A **disabled** option never toggles. Its press is still prevented, so focus stays.
- A rejection rolls back that option and nothing else; the listbox, the active option and
  focus are untouched.

| Where | `data-pending` |
| --- | --- |
| Trigger | the Root's `pending` (a value or open transition in flight) |
| Option | the value action is pending and the option's optimistic selection differs from its committed one: an option being added **and** one being removed (combobox.md 15.5) |

Nothing is disabled while pending (conventions 3.6).

## B.6 The value

The set-valued contract of combobox.md 15.4, unchanged: normalised to a set at the prop
boundary, the patch reducer, stacked optimistic updates, the replay of every resolved change in
dispatch order, "the latest rejection reaches the boundary and a superseded one goes to
`reportError`", the absolute dispatch for a form reset, and "persist the diff, not `next`".

**Order: pick order** (combobox.md 15.2). A new value is appended; the order of `value` /
`defaultValue` is kept. It is the order of `state.value`, of the hidden inputs and so of
`formData.getAll(name)`. Trade-off: a native `<select multiple>` posts in document order, and
a summary in the Trigger reads "Olive, Ham" if the user picked in that order. Document order
would need every option mounted while the listbox is closed, which `keepMounted={false}` and
options that load on open rule out. A consumer who wants list order sorts in `Value`'s
function, where it has its own list. Every comparison the library makes is set equality.

## B.7 Showing the selection: `Value`

`Value` renders a `<span>` inside the Trigger. Its function `children` receive
`{ value, labels }`:

```tsx
// The consumer's names: right on the server, before the listbox was ever opened.
<MultiSelect.Value placeholder="Choose toppings">
  {({ value }) => value.map((v) => toppingNames[v]).join(", ")}
</MultiSelect.Value>

// A count.
<MultiSelect.Value>
  {({ value }) => (value.length === 0 ? "Any topping" : `${value.length} toppings`)}
</MultiSelect.Value>

// No children: what the library knows.
<MultiSelect.Value placeholder="Choose toppings" />
```

- **`placeholder` wins while the selection is empty.** When `placeholder` is given (not
  `undefined` or `null`) and nothing is selected, the span renders it, whatever `children` is:
  a function is not called, static children are not rendered. So the first example above needs
  no empty branch. `children` describes the selection; `placeholder` describes its absence.
  Without `placeholder`, `children` is used for the empty selection too (the "count" example),
  and without either the span is empty. The function form of `render` receives the resolved
  content as `props.children`, as everywhere (conventions 1.2).
- **Default content** (no `children`): each value's label joined with `", "`. The span carries `data-empty` whenever the selection is empty, also
  with function `children`: the library's one word for "the value is empty" (conventions 4.1),
  the attribute `Combobox.Input` and `Combobox.Chips` carry for the same condition. There is no
  `data-placeholder`. The separator is
  punctuation, not a word, and is replaced by passing `children`; it is not a built-in string
  under conventions 11.
- **Labels come from the label cache** (combobox.md 2.3): the text of every Option the Root
  has seen. For a value whose Option was never mounted (a default value before the listbox
  first opens, and always in the server HTML) `labels[i]` is `undefined` and the default
  content shows the raw value. So a component with preselected values and human names passes
  function `children` with its own names, as the first example. This is the cost of a library
  that keeps no item list; an `items` prop on the Root was rejected for the reason Combobox
  rejected it (the list is often asynchronous and is the consumer's render).
- A function cannot cross from a Server Component. A Server Component tree uses the default
  content or renders the Trigger's content from its own client component.
- `Value` is optional. The Trigger's own function `children` receive `{ value, open,
  pending }`, so a spinner next to the value is
  `{({ pending }) => <><MultiSelect.Value /> {pending && <Spinner aria-hidden />}</>}`.
- Content rendered from this state must not suspend (it is optimistic).

The Trigger's text content is the combobox's **value** for assistive technology; decorative
icons inside it carry `aria-hidden`.

## B.8 Keyboard and focus

DOM focus stays on the Trigger; options are virtual focus through `aria-activedescendant`
(combobox.md 7.1). Keys are handled in the Trigger's `onKeyDown`; "open" is judged against
the popup's `:popover-open` (combobox.md 8). Events with `ctrlKey` or `metaKey` are ignored.

| Key | Listbox | Behaviour | `preventDefault` |
| --- | --- | --- | --- |
| Enter, Space, ArrowDown, Alt+ArrowDown | closed | open; initial active option (below) | yes |
| ArrowUp | closed | open; the first selected option, else the **last** enabled one | yes |
| Home / End | closed | open; the first / last enabled option | yes |
| Printable character | closed | open; the first option that matches (typeahead) | yes |
| ArrowDown / ArrowUp | open | next / previous enabled option; stays at the end (wraps with `loop`); from none: the first / last | yes |
| Home / End | open | first / last enabled option | yes |
| PageDown / PageUp | open | ten options forward / back, clamped (APG) | yes |
| Enter, Space | open, active option | toggle it (B.5); the listbox stays open | yes |
| Enter, Space | open, no active option | nothing | yes |
| Printable character | open | typeahead: the active option moves to the match; nothing is toggled | yes |
| Alt+ArrowUp | open | close; nothing is toggled | yes |
| Escape | open | platform: closes; focus stays on the Trigger | no |
| Escape | closed | nothing; reaches an enclosing Dialog or Popover | no |
| Tab / Shift+Tab | open | focus moves on; the listbox closes (B.4). **Tab does not toggle** the active option | no |

- **Initial active option.** When the listbox opens by Enter, Space, ArrowDown or a click, the
  active option is the first **selected** option in document order, else the first enabled
  one. It is set once the options are there: after the open commit, or when a loading List
  settles (the "armed once per open, fires when the results settle" rule of combobox.md 6.5,
  always armed here).
- **Typeahead** is Menu's (menu.md 5.1): a 500 ms buffer matched case-insensitively as a
  prefix against each enabled option's `label` (else its `textContent`), searching from the
  option after the active one and wrapping, so one letter pressed repeatedly cycles. **Space
  is a character only while the buffer is not empty**; otherwise it toggles. Disabled options
  are not matched (they cannot be active).
- **Tab does not toggle.** The APG's single select-only combobox selects the focused option on
  Tab; with several values that would add or remove an option the user only walked past.
- Disabled options are skipped by the arrows and by `pointermove` (combobox.md 8).
- `pointermove` over an enabled option makes it active, so the keys continue from the pointer.
- **The Label.** `<label for>` on a button forwards a click to it, which would open the
  listbox; a native `<label>` on a `<select>` only focuses it. The `Label`'s click handler
  therefore calls `preventDefault()` and focuses the Trigger. Before hydration the forwarded
  click reaches a button that does nothing.
- The library moves focus in two places only: the Trigger's own click (B.4) and the Label's
  click. Nothing moves on rollback.

Not in v1: range selection (Shift+arrows, Ctrl+Shift+Home / End) and Ctrl+A, the APG's
optional multi-select keys.

## B.9 ARIA

| Part | Attributes |
| --- | --- |
| Trigger | `role="combobox"`, `aria-expanded` (the Root's `shown` mirror: the popup is in the top layer), `aria-controls` → the List id, `aria-activedescendant` → the active Option id or absent, `aria-required="true"` with `required`, `id` (the Label's `for`). No `aria-haspopup`: `listbox` is the role's default. Named by the Label or the consumer's `aria-label` / `aria-labelledby` (dev warning without a name) |
| Label | `for`, `id` |
| Popup | `popover="auto"`, `id`; no role |
| List | `role="listbox"`, `aria-multiselectable="true"`, `aria-labelledby` → the Label id while one is mounted (token-merged), `aria-busy="true"` while loading |
| Option | `role="option"`, `id` (derived from the value), `aria-selected` `"true"` / `"false"` on **every** option (optimistic), `aria-disabled` |
| Group / GroupLabel | `role="group"` + `aria-labelledby` while a GroupLabel is mounted (conventions 1.1.1) |
| Status | `role="status"` in the Popup; `role="none"` inside the List |

**`aria-expanded` on an invoker.** Every other overlay Trigger renders no `aria-expanded`,
because a `popovertarget` button's expanded state is the browser's (conventions 3.2). This
Trigger renders it, from `shown`, for the reason `Combobox.Input` does: `aria-expanded` is a
required state of the `combobox` role, and before hydration the button has no `popovertarget`
and would otherwise be a combobox with no state. Chromium and WebKit let the platform state win
over the attribute and Firefox ORs the two (`docs/research/invoker-aria-expanded.md`); both
agree with `shown` outside the one task between a dismissal and its `toggle` event. The Nu
checker's "no `aria-expanded` on a `popovertarget` button" message is the accepted cost.

No announcement is built in. Toggling changes `aria-selected` on the element
`aria-activedescendant` points at, and there is no result count to report (no search).

## B.10 Form, `required`, `disabled`

- **`name`**: one `<input type="hidden" name value>` per optimistic value, in value order,
  before the children, and one nameless hidden input while the selection is empty
  (combobox.md 15.8). `formData.getAll(name)`, the shape of a `<select multiple>`.
- **Form reset**: the target is computed in JS (uncontrolled: the latest `defaultValue ?? []`;
  controlled: the mount-time `value`) and dispatched whole with `reason: "platform"`
  (combobox.md 15.4, 15.8).
- **`required`** means "at least one value". A `<button>` and a hidden input are both barred
  from constraint validation, so there is no element to carry it. With `required`, the Trigger
  renders a **validity element** immediately after itself:

  ```html
  <select tabindex="-1" aria-hidden="true" required><option value=""></option></select>
  ```

  It is a `<select>` so that the browser's message is the one for a select ("Please select an
  item in the list"). It has one empty option, no `name` (it posts nothing) and never changes
  its value; **`required` is rendered only while the optimistic value is empty** (a computed
  native validity attribute, conventions 3.6, as CheckboxGroup's and combobox.md 15.8's). So a
  submit with nothing selected is blocked natively; removing the last value marks it required
  at once, a rollback un-marks it. It is visually hidden by inline styles (a clipped 1px box
  with no pointer input; not `display: none`, which would bar it from validation) and
  `autocomplete="off"` (no form-state restoration). It is not anchored to the Trigger: no
  bubble is shown (below), so nothing points at its box. The Trigger carries
  `aria-required="true"` whenever the prop is set, and the Root's `form` (so the reset
  listener finds the form through the Trigger when there is neither `name` nor `required`).
  `ref` goes to the button; the validity element takes no props.

  **The browser's bubble is not shown** (the fallback of the B.16 check). The validity
  element's `invalid` event is cancelled, and on a submission attempt (the element matches
  `:user-invalid`; `checkValidity()` and `reportValidity()` move nothing) the Trigger is
  focused through the Field's first-invalid collector (`focus-first-invalid.ts`), so with
  several invalid controls the first in document order still takes focus. The attempt is
  reported **once**: inside a Field with a `Field.Error` the Field's capture listener on the
  validity element runs first, cancels the event and reports the Trigger, and the Trigger's own
  listener then reports nothing (it checks `defaultPrevented`); a second report would start a
  new attempt in the collector, which moves focus out of document order and announces the
  browser's message. The message is
  `Field.Error`'s: **`required` shows its message only inside a `Field.Root` with a
  `Field.Error`**; outside one, a submit with nothing selected is blocked and focus lands on
  the Trigger (`aria-required`), with no text. Why: in Firefox the bubble of the hidden
  element outlives the focus hand-over and stays over the place where the listbox opens, and
  it takes the pointer input there, so the first options cannot be clicked until it goes;
  the bubble cannot be moved or hidden from script. Focus the validity element receives
  anyway passes to the Trigger.
- **Inside a `Field.Root`** the Trigger is the control (labelable, `aria-describedby`,
  `aria-invalid`, `data-invalid`) and the validity element is the Field's validity element
  (conventions 3.6, the NumberField case, without the message mirror: a button has no
  custom-validity slot). The Field hears the validity element's `invalid` there, since it is
  outside the registered element (field-form.md 7.1), and `Field.Error` shows the message in
  the page. `Field.Label` focuses a `<button>` control without activating it, as `Label`
  does (field-form.md 4.2). `name`, `disabled` and `required` default from the Field.
- **`disabled`** on the Root (its own prop or the Field's) disables the Trigger natively;
  nothing opens or dispatches. **A disabled MultiSelect is not submitted** (conventions 3.6):
  every hidden input renders `disabled`, the unnamed one of an empty selection included, as a
  disabled native `<select multiple>` posts nothing. A disabled input is still form-associated,
  so the reset listener and the Field registration are unaffected.
  The validity element is disabled with the Trigger, so a disabled MultiSelect is never
  `valueMissing`.
- **`readOnly`** on the Root (its own prop or the Field's) (conventions 3.6.1): the Trigger stays an enabled,
  focusable button with `aria-readonly="true"` (owned; `combobox` has the state) and
  `data-readonly`, and **the popup never opens**: a press, Enter, Space, the arrows and
  typeahead request nothing, `aria-expanded` stays `"false"`. When the prop turns on (or the
  Root mounts read-only and open) the Root makes a close request with `"dismiss"`: an
  uncontrolled popup closes, a controlled `open` parent decides. A popup a parent keeps open
  can still be closed: Escape is the platform's close watcher, and Alt+ArrowUp with the
  listbox shown makes a close request; every other key is left alone, not prevented.
  Nothing dispatches. The hidden inputs are not
  disabled, so the selection is submitted, and the validity element's `required` is not
  rendered (a read-only control is barred from validation). `readOnly` is in the state of
  the Root and of every part that has `disabled`.
- **Without `name`** the form reset still reaches the Root: the reset listener follows the
  form owner of the first hidden input, else the validity element, else the Trigger.
- `useFormStatus` is not folded into `pending` (conventions 2.7).

## B.11 Async walkthroughs

`V` committed, `O` optimistic, `P` Root pending. Uncontrolled, `defaultValue={[]}`,
`valueChangeAction={async (_next, { added, removed }) => { await save({ added, removed }); }}`.

1. **Options load on open.** Click the Trigger: `openChangeAction(true)`, the popup is shown in
   the open commit, the List suspends on `use(toppings)` and shows `Status`; the List is
   `aria-busy`, no option is active. The data arrives: the options mount, the first one becomes
   active. Select cannot do this (select.md 6.2: no open event).
2. **Two picks, slow saves.** Space on Ham: `O=["ham"]`, Ham `aria-selected="true"
   data-pending`, the Trigger reads "Ham" and is `data-pending`, a hidden input `value="ham"`.
   ArrowDown, Space on Olive: `O=["ham","olive"]`. Olive's save resolves first: nothing is
   committed yet. Ham's resolves: both are replayed, `V=["ham","olive"]`, `P=false`. The
   listbox was open throughout.
3. **A save rejects.** As 2, but Ham's save rejects after Olive's resolved: `V=["olive"]`; Ham
   loses `data-selected`, the Trigger reads "Olive". Ham's rejection was superseded and goes to
   `reportError`; had it been the only dispatch, it would reach the Error Boundary above the
   Root. Focus and the active option do not move.
4. **Toggle off and Escape while pending.** Space on a selected option: `removed: [value]`,
   `aria-selected="false"`, `data-pending`. Escape: the listbox closes at once (a fact); the
   value action is another state and still commits or rolls back.
5. **Required, last value removed, submit.** One value, `required`. Space on it: `O=[]`, the
   validity element gets `required` in the same render. Submit while the removal is pending:
   blocked, focus arrives on the Trigger, no bubble (B.10). The removal rejects: the value
   returns and `required` leaves.
6. **Form reset during a save.** `defaultValue={["ham"]}`, Olive added and pending. Reset: an
   absolute dispatch of `["ham"]` (`removed: ["olive"]`, `"platform"`); if Olive's save
   resolves later, the replay applies it first and the reset after it, so `V=["ham"]`.
7. **Controlled, update on success.** As combobox.md 15.4: the parent applies `added` /
   `removed` as a functional update inside `startTransition` after its own `await`.

## B.12 Positioning, nesting, ViewTransition, styling

- **Positioning**: the Popup's inline `position-area: self-block-end span-self-inline-end`,
  `position-try-fallbacks: flip-block` and `min-width: anchor-size(width)`, anchored to the
  Trigger (combobox.md 7.2). No `side` / `align`.
- **Nesting**: an auto popover nested under the Trigger's popover ancestor; works inside
  Dialog and Popover, Escape closes the listbox first; no portal (combobox.md 7.3). Inside a
  `Menu.Popup` it is unsupported, as Combobox.
- **ViewTransition**: `transition` on `Popup` around the `<div popover>` (conventions 5.1), for
  the library's opens and closes; dismissals are CSS. There is no deferred results render, so
  the `default: "none"` advice of combobox.md 11.4 is not needed here. Types: `fsui-multi-select`
  on every dispatch, `fsui-multi-select-open` / `-close`, `fsui-multi-select-select` when
  `added` is not empty, `fsui-multi-select-deselect` when `removed` is not empty.
- **Styling**: the selectors of combobox.md 11.3 for the popup and options
  (`[role="option"][data-active]`, `[data-selected]`, `[data-pending]`,
  `[aria-disabled="true"]`, `:popover-open` with `@starting-style`), plus:

  ```css
  .select[data-open] { outline: 2px solid Highlight; }
  .select[data-pending] { cursor: progress; }
  .select [data-empty] { color: GrayText; }               /* MultiSelect.Value: nothing chosen */
  .select[data-invalid] { border-color: var(--danger); }   /* inside a Field */
  ```

## B.13 Server rendering and before hydration

Every part file is `"use client"`. The server HTML has the hidden inputs of the default value,
the Label, the Trigger with its `Value` content (B.7), the validity element and the empty
`<div popover>`. Before hydration nothing opens and nothing can be picked; a form submitted
then posts the default selection, and `required` is enforced by the server-rendered validity
element (`required` exactly when the default selection is empty). This is progressive
enhancement, not a JS-free mode (conventions 7.3), and it is the difference from Select that
the docs page states first.

## B.14 Not in v1

- **Chips** with remove buttons (Combobox `multiple`), a **`Clear`** part (a controlled
  consumer clears with its own button; every option can be toggled off from the keyboard).
- **Range selection and select-all keys** (Shift+arrows, Ctrl+Shift+Home / End, Ctrl+A), a
  "select all" option.
- **A search field inside the popup** (the "searchable select" of combobox.md 13).
- **`Separator`** (not in a listbox's content model), **virtualization**, a **maximum**
  number of values.
- **Single selection** (A.5 decision 8).
- **The native element.** `<select multiple size=1>` with base appearance is tracked in
  select.md 13; when it ships in all three engines it is `Select.Root multiple`.

## B.15 What is shared with Combobox

| Shared (in `internal/`) | Combobox only | This component only |
| --- | --- | --- |
| The option registry, label cache and option ids (`internal/use-option-registry.ts`), the active option and its revalidation (`internal/use-active-option.ts`; a resolver for the pending edge and a `loading` flag that holds it back, both unused by Combobox), the leave rule (`internal/use-deferred-leave.ts`), the set selection of #164 (`internal/action/use-multiple-selection.ts`), the hidden inputs (`internal/form/hidden-values.tsx`), the Popup's press prevention, the `Status` / `Empty` rules | The text (`use-combobox-text.ts`), the deferred query and `stale`, `allowCustomValue`, the chips, the Input's pointer capture, the result-count announcement, the computed `required` on the Input, the text half of the reset (`use-combobox-form.ts`) | The Trigger as the combobox, typeahead (shared with Menu: `internal/typeahead.ts`), Space, Home / End and PageUp / PageDown as listbox keys, the `Value` part, the validity element, the Label's click rule |

## B.16 To verify in a browser at implementation

Results (#165 implementation, `multi-select.browser.test.tsx`, Chromium, Firefox and WebKit;
`memo/developer/issue-165.md`):

- `button[role=combobox]` with `popovertarget` and an explicit `aria-expanded`: Chromium's
  accessibility tree exposes `expanded` false / true / false with the listbox hidden, shown and
  hidden again. Firefox and WebKit have no automated accessibility-tree probe here.
- The validity element: **the bubble does not survive in a usable way**. In Firefox the
  bubble stays after the focus hand-over and takes the clicks under it (the first options of
  the listbox, which opens there); the same probe with a plain visible `<select required>`
  shows the bubble swallowing clicks below it too, so it is the platform's, and it cannot be
  moved or dismissed from script. The fallback of B.10 is taken: the `invalid` is cancelled
  and the Trigger is focused. With it, every engine blocks the submit, focuses the Trigger and
  takes clicks on the options right after. `reportValidity()` on the element returns `false`
  (it is a candidate for constraint validation, not "not focusable"). Firefox's form-state
  restoration is ruled out with `autocomplete="off"` (not probed across a reload).
- A `<label for>` press on the Trigger with the listbox open, held 150 ms: light dismiss
  (`"dismiss"`), then focus on the Trigger, no re-open.
- WebKit: focus is on the Trigger after a mouse press (the click handler focuses it).
- Not automated: screen readers (the toggle under `aria-activedescendant`, the Trigger's text
  as the value), and the `flip-block` fallback nested in a Popover in WebKit.

The checks as they were proposed:

- `button[role=combobox]` with `popovertarget` and an explicit `aria-expanded`: the exposed
  state in Chromium, Firefox and WebKit, shown and hidden.
- The validity element: the bubble's position and whether it survives the focus hand-over to
  the Trigger in each engine; that Firefox's form-state restoration leaves a one-option select
  alone; that a `tabindex="-1"` `aria-hidden` select is still reported (not "not focusable").
- A `<label for>` press of any length on the Trigger with the listbox open (light dismiss,
  then the Label's focus).
- Screen readers (NVDA, JAWS, VoiceOver): the option's `aria-selected` change under
  `aria-activedescendant` is announced on toggle, and the Trigger's text is read as the
  combobox value. If the toggle is silent, it needs an `ariaNotify` message and a built-in
  string (conventions 11).
- WebKit: focus on the Trigger after a mouse press (B.4), and the `flip-block` fallback nested
  in a Popover (WebKit 302008, combobox.md 7.3).
