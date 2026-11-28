# Context menu (`Menu.ContextTrigger`)

Status: **accepted**, implemented. History (decisions, review corrections, accepted
deviations, the wave 11 follow-ups, implementation notes, the test plan):
`design/CHANGELOG.md`, parts "context-menu.md". Follows
`design/conventions.md` (accepted); where this document and the conventions disagree, the
conventions win. **Read `design/components/menu.md` first** (accepted, implemented): a context
menu is the Menu popup opened from a different trigger. Items, checkbox and radio items, groups,
submenus, typeahead, roving focus, Tab-closes-stack, item activation through the root Root and
`<ViewTransition>` are Menu's and are not repeated here. This document adds the trigger region,
placement at a point, the right-button interplay with popover light dismiss, touch, and the
accessibility stance.

Inputs: `docs/vision.md`, `design/conventions.md`, `docs/research/context-menu.md` (primary; its
verdicts are binding), `design/components/menu.md`, `design/components/popover.md` (the hooks,
the apply effect, nesting through `source`, focus return), the product-owner decisions on the
research's open questions (recorded in "Decisions at a glance"), prior art (Radix ContextMenu
2.4.1, Base UI ContextMenu 1.9.0, React Aria `useContextMenu` 3.53.1), and working notes in
`memo/architect/context-menu-notes.md`.

