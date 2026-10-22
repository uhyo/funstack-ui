# Positioning, wave 11: resolved side and arrows, RTL, context menus in RTL

Research date: **2026-10-22**. GitHub issues #20 (Tooltip arrow after a flip), #53 (container-level
RTL for top-layer popups) and #88 (context menu follow-ups: RTL point placement). Support data
from MDN browser-compat-data 8.1.7 (timestamp 2026-10-22), chromiumdash and the Chromium M156
(8078) `runtime_enabled_features.json5`, the CSS Anchor Positioning 1 and 2 editor's drafts (read
2026-10-22), WebKit and Mozilla standards positions, Bugzilla (Mozilla, WebKit), CSSWG issues, and
engine source: Chromium (`ui/views/controls/menu/menu_controller.cc`,
`components/renderer_context_menu/views/toolkit_delegate_views.cc`), Gecko
(`layout/xul/nsMenuPopupFrame.cpp`), WebKit (`Source/WebCore/style/AnchorPositionEvaluator.cpp`,
`StyleTreeResolver.cpp`, `Source/WebKit/UIProcess/mac/WebContextMenuProxyMac.mm`), GTK 3.24
(`gtk/gtkmenu.c`, `gtk/gtkmain.c`). Behaviour was verified with Playwright probes on Chromium 156
and Firefox 157 (`memo/platform-researcher/probes/18-positioning-wave11/`). WebKit still cannot
launch locally, so its column comes from WebKit source and BCD (marked "source").

| Engine | Stable release | Date |
| --- | --- | --- |
| Blink | Chrome 156 (156.0.8078.48) | 2026-10-20 |
| Gecko | Firefox 158 | 2026-10-13 |
| WebKit | Safari 27.0 | 2026-09-14 |

Builds on [popover-anchor-tooltip.md](./popover-anchor-tooltip.md),
[popover-menu.md](./popover-menu.md) and [context-menu.md](./context-menu.md).

## Summary

