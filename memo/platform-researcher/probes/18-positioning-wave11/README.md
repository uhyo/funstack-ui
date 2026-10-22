# Probes: positioning wave 11 (#20, #53, #88 RTL), 2026-10-22

Playwright Chromium 156.0.8078.4 and Firefox 157.0 (headless, Linux). WebKit cannot launch
locally; its behaviour in docs/research/positioning-wave11.md comes from WebKit source. Run each
script with `node <file>`; outputs are next to them.

| Script | Question |
| --- | --- |
| `rtl-position-area.mjs` | Plain vs `self-*` logical `position-area` keywords: which direction (root, container, popup's own `dir`/`direction`) do they follow on a top-layer popover? |
| `firefox-rtl-parent.mjs` | Isolates the Firefox misplacement (popup whose DOM parent is RTL), incl. `anchor-name` and `anchor()` insets |
| `firefox-rtl-justify.mjs` | Physical areas x explicit `justify-self`, LTR vs RTL parent vs `display:contents` LTR wrapper |
| `firefox-rtl-wrapper.mjs` | Which ancestor triggers it: parent box direction != root direction (contents ignored, LTR island in RTL page fails too) |
| `anchor-insets-rtl.mjs` | `anchor()` insets (with flips) under an RTL parent; note `position-anchor: auto` is needed without `position-area` since `normal` |
| `arrow-flip.mjs` | Arrow after a flip: computed style, anchored container queries, margin-inheritance trick, fixed `anchor()` arrow, absolute arrow |
| `resolved-side-timing.mjs` | When computed `position-area` reflects the applied fallback (sync, toggle, rAF, scroll handler) |
| `computed-serialization.mjs` | Computed `position-area` serialization for physical / self / self-x values, flipped and not |
| `rtl-point-and-submenu.mjs` | RTL point placement (`right` inset + mirrored `@position-try`) and `self-x-end span-bottom` submenus, RTL container vs page |
