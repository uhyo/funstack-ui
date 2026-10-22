# Working notes: Context menu research (#45, wave 10, tracker #86), 2026-10-22

Sources: BCD 8.1.6 (2026-10-15; Chrome 155 / Firefox 158 / Safari 27 current in BCD; chromiumdash
says Chrome 156.0.8078.48 stable since 2026-10-20); Chromium runtime flags M155 (8059) / M156
(8078) / main; Chromium html_element.cc + mouse_event_manager.cc; Gecko PresShell.cpp,
EventStateManager.cpp, MouseEvents.h, StaticPrefList.yaml; WebKit Document.cpp; Safari 27 release
notes; Radix context-menu 2.4.1, Base UI 1.9.0, react-aria 3.53.1 useContextMenu/useLongPress.
Probes: probes/17-context-menu/ (Chromium 156, Firefox 157; WebKit still cannot launch).

Findings worth remembering:
- Chromium light dismiss is click-based (flag LightDismissFromClick stable in M155/M156):
  right/middle click outside never dismisses. Firefox + WebKit are spec pointerdown/pointerup
  based. Gecko bug 2072740 (ASSIGNED) and WebKit 324373 (NEW) move them to click; spec PR
  whatwg/html#11536 + pointerevents#460 open.
- whatwg/html#10905: popover shown in `contextmenu` (Linux/macOS: between down and up) gets
  light-dismissed by the pointerup when the pointer is not over it (Firefox verified; WebKit by
  source). Fix: `popup.setPointerCapture(e.pointerId)` when `e.buttons` (works on the hidden
  popup before show, both engines). Showing in a later task does NOT help (still before up).
- Same-task hide+show keeps the CSS "last successful position option" -> stale flip. Clears
  after a frame, or by changing `position-try-fallbacks` (respell 3rd option
  "flip-inline flip-block"), sync, both engines. Firefox also clears on style flush; Chromium not.
- Virtual fixed anchor under a transformed ancestor: Chromium places the popup at the anchor's
  transformed box, Firefox at its untransformed layout box -> diverge. Anchorless custom-property
  @position-try rules on the top-layer popup are immune.
- Keyboard contextmenu: Chromium button -1, pointerType "mouse", pointerId 1, xy = focused
  element centre (selection-based if selection; <html> at 1,1 with nothing focused). Gecko:
  button 0, mozInputSource mouse (bug 1322876), point = focused frame left, top + min(height,
  line scroll amount). WebKit: centre of focused element; Ctrl+Return on macOS (302049 fixed in
  Safari 27; 317496 border-radius NEW). Firefox: Shift+right-click forces native menu without a
  DOM event (pref dom.event.contextmenu.shift_suppresses_event true).
- iOS: no contextmenu at all (BCD false; WebKit 213953 NEW, also VO iOS). iPad + mouse fires it.
- Radix: span, no ARIA, -webkit-touch-callout none, 700 ms touch/pen timer, no
  stopPropagation. Base UI: div, no ARIA, 500 ms touch timer, 10 px slop, stopEvent (inner wins),
  mouseup-after-500ms closes unless over popup (press-drag-release). React Aria: hook only, long
  press only on iOS (UA sniff), 500 ms, swallows the click after long press, Ctrl+Enter fallback
  on mac, stopPropagation.
- ARIA: aria-haspopup not allowed on generic/region (deprecated global); w3c/aria#1971 open
  (no context-menu attribute). Open UI discourages declarative context menus.

Re-check later: WebKit CI run of the pointer-capture + right-click browser test; Android
(Chrome, Firefox) long-press event order; Gecko 2072740 landing (then right-click outside stops
dismissing in Firefox too).
