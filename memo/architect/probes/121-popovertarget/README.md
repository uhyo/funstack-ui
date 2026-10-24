# #121 probes: `popovertarget` versus `commandfor`

Plain-DOM pages, Playwright builds Chromium 156.0.8078.4 and Firefox 157.0 (2026-10-24).

- `probe.mjs` + `page.html`: real-pointer light dismiss (cancelled click, library style), cancelled
  activation, native toggle + implicit anchor, `ToggleEvent.source`, `command` events, nested
  stacking (sibling and descendant inner popovers), a press on the outer invoker with a stack open.
  Output: `output.txt`. Run: `node probe.mjs` (`ENGINES=chromium` to pick).
- `ax-*.mjs` + `ax-page.html`: accessibility tree exposure of `popovertarget` shapes (plain,
  `show`, `hide`, disabled, `role=menuitem`, explicit `aria-expanded="false"`, missing / non-popover
  target) and of a hide button inside its own popover with each attribute. Chromium through CDP,
  Firefox through Marionette in the chrome context (driver copied from
  `memo/platform-researcher/probes/20-invoker-aria-expanded/run-firefox.mjs`). Outputs:
  `ax-chromium.output.txt`, `ax-firefox.output.txt`.
