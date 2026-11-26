# #171 Avatar and the Scroll areas recipe (developer notes)

Branch `feat/171-avatar`, from `design/171-avatar-scrollarea-otp` (3718ae62) + master. OTPField
is another developer's (`feat/171-otp-field`); otp-field.md untouched here.

## Done

- `packages/ui/src/avatar/`: context (`sourceKey`), Root (state `{ status, source }`, `report`,
  `release`, `registerImage` with a dev warning for a second Image), Image (native listeners in
  a memoised merged ref; layout effect reads `complete` / `naturalWidth` / `decode()`), Fallback.
- Image and Fallback do not use `useRender`: when not rendered they must not call a function
  `render`. The Image keeps its listening ref stable with `useMergedRefs` (a hand-written `useMemo` drew React Compiler lint warnings).
- Events are taken only while `img.complete`: my mechanism for "a report for an old source is
  dropped". Not in the design text before; amended avatar.md 4.
- Tests: jsdom (fake `complete` / `naturalWidth` / `decode` via prototype spies), types, browser
  (blob URLs; screenshot pixels for the no-script paint; commit wait via `complete` at ref attach
  and a MutationObserver on `data-status`).
- Scroll areas recipe: `packages/docs/src/examples/scroll-area.css`, tested by
  `packages/ui/src/__tests__/scroll-area-recipe.browser.test.tsx` through
  `commands.readFile("../docs/...")` (path relative to the vitest project root, not the file).
- Docs pages, roadmap, skill, playground, conventions rows, survey note, changelog entry.

## Findings

- react-dom's server renderer adds `<link rel="preload" as="image" href>` for an `<img src>`
  (before the element in `renderToString` output). Hydration is fine.
- Playwright Firefox is 157: no scroll timelines; forces `scrollbar-width: none`. See
  cross-engine.md.
- WebKit cannot run locally (missing host libraries); ran on branch CI (`gh workflow run ci.yml
  --ref feat/171-avatar`).

## Open / for the reviewer

- The overlay variant of the edge fades (wrapper + `timeline-scope`) and the
  `::-webkit-scrollbar` variant are described on the page but not run by any test.
- The no-script paint row screenshots a 40px avatar; antialiasing is avoided by having no
  border-radius in the test CSS.

## CI

- Run 45831842711 (head 95424b27): WebKit failed only the recipe's fade row (`9.999999px`).
  Fixed by rounding (dc46b76d). Run 45832566374 (dc46b76d): ci, chromium, firefox, webkit all
  green.
