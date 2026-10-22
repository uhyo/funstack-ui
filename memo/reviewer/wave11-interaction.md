# Review: wave 11 Part B, interaction (#21, #88)

Commits e357d85 (ui), 0b8df77 (docs), 59ba574 (example), 1da713c (memo), read against
conventions 12 and decision 13, tooltip.md 6 and its Part B amendment, context-menu.md 2.1, 2.2,
2.6, 3.1, 3.3, 4.2, 4.3, 4.7, 4.8, 5 and the Part B amendment (including the deviations folded in
9f26f48 / 15b70d6), the menu.md wheel note, `docs/research/interaction-wave11.md` and
`memo/developer/interaction-wave11.md`. Reviewed 2026-10-23.

Checks run: `pnpm --filter @funstack/ui build`, `pnpm lint` clean; jsdom (menu, tooltip, csp,
internal, `__tests__`): 866 passed; browser project for menu + tooltip on Chromium 156 and
Firefox 157 (`FUNSTACK_BROWSERS=chromium,firefox`): 189 passed, 7 skipped. CI green on all
engines for the pushes. Standalone probes (Playwright, headless, scratch files, not committed):

- `interest-delay-start: calc(250ms * (1 - var(--fsui-tooltip-warm)))` with the property
  unregistered computes to `normal` in Chromium 156; with `var(--fsui-tooltip-warm, 0)` it is
  `0.25s` (M1).
- react-dom/server 19.3.1 `renderToReadableStream`, a `<style href precedence="fsui" nonce>`:
  no `nonce` option or the string form -> the rules are emitted **without** the nonce; object
  form with the same value -> emitted with it; object form with a different value **or with no
  `nonce` prop on the element** -> an empty `<style nonce data-precedence>`, rules dropped. Two
  `<style href precedence="fsui">` in one flush -> **one** element, `data-href="a b"`, texts
  concatenated (L1, L2).
- `STYLE_SHA256` under a real `Content-Security-Policy: style-src 'sha256-…' 'sha256-…'` header:
  a script-inserted `<style>` with `MENU_POINT_RULES` (8 rules) and `TOOLTIP_WARM_RULES` (2)
  applies in Chromium and Firefox; the same text plus one trailing space is blocked. The hashes
  are exact, whitespace included.
- The Tooltip page's "skip the entry animation" recipe, with an `@starting-style` opacity
  transition: a **cold** open gets 0 animations with the recipe and 1 without, in both engines
  (M3).

## Verdict

**Acceptable with minor fixes.** Press-drag-release, the touch offset, close-on-scroll, the
wheel guard, the JS skip-delay and the CSP plumbing are correct in the cases they target, with
no listener or timer leak I could find, and keyboard / AT activation is not affected by the
gesture. No High findings. The three Medium findings are a missing `var()` fallback that turns
the documented "keeps its normal delay" degradation into the browser's 500 ms, the 500 ms
dismissal clock starting at the press rather than at the open (an async open shortens it), and
a docs CSS recipe that does the opposite of what it says.

## The reported deviations

