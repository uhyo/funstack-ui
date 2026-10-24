# Issue #110: Menu Trigger click while open

Branch `fix/110-menu-trigger-close`. Design: menu.md decision 10 / 2.2 / amendment; conventions 3.5.

## Unfixed code, real engines (new browser row 4, diagnostic log of `openChangeAction` calls)

- Chromium: `[true, activate, keydown]`, `[false, activate, click]`, but the popup was already
  hidden (focusout on mousedown) before the click: wrong timing, reason happened to be right.
- Firefox: `[true, activate, keydown]`, `[false, dismiss, ToggleEvent toggle]`,
  `[true, activate, click]`: the focusout's hide ran as a dismissal, and the click then saw
  `intended() === false` and RE-OPENED the menu. Worse than the architect predicted (they
  expected the click's requestClose to be a no-op).
- WebKit: cannot launch locally (missing host deps); CI covers it.
- Split-press row failed on both at "focus still on the item after mousedown".

## Fix

`Menu.Trigger` `onMouseDown`: `button === 0 && popover.intended()` -> `preventDefault()`.
`PopoverTriggerHandlers` Pick gains `onMouseDown`; `MenuTriggerProps` omits it.

## Mutations (all killed)

- M1 no prevent: 3 jsdom + 4 browser (chromium/firefox rows 4, 5) fail.
- M2 prevent regardless of `intended()`: jsdom row 1 + browser row 6 (chromium, firefox) fail.
- M3 any button: jsdom row 1 (right-button check) fails; browser rows don't cover it.

## CI round 1

Chromium, Firefox, jsdom/ci green; WebKit failed only row 6: Playwright's Linux WebKit focuses a
clicked button (macOS Safari does not; already in cross-engine.md "Focus on mousedown for
buttons"). The issue's "WebKit doesn't focus buttons" is macOS behaviour. Row 6's WebKit branch
now accepts either, requiring only that any focus came while closed. Rows 4 and 5 passed on
WebKit unchanged.

## Review (memo/reviewer/issue-110-review.md)

- F5, for the release notes: `MenuTriggerProps` now omits `onMouseDown` (type-level breaking
  change for consumers passing it as a prop; a `render` element's own handler still runs first).
- F3: row 6 now clicks the plain "outside" button as a baseline and expects the Trigger to be
  focused exactly as that button was (`[true]` or `[]`), one outcome on every engine.
- F1: docs qualify the Trigger press to a `<button>` Trigger; non-button Triggers are #115.
