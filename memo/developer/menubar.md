# Developer memo: Menubar (#170)

Branch `feat/170-menubar`. Design: `design/components/menubar.md` (accepted, de1ccd4d).

## Test plan step 1: a `menu` as a direct DOM child of the `menubar`

Probe: `memo/developer/probes/170-menubar-ax/` (static markup of menubar.md section 1, File
open). Run with `AXE=/path/to/axe-core/axe.min.js node chromium.mjs` (CDP full tree),
`node firefox.mjs` (Marionette, nsIAccessibilityService in the chrome context; driver from
probe 121), `ENGINE=... node axe.mjs` (axe-core 4.14.1 in the engine + Playwright's aria snapshot).

- Chromium 156: `menubar "Application"` > `menuitem "File" expanded=true hasPopup=menu`,
  `menu "File"` (New, Save, separator, menuitemcheckbox Autosave), `menuitem "Edit"
  expanded=false`, `menuitem "View" expanded=false disabled`. The menu is a child of the
  menubar between its Triggers; nothing pruned.
- Firefox 157: `menubar "Application"` > `menuitem "File" [expanded,haspopup]`, `menupopup
  "File"` (menuitem New [focused], Save, separator, check menu item Autosave), `menuitem "Edit"
  [collapsed,haspopup]`, `menuitem "View" [unavailable,collapsed,haspopup]`.
- axe-core 4.14.1: no violations and no incomplete results, closed and open, Chromium and
  Firefox (no `aria-required-children` / `aria-required-parent`).
- WebKit: does not launch on this machine (host libraries). The browser row
  `menubar.browser.test.tsx` runs axe on the real component in all three engines, so WebKit's
  axe result comes from CI. WebKit's own AX tree is not reachable from Playwright on Linux.

Verdict: passes; the anatomy stands. The same assertions run in `menubar.browser.test.tsx` on
the real component (Chromium tree through CDP, axe everywhere). Note: a disabled Trigger (no
`popovertarget`, `aria-haspopup="menu"`) is exposed `expanded=false` by Chromium too.

## Implementation notes

- `internal/menubar-context.ts`: MenubarContext (cross-folder: Menubar, Menu.Trigger,
  Menu.Popup). Registry of menus keyed by Trigger element, registered from the Trigger's ref.
- Switch step 2 needs `hiddenBeforeToggle()`: the popup's own blur rule hides the old menu
  synchronously during step 1, but its `toggle` (the fact) is a task, so `intended()` is still
  true; without the check the switch would also send `openChangeAction(false, "dismiss")` to a
  menu that is already hidden.
- A second switch while the first target's open is pending: the new target's open is entangled
  with the pending transition and commits when it settles (jsdom row pins `data-open` meanwhile).
- `usePopoverTrigger` got `alwaysFocusable` (aria-disabled, focusable) without `submenuItem`'s
  warning text.
- Menu.Popup provides `MenubarContext` `null` to its content (the bar's context ends there).
- Switch keys read the bar's direction (conventions 14.1.3: the container of the move).
