# Cross-cutting consistency audit (library-wide layer)

Date: 2026-11-28. Base: `master` at `fd4c414b` (0.1.0-alpha.27). Audit only: no rule or code was
changed. Scope: the public API surface of every component in `packages/ui/src` against
`design/conventions.md`, the internal consistency of `conventions.md`, and the page structure of
`packages/docs/src/pages`. Family-level behaviour (value inputs, overlays, disclosure) is left to
the three family audits.

Everything below was read from code, not from the design docs. Paths are relative to the repo
root; `src/` means `packages/ui/src/`.

## 1. What is consistent (verified, no finding)

- **Export shape.** 35 subpaths in `package.json` `exports` = the 34 component folders plus
  `csp`; each has an `index.ts`; every name a component `index.ts` exports is re-exported by
  `src/index.ts` (scripted diff: empty). Multi-part components are `as const` namespace objects
  with `Root`; single-element ones are plain (`Button`, `Toggle`, `Switch`, `Checkbox`,
  `Separator`, `TextField`, `Menubar`). Toast is the one namespace without `Root` as owner
  (`Viewport`), with `toast` / `createToastManager` beside it (conventions 1.1).
- **`render`, `className`, `style`, `children`.** Every part that renders an element takes
  `render: RenderProp<…>` and `StateValue` forms of `className` and `style`; `children` is a
  `StateValue` except on void elements, where it is omitted. No plain-`string` `className`
  anywhere. Roots without DOM (Dialog, Popover, Menu, Combobox, MultiSelect, HoverCard, Tooltip)
  take function `children` only.
- **Refs.** Every props type extends `ComponentPropsWithRef<…>`; no `forwardRef`, no
  `ComponentPropsWithoutRef`.
- **`displayName`.** Every part has `<Component><Part>`.
- **`ChangeReason`.** One type, four values, no local union anywhere.
- **Booleans by presence.** All data attributes go through `dataAttr`; no `data-state`, no
  negative pair (`data-closed`, `data-unchecked`) is emitted.
- **Missing-context errors.** One sentence everywhere: `` `${part} must be rendered inside a X.Root.` ``.
- **Shared prop names.** `disabled`, `x` / `defaultX`, `loop` (7 parts), `delay` / `closeDelay`
  (Tooltip, HoverCard, Menu), `locale` / `format` (NumberField, Progress, Meter), `keepMounted`,
  `whilePending` (6 parts, one `WhilePending` type), `getAriaValueText`.
- **Docs site.** One `PropsTable` component, so columns are always Prop / Type / Default /
  Description; every part's table is followed by `PartFacts` (State / Owned); every component
  page starts `BehaviourIndex`, `anatomy`, then `props`, `data-attributes`, `keyboard-and-aria`.

## 2. Reference tables

### 2.1 Every action prop and fact handler

