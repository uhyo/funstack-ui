## What's Changed

### Behaviour Changes

- **`stopPropagation()` no longer keeps an overlay open on Escape** (#194). Non-modal Dialog and Drawer, Tooltip, HoverCard and Toast record the Escape in the capture phase and decide after it has fully dispatched. Only `preventDefault()` keeps a layer open, as with native modal dialogs and popovers. One Escape still closes one layer:
  - First, a Trigger's pending open is cancelled.
  - Then Tooltip and HoverCard close, in the order they opened.
  - Then the dialog or toast the Escape came from closes, innermost first.
- **Toast order:** if a Tooltip or HoverCard is showing elsewhere while focus is in a toast, Escape now closes it before the toast, as a non-modal Dialog already did.
- **Known limit:** when propagation was stopped, a modal dialog or `auto` popover around the layer that closed also closes on the same Escape.

**Full Changelog**: https://github.com/uhyo/funstack-ui/compare/0.1.0-alpha.24...0.1.0-alpha.25
