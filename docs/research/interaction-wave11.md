# Wave 11 interaction research: tooltip skip-delay, context menu follow-ups

Research date: **2026-10-23**. GitHub issues #21 (tooltip skip-delay group) and #88 (context menu
follow-ups). Sources: Chromium `main` (`core/dom/element.cc`, `ui/views/controls/menu/menu_controller.cc`)
and the M156 branch (8078) flags file and `css_selector.cc`; Gecko `main` (`XULButtonElement.cpp`,
`nsXULPopupManager.cpp`, `StaticPrefList.yaml`, per-platform `nsLookAndFeel`); GTK 3.24 and GTK
`main` (`gtkmenushell.c`, `gtktooltip.c`); the Open UI interest invokers explainer; Microsoft
Win32 docs; react-dom 19.3.1; Radix Tooltip 1.4.1 / ContextMenu 2.4.1 / Menu 2.2.1 / Select 2.4.1 /
ScrollArea; Base UI 1.9.0; React Aria 3.53.1 / react-stately 3.51.0. Probes ran on Playwright
Chromium 156.0.8078.4 and Firefox 157.0 (`memo/platform-researcher/probes/18-wave11/`). WebKit
still cannot launch locally; WebKit statements come from the earlier context-menu research or are
marked unverified.

| Engine | Stable release | Date |
| --- | --- | --- |
| Blink | Chrome 156 (156.0.8078.48) | 2026-10-20 |
| Gecko | Firefox 158 | 2026-10-13 |
| WebKit | Safari 27.0 | 2026-09-14 |

Builds on [popover-anchor-tooltip.md](./popover-anchor-tooltip.md) and
[context-menu.md](./context-menu.md).

## Summary and verdicts

