# @funstack/ui conventions: shipped CSS and anchored placement

Part of the API conventions: sections 12 and 13 of `design/conventions.md`, which keeps their
headings as stubs. Same status and rank as that document (accepted and binding;
`docs/vision.md` wins over it, it wins over a component design), and the same rule for history
(`design/CHANGELOG.md`).

The sections keep their numbers, so "conventions 13.2" is section 13.2 here. A section number
in the text that is not a heading of this document (3.5, 4.1, 7.4, 11) is a section of
`design/conventions.md`.

## 12. Shipped functional CSS

The library ships no visual CSS: no reset, no theme, no colours, sizes or motion. A component
may ship a **minimal functional stylesheet, for placement and interaction timing only**, where
inline styles cannot express the rule; it must be documented and overridable. Rules:

- **Only at-rules with no selectors**: nothing cascades onto any element, and the inline
  `style` the part renders is what references the rules. The first case is `Menu.Popup`'s point
  placement (`@position-try` options, mirrored for a right-to-left menu and offset for a touch
  open; `design/components/context-menu.md` 4.2).
  **One exception:** a rule whose selector matches only elements the library itself marks with
  a `data-fsui-<component>-<part>` attribute, and whose declaration sets only a `--fsui-`
  registered custom property that the part's own inline `style` consumes (`@property` plus
  `:root:has([role="tooltip"]:popover-open) [data-fsui-tooltip-trigger] { --fsui-tooltip-warm: 1 }`,
  Tooltip's skip-delay on the native `interestfor` path, `design/components/tooltip.md` 6).
  Still nothing visual and nothing on a consumer's element; the selector exists because the
  inline value it feeds cannot see other elements.
- **Rendered by the part that needs them**, as a React 19 hoisted style, never as a stylesheet
  file the consumer imports: `<style href="@funstack/ui/<name>" precedence="fsui">`. React moves
  it into `<head>` in the commit (before layout effects) and deduplicates it by `href` across
  roots; nothing lands in place, so the part still renders one DOM element and a
  `<ViewTransition>` boundary around that element is unaffected. Rendered only while the part
  uses the rules (a point-placed menu), so a page that never does never gets them.
- **Names are prefixed** `--fsui-<component>-…` so they cannot clash with a consumer's.
- **Opt-out through the part's existing switch** for stylesheet-owned placement (`side={null}`
  on a Popup): the part then renders neither the inline reference nor the style, and hands the
  consumer the data (custom properties) their own rules need.
- **The CSS text lives in a directive-free module** of the component that ships it, as a string
  constant (`menu/menu-point.ts`, `tooltip/tooltip-warm.ts`; the precedence name
  `FSUI_PRECEDENCE` in `internal/shipped-styles.ts`), covered by a jsdom row (one `<style>` in
  `document.head` after use, none without) and a browser row (the computed property names the
  option).

**CSP** (`docs/research/interaction-wave11.md` 2.4 has the engine and Fizz behaviour). A hoisted
`<style>` is **not** covered by what allows an inline `style` attribute: under a nonce- or
hash-based `style-src` a client-set inline style is exempt (react-dom writes it through the
CSSOM), a script-inserted `<style>` is blocked unless its text matches a `'sha256-…'` source or
it carries the nonce, and a server-rendered `style` attribute needs
`style-src-attr 'unsafe-inline'` (the SSR'd `position-area` of an anchored popup, Tooltip's
inline `interest-delay-*`; documented, not worked around). The library therefore:

1. exports the **SHA-256 (base64) of every shipped stylesheet** as `STYLE_SHA256` from
   `@funstack/ui/csp`, a committed constant that a jsdom row recomputes from the exported CSS
   strings; the docs' "Content Security Policy" page prints the `style-src` sources. This
   serves hash-based policies and FUNSTACK Static's static output with no API;