| Part | Prop | Signature (`next`, `details`) | `details` type | Fields beyond `event` |
| --- | --- | --- | --- | --- |
| `Toggle` | `pressedChangeAction` | `ChangeAction<boolean, …>` | `TogglePressedChangeDetails` | none (**no `reason`**) |
| `ToggleGroup.Root` | `valueChangeAction` | `ChangeAction<string[] \| string \| null, …>` | `ToggleGroupValueChangeDetails` | `added`, `removed` (**no `reason`**) |
| `Switch` | `checkedChangeAction` | `ChangeAction<boolean, …>` | `SwitchCheckedChangeDetails` | `reason` |
| `Checkbox` | `checkedChangeAction` | `ChangeAction<boolean, …>` | `CheckboxCheckedChangeDetails` | `reason` |
| `CheckboxGroup.Root` | `valueChangeAction` | `ChangeAction<string[], …>` | `CheckboxGroupValueChangeDetails` | `reason`, `added`, `removed` |
| `RadioGroup.Root` | `valueChangeAction` | `ChangeAction<string \| null, …>` | `RadioGroupValueChangeDetails` | `reason` |
| `Select.Root` | `valueChangeAction` | `ChangeAction<string, …>` | `SelectValueChangeDetails` | `reason` |
| `MultiSelect.Root` | `valueChangeAction` | `ChangeAction<string[], …>` | `MultiSelectValueChangeDetails` | `reason`, `added`, `removed` |
| `MultiSelect.Root` | `openChangeAction` / `onOpenChange` | `ChangeAction<boolean, …>` / `UrgentChangeHandler<boolean, …>` | `MultiSelectOpenChangeDetails` | `reason` |
| `Combobox.Root` | `valueChangeAction` | `ChangeAction<string \| null, …>` | `ComboboxValueChangeDetails` | `reason`, `custom` |
| `Combobox.Root` (`multiple`) | `valueChangeAction` | `ChangeAction<string[], …>` | `ComboboxMultipleValueChangeDetails` | `reason`, `added`, `removed` |
| `Combobox.Root` | `onInputValueChange` | `UrgentChangeHandler<string, …>` | `ComboboxInputValueChangeDetails` | `reason` |
| `Combobox.Root` | `openChangeAction` / `onOpenChange` | as MultiSelect | `ComboboxOpenChangeDetails` | `reason` |
| `Tabs.Root` | `valueChangeAction` | `ChangeAction<string, …>` | `TabsValueChangeDetails` | `reason` |
| `Accordion.Root` | `valueChangeAction` | `ChangeAction<string[] \| string \| null, …>` | `AccordionValueChangeDetails` | `reason`, `item`, `open` |
| `Collapsible.Root` | `openChangeAction` | `ChangeAction<boolean, …>` | `CollapsibleOpenChangeDetails` | `reason` |
| `Dialog.Root`, `AlertDialog.Root`, `Drawer.Root` | `openChangeAction` / `onOpenChange` | `ChangeAction<boolean, …>` / `UrgentChangeHandler<boolean, …>` | `DialogOpenChangeDetails` (aliased) | `reason`, `returnValue` |
| `Popover.Root` | `openChangeAction` / `onOpenChange` | same | `PopoverOpenChangeDetails` | `reason` |
| `Menu.Root` | `openChangeAction` / `onOpenChange` | same | `MenuOpenChangeDetails` | `reason` |
| `HoverCard.Root` | `openChangeAction` / `onOpenChange` | same | `HoverCardOpenChangeDetails` | `reason` |
| `NavigationMenu.Item` | `openChangeAction` / `onOpenChange` | same | `NavigationMenuOpenChangeDetails` | `reason` |
| `Menu.CheckboxItem` | `checkedChangeAction` | `ChangeAction<boolean>` | bare `ActionDetails` (**no named type, no `reason`**) | none |
| `Menu.RadioGroup` | `valueChangeAction` | `ChangeAction<string>` | bare `ActionDetails` (**no named type, no `reason`**) | none |
| `Slider.Root` | `valueChangeAction` | `ChangeAction<T, …>` | `SliderValueChangeDetails` | `reason`, `thumb` |
| `Slider.Root` | `valueCommitAction` | `ChangeAction<T, …>` | `SliderValueCommitDetails` | `reason`, `thumb` |
| `NumberField.Root` | `valueChangeAction` | `ChangeAction<number \| null, …>` | `NumberFieldValueChangeDetails` | `reason`, `source` |
| `NumberField.Root` | `valueCommitAction` | `ChangeAction<number \| null, …>` | `NumberFieldValueChangeDetails` (**the change type**) | `reason`, `source` |
| `TextField` | `valueCommitAction` | `ChangeAction<string, …>` | `TextFieldValueChangeDetails` (**the change type, and there is no change action**) | `reason` |
| `OTPField.Root` | `onValueChange` | `UrgentChangeHandler<string, …>` | `OTPFieldValueChangeDetails` | `reason` |
| `OTPField.Root` | `completeAction` | `Action<[value, details]>` | `OTPFieldCompleteDetails` | `reason` |
| `Button` | `action` | `Action<[details]>` | `ButtonActionDetails` | none |
| `Menu.Item` | `action` | `Action<[details]>` | `MenuItemDetails` (**not `…ActionDetails`**) | none |
| `Dialog.Close`, `Drawer.Close`, `AlertDialog.Cancel`, `AlertDialog.Action` | `action` | `Action<[details]>` | `DialogCloseDetails` (aliased as `DrawerCloseDetails`, `AlertDialogCancelDetails`, `AlertDialogActionDetails`) | `returnValue` |
| `Popover.Close` | `action` | `Action<[details]>` | bare `ActionDetails` (**no named type**) | none |
| `Toast.Action`, `toast({ action })` | `action` | `Action<[details]>` | `ToastActionDetails` | `id` |
| `toast({ onClose })` | `onClose` | `UrgentHandler<…>` | `ToastCloseDetails` | `id`, `reason` |
| `Form.Root`, `Dialog.Form` (+ aliases) | `action` | `string \| ((formData: FormData) => unknown)` | none: React's form channel (2.7) | – |
| `Button` | `formAction` | the native prop's type | none: React's form channel (2.7) | – |

### 2.2 `reason` values each component dispatches (from source)

| Value | Components |
| --- | --- |
| `"activate"` | every component that exposes `reason` |
| `"platform"` | Accordion, Collapsible, Tabs, Checkbox, Switch, CheckboxGroup, RadioGroup, Select, MultiSelect, Combobox, Slider, NumberField, TextField, OTPField, and the overlay Roots (a popup found open at hydration: Dialog, Popover, Menu, HoverCard, NavigationMenu) |
| `"dismiss"` | Dialog, AlertDialog, Drawer, Popover, Menu, HoverCard, NavigationMenu, Combobox, MultiSelect, Toast |
| `"timeout"` | Toast only |
| no `reason` field at all | Toggle, ToggleGroup, `Menu.CheckboxItem`, `Menu.RadioGroup`, and every pure trigger (`Button`, `Menu.Item`, the Close parts, `Toast.Action`) |

