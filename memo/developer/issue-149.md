# #149: Server Components page FAQ accordion animates open but not close

Branch `fix/149-accordion-close` (not merged; PO merges).

## Root cause

Not the CSS recipe and not the library. The `::details-content` grid-rows + `content-visibility
allow-discrete` transition runs on close in Chromium and Firefox (measured item heights per frame,
and screenshots mid-transition with a 3 s duration: the panel text is visible while collapsing).

The FAQ is the last thing on the page, and only the footer follows it, so on a normal viewport
(1280x800) the page cannot scroll it higher than y=332: a reader looking at it is at the maximum
scroll position. Closing an item shrinks the document; the browser clamps scrollTop every frame,
so the summary and everything above slide down (332 -> 396) while the item's bottom edge stays put
(441). Visually that is "the page moves", not "the item collapses". Opening grows the document,
no clamp, so it looks right. Both Chromium and Firefox behave identically.

Gotcha when measuring: Playwright `locator.screenshot()` waits for the element to be stable, so it
shows the end state of a transition. Use `page.screenshot({ clip })`. Also `locator.click()`
scrolls the target into view first, which can move you off the max scroll position.

## Fix

`packages/docs/src/styles/pages.css`: `.learn-content { padding-block-end: 50vh }`. With it the
reader can scroll the last example to mid-viewport; closing then keeps the summary fixed (300) and
the bottom edge rises (409 -> 345) in both engines.

Residual: at the true max scroll on tall viewports (1920x1080: FAQ top 72; 1280x1400: top 232)
the FAQ is still on screen and the clamp still applies. Only reserving the height (or ~100vh of
trailing space) would remove it completely; judged too heavy.

WebKit: Playwright WebKit cannot launch here (missing host libs, no sudo), not verified. The
mechanism is generic scroll clamping, so it should behave the same.

Scripts used: scratchpad `repro2.mjs` (per-frame heights with real clicks), `repro3.mjs` (slowed
transition + probes), `repro4.mjs` (summary top / item bottom per frame at center vs bottom),
`maxscroll.mjs` (where the FAQ sits at max scroll per viewport), served by `serve.mjs`
(extensionless -> .html static server over `packages/docs/dist/public`).
