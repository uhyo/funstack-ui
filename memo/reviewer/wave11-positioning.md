# Review: wave 11 Part A, positioning (#20, #53, #88 RTL)

Commits d3d0359 (ui), b31281b (docs), d3f3f45 (example), faa3dbb (memo), read against
conventions 13 (as amended by 1d06fae), the Part A amendments in tooltip / popover / menu /
combobox / context-menu, `docs/research/positioning-wave11.md` and
`memo/developer/positioning-wave11.md`. Reviewed 2026-10-23.

Checks run: `pnpm --filter @funstack/ui typecheck` and `pnpm lint` clean; jsdom (tooltip, popover,
menu, combobox, internal, `__tests__`) green after `pnpm --filter @funstack/ui build` (the three
`directives.test.ts` failures before it were a stale local `dist/`); browser project for the same
directories on Chromium 156 + Firefox 157: 302 passed, 8 skipped (the pre-existing
`supportsInterestFor` describe on Firefox). CI 39810810561 / 39811621679 green on all engines.
Standalone Playwright probes (Chromium 156.0.8078.4, Firefox 157.0, headless) for deviation 1;
the scripts were scratch files, the reduction is reproduced below.

## Verdict

**Acceptable with minor fixes.** The parser, the matrix, the observer and the direction-aware
point placement are correct, the a11y of `Tooltip.Arrow` is right, SSR/RSC holds (Arrow is a
`"use client"` part read through context; `anchor-position.ts` stays directive-free; the
Server Component docs example builds), and I found no listener leak. No High findings. The
Medium ones are about claims (design and docs say things the code does not do) and about the
untested scroll re-read path; the Low ones are small cost and test-pinning items.

## The three reported deviations

### 1. Scroll re-read in the next two frames: **sound, keep it; the explanation needs fixing**

What I measured (container scroller and document scroll; popup `position-area: top;
position-try-fallbacks: flip-block`; the trigger scrolled to the viewport top):

| read at | Chromium 156 (when it does re-choose) | Firefox 157 |
| --- | --- | --- |
| `scroll` handler | old option **and old geometry** | old option and old geometry |
| handler + forced layout (`getBoundingClientRect()` first) | old | old |
| rAF registered in the handler | old | old |
| second rAF | new | new (`span-all bottom`) |

