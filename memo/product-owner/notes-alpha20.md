## What's Changed

This release fills the most common component gaps found in a survey of six headless UI libraries (#162).

### Breaking Changes

- A `Dialog.Close` or `Popover.Close` with an `action` no longer renders `commandfor` / `command` (#182). Before hydration a click on it used to close the dialog or popover natively without running the action; it now does nothing until the page has hydrated. A Close without `action` is unchanged. CSS selectors on `[command]` no longer match such a button.

### Features

- **Collapsible** (`@funstack/ui/collapsible`, #163): a standalone disclosure on `<details>` / `<summary>`. It works with no JavaScript in Server Components, and with `open` / `defaultOpen` / `openChangeAction` it gets action-driven open state, optimistic `data-open`, find-in-page support and `::details-content` animation.
- **Combobox `multiple`** (#164): multiple selection with `Combobox.Chips`, `Combobox.Chip` and `Combobox.ChipRemove`. The value is a `string[]` in pick order with per-change rollback. Chips are reachable by keyboard behind one Tab stop, removals are announced (`announceRemoved`), and each value posts as its own hidden input. `required` means at least one.
- **HoverCard** (`@funstack/ui/hover-card`, #166): a rich, interactive preview for a link. It opens on hover or keyboard focus after a delay (600 / 300 ms), Tab moves into the open card, and suspending content opens when ready. `experimental_interestFor` and `experimental_hint` flags are included.
- **MultiSelect** (`@funstack/ui/multi-select`, #165): a select-only multi-select listbox (trigger button + popup). Picks toggle without closing, values come back in pick order, options may suspend on open, and it takes part in forms, including `required` with `Field.Error`. `<Select.Root multiple>` warns and points here.
- **AlertDialog** (`@funstack/ui/alert-dialog`, #167): always modal, `role="alertdialog"`, no light dismiss, initial focus on `Cancel`. `Action` runs an async action and closes when it resolves. `AlertDialog.Form` gives a JS-free Server Function confirm.
- **Separator** (`@funstack/ui/separator`, #169): an `<hr>` with `orientation` and `decorative`; a Server Component.
- `Field.Control` works outside a `Field.Root` as the plain control (#169).

### Fixes

- A Slider's Track and Thumb, and NumberField's Increment / Decrement, no longer change the value inside a `<fieldset disabled>` (#180).

**Full Changelog**: https://github.com/uhyo/funstack-ui/compare/0.1.0-alpha.19...0.1.0-alpha.20
