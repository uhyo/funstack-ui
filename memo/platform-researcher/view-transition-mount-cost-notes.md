# Notes: ViewTransition mount cost (issue #35), 2026-10-16

- Gate: react-dom 19.3.1 `trackEnterViewTransitions` sets shouldStartViewTransition for any placed
  tag-30 fiber or subtree with the VT static flag; no class check. Exit/update paths check "none".
- Host fibers clear the VT subtree flag in completeWork, so a boundary nested under a *new* DOM
  element does not count as entering. Function components / fragments do not shield.
- Next transition-lane commit waits on `document.__reactViewTransition.finished`; sync lanes do not.
  Passive effects are not delayed (4-7 ms).
- Measured ~265-280 ms wait in Chromium 156 and Firefox 157; Firefox 157 accepts `{update, types}`.
- Root CSS `animation:none` or `:root{view-transition-name:none}` leaves 31 ms (Chromium) / 13 ms
  (Firefox). Global, so not a library default.
- Firefox: Playwright click during the cross-fade waits until it ends (not hittable);
  `::view-transition{pointer-events:none}` fixes it. Chromium delivered the click.
- Recommendation: render <ViewTransition> only when `transition !== undefined` (explicit "none"
  keeps the boundary to avoid remounts when toggling).
- Upstream candidate (not filed): resolve enter class before setting shouldStartViewTransition.
- Probe: probes/09-view-transition-mount-cost/. Scratch copy in packages/ui/src/__tests__ deleted.
