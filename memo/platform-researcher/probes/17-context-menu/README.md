# Probes: Context menu (#45), 2026-10-22

Playwright Chromium 156.0.8078.4 and Firefox 157.0 (headless, Linux). WebKit cannot launch
locally (missing host dependencies), so WebKit behaviour in the research doc comes from WebKit
source and Bugzilla. Run each script with `node <file>`; outputs are next to them.

| Script | Question |
| --- | --- |
| `events.mjs` | Event order and fields for right-click, ContextMenu key, Shift+F10, touch (CDP touch); popover shown from `contextmenu`; right-click inside / outside while open; keyboard focus return |
| `events2.mjs` | `button` / `pointerId` / `pointerType` of keyboard vs mouse `contextmenu`; left / right / middle click outside; CDP long-press gesture |
| `pointerup-dismiss.mjs` | Popover shown from `contextmenu` (between pointerdown and pointerup on Linux) with the pointer not over it: light-dismissed by the pointerup? (whatwg/html#10905) |
| `pointerup-workarounds.mjs` | Pointer capture on the popup (before / after show), defer to pointerup, microtask, task |
| `anchor-point.mjs` | Placing a popup at a point: virtual anchor + `anchor-name`, virtual anchor as `source`, plain `left/top` + `flip-*`, custom-property `@position-try` rules, absolute anchor inside a scroller |
| `anchor-transform.mjs` | Virtual fixed anchor inside transformed / filtered ancestors |
| `point-try-transform.mjs` | Anchorless `@position-try` placement with a transformed DOM parent (Firefox's wrong values here are the same-task stale fallback of `reopen-same-task.mjs`: all points ran in one task) |
| `reopen-same-task.mjs` | Same-task hide + show at a new point keeps the previous fallback |
| `reopen-gap.mjs` | What clears it: style flush, a frame, re-spelling `position-try-fallbacks` |
| `focus.mjs` | Focus after Escape / `hidePopover()` for non-focusable region, focusable region, button inside region, keyboard open |

Playwright limits: Firefox does not fire `contextmenu` for synthesized ContextMenu / Shift+F10
key presses (Juggler bypasses the widget-level key handling), and Chromium's CDP touch and
`synthesizeTapGesture` long-press did not produce `contextmenu` on desktop headless.