| # | Assessment |
| --- | --- |
| 1 Touch guard cancels the lift's `touchend`, ends at `touchend` / `touchcancel` / `pointercancel` or 250 ms after `pointerup` | **Sound; keep.** Cancelling `touchend` is the Touch Events way to suppress the compatibility mouse events and the synthesised click, and it is what stops the tap beside the offset menu from light-dismissing it. Chromium and WebKit dispatch the `pointerup` and the `touchend` of one lift from the same input event, so an item activation that closes the menu cannot run the ContextTrigger's close effect (`stopDrag` -> unguard) between them; the 250 ms fallback only matters for a pointer stream with no touch events (synthetic, or touch events disabled) and is cleared on every exit. Listeners: all five removed by `end()`, which also runs on close and unmount. Caveat L4 (the `touchend` is not filtered by finger). |
| 2 Drag activation disarms the long-press swallow around `item.click()` | **Correct and necessary** (the swallow is a document capture `click` listener and would eat the library's own `click()`). Order disarm -> `click()` -> re-arm with `releasing`, which disarms after one task, on `keydown` and on `pointerdown`. Covered: "the long-press click swallow did not eat the activation" and "one task later the swallow is gone". A keyboard or AT activation after a drag is never swallowed. |
| 3 Gesture only when `setPointerCapture` succeeded | Correct; without capture there is no gesture to observe and a stale one could double-activate. |
| 4 Wheel guard walks every ancestor up to the popup | **Better than the design's "innermost `[role=menu]`"**: a consumer scroller inside a menu keeps scrolling, chaining to an outer scroller in the menu works, RTL `scrollLeft` is handled. Caveats: dominant axis only (a diagonal trackpad gesture over a horizontal strip inside a menu loses its horizontal part; acceptable), and L3 (Ctrl+wheel). |
| 5 `--menu-point-gap` with `side={null}` | Fine; matches 4.7's "readable by a `side={null}` consumer". |
| 6 `otherOpenTooltip` iterates instead of one `querySelector` | Fine; same result, cost is a handful of elements per hover. |
| 7 Browser rows reshaped; L4 row asserts against timestamps | **Acceptable.** The row reads `performance.now()` in window capture listeners for `contextmenu` and `pointerup`; the library reads the same clock in its handlers of the same two dispatches, so the row's branch and the library's decision can only disagree within microseconds of 500 ms. The quick branch can go unexercised on a loaded runner (it only warns), but the jsdom row with a mocked clock pins the quick case deterministically, and the second half asserts its precondition (`elapsed >= 500`) rather than trusting the sleep. Note for M2: when the clock moves to the open, the row's start event moves with it. The 2 px variants still test what the capture buys (the point is above the menu's top edge, over no popover). |
| 8 Hoisted-style rows in a fresh document | Fine. |
| 9 SSR rows in `csp.test.tsx` | Fine. |

## Medium

### M1. The native skip-delay `var()` has no fallback, so whenever the warm stylesheet is missing every flagged tooltip waits Chromium's 500 ms instead of its `delay`