No value outside the four exists in source.

### 2.3 Every data attribute emitted

| Attribute | Emitted by | In conventions 4.1? |
| --- | --- | --- |
| `data-pending` | owners, initiating triggers, Close parts, `Form.Root` / `Form.Submit`, Field parts, `Tabs.Indicator`, `NumberField.Label` | yes (list incomplete: `Tabs.Indicator`, `NumberField.Label`, Menu checkable items and `Menu.RadioGroup` are not named) |
| `data-disabled` | most parts with a `disabled` state; also `Tooltip.Trigger` / `Popup`, `Accordion.Panel`, `Collapsible.Panel` | yes ("any") |
| `data-open` | Trigger parts of Dialog, Popover, Menu (+ Submenu / Context), HoverCard, NavigationMenu, Combobox (+ Input), MultiSelect; Accordion `Item` / `Trigger`; Collapsible `Root` / `Trigger` | yes (HoverCard, NavigationMenu, MultiSelect not named) |
| `data-pressed` | `Toggle`, `ToggleGroup.Item` | yes |
| `data-checked` | Checkbox, Switch, `RadioGroup.Item`, `CheckboxGroup.Item` / `Parent`, `Menu.CheckboxItem` / `RadioItem` | yes (CheckboxGroup not named) |
| `data-indeterminate` | Checkbox, `CheckboxGroup.Parent`, every Progress part | yes |
| `data-selected` | `Tabs.Tab` / `Panel` / `Indicator`, `Select.Option`, `Combobox.Option`, `MultiSelect.Option`, `Combobox.Input` | yes (`MultiSelect.Option`, `Tabs.Indicator` not named) |
| `data-active` | `Combobox.Option`, `MultiSelect.Option` (virtual focus); `OTPField.Slot` (caret) | yes (`MultiSelect.Option` not named) |
| `data-filled` | `OTPField.Slot` | yes |
| `data-complete` | every Progress part; `OTPField.Root` / `Input` | yes |
| `data-stale` | `Combobox.Popup`, `List`, **`Input`** | yes (`Input` not named) |
| `data-empty` | `Combobox.List`, `MultiSelect.List`, **`Combobox.Chips`**, `Toast.Viewport` | yes (`MultiSelect.List`, `Combobox.Chips` not named) |
| `data-placeholder` | `MultiSelect.Value` | **no** |
| `data-invalid` | Field parts; inside a Field: Checkbox, Switch, Select, RadioGroup, CheckboxGroup, `Combobox.Input`, `MultiSelect.Trigger`, `Slider.Root` / `Thumb`, `NumberField.Root` / `Input`, `OTPField.Root` / `Input`, TextField | yes, but names only Field, OTPField, NumberField, TextField |
| `data-required` | Field parts | yes |
| `data-modal` | `Dialog.Popup` (+ AlertDialog, Drawer) | yes |
| `data-orientation` | Tabs `Root` / `List` / `Tab`; Slider `Root` / `Track` / `Indicator` / `Thumb`; ToggleGroup `Root` / `Item`; Toolbar `Root` / `Separator`; `Separator` | yes |
| `data-dragging` | Slider `Root`, `Thumb` | yes |
| `data-swiping` | `Drawer.Popup` (attribute only) | yes |
| `data-side`, `data-align` | Popups of Tooltip, Popover, Menu, HoverCard, NavigationMenu; `Tooltip.Arrow`; `Drawer.Popup` (`side`, prop echo) | yes (HoverCard, NavigationMenu not named) |
| `data-instant` | `Tooltip.Popup` (attribute only) | yes |
| `data-context` | `Menu.Popup` | yes |
| `data-region` | every Meter part | yes |
| `data-status` | every Avatar part | yes |
| `data-index` | `Slider.Thumb`, `OTPField.Slot` | yes |
| `data-ending`, `data-type` | `Toast.Root` | yes |
| `data-paused` | `Toast.Viewport` | yes |
| `data-typeahead` | `Menu.Item`, checkable items, `SubmenuTrigger` (carries the `label` prop; read back by `menu/menu-dom.ts:42`) | **no** |
| `data-fsui-tooltip-trigger` | `Tooltip.Trigger` (library mark for shipped CSS) | decision row 13 |

## 3. Findings, ranked

Each finding: what differs, the proposed single standard, whether a justification is recorded,
whether aligning is breaking, severity.

### High

**H1. `conventions.md` gives four different lists of who has `onOpenChange`, and none matches the code.**

