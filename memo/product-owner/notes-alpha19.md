## What's Changed

This release is mostly an internal refactoring wave (#157): shared cores replace duplicated logic across components, backed by about 180 new tests. A few behaviours were aligned along the way.

### Behavior Changes

- A disabled `Button` whose click the browser itself acts on (resolved `type="submit"`/`"reset"`, including the `formAction` default, or `commandfor`/`popoverTarget`) is now natively `disabled` even when it renders through a component and even when it has an `action`, so it cannot submit or run its command before hydration. `Toolbar` and `focusableWhenDisabled` still keep it focusable with `aria-disabled`. When `disabled` and pending (`whilePending="ignore"`) at once, the native `disabled` wins (#158).
- `Accordion.Root` in multiple mode passes its `next` value in document order, also when an Item mounts late or is inserted between others (#157).
- `Form.Root`: a superseded submission's rejection, or one that settles after the form unmounted or was hidden, now goes to `reportError` like every other action (#157).
- A JS-free disabled Dialog/Popover Trigger or Close rendered as a link now has `aria-disabled` and cancels its click (#158).
- Development warnings start with the part name (`Tooltip.Trigger: …`, `Dialog.Form: …`); two warnings now fire once per instance under StrictMode (#157).

### Features

- `Toast.Action` and `Toast.Close` accept `disabled` (native on a button, `aria-disabled` with a cancelled click on a link or component render) and expose `disabled` in their state (#157).

### Fixes

- A Dialog, Popover, Menu or Combobox whose popup element remounts in the middle of a close (e.g. `transition` changes) no longer gets stuck; a user dismissal lost to the remount is still reported to `onOpenChange` (#159).
- `whilePending`-related: `Form.Submit` with a non-button host render gets `aria-disabled` instead of a meaningless native `disabled` (#157).
- Select's development warning texts no longer ship in production builds (#161).
- A replaced `Toast.Viewport` (key change, moved between parents) no longer warns about a second Viewport.

**Full Changelog**: https://github.com/uhyo/funstack-ui/compare/0.1.0-alpha.18...0.1.0-alpha.19
