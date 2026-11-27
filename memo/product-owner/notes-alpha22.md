## What's Changed

### Features

- **Menubar** (`@funstack/ui/menubar`, #170): a `<div role="menubar">` around ordinary `Menu.Root`s. A `Menu.Trigger` inside it becomes a `menuitem`. The bar has one Tab stop with arrow-key movement between Triggers. ArrowRight and ArrowLeft inside a menu switch to the next or previous menu, and hovering another Trigger switches while a menu is open. A disabled Trigger stays focusable and keeps menu mode. Each menu keeps its own open state and actions; outside a bar, Menu is unchanged.
- **NavigationMenu** (`@funstack/ui/navigation-menu`, #170): site navigation with flyout panels, following the disclosure pattern (no menu roles). It works without JavaScript by default: links are in the server HTML, and toggle, Escape, light dismiss and one panel at a time are native. `NavigationMenu.Link` closes its panel when followed. Focus leaving an Item closes it. A panel whose content loads on open uses `openChangeAction`, with `data-pending` on the Trigger.
- **Direction and locales** (#172): `dir` (CSS `direction`) is the only direction switch. There is no `DirectionProvider`, and `locale` is a prop on each Root that formats. A new guide page, "Direction and locales", covers what mirrors in right-to-left pages.
- `locale` on `Progress.Root` and `Meter.Root` now accepts a list of tags (`string | readonly string[]`), as on NumberField.

### Behaviour changes

- `OTPField.Root` renders `dir="ltr"` unless you pass `dir`. Inside a right-to-left page its boxes no longer mirror, and its arrow keys now behave the same in every engine.

**Full Changelog**: https://github.com/uhyo/funstack-ui/compare/0.1.0-alpha.21...0.1.0-alpha.22
