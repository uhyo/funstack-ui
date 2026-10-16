# Developer memo: cross-engine browser tests (2026-10-16, issue #23)

Engines: Playwright 1.64.1 = Chromium 156.0.8078.4, Firefox 157.0, WebKit 27.2 (trunk build;
not the same thing as Safari 27.0). Vision targets latest stable (Firefox 158 per the research
doc); Playwright's Firefox lags one release.

Local runs: Chromium and Firefox, 9 consecutive full runs green (57 passed, 3 skipped across
both). WebKit could not be launched on this machine (host libraries, see `browser-mode.md`), so
the WebKit column below is reasoning plus CI, not a local run.

| Area | Chromium | Firefox | WebKit | What the tests do |
| --- | --- | --- | --- | --- |
| `interestfor` native path | native | absent → JS path | absent → JS path | Native suite `skipIf(!supportsInterestFor)`; new fallback test `runIf(!supportsInterestFor)` asserts the attribute stays, the engine ignores it and the library's `showPopover` opens/closes it. |
| `popover="hint"` | yes | yes (157) | unknown in PW 27.2; absent in Safari 27.0 | `.popover` reflection asserted as `"hint"` or `"manual"` by `supportsPopoverHint`; Escape and stacking tests have the same expectations either way (a `manual` popover never closes an `auto` one, and the JS path handles Escape). Environment test pins hint=true for Chromium/Firefox and logs WebKit's value. |
| CSS anchor positioning (`anchor()`, `anchor-size()`, implicit anchor from `showPopover({ source })`) | yes | yes | expected (Safari 26+) | Unchanged. Gecko's missing `anchor()` interpolation is not exercised: no test animates an anchored value. |
| `<details name>` exclusivity, summary Enter/Space, `toggle` as `ToggleEvent` | yes | yes | expected (Safari 17.2+) | Unchanged; environment test asserts `name` on `HTMLDetailsElement`. |
| Focus on mousedown for buttons | yes | yes | Linux builds yes; macOS WebKit no | Tabs pointer test now records whether focus preceded the click and expects `focusin` (automatic) only then, else `click`. "Exactly once" holds either way. |
| Tooltip delay timing | ok | flaky: `sleep(50)` overran the 150 ms delay once under three-engine parallel load | n/a | Replaced "still closed after 50 ms" with timestamps: `beforetoggle` time minus `pointerenter` time >= 145 ms. Test-only flake, not a library bug. |

Library bugs found: none. Every failure seen was a test assumption (timing, `.popover` reflection,
Chromium-only focus/interest behaviour).

Things to watch on the first WebKit CI run:
- Escape inside a modal `<dialog>` / `popover="auto"` menu: relies on WebKit not issuing a close
  request for a keydown the library `preventDefault()`s.
- Accordion "form controls in summary" clicks a `<select>`; if WebKit opens a native menu that
  blocks, that is a Playwright limitation (skip with a comment), not a library bug.
- `userEvent.tab()` onto a button (Tooltip keyboard test) depends on WebKit's tab-focus setting.
- `details` `toggle` being a `ToggleEvent` (Accordion platform-path test).
