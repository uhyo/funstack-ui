# Context menu: platform features

Research date: **2026-10-22**. GitHub issue #45 (wave 10, tracker #86). Support data from MDN
browser-compat-data 8.1.6 (timestamp 2026-10-15), the Chromium `runtime_enabled_features.json5`
of the M155 (8059) and M156 (8078) branches and `main`, Chromium, Gecko and WebKit source
(`main`, read 2026-10-22), the Safari 27 release notes, Bugzilla (Mozilla, WebKit), the HTML,
ARIA and CSS Anchor Positioning specs, and the sources of Radix ContextMenu 2.4.1, Base UI
ContextMenu 1.9.0 and React Aria `useContextMenu` 3.53.1. Behaviour was verified with Playwright
probes on Chromium 156 and Firefox 157 (`memo/platform-researcher/probes/17-context-menu/`).
WebKit still cannot launch locally, so its column comes from WebKit source, BCD and Bugzilla.

| Engine | Stable release | Date |
| --- | --- | --- |
| Blink | Chrome 156 (156.0.8078.48) | 2026-10-20 |
| Gecko | Firefox 158 | 2026-10-13 |
| WebKit | Safari 27.0 | 2026-09-14 |

Builds on [popover-menu.md](./popover-menu.md) (Popover API, nesting, focus return, implicit
anchor, Menu keyboard model) and [popover-anchor-tooltip.md](./popover-anchor-tooltip.md)
(anchor positioning). Those findings are not repeated here.

## Summary

A context menu is the existing **Menu popup opened from a different trigger**. Items, checkbox
and radio items, groups, submenus, typeahead, roving focus, Tab-closes-stack, item activation
and `<ViewTransition>` all carry over unchanged. Three things are new, and all three need
library JavaScript:

1. **Opening.** The `contextmenu` event covers mouse right-click, macOS Ctrl+click, the keyboard
   (ContextMenu key, Shift+F10, macOS Ctrl+Return), VoiceOver's VO+Shift+M and Android
   long-press. It is a `PointerEvent` in every engine. **iOS never fires it**, so touch needs a
   library long-press. No declarative path exists: Invoker Commands fire on activation, and the
   HTML `contextmenu` attribute was removed years ago.
2. **Positioning at a point.** CSS anchor positioning anchors to elements, not points. Two
   placements work in Chromium and Firefox: a zero-size "virtual anchor" element, or no anchor
   with custom `@position-try` rules that mirror the popup around custom-property coordinates.
   Only the second is immune to transformed ancestors, where the engines disagree.