The platform gives the `contextmenu` event (mouse, Ctrl+click, the ContextMenu key, Shift+F10,
VoiceOver, Android long-press), the top layer, Escape, nesting through `showPopover({ source })`
and focus return. It gives nothing for iOS touch (no `contextmenu`, WebKit 213953), nothing for
placing a popover at a point (anchor positioning anchors to elements), and in Firefox and
WebKit it closes a menu opened between `pointerdown` and `pointerup` (whatwg/html#10905). The
library fills those three gaps and nothing else. The Async React half is unchanged from Menu:
the open is a transition (`data-pending` on the region while the items load), an item's action
runs with `data-pending` on the item and the menu closes in the commit that ends it.

## Decisions at a glance

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Anatomy | **One new part, `Menu.ContextTrigger`**, in the Menu namespace: a plain element (default `div`) with no role and no ARIA, whose `contextmenu` opens the Root's `Menu.Popup` at the pointer. No `ContextMenu` namespace: `Menu.Root` + `Menu.ContextTrigger` + `Menu.Popup` + the existing items. A Root may hold a `Menu.Trigger` **and** a `Menu.ContextTrigger` (a "More" button and a right-click region sharing one popup), which is how shared items fall out (research question 4). |
| 2 | Mode | Library mode only, as Menu. `open` / `defaultOpen` / `openChangeAction` as Menu. Before hydration the browser's native menu shows; nothing is replayed. |
| 3 | Opening | A `contextmenu` on the region that is not `defaultPrevented`, not on an editable target (section 2.3) and not `disabled` → `preventDefault()`, record the point and the modality, **`popup.setPointerCapture(pointerId)` now** if a button is down, then the library-owned open (`openChangeAction(true, { reason: "activate" })`, apply effect `showPopover({ source: region })`, first item focused: quiet after a pointer, ring after the keyboard). A library long-press (500 ms, touch and pen pointers, 10 px slop) opens the same way on every platform; a `contextmenu` during the gesture wins and cancels the timer. |
| 4 | Placement | **At the point, with no anchor (research S4)**: the Popup renders inline `--menu-point-x` / `--menu-point-y`, `inset: auto; left: var(--menu-point-x); top: var(--menu-point-y); position-area: none` and `position-try-fallbacks` naming library `@position-try` rules that mirror the popup around the point (up, left, up-left; since wave 11 also right and up-right, for a right-to-left menu whose **right** edge sits at the point, read from the popup's computed `direction` once per open, #88). The rules are the library's **first shipped CSS**: a React 19 `<style href precedence>` rendered by the Popup on a point open, hoisted, deduplicated, functional only. `side={null}` opts out (no inline placement, no stylesheet; the point is still exposed as the two custom properties). **User decision (2026-10-22): positioning-only shipped CSS is allowed** (conventions 12); the virtual-anchor alternative S2 was rejected (4.5). |
| 5 | Move | A `contextmenu` inside the region **while open** moves the menu: no `openChangeAction`, items keep their state, the first item is focused again. The Popup re-shows itself at the new point with the fallback list respelled, so the remembered flip is cleared (research: a same-task hide + show keeps the stale flip otherwise). |
| 6 | Closing | Everything in Menu 2.2. Added, for **every** menu (context-opened or not): a `contextmenu` or a middle-button `pointerdown` **outside** the menu tree closes the stack at once (`hidePopover()`, `"dismiss"`), as Tab does, since Chromium's click-based light dismiss ignores those buttons and native menus close on any click. A `contextmenu` inside the popup is `preventDefault()`ed and does nothing else. |
| 7 | Editable targets | `input` (text-taking types), `textarea` and `contenteditable` targets keep the browser's menu by default (copy and paste); `editableTargets="menu"` overrides. Product-owner decision. |
| 8 | Nesting | Inner region wins through `defaultPrevented`: a region opens only if the event is not already prevented, and opening prevents it. A `disabled` region does nothing and lets the event bubble to an outer region. A consumer handler deeper in the tree that calls `preventDefault()` keeps the native menu away and the region quiet; one that calls `stopPropagation()` gets the native menu (research 7). |
| 9 | Focus | As Menu 6: first item on open (quiet / ring by modality); focus return is the platform's (the previously focused element; `<body>` when the right-button `mousedown` blurred a non-focusable region, which is native too); with a `Menu.Trigger` in the same Root, Popover 6.2's rule focuses it when a close would leave focus on `<body>`. No `returnFocus` prop. |
| 10 | ARIA | None on the region (`aria-haspopup` is not allowed on `generic`; there is no ARIA for "has a context menu", w3c/aria#1971). `data-open` / `data-pending` / `data-disabled` for styling. The Popup has `aria-labelledby` → the Trigger id only while a `Menu.Trigger` is mounted (conventions 1.1.1); a context-only menu has none and is named by `aria-label` pass-through. |
| 11 | Pending UI | Region: `data-open` (optimistic), `data-pending` (the Root's transition). Popup: `data-context` while the current open came from a ContextTrigger (and no `data-side` / `data-align`). Items as Menu. |
| 12 | Animation | As Menu 9: `transition` on the Popup animates the open commit and library-driven closes (item activation, controlled close). The outside-right-click close, Tab and dismissals are CSS exits; a move is instant (no React open or close). Types unchanged (`fsui-menu-open` / `-close`). |
| 13 | Touch | Long-press on every platform (iOS has no `contextmenu`; Android's own `contextmenu` and the timer race harmlessly). Inline `-webkit-touch-callout: none` on the region. The one `click` that may follow a long-press open is swallowed. `user-select: none` for regions with text is the consumer's CSS (documented trade-off). |
| 14 | Deferred | v1 deferred press-drag-release, a touch offset, close-on-scroll, RTL placement and a `nativeMenu` predicate (#88). Wave 11 landed the first four (rows 16 to 18, 4.6) and **rejects `nativeMenu`**: a predicate is not serialisable (Server Components render the region), `editableTargets` covers the known case, and a consumer handler that `stopPropagation()`s on a chosen target already lets the native menu through (2.4). Nothing deferred now. |
| 16 | Press-drag-release | **Wave 11 (#88).** While the popup holds the pointer capture it took at the open (2.1), it hit-tests `pointermove` with `elementFromPoint` and focuses the item under the pointer, and on `pointerup` **activates** the enabled, non-submenu item under the pointer if the pointer moved more than the slop (4 px mouse / pen, 10 px touch), **dismisses** on a release outside every popup of the tree after moving more than the slop and at least 500 ms after the open, and otherwise leaves the menu open (a stationary or quick release). Mouse and pen on Linux and macOS (Windows opens on release: no gesture); touch after the long-press with a document `touchmove` guard while the finger is down (2.6). |
| 17 | Touch offset | **Wave 11 (#88).** A touch or pen open places the menu **above** the point with a 16 px gap (`--menu-point-gap`, `0px` for mouse and keyboard), start-aligned, flipping across and below as needed through three more shipped options (4.7). |
| 18 | Close-on-scroll | **Wave 11 (#88).** A point-placed menu closes with `"dismiss"` on a `scroll` of the document or of an ancestor of the region (capture, passive); scrolls elsewhere and inside the popup tree are ignored; a Trigger-opened menu is unchanged (it follows its anchor). No scroll lock (a CSS recipe is documented). Every menu's root popup gets a non-passive `wheel` guard so a wheel over the menu never scrolls the page (4.8). |
| 19 | CSP | **Wave 11 (#88).** The hoisted `<style>` carries the `nonce` from `<CSPProvider>` (`@funstack/ui/csp`), and the rules' SHA-256 is exported as `STYLE_SHA256` for hash-based policies (conventions 12, corrected: a client-inserted `<style>` is not covered by the directive that allows inline `style` attributes). |
| 15 | Docs | Every context-menu action must be reachable another way (a visible Menu button, a toolbar, shortcuts): iOS with or without VoiceOver may never open it. Targets that matter to keyboard users must be focusable (`contextmenu` fires at the DOM-focused element). Required content of the docs page (section 12). |

---

## 1. Anatomy

```tsx
import { Menu } from "@funstack/ui/menu";

<Menu.Root>                                                    {/* no DOM; as Menu */}
  <Menu.ContextTrigger render={<tr />}>                        {/* the region: any element, no ARIA */}
    <td>{file.name}</td>
    <td>
      <Menu.Trigger aria-label={`Actions for ${file.name}`}>  {/* optional: the same menu as a button */}
        <DotsIcon />
      </Menu.Trigger>
      <Menu.Popup aria-label="File actions">                   {/* in the row's last cell: a <div> cannot be a sibling of a <tr> */}
        <Menu.Item action={rename.bind(null, file.id)}>Rename</Menu.Item>
        <Menu.Item action={archive.bind(null, file.id)}>Archive</Menu.Item>
        <Menu.Separator />
        <Menu.Root>
          <Menu.SubmenuTrigger>Move to</Menu.SubmenuTrigger>
          <Menu.Popup>…</Menu.Popup>
        </Menu.Root>
      </Menu.Popup>
    </td>
  </Menu.ContextTrigger>
</Menu.Root>
```

Rendered HTML (closed; ids from the Root's `useId`):

```html
<tr style="-webkit-touch-callout: none">                      <!-- the region: no role, no ARIA -->
  <td>report.pdf</td>
  <td><button type="button" id="_r_1_-trigger" commandfor="_r_1_" command="toggle-popover"
              aria-haspopup="menu" aria-expanded="false" aria-label="Actions for report.pdf">…</button>
      <div id="_r_1_" popover="auto" role="menu" aria-labelledby="_r_1_-trigger" aria-label="File actions"
           tabindex="-1" data-side="bottom" data-align="start"
           style="position-area: bottom span-self-x-end; position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline"></div></td>
</tr>
```

Where the markup allows it (a `div`, `li` or `section` region), render the Popup as a sibling
of the region instead; inside a table row it goes in a cell (review #5: the first draft's
sibling `<div>` under `<tbody>` was invalid HTML and broke SSR). The region ignores
`contextmenu` and long-press `pointerdown` events that come from its own popup, so a popup
inside the region is never a move or a press of the region; DOM and React events from inside
the menu still bubble to the row, so a row `onClick` (selection) must check `event.target`
(docs, review L3).

Open from a right-click at (312, 148):

```html
<tr data-open="" style="-webkit-touch-callout: none">…</tr>
<div id="_r_1_" popover="auto" role="menu" … data-context=""
     style="--menu-point-x: 312px; --menu-point-y: 148px; inset: auto; left: var(--menu-point-x); top: var(--menu-point-y);
            position-area: none; position-try-fallbacks: --fsui-menu-up, --fsui-menu-left, --fsui-menu-up-left">
  <button type="button" role="menuitem" tabindex="-1">Rename</button>
  …
</div>
<!-- in <head>, once per document, inserted by the first point open: -->
<style data-href="@funstack/ui/menu-point" data-precedence="fsui">@position-try --fsui-menu-up { … } …</style>
```

| Part | Element | Role | Library state rendered | Notes |
| --- | --- | --- | --- | --- |
| `Root` | none | | as Menu, plus `state.context` in `children(state)` | Unchanged props. Holds the placement of the current open (section 3.1). |
| `ContextTrigger` | `div` | none | `data-open` (optimistic), `data-pending`, `data-disabled`; inline `-webkit-touch-callout: none` | New. Owns `contextmenu`, the long-press pointer handlers and the keyboard-modality bookkeeping; ignores events from its own popup. Only valid in a top-level Root (dev warning in a submenu). Several per Root are allowed; the one that opened is the `source`. Provides `MenuRegionContext`, which lets a nested `Menu.Root` inside the region (2.4) exist without the "Root outside its parent's Popup" warning. |
| `Trigger` | `button` | button | as Menu | Unchanged. In a Root with both, `aria-expanded` and `data-open` are `true` while the context-opened menu is open (it is the same menu), and a click then closes it. |
| `Popup` | `div` | `menu` | as Menu, plus `data-context`; `data-side` / `data-align` only for anchored opens | Renders point placement for a context open, the shipped `<style>`, an owned `onContextMenu` (prevent the native menu inside), and the outside right / middle-click close for every menu. |
| items, groups, submenus | | | as Menu | Unchanged. |

Why these choices:

- **`Menu.ContextTrigger`, not a `ContextMenu` namespace.** Everything but the trigger is
  Menu's, so a `ContextMenu` namespace would re-export ten parts to add one, and the common
  "row with a More button and a right-click" case would need two Roots and a shared items
  component. One Root with two triggers is the smaller API and makes the sharing free: the
  Root already records how it was opened for focus (the open cause); placement is one more
  field of the same record. The name parallels `Menu.SubmenuTrigger` (a trigger that is also
  something else: an item there, a region here). The docs still get a "Context menu" page.
- **The region is a plain element.** No role (`generic` by default; a `tr`, `li` or `section`
  through `render` keeps its own), no `aria-haspopup` (not allowed on generic / region / group
  roles; deprecated as a global), no `aria-expanded` (same). Radix, Base UI and React Aria
  render no ARIA either. `tabIndex` is the consumer's: a region that keyboard users should be
  able to open must contain something focusable or be focusable itself, and the docs say so.
- **The Popup is a sibling of the region where the markup allows, and inside it otherwise**
  (a table row). A right-click inside the menu is prevented by the Popup's own
  handler and ignored by the region as coming from its own popup, so it is never a move; a
  long-press inside it is ignored the same way. The Popup is a DOM descendant of whatever the
  region is a descendant of (an open Popover or Dialog), and `source: region` nests it there.
- **No `Menu.ContextTrigger` inside a `Menu.Popup`.** A `Menu.Root` inside a Popup is a submenu
  by definition (Menu 1), so a context menu on an item is not expressible and is not a thing in
  native UIs either. Dev warning.

Element constraints for `render`: anything. A `<button>` region works but is pointless (use
`Menu.Trigger`); a `<tr>` works (the example above); a `<canvas>` works (the point path handles
a large focused element where an element-anchored placement would overflow, research 2).

---

## 2. Opening

### 2.1 The `contextmenu` path

```tsx
// inside MenuContextTrigger (sketch; the final code is the implementer's)
const onContextMenu = (event: ReactMouseEvent<HTMLElement>) => {
  const native = event.nativeEvent as PointerEvent;
  if (native.defaultPrevented || disabled) return;                       // an inner region or a consumer handler was first
  if (editableTargets === "native" && isEditableTarget(native.target)) return; // copy and paste keep the browser's menu
  native.preventDefault();                                                // no native menu; outer regions skip
  markHandled(native);                                                    // the document listener (section 5) leaves the menu open
  longPress.cancel();                                                     // Android: its own contextmenu arrived during our timer
  const point = { x: native.clientX, y: native.clientY };
  const keyboard = native.button === -1 || lastKeyDown.current > lastPointerDown.current;
  if (native.buttons !== 0) capturePointer(menu.popover.popupRef.current, native.pointerId); // whatwg/html#10905
  menu.openAt(point, { source: event.currentTarget, event: native, pointer: !keyboard });
};
```

`menu.openAt` (Root, section 3.1) records the placement, records the open cause (`"first"`,
quiet or not) and calls `popover.requestOpen(native, "activate")`. From there it is Menu 2.1:
`openChangeAction(true)` awaited, children render (suspending items hold the open with
`data-pending` on the region), apply effect `showPopover({ source: region })`, first item
focused. When the menu is already open (`intended()` is `true`) `requestOpen` is a no-op and
the placement change alone moves the menu (section 4.3).

**Coordinates.** `clientX` / `clientY` are viewport coordinates, and the popup is `position:
fixed` in the top layer, so no conversion is needed. The keyboard needs no branch: Chromium and
WebKit report the focused element's centre, Gecko its left edge just under the first line
(research 1), all inside the focused element.

**Modality.** The event's fields cannot tell a keyboard `contextmenu` from a mouse one across
engines (Chromium `button: -1`, Gecko `button: 0`, both `pointerType: "mouse"`). Two cheap
signals cover every engine: `button === -1` (Chromium), else "no `pointerdown` on the region
since the last `keydown` on it". The region records both timestamps from native listeners
attached through its ref (`keydown` is not an owned prop: a region is full of the consumer's
interactive content). Keyboard → the first item gets the ring (`autofocus` path); pointer →
quiet focus (`focus({ focusVisible: false })`, Menu 6.1). Nothing else depends on the modality.
A `contextmenu` with neither signal (VoiceOver's VO+Shift+M, a script dispatch) counts as a
pointer open: VoiceOver has its own cursor.

**Pointer capture** (research 3, required). In Firefox and WebKit the spec's light dismiss
records "no popover" at the right-button `pointerdown` (nothing was open) and, at `pointerup`,
hides everything when the pointer is again over no popover: a menu that flipped away from the
pointer, or a pointer that moved, closes as it opens. `popup.setPointerCapture(pointerId)`,
called **synchronously in the `contextmenu` handler on the still-hidden popup element**, makes
the `pointerup` target the popup, so the comparison fails and nothing closes. It is harmless in
Chromium (click-based dismiss), a silent no-op when no button is down (Windows, where
`contextmenu` fires after `mouseup`; the keyboard), and must not wait for the apply effect (the
commit lands at an unpredictable time relative to the `pointerup`). The call is wrapped in
`try` / `catch` (`NotFoundError` for a pointer the engine no longer tracks). The popup element
exists while closed (Menu.Popup unmounts its children, not itself); a Root without a mounted
Popup captures nothing and opens nothing. Since wave 11 the capture is also what makes
**press-drag-release** possible: whenever it was **actually taken** (`capturePointer` returns
whether `setPointerCapture` succeeded; a synthetic pointer throws, and a gesture started on
one could double-activate an item at a later real release, deviation B3), the region starts
the gesture of 2.6 on the same pointer (`startDrag(popup, pointerId, point, timeStamp, slop)`).

### 2.2 Long-press (touch and pen)

iOS Safari never fires `contextmenu` for touch, and there is no feature detection for it
(`oncontextmenu` exists). The region runs its own long-press on **every** platform for `touch`
and `pen` pointers; where the platform fires `contextmenu` on its own (Android, Windows pen),
whichever comes first opens once and cancels the other.

| Event on the region | Effect |
| --- | --- |
| `pointerdown`, `pointerType` `"touch"` or `"pen"`, primary, not `disabled`, not from this Root's popup, not an editable target (2.3), **not already claimed** | **claim** the event (a module-level `WeakSet`; the innermost enabled region times the press and outer regions leave it, mirroring `contextmenu`'s `defaultPrevented` rule, deviation 7; **every `Menu.Popup` claims the `pointerdown`s inside it** too, so a long-press on an item of any menu rendered inside the region, a nested region's menu, a toolbar dropdown, never starts the region's timer, review M1), then start the timer (`longPressDelay`, default 500 ms) with the point and the `pointerId`; a second `pointerdown` (multi-touch) cancels |
| `pointermove` more than 10 px from the start (`Math.hypot`) | cancel (Base UI's slop; Radix cancels on any move and loses presses to jitter) |
| `pointerup`, `pointercancel` (the browser took the gesture for panning; `touch-action` is never set, the region stays scrollable) | cancel |
| `contextmenu` during the gesture (Android, pen) | cancel; that event opens (2.1) |
| timer expiry | open as 2.1 with `details.event` the `pointerdown`, pointer modality, `setPointerCapture(pointerId)` on the popup (the finger is still down: the `pointerup` would light-dismiss in WebKit exactly as the right button does), and a one-shot document-capture `click` swallow (`preventDefault()` + `stopPropagation()` for the next `click`), in case the engine synthesises a click on release that would land on an item. The swallow is scoped to the click that pointer's release could produce (review H1): it is **disarmed one task after the `pointerup` or `pointercancel` of that `pointerId`** (the synthesised click is dispatched in the release's task), by that click, by the next `pointerdown`, **on any `keydown`**, and **when the menu closes**. Without the scoping it outlived the gesture (no click follows a long-press on iOS) and ate the next keyboard or assistive-technology activation, which reaches items as a bare `click` (Menu 5.3). |

On expiry the region also starts the drag gesture of 2.6 for that pointer, with the long-press
slop (10 px) and, for a `touch` pointer, a non-passive document `touchmove` listener that
`preventDefault()`s so the browser does not take the drag as a pan (probe `touch-drag.mjs`:
without it the stream ends in `pointercancel` after two moves). The guard **also cancels the
lift's `touchend`** and ends at `touchend` / `touchcancel` / `pointercancel`, or 250 ms after
the `pointerup` when no touch event follows (deviation B1): with the menu above the finger
(4.7), the tap the engine synthesises from the lift lands beside the popover and
light-dismisses it (Chromium touch emulation: `pointerup` captured by the popup, `touchend`,
then `beforetoggle(closed)` before any `click`); before wave 11 that click landed on the menu
under the finger. Cancelling `touchend` suppresses the synthesised click, which is what the
one-shot swallow of this section existed for on the mouse path. Pointer events carry no
`Touch.identifier`, so the guard pairs by dispatch order: **the first `touchend` after the
gesture pointer's own `pointerup` is that finger's lift** and ends the guard; any other
finger's `touchend` (a second finger tapping while the first still holds) is still cancelled
but does not end it, so the slide is not lost (review L4, as landed in a02e316). `pen` pointers get no
`touchmove` guard; whether an Apple Pencil long-press drag is taken as a pan on iPadOS is on
the #90 device checklist (review L7). The region stays scrollable before the open. A lift without a drag never
closes the menu (the menu sits above the finger, 4.7, so the lift lands outside it; the
outside-release rule requires movement, 2.6). Where the platform fires its own `contextmenu`
first (Android), the capture and the gesture are taken for the touch pointer the region was
timing, even though that event's `buttons` is `0`. Real iOS and Android were not available to
the research; **a human device pass is required before the touch gesture is called verified**
(issue #90; the docs page says "verified under Chromium's
touch emulation; iOS and Android pending" until it closes).

Not done in v1 (recorded as follow-ups; the offset landed in wave 11, 4.7): offsetting the
point so the menu does not open under the finger, and `user-select`. The region renders inline
`-webkit-touch-callout: none` (iOS link / image previews appear at about the long-press time;
Radix and Base UI do the same, inline). Text selection and the loupe on iOS start on long-press
over text and only a `user-select: none` that already applies when the touch starts prevents it;
that is a trade-off (text in the region is then not selectable by touch), so it is the
consumer's CSS, shown in the docs, not a library default.

### 2.3 Editable targets

By default a `contextmenu` whose target is an `<input>` of a text-taking type (not `button`,
`submit`, `reset`, `checkbox`, `radio`, `range`, `color`, `file`, `image`, `hidden`), a
`<textarea>` or an element with `isContentEditable` is left alone: the browser's menu opens with
copy, paste, spell-check and the user's extensions, and the region does not open (the event is
not prevented, so an outer region does not open either: the document listener of section 5
closes an open menu of this Root instead, as for any outside right-click). Users expect that
menu in text fields; no surveyed library does this, and the product owner chose it as the
default. `editableTargets="menu"` opens the context menu there too (an editor whose menu has
its own clipboard items). The long-press follows the same rule (a long-press in a text field is
the platform's selection gesture).

### 2.4 Nested regions and consumer handlers

A `Menu.Root` rendered inside another Root's region (a nested region, a Menu in a card) is not a
submenu: the region provides `MenuRegionContext`, which the Root reads to skip its "rendered
inside another Menu.Root but outside its Popup" warning (a genuinely misplaced
Root inside a region is no longer warned about, an accepted loss, since nothing can tell the two
apart). The long-press follows the same inner-wins rule through the claimed-`pointerdown` set
(2.2), and a `pointerdown` inside any `Menu.Popup` is claimed by that Popup (review M1).

`contextmenu` bubbles. A region opens only when the event reaches it **not `defaultPrevented`**,
and opening prevents it, so the innermost region wins and an outer one does nothing. A
`disabled` region neither opens nor prevents, so the event bubbles to an outer region, which
may open (Radix and Base UI meaning). A consumer handler below the region that
`preventDefault()`s (a canvas that draws its own menu) keeps both the native menu and the
region quiet; one that wants "the native menu here, nothing custom" calls `stopPropagation()`
(the event never reaches the region; the document listener never sees it either, so an open menu
of this Root stays open under the native one: the documented cost of hiding an event).

The library uses `preventDefault()` for this and never `stopPropagation()` (Base UI and React
Aria stop propagation, which hides the event from the consumer's document-level listeners;
Radix does neither, so nested Radix regions both open).

### 2.5 Pre-hydration

Nothing opens before hydration: there is no declarative context trigger (the HTML `contextmenu`
attribute is gone, invokers fire on activation, Open UI plans none). The user gets the native
menu, which is the right fallback: nothing half-open, copy and paste work, and the custom menu
works once the region hydrates. A pre-hydration right-click is not replayed. The `<style>`
resource is not in the server HTML (it is rendered by the first point open, section 4.2), which
is fine for the same reason.

### 2.6 Press-drag-release (wave 11, #88)

Native menus on Linux and macOS open on the button **press** and let the user slide onto an
item and release to activate it (GTK: if more than 500 ms since the popup; Chromium Views:
unless within 200 ms and 4 DIP of the press; macOS: once the pointer has moved); Windows opens
on the release, so there is no gesture to support there. iOS lets a finger slide from the
long-press onto an action. Base UI implements it for macOS only; Radix and React Aria not at
all (`docs/research/interaction-wave11.md` 2.1).

The region already captures the pointer on the hidden popup at the open (2.1). With capture,
the probe shows every `pointermove` and the `pointerup` target the **popup**, items never get
`pointerover` / `:hover`, and `elementFromPoint` returns the item under the pointer. So the
gesture is a hit-test loop on the captured pointer:

| Event on the popup (captured pointer only, `pointerId` matched) | Behaviour |
| --- | --- |
| `pointermove` | `elementFromPoint(clientX, clientY)` → `closest('[role^="menuitem"]')` inside the **root popup's tree** (submenus are descendants). An enabled or disabled item: focus it through the same quiet routine the item's own `pointermove` uses (Menu 6.2, `focus({ focusVisible: false })`), so keyboard and pointer still agree on the current item. A `SubmenuTrigger`: focus it and start its hover-open timer (Menu 7) as a real `pointerenter` would; leaving it starts the close timer. Nothing under the pointer (outside every popup, padding, a separator): nothing. |
| `pointerup` (any button) over an **enabled, non-submenu item**, pointer moved more than the slop from the open point | **activate**: `item.click()` (Menu 5.3: one activation path, so `action`, `closeOnActivate`, checkbox and radio toggling are unchanged); a long-press swallow armed by this gesture (2.2, a document capture `click` listener that would eat the library's own `item.click()`) is **disarmed around the call and re-armed afterwards** (deviation B2), and the swallow then covers the `click` an engine may synthesise from this release (macOS Ctrl+click opens with the primary button held). |
| `pointerup` **outside every popup of the tree**, pointer moved more than the slop, and at least **500 ms** since the open (the clock starts at the **first `toggle` that finds the popup `:popover-open`**, not at the press: an `openChangeAction` or suspending items that take 450 ms would otherwise let a 5 px drift and a release 70 ms after the menu appeared dismiss it; a move restarts it with the gesture; review M2) | **dismiss**: `rootPopup.hidePopover()` now (the Tab / outside-right-click shape, section 5), notified `"dismiss"`. |
| any other `pointerup` (stationary or within the slop; a quick release outside; over a disabled item, a separator, padding, a `SubmenuTrigger`) | nothing: the menu stays open and the ordinary click model takes over. |
| `lostpointercapture`, `pointercancel`, the menu closing | the gesture ends; listeners removed. |

Slop: **4 px** for a mouse or pen `contextmenu` open (Chromium's `kMaximumLengthMovedToActivate`;
macOS's "moved" behaviour), **10 px** for a long-press open (the long-press slop; a thumb jitters).
Distance is `Math.hypot` from the open point. Time alone never activates: the point placement
puts the menu's corner under the pointer (mouse) or the menu just above it (touch), so a long
stationary hold must not fire the first item. The outside-release dismissal requires **movement
as well as time**, unlike GTK's time-only rule: a stationary press and release (macOS's "keeps the
menu open") and a touch long-press lifted in place (always outside the offset menu) must leave
the menu open; the 500 ms is GTK's and Base UI's threshold against a quick press that overshoots
a flipped menu. A **move** (a second right-click while open, 4.3) ends the running gesture and
starts a new one with the new pointer, point and time. Windows (`contextmenu` after `mouseup`,
`buttons === 0`) and the keyboard take no capture, so no gesture runs. Touch: 2.2.

What it does not do: hover styling during the drag (`:hover` cannot match under capture; the
focused item is the visible current item, as with the keyboard, Menu 9's CSS styles `:focus`);
activation of a submenu trigger on release (native menus open the submenu on hover and activate
nothing); drag-to-open from a `Menu.Trigger` (Android's `getDragToOpenListener`): not a
context-menu feature, not designed.

---

## 3. Props and types

### 3.1 `Menu.Root`

No props of its own: a context-menu Root has Menu's, `openChangeAction` / `onOpenChange` included (menu.md 2.4). `MenuRootState` gains `readonly context: boolean` (the current open, optimistic,
came from a ContextTrigger). Internally the Root holds the **placement** of the current open:

```ts
type MenuPlacement =
  | { readonly kind: "anchor" }                                             // Menu.Trigger, foreign invoker, controlled, platform
  | { readonly kind: "point"; readonly x: number; readonly y: number;       // Menu.ContextTrigger
      readonly generation: number; readonly source: HTMLElement;
      readonly pointerId: number | undefined;                               // re-capture after a move
      readonly direction: "ltr" | "rtl";                                    // wave 11 (#88): the popup's computed direction at this open or move
      readonly offset: boolean };                                           // wave 11 (#88): a touch / pen open, placed above the point (4.7)
```

`direction` is read by `openAt` from the popup element (`isRtl(popupRef.current)`,
`menu-dom.ts`; the element exists while closed and `direction` is inherited, so it computes
without a box), once per open and per move, and stored so the Popup's inline style stays a pure
function of the placement (nothing is read during render or on the server). It picks which
edge of the menu sits at the point (4.6).

React state (`useState`), **written urgently** (a plain `setState` outside any transition,
deviation 1; the first draft said `startTransition`): React entangles every transition update
with any pending async action, so a move written in a transition would wait for an unrelated
item action or pending open to settle and the menu would sit at the old point; placement is
internal geometry, nothing is dispatched for it, and while the popup is closed the urgent
render shows nothing. The placement also carries the `pointerId` of the opening pointer
(for the re-capture after a move, 4.3). The Root's context exposes `openAt(point,
{ source, event, pointer, pointerId })` to the ContextTrigger and `placement` to the Popup;
`generation` is what makes a second right-click at a new point a state change while the menu is
open (section 4.3); `source` is what `showPopover({ source })` gets (section 2.6 of
Popover: it must be inside any open popover the region is in, so that the parent stays open).

### 3.2 `Menu.ContextTrigger`

**Reset to `anchor`**: the Root resets the placement in `onDispatch` for every open that is not
`openAt`'s (a `Menu.Trigger` click, a foreign invoker, mount reconciliation), and the Popup
resets it once a shown point open is no longer visible (hidden and its exit animation over), so
a controlled open that sends no dispatch is anchored too and a CSS exit never jumps back to the
Trigger. Review L1 (closed in c6cb71f, folded in wave 11): the reset condition is "the popup is
not visible **and** no open is pending or intended" (`!visible && !popover.pending &&
!popover.intended()`), checked in the Popup's layout effect after every commit, so a point open
that was refused or rejected before it was shown resets too and `data-context` never outlives
its open; `context` therefore reads as "the current open, or the one in flight, is a point open".

```ts
export interface MenuContextTriggerState {
  readonly open: boolean;      // optimistic, the Root's
  readonly pending: boolean;   // the Root's transition (open or close in flight)
  readonly disabled: boolean;
}

export interface MenuContextTriggerProps
  extends Omit<ComponentPropsWithRef<"div">, "onContextMenu" | "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel" | "className" | "style" | "children"> {
  /** The region does nothing; a `contextmenu` bubbles on to an outer region. `data-disabled`. */
  disabled?: boolean;
  /**
   * What a `contextmenu` (or long-press) on an editable target inside the region opens: the
   * browser's own menu (`"native"`, default: copy and paste keep working) or this menu.
   * Editable: a text-taking `<input>`, a `<textarea>`, an element with `isContentEditable`.
   */
  editableTargets?: "native" | "menu";
  /** Milliseconds a touch or pen pointer must stay down (within 10 px) to open. Default 500. */
  longPressDelay?: number;
  className?: StateValue<string | undefined, MenuContextTriggerState>;
  style?: StateValue<CSSProperties | undefined, MenuContextTriggerState>;
  children?: StateValue<ReactNode, MenuContextTriggerState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, MenuContextTriggerState>;
}
```

Owned keys: `onContextMenu`, `onPointerDown`, `onPointerMove`, `onPointerUp`,
`onPointerCancel`, `data-open`, `data-pending`, `data-disabled`, and the style key
`WebkitTouchCallout` (`"none"`; a consumer's `style` wins, conventions 1.3 merge order).
`keydown` is observed through a ref listener (modality bookkeeping, 2.1), so `onKeyDown` passes
through. No `id`, no `tabIndex`, no ARIA.

Every prop is serialisable: a Server Component may render the region directly. `onContextMenu`
is owned and omitted from the type; a consumer who wants their own `contextmenu` behaviour puts
a handler on an element inside the region (2.4).

### 3.3 `Menu.Popup`

```ts
export interface MenuPopupState {
  readonly open: boolean;        // committed
  readonly side: MenuSide | null; // `null` during a context open (nothing is anchored) and with `side={null}`
  readonly align: MenuAlign;
  readonly submenu: boolean;
  readonly context: boolean;     // the current open came from a Menu.ContextTrigger (committed)
}
```

`MenuPopupProps` adds `"onContextMenu"` to the `Omit` list (owned: `preventDefault()` on a
right-click inside the menu, so no native menu covers the custom one; nothing else). No new
props: `side` / `align` apply to anchored opens only and are ignored for a point open (no
warning: a dual-trigger Root uses both paths); `side={null}` opts out of inline placement on
**both** paths (section 4.4). Owned attributes gain `data-context`.

Rendering per placement (the apply effect, the focus resolver and everything else are Menu's):

| Placement | Inline style | `data-*` | `showPopover` `source` | `<style>` |
| --- | --- | --- | --- | --- |
| `anchor`, `side` set | `position-area`, `position-try-fallbacks` from `side` / `align` (Menu 3.3) | `data-side`, `data-align` | the Trigger (`triggerRef`), or none | no |
| `point`, `side` set | `--menu-point-x`, `--menu-point-y`, `--menu-point-gap` (`0px`; `16px` for a touch or pen open, 4.7), the four inset longhands (longhands rather than `inset: auto` + two, which is equivalent and avoids React's warning about a shorthand and its longhands changing together) and `position-area: none`. Mouse / keyboard, LTR: `top: calc(var(--menu-point-y) + var(--menu-point-gap))`, `left: var(--menu-point-x)`, `right: auto`, `bottom: auto`; RTL (`placement.direction === "rtl"`, wave 11): `right: calc(100% - var(--menu-point-x))`, `left: auto`. Touch / pen (`placement.offset`, wave 11): `bottom: calc(100% - var(--menu-point-y) + var(--menu-point-gap))`, `top: auto`, the same inline inset by direction. `position-try-fallbacks`: mouse LTR `--fsui-menu-up, --fsui-menu-left, --fsui-menu-up-left`; mouse RTL `--fsui-menu-up, --fsui-menu-right, --fsui-menu-up-right`; touch LTR `--fsui-menu-left, --fsui-menu-down, --fsui-menu-down-left`; touch RTL `--fsui-menu-right, --fsui-menu-down, --fsui-menu-down-right` (odd generations with the first two swapped, 4.3) | `data-context` | the region | yes (4.2) |
| `point`, `side={null}` | `--menu-point-x`, `--menu-point-y` and `--menu-point-gap` only (the gap is handed over too, so a stylesheet-owned touch placement can use it; deviation B5) | `data-context` | the region | no |
| `anchor`, `side={null}` | none | none | the Trigger, or none | no |

`position-area: none` is restated for the point path because a consumer stylesheet may set
`position-area` for the anchored path without `side={null}`, and `position-area` together with
`left` / `top` would place the popup inside the grid area instead of at the point.

### 3.4 Namespace and types

```ts
export const Menu = { …, ContextTrigger: MenuContextTrigger } as const;
export type { MenuContextTriggerProps, MenuContextTriggerState } from "./menu-context-trigger.js";
```

`MenuOpenChangeDetails` is unchanged: a context open is `reason: "activate"` with
`details.event` the `contextmenu` `PointerEvent` (or the long-press `pointerdown`). No `x` /
`y` on `details`: a consumer who needs the point for the items has a Root per target (the
example in section 11) and does not need it; a `details` field would be the first non-reason
field on an open and is not asked for.

---

## 4. Placement at a point

### 4.1 Why no anchor

CSS Anchor Positioning anchors to elements. The research measured four ways to put a popover at
a point with viewport-edge flipping; two work (a zero-size virtual anchor element, S1 / S2, and
no anchor with custom `@position-try` rules, S4), one does not (`left` / `top` + `flip-*`, S3:
`flip-block` swaps `top: y` to `bottom: y`, which does not mirror around the point). S4 is the
only one immune to **transformed ancestors**: a `position: fixed` virtual anchor inside a
`transform`, `filter`, `contain` or `will-change` ancestor is positioned against that ancestor,
and Chromium follows the transform where Firefox does not, so no correction is right in both.
The popup itself is in the top layer, whose containing block is the viewport whatever the
region's ancestors do (verified, `point-try-transform.mjs`). Context menus inside a
`transform`-centred dialog or a sliding panel are common; S4 is the recommendation.

### 4.2 The shipped rules

```css
/* @funstack/ui: placement of a menu at a point (design/components/context-menu.md 4.2).
   Functional only. The base position is inline on the popup: the point's y below (mouse) or
   above (touch, with --menu-point-gap) the menu and, by the popup's direction, its left (LTR) or
   right (RTL) edge at the point's x. These options mirror it around the point when it does not
   fit; a menu names the three that apply to its direction and pointer kind. */
@position-try --fsui-menu-up         { top: auto; bottom: calc(100% - var(--menu-point-y) + var(--menu-point-gap)); }
@position-try --fsui-menu-down       { bottom: auto; top: calc(var(--menu-point-y) + var(--menu-point-gap)); }
@position-try --fsui-menu-left       { left: auto; right: calc(100% - var(--menu-point-x)); }
@position-try --fsui-menu-right      { right: auto; left: var(--menu-point-x); }
@position-try --fsui-menu-up-left    { top: auto; bottom: calc(100% - var(--menu-point-y) + var(--menu-point-gap));
                                       left: auto; right: calc(100% - var(--menu-point-x)); }
@position-try --fsui-menu-up-right   { top: auto; bottom: calc(100% - var(--menu-point-y) + var(--menu-point-gap));
                                       right: auto; left: var(--menu-point-x); }
@position-try --fsui-menu-down-left  { bottom: auto; top: calc(var(--menu-point-y) + var(--menu-point-gap));
                                       left: auto; right: calc(100% - var(--menu-point-x)); }
@position-try --fsui-menu-down-right { bottom: auto; top: calc(var(--menu-point-y) + var(--menu-point-gap));
                                       right: auto; left: var(--menu-point-x); }
```

`--menu-point-gap` is set inline by the Popup (`0px` for a mouse or keyboard open, `16px` for a
touch or pen open, 4.7), so with a mouse every option computes exactly as v1's did; a consumer
`style={{ "--menu-point-gap": "24px" }}` changes the touch gap with no prop.

Verified at the four corners in Chromium 156 and Firefox 157 (`anchor-point.mjs`: (780, 580)
with a 120 × 80 popup lands at (660, 500); the RTL pair in `rtl-point-and-submenu.mjs`: a point
at (200, 200) puts a 120 px menu at 80..200, at (50, 200) it flips to 50..170, and the same
inside an RTL container); `@position-try` is Chrome 125, Firefox 147, Safari 26, so every
stable engine has it. `100%` resolves against the viewport (the top layer's containing block),
which is what `clientX` / `clientY` are measured in. The right-to-left and the downward options
were added in wave 11 (#88, sections 4.6 and 4.7); an option a menu does not name is inert.

Shipped as a **React 19 hoisted style**, rendered by `Menu.Popup` whenever it renders a point
placement with `side !== null`:

```tsx
<style href="@funstack/ui/menu-point" precedence="fsui">{MENU_POINT_RULES}</style>
```

React moves it into `<head>` in the commit (before layout effects, so before
`showPopover()`), deduplicates it by `href` across every Root, Root instance and React root in
the document, and leaves it in place afterwards. Nothing is rendered in place, so the
`<ViewTransition>` boundary still wraps the popup element and the part still renders one DOM
element where it is. Properties:

- **Functional only.** At-rules with `--fsui-` names and no selectors: no element is styled,
  nothing cascades, no reset, no colours, no sizes. The library stays headless.
- **Opt-out** is `side={null}` on the Popup (section 4.4). With the style never rendered,
  nothing is shipped: a consumer who positions every menu themselves never sees it.
- **Precedence** `"fsui"` is a bucket name React orders stylesheets by; since the rules are
  named at-rules, order never matters and no consumer precedence has to be arranged around it.
- **CSP.** An inline `<style>` needs `style-src` to allow it (`'unsafe-inline'`, a nonce or a
  hash). The library already depends on inline `style` attributes (`position-area` on every
  anchored popup), which the same directive governs, so no new requirement is introduced; the
  docs say so once. (React forwards `nonce` on hoisted styles; a consumer-provided nonce is
  not a v1 prop and is recorded as a follow-up if a strict-CSP consumer asks.)
- **Server rendering.** The style is rendered only for a point open, which cannot exist in a
  server render (no point before hydration), so it never appears in the server HTML; if a
  future server-rendered point open existed, React would hoist it into the streamed `<head>`.

Where the string lives: `menu/menu-point.ts` (directive-free; the precedence name
`FSUI_PRECEDENCE` is `internal/shipped-styles.ts`) exports
`MENU_POINT_RULES`, `MENU_POINT_FALLBACKS` (the two equivalent spellings) and the custom
property names, next to `positionArea` and `POSITION_TRY_FALLBACKS`.

### 4.3 Re-opening at a new point: the move

A second `contextmenu` inside the region while the menu is open is the common "right-click
somewhere else" and native menus simply appear at the new point. Two engine facts shape it
(research 2):

- A hide + show at a new point **in the same task reuses the previous flip** whenever it still
  fits (CSS Anchor Positioning's "last successful position option" is recorded and cleared only
  at the next rendering update): opened at (780, 580) and flipped up-left, a re-open at
  (300, 250) lands at (180, 170). Changing `position-try-fallbacks` clears it synchronously
  (verified in both engines), hence the two equivalent spellings of the fallback list,
  alternated by `generation` parity (the first two options are order-independent: only one of
  them can fix a given overflow, and the third is needed only when neither does). There is a
  pair of spellings per direction and pointer kind (`MENU_POINT_FALLBACKS[direction][offset]`,
  wave 11); a move that changes direction or pointer kind (a touch long-press after a mouse
  open) changes the list either way, so the remembered option is cleared in that case too.
- Moving the point while the popup stays shown keeps the flip too (stability, by spec).

So a move is: the ContextTrigger writes a new `point` placement (new `generation`, written
urgently, 3.1; `requestOpen` is a no-op because `true` is already intended, no
`openChangeAction`); the commit renders the new custom properties and the respelled fallbacks;
the Popup's apply effect sees committed open, shown, and a placement key it has not shown yet,
and **re-shows** the popup: `hidePopover()` + `showPopover({ source })` under the hook's
`opening` flag, with the focus resolver run again (first item, quiet or ring by the new
modality). The platform coalesces the two toggles into one `toggle` with `oldState ===
newState === "open"`, so nothing is reported (a move is neither a request nor a fact) and the `beforetoggle(closed)`
bookkeeping (`awaitingClose`, `focusWasInside`) is consumed by that same event. **A re-show does
not advance the open generation** (the hook's `reshowing` flag skips `nextOpenGeneration()`): otherwise an item action pending across the move would drop its close through
`closeStackLater`. Items keep their state (nothing unmounts), a pending item action keeps
running, no `<ViewTransition>` runs (there is no React open or close), and the pointer capture
is taken in the handler as for a fresh open and **re-taken after the re-show** with the
`pointerId` kept in the placement (defensive, in case an engine drops capture on
hide; a no-op with no button down, and the `NotFoundError` for a lifted touch is caught). An
Android `contextmenu` that arrives after the timer already opened the menu is handled as a
move at the same point: no native menu, no second dispatch. A move during a pending open (the
items are still loading) is just the latest point: the open commit renders it.

If a probe shows that respelling `position-try-fallbacks` while the popup stays shown already
clears the remembered option (the spec text allows that reading; the research verified it only
between a hide and a show), the implementer may drop the hide + show and keep the focus move;
the observable behaviour is the same and the browser row in 13.2 pins it.

### 4.4 Override and opt-out

- **Adjust:** `style` on the Popup wins over the inline values (Popover 8), so a consumer can
  replace the fallback list with their own `@position-try` names, add a `margin`, or clamp
  sizes; the shipped rules stay harmless.
- **Opt out:** `side={null}` on the Popup. On an anchored open it already means "no inline
  positioning, the stylesheet owns placement"; on a point open it now means the same, with the
  point still handed over as `--menu-point-x` / `--menu-point-y` and the open marked
  `data-context`, and the `<style>` never rendered. The docs show the recipe:

  ```css
  .menu[data-context] { inset: auto; left: var(--menu-point-x); top: var(--menu-point-y); position-try-fallbacks: --mine; }
  @position-try --mine { top: auto; bottom: calc(100% - var(--menu-point-y)); }
  ```

### 4.5 Rejected alternative: the virtual anchor (S2)

A zero-size `position: fixed` `<span>` created by the library inside the region at the point,
passed as `showPopover({ source: span })`, with the ordinary anchored style (`position-area:
bottom span-right` and the `flip-*` list, respelled on every move). It ships no CSS, but it
puts a library-created node inside the consumer's region (`:last-child`, `:empty`, grid layouts
see it; a `tr` cannot contain a `span`) and **a transformed, filtered or contained ancestor
misplaces the menu**, in different directions per engine, with no correction right in both
(research 2). Rejected with the user's decision to allow positioning-only shipped CSS.

### 4.6 Keyboard, scrolling, direction

The keyboard uses the point path: the engines put the coordinates on the focused element
(research 1), and an element-anchored fallback would break for a large focused region (a
canvas) where "below the element" is off-screen. Scrolling: 4.8 (wave 11).

**Direction** (wave 11, #88; `docs/research/positioning-wave11.md` 3, conventions 13.4).
Native context menus open to the **left** of the pointer under a right-to-left UI: Chromium
Views flips its anchor when `base::i18n::IsRTL()`, Gecko's XUL popup follows the chrome
document's direction, GTK flips for `GTK_TEXT_DIR_RTL`, AppKit follows
`NSMenu.userInterfaceLayoutDirection`. Every one of them reads the **browser or OS UI locale**;
none reads the page's `dir`, which a page cannot influence anyway. A FUNSTACK menu is page
content whose items are laid out by the page's direction, so the in-page counterpart of that
convention is the **popup's computed `direction`**: in RTL the menu's right edge sits at the
point and the fallbacks mirror (rightward instead of leftward). The popup's direction rather
than the region's, because it is what lays out the items; a region in an LTR table whose menu
is rendered under a `dir="rtl"` ancestor gets an RTL menu and an RTL placement together.

Mechanics: `openAt` reads `isRtl(popup)` once per open and per move and stores
`placement.direction` (3.1); the Popup renders, for `"rtl"`, `right: calc(100% -
var(--menu-point-x)); left: auto` and `position-try-fallbacks: --fsui-menu-up,
--fsui-menu-right, --fsui-menu-up-right` (3.3), two shipped options more (4.2). Physical insets
are used on purpose: insets have no `self-*` form, which makes this the one placement in the
library that reads `direction` in JS (conventions 13.1 rule 2's exception), and insets are
also why the Firefox parent-direction bug (Mozilla 2019601, conventions 13.3) does not affect
the point path: verified in an RTL container and an RTL page in both engines. `--menu-point-x`
is still the point's x coordinate in either direction; a `side={null}` consumer who wants the
mirrored placement writes `right: calc(100% - var(--menu-point-x))` in their own rule (4.4).

### 4.7 Touch offset (wave 11, #88)

A menu whose corner is at the touch point opens under the finger. Chromium's own touch menus
centre the menu **above** the touch point with a 15 DIP gap and fall below when there is no
room; iOS puts the menu beside the lifted preview, never at the finger; Base UI's 5 px offset
still leaves the hand over the menu (`docs/research/interaction-wave11.md` 2.2). The library
follows Chromium's shape without the centring (centring needs the popup's width): for a
**touch or pen** open (the long-press, or a platform `contextmenu` whose `pointerType` is
`touch` / `pen`), the primary position is **above** the point with a **16 px** gap,
start-aligned at the point's x in the menu's direction; the fallbacks are across (`left` /
`right` by direction, still above), then below the point with the same gap, then both
(3.3; the `--fsui-menu-down*` options of 4.2). Mouse and keyboard opens are unchanged
(`--menu-point-gap: 0px`). The placement record carries `offset: boolean` next to `direction`
(3.1), set by `openAt` from the opening event's `pointerType`; a move re-evaluates it. The gap
is the inline custom property `--menu-point-gap`, overridable through `style` and readable by a
`side={null}` consumer's own rules (4.4). The click swallow of 2.2 stays (cheap, and the menu
being off the finger does not make a synthesised click impossible). No `data-` attribute for
"touch-placed": the gap property is the hook, and a visual difference is not expected.

### 4.8 Scrolling (wave 11, #88)

Native context menus are modal tracking loops that block page scrolling (Win32, AppKit;
Chromium Views routes wheel events to the menu; Gecko consumes them). The point popup is a
non-modal `popover="auto"` in the top layer at viewport coordinates, so today the page scrolls
under it, light dismiss never runs on scroll, and a wheel over a non-overflowing menu scrolls
the page in both engines (`overscroll-behavior: contain` on a non-scrollable container is
honoured by Chromium 156 only; `docs/research/interaction-wave11.md` 2.3). Three rules:

- **Close on scroll, point opens only.** While a point-placed menu is open, a document `scroll`
  listener (capture, passive) closes the stack with `rootPopup.hidePopover()` now (a `"dismiss"` fact
  on `onOpenChange`: a close no user caused through this component) when the event's target is the
  `Document` or an element that **contains the region** (React Aria's `useCloseOnScroll` rule).
  A scroll of an unrelated scroller (a ticking log elsewhere) or inside any popup of the tree is
  ignored. The point is meaningless once the content under it has moved, so closing beats
  leaving a detached menu. A **Trigger-opened** menu is unchanged: anchor positioning keeps it on
  its Trigger while ancestors scroll, as native `<select>` pickers behave; if a right-click
  re-places it at a point (3.1), the rule applies from then on. On touch, a swipe outside the
  menu after the long-press gesture has ended scrolls the page and closes the menu (Base UI's
  intentional touch behaviour, close to Android's).
- **No scroll lock.** Blocking needs non-passive document `wheel` / `touchmove` listeners or
  `overflow: hidden` on `<html>`; neither stops a scrollbar drag and both fight an app's own
  lock. As Dialog 10.2, the lock is a documented CSS recipe:
  `html:has([role="menu"][data-context]:popover-open) { overflow: hidden; scrollbar-gutter: stable; }`.
  With it in place the close-on-scroll listener simply never fires. **A scroll already in
  flight at the open is ignored** (review L6, as landed in a02e316): a running smooth scroll
  (`scroll-behavior: smooth` after a Tab that scrolled, then Shift+F10) or trackpad momentum
  would otherwise open and close the menu within a frame or two. The listener ignores `scroll`
  events until the **first animation frame with no scroll event after the open `toggle`**
  (scroll events run before the frame's `requestAnimationFrame` callbacks, so a frame that saw
  none means the in-flight scroll has ended); the watch is cancelled on close, and without
  `requestAnimationFrame` every scroll closes. Rows wait one frame after the toggle before
  scrolling.
- **Wheel over the menu never scrolls the page.** Every root `Menu.Popup` (point- or
  Trigger-opened) installs, while shown, a **non-passive `wheel` listener on the popup element**
  that `preventDefault()`s unless **some element from the event's target up to the popup** can
  scroll in the wheel's direction on its **dominant axis** (`overflow: auto` / `scroll`, and
  room: `scrollHeight > clientHeight` and not at the end for the sign of `deltaY`; likewise
  for `deltaX`; deviation B4: the ancestor walk rather than the innermost `[role="menu"]`
  alone, so a consumer scroller inside a menu keeps working). **A `wheel` with `ctrlKey` is
  never prevented** (review L3): Chromium delivers trackpad pinch as `wheel` + `ctrlKey` and
  Ctrl+wheel is browser zoom in every engine; the guard is for page scrolling only, and a
  low-vision user zooming over an open menu must not be blocked. Scoped to the popup, so it costs nothing elsewhere; a small
  behaviour change for Trigger-opened menus too, like the outside right-click close (section 5),
  because native menus never scroll the page from inside the menu.

The listeners join the `listenOutside` family of section 5 (installed in the root Popup's
`toggle(open)`, removed on `toggle(closed)`); the scroll one is installed only while
`placement.kind === "point"`.

---

## 5. Closing

Everything in Menu 2.2 applies (item activation through the root Root after its action, Escape,
Tab, left-click light dismiss, another auto popover, controlled `open={false}`). Added, in
`Menu.Popup` and therefore for **every** menu, not only context-opened ones:

| Close | Owner | What happens | `reason` |
| --- | --- | --- | --- |
| `contextmenu` outside the menu tree, not handled by this Root's ContextTrigger | library-initiated, browser-shaped | a document `contextmenu` listener (bubble phase, so the region's handler ran first and could mark the event as a move) calls `rootPopup.hidePopover()` at once; a fact: every Root's `onOpenChange` is called from its `toggle` | `"dismiss"` |
| middle-button `pointerdown` outside the menu tree | same | same listener family (`pointerdown`, `button === 1`) | `"dismiss"` |
| `contextmenu` inside the popup tree | nothing | the Popup's owned `onContextMenu` calls `preventDefault()`; it never reaches a region as a move (the Popup is a sibling of the region) | |
| `contextmenu` inside this Root's ContextTrigger | nothing | a move (4.3) | |
| `scroll` of the document or of an ancestor of the region, while placed at a point (wave 11, 4.8) | library-initiated, browser-shaped | the same listener family (`scroll`, capture, passive) calls `rootPopup.hidePopover()` at once | `"dismiss"` |
| captured-pointer release outside the tree after moving more than the slop and at least 500 ms after the open (wave 11, 2.6) | same | `rootPopup.hidePopover()` at once | `"dismiss"` |
| `wheel` over the menu (every menu, wave 11, 4.8) | nothing | `preventDefault()` unless the menu under the pointer can scroll that way; the page never scrolls | |

Why for every menu: Chromium's light dismiss runs on `click`, and the right and middle buttons
fire no `click`, so a right-click outside leaves the menu open under the browser's own menu;
Firefox and WebKit still close it (pointer-based) but are moving to click-based dismiss too
(Gecko 2072740, WebKit 324373). Native menus close on any click outside. The behaviour is the
same for a menu opened from a button, and one listener in the Popup serves both. Why an
immediate `hidePopover()` and not `requestClose`: the native menu is about to appear over the
page; a menu that lingers while `openChangeAction(false)` is awaited is the visual bug Menu 2.2
avoids for Tab. The listeners exist only while the root menu is open (installed in the Popup's
`toggle(open)`, removed in `toggle(closed)`; a submenu installs none: "outside the tree" is
measured from the root Popup, which contains every submenu as a DOM descendant).

**These closes are facts.** A right- or middle-click outside, a scroll of the document or an
ancestor, and a captured-pointer release outside after the drag delay are hides the library
performs at once and cannot hold: they are reported to `onOpenChange(false, { reason:
"dismiss" })` from the `toggle`, not to `openChangeAction`; nothing pends and no view
transition runs for them (menu.md 2.4, conventions 3.9). An item's activation stays a request
on the root Root; a move (4.3) is neither.

Focus after a close is the platform's (Menu 6.3): the element focused when the popover was
shown. For a right-click on a non-focusable region that is `<body>`, because the right-button
`mousedown` already blurred (native too, verified); for a focusable region or a focused control
inside it, that element; for a keyboard open, the focused element. With a `Menu.Trigger` in the
same Root, the hook's focus-return rule (Popover 6.2: a close that began with focus inside and
ends on `<body>` focuses the Trigger) sends focus to the button, which is a better place than
nowhere; a context-only Root has no Trigger and the rule blurs nothing.

---

## 6. State summary

| State | Owner | Where it shows |
| --- | --- | --- |
| `open` | library (Root; browser for dismissals, as Menu) | `ContextTrigger` `data-open` (optimistic), `Trigger` as Menu, `Root.children(state)` |
| `pending` | library (Root's transition) | `ContextTrigger`, `Trigger` `data-pending` |
| `context` | library (Root placement, written urgently) | `Popup` `data-context` (from the point open's request until the popup is hidden and its exit is over, 3.1), `Root.children(state).context` (optimistic open and a point placement) |
| placement point | library (Root placement) | `Popup` inline `--menu-point-x` / `--menu-point-y` |
| `disabled` | prop | `ContextTrigger` `data-disabled` |
| long-press in progress | library, region-local ref | nothing (no attribute for a gesture that may not happen; conventions 4.2) |

No `aria-*` anywhere on the region; the Popup is `role="menu"` as Menu, named by `aria-label`
(pass-through) or the Trigger's id.

---

## 7. ViewTransition and Server Components

- **`transition` on `Menu.Popup`** behaves as Menu 9: the open commit (`fsui-menu-open`) and
  library-driven closes (`fsui-menu-close`: item activation after its action, a controlled
  close, a Trigger click) run the view transition in every engine; dismissals, Tab and the
  outside right-click close are facts and start none (CSS exits only); a move is instant. With `transition` set, the page
  gets no pointer events during the animation (Menu 12): keep it short, a context-menu user is
  about to click an item.
- **Server Components.** Every Menu part is a client module, `Menu.ContextTrigger` included
  (`"use client"`: event handlers, refs, context). A Server Component may render the region
  and the whole menu with serialisable props; item actions may be Server Functions (`details`
  is serialisable, `event` virtual, conventions 2.2). The region's content (a table row's
  cells) is ordinary server-rendered children. Before hydration: the native menu (2.5).
- **Suspense.** Items that suspend on open hold the open with `data-pending` on the region (and
  on a Trigger in the same Root) until ready, then the menu appears at the recorded point (the
  latest one, if the user right-clicked again meanwhile). A rejected `openChangeAction` rolls
  the region's `data-open` back and opens nothing; the captured pointer releases on its own at
  `pointerup`.

---

## 8. Keyboard and ARIA summary

| Key / input | Where | Behaviour |
| --- | --- | --- |
| Right-click, macOS Ctrl+click | region | open at the pointer, first item focused quietly |
| Shift+F10, ContextMenu key, macOS Ctrl+Return, VO+Shift+M | an element inside the region that has focus | the engine fires `contextmenu` at it; open at the engine's coordinates (inside the focused element), first item focused with the ring |
| Long-press (touch, pen) | region | open after `longPressDelay` at the touch point, first item focused quietly |
| Right-click again inside the region | region | move (4.3) |
| Right-click or middle-click outside | anywhere | close the stack now, `"dismiss"` |
| Right-click inside the menu | popup | nothing (native menu suppressed) |
| Everything after open | popup | Menu 5: arrows, Home / End, typeahead, Enter / Space, Escape, Tab, submenus |

| Part | Attributes |
| --- | --- |
| ContextTrigger | none; `data-open`, `data-pending`, `data-disabled`; inline `-webkit-touch-callout: none` |
| Popup | as Menu; `data-context` on a context open; `aria-labelledby` → the Trigger id while a `Menu.Trigger` is mounted (conventions 1.1.1; none without one); `aria-label` pass-through |

Discoverability is the consumer's (research 4, w3c/aria#1971): nothing in the platform or ARIA
announces a context menu, iOS VoiceOver cannot open one, and TalkBack is unverified. The docs
page (section 12) carries the three rules as requirements, and the library adds no built-in
hint string (no `aria-describedby` default: an authored hint such as "Press Shift+F10 for more
options" is the consumer's choice, conventions 11).

Development warnings: `Menu.ContextTrigger` in a submenu Root; a `contextmenu` arriving with
no mounted `Menu.Popup` in the Root (nothing to capture or open); `longPressDelay` negative.

---

## 9. Styling

```css
.row[data-open] { background: var(--accent-weak); }              /* the region of the open menu */
.row[data-pending] { cursor: progress; }
.row { -webkit-user-select: none; user-select: none; }           /* touch: no selection / loupe during the long-press (optional, see 2.2) */
.menu[data-context] { margin: 0; }                                /* point-placed: no anchored gap */
```

The Menu stylesheet of Menu 9 applies as is (`margin: 0; inset: auto` on `.menu` is already
there and is what a point-placed popup wants). Enter / exit CSS and `transition` as Popover 10.

---

## 10. Async walkthroughs

Notation as Menu 10. Uncontrolled Root with a ContextTrigger and a Trigger, Linux / macOS
pointer timing (`contextmenu` between `pointerdown` and `pointerup`).

1. **Right-click on a row (Firefox).** `pointerdown` (right): focus leaves the page's button to
   `<body>`; nothing open, the platform records "no popover". `contextmenu` on the region:
   not prevented, target not editable → `preventDefault()`, mark; `keyboard` false (a
   `pointerdown` was just seen); `buttons === 2` → `popup.setPointerCapture(id)` on the hidden
   popup; `openAt({x, y}, …)`: `startTransition(setPlacement(point g1))`, open cause `first`
   quiet, `requestOpen` → `O=true`, region and Trigger `data-pending`. Children render; commit
   (`C=true`, placement point, `data-context`, point style); apply effect: resolver → first
   item, `showPopover({ source: row })`, `focus({ focusVisible: false })`. The menu is under the
   pointer's bottom-right. `pointerup` is dispatched to the popup (capture): the platform
   compares "popup" with "no popover" → nothing closes. `P=false`.
2. **Right-click at the bottom-right corner, then elsewhere.** Opened at (780, 580): the base
   position overflows, `--fsui-menu-up` and `--fsui-menu-left` alone still overflow,
   `--fsui-menu-up-left` fits → (660, 500). Right-click at (300, 250): the region's handler
   marks the event, captures the pointer, `openAt` with g2 (`requestOpen` no-op). Commit: new
   custom properties, fallbacks respelled. Apply effect: shown, generation unseen → `hidePopover()`,
   `showPopover({ source })`, first item focused; the respell cleared the remembered option →
   (300, 250). One coalesced `toggle(open → open)`, nothing reported. The document listener saw
   the mark and did nothing.
3. **Shift+F10 on the row's More button.** `keydown` (ref listener: `lastKeyDown`), the engine
   fires `contextmenu` at the button with coordinates inside it (`button: -1` in Chromium) →
   keyboard modality → `autofocus` path: the first item gets the ring. Escape → the platform
   returns focus to the More button.
4. **Right-click outside while open (Chromium).** The document `contextmenu` listener: target
   outside the root Popup, not marked → `rootPopup.hidePopover()` now; the browser's own menu
   opens over the page; `toggle(closed)` → `onOpenChange(false, "dismiss")`. Without the listener,
   Chromium would have left the menu open (no `click` for the right button).
5. **Long-press on iOS.** `pointerdown` (`touch`): timer 500 ms, start point. The finger holds
   still (slop 10 px); the callout is suppressed inline. Expiry: `openAt` with the `pointerdown`
   as `details.event`, quiet focus, `setPointerCapture(id)` (the finger is still down), the
   one-shot click swallow armed. Commit, `showPopover`. The finger lifts: `pointerup` on the
   popup (capture) → WebKit's pointer-based dismiss finds a popover → stays open. No click is
   synthesised after a long-press; the swallow is disarmed one task after that `pointerup` (H1).
6. **Right-click in a text field inside the region.** Target is a `<textarea>`,
   `editableTargets` is `"native"` → the region returns without preventing; the browser's menu
   opens. If this Root's menu was open, the document listener (unmarked event) closed it first.
7. **Item "Archive" (Server Function), then the menu closes.** As Menu 10.2: `data-pending` on
   the item, the menu stays, the action resolves, `rootMenu.requestClose(event, "activate")`,
   `hidePopover()` in the apply effect, view transition if set; focus returns to where it was
   at show time (`<body>` after a pointer open on a non-focusable row; with the More button in
   the Root, the 6.2 rule then focuses it).
8. **Region inside an open `Popover.Popup`.** `showPopover({ source: region })`: the region is
   a descendant of the open popover, so the menu nests and the Popover stays open; Escape closes
   the menu only; a submenu nests in the menu as always.
9. **Open rejected.** `openChangeAction` throws → optimistic reverts, `data-open` leaves the
   region, nothing shown; the error reaches the boundary above the Root. The pointer capture
   ends at `pointerup`.
10. **A second region in the same Root.** Two `Menu.ContextTrigger`s before one Popup (two
    rows, one shared menu whose items read the "current row" from the consumer's own state set
    in `openChangeAction`): the one right-clicked is the `source`, but both regions read the
    Root's optimistic open and both show `data-open`. The docs recommend one Root per target
    and present this only as allowed, not as a pattern.

---

## 11. Call-site examples

### 11.1 Rows with a context menu and a More button, from a Server Component

```tsx
// Server Component
import { Menu } from "@funstack/ui/menu";
import { archiveFile, renameFile } from "./actions"; // "use server"

export function FileRow({ file }: { file: File }) {
  return (
    <Menu.Root>
      <Menu.ContextTrigger render={<tr className="row" />}>
        <td>{file.name}</td>
        <td>{file.size}</td>
        <td>
          <Menu.Trigger className="icon-btn" aria-label={`Actions for ${file.name}`}><DotsIcon /></Menu.Trigger>
          <Menu.Popup className="menu" align="end">            {/* in the last cell: valid table markup */}
            <Menu.Item action={renameFile.bind(null, file.id)}>Rename</Menu.Item>
            <Menu.Item action={archiveFile.bind(null, file.id)}>
              {({ pending }) => (pending ? "Archiving…" : "Archive")}
            </Menu.Item>
          </Menu.Popup>
        </td>
      </Menu.ContextTrigger>
    </Menu.Root>
  );
}
```

One Root, two ways in: the button opens anchored below it (`align="end"`), a right-click
anywhere on the row opens at the pointer, Shift+F10 on the button opens with the ring. Events
inside the menu bubble to the row: a row `onClick` or `:hover` rule must check `event.target`
or `:not(:has([popover]:popover-open))` (review L3). The
button is the required alternate path (section 12), and it gives keyboard and screen-reader
users a focusable target inside the region.

### 11.2 A canvas with view options and a submenu

```tsx
"use client";
<Menu.Root>
  <Menu.ContextTrigger render={<canvas tabIndex={0} aria-label="Diagram" />} className="diagram" />
  <Menu.Popup className="menu" aria-label="Diagram options" transition={{ "fsui-menu-open": "menu-in", "fsui-menu-close": "menu-out", default: "none" }}>
    <Menu.CheckboxItem checked={grid} checkedChangeAction={(next) => { setGrid(next); }}>Show grid</Menu.CheckboxItem>
    <Menu.RadioGroup value={zoom} valueChangeAction={(next) => { setZoom(next); }}>
      <Menu.GroupLabel>Zoom</Menu.GroupLabel>
      <Menu.RadioItem value="fit">Fit</Menu.RadioItem>
      <Menu.RadioItem value="100">100%</Menu.RadioItem>
    </Menu.RadioGroup>
    <Menu.Separator />
    <Menu.Root>
      <Menu.SubmenuTrigger>Export</Menu.SubmenuTrigger>
      <Menu.Popup className="menu">
        <Menu.Item action={() => exportAs("svg")}>SVG</Menu.Item>
        <Menu.Item action={() => exportAs("png")}>PNG</Menu.Item>
      </Menu.Popup>
    </Menu.Root>
  </Menu.Popup>
</Menu.Root>
```

The canvas is focusable (`tabIndex={0}`), so Shift+F10 works and the point lands inside it
wherever the engine puts it; a toolbar next to the canvas offers the same options (alternate
path).

### 11.3 An editor region that owns the clipboard

```tsx
<Menu.ContextTrigger editableTargets="menu" render={<div contentEditable />} />
```

### 11.4 Custom placement

```tsx
<Menu.Popup side={null} className="menu">…</Menu.Popup>
```

```css
.menu[data-context] { inset: auto; left: var(--menu-point-x); top: var(--menu-point-y); position-try-fallbacks: --mine; }
@position-try --mine { top: auto; bottom: calc(100% - var(--menu-point-y)); }
.menu:not([data-context]) { position-area: bottom span-self-x-end; }   /* self-*: follows the menu's direction (conventions 13.1) */
```

---

## 12. Documentation requirements

Moved to `design/CHANGELOG.md` (part "context-menu.md"). Not part of the contract: the code and the tests are the reference.

## 13. Test plan

Moved to `design/CHANGELOG.md` (part "context-menu.md"). Not part of the contract: the code and the tests are the reference.

## 14. Implementation notes

Moved to `design/CHANGELOG.md` (part "context-menu.md"). Not part of the contract: the code and the tests are the reference.