- Code (9 owners): `PopoverRootProps`, `MenuRootProps`, `ComboboxRootProps`, `MultiSelectRootProps`
  (`src/multi-select/multi-select-root.tsx:116`), `DialogRootProps`, `AlertDialogRootProps`,
  `DrawerRootProps`, `HoverCardRootProps` (`src/hover-card/hover-card-root.tsx:70`),
  `NavigationMenuItemProps` (`src/navigation-menu/navigation-menu-item.tsx:67`).
- `design/conventions.md:40` (decision row 11): 8, without MultiSelect.
- `design/conventions.md:330` (2.1 naming table): Popover, Menu, Combobox, Dialog, HoverCard,
  `NavigationMenu.Item`; without AlertDialog, Drawer, MultiSelect.
- `design/conventions.md:370` (2.1 "the complete list of such handlers"): Popover, Menu, Combobox,
  Dialog, AlertDialog, Drawer; without HoverCard, MultiSelect, `NavigationMenu.Item`.
- `design/conventions.md:375`: "The pair exists **only on overlay Roots**", which
  `NavigationMenu.Item` (an Item) contradicts.
- `design/overlay-open-state.md:16`: "the five overlay Roots", then names five plus
  `NavigationMenu.Item`; AlertDialog, Drawer, MultiSelect absent.
- `design/testing.md:46` is the only correct list (it mirrors `src/__tests__/action-naming.test.ts`).
- `src/internal/types.ts` (`UrgentChangeHandler` doc comment): names Combobox and the overlay
  Roots, not OTPField's `onValueChange`.

Standard: one list, in conventions 2.1's "complete list" table, stated as the 9 props types the
type guard holds; every other place says "the owners listed in 2.1" instead of enumerating; the
sentence at :375 becomes "only on the owner of an overlay's `open` (a Root, or
`NavigationMenu.Item`)". Justified: no (drift from amendments #148, #164, HoverCard, Drawer,
NavigationMenu waves). Breaking: no (documents only).

**H2. "One vocabulary, three forms" (conventions 4.1) does not hold for `invalid`, and partly not for other names.**

4.1 says a state appears as `data-<name>` and as `state.<name>`. Measured:

- `data-invalid` is emitted by 11 controls inside a Field, but `state.invalid` exists only on
  `OTPFieldState` (`src/otp-field/otp-field-root.tsx:82`) and `FieldState`. `CheckboxState`,
  `SwitchState`, `SelectRootState`, `RadioGroupRootState`, `CheckboxGroupRootState`,
  `ComboboxInputState`, `MultiSelectTriggerState`, `SliderRootState` / `SliderThumbState`
  (`src/slider/slider-root.tsx:367,759`, `src/slider/slider-thumb.tsx:276`), `NumberFieldState`,
  `TextFieldState` have none. A consumer cannot write `className={({ invalid }) => …}` on a
  Checkbox but can on an OTPField.
- Attribute without a state field: `data-selected` on `Combobox.Input`
  (`src/combobox/combobox-input.tsx:198`; state has `value` / `values`) and on `Tabs.Indicator`
  (`src/tabs/tabs-indicator.tsx:76`); `data-empty` on `Combobox.Chips`
  (`src/combobox/combobox-chips.tsx:130`) and `Toast.Viewport` (`src/toast/toast-viewport.tsx:509`);
  `data-placeholder` on `MultiSelect.Value` (`src/multi-select/multi-select-value.tsx:78`).
- Boolean or enum state field without an attribute: `readOnly` and `required` on
  `NumberFieldState` (`src/number-field/number-field-root.tsx:65,67`) and `TextFieldState`
  (`src/text-field/text-field.tsx:61,63`), `readOnly` on `OTPFieldState`; `submenu` on
  `MenuPopupState` (`src/menu/menu-popup.tsx:64`) while its sibling `context` has `data-context`;
  `decorative` on `SeparatorState`; `priority` on `ToastRootState` while its sibling `type` has
  `data-type`; `orientation` on `TabsPanelState` / `TabsIndicatorState`; `dragging` on
  `SliderTrackState`; `disabled` on `ComboboxLabelState`, `MultiSelectLabelState`,
  `MultiSelectValueState` (see M4).

Standard: every data attribute a part emits has the same-named member in that part's `State`
(add `invalid` to every control state that can sit in a Field; `selected` / `empty` /
`placeholder` where emitted), and the rule in 4.1 is reworded to say which direction is
mandatory: attribute implies state field; a state field needs an attribute only when it is a
boolean or enum a stylesheet would select on, with the documented attribute-only exceptions
(`swiping`, `instant`). Justified: partly. `number-field.md` decision 15 records "no
`data-readonly` (`:read-only`)"; `swiping` / `instant` are recorded in 4.1. `invalid` and the
others are not. Breaking: no (additive state fields); adding attributes is additive too.

### Medium

**M1. Two prop names for "close the container after my action": `closeOnActivate` and `closeOnSettle`.**

