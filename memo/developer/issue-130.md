# Issue #130, phase 1: test tidy-up (T9, T11, T12, T1, T6, T8, T10)

Branch `refactor/130-tests` (worktree under the session scratchpad), from 6d70a91. Findings:
memo/reviewer/wave18-audit-tests.md. Phase 2 (T3, T4, T5, T7) and T2 (dev-131) are not here.

## What changed
- T9: 156 titles lost their issue / wave / review ids; the id moved to a comment above the row
  (skipped where the comment block above already names it). Popover's foreign-invoker rows were
  in `renderBoth("sync action")` (not the "keyboard" describe the audit names): now "foreign
  invokers". The eight overlay browser files (Dialog, Popover, Menu, Menu.ContextTrigger,
  Combobox, Tooltip, Select, Toast) have one top-level `describe("<X> (browser)")` and no
  per-describe "(browser)" suffix (whitespace-heavy diff: `git diff -w`).
  Tools used: an AST scan (rolldown's `parseSync`; TypeScript 7 has no JS API) for titles.
- T11: Popover "invoker shim" describe removed; the case-insensitive row moved under "foreign
  invokers" (now runs in both modes, count unchanged).
- T12: shared `watchShow` records `children`; `recordClicks` moved to helpers.tsx, returns the
  array and removes its listener through `onCleanup`.
- T1: vitest.setup.ts: restore mocks, `cleanup()`, then jsdom empties the body, a browser runs
  `closeOpenTopLayer()` (now private to the setup file), then `runCleanups()`.
  vitest.browser.setup.ts (second browser `setupFiles` entry, its afterEach runs first):
  `mouse.releaseHeld()`. `leaveActEnvironment()` registers, once per test, an `onCleanup` that
  restores the value from before the test's first leave (two un-restored leaves in one test
  still end at the original value).
  Deviation from the audit: it said close the top layer *before* `cleanup()`. First tried that;
  a full jsdom run then had one unhandled error: tooltip.test's shim-fidelity row leaves a popup
  open with a `toggle` listener calling `screen.getByTestId`; the setup's hide queued a toggle
  that ran during a later test with an empty body. Closing after the unmount (only leftovers
  outside React) and relying on removal in jsdom (the shims close a removed popover / dialog
  silently, like browsers) avoids firing hides into components and listeners.
- T6: `centre(element, at?)`, `mouse.pressOn(target, { at, moveFirst, atPress })` in
  browser-commands.ts. Kept local: split presses with `act` + assertions between down and up
  (they use `centre`), Combobox's label press (corner + hold), `pressTrigger` (no waits), the
  dragged-off presses, `mouse.down`-only rows. A few rows gained a 20 ms wait after the release
  (before a poll or a quiet period).
- T8: `expectInlineEdges(popup, anchor, [popupEdge, anchorEdge], honoured?)` and
  `scrollContainerTo` in placement-browser.ts; Popover's after-scroll row uses `placedSide`
  (stricter than its old `>=` check: edges must meet; passes Chromium/Firefox, WebKit via CI).
- T10: `.pop` keyframes 200 -> 60 ms, #64 row fade 300 -> 100 ms.

## Checks
- Test names: jsdom 3360 passed before and after; browser 521 (515 + 6 skipped Chromium,
  491 + 30 Firefox) before and after; no duplicate full names. Name lists:
  scratchpad `base-*-names.txt`, `t9-*-names.txt`.
- jsdom shuffled: seeds 1, 2, 3 (T1 first version), 11, 12, 13 (final): all green.
- Mutations (all reverted):
  - T1: without the jsdom body clear, use-popover-hooks.test fails one row (leftover from
    another file). A probe browser file (not committed: row 1 opens a raw modal dialog, holds the
    mouse, leaves the act environment twice; row 2 asserts all three reset) fails row 2 without
    the browser close, without `runCleanups`, or without `releaseHeld`. Without the close, the
    real browser suite still passes (unmount removes React's popups; the close is for raw DOM).
  - T6: `atPress` after the release fails 13 rows; `centre` at the corner fails 3; no wait
    between down and up fails nothing on Chromium.
  - T8: inverting the probe default fails the 3 container rows using it (Chromium, Firefox).
  - T10: ignoring the animation baseline in use-exit-animation fails the 6 #64 rows on both
    engines at 100 ms; `transitionBoundary` with `default="none"` fails 24 suite VT rows.
- Timings (machine shared with other agents, so wall times are noisy):
  - jsdom: 18.7-20.2 s before, 18.4-19.8 s after (CPU-bound, unchanged).
  - Chromium, all files: sum of row durations 142.5 / 143.6 s -> 134.6 / 138.3 s, wall 27.0 /
    25.3 s -> 25.5 / 24.3 s.
  - Firefox (serial): sum 112.5 -> 113.6 s, wall 126.1 -> 129.1 s (noise; the extra 20 ms
    waits of T6 offset part of T10).
  - T10 alone, suite rows (Dialog / Popover / Menu): Chromium 11.3 / 7.3 / 6.7 ->
    10.6 / 6.7 / 6.0 s; Firefox 11.4 / 7.0 / 6.2 -> 11.0 / 6.6 / 5.7 s; 3 runs each green.

## Notes for later
- CLAUDE.md's "Both share src/__tests__/vitest.setup.ts" is still true; the browser project now
  also has vitest.browser.setup.ts (not edited: outside this task's files).
- Merging with dev-129's overlay test rows: the browser-file wrap re-indents whole files; resolve
  with `-Xignore-space-change` or re-run the wrap after.
