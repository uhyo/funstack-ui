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

## WebKit native radio arrows (2026-10-17, RadioGroup)

The `browser (webkit)` job failed since RadioGroup landed: two keyboard rows. Genuine WebKit
behaviour, not ours (RadioGroup installs no key handler, vision: native platform first):
`RadioInputType::handleKeydownEvent` (WebKit main) maps Down/Right to "next" and Up/Left to
"previous", walks `NodeTraversal::next/previous` for a same-name focusable radio, focuses and
clicks it, and simply stops at the end. Comment in the source: "even for RTL, left still means
previous radio button" (matching old WinIE). So in WebKit:
- no wrap at either end (pressing past the end does nothing and dispatches nothing);
- no RTL mirroring of Left/Right.
Upstream: WebKit bug 145687 (2015 patch to cycle in the group, never landed). Not reported by us.

Tests branch on `browserName !== "webkit"` (`arrowsWrap`, `arrowsMirrorRtl` in
radio-group.browser.test.tsx) and assert the degraded sequence, including that the end press
does not dispatch ("once per press" still holds for every press that moves). Docs page notes it.
design/components/radio-group.md sections 5 and the keyboard table claim wrap + RTL in all
engines; reported to the architect rather than edited.

## `focusgroup` native path (issue #43, 2026-10-17)

`Tabs.List experimental_focusgroup` never took the native path: the check was
`"focusgroup" in HTMLElement.prototype`, always false; the IDL attribute is `focusGroup`
(Chromium 156 reflects it as a token list, e.g. `{0:"tablist",1:"inline",2:"wrap"}`).
`supportsFocusgroup` in `src/__tests__/engine.ts` now pins it (true only in Chromium).

Fixing only the check made things worse: probing Chromium 156 showed an element with an explicit
`tabindex="-1"` is left out of the focusgroup, so with roving tabindex the JS handler stepped
aside and the browser moved nothing. Fix: List detects with useSyncExternalStore (server snapshot
false, so hydration matches; replaces the ref-in-effect, which oxlint flags as set-state-in-effect
once it became state) and provides
`TabsListContext`; on the native path unselected Tabs render no `tabindex`. Also added `nomemory`
to the focusgroup value and `focusgroupstart` on the selected Tab (rendered with the flag, inert
elsewhere): without them Chromium re-enters on the last focused item, which in manual activation is
not the selected tab (APG says the selected one). Probe results: `tablist inline wrap nomemory` +
`focusgroupstart` on B -> Tab enters B, Shift+Tab back in enters B. Browser test
"Tabs.List experimental_focusgroup" asserts the native path by `defaultPrevented === false` at a
document keydown listener (JS path prevents). design/components/tabs.md and conventions.md section
8 still describe roving tabindex unchanged on the native path; reported, not edited.

## Combobox (2026-10-17, #50)

- Implicit form submission on Enter: Firefox 157 submits before React's scheduled flush of a
  `useOptimistic` update made in the keydown (Chromium 156 after). Anything the key's default
  action must see has to be flushed with `flushSync` in the handler.
- Logical `position-area` keywords on a top-layer popover resolve against the root's direction:
  `dir="rtl"` on a container does not flip them in Chromium; Firefox misplaces. Page-level RTL is
  fine in both. Details in combobox.md.
- Escape hides an auto popover synchronously but its `toggle` is a task: key handlers that run
  in between must read `:popover-open`, not the library's intended state.
- Firefox keeps keyboard focus in a removed iframe; restore `window.focus()` after iframe rows.