2. ships **one provider**, `<CSPProvider nonce>` from `@funstack/ui/csp` (a client module with
   a serialisable prop, so a Server Component layout renders it once; the library's only
   provider, decision 8's "no provider" being about experimental flags). Every part that
   renders a hoisted `<style>` reads its context and forwards the value as the element's
   `nonce`. The docs say: "pass the same value as React's `nonce: { style }` render option",
   and "if you pass `nonce.style`, render `<CSPProvider>` with the same value" (with the object
   form and a different nonce, or no provider, Fizz drops the rules; with no `nonce` option or
   the string form it strips the provider's nonce and keeps them);
3. reads no `<meta property="csp-nonce">` implicitly.

**At most one shipped stylesheet may render during SSR per precedence bucket**: Fizz writes
every `<style href precedence="fsui">` of one flush as a single element, whose hash is in no
`STYLE_SHA256` entry. A second server-rendered stylesheet gets its own precedence; a guard row
in `csp.test.tsx` renders Tooltip and a context menu on the server and asserts exactly one
`fsui` `<style>` whose text hashes to its entry, and the constraint is commented on
`FSUI_PRECEDENCE`. Today only Tooltip's skip-delay (a Trigger with `experimental_interestFor`)
renders during SSR; Menu's point rules render after a client interaction.

A blocked stylesheet degrades: the point menu opens at the point but never flips; the
skip-delay inline value carries an explicit `var(--fsui-tooltip-warm, 0)` fallback, so it
computes to the Root's `delay`. Human items (FUNSTACK Static's SSR entry passes a string
`nonce`; React could emit the render nonce instead of dropping the rules) are tracked in issue
#91.

## 13. Anchored placement

Applies to every part that places a top-layer element against an anchor: Tooltip, Popover and
Menu `Popup` (the `side` / `align` matrix), Combobox `Popup` (fixed keywords) and the Select
docs recipe for `::picker(select)`; and to the one part placed at a point (Menu's context
open). `docs/research/positioning-wave11.md` holds the binding verdicts.

### 13.1 Keyword policy

The browser places the popup (vision principle 5); the library emits `position-area` and
`position-try-fallbacks` inline and reads nothing to choose them. Three rules follow from how
the spec resolves keywords on a top-layer element (css-anchor-position-1 §3.1.2: a **plain**
logical keyword refers to the writing mode of the **containing block**, which for a popover in
the top layer is the initial containing block, so the root's direction; a **`self-*`** keyword
refers to the popup's **own** writing mode, which it inherits from its DOM parent):

1. **Never a plain logical keyword** (`block-end`, `span-inline-end`, `end`) on a top-layer
   popup. It ignores a `dir="rtl"` container and the CSSWG resolved this is intended
   (w3c/csswg-drafts#13734; #13738 moved the customizable-select picker to `self-*` for the
   same reason). The physical keywords (`top`, `span-right`) and the `self-*` group are the
   library's whole vocabulary.
2. **Direction-following placement uses `self-*` keywords, never a JS read of `direction` to
   pick physical ones.** The popup inherits `direction` from the DOM parent the consumer
   rendered it in, so `self-x-end` is "the popup's inline-end" with no script, no stale value
   when `dir` changes, and the right answer on the server. (The exception is a popup with no
   anchor, 13.4: insets have no `self-*` form.)
3. **Keyword groups cannot be mixed.** `block-end span-self-inline-end` and `bottom span-end`
   are invalid and dropped at parse time. Valid pairs are one group each: physical with
   `self-x-*` / `self-y-*` (`bottom span-self-x-end`, `self-x-end span-bottom`), or
   `self-block-*` with `span-self-inline-*` (`self-block-end span-self-inline-end`). The
   combobox note "Firefox lacks `span-self-inline-end`" was this trap, not an engine gap: BCD
   lists every `self-*` keyword in Chrome 129+, Firefox 147+, Safari 26+.

The matrix the shared helper (`internal/overlay/anchor-position.ts`, directive-free) emits, assuming
`horizontal-tb` (the library does not design for vertical writing modes; `block-start` /
`block-end` would add nothing over `top` / `bottom` there):

```ts
export type AnchorSide = "top" | "bottom" | "left" | "right" | "inline-start" | "inline-end";
export type PhysicalSide = "top" | "bottom" | "left" | "right";
export type AnchorAlign = "start" | "center" | "end";
export function positionArea(side: AnchorSide, align: AnchorAlign): string;
```

| `side` \ `align` | `start` | `center` | `end` |
| --- | --- | --- | --- |
| `top` | `top span-self-x-end` | `top` | `top span-self-x-start` |
| `bottom` | `bottom span-self-x-end` | `bottom` | `bottom span-self-x-start` |
| `left` | `left span-bottom` | `left` | `left span-top` |
| `right` | `right span-bottom` | `right` | `right span-top` |
| `inline-start` | `self-x-start span-bottom` | `self-x-start` | `self-x-start span-top` |
| `inline-end` | `self-x-end span-bottom` | `self-x-end` | `self-x-end span-top` |

- **`side`**: `top` / `bottom` / `left` / `right` are physical. `inline-start` /
  `inline-end` follow the popup's direction: `inline-end` is the right of the anchor in
  LTR and its left in RTL. Menu's submenu default is `inline-end`, so the submenu opens on the
  side the already-mirrored ArrowRight / ArrowLeft keys point to. Vertical logical sides are
  not offered (see above).
- **`align`** on a horizontal side (`top` / `bottom`) is **inline-relative**: `start` aligns
  the popup's inline-start edge with the anchor's (`span-self-x-end`: the popup spans toward
  the popup's inline-end), `end` the inline-end edges. On a vertical or inline side it is
  block-relative and physical: `start` aligns the top edges (`span-bottom`), `end` the bottom
  edges. In an LTR document this equals a physical matrix; under RTL, `start` / `end` are
  mirrored, as a reader of "start" expects and as React Aria and the direction-aware Floating
  UI libraries do.
- **`center`** is the single-keyword form (the span-all cell is `anchor-center` aligned).
- `position-try-fallbacks` is `flip-block, flip-inline, flip-block flip-inline` (
  `flip-inline` for a submenu). The `flip-*` tactics flip the containing block's axes, which in
  `horizontal-tb` are the x and y axes whatever the direction, so they apply to `self-x-*`
  tokens too (verified: `self-x-end span-bottom` flips to `self-x-start span-top`).
- **Combobox** uses the fixed `self-block-end span-self-inline-end` with `flip-block` (no
  `side` / `align`); **Select**'s docs recipe for `::picker(select)` uses the same spelling.

### 13.2 Resolved placement: `data-side` is where the popup is

`data-side` / `data-align` and `state.side` / `state.align` are the **resolved placement while
the popup is shown** and the requested values otherwise (on the server, while closed, and when
the computed value cannot be mapped). One vocabulary: there is no second attribute
(`data-resolved-side`). It is observation, not positioning: every engine reports the applied
`position-try-fallbacks` option in `getComputedStyle(popup).positionArea`
(`docs/research/positioning-wave11.md` 1), and the browser still places the popup.

**The parser**, `parsePositionArea(value, selfDirection, rootDirection, writingMode)` in
`internal/overlay/anchor-position.ts`, is pure and total (`null`, never a throw) and is only run on a
shown popup. In `horizontal-tb` it maps the full keyword grammar:

- The side token is the one that is neither `center`, `span-all` nor `span-*`. Physical tokens
  map directly; `self-x-*` / `self-inline-*` through the popup's computed `direction`;
  `x-*` / `inline-*` through the root's (`rootDirection` may be a function, called only when
  such a token appears: a consumer `style` override may use them); `y-*` / `block-*` /
  `self-block-*` and a bare `start` / `end` / `self-start` / `self-end` in first position are
  the block axis (`top` / `bottom`).
- The align token is the `span-*` token, mapped to a physical direction the same way, then to
  `start` / `end` relative to the side's cross axis (horizontal side: the popup's inline-end is
  `start`; vertical side: bottom is `start`). No span token, `center` or `span-all` is `center`.
- Engines serialise in grammar order and in short logical forms (`span-left top`,
  `self-end span-self-end`, `span-self-x-end bottom`; Firefox writes a flipped single keyword
  as `span-all bottom` where Chromium writes `bottom`). The jsdom row feeds the parser these
  strings.
- `none`, an empty value, a `writingMode` other than `horizontal-tb`, or an unknown token gives
  `null`: the part keeps the requested values.

**The observer**, `useResolvedPlacement({ side, align }) → { side, align, ref }`
(`internal/overlay/use-resolved-placement.ts`), is shared by Tooltip, Popover and Menu. The part merges
`ref` into its popup's ref and renders the returned values. The hook's comments hold the
mechanism; the rules are:

- **Sources.** A `ResizeObserver` on the popup from mount (hidden to shown is a resize,
  delivered before paint, so the first painted frame carries the resolved side; a content
  resize reads again; hidden again resets). `toggle` on the popup (open: read and install the
  two listeners below; closed: remove them and reset; it also drives the jsdom row, which has
  no `ResizeObserver`). While shown: `scroll` on the document (capture, passive) and `resize`
  on the window.
- **Each `scroll` / `resize` reads at once and again in the next two animation frames**
  (coalesced; a scroll during a pending pair re-runs it at the end). Engines apply
  scroll-dependent anchoring one frame after the `scroll` event and the timing is unspecified
  (css-anchor-position-1 §3.3), so the frame reads are the mechanism, not an engine special
  case.
- **`data-side` reports what is applied; the library never forces a re-choice.** Chromium keeps
  the option chosen at show for a top-layer popover although it now overflows (non-conformant,
  §6.5; the human upstream task is **#92**, cited from the scroll rows).
- **Write.** A plain `useState` in the part: `flushSync` from the observer and event paths so
  the attribute lands before paint, a plain `setState` from the layout effect that re-reads
  when the request changes. Written only when `side` or `align` changed (3.5); the state is
  `null` while not shown and when the parsed pair equals the request. A popup hidden but still
  rendered (exit animation) keeps the resolved value until its box goes.
- **Render cost.** A popup with a physical `side` that opens without flipping costs no render
  (Tooltip's "no React work per hover", tooltip.md 4.1); a flip costs one render on open and
  one on close. A logical `side` (`inline-start` / `inline-end`) always costs that pair,
  because the physical `data-side` never equals the logical request (Menu's submenus pay it by
  default; a jsdom render-count row pins it). "Only when changed" also ends the
  `ResizeObserver` loop a consumer's `[data-side]` padding rule could start.
- **Idle** with `side={null}` (the stylesheet owns placement) and for a point-placed menu: no
  reads, nothing emitted.
- The hook attaches native listeners through the ref (7.4) and is independent of the trigger
  mechanism: it runs on Tooltip's native `interestfor` path too, where the interaction effect
  attaches nothing.

**Gap recipes must be symmetric** (documented on the component pages). `flip-block` /
`flip-inline` swap the popup's own margins along the flipped axis, so a **one-sided margin
keyed on the resolved `data-side` is the one wrong form**: after a flip it lands on the far
edge and the gap against the trigger is 0. The two correct forms:

1. **A static margin on the requested edge, not keyed on `data-side`** (preferred when a class
   knows its `side`): `margin-block-start: 6px` for a popover below its trigger,
   `margin-inline-start: 2px` for a submenu. The flip swaps it, it is present at the first
   layout, and it never triggers a re-choice.
2. **A symmetric margin along the side's axis keyed on `data-side`**, when one class serves
   several sides: `margin-block: 6px` for `top` / `bottom`, `margin-inline: 2px` for `left` /
   `right` **and for the closed values `inline-start` / `inline-end`** (a logical side carries
   them until the observer writes; without those keys the write is a margin change that re-runs
   the choice, §6.5.1, and can trip a "ResizeObserver loop" error). This form flips a few
   pixels early (the far margin is part of the overflow test).

An **Arrow** is unaffected: the insets of a child are not part of the option.

Limits, documented:

- An anchor that moves through a layout shift with no scroll or resize is not observed; the
  next scroll corrects it.
- After a scroll-driven flip **one frame is painted with the old `data-side`** (the write
  follows the second-frame read). The show path has no such frame.
- `@starting-style` is computed before the observer's write, so an entry animation keyed on
  `data-side` starts from the **requested** side's values on a flipped open. Key entry
  animations on something direction-neutral (opacity, scale); the exit uses the resolved
  values.
- Chromium's anchored container queries (`@container anchored(fallback: …)`) are a documented
  consumer recipe for `side={null}`, not library code (Chromium-only).

### 13.3 The Firefox parent-direction bug (Mozilla 2019601)

When the popup's **parent box** has a different `direction` from the root (an RTL island in an
LTR page, or an LTR island in an RTL page; `display: contents` ancestors do not count), Firefox
applies the inline-axis alignment offset of any `position-area` cell mirrored, **physical
keywords included**: `bottom span-right` under a 300..500 px anchor lands at −80 instead of
300. Every anchored FUNSTACK popup rendered inside such an island is misplaced in Firefox
today, independently of the keyword change above; the block axis and `anchor()` insets (the
point-placed menu) are unaffected.

- **No workaround ships.** `anchor()` insets fix `start` / `end` but not `center`
  (`anchor-center` is broken too), and a wrapper box with the root's direction changes layout
  and cannot be chosen on the server. One engine's bug does not earn a fallback (vision, browser
  support policy).
- **Tests assert the degradation.** `src/__tests__/engine.ts` gains
  `anchorPositionHonoursParentDirection`, a synchronous runtime probe (an RTL `div` holding a
  physical-keyword popover shown against an anchor inside it; `true` when the inline edge lands
  where the keyword says). Container-RTL browser rows branch on it, assert the mirrored
  placement where it is `true` and the documented misplacement where it is `false`, with a
  comment naming the bug, so the day Firefox fixes it the row fails and the branch is deleted.
  `browserName === "firefox"` is not used: Playwright's Firefox may be ahead of the release.
- **Human task** (never filed from an agent): comment on Mozilla 2019601 with the reduction
  in `docs/research/positioning-wave11.md` ("Upstream reports"), and suggest duplicating
  2050071 into it. Tracked as this repository's issue **#89**; cite it from tests and docs.

### 13.4 Placement at a point and direction

A popup with **no anchor** (Menu's context open, `design/components/context-menu.md` 4) is
placed with insets, which have no `self-*` form, so this is the one place the library reads
`direction` in JS: `getComputedStyle(popup).direction` (`isRtl(popup)` in `menu-dom.ts`), read
**once per open and per move** by the region's `openAt` and stored in the placement record,
so the Popup's inline style stays a pure function of state and the server never reads anything.
The popup's direction, not the region's or the OS locale's: a native RTL context menu opens to
the left of the pointer because the **UI** is RTL (Chromium Views `base::i18n::IsRTL()`, Gecko's
chrome document, GTK's `default:RTL`, AppKit's layout direction; no platform reads the page's
`dir`), and for an in-page menu the content direction is the counterpart, since it governs how
the items read. In RTL the menu's **right** edge sits at the point (`right: calc(100% -
var(--menu-point-x)); left: auto`) and the shipped `@position-try` options are mirrored
(`--fsui-menu-right`, `--fsui-menu-up-right`, section 12: five options in all). The Firefox bug
of 13.3 does not apply to insets.

### 13.5 Migration (0.1.0-alpha.9)

Moved to `design/CHANGELOG.md` (part "conventions.md: 13.5 migration note"): a release note, not a rule.
