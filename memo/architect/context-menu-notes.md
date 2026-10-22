# Architect notes: Context menu (#45), 2026-10-22

Working notes behind `design/components/context-menu.md`. Not a spec; the design doc is.

## Facts relied on (research `docs/research/context-menu.md`, probes in `memo/platform-researcher/probes/17-context-menu/`)

1. `contextmenu` is a `PointerEvent` everywhere; iOS never fires it for touch; Android fires it
   on long-press. Linux / macOS: between `pointerdown` and `pointerup`; Windows: after `mouseup`
   (`buttons === 0`). Keyboard: Chromium `button: -1`, Gecko `button: 0`, both `"mouse"`;
   coordinates on the focused element in all three engines.
2. Firefox and WebKit light-dismiss a popover shown in `contextmenu` at the pending `pointerup`
   when the pointer is not over it (whatwg/html#10905). `popup.setPointerCapture(pointerId)` in
   the handler, on the hidden popup, fixes it (verified Firefox 157; WebKit by source).
3. Chromium does not close a popover on a right or middle click outside (click-based dismiss);
   Gecko and WebKit are moving to the same. Native menus close on any click.
4. S4 (no anchor, `left`/`top` from custom properties + `@position-try` rules) flips at the
   four corners in both engines and ignores transformed ancestors; S1/S2 (virtual anchor) differ
   per engine under a transform. S3 (`flip-*` with plain `left`/`top`) does not flip at all.
5. The "last successful position option" survives a same-task hide + show; changing
   `position-try-fallbacks` clears it synchronously; moving the point while shown keeps it.
6. Focus after close returns to the element focused at show time: `<body>` after a right-click
   on a non-focusable region (the mousedown blurred), native too.

## Decisions I went back and forth on

- **`Menu.ContextTrigger` versus a `ContextMenu` namespace.** Radix / Base UI naming says
  `ContextMenu.Trigger`; the PO asked for the smaller, more consistent API and said one Root
  with two triggers is fine if it falls out naturally. It does: the Root already records the
  open cause for focus; placement is one more field of the same record, and `source` is already
  per-open in spirit. A `ContextMenu` namespace would re-export ten parts to add one and would
  need two Roots plus a shared-items component for the "More button + right-click" row. Kept
  `ContextTrigger` (parallels `SubmenuTrigger`: a trigger that is also something else).
- **Where the point lives.** First draft: a ref written by the region and applied to the DOM
  right before `showPopover()` (the `autofocus` timing). Rejected: the Popup renders inline
  `position-area` / `position-try-fallbacks` through React's `style`, and a DOM override would
  fight the next render. Placement is React state in the Root (`{ kind, x, y, generation,
  source }`) written inside `startTransition` by the trigger, so it joins the open's commit.
  `generation` doubles as the move signal and as the fallback-respell parity.
- **Move = re-show, not close + open.** Two dispatches in one handler net to "still open"
  (latest intent) and never re-position. A move is a placement write with `requestOpen` a
  no-op; the Popup's apply effect re-shows on a generation it has not shown. The platform
  coalesces hide + show into one `toggle(open → open)`, so nothing notifies, as long as the
  hook's `opening` flag spans both calls. Left the "respell while shown suffices" optimisation
  to a probe: the research verified the respell only between a hide and a show.
- **Outside right-click close: context menus only, or every menu?** The gap is Chromium's for
  any popover; a button-opened menu stays open under the browser's menu just the same. One
  listener family in `Menu.Popup` for every menu; recorded as a Menu behaviour change for the
  PO. Immediate `hidePopover()` (the Tab shape), not `requestClose`: the native menu is about to
  cover the page.
- **Modality.** `button === -1` only covers Chromium. Added "no `pointerdown` since the last
  `keydown`" from ref listeners (`keydown` must not be an owned prop on a region full of the
  consumer's controls). Wrong only for a mouse long-hold on Windows (ring shows): accepted.
- **Editable targets by `closest("input, textarea")` + `isContentEditable`**, with the
  non-text input types excluded (a checkbox has nothing to copy). A selector prop or a predicate
  was considered; a predicate is not serialisable (Server Components render the region), a
  selector cannot express `contenteditable` inheritance. `editableTargets: "native" | "menu"`
  is enough for v1.
- **`<style>` rendered by the Popup, only on a point open with `side !== null`**, not by the
  ContextTrigger: the opt-out is the Popup's `side={null}` (the existing "stylesheet owns
  placement" switch), and the inline reference and the rules must appear together. React
  hoists it in the commit, before layout effects, so the first `showPopover()` sees the rules.
- **Data attribute name.** `data-context` (boolean) over `data-placement="point"` (an enum that
  would have to be emitted on every menu popup to be honest) and `data-point`. Custom properties
  follow the library's unprefixed `--<component>-<name>` form (`--slider-start`,
  `--progress-value`): `--menu-point-x` / `-y`. The `@position-try` names are document-global
  and therefore prefixed `--fsui-menu-…`.
- **`position-area: none` inline on the point path**: a consumer stylesheet that sets
  `position-area` for the anchored path (without `side={null}`) would otherwise combine with
  `left` / `top` and place the popup inside the grid area.
- **Touch offset and `user-select`.** Deferred and documented respectively. No click is
  synthesised after a long-press in any engine I know of; the one-shot swallow is a cheap guard.
- **Long-press on `pen` too**: a Windows pen press-and-hold fires `contextmenu` natively, Apple
  Pencil does not; the "contextmenu during the gesture cancels the timer" rule makes both one
  open.

## Prior art borrowed / rejected

- Radix ContextMenu: inline `-webkit-touch-callout: none`; `disabled` passes the event on;
  virtual rect + Floating UI (rejected: platform placement); 700 ms long-press (took 500 ms,
  React Aria / Base UI); cancels the long-press on any move (rejected: 10 px slop).
- Base UI ContextMenu: 10 px slop; press-drag-release (deferred); `stopPropagation()` for
  nesting (rejected: `defaultPrevented`); 10 × 10 touch anchor box (deferred).
- React Aria `useContextMenu`: iOS-only long-press by UA sniff (rejected: every platform);
  one-shot click swallow (borrowed); Ctrl+Enter fallback for engines without keyboard
  `contextmenu` (not needed: Chrome 147+ / Safari 27 fire it).

## Things to raise later

- Press-drag-release (hit-test the captured `pointerup` with `elementFromPoint`).
- Touch offset; a `nonce` for the hoisted style under strict CSP; close-on-scroll; RTL
  (`--fsui-menu-left` first); a `nativeMenu` predicate if `editableTargets` proves too coarse.
- If the user declines the stylesheet: section 4.5 (S2) is the switch; the transformed-ancestor
  browser row then documents the per-engine error instead of asserting the point.
- Spec question worth a repo issue (not filed upstream): the "last successful position option"
  surviving a same-task hide + show of a popover.