- `packages/ui/src/internal/tooltip-warm.ts:27`: `calc(${delay}ms * (1 - var(--fsui-tooltip-warm)))`.
  When `@property --fsui-tooltip-warm` is not registered, the property is unset, the `var()` is
  invalid at computed-value time and `interest-delay-start` computes to its initial value
  `normal`, the UA delay (probe: `normal`; Chromium's is 0.5 s). It does not fall back to `0` or
  to the Root's `delay`.
- Design 6 ("`var()` falls back to the initial `0` and the normal delay applies"), conventions 12
  ("the skip-delay `var()` falls back to the normal delay"), the doc comment of
  `TOOLTIP_WARM_RULES` and of `STYLE_SHA256`, the Tooltip page ("blocked, the native path keeps
  its normal delay") and the CSP page ("waits its normal delay … falls back to its initial
  value") all say otherwise. The initial value applies only once the `@property` rule is in.
- When the stylesheet is missing, in practice:
  1. a strict `style-src` without the hash or nonce (the documented case);
  2. the app passes `nonce: { style }` to React for its own styles but renders no
     `<CSPProvider>`: Fizz drops the rules (probe) and the client re-insert carries no nonce, so
     it is blocked too;
  3. `render` with an element that has its own children, e.g.
     `<Tooltip.Trigger experimental_interestFor render={<a href="/pricing">Pricing</a>} />`:
     `mergeProps` lets the render element's `children` win
     (`packages/ui/src/internal/merge-props.ts:123`), so the `<style>` that
     `packages/ui/src/tooltip/tooltip-trigger.tsx:113-119` puts in `children` is never rendered.
     If every flagged Trigger on the page is written that way, the page has no rule.
- What breaks: with the default `delay` of 250, every flagged tooltip opens after 500 ms.
  Skip-delay is lost as well, which is the expected degradation. A consumer with `delay={0}`
  waits 500 ms.
- Fix:
  1. `var(--fsui-tooltip-warm, 0)` (one token; the probe gives `0.25s`). The jsdom row at
     `tooltip.test.tsx` "renders the warm delay…" pins the string, and a browser row could
     assert `delayStart(trigger) === "0.4s"` with the stylesheet removed.
  2. Render the `<style>` next to the element rather than inside `children` (the Trigger can
     return `<>{warmRules}{element}</>`; hoisted, nothing lands in place, and no
     `<ViewTransition>` wraps a Trigger), so `render` cannot drop it.
  3. Correct the five texts above.

### M2. The 500 ms outside-release clock starts at the `contextmenu`, not at the open, so an async open shortens it

- `packages/ui/src/menu/menu-context-trigger.tsx:107` sets `startedAt` in `startDrag`, which
  `onContextMenu` calls (`:454-457`) before `menu.openAt`. Design 2.6 and 5 say "at least
  500 ms **since the open**", and its rationale is a guard against "a quick press that
  overshoots a flipped menu", which is about how long the user has seen the menu.
- With an async `openChangeAction`, or items that suspend (the library's headline case), the
  popup is shown only when the action settles and the items render (context-menu 2.1).
- Failure scenario: `openChangeAction` fetches for 450 ms. The user holds the right button near
  the bottom-right corner, and the menu appears flipped up-left, away from the pointer. The
  pointer has drifted 5 px, and the user releases 70 ms later, outside the menu. That is 520 ms
  after the press, so the menu is dismissed 70 ms after it appeared. A stationary hand is
  protected (the release must move), but a 5 px drift is ordinary.
- The same holds for a long-press: the delay is measured from the expiry, so it is fine there
  unless the open is slow.
- Fix: start the clock when the popup is shown. `startDrag` already listens to `toggle`; set
  `startedAt` on the first `toggle` that finds it `:popover-open`, or pass a getter fed by the
  Popup's open. Note that a move's re-show coalesces to open -> open, so a move must restart the
  clock where it starts the gesture, which it already does.
- Add a jsdom row with a pending `openChangeAction`: release outside 600 ms after the press but
  100 ms after the show -> still open. Releases before the show already do nothing, because
  `onUp` requires `:popover-open`.

### M3. The Tooltip page's "skip the entry animation" recipe disables every entry animation

- `packages/docs/src/pages/TooltipPage.tsx` (Skip-delay section) and design 6 "Not in v1"
  suggest `:root:has([role="tooltip"]:popover-open) .tip { transition: none; }`. Once the
  tooltip being opened is `:popover-open`, the `:has()` matches, so its own after-change style
  carries `transition: none`, and the **first, cold** open loses its entry transition too. On a
  skip, the previous tooltip is already hidden when the next one's style changes: the JS path
  hides it before `show()`, and `hint` stacking hides it inside `showPopover`. So "another
  tooltip is open" is never observable at that moment. Probe: cold open, 0 animations with the
  recipe vs 1 without, in Chromium and Firefox.
- Failure scenario: a consumer pastes the recipe to get instant browsing and loses the fade-in
  of every tooltip.
- Fix: remove the recipe from the page and from design 6's rationale. If instant browsing
  should keep entry animations for cold opens, it needs library state (the `data-instant` /
  `state.warm` that design 6 lists as not in v1), which is now the only way. Record it as a
  follow-up rather than shipping CSS that does not work.

## Low

### L1. The CSP page describes React's nonce handling incompletely

The callout says Fizz "drops the rules when the element's nonce differs" and "the string form
covers scripts only". Measured with react-dom 19.3.1:

- No `nonce` option, or the string form, with a `<CSPProvider>`: the rules are **kept** and the
  `nonce` is stripped, so a nonce policy blocks them in the browser.
- The object form **without** a provider: the rules are **dropped**.

The second case is the one an app is most likely to hit: it already passes `nonce: { style }`
for its own CSS and has not heard of the provider. Combined with M1 it slows every flagged
tooltip. Say it in one line on the page ("if you pass `nonce.style`, render `<CSPProvider>`
with the same value; without it React drops the rule"). Add the "object option, no provider"
case to `csp.test.tsx` next to the mismatch row.

### L2. Same-precedence hoisted styles are merged by Fizz, which would invalidate the per-href hashes

In one flush, Fizz writes every `<style href precedence="fsui">` as a single element (probe:
`data-href="a b"`, texts concatenated). Today only `@funstack/ui/tooltip-warm` renders during
SSR (the menu rules are client-only), so the hashes are right. A second stylesheet that renders
on the server, or a point menu that ever does, would ship one `<style>` whose hash is in neither
`STYLE_SHA256` entry, and nothing would fail: the jsdom row hashes the constants, not the server
output.

Record the constraint in conventions 12 ("at most one shipped stylesheet may render during SSR
per precedence bucket, or each gets its own precedence") and make the SSR row in `csp.test.tsx`
assert that the head contains exactly one `fsui` `<style>` and that it hashes to its entry.

### L3. The wheel guard also cancels Ctrl+wheel, so trackpad pinch-zoom and Ctrl+scroll zoom do nothing over an open menu

`packages/ui/src/menu/menu-popup.tsx` `onWheel` prevents every wheel that cannot scroll the
menu. Chromium delivers trackpad pinch as `wheel` with `ctrlKey`, and Ctrl+wheel is browser
zoom in every engine. A low-vision user who zooms while the pointer rests on a menu gets
nothing. The guard is meant for page scrolling only, so add `if (event.ctrlKey) return;`
(WCAG 1.4.4 is still met via the keyboard, but blocking the user's zoom gesture is
unnecessary). Add a jsdom row.

### L4. The touch guard ends at, and cancels, any finger's `touchend`

`guardTouch` (`menu-context-trigger.tsx:206-209`) cancels and stops on the first document
`touchend`, whichever touch ended.

Scenario: finger 1 long-presses, the menu opens, and a second finger taps and lifts. That tap
is cancelled, which is harmless, but the guard ends while finger 1 is still down. Its next
slide pans the page, so `pointercancel` ends the gesture and the slide-to-select is lost.

Cancel and end only when `event.touches.length === 0` (no finger left), or keep cancelling
until then. Rare; device pass #90 can confirm.

### L5. Skip-delay can hide a tooltip on the way to it (WCAG 1.4.13 "hoverable")

Design 6 says the 1.4.13 requirements are "unchanged". They are not quite. Before wave 11,
crossing trigger B on the path from trigger A to A's tooltip started B's 250 ms timer, so A
survived the crossing. Now B opens at once and A is hidden. That happens on both paths: the JS
path's `other.hidePopover()`, and on the native path the warm `0s` plus `hint` stacking.

It matters only where the path to a tooltip crosses a neighbouring trigger, for example a
tooltip placed beside a vertical toolbar. Native platforms behave the same way. Correct the
design sentence and add a docs note ("place tooltips away from neighbouring triggers in dense
toolbars"); no code change.

### L6. Close-on-scroll also fires for scrolls already in flight at the open

The listener closes the menu on any document scroll after the open. Two cases where that
scroll was not started after the open:

- A smooth scroll still running: `html { scroll-behavior: smooth }` with a Tab focus that
  scrolls, then Shift+F10.
- Trackpad momentum.

In both, the menu opens and closes within a frame or two. A keyboard user who Tabs and presses
the Menu key quickly on such a page sees nothing open. This is acceptable as designed (React
Aria has the same rule), but say it in the docs' Scrolling list, or ignore scroll events
before the first frame after the show. Not covered by any row.

### L7. Pen gets no touch guard

`beginDrag` guards only `pointerType === "touch"`, as design 2.2 says. On iPadOS the Apple
Pencil also produces touch events, so a pen long-press drag may be taken as a pan and end in
`pointercancel`. That is a gesture that does not select, not a broken menu. Add it to the
device pass #90 checklist rather than change it blind.

## Focus areas

- **Accessibility.**
  - The gesture runs only on a captured pointer. VoiceOver's VO+Shift+M, Windows and the
    keyboard (`buttons === 0`) take no capture, so no gesture.
  - Focus moves quietly (`focusVisible: false`), as with hover.
  - Activation goes through `item.click()`, so `action`, `closeOnActivate` and the
    checkbox / radio toggles are unchanged.
  - The swallow that a drag re-arms lasts one task and disarms on `keydown`, so a keyboard
    `click()` that follows is never eaten.
  - The JS skip-delay hides the previous tooltip with `hidePopover()`. Its Root sees `toggle`
    and detaches, its pending close timer finds it closed, and the trigger's
    `aria-describedby` is untouched.
  - Escape on the new tooltip works: `show()` attaches the document listeners.
  - Blur uses `hideLater`, so arrowing along a toolbar does skip.
  - See L3 and L5.
- **Async React.**
  - Placement stays an urgent internal write.
  - The drag activation reuses the item's transition path.
  - The dismissals are `"dismiss"` through `toggle`.
  - M2 is the one place where the async open is not accounted for.
- **SSR / RSC.**
  - The warm `<style>` hoists into the server `<head>` with the render nonce (row in
    `csp.test.tsx`; the text equals the constant).
  - `CSPProvider` is a `"use client"` module with a serialisable prop.
  - `csp/index` and `style-hashes` are directive-free (`directives.test.ts`).
  - Tooltip.Trigger stays a client part, so a Server Component Tooltip is unchanged.
  - The menu rules never reach server HTML.
- **CSP.** The hashes match the emitted text byte for byte (jsdom row plus my header probe in
  both engines). Nonce forwarding is tested on the client for both parts. See L1 and L2.
- **Leaks.** No leaks found:
  - `startDrag`: five popup listeners, removed at release, `pointercancel`,
    `lostpointercapture`, close (`toggle`) and through `stopDrag` (close effect, unmount, a
    new gesture).
  - `guardTouch`: removed at touch end, by its timer, and via `stopDrag`.
  - `armClickSwallow`: one at a time, disarmed by timer / `keydown` / `pointerdown` / close.
  - `listenOutside`: scroll and wheel removed with the rest on `toggle(closed)`, with matching
    capture flags.
  - The submenu hover registry is a `WeakMap` with ref cleanup.
- **Cross-engine tests.**
  - The tooltip rows assert "B opened in the same task as A's close" rather than a duration.
  - The cold-open bound is a lower bound, which load cannot break.
  - The scroll rows assert `defaultPrevented` rather than waiting for "nothing happened".
  - The touch row is Chromium-only by necessity (CDP) and asserts its precondition.
  - Deviation 7 above.
- **Docs.**
  - The props tables match the declarations: ContextMenu's `--menu-point-gap` row, the
    Tooltip `data-fsui-tooltip-trigger` row, and `CSPProvider`'s `nonce` / `children`.
  - The placement table and fallback lists match `MENU_POINT_FALLBACKS`.
  - The #90 caveat is on the page and the roadmap.
  - Inaccuracies: M1 (degradation text in four places), M3 (recipe), L1 (React nonce
    behaviour).

## Must-fix

1. M1: `var(--fsui-tooltip-warm, 0)`, render the `<style>` beside the element rather than in
   `children`, and correct the degradation texts (design 6, conventions 12, both doc comments,
   both docs pages).
2. M2: start the dismissal clock at the show, with a jsdom row for a pending open.
3. M3: remove the entry-animation recipe (page and design 6).

L1 to L7 can follow in the same pass; L3 is one line, and L1 and L2 are a sentence plus a test
row each.
