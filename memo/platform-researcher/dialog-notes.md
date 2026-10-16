# Working notes: <dialog> research (2026-10-16)

Probes: `probes/04-dialog/` (run with `node <file>.mjs`; outputs saved next to each as `*.output.txt`).
Engines: Playwright 1.64.1 Chromium 156.0.8078.4, Firefox 157.0. WebKit cannot launch locally
(missing system libs, see memo/developer/browser-mode.md) and Playwright WebKit is a trunk build
anyway, so the WebKit column comes from Safari 27.0 release notes, STP notes and wpt.fyi stable
(Safari 27.0 run 6222887987183616, 2026-10-15).

Gotchas for future probes:
- Playwright `page.evaluate` runs with a user gesture (navigator.userActivation.hasBeenActive is
  true afterwards). It re-arms the close-watcher "history-action activation", so an evaluate
  between two Escape presses makes the second `cancel` cancelable again. Do not interleave
  evaluate between close requests when testing anti-abuse.
- elementFromPoint is useless for top-layer exit animations; sample screenshot pixels (pngjs is in
  node_modules/.pnpm/node_modules/pngjs).
- esbuild SSR bundle must be CJS (`--format=cjs`), ESM output breaks on react-dom/server's
  dynamic `require("util")`.

Things to re-check later:
- Safari `closedby` / CloseWatcher: STP 242 (closedby), STP 249 (close watchers 316680@main).
  Not in Safari 27.0. WebKit umbrella bug 284592. Interop 2026. Drop the flag when a 27.x ships it.
- Safari 27.0 focus bugs fixed in STP 251/252 (focus restore target, non-modal close stealing
  focus, show() focusing steps). wpt dialog-focus-previous-outside 3/6 on 27.0.
- Chromium `DialogNewFocusBehavior` still `experimental` in runtime_enabled_features.json5 (main,
  2026-10-16): no keyboard-focusable filter, `autofocus` on <dialog> ignored. Firefox implements.
- Firefox display animation: meta bug 1834877 NEW; 2057013 "enable pref on Nightly" NEW.
  No exit animation for dialog or popover in Firefox 157 (verified by screenshots). Entry
  (@starting-style) works.
- CSSWG "remove overlay" issue still open (Dec 2025 proposal by Joey Arhar).
- react/react#37261 (hydrated dialog never fires onToggle/onBeforeToggle), fix PRs #37262,
  #37293 open. #37580 (stop emulating toggle bubbling) merged 2026-09-14, NOT in 19.3.1 (checked
  `accumulateTargetOnly` still only scroll/scrollend). #23301 autoFocus inside dialog, open.
- whatwg/html#7732 (prevent page scroll under modal dialog) open, last activity 2025-10.

Corrections to modern-platform-survey.md (reported to team lead, not edited):
- `requestClose()` IGNORES `closedby` (spec note + probe: closes a closedby="none" dialog, and
  so does command="request-close"); only Escape/back/light dismiss respect it.
- Firefox has no CSS exit animations for top-layer elements (popover-anchor-tooltip.md says adopt
  for open/close animation; open works, close does not in Gecko).
