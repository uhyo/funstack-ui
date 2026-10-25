# Issue #130 phase 1 review (T9, T11, T12, T1, T6, T8, T10)

Branch origin/refactor/130-tests @ 327ddb3 (on master c65763f). Audit: wave18-audit-tests.md.
Reviewed in a private worktree (scratchpad rev-130); main checkout untouched.

## Verdict: merge (one trivial follow-up, optional)

## Runs (this review)
- jsdom + jsdom-isolated, shuffled seed 4242: 3384/3384. jsdom shuffled seed 77: 3347/3347.
  JSON reporter: 3384 names, no duplicate full names.
- Chromium: 518 + 6 skipped; shuffled seeds 7, 8: same. Firefox: 494 + 30 skipped; shuffled
  seed 9: same. WebKit not runnable here (host deps); CI run 40156135995 at 327ddb3: all four
  jobs success.

## Mutations (all reverted)
- Probe browser file (row 1: raw modal dialog + raw manual popover left open, addStyle, two
  leaveActEnvironment calls, mouse.down without up; row 2 asserts all reset, and that the file
  afterEach ran while still mounted): passes Chromium + Firefox.
  - vitest.browser.setup.ts removed from setupFiles: row 2 fails (mouseup count).
  - onCleanup in leaveActEnvironment removed: row 2 fails (act env false).
- jsdom body clear removed: full shuffled jsdom still green (defensive only; nothing in the
  current suite leaks a body element that a later test trips on).
- expectInlineEdges branch inverted: 5 rows fail on Chromium and 5 on Firefox (4 RTL-container
  rows + Menu's html-rtl submenu row): both branches live.
- .pop VT keyframes at 1 ms: all 35 suite VT rows (Dialog/Popover/Menu) pass on Chromium and
  Firefox. The rows read at `ready`, and the transition lasts as long as the 250 ms UA group/root
  animations (images fill `both`), so the keyframe length is not what they depend on: 60 ms has
  wide margin. Inference: the measured speed-up is mostly from the #64 fade (300 -> 100 ms).

## Findings
1. Low. Two titles still carry ids: number-field.test.tsx:639
   "disabled on component renders (#83, design/components/button.md 17.3)" and :1393
   "... insert no live region (#113 A1)". Same T9 treatment as the other 156.
2. Info. toast.browser's file afterEach also did `await sleep(0)` after closing the top layer
   (drained queued toggles inside the test). Dropped; fine now that the setup unmounts first
   (removal hides without events), but a raw-DOM popover with a listener closed by the setup
   would still queue its toggle into the next test. Documented in the setup comment; no row does
   that today.
3. Info. The setup teardown has no committed guard (the developer's and my probes are
   uncommitted). Optional: commit the browser probe as environment.browser.test.tsx rows.
4. Info. popover.browser.test.tsx:1084 after-scroll side now needs meeting edges (placedSide),
   stricter than the old `>=`. Green on WebKit CI (3 attempts earlier + 40156135995); watch.

## Checked, no issue
- T1: hook order (file hooks -> browser.setup releaseHeld -> setup restore/unmount/clear/close/
  cleanups/settle/resets) confirmed by probe; resetInvalidBatch kept; every removed per-file
  afterEach accounted for (9 jsdom body clears/popover hides, 8 closeOpenTopLayer+runCleanups,
  19 releaseHeld, 15 restoreAct; menu-context-trigger keeps vi.useRealTimers and scrollTo,
  select keeps its picker blur, ViewTransition describes keep awaiting transitions).
  All leaveActEnvironment calls are in it/beforeEach (none at collection or beforeAll).
  onCleanup steps now after unmount are listener/attribute removals: order-insensitive.
  Shims track open state in WeakSets with isConnected checks: no stale state after body clear.
- T6: every replacement keeps point (centre / `at`), down -> 20 ms -> atPress -> up; moveFirst
  matches Menu's old pressOn; Select's act(down,20,up)+flushFor(20) == act(pressOn). Rows that
  gain a 20 ms wait after release only lengthen a following poll/quiet period (no weakening).
- T8: edge pairs map 1:1 (submenu ["right","left"] -> opposite pair left/right).
- T9: ~100 renames read; all strip ids without changing meaning; "sync action" -> "foreign
  invokers" is accurate. Browser wrap: no per-describe "(browser)" left.
- T11: removed row's extra `defaultPrevented === false` is implied by the click row's
  isOpen() === false (the shim only runs an uncancelled command). Case-insensitive row now
  runs in both modes.
- T12: stop() always ran right before the expects; onCleanup removal is equivalent.
- CLAUDE.md line: accurate (jsdom-isolated also uses vitest.setup.ts, covered by "Both").