3. **Popover light dismiss fights the right button.** On Linux and macOS, `contextmenu` fires
   between `pointerdown` and `pointerup`. In Firefox and WebKit, which use the spec's
   pointer-based light dismiss, the pending `pointerup` then closes a just-opened menu that is
   not under the pointer (whatwg/html#10905). Chromium switched to click-based light dismiss
   and is not affected. **Pointer capture on the popup** fixes it in both affected engines.

Probes found three more things that shape the design:

- **Right-click outside an open menu does not close it in Chromium.** Chromium's light dismiss
  runs on `click`, and right and middle buttons fire no `click`. Firefox and WebKit close it.
  Gecko (bug 2072740, ASSIGNED) and WebKit (bug 324373) are moving to click-based light dismiss
  too. After that, no engine will close a menu on a right-click outside. For native parity the
  library has to close it.
- **Re-opening at a new point in the same task keeps the previous flip.** CSS Anchor
  Positioning remembers the "last successful position option" until the next rendering update.
  Changing `position-try-fallbacks` clears it synchronously (verified in both engines).
- **Keyboard-opened `contextmenu` cannot be told apart from a mouse one by its fields.**
  Chromium reports `button: -1` and `pointerType: "mouse"`. Gecko reports `button: 0` and
  `mouse`. The Pointer Events spec says `pointerType: ""` and `pointerId: -1`, but no engine
  does that. The coordinates are already at the focused element in every engine, so the
  position needs no special case. Only the focus ring does, and an input-modality heuristic
  is enough for that.

### Verdicts

| Feature | Verdict | Reason |
| --- | --- | --- |
| `contextmenu` event (mouse, Ctrl+click, keyboard, VoiceOver macOS, Android long-press) | **Adopt** | Chrome 1, Firefox 6, Safari 3. A `PointerEvent` since Chrome 92, Firefox 129, Safari 18.2. Safari iOS: never fired. |
| Library long-press for touch pointers (iOS) | **Adopt** (required) | WebKit 213953 (NEW since 2020). React Aria and Base UI default to 500 ms; Radix uses 700 ms. |
| `popover="auto"` for the context menu popup (top layer, Escape, focus return, nesting) | **Adopt** | As Menu. Needs the pointer-capture fix below. |
| `popup.setPointerCapture(event.pointerId)` when `event.buttons !== 0` at `contextmenu` | **Adopt** (required) | Verified: fixes the immediate light dismiss in Firefox 157 and is harmless in Chromium 156. WebKit uses the same algorithm (source). Works on the still-hidden popup, so it can be done in the event handler before the React commit. |
| Anchorless point placement: `left`/`top` from `--x`/`--y` on the popup + library `@position-try` rules | **Adopt** (recommended placement) | Verified in Chromium and Firefox, including under transformed and filtered ancestors (top-layer boxes ignore them). Needs a stylesheet; React 19 `<style href precedence>` can ship it. |
| Virtual anchor (zero-size `position: fixed` element) + `showPopover({ source })` or `anchor-name` + `position-area` + `flip-*` | **Adopt only if no stylesheet may ship** | Verified without transforms. Under a transformed ancestor, Chromium follows the transform and Firefox does not, so no single correction works. |
| Plain `left`/`top` + `position-try-fallbacks: flip-block, flip-inline` (no anchor) | **Do not use** | `flip-*` swaps `top: y` to `bottom: y`, which does not mirror around the point. Verified: no flip happens. |
| Invoker Commands (`commandfor` / `command`) for the context trigger | **Not applicable** | Invokers are buttons and fire on activation; there is no "contextmenu" command. Still used inside the menu (submenus) as in Menu. |
| `interestfor`, `popover="hint"` | **Not applicable** | |
| HTML `contextmenu` attribute / `<menu type=context>` | **Not available** | Removed from HTML (whatwg/html#2742); Firefox, the only implementer, removed it. Open UI explicitly does not plan a declarative context menu. |
| `aria-haspopup` on the trigger region | **Do not use** | Not allowed on `generic`/`region`/`group` roles (deprecated as a global in ARIA 1.2). ARIA has no context-menu attribute (w3c/aria#1971, open). |
| `-webkit-touch-callout: none` on the region | **Adopt** (inline, as Radix and Base UI do) | iOS-only property (BCD). Stops the link/image callout from covering the long-press. |

## Support table per engine

| Feature | Chrome | Firefox | Safari | Notes |
| --- | --- | --- | --- | --- |
| `contextmenu` event | 1 | 6 | 3 | Safari iOS: **no** (BCD; WebKit 213953). iPadOS fires it for a connected mouse/trackpad. Chrome Android 18 and Firefox Android 6 fire it on long-press. |
| `contextmenu` is a `PointerEvent` | 92 | 129 | 18.2 | |
| Keyboard `contextmenu` (ContextMenu key / Shift+F10) | yes (verified) | yes (Gecko source; Playwright cannot trigger it) | macOS Ctrl+Return; iframes fixed in **27** (bug 302049) | WebKit 317496 (NEW): not fired on a target with `border-radius`. Chromium Ctrl+Return on macOS: fixed in Chrome 147 (per React Aria source). |
| VoiceOver VO+Shift+M fires `contextmenu` | not verified | not verified | yes (macOS; iframes from 27) | iOS VoiceOver: no (WebKit 213953). |
| Light dismiss on right/middle click outside | **no** (click-based, flag `LightDismissFromClick` stable) | yes (spec pointerdown/up) | yes (spec pointerdown/up, source) | Gecko 2072740 ASSIGNED and WebKit 324373 NEW move to click-based; spec whatwg/html#11536 and pointerevents#460 are open. |
| Popover shown in `contextmenu` survives the pending `pointerup` | yes | **no** unless pointer over it (verified) | **no** (source) | whatwg/html#10905 open. Fix: pointer capture on the popup. |
| `setPointerCapture` | 55 | 59 | 13 | |
| `showPopover({ source })` with implicit anchor | 133 | 147 | 26 | |
| `position-area`, `position-try-fallbacks`, `@position-try` | 129 / 128 / 125 | 147 | 26 | |
| `-webkit-touch-callout` | – | – | iOS 2 | |

## Findings

### 1. Opening

#### Event sequence (verified, Chromium 156 and Firefox 157 on Linux)

| Input | Sequence | `button` | `pointerType` | Coordinates | Target |
| --- | --- | --- | --- | --- | --- |
| Right-click | `pointerdown`, `mousedown`, **`contextmenu`**, `pointerup`, `mouseup`, `auxclick` | 2 | `"mouse"` | pointer | element under pointer |
| ContextMenu key / Shift+F10 (Chromium) | `keydown`, **`contextmenu`**, `keyup` | **-1** | `"mouse"` | **centre of the focused element** | focused element; with a text selection, the selection's node at its start; with nothing focused, `<html>` at (1, 1) |
| Same (Gecko, from `PresShell::AdjustContextMenuKeyEvent`) | as above | 0 | `"mouse"` (bug 1322876) | focused element's **left edge, top + min(height, one line)**; the caret position in editable content | focused element |
| Same (WebKit, from `EventHandler` and bug 265025; not probed) | as above | not verified | not verified | centre of the focused element (hit-tested there, hence bug 317496) | focused element |

Platform differences not covered by the Linux probes:

- **Windows.** `contextmenu` fires after `mouseup` (native convention), so no pointer is down
  when it arrives. The nuxodin workaround in whatwg/html#10905 relies on `event.buttons` being
  0 there.
- **macOS.** `contextmenu` fires on `mousedown`, like Linux.
  - Ctrl+click is a context click. Gecko creates it with `button: 0`
    (`eControlClick` → `ePrimary` in `MouseEvents.h`), so `button === 2` is not a reliable
    test.
  - Ctrl+Return is the macOS 15 shortcut for "show contextual menu".
- **Firefox.** Shift+right-click forces the native menu and fires **no** DOM event
  (`dom.event.contextmenu.shift_suppresses_event`, default `true`). Users have a built-in
  escape hatch there.

**Keyboard detection.** The fields cannot separate keyboard from mouse across engines (table
above). Two heuristics work everywhere:

- Treat a `contextmenu` that arrives with no `pointerdown` since the last `keydown` as
  keyboard-initiated.
- Or, simpler, rely on `button === -1` in Chromium and accept a pointer-style open elsewhere.

The coordinates already point at the focused element in all three engines, so the position
needs no keyboard branch. Only the open focus does (6.1 of the Menu design: the
`focusVisible` ring after a keyboard open, a quiet focus after a pointer open).

#### Touch and iOS

- **Android (Chrome, Firefox)** fires `contextmenu` on long-press with `pointerType: "touch"`.
  It was not verified here: neither CDP touch events nor `Input.synthesizeTapGesture` produce
  it on desktop headless Chromium.
- **iOS Safari never fires `contextmenu`** for touch, not even under VoiceOver (WebKit 213953,
  NEW, last activity 2026-03). There is no feature detection for that: `oncontextmenu` exists
  on iOS. The library needs its own long-press for touch pointers. Prior art:

| | Radix 2.4.1 | Base UI 1.9.0 | React Aria 3.53.1 |
| --- | --- | --- | --- |
| Long-press runs on | touch and pen pointers, every platform | touch events, every platform | iOS only (UA sniff) |
| Delay | 700 ms | 500 ms | 500 ms |
| Cancelled by | any `pointermove`, `pointercancel`, `pointerup` | move > 10 px, a second touch, `touchend` / `touchcancel` | `usePress` cancel rules |
| Double open with Android's own `contextmenu` | `contextmenu` clears the timer | idempotent open | timer only on iOS |
| Swallows the `click` after a long-press | no | no | yes (one-shot `click` `preventDefault`) |
| Callout | inline `-webkit-touch-callout: none` | same | none |

Pitfalls a library long-press must handle:

- **Text selection and the loupe.** iOS starts a selection on long-press over text. Only
  `user-select: none` (`-webkit-user-select`) prevents it, and it must already apply when the
  touch starts.
  - React Aria's `usePress` disables selection on the document for the duration of a press
    on iOS.
  - A headless library should document a CSS rule (`[data-…]:active` is too late) or set it
    inline like the callout. It is a trade-off: text in the region is then not selectable by
    touch.
- **The callout.** Link and image previews (the iOS 13+ "peek" menu) appear at about the same
  time. `-webkit-touch-callout: none` on the region suppresses them. Radix and Base UI set it
  inline; React Aria does not.
- **Scrolling.** A long-press region must stay scrollable, so do not use `touch-action: none`.
  - The browser fires `pointercancel` when it takes the gesture for panning. Cancel the timer
    on that.
  - Also cancel on movement beyond a slop of about 10 px; Base UI uses 10 px. Radix cancels
    on any move, which loses long-presses to finger jitter.
- **The release lands on the menu.** If the menu opens under the finger, the `touchend` /
  synthetic `click` can activate the item under it.
  - Swallow the next `click` after a long-press opened the menu (React Aria).
  - Base UI also anchors touch opens to a 10 × 10 box so that the menu is offset from the
    finger.
- **Android double open.** Run the timer for touch pointers on every platform, and treat a
  `contextmenu` during the same gesture as the open (cancel the timer). Then whichever comes
  first opens once.
  - Android's long-press timeout is about 400-500 ms; a 500 ms library timer races it
    harmlessly.
  - UA sniffing (React Aria) is not needed.

### 2. Positioning at the pointer

Probe `anchor-point.mjs` (viewport 800 × 600, popup 120 × 80; expected bottom-right of the point,
flipped at the right and bottom edges):

| Strategy | (200,200) | (780,200) | (200,580) | (780,580) | Chromium | Firefox |
| --- | --- | --- | --- | --- | --- | --- |
| **S1** zero-size `position: fixed` span with `anchor-name`, popup `position-anchor` + `position-area: bottom right` + `flip-block, flip-inline, flip-block flip-inline` | 200,200 | 660,200 | 200,500 | 660,500 | ✓ | ✓ |
| **S2** same span as `showPopover({ source: span })` (implicit anchor, no names) | same | same | same | same | ✓ | ✓ |
| **S3** popup `left`/`top` = point + `flip-*` fallbacks, no anchor | 200,200 | 780,200 | 200,580 | 780,580 | ✗ (no flip) | ✗ |
| **S4** popup `left: var(--x); top: var(--y)` + `@position-try --up { top: auto; bottom: calc(100% - var(--y)) }`, `--left`, `--upleft` | 200,200 | 660,200 | 200,500 | 660,500 | ✓ | ✓ |

**Transformed ancestors** (`anchor-transform.mjs`, click at 300,250). The virtual anchor is a
`position: fixed` element, so a `transform`, `filter`, `contain` or `will-change` ancestor
becomes its containing block. Inside a `transform: translate(50px, 30px)` region:

| | Anchor's visual box | Popup in Chromium | Popup in Firefox |
| --- | --- | --- | --- |
| Naive `left/top` = point | 450,380 | 450,380 (follows the transform) | 400,350 (layout box, transform ignored) |
| Corrected so that `getBoundingClientRect()` equals the point | 300,250 | **300,250** | **250,220** |

The engines disagree on whether anchor positioning follows the anchor's transforms, so no
correction is right in both. A `filter` ancestor (no transform) is fixable by measuring, in
both engines. **S4 is unaffected**: the popup is in the top layer, whose containing block is
the viewport whatever its DOM ancestors do (`point-try-transform.mjs`). Context menus inside a
`transform`-centred dialog or a sliding panel are common enough that this matters.

**Stale fallback on re-open** (`reopen-same-task.mjs`, `reopen-gap.mjs`). CSS Anchor
Positioning 6.5.1.1 makes `position-try` prefer the "last successful position option". It is
recorded and cleared only at the ResizeObserver point of a rendering update, so a
`hidePopover()` + `showPopover()` at a new point in the same task reuses the previous flip
whenever it still fits. Example: opened at (780, 580), so flipped up-left; re-opened at
(300, 250), it lands at 180,170 instead of 300,250.

| Between hide and show | Chromium | Firefox |
| --- | --- | --- |
| nothing (same task) | stale | stale (S4 even skips a needed flip) |
| forced style/layout flush | stale | clears |
| one animation frame | clears | clears |
| change `position-try-fallbacks` (third option respelled `flip-inline flip-block`; or for S4 alternate two equivalent rule lists) | **clears, synchronously** | **clears, synchronously** |
| move the anchor while open | keeps the flip (stability, by spec) | same |

Re-opening at a new point while open is a real path: a second right-click inside the region.
The library must either alternate between two equivalent fallback spellings, or re-show after a
frame.

**Keyboard-opened position.** The event coordinates already sit on the focused element:
Chromium and WebKit use its centre, Gecko its left edge just below the first line. So the
point path serves the keyboard too. An element-anchored placement (Menu's
`showPopover({ source: target })` + `position-area`) would be the alternative. It breaks for
a large focused region (a canvas), where "below the element" is off-screen and every flip
overflows.

**Scrolling.** The point is in viewport coordinates and the popup is `position: fixed`, so the
popup stays put while the page scrolls underneath. Native menus block scrolling instead. An
`position: absolute` virtual anchor inside the scroller follows the content; S4
cannot (`anchor-point.mjs` S5: a `position: absolute` anchor in a scroller moved the popup by the scrolled distance). Light dismiss does not run on scroll.

### 3. Popover API interplay

**The immediate light dismiss (whatwg/html#10905).**

- Spec light dismiss records the clicked popover at `pointerdown`, but only if a popover is
  open at that moment. At `pointerup` it compares that record with the popover now under the
  pointer.
- A menu opened by `contextmenu` (after `pointerdown`) is not recorded. If the `pointerup`
  lands outside it, `null === null` holds and everything closes.
- This happens when the menu has been flipped away from the pointer, or the pointer moved
  between down and up.
- Probe `pointerup-dismiss.mjs`: closed in Firefox for a far-away menu, and for a pointer
  move; open in Chromium. WebKit's `Document::handlePopoverLightDismiss` is the same
  algorithm.

| Workaround (`pointerup-workarounds.mjs`) | Chromium | Firefox | Press-drag-release possible |
| --- | --- | --- | --- |
| none | ✓ | ✗ | |
| `popup.setPointerCapture(e.pointerId)` **before** `showPopover()` (popup still hidden) | ✓ | ✓ | yes (hit-test on the captured `pointerup`) |
| same, after `showPopover()` | ✓ | ✓ | yes |
| show in a `pointerup`/`pointercancel` listener | ✓ | ✓ | no (menu appears on release) |
| show in a microtask / `setTimeout(0)` | ✓ | ✗ | |

With capture, a later left click on an item and a left click outside behave normally in both
engines. `setPointerCapture` silently does nothing when no button is down (Windows, keyboard).
The React path matters here: Menu shows the popup in the apply effect after a transition
commit, at an unpredictable time relative to the `pointerup`. So the capture must be taken
**synchronously in the `contextmenu` handler, on the (hidden) popup element**, not in the
apply effect. Once Gecko and WebKit move to click-based light dismiss, the capture becomes a
no-op.

**While open** (`events.mjs`, `events2.mjs`):

| Action | Chromium | Firefox (WebKit by source) |
| --- | --- | --- |
| Left click outside | closes | closes |
| Right / middle click outside the region | **stays open** (no `click` for those buttons) | closes |
| Right-click elsewhere in the region (library re-opens at the new point) | moves | moves |
| Right-click inside the menu | stays open | stays open |
| Another auto popover opens (another context region) | closes (auto stack) | closes |

Native menus close on any click outside, so the library should close the menu on a
`contextmenu` (or non-primary `pointerdown`) outside the popup tree, with `reason: "dismiss"`.
Otherwise Chromium leaves it open under the browser's own menu. A right-click inside the popup
should be `preventDefault()`ed (no native menu over the custom one) and must not bubble to the
region's handler as a re-open. If the popup is rendered inside the region, it does bubble.

**`source`, focus return, AX.**

- `showPopover({ source })` sets nesting: a context menu inside an open Popover or Dialog
  popover must keep it open, so `source` must be an element inside that context. The region
  (or the keyboard target) is the right choice. Focus return does not use `source`.
- The platform returns focus to the element focused when the popover was shown (verified,
  `focus.mjs`, Chromium and Firefox identical, for Escape and for `hidePopover()`):

| Where the user right-clicked | Focus on open | Focus after close |
| --- | --- | --- |
| A non-focusable region (focus was elsewhere before) | first item | **`<body>`**: the right-button `mousedown` already moved focus to `<body>` |
| A focusable region (`tabindex="0"`) | first item | the region |
| A button inside the region | first item | that button |
| Keyboard (Shift+F10) on that button | first item | that button |

  The `<body>` case is the native behaviour too: the right mousedown blurs. Regions that
  matter for keyboard users contain focusable items anyway (section 4).

**Invoker Commands do not apply** to the trigger: no button, no activation. Nothing opens before
hydration (section 6).

### 4. Accessibility

- **No pattern.** The APG has no context-menu pattern. ARIA's `menu` role definition names
  "a context menu for its invoking element" as a use, and the Menu pattern's keyboard model
  applies once open.
- **Trigger semantics.** There is no ARIA to declare that a region has a custom context menu.
  - `aria-haspopup` is only allowed on `application`, `button`, `combobox`, `gridcell`, `link`,
    `menuitem`, `slider`, `tab`, `textbox`, `treeitem` (and inheriting roles). It was
    deprecated as a global in ARIA 1.2, and the ARIA spec advises it only where there is a
    visible indicator.
  - w3c/aria#1971 ("an attribute to declare the presence of a context menu") has been open
    since 2023; the concern is noise, since everything has a context menu.
  - Radix and Base UI render no ARIA on the trigger. React Aria's hook adds none (its example
    adds `tabIndex={0}`).
  - Recommendation: **no ARIA on the region**, no `aria-expanded` (not allowed on `generic`),
    `data-open` for styling.
- **Opening with AT.**
  - Windows screen readers (NVDA, JAWS) pass the Applications key / Shift+F10 through to the
    browser. The browser fires `contextmenu` at the **DOM-focused** element, so
    context-menu targets must be focusable (rows, cells, items) for keyboard and screen-reader
    users. NVDA's browse-mode focus sync was not tested.
  - VoiceOver on macOS: VO+Shift+M fires `contextmenu` in WebKit (iframes fixed in Safari 27,
    bug 302049), at the VoiceOver cursor.
  - iOS VoiceOver: impossible (WebKit 213953).
  - TalkBack (double-tap-and-hold is a long-press): not verified.
- **Focus.** Once open it is a Menu:
  - Focus moves to the first item (quiet after a pointer open, visible after a keyboard
    open, as Menu 6.1).
  - Escape returns focus to where it was (table above).
  - Tab closes the stack.
  - A popup is announced as `menu`. A context menu has no visible label; native context menus
    have no name. An `aria-label` pass-through is enough, and `aria-labelledby` should not
    point at the region, whose text may be long.
- **Discoverability.** Nothing in the platform or ARIA announces a context menu.
  - Touch users and iOS VoiceOver users may have no way to open it at all.
  - The docs must say that **every context-menu action must also be reachable another way**:
    a visible "More actions" Menu button on the row, a toolbar, or keyboard shortcuts. This
    is also what w3c/aria#1971's commenters recommend.
  - An authored hint (`aria-describedby` → "Press Shift+F10 for more options") is the
    consumer's choice, not a library default.

### 5. Submenus, checkbox and radio items

Reusable as is:

- Submenus open with `showPopover({ source: submenuTrigger })` from inside the root popup, so
  they nest in it regardless of how the root was opened. Their placement (`position-area`
  against the SubmenuTrigger, `flip-inline`) and the WebKit 302008 result carry over.
- Checkbox and radio items are popup-internal. The optimistic-state machinery has no
  dependency on the Trigger.

The only Menu parts that reference the Trigger are:

- the Popup's `aria-labelledby` (replace with an optional label);
- the open keys on the Trigger (Enter / Space / ArrowDown / ArrowUp; none for a region);
- focus return through the platform (unchanged);
- Shift+Tab to the Trigger (it lands wherever focus was).

### 6. Server Components and pre-hydration

- **Before hydration nothing opens.** The user gets the browser's native context menu, which
  is the right fallback: nothing is broken or half-open, copy and paste still work, and the
  menu works once the region hydrates.
  - There is no declarative trigger to put in the server HTML. The `contextmenu` attribute is
    gone, invokers do not react to right-clicks, and Open UI does not plan one.
  - A pre-hydration right-click is not replayed after hydration; its default (the native menu)
    has already happened. Not probed in React.
- **Client and Server Components.**
  - The region and Root must be client components; they need the event listener and the
    coordinates.
  - Item content, and the items themselves where Menu allows it, can come from a Server
    Component as `children`, exactly as in Menu.
  - Item actions may be Server Functions.

### 7. Nested regions

`contextmenu` bubbles from the innermost region, so "inner wins" falls out of a simple rule:

- **A region opens only if the event is not `defaultPrevented` when it reaches it.** Opening
  calls `preventDefault()`, so outer regions skip.
- That rule also respects a consumer's own handler deeper in the tree (a canvas that handles
  right-clicks itself). Base UI and React Aria call `stopPropagation()` instead. That also
  hides the event from the consumer's document-level listeners. Radix does neither, so nested
  Radix triggers both open.
- **`disabled`** (Radix, Base UI): the region does nothing, and the event bubbles to an outer
  region, which may open. Keep that meaning.
- **"Native menu here"** (block outer regions without preventing the default) needs a
  separate mechanism: a consumer `onContextMenu={(e) => e.stopPropagation()}`, or a
  library-private mark on the event that outer regions honour.
- **Editable targets.** A built-in default worth considering: let the native menu through for
  `input`, `textarea` and `contenteditable` targets. Users expect copy and paste there. No
  surveyed library does this.

## Prior art

| | Radix ContextMenu 2.4.1 | Base UI ContextMenu 1.9.0 | React Aria 3.53.1 |
| --- | --- | --- | --- |
| Trigger element | `span`, no ARIA, `data-state` | `div`, no ARIA, `data-popup-open` / `data-pressed` | hook on any element (`tabIndex` up to the consumer) |
| Position | virtual rect at `clientX/Y`, Floating UI, `side="right" align="start"` | virtual rect (10 × 10 for touch), Floating UI | `x`/`y` relative to the target; keyboard Ctrl+Enter fallback uses the centre |
| Pointer down at open (Linux/macOS) | DismissableLayer, not popover | **press-drag-release**: release after 500 ms outside the popup closes, inside activates | n/a |
| Nested | both open | inner wins (`stopPropagation`) | inner wins (`stopPropagation`) |
| Keyboard extras | none | none | Ctrl+Enter on macOS when the engine does not fire `contextmenu` (Chrome < 147, Safari < 27 in iframes) |

## Cross-engine gaps tests must branch on

| Gap | Engines | Test strategy |
| --- | --- | --- |
| Immediate light dismiss after a right-button open | Firefox, WebKit | Browser test in all three engines: right-click (Playwright fires the real `contextmenu` in Chromium and Firefox) where the popup flips away from the pointer, then assert it is still open after `pointerup`. The first WebKit CI run verifies the WebKit claim. |
| Right-click outside while open | Chromium does not light-dismiss | Assert the library's own close in every engine. |
| Keyboard `contextmenu` | Playwright cannot trigger it in Firefox | Chromium: `keyboard.press("Shift+F10")`. Elsewhere dispatch a synthetic `contextmenu` on the focused element, or branch on `server.browser`. |
| Same-task re-open position | both | Assert the re-opened popup is bottom-right of the new point after a previous flip. |
| Transformed ancestor | Chromium vs Firefox differ for anchors | If S4 is chosen, assert the position inside a `transform`ed container. |
| Long-press | only real iOS lacks `contextmenu` | jsdom/browser test with `pointerType: "touch"` pointer events; no engine in CI reproduces iOS. |

## Recommendations

For the architect. Items marked **API** change the component's shape.

1. **Anatomy (API).** A context menu is a Menu with a different trigger.
   - Reuse `Menu.Popup`, items, groups, checkbox/radio items and submenus unchanged.
   - Add a root/trigger pair for the region: for example `ContextMenu.Root` +
     `ContextMenu.Trigger`, or `Menu.Root` + `Menu.ContextTrigger`. Its trigger renders a
     plain element (default `div`) with no role, no `aria-haspopup`, no `aria-expanded`, and
     `data-open` / `data-pending` / `data-disabled`.
   - Render the Popup **outside** the trigger element (sibling, as in Menu), so right-clicks
     inside the menu do not bubble into the region. If it ends up inside, the region handler
     ignores events from inside the popup.
2. **Mode (API).** Library mode only, as Menu. There is nothing declarative to fall back to, and
   before hydration the native menu shows. `open` / `defaultOpen` / `openChangeAction` as Menu.
   A controlled `open={true}` without a recorded point needs a defined position (the trigger's
   top-left, or a dev warning as Radix does).
3. **Opening.**
   - One `contextmenu` listener on the region:
     - skip if `event.defaultPrevented` or `disabled`;
     - otherwise `preventDefault()`;
     - record the point (`clientX/Y`) and the modality (keyboard if no `pointerdown` since
       the last `keydown`);
     - if `event.buttons !== 0`, call `popup.setPointerCapture(event.pointerId)` **now**;
     - then dispatch the library-owned open (transition, `openChangeAction(true)`, apply
       effect `showPopover({ source: region })`).
   - Touch long-press on every platform:
     - start on `pointerdown` with `pointerType: "touch"` (500 ms);
     - cancel on `pointercancel`, `pointerup`, or movement > 10 px;
     - if a `contextmenu` arrives during the gesture, open from it and cancel the timer;
     - after a long-press open, swallow the next `click`;
     - offset the point so the menu does not open under the finger.
   - Inline `-webkit-touch-callout: none` on the region. Document `user-select: none` for
     regions with text.
4. **Placement (API: no `side`/`align` on a context Popup).**
   - Use **S4**: the popup gets `--x`/`--y` (and `inset: auto; margin: 0; left: var(--x);
     top: var(--y)`) plus `position-try-fallbacks` naming three library `@position-try`
     rules.
   - Ship those rules with React 19's `<style href="…" precedence="…">`, which deduplicates
     and works in SSR/RSC.
   - If shipping a stylesheet is rejected, fall back to S2 (a zero-size fixed span as
     `source`) and document that a transformed ancestor misplaces the menu (in different
     directions per engine).
   - In both cases, re-opening at a new point while open must clear the remembered fallback
     (alternate two equivalent `position-try-fallbacks` spellings).
   - The keyboard uses the same point path (engines already place it at the focused element).
5. **Closing.**
   - Everything in Menu 2.2 applies (item activation through the root, Escape, Tab, light
     dismiss).
   - Add: a document `contextmenu` (capture, while open) outside the popup tree and outside
     this region closes with `reason: "dismiss"`. This makes Chromium match native behaviour,
     and every engine once click-based light dismiss lands everywhere.
   - A `contextmenu` inside this region re-opens at the new point.
   - Inside the popup: `preventDefault()`, nothing else.
6. **Focus.** As Menu 6.1 and 6.3:
   - first item focused on open, quiet after a pointer open, visible after a keyboard open;
   - platform focus return (`<body>` when the click target was not focusable; that is
     native);
   - no `returnFocus` prop.
7. **Nested regions.** Inner wins through `defaultPrevented`. `disabled` passes the event to
   outer regions. Decide whether editable targets get the native menu by default (open
   question 2).
8. **A11y documentation (required).**
   - Context menus are a shortcut, never the only path to an action: iOS (with or without
     VoiceOver) cannot open them.
   - Targets must be focusable for keyboard and screen-reader users.
   - Label the popup with `aria-label` if needed.
9. **Experimental flags.** None needed. Everything adopted is Baseline in the three latest
   stable engines, except iOS `contextmenu`, which is replaced by the long-press.

### Open questions for the architect

1. **Ship a stylesheet for S4?** It would be the library's first. React's `<style precedence>`
   makes it a component-owned resource, and it carries no visual styling. The alternative (S2)
   is simpler but wrong under transformed ancestors.
2. **Editable targets.** Should the region let the native menu through for `input` /
   `textarea` / `contenteditable` targets by default (copy and paste)? No surveyed library does
   this.
3. **Press-drag-release** (macOS / Linux: hold the right button, release on an item). Pointer
   capture keeps it possible: hit-test the captured `pointerup` with `elementFromPoint`, as
   Base UI's 500 ms rule does. v1 or later?
4. **Shared items.** Rows often want the same items behind a "More" Menu button and a context
   menu. Is that a documentation pattern (render the same item list twice), or one Root with
   two triggers?

## Upstream issues to track (do not file; listed for a repo issue)

- whatwg/html#10905 (popover shown in `contextmenu` is light-dismissed), whatwg/html#11536
  (light dismiss on `click`), w3c/pointerevents#460 and #542.
- Mozilla 2072740 (click-based light dismiss, ASSIGNED), 1322876 (keyboard `contextmenu` reports
  mouse input source), 314314 (keyboard coordinates).
- WebKit 213953 (no `contextmenu` on iOS), 324373 (click-based light dismiss), 317496
  (keyboard `contextmenu` not fired on a `border-radius` target), 260722 (iPadOS native menu over
  custom one with a trackpad).
- w3c/aria#1971 (no way to declare a context menu).
- A spec question, not yet raised anywhere found: the "last successful position option" survives
  a same-task hide + show of a popover, so re-opened popovers keep a stale flip.

## References

- HTML Standard, popover light dismiss: https://html.spec.whatwg.org/multipage/popover.html#light-dismiss-open-popovers
- whatwg/html#10905: https://github.com/whatwg/html/issues/10905
- whatwg/html#11536: https://github.com/whatwg/html/pull/11536
- w3c/pointerevents#542, #460: https://github.com/w3c/pointerevents/issues/542, https://github.com/w3c/pointerevents/pull/460
- CSS Anchor Positioning, 6.5.1 (last successful position option): https://drafts.csswg.org/css-anchor-position-1/#fallback-choices
- WAI-ARIA, `aria-haspopup` and `menu`: https://w3c.github.io/aria/#aria-haspopup, https://w3c.github.io/aria/#menu
- w3c/aria#1971: https://github.com/w3c/aria/issues/1971
- WAI-ARIA APG, Menu and Menubar: https://www.w3.org/WAI/ARIA/apg/patterns/menubar/
- Open UI, menu elements explainer ("How can we use menu elements to support custom right click Context Menus?"): https://open-ui.org/components/menu.explainer/
- MDN browser-compat-data 8.1.6: https://github.com/mdn/browser-compat-data
- Chromium `runtime_enabled_features.json5` (`LightDismissFromClick`, M155 8059 / M156 8078): https://chromium.googlesource.com/chromium/src/+/refs/branch-heads/8078/third_party/blink/renderer/platform/runtime_enabled_features.json5
- Chromium `HTMLElement::HandlePopoverLightDismissForClick`, `MouseEventManager`: https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/core/html/html_element.cc
- Gecko `PresShell::EventHandler::AdjustContextMenuKeyEvent`, `EventStateManager::LightDismissOpenPopovers`, `WidgetMouseEvent` (`eControlClick`), pref `dom.event.contextmenu.shift_suppresses_event`: https://github.com/mozilla-firefox/firefox
- WebKit `Document::handlePopoverLightDismiss`: https://github.com/WebKit/WebKit/blob/main/Source/WebCore/dom/Document.cpp
- Safari 27 release notes (`contextmenu` in iframes for keyboard / VO+Shift+M, 164128676): https://developer.apple.com/documentation/safari-release-notes/safari-27-release-notes
- WebKit bugs 213953, 302049, 317496, 265025, 260722, 324373: https://bugs.webkit.org/
- Mozilla bugs 2072740, 1322876, 314314: https://bugzilla.mozilla.org/
- NVDA 2026.2 User Guide (Applications key / Shift+F10): https://download.nvaccess.org/documentation/userGuide.html
- Radix ContextMenu 2.4.1: https://unpkg.com/@radix-ui/react-context-menu@2.4.1/dist/index.mjs
- Base UI ContextMenu 1.9.0: https://unpkg.com/@base-ui/react@1.9.0/context-menu/trigger/ContextMenuTrigger.js
- React Aria `useContextMenu` / `useLongPress` 3.53.1: https://react-aria.adobe.com/useContextMenu
- Probes and outputs: `memo/platform-researcher/probes/17-context-menu/`