`closeOnActivate` on `Menu.Item` (`src/menu/menu-item.tsx:51`, doc: "Close the whole menu once
`action` settles"), `Menu.CheckboxItem` (`src/menu/menu-checkbox-item.tsx:51`, "once the change
settles", default `false`) and `NavigationMenu.Link` (closes at the click, no action);
`closeOnSettle` on `Toast.Action`
(`src/toast/toast-action.tsx:50`, "Close the toast when the action resolves") and `Dialog.Form`.
Conventions 2.5.1 (`design/conventions.md:764,785`) treats the two as the same mechanism (the
"mixed" owner rows) and says the menu close runs when the run settles, so `Menu.Item`'s name
describes a different moment than its behaviour. Standard: `closeOnSettle` where the close waits
for an action (`Menu.Item`, `Menu.CheckboxItem`, `Toast.Action`, `Dialog.Form`); keep
`closeOnActivate` only where no action is awaited (`NavigationMenu.Link`). Justified: no rationale recorded in `menu.md`, `toast.md` or the changelog for the
difference. Breaking: yes (prop rename on `Menu.Item` and `Menu.CheckboxItem`; can ship with the old name as a
deprecated alias for one alpha).

**M2. Three spellings for "the value is (not) empty" across sibling components.**

`MultiSelect.Value` emits `data-placeholder` while nothing is selected; `Combobox.Chips` emits
`data-empty` for the same condition (`src/combobox/combobox-chips.tsx:106,130`); `Combobox.Input`
emits the inverse, `data-selected`, for "has a value". `data-empty` also means "no options"
(`Combobox.List`, `MultiSelect.List`) and "no toasts" (`Toast.Viewport`); `OTPField.Slot` uses
`data-filled`. Standard: `data-empty` (and `state.empty`) for "this part's collection or value is
empty" on every part, `data-placeholder` only if the part is literally showing a placeholder
(then it is a second, narrower fact and needs a 4.1 row); drop `data-selected` from
`Combobox.Input` in favour of `:not([data-empty])`, or record why an Input is "selected".
Justified: `data-selected` on the Input is in 4.1; `data-placeholder` is in `multi-select.md`
only; the overlap is recorded nowhere. Breaking: yes for stylesheets (attribute rename).

**M3. `details` types: missing `reason`, missing names, three naming schemes.**

- No `reason`: `TogglePressedChangeDetails` (`src/toggle/toggle.tsx:30`, an empty interface),
  `ToggleGroupValueChangeDetails` (`src/toggle-group/toggle-group-root.tsx:30`). Every other
  change details type has it. A consumer's shared handler (`(next, { reason }) => …`) types
  against 20 components and not these two.
- No named type: `Menu.CheckboxItem` `checkedChangeAction?: ChangeAction<boolean>`
  (`src/menu/menu-checkbox-item.tsx:49`), `Menu.RadioGroup` `valueChangeAction?:
  ChangeAction<string>` (`src/menu/menu-radio-group.tsx:46`), `Popover.Close` `action?:
  Action<[details: ActionDetails]>` (`src/popover/popover-close.tsx:49`), against
  `DialogCloseDetails`, `ButtonActionDetails`.
- Pure-trigger naming: `ButtonActionDetails`, `ToastActionDetails`, `OTPFieldCompleteDetails`
  (`<Component><Event>Details`) against `MenuItemDetails`, `DialogCloseDetails` (`<Component><Part>Details`);
  `AlertDialogActionDetails` is the details of the part named `Action`, which reads as the first
  scheme and is the second.
- Commit actions: `SliderValueCommitDetails` is its own type; `NumberField.Root`'s
  `valueCommitAction` takes `NumberFieldValueChangeDetails`
  (`src/number-field/number-field-root.tsx:100`); `TextField`'s `valueCommitAction` takes
  `TextFieldValueChangeDetails` (`src/text-field/text-field.tsx:97`) although it has no change
  action. Conventions 9.4 names only `<Component><State>ChangeDetails`.

Standard, to add to 9.4: (a) every `<state>ChangeAction` has a named
`<Component>[<Part>]<State>ChangeDetails` with `reason: ChangeReason` (always `"activate"` where
no other path exists; `toggle-group.md:480` records that only one value would occur, which is a
reason for the value, not against the field); (b) `<state>CommitAction` takes
`<Component><State>CommitDetails`; (c) a pure trigger's type is `<Component>[<Part>]ActionDetails`
(`MenuItemActionDetails`, `DialogCloseActionDetails`, `PopoverCloseActionDetails`). Justified:
Toggle's comment says the interface exists so `reason` can be added later; the rest unrecorded.
Breaking: no for (a) and the missing names (additive); (b) and (c) are type renames, non-breaking
if the old names stay as aliases.

**M4. Label parts expose owner state inconsistently.**

| Part | State type | Data attributes |
| --- | --- | --- |
| `Field.Label` | `FieldState` | `data-invalid`, `data-disabled`, `data-required`, `data-pending` |
| `NumberField.Label` | `NumberFieldState` | `data-pending`, `data-disabled` (`src/number-field/number-field-label.tsx:72-73`) |
| `Progress.Label`, `Meter.Label` | owner state | owner's attributes |
| `Combobox.Label` | `{ disabled }` | **none** (`src/combobox/combobox-label.tsx:55`) |
| `MultiSelect.Label` | `{ disabled }` | **none** |
| `Slider.Label` | `SliderRootState` (pending, disabled, dragging, orientation) | **none** (`src/slider/slider-label.tsx:71-72`) |
| `RadioGroup.Label`, `CheckboxGroup.Label` | Root state | none (a `<legend>` inside the `fieldset` that has them) |

Standard: a `Label` part carries the owner's `data-disabled` (and `data-pending` where the owner
has one), as `NumberField.Label` does; the `<legend>` Labels are the recorded exception (CSS
reaches them from the fieldset). Justified: not recorded. Breaking: no (additive attributes).

