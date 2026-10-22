# Probes: wave 11 (#21 skip-delay, #88 context-menu follow-ups), 2026-10-22/23

Playwright Chromium 156.0.8078.4 and Firefox 157.0 (headless, Linux). WebKit cannot launch
locally. Run each script with `node <file>`; outputs are next to them.

| Script | Question |
| --- | --- |
| `skip-delay.mjs` | Native `interestfor` (Chromium): delay of a second tooltip straight from a first one / 300 ms / 800 ms after it closed; inline delays vs `:has(:interest-source)` vs trigger-scoped registered property vs `:root` transition cooldown |
| `drag-release.mjs` | Right button held after a `contextmenu` open with capture on the popup: targets of pointermove / pointerup / mouseup / auxclick, item `:hover`, `elementFromPoint`; no-capture comparison |
| `touch-drag.mjs` | Touch long-press (library timer) then drag onto an item: pointercancel (pan) vs full stream with a non-passive document `touchmove` preventDefault (CDP touch emulation, Chromium only) |
| `wheel-over-popup.mjs` | Wheel over a non-overflowing open popover: does the page scroll; `overscroll-behavior: contain`; popup-scoped wheel `preventDefault()` |
| `csp-style.mjs` | Under `style-src 'nonce-…' 'sha256-…'`: SSR style attribute, CSSOM, setAttribute style, script-inserted `<style>` without / with nonce / matching a hash |
