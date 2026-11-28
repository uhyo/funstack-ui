## What's Changed

This release aligns the whole library to one standard per topic, after a consistency audit of every component (#199–#202). Similar components now share the same prop names, details shapes, data attributes, keyboard rules and type names. Because the library is in alpha, the renames ship without deprecated aliases: see the migration column below.

### Breaking Changes

**Props and behaviour**

| Component | Change | Migration |
| --- | --- | --- |
| Accordion | `valueChangeAction` details are `{ reason, added, removed }`; `details.item` / `details.open` are gone. An exclusive switch reports both sides | read `details.added` / `details.removed` |
| Accordion, Collapsible | `state.open` is `false`, not `undefined`, in JS-free mode | don't test for `undefined`; style with `:open` |
| Accordion | arrow keys and Home / End reach disabled triggers; with Alt, Ctrl or Meta held, or once prevented, they are left to the browser | none |
| Toggle, Checkbox, Switch, `RadioGroup.Item`, `CheckboxGroup.Item` / `Parent`, `ToggleGroup.Item`, `Tabs.Tab`, `Accordion.Trigger`, `Collapsible.Trigger` | the `transition` prop is removed: parts whose rendered state is all optimistic take no transition | wrap the content in your own `<ViewTransition>` keyed on the `fsui-*` types; for Accordion / Collapsible the Item's or Root's boundary already covers the trigger |
| Toast | `Toast.Action`'s `closeOnSettle` is `closeOnActivate`, as on the Menu items (`Dialog.Form` keeps `closeOnSettle`) | rename the prop |
| Combobox, MultiSelect | a disabled control (its own `disabled` or `Field.Root disabled`) is no longer submitted, like every other control | don't expect the value of a disabled field on the server |
| Combobox | Escape with the listbox closed and edited text reverts to the committed value's text (with `multiple`: clears the search text) and is consumed, like TextField and NumberField. Escape while an open is on its way cancels the open and keeps the text | one more Escape closes an enclosing dialog |
| Toolbar | a disabled `Toggle`, `ToggleGroup.Item`, or Menu / Popover / Dialog / AlertDialog / Drawer Trigger inside a Toolbar is `aria-disabled`, focusable and in the arrow sequence (WAI-ARIA toolbar pattern), like `Button` | style `[data-disabled]`, not `:disabled`, inside a toolbar |
| Dialog, AlertDialog, Drawer | a Trigger in JS-free mode carries `data-open` while its dialog is open, like Popover | a `[data-open]` rule on such a Trigger starts to match |
| Separator, `Menu.Separator` | render `role="separator"` (`"none"` when decorative), like `Toolbar.Separator`; a `render` element's `role` no longer wins | remove `role` from the `render` element |
| Tabs, Toolbar, ToggleGroup, Menu | `experimental_focusgroup` is `experimental_focusGroup`; a `focusgroup` / `focusgroupstart` attribute is owned (removed without the flag) | rename the prop; use the flag |

**Data attributes and view-transition types**

| Component | Change | Migration |
| --- | --- | --- |
| Combobox | `Combobox.Input` renders `data-empty` while nothing is selected; `data-selected` is gone | `[data-selected]` → `:not([data-empty])` |
| MultiSelect | `MultiSelect.Value` renders `data-empty`; `data-placeholder` is gone | rename the selector |
| Accordion, Collapsible | `fsui-accordion-expand` / `-collapse` and `fsui-collapsible-expand` / `-collapse` are `-open` / `-close` | rename in type maps and `:active-view-transition-type()` |
| Switch | `fsui-switch-on` / `-off` are `fsui-switch-check` / `-uncheck` | rename |
| Menu | the internal marker `data-typeahead` is `data-fsui-typeahead` | don't select on the marker |

**Type errors for props the library owns.** These were always overwritten or ignored; passing them is now a type error (hyphenated `aria-*` keys error only in typed props objects, not inline JSX, because of how TypeScript checks JSX).

- `readOnly` on Checkbox, Switch, `RadioGroup.Item`, `CheckboxGroup.Item` / `Parent`, `Combobox.Input` (it never had an effect).
- Dialog, AlertDialog, Drawer, Popover Trigger and Close parts: `type`, `commandfor`, `command`, `popoverTarget`, `popoverTargetAction`, `aria-disabled`; the dialog Trigger's `onPointerDown`; `popover` on a dialog Popup.
- Menu: `id`, `role`, `onPointerMove` on `Menu.Trigger`; `type`, `role`, `tabIndex`, `aria-disabled` on the items (and `id` on `SubmenuTrigger`); `tabIndex` on `Menu.Popup`; `role` on `Menu.Separator`.
- Toast: `type`, `aria-disabled` on `Toast.Action` / `Toast.Close`; `tabIndex`, `inert` on `Toast.Root`.
- Tabs: `role`, `aria-orientation`, `tabIndex` on the List; `role`, `type`, `tabIndex`, `aria-selected`, `aria-disabled` on a Tab; `role` on a Panel.
- Toggle, `ToggleGroup.Item`, the Accordion and Collapsible Triggers: `aria-disabled` (use `disabled`).
- `Toolbar.Separator` `role`, Menubar `aria-orientation`, `Form.Submit` `onClick` / `aria-disabled`, `Field.Label` `onClick`.

Use the `render` element or a `ref` for a raw event handler.

**Type renames**

- `ComboboxSingleProps` / `ComboboxMultipleProps` → `ComboboxRootSingleProps` / `ComboboxRootMultipleProps`
- `ToggleGroupMultipleProps` / `ToggleGroupExclusiveProps` → `ToggleGroupRootMultipleProps` / `ToggleGroupRootExclusiveProps`
- `TextFieldValueChangeDetails` → `TextFieldValueCommitDetails`; NumberField's `valueCommitAction` takes `NumberFieldValueCommitDetails`
- `MenuItemDetails` → `MenuItemActionDetails`; `DialogCloseDetails`, `DrawerCloseDetails`, `AlertDialogCancelDetails` → `DialogCloseActionDetails`, `DrawerCloseActionDetails`, `AlertDialogCancelActionDetails`

### Improvements

- Every data attribute has a same-named state field, and every state field its attribute: `state.invalid` / `state.required` on every control inside a Field, `state.empty`, `data-disabled` / `data-pending` on Label parts, `data-open` / `data-pending` on `NavigationMenu.Item`, `data-submenu`, `data-priority`, `data-decorative`, `data-dragging`, `data-orientation` on Tabs Panel / Indicator and Menubar, `data-required` on `MultiSelect.Trigger`.
- `reason` on the details of Toggle, ToggleGroup, `Menu.CheckboxItem` and `Menu.RadioGroup`; new named details types (`PopoverCloseActionDetails`, `MenuCheckboxItemCheckedChangeDetails`, `MenuRadioGroupValueChangeDetails`, ...) and state aliases for every part.
- `Accordion.Root` gains `loop` and `state.value`.
- Set-valued props accept `readonly string[]`.
- Development warnings: controlled/uncontrolled mode switches on OTPField `value` and Combobox `inputValue`; missing accessible names on TextField, NumberField, Select, Checkbox, Switch, the group Roots, ToggleGroup, an icon-only Toggle and a Slider thumb.
- The docs site and the bundled agent skill use one vocabulary and one page layout throughout.

**Full Changelog**: https://github.com/uhyo/funstack-ui/compare/0.1.0-alpha.27...0.1.0-alpha.28
