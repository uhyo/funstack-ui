# Working notes: positioning wave 11 (#20, #53, #88 RTL), 2026-10-22

Sources: BCD 8.1.7 (2026-10-22; Chrome 156 / Firefox 158 / Safari 27 current), chromiumdash
(156.0.8078.48), css-anchor-position-1/2 Overview.bs (main), WebKit AnchorPositionEvaluator.cpp +
StyleTreeResolver.cpp, Gecko nsMenuPopupFrame.cpp, Chromium menu_controller.cc +
toolkit_delegate_views.cc, GTK 3.24 gtkmenu.c. Probes: probes/18-positioning-wave11/.
(probes/18-wave11/ is a different, concurrent #88 researcher's directory.)

Worth remembering:
- position-area grammar: groups cannot mix. `block-end span-self-inline-end` is INVALID; use
  `self-block-end span-self-inline-end`. Physical group accepts `self-x-*`/`self-y-*`. Always
  check CSS.supports in probes and reset the style between cases (invalid keeps the old value).
- `position-anchor` initial is `normal` (151): the implicit anchor applies only with a
  position-area. anchor() insets alone need `position-anchor: auto`.
- getComputedStyle(popup).positionArea reflects the applied try option in Chromium + Firefox,
  synchronously and inside scroll handlers. Firefox serializes a flipped single keyword as
  "span-all bottom". Last successful option is kept while it fits.
- Firefox applies try options to the box only: descendants inherit unflipped values (margin
  trick fails). WebKit/Chromium resolve the option as a real style.
- Mozilla 2019601 (NEW): popover parent box direction != root direction -> inline alignment
  offset mirrored for any position-area (physical too). anchor() insets and plain insets fine.
  2050071 looks like a dup. Human task: add reduction.
- Anchored container queries: Chromium 143+ only, no Gecko/WebKit positions or impl bugs.
- Native context menus: RTL from UI locale everywhere, never page dir.

Re-check later: 2019601 fix (then container-RTL rows can assert the correct placement in
Firefox); WebKit CI row for resolved data-side; Gecko/WebKit anchored-queries positions.
