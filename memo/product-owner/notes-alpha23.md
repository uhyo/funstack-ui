## What's Changed

This release fixes the follow-ups from the component survey waves.

### Behaviour Changes

- **Close parts show pending until their close commits** (#183). `Dialog.Close`, `Popover.Close`, `Drawer.Close`, `AlertDialog.Cancel`, `AlertDialog.Action` and a closing `Menu.Item` show `data-pending` / `state.pending` from the click until the close commits, even without an `action`. A Cancel whose close waits behind a pending Action no longer looks dead. A part without `action` renders no `aria-disabled` while it waits; `Menu.Item` used to render it. `Menu.Item` without `action` now also sends its close request during the click, as the Close parts do.
- **Escape in a non-modal Dialog or Drawer** (#177). An inner manual HoverCard or Tooltip closes first, and the next Escape closes the dialog. `preventDefault()` on the Escape from any listener keeps the dialog open; `stopPropagation()` does not, matching modal dialogs and the other overlays. It also works inside closed shadow roots.
- **Form reset with a real reset button** (#185). Controls now update after the browser's reset algorithm, both for a `<button type="reset">` and for a script `form.reset()`.

### Fixes

- A real reset button left a Combobox input empty instead of restoring `defaultInputValue` (#185).
- `Field.Root` kept a shown error, `aria-invalid` and a stale `validate` message after a real reset (#185).
- A reset cancelled with `preventDefault()` in `onReset`, or in a document listener, still reset the library's controls (#185).
- Accordion and Collapsible: a browser reopen of a `<details>` while a close was pending was dropped (#175).

**Full Changelog**: https://github.com/uhyo/funstack-ui/compare/0.1.0-alpha.22...0.1.0-alpha.23
