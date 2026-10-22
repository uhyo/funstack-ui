# Context menu (`Menu.ContextTrigger`, #45, wave 10 #86)

Design: `design/components/context-menu.md` (accepted e8377ba), Menu amendments, conventions 12.
Branch `wave10/context-menu`.

## What landed

- `menu/menu-context-trigger.tsx` ("use client"): the region. `contextmenu` (defaultPrevented /
  disabled / editable / own-popup checks, `preventDefault`, handled mark, synchronous
  `setPointerCapture` on the hidden popup when `buttons !== 0`, `openAt`), touch / pen long-press
  (500 ms, 10 px slop, cancelled by up / cancel / second pointer / a `contextmenu`; one-shot
  document click swallow disarmed by the next pointerdown), modality through a sequence counter
  (`button === -1` or a `keydown` (capture listener on the region) after the last `pointerdown`),
  inline `WebkitTouchCallout: "none"` under the consumer's style.
- `menu-root.tsx`: `placement` state, `openAt`, `resetPlacement`, `state.context`.
- `menu-popup.tsx`: point style, `data-context`, `state.context` / `side: null`, the hoisted
  `<style href="@funstack/ui/menu-point" precedence="fsui">`, owned `onContextMenu`, the outside
  right / middle-click listeners (top-level popups, installed on `toggle(open)`), the move
  (re-show when the shown placement key changes) and the post-close reset.
- `menu-context.ts`: `MenuPlacement`, `markHandled` / `isHandledBy` (WeakMap keyed by the event,
  value the root popup ref object: stable across re-renders, unlike the context value),
  `MenuRegionContext`.
- `internal/use-popover-popup.ts`: `source` option, `reshow()`.
- `internal/anchor-position.ts`: `MENU_POINT_RULES`, `MENU_POINT_FALLBACKS`, names.
- Tests: `menu-context-trigger.test.tsx` (jsdom), `menu-context-trigger.browser.test.tsx`, Menu
  rows in `menu.test.tsx`, `mouse` browser command
  (`vitest.config.ts`, `__tests__/browser-commands.ts`: `page.mouse` with frame-mapped points).
- Docs page `/components/context-menu` (two live examples, props, the three rules), Menu page
  paragraph, roadmap entry; playground section in `menu-demo.tsx`.

## Deviations from the design (report them)

1. **Placement is written urgently, not in a transition** (design 3.1 says `startTransition`).
   React entangles every transition update with any pending async action (item action, pending
   open), so a move would wait for an unrelated action to settle; the jsdom row "a move keeps a
   pending item action running" needs the urgent write. While closed it renders nothing visible.
2. **Anchored reset**: instead of "a Menu.Trigger click writes the anchor constant", the Root
   resets to anchored in `onDispatch` for every open that is not `openAt`'s (Trigger, foreign
   invoker, platform), and the Popup resets once a shown point open is no longer visible
   (hidden and exit animation over), so a controlled open with no dispatch is anchored too
   (design table 3.1). The reset never happens while the popup is visible, so a CSS exit does
   not jump back to the Trigger.
3. **Point style uses longhands** `top` / `right: auto` / `bottom: auto` / `left` instead of
   `inset: auto` + `left` / `top` (equivalent; React warns when a shorthand and its longhands
   change together).
4. **A re-show does not advance the open generation** (`reshowing` flag in the hook): otherwise an
   item action pending across a move would drop its close (`closeStackLater`). Not in the design.
5. **The Popup may be inside the region.** The design's 11.1 (`render={<tr />}` with the Popup as
   a sibling of the row) is invalid HTML: a `<div>` cannot be a child of `<tbody>`, so SSR
   breaks. The region now ignores `contextmenu` and long-press `pointerdown` from inside its own
   popup, and the docs put the Popup in the row's last cell. Design 1 / 11.1 should be amended.
6. **Nested regions vs the Root's dev warning**: a `Menu.Root` inside another Root's region (the
   design's nested regions, 2.4) triggered "rendered inside another Menu.Root but outside its
   Menu.Popup". The region provides `MenuRegionContext`, which silences it.
7. **Long-press in nested regions**: inner wins through a claimed-`pointerdown` WeakSet (the
   design only specifies `contextmenu`'s `defaultPrevented` rule).
8. **ViewTransition row**: the design's 13.2 says "an outside right-click close zero times"; as
   Escape (menu.browser.test.tsx), the dismissal's notification commit runs one view transition
   with the popup already hidden. The row asserts that (one, `openAtStart: false`).
9. **Move re-captures the pointer** after the re-show (pointerId kept in the placement), in case
   an engine drops capture on hide.
10. **The jsdom `setPointerCapture` stub lives in `menu-context-trigger.test.tsx`, not the shim**
   (13.1 / 14 say the shim): the Slider and NumberField suites install their own tracking stubs
   only when the method is missing and read their own capture maps, so a shim stub broke four of
   their rows. jsdom's `PointerEvent` already has `pointerId` / `pointerType`, so the shim needs no
   fill either; `popover-shim.ts` is unchanged.

## Review fixes (memo/reviewer/context-menu.md, branch `wave10/context-menu-fixes`)

- H1: the long-press click swallow is armed with the pointer id and ends one task after that
  pointer's `pointerup` / `pointercancel` (document capture), on any `keydown`, the next
  `pointerdown`, or the menu closing (effect on the optimistic open). jsdom rows: Enter after
  release, Enter with no release (iOS), bare click after the release task, same-task click
  swallowed (another pointer's release ignored), close disarms. Mutation-checked: dropping the
  release disarm fails the bare-click row, dropping the keydown disarm fails the no-release row.
  Note for tests: an item's Enter handler already calls `element.click()`; a helper that fires
  `keydown` and then `click()` activates twice.
- M1: `claimPress` / `isPressClaimed` in `menu-context.ts`; every `Menu.Popup` claims the
  `pointerdown`s inside it through a native listener on the popup element (runs before React's
  root listener reaches the region). Row: long-press on another menu's item inside the region.
- L1: the placement resets when the popup is not visible and `!pending && !intended()`, not only
  after a shown point open (a refused or rejected point open no longer leaves `data-context`).
- L2: `pointerdown` modality bookkeeping moved to the capture listener next to `keydown`.
- L3: docs say events inside a Popup in the row bubble to the row; also the low note on
  non-menu popups inside a region.
- L4: `mouse.releaseHeld()` in the browser afterEach (only buttons `mouse.down` left pressed, no
  event wait); a held-button move row. Probe: with the re-show re-capture removed, and even with
  the handler's capture removed, a held-button **move** survives the `pointerup` in Chromium and
  Firefox (a popover is already open at that `pointerdown`), so the row guards the behaviour
  (and WebKit on CI) rather than the re-capture itself; the re-capture stays defensive.

## Notes

- jsdom: `PointerEvent` has `pointerId` / `pointerType` (jsdom 30); no `setPointerCapture`, no
  `isContentEditable` (the editable check falls back to `[contenteditable]` there). The quiet
  focus path is reached in jsdom by wrapping `focus` to read `focusVisible` before the first open
  (detection is cached per module).
- Browser: the right-click goes through `page.mouse` (not `userEvent`) because the rows need a
  press and a release apart; the window-level `contextmenu` listener in the test suppresses every
  native menu after recording whether the library prevented it.
- Firefox matched no `:focus-visible` on the first item after a keyboard open when the button had
  been focused by script; focusing it with a real Tab fixes it (the keyboard user's path).