**M5. The 4.1 table of `conventions.md` is an enumerated list that no longer matches the code.**

See the right-hand column of 2.3: `data-placeholder` and `data-typeahead` have no row;
`data-invalid` names 4 of 12 emitters; `data-side` / `data-align` name 3 of 5 popups;
`data-open` omits HoverCard, NavigationMenu, MultiSelect; `data-empty` omits `MultiSelect.List`
and `Combobox.Chips`; `data-stale` omits `Combobox.Input`; `data-active` / `data-selected` omit
`MultiSelect.Option`. Standard: 4.1 fixes the **name and meaning** only and names a part only
where the meaning is part-specific; the per-part list lives in each component doc (and can be
checked by a script like `check-design-refs.mjs`, since the emitters are greppable). Justified:
no. Breaking: no.

**M6. Single-or-many is spelled three ways.**

`exclusive` (opt in to single; default many) on `Accordion.Root` and `ToggleGroup.Root`;
`multiple` (opt in to many; default single) on `Combobox.Root`; a separate component for many
(`MultiSelect` beside `Select`); plus two fixed components (`RadioGroup` / `CheckboxGroup`).
`combobox.md` 15.2 records the parallel ("a union discriminated on `multiple`, as ToggleGroup's
and Accordion's are on `exclusive`") but not why the flag is inverted. Both are platform words
(`<details name>` exclusivity, `<select multiple>`) and each keeps the component's historical
default. Proposed standard: keep both, and record in conventions 3.1 the rule that decides:
"the flag names the non-default mode, with the platform's word; a component whose two modes
need different anatomy is two components". Justified: implicitly; not recorded as a rule.
Breaking: only if unified (then yes); recording the rule is not.

**M7. View-transition type names: the table lacks rows, and change names are synonyms.**

- `design/conventions.md:1681-1716` (5.3) has no **Dialog** row (the AlertDialog row refers to
  "Dialog's") and no **TextField** row, though `src/text-field/text-field.tsx:134` emits
  `fsui-text-field` / `fsui-text-field-commit`. Tooltip, Menubar and Separator have no "none"
  row while Toolbar, Avatar, Progress do.
- Change-name vocabulary: an `open` state emits `-open` / `-close` on overlays but `-expand` /
  `-collapse` on Collapsible (whose state, prop and attribute are all `open`) and Accordion; a
  `checked` state emits `-check` / `-uncheck` (Checkbox, `Menu.CheckboxItem`, CheckboxGroup) but
  `-on` / `-off` on Switch; RadioGroup and Select emit no kind while `Menu.RadioGroup` emits
  `-select`.

Standard: the kind is derived from the state's name (`open`/`close`, `check`/`uncheck`,
`press`/`release`, `select`/`deselect`), one row per component in 5.3. Justified: Collapsible
"Accordion's change names" is recorded; Switch's `on`/`off` is not. Breaking: yes for consumers'
`transition` type maps and `:active-view-transition-type()` selectors if renamed; the missing
rows are a documents-only fix.

### Low

**L1. Shared types are importable only from the root entry, while the subpath is "the documented form" (9.2).**
`ChangeReason`, `ActionDetails`, `ChangeAction`, `WhilePending`, `RenderProp`, `StateValue`,
`UrgentChangeHandler`, `UrgentHandler`, `Action` are exported from `src/index.ts:490-500` only; no
component `index.ts` re-exports them. The docs state it (`GettingStartedPage.tsx:46`). Standard:
either a `@funstack/ui/types` subpath or each subpath re-exporting the shared types it uses.
Justified: documented, not argued. Breaking: no.

**L2. Five subpath entries do not import the platform typings.**
Conventions 7.4 (`design/conventions.md:1993`): imported "from the package entry and from every
subpath `index.ts`". Missing in `src/field/index.ts`, `src/form/index.ts`,
`src/otp-field/index.ts`, `src/text-field/index.ts`, `src/toast/index.ts` (and `csp`, not a
component). Standard: every component `index.ts`; add it to a lint script. Breaking: no.