- **Both engines** apply the scroll-dependent state one frame late: even the scroll-compensated
  position of the popup is stale in the handler and the first rAF. Forcing layout does not help,
  so there is no cheaper fix than reading in a later frame. This is not a conformance bug in
  either engine: css-anchor-position-1 §3.3 leaves it open ("Issue: Define the precise timing of
  the snapshot: updated each frame, before style recalc").
- So the second-frame read is what makes the hook work, in Chromium as well whenever Chromium
  re-chooses. The comment at `packages/ui/src/internal/use-resolved-placement.ts:105-109` and
  conventions 13.2 (`design/conventions.md:2168-2176`, and tooltip.md 7.4) blame the lag on
  Firefox only. See M3.
- The coalescing is correct. A scroll during a pending pair sets `again` and re-runs after the
  second frame. `listen(false)` cancels the pending frame on hide and on ref cleanup. During
  continuous scrolling the lag is at most one frame.
- Cosmetic consequence: after a scroll-driven flip, one frame is painted with the old
  `data-side`, so the arrow points the wrong way for that frame. The show path has no such frame
  (RO + `flushSync` before paint). Worth one clause in 13.2's "Not covered".

**Is Chromium's "keeps the option" conformant? No.** §6.5 "Applying Position Fallback":
"When a positioned box (after applying any default scroll shift) overflows its inset-modified
containing block, and has more than one position option …, it determines position fallback
styles". After the scroll, the popup sits at y = −20, outside the viewport and outside its
`top` cell, and `flip-block` fits. The last-successful-option rules (§6.5.1.1) only skip the
current option in that search; they never keep an overflowing option while another option fits.
My probes narrow it more than the developer memo does:

- A plain `position: fixed; position-anchor: --a` element in the **same** layout re-chooses on
  every scroll, at any delay after the first frame (4/4). Only the **top-layer** popover keeps
  `top`, with an implicit (`showPopover({ source })`) or an explicit (`position-anchor`) anchor.
- A scroll in the same task as the show (`await wait(0)`) re-chooses. A scroll 300 ms after the
  show never does, not even after a later fallback-sensitive change (`width` 60 → 61 px, an
  accepted @position-try property). Hiding and re-showing picks `bottom` at once.
- Chromium was not deterministic across my harnesses: in one harness the second load of the same
  document-scroll page re-chose. The reduction below failed 4/4 on fresh pages, and Firefox
  passed 4/4.

Upstream report (**human task, do not file from an agent**; suggest adding it to #91, or to a
new tracking issue, since the scroll rows should cite it the way the RTL rows cite #89):

> **Chromium: an anchored top-layer popover does not re-run position-try fallback after a scroll
> makes it overflow (css-anchor-position-1 §6.5).** A `popover=manual` element with
> `position-area: top; position-try-fallbacks: flip-block`, anchored to a button inside a
> `position: fixed; overflow: auto` scroller, is shown, and 300 ms later the scroller is scrolled
> so that the button reaches the viewport top. Expected: the popover flips below the button
> (`getComputedStyle(p).positionArea` = `bottom`). Firefox 157 does this. Actual (Chromium
> 156.0.8078.4, headless): it stays `top` at y = −20, scroll-compensated off screen,
> indefinitely, and a later change to its `width` does not trigger a re-choice either. The same
> markup with a non-popover `position: fixed; position-anchor` element re-chooses correctly, as
> does a scroll within the same task as `showPopover()`. Related WPTs
> (`css/css-anchor-position/anchor-scroll-position-try-*.html`) cover only non-top-layer
> elements. Reduction:
>
> ```html
> <!doctype html><body style="margin:0">
> <div id=scroller style="position:fixed;top:0;left:0;width:400px;height:300px;overflow:auto">
>   <div style="height:200px"></div>
>   <button id=t style="display:block;width:100px;height:30px;margin:0">anchor</button>
>   <div id=p popover=manual style="margin:0;padding:0;border:0;width:60px;height:20px;
>        position-area:top;position-try-fallbacks:flip-block;background:green">tip</div>
>   <div style="height:1000px"></div>
> </div>
> <pre id=out style="position:fixed;left:420px;top:0"></pre>
> <script>
> const wait = (ms) => new Promise((r) => setTimeout(r, ms));
> (async () => {
>   p.showPopover({ source: t });
>   await wait(300);
>   scroller.scrollTop = 200;
>   await wait(500);
>   const r = p.getBoundingClientRect();
>   out.textContent = getComputedStyle(p).positionArea + " " + r.top +
>     (r.bottom > 0 ? " PASS" : " FAIL: kept an overflowing option");
> })();
> </script>
> ```
>
> Before filing: confirm in a headed stable Chrome (I only ran headless) and search
> issues.chromium.org for duplicates (web searches found none). The CSSWG thread #12577
> (Rune Lillesveen: re-choosing when the current option overflows the IMCB "has nothing to do
> with the last successful position option") supports filing it as a bug.

The library behaviour is right either way: `data-side` reports what is applied, and the library
does not try to force a re-choice (the width probe shows no cheap way to force one anyway).

### 2. Symmetric gap margins: **correct diagnosis, correct fix, two caveats (L4)**

§6.4 defines `flip-block` as swapping "the values in the block axis (between, for example,
'margin-block-start' and 'margin-block-end')", so a one-sided margin keyed on the **resolved**
side does land on the far edge. There is a second reason the symmetric recipe is right: margins
are accepted @position-try properties, so a one-sided margin that changes with `data-side` is a
fallback-sensitive change (§6.5.1). It clears the last successful option and re-runs the choice
every time the side flips. A symmetric margin along the axis does not change on a flip within the
axis. The caveats are in L4.

### 3. Firefox container-RTL submenu reports `right`: **acceptable**

The misplaced submenu overflows, `flip-inline` applies, and `data-side` reports the applied
option. That is the invariant 13.2 promises. The row still asserts the misplacement
(`s.right ≠ m.left`, `s.left ≠ m.right`), so it fails, and its branch can be deleted, when
Mozilla 2019601 is fixed. The assertion of the side is weak, though: see L5.

## Medium

### M1. "An open where you asked costs no render" is false for `side="inline-start"` / `"inline-end"`, so every submenu open and close now renders once more

- `packages/ui/src/internal/use-resolved-placement.ts:70-75`: `write` stores `null` only when the
  parsed physical side equals `requested.current.side`. For a logical request
  (`"inline-end"`), the parsed side is always `"right"` / `"left"`, so the state is set on every
  show and cleared on every hide. Each is a `flushSync` render of the part.
- Affected: Menu's submenu (default `inline-end` since this wave: every submenu open and close),
  and any Tooltip / Popover / Menu with an inline side. For a Tooltip that breaks tooltip.md 4.1's
  "no React work per hover" for those props.
- The behaviour itself is inherent: `data-side` must turn physical while shown, so it cannot be
  avoided. The claims are wrong, though: conventions 13.2 (`design/conventions.md:2182`),
  tooltip.md 7.4 (`design/components/tooltip.md:637`), `packages/docs/src/pages/TooltipPage.tsx:287`
  ("a tooltip that opens where you asked costs no React render") and
  `packages/docs/src/pages/PopoverPage.tsx:411`.
- Fix: qualify the sentences ("with a physical `side`; a logical side costs one render on open
  and one on close, since `data-side` turns physical"). Add a jsdom render-count row for
  `side="inline-end"` asserting exactly one render per show and one per hide, so the cost cannot
  quietly grow.

### M2. The scroll / resize re-read path has no deterministic test, and its lifecycle (listeners, rAF cancellation) has none at all

- `use-resolved-placement.ts:91-133, 159-176` is the only part of the hook that installs global
  listeners and schedules frames. The jsdom rows drive it only through `toggle`, and nothing
  dispatches `scroll` or `resize`. The browser scroll rows exercise it in Firefox alone, since
  Chromium does not re-choose (deviation 1), and only on the happy path.
- Untested: listeners installed only while shown; removed on hide, on `side={null}` and on
  unmount; a pending frame cancelled on hide or unmount; the `again` restart; no read after
  unmount. A regression in any of these is a document-level listener leak per popup, which no
  test would catch.
- Fix: one jsdom describe with the placement stub, a manual `requestAnimationFrame` queue
  (`vi.spyOn(window, "requestAnimationFrame")` collecting callbacks) and
  `vi.spyOn(document, "addEventListener" / "removeEventListener")`:
  - show, `document.dispatchEvent(new Event("scroll"))`, change the stub, run frame 1 (old) and
    frame 2: `data-side` updates;
  - a scroll between the frames re-runs the pair;
  - hide or unmount: both listeners removed, `cancelAnimationFrame` called, and no
    `getComputedStyle` call after.

### M3. The design and the code comment misdescribe deviation 1, which invites a wrong simplification later

- `use-resolved-placement.ts:105-109` ("Firefox 157 applies the option … in the layout of the
  frame after the scroll event") and conventions 13.2 (`design/conventions.md:2168-2176`: "Firefox
  157 re-chooses … current only at the second frame …; Chromium 156 re-chooses only when the
  scroll comes within about a frame of the show") each describe one engine. As measured above,
  Chromium has the same one-frame lag whenever it re-chooses, and its not re-choosing is
  top-layer-specific and non-conformant, not a timing window.
- Risk: a later change that drops the frame reads "for Chromium", or treats Chromium's behaviour
  as the spec's, is wrong in both cases.
- Fix (designer / developer): reword to "both engines apply scroll-dependent anchoring one frame
  after the `scroll` event (geometry included; the timing is unspecified, §3.3 issue); Chromium
  156 additionally does not re-run fallback for a top-layer popover after the first frames, a
  bug (§6.5), upstream item in #91". Mention the one stale painted frame in "Not covered". Cite
  the upstream item from the two scroll rows' comments, as the RTL rows cite #89.

## Low

### L1. Every mount and every request change forces a layout just to learn there is nothing to reset

`use-resolved-placement.ts:156` evaluates `element.getClientRects()` in the hidden branch, and the
layout effect at `:181-184` runs `read` on mount. So every Tooltip / Popover / Menu popup forces
a synchronous layout inside the commit, even though `write(null)` is a no-op when `written.current`
is already `null`. On a toolbar or list of tooltips it is one forced layout per commit. Guard the
branch with `written.current !== null &&` before touching layout.

### L2. A stray frame after hide

In the first frame callback (`:122-126`), `read(true)` may find the popup hidden and call
`listen(false)`, which cancels nothing (that frame already fired) and zeroes `frame`. The callback
then schedules the second frame anyway, which reads once more on a hidden or unmounted element
(`write(null, true)`, so `flushSync` on a possibly unmounted part). Harmless today. Add
`if (!listening) return;` after the first read.

### L3. The synchronous read in `onMove` never sees a new option (optional)

In every probe, the `scroll` handler read and the first-frame read returned the old option in both
engines. Each is a `getComputedStyle(...).positionArea` per scroll event (a style flush; for an
interleaved property Chromium may lay out), which is pure cost during scrolling. Keeping it is
defensible as cover for WebKit, which I did not probe. If kept, say why in the comment; otherwise
read only in the second frame.

### L4. Gap recipes: inline sides and the first layout

1. While closed, `data-side` is `"inline-end"` (submenu default, `side="inline-*"`). The recipes
   key the inline gap on `[data-side="left"], [data-side="right"]`
   (`packages/docs/src/examples/menu.css`, `packages/example/src/menu-demo.css`, popover.md 10),
   so the first layout of every such open has no gap. The gap appears only after the observer's
   write. That write is a margin change, a fallback-sensitive change, so the choice runs again.
   In a width-constrained cell the margin can also change the popup's content box inside the RO
   callback, so a "ResizeObserver loop completed with undelivered notifications" error event
   fires (some dev overlays and error reporters surface it). Fix: add
   `[data-side="inline-start"], [data-side="inline-end"]` to the inline-gap selectors, or key the
   gap on the popup's class.
2. The docs present symmetric margins as the only fix ("use a margin on both sides of the axis",
   `TooltipPage.tsx` near :287). A static one-sided margin on the requested side, not keyed on
   `data-side`, is also correct: the flip swaps it to the right edge. The Combobox example
   already does this (`packages/docs/src/examples/combobox.css:47`, `margin-block-start: 4px`
   with `flip-block`). It also avoids the cost of the symmetric form: the far-side margin is part
   of the margin box the overflow test uses, so a symmetric popup flips that many pixels early.
   Mention both.

### L5. Degraded and characterising branches that accept any outcome

- `packages/ui/src/menu/menu.browser.test.tsx:606-610` (Firefox container-RTL submenu) derives
  the expected `data-side` from the same `getComputedStyle(...).positionArea` the hook reads, and
  accepts either `right` or `left`. If Firefox stopped flipping, or the parser and this mapping
  were wrong together, it would still pass. Menu.md 13.2 now documents `right`. Assert `right`
  outright, keeping the misplacement assertions.
- The scroll rows (`tooltip.browser.test.tsx:546, 553`, `popover.browser.test.tsx:1095`) accept
  `top` or `bottom`. The geometry invariant is the right assertion for the library. Nothing,
  though, tells us when Chromium fixes the bug, and the Firefox branch is the only one that proves
  the frame re-read. Pin the engine outcome behind a runtime probe, like
  `anchorPositionHonoursParentDirection`: a `topLayerAnchorReChoosesOnScroll` probe can't be
  synchronous, so an async one in `engine.ts` or a per-row expectation keyed on it. Then the row
  fails the day Chromium changes, citing the upstream item.

### L6. One `ResizeObserver` per popup instance from mount

`use-resolved-placement.ts:168`. Cheap for hidden targets, but a page of tooltips holds one
observer each for its whole life. A module-level shared observer with a `WeakMap` from element to
callback is the usual shape. Optional.

## Checked and fine

- **Parser** (`anchor-position.ts:91-210`): total; handles Firefox's `span-all bottom`, grammar
  order, `self-*` against the popup's direction, plain logical tokens lazily against the root,
  positional `start` / `end`, corners and same-axis spans as `null`. Inline-relative `align` is
  correct in both directions.
- **Matrix**: never mixes keyword groups; `flip-*` on `self-x-*` verified by the browser rows.
- **`flushSync`** is justified. RO, `toggle`, `scroll`, `resize` and rAF callbacks are all outside
  React work in real engines (`toggle` is a queued task; scroll and resize events are dispatched
  in the rendering steps). A default-lane `setState` from an RO callback would commit after
  paint. The layout-effect path correctly uses plain `setState`. The jsdom shim queues `toggle`
  (`setShown` awaits a task), so no flushSync-in-commit warning.
- **Exit animation**: a hidden but still rendered popup keeps its resolved side until RO sees the
  box go.
- **Context menu RTL**: direction read once per open or move in `openAt` from the popup (computes
  while `display: none`), stored in the placement record; the style stays a pure function of
  state; the browser rows cover page RTL, container RTL and "the popup's direction wins".
- **`Tooltip.Arrow`**: `span aria-hidden`, owned `aria-hidden`, no text, so it adds nothing to the
  tooltip's name or description; it throws outside Popup like the other parts; it works from a
  Server Component (`TooltipArrow.tsx` example); `renderToString` row present.
- **Docs props tables**: Tooltip / Popover / Menu `side` types, `align` descriptions, the Arrow
  table and the `data-side` / `data-align` rows match the declarations; Combobox, Select and
  ContextMenu pages match the shipped keywords and the five `@position-try` rules.