| Topic | Recommendation for v1 | Verdict | API impact |
| --- | --- | --- | --- |
| Tooltip skip-delay (#21) | Global, no provider: **a tooltip opens with no delay while any tooltip (`[role="tooltip"]:popover-open`) is showing**, its close delay included. Native path: a shipped `:root:has()` rule sets a non-inherited registered property on triggers, and the inline `interest-delay-start` is `calc(<delay> * (1 - var(--fsui-tooltip-warm)))`. JS path: the same check with `querySelector` at hover start, then close the other tooltip at once. | **Adopt** (verified in Chromium 156) | None required. Adds Tooltip's shipped stylesheet (a second user of conventions 12), so it needs the CSP answer below. Optional later: a cooldown longer than `closeDelay` (CSS transition trick, verified). |
| Press-drag-release (#88) | Mouse (Linux, macOS; Windows never needs it): keep the existing capture for the whole gesture; hit-test with `elementFromPoint` on the captured `pointermove` (focus the item) and `pointerup` (activate it if the pointer moved more than 4 px; close if released outside the menu at least 500 ms after the open). Touch: the same code, plus a non-passive document `touchmove` `preventDefault()` while the long-press gesture lasts. | **Adopt** for mouse; touch adopt but verify on devices | None |
| Touch offset (#88) | Touch and pen opens place the menu **above** the touch point with a gap of about 16 px, start-aligned, flipping below (with the gap) and to the left as needed. | **Adopt** | None (a placement detail; possibly a `data-` hook) |
| Close-on-scroll (#88) | Point opens (ContextTrigger, keyboard included): close with `"dismiss"` on a `scroll` (document, capture, passive) whose target is the document or an ancestor of the region. Do not lock page scroll. Stop wheel scroll chaining out of the popup with a popup-scoped non-passive `wheel` listener. Document a CSS recipe for apps that want to block scrolling. Trigger opens: unchanged (anchor positioning follows the trigger). | **Adopt** | None |
| CSP for hoisted `<style>` (#88) | Publish the SHA-256 of every shipped stylesheet (works for hash-based and static CSPs, no API). For nonce-based CSPs add one context provider that takes `nonce`, read by every part that renders a hoisted `<style>`, documented as "pass the same value as React's `nonce.style` render option". | **Adopt** hashes now; provider when Tooltip ships its stylesheet | **API**: one provider (or a `nonce` prop per style-rendering part) |

## 1. Tooltip skip-delay group (#21)

### 1.1 Native `interestfor` has no warm-up

Chromium's interest invoker code (`Element::ScheduleInterestChangesIfNeeded`,
`ScheduleInterestGainedTask`, `InterestGained` in `core/dom/element.cc`):

- Hover or focus on an invoker that has no interest schedules a gain task after the computed
  `interest-delay-start` of **that** invoker (`normal` = 0.25 s; `kDefaultInterestDelayStartSeconds`).
  Nothing looks at other invokers; there is no global "browse mode".
- De-hovering schedules a loss after `interest-delay-end` (`normal` = 0.15 s).
- A second invoker for the **same** target takes interest over (the old one loses it first). For
  different targets nothing is shared.
- A long-press, the context-menu item and `::interest-button` show interest at once (no delay).

Probe `skip-delay.mjs` (two adjacent `<button interestfor>` + `popover="hint"`,
`interest-delay-start: 400ms`):

| Variant | Straight from A to B | 300 ms after A closed | 800 ms after A closed |
| --- | --- | --- | --- |
| inline delays only (today's `experimental_interestFor`) | B after 402 ms; A closes at 153 ms (its end delay) | 403 ms | 403 ms |
| explainer pattern `:root:has(:interest-source) [interestfor] { interest-delay-start: 0s }` | **B after 3 ms**; A closes at once (`hint` stacking) | 403 ms | 403 ms |
| recommended shape: `:root:has([role="tooltip"]:popover-open) .t { --fsui-tooltip-warm: 1 }` (non-inherited registered property), inline `interest-delay-start: calc(400ms * (1 - var(--fsui-tooltip-warm)))` | **2 ms** | 402 ms | 402 ms |
| with cooldown: inherited property on `:root`, `transition: --warm 0s step-end 500ms` when cold, `none` when warm | **3 ms** | **2 ms** | 402 ms |

So skipping on the native path is **pure CSS**. The Open UI explainer proposes exactly this as the
intended pattern ("Pseudo Classes", the second use case of `:interest-source`, CSSWG
#12154). `:interest-source` / `:interest-target` are ungated in M156 `css_selector.cc`.
Chromium reads the delay from the computed style when the hover starts, so the rule only has to
match by then.

The skip window of the plain `:has()` patterns is "while the previous tooltip is still showing",
which includes its close delay (150 ms by default). Moving between adjacent toolbar buttons takes
less than that. A longer window, independent of the close delay, needs the cooldown variant, whose
`transition` on `:root` overrides any `transition` the app sets on `<html>`. It also restyles the
whole document on each change of the inherited property. Keep it as an option, not the default.

### 1.2 Prior art

| | Group scope | Delay | Skip window | Notes |
| --- | --- | --- | --- | --- |
| Radix Tooltip 1.4.1 | `TooltipProvider`, **required** (`Tooltip` throws without it) | 700 ms | `skipDelayDuration` 300 ms after a close | Per-provider ref + timer |
| Base UI 1.9.0 | optional `Tooltip.Provider` (no grouping without it) | 600 ms | `timeout` 400 ms after a close | Popup gets `data-instant="delay"` so animations can be skipped |
| React Aria / react-stately 3.51.0 | **module-level globals** (`globalWarmedUp`, warm-up and cool-down timers), no provider | 1500 ms | `max(500 ms, closeDelay)` after hide starts | Showing one tooltip closes all others at once; `shouldSkipAnimation` while warm |
| GTK 3 / 4 (`gtktooltip.c`) | per display ("browse mode") | 500 ms (`HOVER_TIMEOUT`) | browse mode ends 500 ms after the tooltip goes (`BROWSE_DISABLE_TIMEOUT`) | In browse mode the next tooltip shows after 60 ms (`BROWSE_TIMEOUT`) |
| Windows common controls (`TTM_SETDELAYTIME`) | per tooltip control | initial = double-click time (500 ms) | `TTDT_RESHOW`: next tooltip after 100 ms (one fifth) "as the pointer moves from one tool to another" | |
| macOS AppKit | | | | Behaviour (subsequent tooltips appear immediately) is widely observed but not documented by Apple; not verified here |

Every surveyed toolkit has a warm state. None of them needs a provider for correctness: the
providers in Radix and Base UI only exist to hold the shared timer.

### 1.3 Design constraints

- **No provider.** Tooltip is used from Server Components with nothing else around it
  (design/components/tooltip.md 2.4). A required provider would add a wrapper to every app, could
  not span separate React roots, and buys nothing that a global check cannot do. A Server
  Component can render a client provider, so RSC is not the obstacle. The obstacle is that a
  provider is ceremony for a page-global behaviour. Make it global per document.
- **Same UX on both paths** (tooltip.md 6: "the flags must not change UX"). The JS path checks
  the same condition the CSS checks: `doc.querySelector('[role="tooltip"]:popover-open')` at
  hover / focus start. This is stateless, needs no module state, and so also works across React
  roots and duplicate library copies. If it matches, open now and hide the other tooltip at once
  (`hint` stacking does that natively; the JS path and Safari's `manual` fallback must do it
  themselves, as React Aria does).
- **Native path needs a stylesheet.** The trigger's delay is an inline style, which a stylesheet
  rule cannot override (short of `!important`), and the "another tooltip is open" condition
  needs a selector. So: the inline value becomes
  `interest-delay-start: calc(<delay>ms * (1 - var(--fsui-tooltip-warm)))`, and Tooltip ships
  (through `<style href precedence>`, conventions 12):

  ```css
  @property --fsui-tooltip-warm { syntax: "<number>"; inherits: false; initial-value: 0; }
  :root:has([role="tooltip"]:popover-open) [data-fsui-tooltip-trigger] { --fsui-tooltip-warm: 1; }
  ```

  The registered, non-inherited property invalidates only the triggers, not the document. With
  the property unregistered or the sheet missing (CSP, below), `var()` falls back to the initial
  value 0 and the delay is the normal one. That is a graceful degradation.
  `[role="tooltip"]` deliberately counts any popover tooltip on the page, FUNSTACK's or not.
  The rule is rendered only by a Trigger with `experimental_interestFor`, so baseline markup is
  unchanged. It works **before hydration**, as the rest of the native path does.
- **Keyboard.** `:interest-source` and the JS focus path treat focus like hover, and skipping
  on focus matches native. Arrowing along a Toolbar then shows each tooltip at once, which is
  the point.

### 1.4 Accessibility

- WCAG 1.4.13 (Content on Hover or Focus) asks for dismissible (Escape), hoverable and persistent
  content. Skip-delay changes none of them; the existing Escape / hover-bridge behaviour holds.
- Delays prevent accidental display. Skipping only happens after the user has already shown
  interest in a neighbouring control, which every desktop platform also does.
- The explainer allows UAs to lengthen delays for users who need it ("multiply all delays");
  `calc(delay * 0)` stays 0 in that case. This is only an issue if a UA ever ships such a
  setting and it should also lengthen warm opens. Nothing ships today.
- Screen readers do not announce the tooltip on show (it is reached through
  `aria-describedby` / `aria-labelledby`), so instant opens add no speech.

### 1.5 Open questions

1. Skip window: "while another tooltip is showing" (recommended, matches the explainer and costs
   nothing), or a Radix-like 300 ms cooldown (needs the `:root` transition trick, with its
   `<html>` transition conflict and document-wide restyle)?
2. Expose the warm state for animation skipping (Base UI `data-instant`, React Aria
   `shouldSkipAnimation`)? CSS can already do it: `:root:has([role="tooltip"]:popover-open)` in
   the consumer's sheet. Probably document only.
3. An opt-out (a Root that always waits)? Not requested; omit.

## 2. Context menu follow-ups (#88)

### 2.1 Press-drag-release

**Native behaviour**

| Platform | When the menu opens | Release on an item | Release outside | Source |
| --- | --- | --- | --- | --- |
| Windows | **on button up** (`WM_CONTEXTMENU` follows `WM_RBUTTONUP`; Gecko pref comment: "context menus always use mouseup" on Windows) | n/a: the button is already up, no gesture | n/a | Gecko `StaticPrefList.yaml` `ui.context_menus.after_mouseup` |
| GTK 3 (Linux) | on button press | activates if more than **500 ms** since the popup (`MENU_SHELL_TIMEOUT`); a faster release keeps the menu open, wherever it is | closes if more than 500 ms, otherwise stays | `gtkmenushell.c` |
| Chromium views (Chrome's own menus on Windows / Linux / ChromeOS) | platform | activates, **unless** within 200 ms of showing (`menu_selection_hold_time`) **and** within 4 DIP of the press (`kMaximumLengthMovedToActivate`) | no close on release | `menu_controller.cc` |
| macOS | on button press | activates once the pointer has moved; a stationary press-release keeps the menu open. AppKit documents no threshold; developers report about 2 px of movement is enough | closes after a drag; stays after a stationary click | not documented by Apple |
| Base UI 1.9.0 | | item `mouseup` with `button === 2` activates if more than 1 px from the open point, **macOS only** (on other platforms it ignores the right-button `mouseup`) | `mouseup` outside the popup at least 500 ms after the open closes | `ContextMenuTrigger`, `useMenuItemCommonProps` |
| Radix 2.4.1, React Aria 3.53.1 | | no press-drag-release | | |
| iOS (`UIContextMenuInteraction`) | after the long-press | slide the finger onto an action and lift it to perform it | | Apple platform behaviour; not verified on a device here |
| Android | | `PopupMenu.getDragToOpenListener()` gives drag-to-open for anchored popup menus | | Android API reference |

**What the page sees with the popup holding capture** (probe `drag-release.mjs`, right button
held, open in `contextmenu` with `popup.setPointerCapture()` as `Menu.ContextTrigger` does today):

| Event | Chromium 156 | Firefox 157 |
| --- | --- | --- |
| `pointermove` while dragging over items | target **popup**; `elementFromPoint` returns the item | same |
| `pointerover` / `:hover` on items during the drag | **none** (`:hover` stays false) | same |
| `pointerup` / `mouseup` / `auxclick` | target **popup**, `button` 2; no `click` (right button) | same |
| after release | `lostpointercapture`, then boundary events reach the item | same |
| popup open after release over an item | yes | yes |
| without capture, release over the menu | open (click-based light dismiss) | **open** (the `pointerup` is over the popover, so spec light dismiss keeps it) |

So **yes, `elementFromPoint` is needed** during capture. The item's own `onPointerMove`
(focus-on-hover in `use-menu-item.ts`) never runs during the drag. Without capture a release over
the menu would be fine in every engine, but a release outside would dismiss in Firefox / WebKit,
even for a quick press with jitter on a flipped menu. That is why capture is kept for the whole
gesture.

**Recommended v1 behaviour (mouse and pen).** It only runs when the open was a pointer
`contextmenu` with a button down, that is Linux and macOS. On Windows the capture is never taken,
and the code path never runs.

1. Record the open point and `event.timeStamp`. While the capture lasts, listen on the popup:
   - `pointermove`: `elementFromPoint` → the closest enabled item of this popup tree. Focus it
     through the same routine the item's own `pointermove` uses. A submenu trigger opens its
     submenu through the existing hover-intent path.
   - `pointerup` (any button):
     - **On an enabled, non-submenu item, with the pointer more than 4 px from the open
       point**: activate it with `item.click()`. Activation is always the element's click
       (Menu 5.3), so `activate`, `closeOnClick` and checkbox / radio toggling are unchanged.
     - Outside every popup of the tree, at least **500 ms** after the open: close with
       `"dismiss"`.
     - Anything else (stationary or quick release, separators, disabled items, submenu
       triggers): stay open, as GTK and macOS do.
   - `lostpointercapture` / `pointercancel`: stop.
2. **macOS Ctrl+click** opens with the *primary* button held (`buttons === 1`). Its release may
   also produce a `click`. Under capture, Chromium and Firefox target the popup, not the item.
   Arm the existing one-shot click swallow after a library activation so that an engine that
   hit-tests the click cannot activate twice.
3. The 4 px rule matches Chromium's constant and macOS's "moved" behaviour. The 500 ms rule
   matches GTK and Base UI. Time alone never activates: the point placement puts the popup's
   corner under the pointer, so a long stationary hold over the first item must not fire it.

**Touch long-press then drag** (probe `touch-drag.mjs`, Chromium touch emulation, scrollable
page, default `touch-action`):

| | Result |
| --- | --- |
| long-press opens (library timer + capture), then drag | `pointermove` to the popup twice, then **`pointercancel`**: the browser took the gesture as a pan |
| same, plus a non-passive document `touchmove` listener calling `preventDefault()` while the menu is open | full stream: `pointermove` over items (via `elementFromPoint`), `pointerup` on the popup over the item |

So touch drag-release works with the same code, plus a `{ passive: false }` `touchmove` listener on
the document. Only add it from the long-press open until that touch ends: it blocks panning while
it is attached. The region itself stays scrollable before the open. For touch, use the long-press
slop (10 px) instead of 4 px. A lift without dragging must **never** close the menu: that is the
normal long-press-then-lift flow, and the lift lands outside the offset menu.

On Android, where the platform `contextmenu` arrives first, take the capture for the touch
pointer whose long-press the trigger is timing, even when that event's `buttons` is 0. Real iOS
and Android were not available. Verify on devices before calling touch done. iOS is the
platform where users most expect slide-to-select.

### 2.2 Touch offset

| | Placement for a touch open | Source |
| --- | --- | --- |
| Chromium views (Windows / ChromeOS touch) | centred **above** the touch point, 15 DIP gap (`kTouchYPadding`), below if no room | `menu_controller.cc` (`MenuAnchorPosition::kBottomCenter`) |
| Gecko native context menus | 2 px offset on Windows, GTK and Android; macOS 1 px right, 6 px up (so the pointer sits inside the menu) | `nsLookAndFeel` `ContextMenuOffsetHorizontal/Vertical` |
| iOS | menu beside the lifted preview of the element, above or below it, not at the finger | platform |
| Base UI 1.9.0 | 10 × 10 anchor at the touch point, `side` bottom, `align` start, `sideOffset` −5, `alignOffset` 2: the menu starts about 5 px below and 2 px right of the touch | `ContextMenuTrigger`, `MenuPositioner` |
| Radix 2.4.1 | zero-size anchor, `side` right, `sideOffset` 2, `align` start; no touch special case | `ContextMenuContent` |

Base UI's "offset" is only 5 px, and the hand still covers a bottom-right menu. Chromium's own
touch menus and iOS put the menu where the finger is not.

**Recommendation.** For `pointerType` touch (and pen), the primary position is **above** the
point: `bottom: calc(100% - var(--y) + 16px)`, start-aligned at x. Fallbacks: the same flipped
inline, then below the point with the same gap. Fold the gap into the shipped `@position-try`
rules through a custom property (`--fsui-menu-point-gap`, 0 for mouse and keyboard) and respell
the fallback list per pointer type. The re-open respelling rule
([context-menu.md](./context-menu.md) 2) still applies. Keep the click swallow: with the menu
off the finger it rarely matters, but it is cheap. Centring (Chromium) needs the popup's width,
or self-alignment inside a computed inset box; not worth it for v1. For a symmetric look under
the finger, start alignment is fine.

### 2.3 Close-on-scroll

**Native.** Desktop context menus are modal tracking loops and **block** page scrolling. Win32
and AppKit menus capture input. Chromium views routes wheel events to the menu
(`MenuController::OnMouseWheel`). Gecko consumes wheel events while a menu popup is open
(`nsXULPopupManager::ShouldConsumeOnMouseWheelEvent`) and rolls up on wheel only for autocomplete
popups. On touch platforms a touch outside dismisses the menu (Android) or the dimmed backdrop
absorbs it (iOS).

**Libraries.**

| | Default | Mechanism |
| --- | --- | --- |
| Radix ContextMenu 2.4.1 | blocks (`modal` true) | `react-remove-scroll` (wheel / touchmove prevented, body overflow) |
| Base UI 1.9.0 | blocks for mouse opens (`modal` true for context menus); **not for touch opens** "so users can still swipe outside to dismiss", unless the popup is nearly full-width | `useAnchoredPopupScrollLock` → `overflow: hidden` on `<html>` |
| React Aria 3.53.1 | modal popovers: `usePreventScroll`; non-modal: `useCloseOnScroll` closes on a `scroll` (window, capture) **whose target contains the trigger**, ignoring `<input>` / `<textarea>` targets | |

**What happens today.** The point popup is in the top layer at viewport coordinates, so the
page scrolls under it. Light dismiss never runs on scroll (probe `wheel-over-popup.mjs`: the
menu stays open in both engines). Worse, a wheel over a non-overflowing menu **scrolls the page
in both engines**. `overflow: auto; overscroll-behavior: contain` on the popup stops that in
Chromium 156 only; Firefox 157 still chains (chromestatus lists "Respect overscroll-behavior on
non-scrollable scroll containers" for Chrome 144, with no Gecko or WebKit signal). A non-passive
`wheel` listener on the popup that calls `preventDefault()` stops it in both.

**Recommendation for v1.**

- **Point opens** (ContextTrigger: pointer, long-press, keyboard). While open, add
  `document.addEventListener("scroll", onScroll, { capture: true, passive: true })`. Close with
  `"dismiss"` (conventions: "a close no user caused through this component") when the event
  target is the `Document`, or an element that **contains the region** (React Aria's rule).
  Scrolls of unrelated scrollers (a ticking log elsewhere), of `<input>` / `<textarea>`, and
  inside any popup of the tree are ignored. The point is meaningless once the content under it
  has moved, so closing beats leaving a detached menu.
- **No scroll lock by default.** The popup is a non-modal `popover="auto"`. Native-style
  blocking needs either non-passive document `wheel` / `touchmove` listeners or `overflow:
  hidden` on `<html>` (layout shift without `scrollbar-gutter: stable`). Neither stops a
  scrollbar drag, and both fight an app's own scroll lock. Dialog already documents a CSS lock
  instead of shipping one (design/components/dialog.md 10.2). Do the same here:
  `html:has([role="menu"][data-context]:popover-open) { overflow: hidden; scrollbar-gutter: stable; }`.
  With the recipe in place, close-on-scroll simply never fires.
- **Wheel over the menu**: a non-passive `wheel` listener on the popup element (not the
  document) calls `preventDefault()` unless the popup itself can scroll in the wheel's direction.
  Native menus never scroll the page from inside the menu. The listener is scoped to the popup,
  so it costs nothing elsewhere.
- **Touch**: a swipe outside scrolls the page and closes the menu, which is Base UI's
  intentional touch behaviour and close to Android's.
- **Trigger opens** (Menu button): unchanged. Anchor positioning keeps the popup on its trigger
  while ancestors scroll, as customizable `<select>` pickers do. If a ContextTrigger re-places
  a Trigger-opened menu at a point, the point rules above apply from then on.

### 2.4 CSP nonce for hoisted `<style>`

**What a nonce-based policy blocks** (probe `csp-style.mjs`, header
`style-src 'nonce-abc' 'sha256-…'`; Chromium 156 and Firefox 157 agree):

| Mechanism | Applied? | Relevance |
| --- | --- | --- |
| server-rendered `style="…"` attribute | **no** (needs `'unsafe-inline'` or `style-src-attr`) | every SSR'd inline style, e.g. Tooltip's `interest-delay-*` on the native path |
| CSSOM writes (`el.style.setProperty`) | **yes** | what react-dom's client does for the `style` prop, so client-set inline styles (the menu point) are fine |
| `setAttribute("style", …)` | no | |
| script-inserted `<style>` without nonce | **no** | Menu.Popup's `@position-try` rules today: under strict CSP the menu opens at the point but never flips |
| script-inserted `<style>` with `setAttribute("nonce", …)` | yes | what react-dom's client does for `<style href precedence nonce>` |
| script-inserted `<style>` whose text matches a `'sha256-…'` source | **yes** | the shipped CSS is a constant string, so a hash works with no API |

This corrects design/conventions.md 12 ("governed by the same `style-src` directive as the inline
`style` attributes the library already depends on, so no new requirement"). Client-set inline
styles are exempt; `<style>` elements are not.

**React 19.3.1** (react-dom source):

- **Client** (`acquireResource`, `case "style"`): the hoisted `<style>` is created with all its
  props except `href` / `precedence`, so a `nonce` prop **is forwarded** (as an attribute). An
  existing `style[data-href~=…]` in the document (SSR) is reused.
- **Server** (Fizz): hoisted `<style precedence>` tags are written with the **render option**
  `nonce.style` (object form: `nonce: { script, style }`; a string `nonce` covers scripts only).
  The element's own `nonce` prop is never emitted. If the render option has a style nonce and the
  element's `nonce` differs (or is missing), React logs an error and **drops the rules from the
  SSR output**. If the element has a nonce and the render option does not, React logs an error
  and emits the rules without a nonce.
- Consequence: a library `<style>` that can render during SSR (Tooltip, if 1.3 is adopted)
  **must** carry exactly the app's `nonce.style`. Menu's point rules render only after a client
  interaction, so today only the client path matters there.

**Other libraries.** Base UI: `CSPProvider` (`nonce`, `disableStyleElements`), a context read by
the parts that inject `<style>` / `<script>`. Radix: a `nonce` prop on each part that injects a
style (`Select.Viewport`, `ScrollArea.Viewport`); its scroll lock reads the global
`__webpack_nonce__` (`get-nonce`). Mantine: `MantineProvider getStyleNonce`. Emotion / MUI: the
cache's `nonce`. Vite: `html.cspNonce` emits `<meta property="csp-nonce" nonce=…>` for client
code to read.

**FUNSTACK family.** No convention exists. FUNSTACK Static's SSR entry accepts `nonce?: string`
and passes it to `renderToReadableStream` in the string form (scripts only). Its RSC entry does
not pass one, and its output is static, where per-response nonces do not apply anyway; hashes
do. FUNSTACK Router has nothing.

**Recommendation.**

1. **Now, no API:** publish the SHA-256 (base64) of each shipped stylesheet on the docs page,
   generated from the exported constant at build time so it cannot drift. This serves
   hash-based policies and FUNSTACK Static sites.
2. **With the first SSR-rendered library stylesheet (Tooltip skip-delay), API:** one context
   provider (Base UI's shape, for example `<FunstackUIConfig nonce>`). A Server Component layout
   that knows the per-request nonce renders it with a serialisable prop. Every part that renders
   a hoisted `<style>` passes `nonce={ctx.nonce}`. Document: "use the same value as React's
   `nonce: { style }` render option". A per-part `nonce` prop (Radix's shape) is the
   alternative: no context, but every Menu.Popup and Tooltip.Trigger would need it. The provider
   wins once there are two style-rendering parts.
3. Do not read `<meta property="csp-nonce">` implicitly: it only helps on the client, and the
   server-side equality check needs the value in props anyway.
4. Document the SSR'd `style` attribute limit (custom Tooltip delays are lost under strict CSP;
   Chromium's defaults equal the library defaults, so only non-default delays change).

## Upstream issues to track (do not file; listed for a repo issue)

- React: Fizz drops a hoisted `<style precedence>` whose `nonce` does not match the render
  option's `nonce.style` instead of emitting it with the render nonce. A library cannot know
  the app's nonce without plumbing.
- Firefox: `overscroll-behavior` is not honoured on a non-overflowing scroll container (Chromium
  ships it); a candidate Interop item.
- whatwg/html#10905 / #11536 (from the context-menu research) still decide whether the capture
  is needed at all; press-drag-release needs it regardless, for hit-testing.

## References

- Open UI, interest invokers explainer ("Mouse and Keyboard delays", "Pseudo Classes"): https://open-ui.org/components/interest-invokers.explainer/
- CSSWG #12154 (`:interest-source` / `:interest-target`), #9236 (delay properties): https://github.com/w3c/csswg-drafts/issues/12154, https://github.com/w3c/csswg-drafts/issues/9236
- Chromium `element.cc`: https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/core/dom/element.cc
- Chromium `menu_controller.cc`: https://chromium.googlesource.com/chromium/src/+/main/ui/views/controls/menu/menu_controller.cc
- Gecko `StaticPrefList.yaml` (`ui.context_menus.after_mouseup`), `XULButtonElement.cpp`, `nsXULPopupManager.cpp`, `widget/*/nsLookAndFeel`: https://github.com/mozilla-firefox/firefox
- GTK `gtkmenushell.c` (3.24), `gtktooltip.c`: https://gitlab.gnome.org/GNOME/gtk
- Win32 `TTM_SETDELAYTIME`: https://learn.microsoft.com/en-us/windows/win32/controls/ttm-setdelaytime
- Android `PopupMenu.getDragToOpenListener()`: https://developer.android.com/reference/android/widget/PopupMenu#getDragToOpenListener()
- Apple, Displaying a Contextual Menu: https://developer.apple.com/library/mac/documentation/Cocoa/Conceptual/MenuList/Articles/DisplayContextMenu.html
- Context menu (hold-and-release, Windows opens on release): https://en.wikipedia.org/wiki/Context_menu
- Report of macOS press-drag-release activating after about 2 px of movement: https://slack-chats.kotlinlang.org/t/13230261/macos-has-this-infuriating-feature-that-when-you-open-a-cont
- chromestatus, "Respect overscroll-behavior on non-scrollable scroll containers": https://chromestatus.com/feature/5129635997941760
- WCAG 2.2 SC 1.4.13: https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html
- CSP3 (nonces, hashes, `style-src-attr`): https://www.w3.org/TR/CSP3/
- Base UI CSP Provider: https://base-ui.com/react/utils/csp-provider
- Vite `html.cspNonce`: https://vite.dev/config/shared-options#html-cspnonce
- Library sources: npm `@radix-ui/react-tooltip@1.4.1`, `@radix-ui/react-context-menu@2.4.1`, `@radix-ui/react-menu@2.2.1`, `@base-ui/react@1.9.0`, `react-stately@3.51.0`, `react-aria@3.53.1`, `react-dom@19.3.1`
