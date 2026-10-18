# Wave 6 probes (2026-10-18): ToggleGroup/Toolbar, NumberField, Progress/Meter

Chromium 156.0.8078.4 and Firefox 157.0 (Playwright 1.64.1). WebKit cannot launch locally.
Run each file with `node`.

- `toolbar-focusgroup.mjs` - `focusgroup="toolbar"`: arrows, Home/End, RTL, `block`, `wrap`,
  memory, `nomemory` + `focusgroupstart`, `disabled` vs `aria-disabled`, text/number inputs as
  items, nested `focusgroup="radiogroup"` (extra Tab stops), `preventDefault`; Chromium AX roles.
- `toolbar-input-tab.mjs` - Tab / Shift+Tab from a text input inside a focusgroup toolbar go to
  the next / previous toolbar item; a handled ArrowDown on an item suppresses the move.
- `number-platform.mjs` - native `<input type=number>`: keys, off-grid stepping vs `stepUp()`,
  empty stepping, wheel (focused/unfocused), typed strings under lang/locale combinations,
  validity and messages, selection API, FormData/reset, Chromium AX (`valuemin/max 0` bug).
- `number-chromium-lang.mjs` - Chromium localises number input from the UI language (`--lang`),
  not from `lang` or the locale override.
- `number-hidden-validity.mjs` - visible text + visually hidden `type=number` (Base UI shape):
  invalid submit focuses the aria-hidden input unless its message is mirrored onto the visible one.
- `progress-meter.mjs` - styled `<progress>`/`<meter>` via vendor pseudo-elements (screenshot
  sampling), indeterminate, RTL/vertical, children not rendered, fill transition (Chromium only),
  `labels`, Chromium AX for native and ARIA progressbar/meter.
