## What's Changed

### Behaviour Changes

- **Escape handled in JavaScript follows one rule** (#191, #192). These Escape handlers ignore an Escape that is part of an IME composition (`isComposing` or `keyCode` 229), or that another listener already prevented:
  - non-modal Dialog and Drawer
  - Tooltip
  - HoverCard
  - Toast
  - Menubar

  Escaping out of IME text no longer closes the surrounding overlay. A Tooltip no longer hides on an Escape that, for example, a Combobox chip already handled.
- **Toast lets inner layers close first** (#191). While a Tooltip, HoverCard, Menu or other popover or dialog is open inside a `Toast.Root`, Escape closes that layer first, and the next Escape dismisses the toast.

### Fixes

- A controlled control inside a `Field.Root` lost the keystroke that changed the Field's validity, in Chromium (#193). This affected Combobox, controlled `Field.Control` inputs and selects, `Select` and `OTPField`. The keystroke that dismisses a server error was affected too. The Field now updates the browser's validity during the event and its own state right after it.

**Full Changelog**: https://github.com/uhyo/funstack-ui/compare/0.1.0-alpha.23...0.1.0-alpha.24
