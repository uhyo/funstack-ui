# Developer memo: wave 11 Part A, positioning (2026-10-23, #20, #53, #88 RTL)

Design: conventions 13; amendments in tooltip.md, popover.md, menu.md, context-menu.md (Part A),
combobox.md. Engines: Playwright 1.64.1 (Chromium 156.0.8078.4, Firefox 157.0).

## What shipped

- `internal/anchor-position.ts`: the six-row matrix (`self-x-*` sides, `span-self-x-*` align on
  top / bottom), `parsePositionArea(value, selfDirection, rootDirection, writingMode)` (total,
  null for anything not in the table; `rootDirection` may be a function, read lazily),
  `MENU_POINT_RULES` with five options, `MENU_POINT_FALLBACKS.{ltr,rtl}[parity]`.
- `internal/use-resolved-placement.ts`: `useResolvedPlacement({ side, align }) -> { side,
  align, ref }`. Stable callback ref; ResizeObserver from mount, `toggle`, and while shown
  `scroll` (document, capture) / `resize` (window). Writes with `flushSync` from the observer
  paths, plain `setState` from the layout effect that re-reads on a changed request. The state
  holds `null` when the parsed pair equals the request, so an unflipped open costs no render
  (the "written" ref compares before calling setState). Hidden but still rendered (exit
  animation): keeps the resolved value until the box goes (RO).
- Tooltip / Popover / Menu Popups merge the hook's ref; the inline `position-area` stays the
  requested one. `Tooltip.Arrow` (span, aria-hidden, reads `TooltipPopupContext`).
- Combobox: `self-block-end span-self-inline-end`.
- Context menu: `placement.direction` from `isRtl(popupRef.current)` in `openAt`; `pointStyle`
  mirrors the insets and picks `MENU_POINT_FALLBACKS[direction][generation % 2]`.
- Test helpers: `src/__tests__/placement-stub.ts` (jsdom: stubs `getComputedStyle` for one
  element through a Proxy; spy on `globalThis`), `src/__tests__/placement-browser.ts` (`near`,
  `actPoll`, `frames`, `withPageDirection`, `placedSide`), `anchorPositionHonoursParentDirection`
  in `engine.ts` (sync probe at import; false in Firefox 157, pinned in environment row).

## Findings that differ from the research / design (reported)

1. **Scroll does not re-choose the option in Chromium 156** except within about a frame of the
   show. Probe (plain Playwright page, no vitest): popup `position-area: top` with
   `flip-block`, trigger in a scroller (fixed or static) or the document; `scrollTop` moves the
   trigger to the viewport top. Scroll right after `showPopover()` + one rAF: flips to `bottom`.
   Scroll 100 ms or more after the show: stays `top` forever (popup scroll-compensated off
   screen). The document-scroll case never flipped with `flip-block` alone. A second popover
   shown shortly after a first one was scrolled also does not flip. The research probe
   (`resolved-side-timing.mjs`) scrolled one rAF after the show, so it saw the flip. Not a
   library issue: `data-side` reports what is applied (`top`).
2. **Firefox 157 re-chooses on scroll, but one frame late**: in the `scroll` handler and in a
   rAF registered from it the computed `position-area` is still the old option; it is current at
   the second rAF (the layout of the frame after the event applies it). Only a scroll within a
   frame of the show reads correctly in the handler (what the research measured). Fix in the
   hook: each `scroll` / `resize` reads at once and again in the next two animation frames
   (coalesced; a scroll during a pending pair re-runs it at the end). Design 13.2 said "no
   requestAnimationFrame": deviation, reported.
3. **One-sided gap margins keyed on the resolved `data-side` land on the far side after a
   flip**: `flip-block` swaps the popup's own block margins, so
   `[data-side="top"] { margin-block-end: 6px }` is applied as `margin-block-start` once the
   option is the flipped one, i.e. gap 0 against the trigger (measured, both engines). With the
   old requested-value `data-side`, the swap was what put the gap right. Docs and examples now
   use a symmetric margin along the side's axis (`margin-block: 6px` for top / bottom,
   `margin-inline` for left / right). popover.md section 10 / menu.md section 9 recipes are
   wrong as written: reported. (The Arrow is unaffected: insets on a child are not flipped.)
4. Firefox container-RTL submenu: the misplaced submenu overflows and `flip-inline` applies
   (`self-x-start span-bottom`), so its resolved `data-side` is `right`, not `left`; the
   degraded branch asserts the applied option rather than `left`.

CI run 39810810561 (all four jobs green, WebKit's first real check of the computed-style
claim): every resolved-side row passed on WebKit. The scroll rows logged: Tooltip (scroll 200 ms
or so after the show) Chromium `top` (kept), Firefox and WebKit `bottom` (flipped); Popover
(scroll sooner after the show) flipped to `top` in all three. No new act() warnings (the
MenuRoot / ToastViewport / ComboboxRoot ones predate this work).

## Browser rows (tooltip, popover, menu, context menu, combobox)

The scroll rows assert the geometry invariant (data-side equals the side the popup box is on)
instead of "flips to bottom", because of finding 1; Firefox exercises the flip, Chromium the
no-flip. All container-RTL rows branch on the probe and assert the misplacement (neither edge
meets) in Firefox, with #89 cited.

act(): every poll after a placement change goes through `actPoll` (an async `act` scope), and
rows that end shown close inside `act`, so the observer's `flushSync` writes log nothing.

## Review fixes (memo/reviewer/wave11-positioning.md, 2026-10-23)

- M1: logical sides cost one render on show and one on hide; jsdom rows in
  `internal/use-resolved-placement.test.tsx` (render counter) pin it, docs pages say so.
- M2: same file, deterministic scroll/resize describe (manual rAF queue, listener spies). Note:
  a scroll **before** the first frame of a pending pair also sets `again`, so it costs one extra
  pair at the end (kept; the row pins "at most one more pair").
- L1 guard on `written.current`; L2 `if (!listening) return`; L3 sync read kept for WebKit.
- L4: menu recipes keep the symmetric keyed form and add the closed `inline-start` /
  `inline-end` keys (menu.md 9); PopoverPage shows the static requested-edge form first
  (popover.md 10) plus the any-side keyed form.
- L5: `topLayerAnchorReChoosesOnScroll()` (async, engine.ts, #92 reduction). In vitest browser
  mode: Chromium false and Firefox true at every show-to-scroll delay 0..300 ms (60 runs each),
  and stable under 16 CPU burners (4 runs). Pinned in the environment row (WebKit logged only)
  and in the Tooltip scroll row. **Not** in the Popover scroll row: there Chromium re-chooses
  in every run (local and CI) although the probe says it does not, so the probe does not predict
  it. Unexplained difference (that row pre-scrolls the container, opens through the library,
  popup 160x120, overflow at the bottom; a probe variant with bottom overflow still kept the
  option in Chromium, so the direction is not it).