**L3. State type naming.**
9.4 allows one `<Component>State` only when **all** parts share it. `NumberFieldState` and
`OTPFieldState` are used although `NumberFieldButtonState` / `OTPFieldSlotState` exist; and where
a part reuses the Root's state some components export an alias (`DialogTitleState`,
`PopoverDescriptionState`, `AccordionTriggerState`) and others none (Select `Trigger` / `Value` /
`Group` / `GroupLabel` / `Separator`, `CheckboxGroupLabel`, `RadioGroupLabel`, `SliderLabel`,
`ToastTitle` / `ToastDescription`, `NumberFieldLabel` / `Input`). Empty states are
`Record<string, never>` in 18 places and `interface MenubarState {}`
(`src/menubar/menubar.tsx:29`). Standard: every part has an exported `<Component><Part>State`
(alias allowed); 9.4's exception becomes "the Root's type may be named `<Component>State` when
other parts alias it". Breaking: no (aliases).

**L4. Public signatures reference unexported types.**
`NumberFieldValueChangeDetails.source: NumberFieldSource`
(`src/number-field/number-field-root.tsx:51`; `NumberFieldSource` is in
`number-field-context.ts:11`, not exported from the entry); `ComboboxRootBaseProps`
(`src/combobox/combobox-root.tsx:136`, exported from the file, not the entry) and the
module-private `AccordionRootBaseProps` / `ToggleGroupRootBaseProps` are the bases of exported
interfaces.
Standard (9.4 "everything public is exported"): export every type a public member names.
Breaking: no.

**L5. Set-valued props are mutable arrays.**
`value?: string[]` / `defaultValue?: string[]` on Accordion, CheckboxGroup, ToggleGroup,
Combobox `multiple`, MultiSelect, and `values: string[]` on `CheckboxGroup.Parent`, while every
`State` exposes `readonly string[]`. An `as const` or `readonly string[]` value does not
type-check as a prop. Standard: props accept `readonly string[]`; actions keep receiving
`string[]`. Breaking: no (input widening).

**L6. Combobox state names the same selection `value` and `values`.**
`ComboboxInputState` / `ComboboxClearState` have both `value: string | null` and `values`;
`ComboboxMultipleRootState` and `ComboboxChipsState` use `value` for the array; MultiSelect uses
`value` for the array; Slider has `value` and `values`. Standard: `state.value` is always the
prop-shaped value; a second, normalised view (`values`) needs one recorded rule. Left to the
value-inputs audit for the decision. Breaking: yes if fields are renamed.