1. **Resolved side (#20).** In every engine, `getComputedStyle(popup).positionArea` reports the
   `position-area` of the **fallback that was applied**, for example `bottom` after a `flip-block`
   of `top`. It is current synchronously after `showPopover()`, in the `toggle` event and inside
   a `scroll` event handler. A small library resolver can therefore give Tooltip, Popover and
   Menu a **resolved `data-side` / `data-align`** with no geometry code. It parses that value on
   open, then on `scroll` (capture), `resize` and popup resizes while open. The Arrow then points
   correctly through plain `[data-side]` CSS. Anchored container queries
   (`@container anchored(fallback: …)`) are the pure-CSS answer, but only Chromium has them.
   **Adopt the resolver.**
2. **RTL (#53).** The engines follow the spec. Plain logical `position-area` keywords
   (`block-end`, `span-inline-end`) resolve against the **containing block**, which for a
   top-layer popover is the initial containing block. That means the root's direction, so a
   `dir="rtl"` container is ignored. The `self-*` keywords resolve against the **popup's own**
   direction, which it inherits from its DOM parent: `self-block-end span-self-inline-end`,
   `span-self-x-end`, `self-x-end`. That fixes container RTL with no JS. Chromium was verified;
   WebKit agrees by source. CSSWG made the same change for the customizable-select picker
   (w3c/csswg-drafts#13738). The Combobox note "Firefox lacks `span-self-inline-end`" was wrong:
   `block-end span-self-inline-end` is **invalid grammar** because it mixes keyword groups.
   **Firefox has a separate bug** (Mozilla 2019601, NEW): when the popover's parent box has a
   different direction from the root, any `position-area` popover is misplaced along the inline
   axis. This includes physical keywords, so Tooltip, Popover and Menu are already affected
   today. There is no general workaround. **Adopt `self-*` keywords; record the Firefox bug for a
   human.**
3. **Context menus in RTL (#88).** Native context menus open to the left of the pointer in RTL.
   That direction comes from the **browser or OS UI locale**, never from the page's `dir`. This
   was confirmed in Chromium Views (`base::i18n::IsRTL()`), Firefox (the chrome document's
   direction), GTK (`default:RTL` translation) and AppKit (the application's layout direction).
   A web menu's content follows the page, though, so a point-placed menu should follow the
   **menu popup's computed `direction`**. In RTL, put the menu's right edge at the point and
   mirror the fallbacks. Physical `right` insets do this; verified in Chromium and Firefox,
   including inside an RTL container, where the Firefox bug does not apply. **Adopt.**

Two API-affecting points for the designer:

- **`data-side` meaning.** Should `data-side` / `data-align` (and `state.side`) become the
  resolved placement while open, or should new attributes carry it? Recommendation: resolved,
  with the requested value as the SSR / closed value. That is what Floating UI-based libraries
  do, and the Arrow needs nothing else.
- **`align` and submenus under RTL.** `align="start"` is physical today (`span-right`), and
  submenus open on the physical right even though the RTL keyboard opens them with ArrowLeft
  (`menu-popup.tsx` uses `side` `"right"` with physical keywords). Recommendation: `align`
  `start` / `end` becomes inline-relative (`span-self-x-end` / `span-self-x-start`) and the
  default submenu side becomes inline-end (`self-x-end span-bottom`). Explicit
  `side="left"` / `"right"` stay physical.

## 1. Resolved side and the Arrow (#20)

### Current state

Tooltip, Popover and Menu set inline `position-area` from `side` + `align` with physical keywords
(`packages/ui/src/internal/anchor-position.ts`), plus
`position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline` (submenus:
`flip-inline`). `data-side` / `data-align` on Popup and Arrow echo the **requested** values, so an
arrow mis-points after a flip (design/components/tooltip.md 3, 7.3). Combobox uses logical
keywords and emits no `data-side`. A point-placed context menu uses anchorless `@position-try`
rules.

### Candidates

Probe `arrow-flip.mjs`. The tooltip is requested on `top`, then flipped below by the viewport edge
or by scrolling. "Arrow" means the arrow centre lands on the popup edge that faces the trigger.

| Technique | Chromium 156 | Firefox 157 | WebKit (Safari 27) | Notes |
| --- | --- | --- | --- | --- |
| `getComputedStyle(popup).positionArea` reflects the applied fallback | yes (open, flip, scroll) | yes (open, flip, scroll) | yes by source: the chosen option is a full style resolution (`TreeResolver::tryChoosePositionOption`) | Up to date synchronously after `showPopover()`, in `toggle`, in a `scroll` handler (`resolved-side-timing.mjs`). Margins swapped by the flip are reflected too. |
| Anchored container queries: `container-type: anchored` + `@container anchored(fallback: flip-block)` | yes (BCD 143; arrow correct, also after scroll) | no (BCD false; no implementation bug, only WPT-failure trackers 1986919, 1991142, 2066181) | no (BCD false; WebKit position #501 has no position) | css-anchor-position-2. Mozilla position #1236 has no position. Pure CSS, no events. |
| `@position-try` rules carrying custom properties | no | no | no | Not an [accepted @position-try property](https://drafts.csswg.org/css-anchor-position-1/#accepted-position-try-properties). |
| Margin inheritance trick (popup `margin-block: auto 8px` is swapped by `flip-block`; the arrow inherits `margin-block` and sits at the non-auto end) | works | **fails**: descendants inherit the unflipped margins | likely works (option applied in the style tree) | Clever, but Firefox applies fallbacks only to the box, not to inherited style. Reject. |
| `position: fixed` arrow placed with `anchor()` against the trigger and the popup (`clamp(popup edge, trigger centre, popup edge)` per axis) | correct on open; **stale after scroll** unless `position-anchor` names the trigger | correct on open, wrong after scroll in both spellings (Firefox's scroll compensation puts it hundreds of px off) | not tested | Needs `anchor-name` on both elements. Fragile. Reject. |
| `position: absolute` arrow inside the popup with `anchor(--trigger …)` | not an acceptable anchor (spec: the anchor must be laid out before the arrow, through its containing-block chain) | same | same | As specified. |
| JS rect comparison (popup vs trigger `getBoundingClientRect`) | works | works | works | Same event plumbing as computed style, but more code and ambiguous when the popup overlaps the trigger. Computed style is exact and includes flips. |
| ResizeObserver / IntersectionObserver | n/a | n/a | n/a | Neither observes a position change. RO on the popup is useful only as an extra trigger (content resize can change fit). |

### Recommendation: a resolver hook shared by Tooltip, Popover and Menu

- When open (`toggle` newState `open`, or right after `showPopover()`), and on `scroll`
  (`document`, capture, passive; this catches nested scrollers), `resize` (window) and a
  `ResizeObserver` on the popup while open: read `getComputedStyle(popup).positionArea`, map it to
  `{ side, align }` and set state only if it changed. Remove the listeners on close. The cost is
  one style read per scroll event per open popup. In the probe, reading inside the `scroll`
  handler already returns the new option, so no rAF is needed.
- Parse tokens rather than whole strings. Both engines serialise in grammar order with short
  logical forms: `span-left top`, `self-end span-self-end`, `span-self-x-end bottom`,
  `self-x-start span-top` (`computed-serialization.mjs`). Firefox writes a flipped single
  keyword as `span-all bottom` where Chromium writes `bottom`. The side is the token that is
  neither `center`, `span-all` nor `span-*`. `top` / `bottom` / `left` / `right` are physical;
  `self-x-start` / `self-x-end` (and `x-*`) need the popup's computed `direction`;
  `self-start` / `self-end` in first position are the block axis (`top` / `bottom` in
  horizontal-tb). The align comes from the `span-*` token relative to the side's axis (or
  `center`).
- Changes not covered: anchor movement from layout shifts without scroll or resize. That is rare,
  and the next scroll corrects it. Chromium could get an exact signal from an anchored query
  driving a discrete transition (`transitionrun`), but that is Chromium-only, so don't build it.
- Note that the engines keep the **last successful position option** while it still fits ([spec](https://drafts.csswg.org/css-anchor-position-1/#last-successful-recording)).
  After a flip, scrolling back does not un-flip, and the resolver agrees because it reads
  what is applied.
- This is observation, not "positioning JS": the browser still places the popup. It answers
  tooltip.md 7.3 ("a JS `data-side` resolved from `getBoundingClientRect` … is exactly the
  positioning JS the design avoids") with a cheaper, exact read.
- Arrow CSS stays the documented `[data-side="top"] { … }` recipe. Optionally document the
  Chromium-only `container-type: anchored` recipe as a no-JS alternative for consumers with
  `side={null}` (the resolver cannot interpret consumer `@position-try` rules that set insets
  instead of `position-area`; with `side={null}` it should emit nothing, as today).
- Point-placed menus (anchorless `@position-try`) have no side; leave `data-side` off as today.
- Browser tests: one row per engine asserting the resolved `data-side` after an edge flip and
  after a scroll that forces a flip. WebKit is covered by CI only; its computed-style behaviour is
  from source, so this row is the first real WebKit check.

## 2. Logical keywords and direction on top-layer popovers (#53)

### Spec

CSS Anchor Positioning 1 §3.1.2 (WD 2026-09-06, ED read 2026-10-22): "the plain logical keywords
(start, end, etc) refer to the writing mode of the box's containing block … The self-* logical
keywords … are identical, but refer to the box's own writing mode." The grid itself is ordered by
the containing block's writing mode. `flip-*` tactics also resolve logical directions against the
containing block. A popover in the top layer has the initial containing block (or the viewport
for `position: fixed`), whose writing mode is the root's (css-writing-modes principal writing
mode, with the HTML body-to-root propagation). So a `dir="rtl"` **container** cannot affect plain
logical keywords, while the popup's own `direction`, inherited from its DOM parent, drives
`self-*` keywords. This is intended: CSSWG #13734 (2026-04) resolved "no change" to
containing-block resolution and asked for clearer naming. #13738 changed the css-forms
customizable-select picker fallbacks to `self-` keywords for exactly the RTL control-in-LTR-page
case. **Not a spec bug**; nothing to file.

Grammar trap: the keyword groups cannot be mixed. `block-end span-self-inline-end` and
`block-end span-end` are **invalid** (dropped at parse time). Valid pairs are
`self-block-end span-self-inline-end`, `self-end span-self-end`, `bottom span-self-x-end`
(the physical group accepts `self-x-*` / `self-y-*`), and `self-x-end span-bottom`. This is
probably why combobox.md 7.2 concluded that "Firefox lacks it". BCD lists every `self-*` keyword
in Chrome 129+, Firefox 147+ and Safari 26+ (the renamed `self-x-*` in Chrome 143, Safari 26.2).

### Engine behaviour

Probe `rtl-position-area.mjs`: anchor 300..500, popup 120 wide. "L" = left edges aligned (the LTR
result of "span toward inline-end"), "R" = right edges aligned (the RTL result).

| Setup | Plain logical (`block-end span-inline-end`, `bottom span-x-end`, `end span-end`) | Self (`self-block-end span-self-inline-end`, `bottom span-self-x-end`, `self-end span-self-end`) |
| --- | --- | --- |
| LTR page | L / L (Chromium / Firefox) | L / L |
| `<html dir="rtl">` or `body { direction: rtl }` | R / R | R / R |
| `dir="rtl"` container, popup inside it | **L** / misplaced (Firefox bug) | **R** / misplaced (Firefox bug) |
| LTR page, `dir="rtl"` on the popup only | L / L | R / R |
| RTL page, `dir="ltr"` on the popup | R / R | L / L |
| WebKit (source) | resolves against `anchored.container()->style().writingMode()`, the RenderView for a top-layer box | resolves against `style.writingMode()` of the box (`coordMatchedTrackForAxis(axis, containingWritingMode, style.writingMode())`) |

So the `dir` attribute or `direction` on the popup itself changes `self-*` resolution and never
plain resolution. The popup inherits its direction from its DOM parent, so with `self-*` keywords
a popup rendered inside an RTL container (as all FUNSTACK popups are) follows the container
automatically, with no JS. Chromium and WebKit do; Firefox does too, once its bug is fixed.

### The Firefox bug (Mozilla 2019601)

Probes `firefox-rtl-parent.mjs`, `firefox-rtl-justify.mjs`, `firefox-rtl-wrapper.mjs`,
`anchor-insets-rtl.mjs`.

- **Trigger:** the popover's parent **box** has a different `direction` from the root. Examples:
  an RTL `div` or inline `span` in an LTR page, or an LTR `div` in an RTL page. Ancestors with
  `display: contents` do not count; an LTR block or inline wrapper with its own box cures it. The
  popup's own `dir` is irrelevant, and so is the anchor's position in the tree.
- **Effect:** the inline-axis alignment offset inside the `position-area` cell is applied in the
  mirrored direction. Only alignments with a zero offset from the cell's start come out right.
  `bottom span-right` lands at -80 instead of 300, `bottom` at -340 instead of 340, and
  `justify-self: anchor-center` is wrong as well. **Physical keywords are affected too**, so
  today's Tooltip, Popover and Menu are misplaced in Firefox inside any direction island. The
  block axis is unaffected.
- **Not affected:** `anchor()` insets with explicit physical edges (`top: anchor(bottom);
  left: anchor(left)` and `right: anchor(right)`, with flips) and plain `left` / `right` /
  `top` insets. The point-placed context menu is therefore unaffected.
- **Workarounds considered.** Switching to `anchor()` insets fixes start and end alignment, but
  centre alignment needs either `anchor-center` (broken too) or the popup's width. Wrapping the
  popup in a box with the root's direction changes layout, and SSR cannot know the root's
  direction. Neither is worth shipping for one engine's bug under the "no fallbacks" policy.
- **Existing reports:** 2019601 "Anchor positioning issue: misplacing elements (popovers) in RTL
  mode" (NEW, S3, Layout: Positioned, 2026-02-26). It already has a mixed-writing-mode variant.
  2050071 (NEW, 2026-06-24) looks like the same bug, misdescribed. Neither has our reduction.

### Recommendation

- **Combobox:** `position-area: self-block-end span-self-inline-end; position-try-fallbacks:
  flip-block`. Container RTL then works with no JS. This fixes deviation 1 and replaces the
  "read the input's direction at open" plan. Reading at open would need JS, would be wrong
  before hydration and would go stale if `dir` changes; it also gains nothing in Firefox, whose
  bug is independent of the keywords.
- **Popover, Tooltip, Menu `align`:** if the designer accepts inline-relative alignment, emit
  `<side> span-self-x-end` for `start` and `<side> span-self-x-start` for `end` on top / bottom.
  Left / right sides keep `span-bottom` / `span-top` (block axis, no direction). This is a
  behaviour change only under RTL.
- **Submenus:** default side inline-end: `self-x-end span-bottom` with `flip-inline`. Verified:
  LTR opens right, RTL opens left, and it flips when there is no room
  (`rtl-point-and-submenu.mjs`). This makes placement agree with the already-mirrored arrow keys.
- **Resolver (section 1):** a computed `self-x-*` maps to a physical side through the popup's
  computed `direction`.
- **Tests:** the container-RTL browser rows must branch on Firefox and assert the documented
  misplacement, or be marked as tracking 2019601. Do not skip them.

## 3. Context menus in RTL (#88)

| Platform | Opens left of the pointer in RTL? | Driven by | Evidence |
| --- | --- | --- | --- |
| Chromium on Windows / Linux / ChromeOS (Views) | yes | browser UI locale: `MenuController::AdjustAnchorPositionForRtl` flips `kTopLeft` to `kTopRight` when `base::i18n::IsRTL()` | source. Touch opens use `kBottomCenter` (centred above the touch point), which is relevant to #88's touch offset item |
| Firefox (XUL popup; all desktop platforms where not native) | yes | the context menu popup's frame direction, which lives in the browser chrome document and follows the UI locale (`nsMenuPopupFrame`: "Right-align RTL context menus") | source |
| Safari / Chromium on macOS (NSMenu) | yes (platform convention) | `NSMenu.userInterfaceLayoutDirection`, which defaults to the application's layout direction (system / app language). WebKit's context-menu proxy does not set it (it does set it from the page for `<select>` popups) | Apple docs + WebKit source |
| GTK 3 (`gtk_menu_popup_at_pointer`) | yes | the menu widget's direction, defaulting to the locale (`default:RTL` translation) | `gtkmenu.c` flips the anchors horizontally for `GTK_TEXT_DIR_RTL` |
| Win32 (`TrackPopupMenuEx`) | if the app asks (`TPM_RIGHTALIGN` / `TPM_LAYOUTRTL`; RTL-mirrored apps do) | app / UI language | Microsoft docs |
| Android | not verified from source here. Framework popups are positioned with relative gravity (`START`/`END`), which resolves through the layout direction (app locale, `supportsRtl`). Chrome's touch context menu is a dialog / sheet, not point-anchored | locale | general platform knowledge |

**No platform uses the web page's `dir`.** A page cannot influence the native menu. But a
FUNSTACK context menu is page content: its items are in the page's language and laid out by the
page's direction. The natural rule for an in-page menu is the RTL native convention applied with
the **content direction**.

Recommendation:

- At a point open, read `getComputedStyle(popup).direction` (`isRtl(popup)` in `menu-dom.ts`).
  Use the popup rather than the ContextTrigger because the popup's direction governs how its
  items render. In RTL, emit `right: calc(100% - var(--menu-point-x)); left: auto`, and spell
  the horizontal fallbacks mirrored: `--fsui-menu-right` with `left: var(--menu-point-x);
  right: auto`. Verified in both engines, in an RTL container and an RTL page: the menu's right
  edge sits at the point and flips rightward near the left edge (`rtl-point-and-submenu.mjs`).
  This adds two `@position-try` rules to the shipped stylesheet. The generation-parity respelling
  for the stale-fallback problem applies unchanged.
- No upstream issue: the point path uses insets, not `position-area`, so the Firefox bug does not
  apply.

## Verdicts

| Feature | Verdict |
| --- | --- |
| Resolved `data-side` / `data-align` from computed `position-area` (Tooltip, Popover, Menu; Arrow via CSS) | **Adopt** |
| Anchored container queries (`container-type: anchored`, `@container anchored(fallback)`) | **Not yet** in the library (Chromium-only); may be documented as a consumer recipe |
| Margin-inheritance arrow trick; fixed-position `anchor()` arrow | **Reject** (Firefox) |
| `self-*` `position-area` keywords for direction-following placement (Combobox, inline `align`, submenu side) | **Adopt** |
| Reading the anchor's direction in JS to choose physical keywords (the #53 issue's proposal) | **Reject** (no gain over `self-*`) |
| Workaround for Firefox 2019601 | **Not yet** (none general; document and test the degradation) |
| RTL point placement from the popup's computed `direction` | **Adopt** |

## Upstream reports (human task, do not file from an agent)

- **Mozilla bug 2019601:** add a comment with the reduction. It covers the parent-box direction
  mismatch with the root as the trigger (not RTL as such: an LTR island in an RTL page fails
  too); `display: contents` ancestors are ignored; the inline alignment offset is mirrored
  (`bottom span-right` gives -80 instead of 300 for a 120 px popup under a 300..500 anchor);
  `anchor()` insets are unaffected; Firefox 157. Testcase: `firefox-rtl-wrapper.mjs` /
  `firefox-rtl-justify.mjs` HTML. Also suggest duplicating 2050071 into it.
- No spec issue: the CSSWG behaviour is intended (#13734, #13738).

## References

- CSS Anchor Positioning 1, position-area: https://drafts.csswg.org/css-anchor-position-1/#position-area
- CSS Anchor Positioning 2, anchored container queries: https://drafts.csswg.org/css-anchor-position-2/#anchored-container-queries
- CSSWG #13738 (select picker uses `self-` keywords): https://github.com/w3c/csswg-drafts/issues/13738
- CSSWG #13734 (`anchor(start)` resolution, no change): https://github.com/w3c/csswg-drafts/issues/13734
- Mozilla bug 2019601: https://bugzilla.mozilla.org/show_bug.cgi?id=2019601
- Mozilla bug 2050071: https://bugzilla.mozilla.org/show_bug.cgi?id=2050071
- WebKit standards position #501 (anchored container queries): https://github.com/WebKit/standards-positions/issues/501
- Mozilla standards position #1236: https://github.com/mozilla/standards-positions/issues/1236
- BCD 8.1.7: https://unpkg.com/@mdn/browser-compat-data@8.1.7/data.json (`css.properties.position-area.*`, `css.properties.container-type.anchored`, `css.at-rules.container.anchor_position_queries`)
- WebKit `AnchorPositionEvaluator.cpp`, `StyleTreeResolver.cpp`: https://github.com/WebKit/WebKit/tree/main/Source/WebCore/style
- Chromium `menu_controller.cc`: https://chromium.googlesource.com/chromium/src/+/main/ui/views/controls/menu/menu_controller.cc
- Chromium `toolkit_delegate_views.cc`: https://chromium.googlesource.com/chromium/src/+/main/components/renderer_context_menu/views/toolkit_delegate_views.cc
- Gecko `nsMenuPopupFrame.cpp`: https://github.com/mozilla-firefox/firefox/blob/main/layout/xul/nsMenuPopupFrame.cpp
- AppKit `NSMenu.userInterfaceLayoutDirection`: https://developer.apple.com/documentation/appkit/nsmenu/userinterfacelayoutdirection
- GTK 3 `gtk_menu_popup_at_pointer`: https://docs.gtk.org/gtk3/method.Menu.popup_at_pointer.html
- Win32 `TrackPopupMenuEx`: https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-trackpopupmenuex
- Probes: `memo/platform-researcher/probes/18-positioning-wave11/` (README lists each script)
