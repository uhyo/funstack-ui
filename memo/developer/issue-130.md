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
  - T1: without the jsdom body clear, the first ordering failed one use-popover-hooks.test row
    (a leftover from another file); with the final ordering the full jsdom run stays green
    without it, so a jsdom probe file (row 1 leaves an open raw popover and server HTML in the
    body, row 2 asserts an empty body and nothing open) shows it: row 2 fails without the clear.
    A probe browser file (not committed: row 1 opens a raw modal dialog, holds the
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

## CI
- `gh workflow run ci.yml --ref refactor/130-tests`: run 40154862154 green (ci, chromium,
  firefox, webkit); the WebKit job re-run twice (attempts 2 and 3), green each time.
- CI "Duration" (worker startup is 86-95 % of it): chromium 41.1 s (master 39.9-42.9 s over the
  last 8 runs), firefox 123.5 s (master 108-126 s), webkit 47.8 / 47.3 / 51.6 s (master
  39.0-47.0 s). No gain visible on CI; WebKit sits at the top of master's range, not explained
  by these changes (the tests share is ~13 %), worth a look if it persists after merge.

## Rebase onto master (c65763f: #128, #129, #131)
- Conflicts: use-popover-hooks.test (T9 title next to #129's rows), combobox.browser (wrap redone
  with the wrap script on master's file; T1 import list keeps #129's `animationsFinished`).
  vitest.setup.ts merged cleanly and keeps #129's `resetInvalidBatch()`.
- New titles with ids (#129, #131): 3 renamed (combobox x2 "#132", commit-action-suite "#81 H2").
  No new per-file teardown, `restoreAct` or press copies in the rows #129 added.
  slider.browser's `centre` is unrounded (geometry maths, not a press point): left alone.
- Names: master 3384 jsdom / 524 browser (518 + 6 Chromium); branch the same counts. Leaf titles
  per file compared after stripping ids: browser identical; jsdom differs only by the intended
  renames (ids inside mixed parentheses, "moved from" note) and T11 (2 rows out, 1 row x 2 modes in).
- Gates after the rebase: typecheck, lint, format:check, build, root test:jsdom (3384), two
  shuffled jsdom runs, Chromium 518 + 6 skipped (25.8 s), Firefox 494 + 30 skipped (131.7 s).
- CLAUDE.md: one sentence on vitest.browser.setup.ts (lead's permission).

## Phase 2 (branch refactor/130-phase2 from d21d3ed)
Scope: T5, T4, T3, T7, review finding 1 (number-field titles) and 3 (teardown guard rows), #133
review gaps 1 and 2.
- Finding 1: number-field.test.tsx :639 / :1393 ids moved to comments.
- Finding 3: environment.browser.test.tsx "per-test teardown (setup files)" (2 ordered rows,
  `{ shuffle: false }`) and a new jsdom file src/__tests__/setup-teardown.test.tsx. Mutants: no
  browser close, no runCleanups, no vitest.browser.setup.ts, no onCleanup in leaveActEnvironment,
  no jsdom body clear: each fails the second row. The setup's `cleanup()` removed is equivalent
  (Testing Library's own afterEach unmounts).
- T5: `partCloses: [PartClose, ...]`; rows named "[part]" only where there are two (Menu: an item,
  the Trigger). Menu's local #110 block deleted. Menu.Trigger mousedown-prevent mutant: caught by 0
  rows before, 3 after.
- T4: suite "held content (design 4.4)" reads the DOM at the closing `beforetoggle` (synchronous
  in both shims, inside close()/hidePopover()). vi.spyOn in vitest 5 has no
  getMockImplementation for the original, hence the event. Dialog keeps its two stubbed-animation
  rows.
- T3: src/__tests__/overlay-close-part-suite.tsx (`describeOverlayClosePart`). Dialog gains the
  controlled variants (+6). Popover's two JS-free with-action rows merged into one suite row.
- T7: src/__tests__/foreign-invoker-press-browser-suite.tsx; both components outside act now.
  jsdom keeps one wiring row each + Combobox's submit-in-form and unmount rows.
- Gap 1: Popover "lost interest after an open by %s does nothing" (jsdom, both modes, script
  showPopover / foreign show-popover invoker) and Chromium "an open by %s stays through interest
  and lost interest". noteOpen-always-true mutant: 4 jsdom + 2 Chromium rows fail (survived before).
- Gap 2: Combobox "focus moving into the Popup's content" (relatedTarget path; deferred path with
  the move's own focusout silenced so only the null-relatedTarget focusout reaches the library).
  Each fails only under its own mutant.
- Counts: jsdom 3384 -> 3416 (dialog-close 43->45, dialog 108->114, menu 196->213, popover
  240->245, setup-teardown +2; combobox 161 unchanged: +2 gap rows, -2 classifier rows).
  Browser 524 -> 528 (environment +2, popover +2 Chromium-only). Every removed name is a moved or
  renamed row (list in the scratchpad p2/).
