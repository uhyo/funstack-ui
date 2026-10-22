# Developer memo: wave 11 Part B, interaction (2026-10-23, #21, #88)

Design: tooltip.md 6 + Part B; context-menu.md 2.2, 2.6, 3.1, 4.2, 4.3, 4.6-4.8, 5, 12, 13,
14 + Part B; menu.md wheel note; conventions 12 / decision 13. Branch `wave11/interaction`.

## What shipped

- Tooltip skip-delay. JS path: `otherOpenTooltip(doc, popup)` at `pointerenter` / focus-visible
  focus; found -> `clear()`, `other.hidePopover()`, `show()` now. Native path: the flagged Trigger
  renders `interest-delay-start: calc(<delay>ms * (1 - var(--fsui-tooltip-warm)))`, the
  `data-fsui-tooltip-trigger` marker and `<style href="@funstack/ui/tooltip-warm"
  precedence="fsui" nonce>` (`internal/tooltip-warm.ts`).
- `@funstack/ui/csp`: `CSPProvider` (`csp/csp-provider.tsx`, client) over
  `internal/csp-context.ts`; `STYLE_SHA256` (`csp/style-hashes.ts`, keyed by href, base64);
  `csp.test.tsx` recomputes it with `node:crypto`. Root entry re-exports both. tsdown entry +
  package.json `./csp`.
- Menu: eight `@position-try` options with `--menu-point-gap`; `MENU_POINT_FALLBACKS
  [direction][offset ? "touch" : "mouse"][generation % 2]`; `placement.offset`; mouse `top:
  calc(y + gap)`, touch `bottom: calc(100% - y + gap)`, gap 0px / 16px inline.
- Press-drag-release in `menu-context-trigger.tsx` (`startDrag`, `guardTouch`), started only
  when `capturePointer` succeeded (it now returns a boolean). SubmenuTrigger hover intent is
  reachable from the gesture through a WeakMap registry (`registerSubmenuHover` /
  `submenuHover` in `menu-context.ts`).
- `listenOutside` (menu-popup.tsx) gains close-on-scroll (point placements only, read through
  `useLatest(menu.placement)` at event time) and the popup `wheel` guard (every root menu).

## Findings / deviations (report them)

1. **Touch lift light-dismissed the offset menu in Chromium.** CDP touch emulation: after the
   long-press opened the menu above the finger, a lift in place produced `pointerup` (captured,
   popup), `touchend`, then the popover closed (`beforetoggle`) before a `click` on the region.
   The synthesised tap/click outside the popover light-dismisses it; before wave 11 the click
   landed on the menu (corner under the finger). Fix: the touch guard also cancels the lift's
   `touchend` (non-passive document listener), which suppresses the click, and ends at
   `touchend` / `touchcancel` / `pointercancel` (or 250 ms after the `pointerup` if no touch
   event follows). Design 2.2 says the guard ends at that pointer's `pointerup`.
2. **Drag activation disarms the long-press click swallow first**: the swallow is a document
   capture `click` listener, so it would eat the library's own `item.click()` after a touch slide.
3. **The gesture starts only when `setPointerCapture` did not throw** (synthetic pointers), so a
   later real release cannot double-activate an item through a stale gesture.
4. **Wheel guard walks the ancestors** from the target up to the popup and lets the wheel through
   if any of them can scroll that way (overflow auto/scroll + room), not only the innermost
   `[role="menu"]`: a consumer scroller inside a menu keeps working. Dominant axis only.
5. **`--menu-point-gap` is also emitted with `side={null}`** (4.7 says readable by such a
   consumer; 3.3's table lists x / y only).
6. **JS skip-delay finds the open tooltip by iterating `[role="tooltip"][popover]` and asking
   `:popover-open`** instead of one `querySelector('[role="tooltip"]:popover-open')`: same
   result in browsers, and jsdom's shim answers `matches` only.
7. Browser rows changed for load-robustness: "survives the pending pointerup" moves 2 px (within
   the slop) instead of 60 px; the old held-move row releases within the slop; the L4 row asserts
   the 500 ms rule against the events' timestamps (quick release -> open; else closed with a
   warning) and its second half sleeps 600 ms and asserts `elapsed >= 500` before "dismiss".
   The pointer for the second L4 press must be off the menu: a press on the menu's top-left
   pixel targets the popup (no move).
8. React keeps a hoisted style per document and never re-inserts one removed by hand: jsdom rows
   that count `<style>` elements render into `document.implementation.createHTMLDocument()`
   (no window: use `getAttribute`, not jest-dom / role queries).
9. A streamed SSR (`renderToReadableStream`) in a file that later renders on the client logs
   React's "multiple renderers concurrently rendering the same context provider" in the client
   rows; the SSR nonce rows live in `csp/csp.test.tsx`.

## Tests

jsdom: tooltip skip-delay (8 rows + 4 native-markup rows), csp (5), context menu touch offset
(7), press-drag-release (13), scroll / wheel (6), CSP (2), eight-option `<style>`. Browser:
tooltip skip-delay (baseline and flagged markup; condition: B opened in the same task as A's
close), context menu press-drag-release (4 + CDP touch drag), touch offset (2), scrolling (4).
Mutation-checked: the warm rule set to 0 fails the flagged Chromium row.

## Review fixes (wave11/interaction-fixes, memo/reviewer/wave11-interaction.md)

- M1: `warmDelay` is `calc(<delay>ms * (1 - var(--fsui-tooltip-warm, 0)))`. Without the
  fallback, an unregistered property makes the declaration invalid at computed-value time and
  Chromium uses `normal` (500 ms). The `<style>` renders beside the Trigger element (fragment), so
  `render={<a href>Text</a>}` (render children win in mergeProps) keeps it. Browser rows: style
  removed by hand (re-inserted in `finally`; React never re-inserts it) and a CSP-blocked iframe
  (`srcdoc` with `<meta http-equiv=CSP content="style-src 'none'">`, render into its body; the
  blocked `<style>` has `sheet === null` in Chromium and Firefox). Firefox drops the unknown
  `interest-delay-start` from the inline style entirely, so assert computed values only where
  `CSS.supports("interest-delay-start", "0s")`.
- M2: the 500 ms count from the first open `toggle` (`shownAt`), or from the gesture start when
  the popup is already showing (a move). Browser timing helper uses max(contextmenu, menu toggle).
- M3: recipe removed; CSS cannot tell a warm open from a cold one. Needs library state
  (`data-instant`), follow-up for the architect.
- L1/L2: csp.test.tsx rows: object nonce without provider drops the rule; none / string form
  keep it without nonce; Fizz merges same-precedence styles (probe precedence); guard: SSR of
  tooltip + context menu emits exactly one fsui `<style>` matching its hash. Constraint comment on
  `FSUI_PRECEDENCE`.
- L3: `ctrlKey` wheels pass. L4: the touch guard ends only at a `touchend` after the gesture
  pointer's own `pointerup` (no Touch.identifier on pointer events; pairing by dispatch order);
  other fingers' `touchend` is still prevented.
- L6: close-on-scroll ignores scroll events until the first animation frame without one after
  the open toggle (scroll events run before rAF callbacks in a frame). jsdom has rAF; rows wait
  one frame (`nextFrame`) before scrolling. Browser scroll row waits for the toggle + one frame.