**L7. `data-typeahead` is a library marker without the marker prefix.**
`src/menu/use-menu-item.ts:84` writes the `label` prop to `data-typeahead` and
`src/menu/menu-dom.ts:42` reads it back. It is not a state, is not in 4.1, and the only other
marker is `data-fsui-tooltip-trigger` (decision row 13: elements "the library marks
(`[data-fsui-…]`)"). Standard: markers are `data-fsui-*`; states are unprefixed. Breaking: only
for a consumer who selects on it (undocumented outside MenuPage's "Owned" lines).

**L8. `data-active` has two meanings.** Virtual focus (`Combobox.Option`, `MultiSelect.Option`)
and "the caret is here" (`OTPField.Slot`), and 4.2 uses "active" for `:active` in the same
section. Recorded in 4.1, so listed for awareness; no change proposed unless M2 is taken up.

**L9. `experimental_` prop casing.** `experimental_focusgroup` (Toolbar, `Tabs.List`,
`Menu.Popup`, `ToggleGroup.Root`) is the lowercase attribute name; `experimental_interestFor`,
`experimental_closedBy`, `experimental_interpolateSize`, `experimental_webOTP` are camelCase,
although `interestfor` and `closedby` are equally single lowercase attributes. Standard:
camelCase after the prefix as React would spell the prop (`experimental_focusGroup`), or state
"the feature's own spelling" in section 8. Breaking: yes (rename), cheap while flagged
experimental.

**L10. Part vocabulary table (conventions 1.1) has gaps and one dead name.**
"Reuse these names; invent a new one only when none fits", but the table has no row for
`Title` (Dialog, AlertDialog, Drawer, Popover, Toast), `Close`, `Viewport`, `Link`, `Chips` /
`Chip` / `ChipRemove`, `SubmenuTrigger`, `CheckboxItem` / `RadioItem` / `RadioGroup`; and it lists
`Header` (`design/conventions.md:116`), which no component has. The `Popup` row names Tooltip,
Menu, Popover only. Breaking: no.

**L11. Smaller drift inside `conventions.md`.**
- 2.5.1 table (`:773`): the "with `action`" row omits `Drawer.Close`, which the "without" row
  (`:772`) includes and the code supports (`DrawerCloseProps = DialogCloseProps`).
- 3.7 (`:1368`): "(`Tabs.Panel` today)"; eight parts have `keepMounted` (seven Popups as
  `boolean`).
- 9.4 (`:2173-2177`) "Shared" list names `ViewTransitionClass`, which is React's type and is not
  exported by the library, and omits `UrgentHandler`, which is.
- Decision row 8 (`:37`) lists "customizable `<select>`" among the flag's first customers; no
  `experimental_` prop exists on Select.
- 9.1 "One part per file": `src/combobox/combobox-chips.tsx` (3 parts),
  `src/combobox/combobox-group.tsx` (4), `src/menu/menu-group.tsx` (3),
  `src/multi-select/multi-select-group.tsx` (4), and `NumberFieldIncrementProps` lives in
  `use-step-button.ts`.
- Design docs: no `design/components/toolbar.md` or `meter.md` (covered inside
  `toggle-group.md` / `progress.md`), while Menubar, ContextMenu and AlertDialog each have one.
Breaking: no.

**L12. Dev warnings.** Prefix is `<Component>.<Part>: ` everywhere except
`src/tabs/tabs-list.tsx:111` (`Tabs: the value …`). A part rendered in the wrong place throws for
a missing Root but only warns for a wrong container (`MultiSelect.Option: rendered outside a
MultiSelect.List`, `Combobox.List: rendered outside a Combobox.Popup`,
`Menu.Trigger: rendered in a submenu`). Standard: prefix always names the part; record "missing
owner throws, misplaced part warns" in 9. Breaking: no.

**L13. Docs site page structure.**
- `TextFieldPage.tsx` has no `data-attributes` section; its hooks table sits under `styling`,
  before `keyboard-and-aria`. Every other component page has `data-attributes`.
- `MenubarPage.tsx` puts `props` before `how-it-works`; all others the reverse.
- Data-attribute table header: `Hook` on 32 pages, `Attribute` on Avatar, `Hook or prop` on
  ContextMenu. Keyboard table columns: `Key` / `Interaction` / `Input` and `Behaviour` /
  `Effect` mixed (Effect: Menubar, ToggleGroup, Toolbar, NumberField, OTPField, TextField).
- Closing sections: `not-included` (HoverCard, NavigationMenu), `not-in-this-version`
  (Menubar), `prior-art` (MultiSelect only), `recipes-react` (Drawer only).
- The `render` row is hand-written on 12 pages and comes from `renderProp()` on the rest.
Standard: fixed id order `anatomy`, `how-it-works`, `props`, `data-attributes`,
`keyboard-and-aria`, `forms`, `styling`, `recipes`, `browser-notes`, `not-included`; headers
`Hook | On | Meaning` and `Key | Behaviour`. Breaking: no (anchors `#styling` on TextField and
`#not-in-this-version` on Menubar change).

## 4. Differences that are recorded and justified (not findings)

- `Select.Root` `value` is `string` with `""`, not `null` (conventions 3.1).
- `TextField` triple ends in `valueCommitAction` (3.1, 2.1 commit row).
- `RadioGroup` action typed `string | null`, Tabs `string` (3.1).
- Accordion's `details.item` / `details.open` against `added` / `removed` elsewhere
  (2.2: "stays as is"). Recorded, but it is the one set-valued component off the diff shape;
  aligning is breaking.
- `Form.Root` / `Dialog.Form` `action` and `Button` `formAction` are React's form channel, not
  `Action<[details]>` (2.7); the type guard exempts them.
- No `data-open` on Popups, none on `Select.Root`, none for Tooltip (4.1, browser-owned state).
- `data-swiping`, `data-instant` are attribute-only (4.1).
- `Drawer.Popup` `data-side` is a prop echo, the anchored popups' is resolved (4.1, two rows).
- `whilePending` defaults differ per part (2.5.1 table).
- `Toast.Close` has no `action` and no `pending`; its close is `"dismiss"` (2.2).
- No `transition` prop on Slider, NumberField, OTPField, TextField, Toast, Field, Form, Progress,
  Meter, Avatar (5.3 rows).
- `keepMounted` is `boolean | "until-found"` on `Tabs.Panel` and `boolean` on Popups (3.7).
- AlertDialog and Drawer alias Dialog's types (`alert-dialog.md`, `drawer.md`).
- Toast has no `Root` owner and exports functions (1.1).
- Menubar is a single-element component over consumer `Menu.Root`s (`menubar.md`).

## 5. Suggested order if alignment is approved

1. Documents only, no code: H1, M5, M7 (missing rows), L10, L11.
2. Additive, non-breaking code: H2 (`state.invalid` and same-named state fields), M3 (a) and the
   missing named types, M4, L1 to L5, L12.
3. Breaking renames, to batch into one alpha with aliases where possible: M1, M2, M3 (b)(c),
   M7 (kind names), L7, L9; M6 and L6 need a product decision first.
